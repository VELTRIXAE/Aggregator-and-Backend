import { createHash } from 'node:crypto';
import { Account, Address, Asset, Contract, Networks, StrKey, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { quote, routeAmounts } from './routing.js';
import { RpcLimiter } from './limits.js';
import { contractId, ServiceError, MAX_I128, type Chain, type Manifest, type Pool, type Readiness, type ReadinessBlocker, type Snapshot, type Token, type SimulatedSwap, type PreparedSwap, type QuoteRequest } from './domain.js';
export interface ReadResult { value: unknown; ledger: number; }
export interface Transport {
  network(): Promise<{passphrase: string}>;
  latest(): Promise<{sequence: number; closeTime: string}>;
  wasm(id: string): Promise<Uint8Array>;
  read(id: string, method: string, args?: xdr.ScVal[]): Promise<ReadResult>;
  transaction(hash: string): Promise<rpc.Api.GetTransactionResponse>;
  /** Optional single-call equivalent of hashing wasm(id) for many contracts: contract ID to the SHA-256 of its live code. */
  codeHashes?(ids: string[], expected: string[]): Promise<Map<string, string>>;
  simulateSwap?(publicKey: string, operation: xdr.Operation, expiresAt: number): Promise<SimulatedSwap>;
}
// The SDK types these XDR unions loosely, so only the fields below are trusted and anything else fails closed.
interface InstanceData { contract: xdr.ScAddress; val: {instance?: {executable?: {type?: string; wasmHash?: {value?: Uint8Array}}}} }
interface CodeData { hash: {value?: Uint8Array}; code: Uint8Array }
const LEDGER_ENTRIES_PER_CALL = 200;
export class StellarTransport implements Transport {
  private server: rpc.Server;
  private limiter: RpcLimiter;
  constructor(url: string, timeout: number, concurrency = 5) { this.server = new rpc.Server(url, {timeout}); this.limiter = new RpcLimiter(concurrency, 64, timeout); }
  network() { return this.limiter.run(() => this.server.getNetwork()); }
  latest() { return this.limiter.run(() => this.server.getLatestLedger()); }
  async wasm(id: string) {
    try { return await this.limiter.run(() => this.server.getContractWasmByContractId(id)); }
    catch (error) {
      if ((error as {code?:number}).code === 404) throw new ServiceError('CONTRACT_NOT_FOUND','Contract or its WASM is missing or archived on Testnet');
      throw error;
    }
  }
  async codeHashes(ids: string[], expected: string[]): Promise<Map<string, string>> {
    // Instances and code come from one call at one ledger, so this costs one RPC call rather than two per contract.
    const codeKeys = expected.map(hash => xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({hash: Buffer.from(hash, 'hex') as never})));
    const instanceKeys = ids.map(contract => new Contract(contract).getFootprint());
    const keys = [...codeKeys, ...instanceKeys], declared = new Map<string, string>(), verifiedCode = new Set<string>();
    for (let start = 0; start < keys.length; start += LEDGER_ENTRIES_PER_CALL) {
      const {entries, latestLedger} = await this.limiter.run(() => this.server.getLedgerEntries(...keys.slice(start, start + LEDGER_ENTRIES_PER_CALL)));
      for (const entry of entries) {
        if (entry.liveUntilLedgerSeq !== undefined && entry.liveUntilLedgerSeq < latestLedger) throw new ServiceError('RESTORATION_REQUIRED', 'Contract state requires restoration before reading');
        const val = entry.val as unknown as {type?: string; contractData?: InstanceData; contractCode?: CodeData};
        if (val.type === 'contractCode' && val.contractCode) {
          const digest = createHash('sha256').update(val.contractCode.code).digest('hex');
          if (Buffer.from(val.contractCode.hash.value ?? []).toString('hex') !== digest) throw new ServiceError('CONTRACT_MISMATCH', 'Contract code does not match its ledger hash');
          verifiedCode.add(digest);
        } else if (val.type === 'contractData' && val.contractData) {
          const executable = val.contractData.val.instance?.executable;
          if (executable?.type !== 'contractExecutableWasm' || !executable.wasmHash?.value) throw new ServiceError('CONTRACT_MISMATCH', 'Contract does not run reviewed WASM');
          declared.set(Address.fromScAddress(val.contractData.contract).toString(), Buffer.from(executable.wasmHash.value).toString('hex'));
        } else throw new ServiceError('INVALID_CHAIN_DATA', 'Unexpected ledger entry');
      }
    }
    const observed = new Map<string, string>();
    for (const contract of ids) {
      const hash = declared.get(contract);
      if (!hash) throw new ServiceError('CONTRACT_NOT_FOUND', 'Contract or its WASM is missing or archived on Testnet');
      // A different hash is returned for the caller to reject. An expected hash has to be backed by real code bytes.
      if (expected.includes(hash) && !verifiedCode.has(hash)) throw new ServiceError('CONTRACT_NOT_FOUND', 'Contract or its WASM is missing or archived on Testnet');
      observed.set(contract, hash);
    }
    return observed;
  }
  transaction(hash: string) { return this.limiter.run(() => this.server.getTransaction(hash)); }
  async simulateSwap(publicKey: string, operation: xdr.Operation, expiresAt: number): Promise<SimulatedSwap> {
    const account = await this.limiter.run(() => this.server.getAccount(publicKey));
    const tx = new TransactionBuilder(account, {fee: '100', networkPassphrase: Networks.TESTNET})
      .addOperation(operation).setTimebounds(0, Math.floor(expiresAt / 1000)).build();
    const simulation = await this.limiter.run(() => this.server.simulateTransaction(tx));
    if (rpc.Api.isSimulationRestore(simulation)) throw new ServiceError('RESTORATION_REQUIRED', 'Contract state requires restoration before swapping', 422);
    if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) throw new ServiceError('SWAP_SIMULATION_FAILED', 'Swap simulation failed; check balances, authorization, limits and contract state', 422);
    const assembled = rpc.assembleTransaction(tx, simulation).build();
    return {transactionXdr: assembled.toXDR(), resourceFee: simulation.minResourceFee, totalFee: assembled.fee, ledger: simulation.latestLedger};
  }
  async read(id: string, method: string, args: xdr.ScVal[] = []): Promise<ReadResult> {
    // A public simulation source only: no signing key is generated, requested, or stored.
    const source = new Account(StrKey.encodeEd25519PublicKey(Buffer.alloc(32)), '0');
    const tx = new TransactionBuilder(source, {fee:'100', networkPassphrase: Networks.TESTNET})
      .addOperation(new Contract(id).call(method, ...args)).setTimeout(30).build();
    const simulation = await this.limiter.run(() => this.server.simulateTransaction(tx));
    if (rpc.Api.isSimulationRestore(simulation)) throw new ServiceError('RESTORATION_REQUIRED', 'Contract state requires restoration before reading');
    if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) throw new ServiceError('CONTRACT_INVOCATION_FAILED', `Read simulation failed for ${method}`);
    return {value: scValToNative(simulation.result.retval), ledger: simulation.latestLedger};
  }
}
export class Cache<T> {
  private value?: T; private expires = 0; private pending?: Promise<T>;
  constructor(private ttl: number) {}
  async get(load: () => Promise<T>): Promise<T> {
    if (this.value !== undefined && Date.now() < this.expires) return this.value;
    if (this.pending) return this.pending;
    this.pending = load().then(value => {this.value = value; this.expires = Date.now() + this.ttl; return value;});
    try { return await this.pending; } finally { this.pending = undefined; }
  }
}
async function mapLimited<T, R>(items: T[], map: (item:T) => Promise<R>, deadline = Infinity, batchSize = 5): Promise<R[]> {
  const result: R[] = [];
  for (let i=0; i<items.length; i+=batchSize) {
    if (Date.now() >= deadline) throw new ServiceError('DISCOVERY_TIMEOUT', 'Pool collection exceeded its time budget; use a smaller factory or an indexer', 504);
    result.push(...await Promise.all(items.slice(i,i+batchSize).map(map)));
  }
  return result;
}
function id(value: unknown): string {
  const result = contractId.safeParse(value);
  if (!result.success) throw new ServiceError('INVALID_CHAIN_DATA', 'Invalid on-chain contract ID');
  return result.data;
}
function integer(value: unknown): bigint {
  if ((typeof value !== 'bigint' && typeof value !== 'number') || (typeof value === 'number' && !Number.isSafeInteger(value))) throw new ServiceError('INVALID_CHAIN_DATA', 'Invalid on-chain integer');
  const n = BigInt(value); if (n < 0n || n > MAX_I128) throw new ServiceError('INVALID_CHAIN_DATA', 'Invalid on-chain amount'); return n;
}
/** Immutable under the reviewed pair code: set once by initialize, with no setter or upgrade entry point. */
interface PoolIdentity { id: string; token0: string; token1: string; }
type Deployment = NonNullable<Manifest['soroswap']>;
const SAME_LEDGER_ATTEMPTS = 3;
// getLatestLedger and simulations run concurrently but can straddle one ledger close. Reserves still have to agree exactly.
const MAX_LATEST_LEDGER_SKEW = 1;
export interface DiscoveryOptions { maxPools: number; pageSize: number; timeoutMs: number; }
export class StellarChain implements Chain {
  private discovery = new Cache<PoolIdentity[]>(60000);
  private metadata = new Cache<Token[]>(300000);
  private snapshots = new Cache<Snapshot>(0);
  private options: DiscoveryOptions;
  constructor(public manifest: Manifest, public transport: Transport, options: Partial<DiscoveryOptions> = {}) {
    this.options = {maxPools: 1000, pageSize: 5, timeoutMs: 15000, ...options};
    for (const [key, min, max] of [['maxPools', 1, 1000], ['pageSize', 1, 20], ['timeoutMs', 100, 15000]] as const) {
      const n = this.options[key];
      if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Invalid discovery ${key}`);
    }
  }
  private async assertTestnet() {
    const net = await this.transport.network();
    if (net.passphrase !== Networks.TESTNET) throw new ServiceError('WRONG_NETWORK', 'RPC is not Stellar Testnet');
  }
  // Read actions run beside the network check, because every sequential RPC call moves state to a later ledger.
  // No result is released until the check has passed; networkFirst is for actions that use an account or build a transaction.
  private async guarded<T>(action: () => Promise<T>, {networkFirst = false} = {}): Promise<T> {
    try {
      if (networkFirst) { await this.assertTestnet(); return await action(); }
      const network = this.assertTestnet(), work = Promise.resolve().then(action);
      await Promise.allSettled([network, work]);
      await network;
      return await work;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('RPC_UNAVAILABLE', 'Unable to retrieve validated blockchain state');
    }
  }
  private async latest() {
    const latest = await this.transport.latest();
    const closed = Number(latest.closeTime) * 1000;
    if (!Number.isSafeInteger(latest.sequence) || latest.sequence < 1 || !Number.isFinite(closed) || closed <= 0 || closed > Date.now() + 5000) throw new ServiceError('INVALID_CHAIN_DATA', 'Invalid RPC ledger metadata');
    if (Date.now() - closed > 30000) throw new ServiceError('STALE_STATE', 'RPC state is too old');
    return latest;
  }
  private async verifyCode(contracts: {id: string; hash: string}[]) {
    const observed = this.transport.codeHashes
      ? await this.transport.codeHashes(contracts.map(c => c.id), [...new Set(contracts.map(c => c.hash))])
      : new Map(await mapLimited(contracts, async c => [c.id, createHash('sha256').update(await this.transport.wasm(c.id)).digest('hex')] as const, Infinity, this.options.pageSize));
    for (const contract of contracts) if (observed.get(contract.id) !== contract.hash) throw new ServiceError('CONTRACT_MISMATCH', 'Deployed WASM differs from the reviewed manifest');
  }
  private async checkDeployment(pools: PoolIdentity[] = []): Promise<Deployment> {
    const d = this.manifest.soroswap;
    if (!d) throw new ServiceError('NOT_CONFIGURED', 'A verified Soroswap Testnet deployment is required');
    const v = this.manifest.veltrixae;
    const contracts = [{id:d.factory,hash:d.factoryWasmHash},{id:d.router,hash:d.routerWasmHash},...(v?[{id:v.aggregator,hash:v.aggregatorWasmHash}]:[]),...pools.map(pool => ({id:pool.id,hash:d.pairWasmHash}))];
    const [linkedFactory,adapters] = await Promise.all([this.transport.read(d.router,'get_factory'),v ? this.transport.read(v.aggregator,'get_adapters') : undefined,this.verifyCode(contracts)]);
    if (id(linkedFactory.value) !== d.factory) throw new ServiceError('CONTRACT_MISMATCH','Router factory differs from manifest');
    if (v && (!Array.isArray(adapters?.value) || !adapters.value.some(a => a.protocol_id === 0 && a.router === d.router && a.paused === false))) throw new ServiceError('CONTRACT_MISMATCH', 'Aggregator has no active matching Soroswap router');
    return d;
  }
  async verifyDeployment() {
    return this.guarded(async () => {
      await this.checkDeployment();
      return {verified:true, network:'testnet', veltrixaeConfigured:!!this.manifest.veltrixae};
    });
  }
  private discover(d: Deployment, deadline: number): Promise<PoolIdentity[]> {
    return this.discovery.get(async () => {
      const n = integer((await this.transport.read(d.factory,'all_pairs_length')).value);
      if (n > BigInt(this.options.maxPools)) throw new ServiceError('POOL_LIMIT', `Factory exceeds configured MAX_DISCOVERY_POOLS (${this.options.maxPools}); use an indexer or review the bounded configuration`);
      const ids = await mapLimited(Array.from({length:Number(n)}, (_,i) => i), async i => id((await this.transport.read(d.factory,'all_pairs',[nativeToScVal(i,{type:'u32'})])).value), deadline, this.options.pageSize);
      if (new Set(ids).size !== ids.length) throw new ServiceError('INVALID_CHAIN_DATA', 'Factory returned duplicate pools');
      return mapLimited(ids, async poolId => {
        const [token0,token1,factory] = (await Promise.all(['token_0','token_1','factory'].map(method => this.transport.read(poolId,method)))).map(r => id(r.value)) as [string,string,string];
        const registered = await this.transport.read(d.factory,'get_pair',[new Address(token0).toScVal(),new Address(token1).toScVal()]);
        if (id(registered.value) !== poolId) throw new ServiceError('CONTRACT_MISMATCH', 'Pool is not registered for its tokens');
        if (factory !== d.factory || token0 === token1) throw new ServiceError('CONTRACT_MISMATCH', 'Invalid pair identity');
        return {id:poolId,token0,token1};
      }, deadline, this.options.pageSize);
    });
  }
  private async reserves(poolId: string) {
    const {value, ledger} = await this.transport.read(poolId,'get_reserves');
    if (!Array.isArray(value) || value.length !== 2) throw new ServiceError('INVALID_CHAIN_DATA','Invalid reserves');
    return {reserve0:integer(value[0]).toString(), reserve1:integer(value[1]).toString(), ledger};
  }
  async snapshot(): Promise<Snapshot> {
    return this.snapshots.get(() => this.guarded(async () => {
      const d = this.manifest.soroswap;
      if (!d) throw new ServiceError('NOT_CONFIGURED', 'A verified Soroswap Testnet deployment is required');
      const deadline = Date.now() + this.options.timeoutMs;
      // Discovery and pool identity may be cached. Code hashes and reserves never are: every quote reads them again.
      const identities = await this.discover(d, deadline);
      await this.checkDeployment(identities);
      for (let attempt = 0; attempt < SAME_LEDGER_ATTEMPTS && Date.now() < deadline; attempt++) {
        const observedAt = Date.now();
        const [latest,pools] = await Promise.all([this.latest(), mapLimited(identities, async pool => ({...pool, protocol:'Soroswap', ...await this.reserves(pool.id), feeBps:30, observedAt} satisfies Pool), deadline, this.options.pageSize)]);
        const ledger = pools[0]?.ledger ?? latest.sequence;
        if (pools.some(p => p.ledger !== ledger) || Math.abs(ledger - latest.sequence) > MAX_LATEST_LEDGER_SKEW) continue;
        if (Date.now() >= deadline) break;
        return {pools,ledger,observedAt};
      }
      if (Date.now() >= deadline) throw new ServiceError('DISCOVERY_TIMEOUT', 'Pool collection exceeded its time budget', 504);
      throw new ServiceError('INCONSISTENT_STATE','Snapshot spans multiple ledgers; retry');
    }));
  }
  async validateQuote(quote: import('./domain.js').Quote): Promise<void> {
    await this.guarded(async () => {
      const d = this.manifest.soroswap;
      if (!d) throw new ServiceError('NOT_CONFIGURED','Soroswap is not configured');
      const route = quote.selectedRoute, exactIn = quote.kind === 'exactIn', amount = BigInt(exactIn ? quote.amountIn : quote.amountOut);
      for (let attempt = 0; attempt < SAME_LEDGER_ATTEMPTS && Date.now() < quote.expiresAt; attempt++) {
        // Parity only means something on one ledger, so fresh reserves are read beside the router simulation.
        const [result,fresh] = await Promise.all([
          this.transport.read(d.router, exactIn?'router_get_amounts_out':'router_get_amounts_in',[nativeToScVal(amount,{type:'i128'}),nativeToScVal(route.path.map(p=>new Address(p).toScVal()))]),
          Promise.all(route.pools.map(pool => this.reserves(pool))),
        ]);
        if (result.ledger < quote.ledger || fresh.some(r => r.ledger !== result.ledger)) continue;
        const values = result.value;
        if (!Array.isArray(values) || values.length !== route.path.length) throw new ServiceError('QUOTE_MISMATCH','Router estimate differs from local calculation');
        const routerIn = integer(values[0]), routerOut = integer(values.at(-1));
        const identities = await this.discover(d, Date.now() + this.options.timeoutMs);
        const used = route.pools.map((poolId,i) => {
          const identity = identities.find(p => p.id === poolId);
          if (!identity) throw new ServiceError('CONTRACT_MISMATCH','Route uses a pool outside the configured factory');
          return {...identity, ...fresh[i]!, protocol:'Soroswap', feeBps:30, observedAt:quote.observedAt} satisfies Pool;
        });
        let local: bigint[];
        try { local = routeAmounts(quote.kind, amount, route.path, used); }
        catch (error) { if (!(error instanceof ServiceError)) throw error; throw new ServiceError('QUOTE_MISMATCH','Router estimate differs from local calculation'); }
        if (local[0] !== routerIn || local.at(-1) !== routerOut) throw new ServiceError('QUOTE_MISMATCH','Router estimate differs from local calculation');
        if (routerIn.toString() !== quote.amountIn || routerOut.toString() !== quote.amountOut) throw new ServiceError('STALE_STATE','Reserves moved after this quote was calculated; refresh');
        if (Date.now() >= quote.expiresAt) throw new ServiceError('STALE_STATE','Quote expired during validation');
        return;
      }
      if (Date.now() >= quote.expiresAt) throw new ServiceError('STALE_STATE','Quote expired during validation');
      throw new ServiceError('INCONSISTENT_STATE','Router simulation uses a different ledger; retry');
    });
  }
  async readiness(): Promise<Readiness> {
    const codeOf = (error: unknown) => error instanceof ServiceError ? error.code : 'RPC_UNAVAILABLE';
    let networkVerified = false;
    try { await this.assertTestnet(); networkVerified = true; } catch { /* reported below */ }
    const blockers: ReadinessBlocker[] = [];
    const report = {network:'testnet',mainnetEnabled:false,custody:'none',submitsTransactions:false,checkedAt:Date.now(),networkVerified} as const;
    let deployment: Readiness['deployment'] = {status:'failed',code:null}, liquidity: Readiness['liquidity'] = {status:'unknown',pools:null,fundedPools:null,code:null}, ledger: number | null = null;
    if (!networkVerified) { blockers.push('NETWORK_UNVERIFIED'); deployment = {status:'failed',code:'NETWORK_UNVERIFIED'}; }
    else if (!this.manifest.soroswap) { blockers.push('AMM_NOT_CONFIGURED'); deployment = {status:'not-configured',code:'NOT_CONFIGURED'}; }
    else {
      // Report verified only after the checks have actually completed; a failed snapshot says nothing about them.
      try { await this.verifyDeployment(); deployment = {status:'verified',code:null}; }
      catch (error) { deployment = {status:'failed',code:codeOf(error)}; blockers.push('AMM_UNVERIFIED'); }
      if (deployment.status === 'verified') try {
        const snap = await this.snapshot(), funded = snap.pools.filter(p => BigInt(p.reserve0) > 0n && BigInt(p.reserve1) > 0n).length;
        ledger = snap.ledger;
        liquidity = {status:snap.pools.length === 0 ? 'empty' : funded === 0 ? 'unfunded' : 'funded',pools:snap.pools.length,fundedPools:funded,code:null};
        if (snap.pools.length === 0) blockers.push('NO_POOLS'); else if (funded === 0) blockers.push('NO_FUNDED_POOLS');
      } catch (error) {
        const code = codeOf(error);
        // Pool hash or identity failures are deployment failures; timeouts and ledger skew only leave liquidity unknown.
        if (['CONTRACT_MISMATCH','CONTRACT_NOT_FOUND','INVALID_CHAIN_DATA'].includes(code)) { deployment = {status:'failed',code}; blockers.push('AMM_UNVERIFIED'); }
        else liquidity = {...liquidity,code};
      }
    }
    if (!this.manifest.veltrixae) blockers.push('AGGREGATOR_NOT_DEPLOYED');
    const quotesAvailable = deployment.status === 'verified' && liquidity.status === 'funded';
    return {...report,ledger,deployment,liquidity,aggregator:{status:!this.manifest.veltrixae?'not-deployed':deployment.status==='verified'&&liquidity.code===null?'verified':'unknown'},quotesAvailable,swapPreparationAvailable:quotesAvailable&&!!this.manifest.veltrixae&&blockers.length===0,blockers};
  }
  async tokens(): Promise<Token[]> {
    return this.metadata.get(() => this.guarded(async () => {
      const deadline = Date.now() + this.options.timeoutMs;
      const snap = await this.snapshot();
      const ids = [...new Set([...snap.pools.flatMap(p => [p.token0,p.token1]),...this.manifest.assets.map(a=>a.contract)])];
      return mapLimited(ids, async token => {
        const [symbol,name,decimals] = await Promise.all(['symbol','name','decimals'].map(m => this.transport.read(token,m)));
        if (typeof symbol!.value !== 'string' || typeof name!.value !== 'string' || symbol!.value.length > 256 || name!.value.length > 1024) throw new ServiceError('INVALID_CHAIN_DATA','Invalid token metadata');
        const precision = integer(decimals!.value); if (precision > 38n) throw new ServiceError('INVALID_CHAIN_DATA','Token precision exceeds supported range');
        const configured = this.manifest.assets.find(a=>a.contract===token);
        let asset: Token['asset'];
        if (configured) {
          const stellarAsset = configured.native ? Asset.native() : configured.code && configured.issuer ? new Asset(configured.code,configured.issuer) : undefined;
          if (!stellarAsset || stellarAsset.contractId(Networks.TESTNET) !== token) throw new ServiceError('ASSET_MISMATCH','Asset does not derive to configured Testnet contract');
          asset = configured.native ? {code:'XLM'} : {code:configured.code!,issuer:configured.issuer!};
        }
        return {contract:token,symbol:symbol!.value,name:name!.value,decimals:Number(precision),asset,verification:'onchain-metadata-only'};
      }, deadline);
    }));
  }
  async status() {
    return this.guarded(async () => {
      const {sequence,closeTime}=await this.latest();
      return {network:'testnet',sequence,closeTime,soroswapConfigured:!!this.manifest.soroswap,veltrixaeConfigured:!!this.manifest.veltrixae};
    });
  }
  async transaction(hash: string) {
    return this.guarded(async () => {
      const tx = await this.transport.transaction(hash);
      const found = tx.status === 'SUCCESS' || tx.status === 'FAILED';
      return {hash,network:'testnet',status:tx.status,finalized:found,ledger:found?tx.ledger:null,latestLedger:tx.latestLedger,
        resultXdr:found?tx.resultXdr.toXDR('base64'):null, metadataXdr:found?tx.resultMetaXdr.toXDR('base64'):null,
        failure:tx.status==='FAILED'?String(tx.resultXdr.result.toXdrObject().code):null,
        explorerUrl:`https://stellar.expert/explorer/testnet/tx/${hash}`,
        note:tx.status==='NOT_FOUND'?'Not found in RPC retention window; may be pending, unknown, or pruned':null};
    });
  }
  async prepareSwap(request: QuoteRequest, publicKey: string): Promise<PreparedSwap> {
    if (!StrKey.isValidEd25519PublicKey(publicKey)) throw new ServiceError('INVALID_RECIPIENT', 'Expected a public account', 400);
    return this.guarded(async () => {
      if (!this.manifest.veltrixae) throw new ServiceError('NOT_CONFIGURED', 'A verified VELTRIXAE aggregator is required');
      if (!this.transport.simulateSwap) throw new ServiceError('NOT_CONFIGURED', 'Swap simulation transport is unavailable');
      // Accept request parameters, never a client-supplied quote or arbitrary XDR.
      const estimate = quote(request, await this.snapshot());
      await this.validateQuote(estimate);
      const simulated = await this.transport.simulateSwap(publicKey, this.swapOperation(estimate, publicKey), estimate.expiresAt);
      if (simulated.ledger !== estimate.ledger) throw new ServiceError('INCONSISTENT_STATE', 'Swap simulation uses a different ledger; retry');
      if (Date.now() >= estimate.expiresAt) throw new ServiceError('QUOTE_EXPIRED', 'Refresh the quote', 422);
      return {...simulated, network: 'testnet', aggregator: this.manifest.veltrixae.aggregator, quote: estimate, requiresWalletSignature: true, submitted: false};
    }, {networkFirst:true});
  }
  // Returns only an unsigned invocation operation. Wallet must assemble, simulate and sign.
  swapOperation(quote: import('./domain.js').Quote, recipient: string): xdr.Operation {
    if (!StrKey.isValidEd25519PublicKey(recipient)) throw new ServiceError('INVALID_RECIPIENT','Expected a public account',400);
    if (Date.now() >= quote.expiresAt) throw new ServiceError('QUOTE_EXPIRED','Refresh the quote',422);
    const target = this.manifest.veltrixae?.aggregator;
    if (!target) throw new ServiceError('NOT_CONFIGURED','VELTRIXAE aggregator is not configured');
    // Rust #[contracttype] structs use Symbol keys, not the default String map keys.
    const fields: [string, xdr.ScVal][] = [
      ['bytes', xdr.ScVal.scvVoid()],
      ['parts', nativeToScVal(1,{type:'u32'})],
      ['path', nativeToScVal(quote.selectedRoute.path.map(p=>new Address(p).toScVal()))],
      ['protocol_id', nativeToScVal(0,{type:'u32'})],
    ];
    const distribution = xdr.ScVal.scvVec([xdr.ScVal.scvMap(fields.map(([key,val])=>new xdr.ScMapEntry({key:xdr.ScVal.scvSymbol(key),val})))]);
    return new Contract(target).call(quote.kind==='exactIn'?'swap_exact_tokens_for_tokens':'swap_tokens_for_exact_tokens',
      new Address(quote.tokenIn).toScVal(),new Address(quote.tokenOut).toScVal(),nativeToScVal(BigInt(quote.kind==='exactIn'?quote.amountIn:quote.amountOut),{type:'i128'}),nativeToScVal(BigInt(quote.kind==='exactIn'?quote.minimumReceived:quote.maximumInput),{type:'i128'}),distribution,new Address(recipient).toScVal(),nativeToScVal(BigInt(Math.floor(quote.expiresAt/1000)),{type:'u64'}));
  }
}
