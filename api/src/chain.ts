import { createHash } from 'node:crypto';
import { Account, Address, Asset, Contract, Networks, StrKey, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { quote } from './routing.js';
import { contractId, ServiceError, MAX_I128, type Chain, type Manifest, type Pool, type Snapshot, type Token, type SimulatedSwap, type PreparedSwap, type QuoteRequest } from './domain.js';
export interface ReadResult { value: unknown; ledger: number; }
export interface Transport {
  network(): Promise<{passphrase: string}>;
  latest(): Promise<{sequence: number; closeTime: string}>;
  wasm(id: string): Promise<Uint8Array>;
  read(id: string, method: string, args?: xdr.ScVal[]): Promise<ReadResult>;
  transaction(hash: string): Promise<rpc.Api.GetTransactionResponse>;
  simulateSwap?(publicKey: string, operation: xdr.Operation, expiresAt: number): Promise<SimulatedSwap>;
}
export class StellarTransport implements Transport {
  private server: rpc.Server;
  constructor(url: string, timeout: number) { this.server = new rpc.Server(url, {timeout}); }
  network() { return this.server.getNetwork(); }
  latest() { return this.server.getLatestLedger(); }
  async wasm(id: string) {
    try { return await this.server.getContractWasmByContractId(id); }
    catch (error) {
      if ((error as {code?:number}).code === 404) throw new ServiceError('CONTRACT_NOT_FOUND','Contract or its WASM is missing or archived on Testnet');
      throw error;
    }
  }
  transaction(hash: string) { return this.server.getTransaction(hash); }
  async simulateSwap(publicKey: string, operation: xdr.Operation, expiresAt: number): Promise<SimulatedSwap> {
    const account = await this.server.getAccount(publicKey);
    const tx = new TransactionBuilder(account, {fee: '100', networkPassphrase: Networks.TESTNET})
      .addOperation(operation).setTimebounds(0, Math.floor(expiresAt / 1000)).build();
    const simulation = await this.server.simulateTransaction(tx);
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
    const simulation = await this.server.simulateTransaction(tx);
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
async function mapLimited<T, R>(items: T[], map: (item:T) => Promise<R>): Promise<R[]> {
  const result: R[] = [];
  for (let i=0; i<items.length; i+=5) result.push(...await Promise.all(items.slice(i,i+5).map(map)));
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
export class StellarChain implements Chain {
  private discovery = new Cache<string[]>(60000);
  private metadata = new Cache<Token[]>(300000);
  constructor(public manifest: Manifest, public transport: Transport) {}
  private async guarded<T>(action: () => Promise<T>): Promise<T> {
    try {
      const net = await this.transport.network();
      if (net.passphrase !== Networks.TESTNET) throw new ServiceError('WRONG_NETWORK', 'RPC is not Stellar Testnet');
      return await action();
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
  private async verify(id: string, hash: string) {
    const actual = createHash('sha256').update(await this.transport.wasm(id)).digest('hex');
    if (actual !== hash) throw new ServiceError('CONTRACT_MISMATCH', 'Deployed WASM differs from the reviewed manifest');
  }
  async verifyDeployment() {
    return this.guarded(async () => {
      const d = this.manifest.soroswap;
      if (!d) throw new ServiceError('NOT_CONFIGURED', 'A verified Soroswap Testnet deployment is required');
      await Promise.all([this.verify(d.factory,d.factoryWasmHash),this.verify(d.router,d.routerWasmHash)]);
      if (id((await this.transport.read(d.router,'get_factory')).value) !== d.factory) throw new ServiceError('CONTRACT_MISMATCH','Router factory differs from manifest');
      if (this.manifest.veltrixae) {
        const v = this.manifest.veltrixae;
        await this.verify(v.aggregator,v.aggregatorWasmHash);
        const adapters = (await this.transport.read(v.aggregator, 'get_adapters')).value;
        if (!Array.isArray(adapters) || !adapters.some(a => a.protocol_id === 0 && a.router === d.router && a.paused === false)) throw new ServiceError('CONTRACT_MISMATCH', 'Aggregator has no active matching Soroswap router');
      }
      return {verified:true, network:'testnet', veltrixaeConfigured:!!this.manifest.veltrixae};
    });
  }
  async snapshot(): Promise<Snapshot> {
    return this.guarded(async () => {
      await this.verifyDeployment();
      const d = this.manifest.soroswap!;
      const ids = await this.discovery.get(async () => {
        const n = integer((await this.transport.read(d.factory,'all_pairs_length')).value);
        if (n > 100n) throw new ServiceError('POOL_LIMIT', 'Factory exceeds the 100-pool discovery limit; configure an indexer');
        return mapLimited(Array.from({length:Number(n)}, (_,i) => i), async i => id((await this.transport.read(d.factory,'all_pairs',[nativeToScVal(i,{type:'u32'})])).value));
      });
      if (new Set(ids).size !== ids.length) throw new ServiceError('INVALID_CHAIN_DATA', 'Factory returned duplicate pools');
      // Discovery may be cached. Reserves never are: every quote reads them again.
      const observedAt = Date.now();
      const pools = await mapLimited(ids, async (poolId: string) => {
        await this.verify(poolId,d.pairWasmHash);
        const results = await Promise.all(['token_0','token_1','get_reserves','factory'].map(method => this.transport.read(poolId,method)));
        const [t0,t1,reserves,factory] = results as [ReadResult,ReadResult,ReadResult,ReadResult];
        if (id(factory.value) !== d.factory || id(t0.value) === id(t1.value)) throw new ServiceError('CONTRACT_MISMATCH', 'Invalid pair identity');
        const ledgers = results.map(r => r.ledger);
        if (new Set(ledgers).size !== 1) throw new ServiceError('INCONSISTENT_STATE','Pool reads span multiple ledgers; retry');
        if (!Array.isArray(reserves.value) || reserves.value.length !== 2) throw new ServiceError('INVALID_CHAIN_DATA','Invalid reserves');
        return {id:poolId,protocol:'Soroswap',token0:id(t0.value),token1:id(t1.value),reserve0:integer(reserves.value[0]).toString(),reserve1:integer(reserves.value[1]).toString(),feeBps:30,ledger:ledgers[0]!,observedAt} satisfies Pool;
      });
      const latest = await this.latest();
      if (new Set(pools.map(p => p.ledger)).size > 1 || pools.some(p => p.ledger !== latest.sequence)) throw new ServiceError('INCONSISTENT_STATE','Snapshot spans multiple ledgers; retry');
      if (Date.now() - observedAt > 15000) throw new ServiceError('STALE_STATE','RPC state is too old');
      return {pools,ledger:latest.sequence,observedAt};
    });
  }
  async validateQuote(quote: import('./domain.js').Quote): Promise<void> {
    await this.guarded(async () => {
      const d = this.manifest.soroswap;
      if (!d) throw new ServiceError('NOT_CONFIGURED','Soroswap is not configured');
      const route = quote.selectedRoute;
      const result = await this.transport.read(d.router, quote.kind==='exactIn'?'router_get_amounts_out':'router_get_amounts_in',[
        nativeToScVal(BigInt(quote.kind==='exactIn'?quote.amountIn:quote.amountOut),{type:'i128'}),
        nativeToScVal(route.path.map(p=>new Address(p).toScVal()))]);
      if (result.ledger !== quote.ledger) throw new ServiceError('INCONSISTENT_STATE','Router simulation uses a different ledger; retry');
      const values = result.value;
      if (!Array.isArray(values) || values.length !== route.path.length || integer(values[0]).toString() !== quote.amountIn || integer(values.at(-1)).toString() !== quote.amountOut) throw new ServiceError('QUOTE_MISMATCH','Router estimate differs from local calculation');
      if (Date.now() >= quote.expiresAt) throw new ServiceError('STALE_STATE','Quote expired during validation');
    });
  }
  async tokens(): Promise<Token[]> {
    return this.metadata.get(() => this.guarded(async () => {
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
      });
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
    });
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
