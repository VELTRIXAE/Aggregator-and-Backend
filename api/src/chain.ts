import { createHash } from 'node:crypto';
import { Account, Address, Asset, Contract, Networks, StrKey, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { contractId, ServiceError, MAX_I128, type Chain, type Manifest, type Pool, type Snapshot, type Token } from './domain.js';
export interface ReadResult { value: unknown; ledger: number; }
export interface Transport {
  network(): Promise<{passphrase: string}>;
  latest(): Promise<{sequence: number; closeTime: string}>;
  wasm(id: string): Promise<Uint8Array>;
  read(id: string, method: string, args?: xdr.ScVal[]): Promise<ReadResult>;
  transaction(hash: string): Promise<rpc.Api.GetTransactionResponse>;
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
function id(value: unknown): string { return contractId.parse(value); }
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
        if (!Array.isArray(adapters) || !adapters.some(a => Array.isArray(a.protocol_id) && a.protocol_id[0] === 'Soroswap' && a.router === d.router && a.paused === false)) throw new ServiceError('CONTRACT_MISMATCH', 'Aggregator has no active matching Soroswap router');
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
      const latest = await this.transport.latest();
      if (new Set(pools.map(p => p.ledger)).size > 1 || pools.some(p => p.ledger !== latest.sequence)) throw new ServiceError('INCONSISTENT_STATE','Snapshot spans multiple ledgers; retry');
      if (Date.now() - observedAt > 15000 || Date.now() - Number(latest.closeTime)*1000 > 30000) throw new ServiceError('STALE_STATE','RPC state is too old');
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
    return this.guarded(async () => ({network:'testnet',...(await this.transport.latest()),soroswapConfigured:!!this.manifest.soroswap,veltrixaeConfigured:!!this.manifest.veltrixae}));
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
  // Returns only an unsigned invocation operation. Wallet must assemble, simulate and sign.
  swapOperation(quote: import('./domain.js').Quote, recipient: string): xdr.Operation {
    if (!StrKey.isValidEd25519PublicKey(recipient)) throw new ServiceError('INVALID_RECIPIENT','Expected a public account',400);
    if (Date.now() >= quote.expiresAt) throw new ServiceError('QUOTE_EXPIRED','Refresh the quote',422);
    const target = this.manifest.veltrixae?.aggregator;
    if (!target) throw new ServiceError('NOT_CONFIGURED','VELTRIXAE aggregator is not configured');
    const distribution = nativeToScVal([{protocol_id:xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Soroswap')]),path:quote.selectedRoute.path.map(p=>new Address(p).toScVal()),parts:nativeToScVal(1,{type:'u32'}),bytes:xdr.ScVal.scvVoid()}]);
    return new Contract(target).call(quote.kind==='exactIn'?'swap_exact_tokens_for_tokens':'swap_tokens_for_exact_tokens',
      new Address(quote.tokenIn).toScVal(),new Address(quote.tokenOut).toScVal(),nativeToScVal(BigInt(quote.kind==='exactIn'?quote.amountIn:quote.amountOut),{type:'i128'}),nativeToScVal(BigInt(quote.kind==='exactIn'?quote.minimumReceived:quote.maximumInput),{type:'i128'}),distribution,new Address(recipient).toScVal(),nativeToScVal(BigInt(Math.floor(quote.expiresAt/1000)),{type:'u64'}));
  }
}
