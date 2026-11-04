import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Account, Address, Networks, Operation, nativeToScVal, scValToNative, SorobanDataBuilder, StrKey, TransactionBuilder, xdr, type rpc, type Transaction} from '@stellar/stellar-sdk';
import {Cache, StellarChain, StellarTransport, type Transport} from '../src/chain.js';
import {manifestSchema, ServiceError, quoteRequest, type Manifest} from '../src/domain.js';
import {output, quote} from '../src/routing.js';
import {A,B,address,snapshot} from './fixtures.js';
const factory=address(10),router=address(11),pair=address(4),aggregator=address(12);
const wasm=Buffer.from('reviewed test fixture, not deployed code');
const hash=createHash('sha256').update(wasm).digest('hex');
const manifest=manifestSchema.parse({network:'testnet',soroswap:{factory,router,factoryWasmHash:hash,routerWasmHash:hash,pairWasmHash:hash},veltrixae:null,assets:[]});
function transport(overrides:Partial<Transport>={}):Transport{
 return {network:async()=>({passphrase:Networks.TESTNET}),latest:async()=>({sequence:123,closeTime:String(Math.floor(Date.now()/1000))}),wasm:async()=>wasm,
 transaction:async()=>({status:'NOT_FOUND',latestLedger:123} as rpc.Api.GetTransactionResponse),
 read:async(id,method,args=[])=>{
  let value:unknown;
  switch(method){case 'get_factory':case 'factory':value=factory;break;case 'all_pairs_length':value=1;break;case 'get_pair':case 'all_pairs':value=pair;break;case 'token_0':value=A;break;case 'token_1':value=B;break;case 'get_reserves':value=[1000000n,2000000n];break;case 'symbol':value='T';break;case 'name':value='Test';break;case 'decimals':value=7;break;
   case 'get_adapters':value=[{protocol_id:0,router,paused:false}];break;
   case 'router_get_amounts_out':value=[10000n,19743n];break;
   default:throw new Error('Unknown mock method '+method);
  }
  return {value,ledger:123};
 },...overrides};
}
test('discovers real interface pools, validates identity, metadata and router quotation',async()=>{
 const chain=new StellarChain(manifest,transport());
 const s=await chain.snapshot();assert.equal(s.pools[0]?.id,pair);
 assert.equal((await chain.tokens())[0]?.verification,'onchain-metadata-only');
 await chain.validateQuote(quote(quoteRequest.parse({tokenIn:A,tokenOut:B,amount:'10000'}),s));
 assert.equal((await chain.transaction('a'.repeat(64))).status,'NOT_FOUND');
});
test('refuses unconfigured, wrong network, wrong WASM, malformed reserves and RPC errors',async()=>{
 const cases:[StellarChain,string][]=[
  [new StellarChain({...manifest,soroswap:null},transport()),'NOT_CONFIGURED'],
  [new StellarChain(manifest,transport({network:async()=>({passphrase:Networks.PUBLIC})})),'WRONG_NETWORK'],
  [new StellarChain(manifest,transport({wasm:async()=>Buffer.from('changed')})),'CONTRACT_MISMATCH'],
  [new StellarChain(manifest,transport({network:async()=>{throw Error('timeout secret');}})),'RPC_UNAVAILABLE'],
 ];
 for(const [chain,code]of cases)await assert.rejects(()=>chain.snapshot(),(e:unknown)=>e instanceof ServiceError&&e.code===code);
 const base=transport();
 await assert.rejects(()=>new StellarChain(manifest,transport({read:async(id,m,a)=>m==='get_reserves'?{value:[-1n,2n],ledger:123}:base.read(id,m,a)})).snapshot(),/Invalid on-chain amount/);
});
test('does not reuse reserve state; caches only discovery and metadata',async()=>{
 const base=transport();let reads=0;let discovers=0;
 const chain=new StellarChain(manifest,transport({read:async(id,m,a)=>{if(m==='get_reserves')reads++;if(m==='all_pairs_length')discovers++;return base.read(id,m,a);}}));
 await chain.snapshot();await chain.snapshot();assert.equal(reads,2);assert.equal(discovers,1);
});
test('rejects snapshots across ledgers, old RPC state, router quote mismatch, paused aggregator',async()=>{
 const base=transport();
 await assert.rejects(()=>new StellarChain(manifest,transport({read:async(id,m,a)=>{const r=await base.read(id,m,a);return {...r,ledger:m==='get_reserves'?130:123};}})).snapshot(),/multiple ledgers/);
 await assert.rejects(()=>new StellarChain(manifest,transport({latest:async()=>({sequence:123,closeTime:'1'})})).snapshot(),/too old/);
 const q=quote(quoteRequest.parse({tokenIn:A,tokenOut:B,amount:'10000'}),snapshot());
 await assert.rejects(()=>new StellarChain(manifest,transport({read:async(id,m,a)=>m==='router_get_amounts_out'?{value:[1n,2n],ledger:123}:base.read(id,m,a)})).validateQuote(q),/differs/);
 await assert.rejects(()=>new StellarChain({...manifest,veltrixae:{aggregator,aggregatorWasmHash:hash}},transport({read:async(id,m,a)=>m==='get_adapters'?{value:[{protocol_id:0,router,paused:true}],ledger:123}:base.read(id,m,a)})).verifyDeployment(),/active matching/);
});
test('cache coalesces concurrent requests and never caches failures',async()=>{
 const cache=new Cache<number>(100);let calls=0;
 const load=async()=>{calls++;return 7;};assert.deepEqual(await Promise.all([cache.get(load),cache.get(load)]),[7,7]);assert.equal(calls,1);
 const failing=new Cache<number>(100);await assert.rejects(()=>failing.get(async()=>{throw Error('failure');}));assert.equal(await failing.get(load),7);
});
test('unsigned aggregator operation encodes enum, path, limits and deadline without keys',async()=>{
 const chain=new StellarChain({...manifest,veltrixae:{aggregator,aggregatorWasmHash:hash}},transport());
 const q=quote(quoteRequest.parse({tokenIn:A,tokenOut:B,amount:'10000'}),snapshot());
 const recipient=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,9));
 const op=chain.swapOperation(q,recipient);assert.ok(op.toXDR('base64').length>100);
 assert.throws(()=>chain.swapOperation({...q,expiresAt:0},recipient),/Refresh/);
 assert.throws(()=>chain.swapOperation(q,'private key'),/public account/);
});
test('simulation source is public and SDK encodes read calls',()=>{
 const t=new StellarTransport('https://soroban-testnet.stellar.org',1000);assert.ok(t);
 assert.equal(scValToNative(nativeToScVal(1,{type:'u32'})),1);
});

test('rejects malformed and future RPC ledger timestamps even for network status',async()=>{
 for(const closeTime of ['invalid',String(Math.floor(Date.now()/1000)+60)]) {
  await assert.rejects(()=>new StellarChain(manifest,transport({latest:async()=>({sequence:123,closeTime})})).status(),(e:unknown)=>e instanceof ServiceError&&e.code==='INVALID_CHAIN_DATA');
 }
});
test('manifest rejects ambiguous classic asset metadata and duplicate token contracts',()=>{
 const valid={contract:A,native:true};
 assert.ok(manifestSchema.safeParse({...manifest,assets:[valid]}).success);
 for(const assets of [[{contract:A,code:'USD'}],[{contract:A,native:true,code:'XLM'}],[valid,valid]]) {
  assert.equal(manifestSchema.safeParse({...manifest,assets}).success,false);
 }
});
test('prepares only fresh server-derived quotes against a verified aggregator',async()=>{
 let simulations=0;
 const publicKey=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,9));
 const req=quoteRequest.parse({tokenIn:A,tokenOut:B,amount:'10000'});
 const configured={...manifest,veltrixae:{aggregator,aggregatorWasmHash:hash}};
 const chain=new StellarChain(configured,transport({simulateSwap:async(key,op,deadline)=>{
  simulations++;assert.equal(key,publicKey);assert.ok(deadline>Date.now());assert.ok(op.toXDR().length>0);
  return {transactionXdr:'unsigned-fixture-not-a-live-transaction',resourceFee:'123',totalFee:'223',ledger:123};
 }}));
 const prepared=await chain.prepareSwap(req,publicKey);
 assert.equal(prepared.submitted,false);assert.equal(prepared.requiresWalletSignature,true);
 assert.equal(prepared.aggregator,aggregator);assert.equal(prepared.quote.amountIn,'10000');assert.equal(simulations,1);
 await assert.rejects(()=>new StellarChain(manifest,transport()).prepareSwap(req,publicKey),/verified VELTRIXAE/);
 await assert.rejects(()=>chain.prepareSwap(req,'not a public key'),/public account/);
 const mixed=new StellarChain(configured,transport({simulateSwap:async()=>({transactionXdr:'fixture',resourceFee:'1',totalFee:'101',ledger:124})}));
 await assert.rejects(()=>mixed.prepareSwap(req,publicKey),/different ledger/);
});

test('network status exposes stable fields instead of raw ledger and transaction metadata',async()=>{
 const chain=new StellarChain(manifest,transport({latest:async()=>({sequence:123,closeTime:String(Math.floor(Date.now()/1000)),metadataXdr:{unrelated:'large ledger data'}})}));
 assert.deepEqual(Object.keys(await chain.status()).sort(),['closeTime','network','sequence','soroswapConfigured','veltrixaeConfigured'].sort());
});

test('coalesces concurrent snapshots but refreshes reserves after they complete',async()=>{
 const base=transport();let reserves=0;
 const chain=new StellarChain(manifest,transport({read:async(id,m,a)=>{if(m==='get_reserves')reserves++;return base.read(id,m,a);}}));
 const values=await Promise.all([chain.snapshot(),chain.snapshot(),chain.snapshot()]);
 assert.equal(reserves,1);assert.deepEqual(values[0],values[1]);
 await chain.snapshot();assert.equal(reserves,2);
});
test('configurable discovery handles more than 100 pools in bounded batches and fails closed at cap',async()=>{
 const count=101;const base=transport();let pending=0,maxPending=0,indices:number[]=[];
 const custom=transport({read:async(id,m,a)=>{
  if(m==='all_pairs_length')return {value:count,ledger:123};
  if(m==='all_pairs') {
   const index=scValToNative(a![0]!);indices.push(index);pending++;maxPending=Math.max(maxPending,pending);
   await new Promise(resolve=>setTimeout(resolve,1));pending--;return {value:address(index+100),ledger:123};
  }
  if(m==='get_pair')return {value:scValToNative(a![1]!),ledger:123};
  if(m==='token_1')return {value:id,ledger:123};
  return base.read(id,m,a);
 }});
 const snapshot=await new StellarChain(manifest,custom,{maxPools:101,pageSize:3}).snapshot();
 assert.equal(snapshot.pools.length,101);assert.equal(snapshot.ledger,123);
 assert.equal(indices.length,101);assert.equal(new Set(indices).size,101);assert.ok(maxPending<=3);
 indices=[];
 await assert.rejects(()=>new StellarChain(manifest,custom,{maxPools:100}).snapshot(),/MAX_DISCOVERY_POOLS/);
 assert.equal(indices.length,0);
});
test('rejects forged registration, duplicate pools and discovery budget exhaustion',async()=>{
 const base=transport();
 await assert.rejects(()=>new StellarChain(manifest,transport({read:async(id,m,a)=>m==='get_pair'?{value:address(99),ledger:123}:base.read(id,m,a)})).snapshot(),/not registered/);
 await assert.rejects(()=>new StellarChain(manifest,transport({read:async(id,m,a)=>m==='all_pairs_length'?{value:2,ledger:123}:base.read(id,m,a)})).snapshot(),/duplicate pools/);
 const slow=transport({read:async(id,m,a)=>{if(m==='all_pairs_length')await new Promise(resolve=>setTimeout(resolve,110));return base.read(id,m,a);}});
 await assert.rejects(()=>new StellarChain(manifest,slow,{timeoutMs:100}).snapshot(),(e:unknown)=>e instanceof ServiceError&&e.code==='DISCOVERY_TIMEOUT');
});

test('read transport distinguishes archived-state restoration from ordinary invocation errors',async()=>{
 const t=new StellarTransport('https://soroban-testnet.stellar.org',1000);
 Object.assign(t,{server:{simulateTransaction:async()=>({transactionData:{},restorePreamble:{transactionData:{}}})}});
 await assert.rejects(()=>t.read(factory,'all_pairs_length'),(e:unknown)=>e instanceof ServiceError&&e.code==='RESTORATION_REQUIRED');
 Object.assign(t,{server:{simulateTransaction:async()=>({error:'private diagnostic not returned'})}});
 await assert.rejects(()=>t.read(factory,'all_pairs_length'),(e:unknown)=>e instanceof ServiceError&&e.code==='CONTRACT_INVOCATION_FAILED'&&!e.message.includes('private diagnostic'));
});

// Fixtures are mocks of the reviewed interfaces, never live liquidity.
const reqIn=quoteRequest.parse({tokenIn:A,tokenOut:B,amount:'10000'});
const publicKey=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,9));
const withAggregator={...manifest,veltrixae:{aggregator,aggregatorWasmHash:hash}};
function readsOn(base:Transport,ledger:(method:string,call:number)=>number):Transport['read']{
 let calls=0;
 return async(id,m,a)=>({...await base.read(id,m,a),ledger:ledger(m,calls++)});
}
test('pool identity reads may straddle a ledger close, but reserves across pools may not',async()=>{
 const base=transport();
 const identity=new StellarChain(manifest,transport({read:readsOn(base,m=>['token_0','token_1','factory','get_pair'].includes(m)?120:123)}));
 assert.equal((await identity.snapshot()).ledger,123);
 const other=address(40);let reserveCalls=0;
 const twoPools=transport({read:async(id,m,a)=>{
  if(m==='all_pairs_length')return {value:2,ledger:123};
  if(m==='all_pairs')return {value:scValToNative(a![0]!)===0?pair:other,ledger:123};
  if(m==='get_pair')return {value:scValToNative(a![1]!)===B?pair:other,ledger:123};
  if(m==='token_1'&&id===other)return {value:address(41),ledger:123};
  if(m==='get_reserves')return {...await base.read(id,m,a),ledger:123+(reserveCalls++%2)};
  return base.read(id,m,a);
 }});
 await assert.rejects(()=>new StellarChain(manifest,twoPools).snapshot(),(e:unknown)=>e instanceof ServiceError&&e.code==='INCONSISTENT_STATE');
 assert.equal(reserveCalls,6,'bounded to three attempts');
});
test('an unverifiable latest ledger cannot stand in for fresh reserves',async()=>{
 const base=transport();
 const lagging=new StellarChain(manifest,transport({latest:async()=>({sequence:121,closeTime:String(Math.floor(Date.now()/1000))}),read:base.read}));
 await assert.rejects(()=>lagging.snapshot(),(e:unknown)=>e instanceof ServiceError&&e.code==='INCONSISTENT_STATE');
});
test('router parity requires fresh reserves and router on one ledger, retries boundedly, then fails closed',async()=>{
 const base=transport(),q=quote(reqIn,snapshot());
 let routerCalls=0;
 const skewed=transport({read:async(id,m,a)=>{const r=await base.read(id,m,a);if(m==='router_get_amounts_out'){routerCalls++;return {...r,ledger:124};}return r;}});
 await assert.rejects(()=>new StellarChain(manifest,skewed).validateQuote(q),(e:unknown)=>e instanceof ServiceError&&e.code==='INCONSISTENT_STATE');
 assert.equal(routerCalls,3);
 routerCalls=0;
 const recovers=transport({read:async(id,m,a)=>{const r=await base.read(id,m,a);if(m==='router_get_amounts_out')return {...r,ledger:routerCalls++===0?124:125};return {...r,ledger:125};}});
 await new StellarChain(manifest,recovers).validateQuote(q);
 assert.equal(routerCalls,2,'a later ledger is acceptable once everything shares it');
 const older=transport({read:async(id,m,a)=>({...await base.read(id,m,a),ledger:122})});
 await assert.rejects(()=>new StellarChain(manifest,older).validateQuote(q),(e:unknown)=>e instanceof ServiceError&&e.code==='INCONSISTENT_STATE');
});
test('parity separates a divergent router, moved reserves and foreign pools',async()=>{
 const base=transport(),q=quote(reqIn,snapshot());
 const code=(c:string)=>(e:unknown)=>e instanceof ServiceError&&e.code===c;
 // Router disagrees with local math on the same reserves: a real divergence.
 await assert.rejects(()=>new StellarChain(manifest,transport({read:async(id,m,a)=>m==='router_get_amounts_out'?{value:[10000n,19744n],ledger:123}:base.read(id,m,a)})).validateQuote(q),code('QUOTE_MISMATCH'));
 // Reserves moved: router and local agree with each other, not with the older quote.
 const moved=transport({read:async(id,m,a)=>{
  if(m==='get_reserves')return {value:[1000000n,3000000n],ledger:123};
  if(m==='router_get_amounts_out')return {value:[10000n,output(10000n,1000000n,3000000n)],ledger:123};
  return base.read(id,m,a);
 }});
 await assert.rejects(()=>new StellarChain(manifest,moved).validateQuote(q),code('STALE_STATE'));
 // A route through a pool the configured factory does not list is refused.
 const foreign={...q,selectedRoute:{...q.selectedRoute,pools:[address(77)]}};
 await assert.rejects(()=>new StellarChain(manifest,base).validateQuote(foreign),code('CONTRACT_MISMATCH'));
 await assert.rejects(()=>new StellarChain(manifest,base).validateQuote({...q,expiresAt:Date.now()-1}),code('STALE_STATE'));
});
test('exact-output parity uses router_get_amounts_in with the requested output',async()=>{
 const req=quoteRequest.parse({tokenIn:A,tokenOut:B,amount:'10000',kind:'exactOut'});
 const q=quote(req,snapshot()),base=transport();let seen:bigint|undefined;
 await new StellarChain(manifest,transport({read:async(id,m,a)=>{
  if(m==='router_get_amounts_out')throw new Error('wrong router method');
  if(m==='router_get_amounts_in'){seen=scValToNative(a![0]!);return {value:[BigInt(q.amountIn),10000n],ledger:123};}
  return base.read(id,m,a);
 }})).validateQuote(q);
 assert.equal(seen,10000n);
});
test('a network check that fails discards results that were read concurrently',async()=>{
 let reads=0;const base=transport();
 const chain=new StellarChain(manifest,transport({network:async()=>{await new Promise(r=>setTimeout(r,5));return {passphrase:Networks.PUBLIC};},read:async(id,m,a)=>{reads++;return base.read(id,m,a);}}));
 await assert.rejects(()=>chain.snapshot(),(e:unknown)=>e instanceof ServiceError&&e.code==='WRONG_NETWORK');
 assert.ok(reads>0,'fixture must exercise the concurrent path');
});
test('execution gates: nothing is simulated unless network, code, liquidity, adapter and parity all pass',async()=>{
 const base=transport();let simulated=0;
 const simulateSwap:Transport['simulateSwap']=async()=>{simulated++;return {transactionXdr:'fixture',resourceFee:'1',totalFee:'2',ledger:123};};
 const gated:[string,Manifest,Partial<Transport>][]=[
  ['NOT_CONFIGURED',manifest,{}],
  ['NOT_CONFIGURED',{...withAggregator,soroswap:null},{}],
  ['WRONG_NETWORK',withAggregator,{network:async()=>({passphrase:Networks.PUBLIC})}],
  ['CONTRACT_MISMATCH',withAggregator,{wasm:async()=>Buffer.from('changed')}],
  ['CONTRACT_MISMATCH',withAggregator,{read:async(id,m,a)=>m==='get_adapters'?{value:[{protocol_id:0,router,paused:true}],ledger:123}:base.read(id,m,a)}],
  ['NO_LIQUIDITY',withAggregator,{read:async(id,m,a)=>m==='all_pairs_length'?{value:0,ledger:123}:base.read(id,m,a)}],
  ['NO_LIQUIDITY',withAggregator,{read:async(id,m,a)=>m==='get_reserves'?{value:[0n,0n],ledger:123}:base.read(id,m,a)}],
  ['QUOTE_MISMATCH',withAggregator,{read:async(id,m,a)=>m==='router_get_amounts_out'?{value:[10000n,1n],ledger:123}:base.read(id,m,a)}],
 ];
 for(const [code,m,overrides] of gated){
  await assert.rejects(()=>new StellarChain(m,transport({simulateSwap,...overrides})).prepareSwap(reqIn,publicKey),(e:unknown)=>e instanceof ServiceError&&e.code===code,code);
 }
 assert.equal(simulated,0);
});
test('prepared swaps come from a real assembly path: unsigned, Testnet, bounded by the quote deadline',async()=>{
 const expiresAt=Date.now()+15000;
 const t=new StellarTransport('https://soroban-testnet.stellar.org',1000);
 let simulatedTx:{signatures:unknown[]}|undefined;
 Object.assign(t,{server:{
  getAccount:async(key:string)=>new Account(key,'41'),
  simulateTransaction:async(tx:{signatures:unknown[]})=>{simulatedTx=tx;return {id:'1',latestLedger:123,events:[],minResourceFee:'1000',transactionData:new SorobanDataBuilder().setResourceFee(1000),result:{auth:[],retval:xdr.ScVal.scvVoid()},_parsed:true};},
 }});
 const chain=new StellarChain(withAggregator,transport());
 const op=chain.swapOperation(quote(reqIn,snapshot()),publicKey);
 const prepared=await t.simulateSwap(publicKey,op,expiresAt);
 const tx=TransactionBuilder.fromXDR(prepared.transactionXdr,Networks.TESTNET) as Transaction;
 assert.equal(tx.signatures.length,0);assert.equal(simulatedTx?.signatures.length,0);
 assert.equal(tx.source,publicKey);assert.equal(tx.sequence,'42');assert.equal(tx.networkPassphrase,Networks.TESTNET);
 assert.equal(tx.timeBounds?.maxTime,String(Math.floor(expiresAt/1000)));
 assert.equal(tx.operations.length,1);assert.equal(tx.operations[0]?.type,'invokeHostFunction');
 assert.ok(BigInt(prepared.totalFee)>=1000n);
});
test('swap operation pays only the wallet account and carries slippage limits and deadline',()=>{
 const chain=new StellarChain(withAggregator,transport());
 for(const kind of ['exactIn','exactOut'] as const){
  const q=quote(quoteRequest.parse({tokenIn:A,tokenOut:B,amount:'10000',kind,slippageBps:100}),snapshot());
  const op=Operation.fromXDRObject(chain.swapOperation(q,publicKey)) as Operation.InvokeHostFunction;
  const call=(op.func as unknown as {invokeContract:{contractAddress:xdr.ScAddress;functionName:{toString():string};args:xdr.ScVal[]}}).invokeContract;
  assert.equal(call.functionName.toString(),kind==='exactIn'?'swap_exact_tokens_for_tokens':'swap_tokens_for_exact_tokens');
  assert.equal(Address.fromScAddress(call.contractAddress).toString(),aggregator);
  const args=call.args.map(v=>scValToNative(v));
  assert.equal(args[2],BigInt(kind==='exactIn'?q.amountIn:q.amountOut));
  assert.equal(args[3],BigInt(kind==='exactIn'?q.minimumReceived:q.maximumInput));
  assert.equal(args[5],publicKey);assert.equal(args[6],BigInt(Math.floor(q.expiresAt/1000)));
  assert.equal(op.auth?.length,0,'authorization stays with the wallet flow');
 }
});
test('readiness reports observed gates truthfully and never claims more than was checked',async()=>{
 const base=transport();
 const empty=transport({read:async(id,m,a)=>m==='all_pairs_length'?{value:0,ledger:123}:base.read(id,m,a)});
 const r=await new StellarChain(manifest,empty).readiness();
 assert.equal(r.mainnetEnabled,false);assert.equal(r.submitsTransactions,false);assert.equal(r.custody,'none');
 assert.deepEqual(r.deployment,{status:'verified',code:null});assert.equal(r.liquidity.status,'empty');assert.equal(r.liquidity.pools,0);
 assert.equal(r.quotesAvailable,false);assert.equal(r.swapPreparationAvailable,false);assert.deepEqual(r.blockers,['NO_POOLS','AGGREGATOR_NOT_DEPLOYED']);
 const unfunded=await new StellarChain(manifest,transport({read:async(id,m,a)=>m==='get_reserves'?{value:[0n,5n],ledger:123}:base.read(id,m,a)})).readiness();
 assert.equal(unfunded.liquidity.status,'unfunded');assert.ok(unfunded.blockers.includes('NO_FUNDED_POOLS'));assert.equal(unfunded.quotesAvailable,false);
 const funded=await new StellarChain(manifest,transport()).readiness();
 assert.equal(funded.quotesAvailable,true);assert.equal(funded.swapPreparationAvailable,false);assert.deepEqual(funded.blockers,['AGGREGATOR_NOT_DEPLOYED']);
 const ready=await new StellarChain(withAggregator,transport()).readiness();
 assert.equal(ready.swapPreparationAvailable,true);assert.deepEqual(ready.blockers,[]);assert.equal(ready.aggregator.status,'verified');
 const wrongCode=await new StellarChain(manifest,transport({wasm:async()=>Buffer.from('changed')})).readiness();
 assert.deepEqual(wrongCode.deployment,{status:'failed',code:'CONTRACT_MISMATCH'});assert.deepEqual(wrongCode.blockers,['AMM_UNVERIFIED','AGGREGATOR_NOT_DEPLOYED']);assert.equal(wrongCode.liquidity.status,'unknown');
 const wrongNet=await new StellarChain(manifest,transport({network:async()=>({passphrase:Networks.PUBLIC})})).readiness();
 assert.equal(wrongNet.networkVerified,false);assert.ok(wrongNet.blockers.includes('NETWORK_UNVERIFIED'));assert.equal(wrongNet.quotesAvailable,false);
 const unconfigured=await new StellarChain({...manifest,soroswap:null},transport()).readiness();
 assert.equal(unconfigured.deployment.status,'not-configured');assert.ok(unconfigured.blockers.includes('AMM_NOT_CONFIGURED'));
 // A slow or skewed read leaves liquidity unknown; it must never be reported as empty.
 const skew=await new StellarChain(manifest,transport({latest:async()=>({sequence:1,closeTime:String(Math.floor(Date.now()/1000))})})).readiness();
 assert.equal(skew.liquidity.status,'unknown');assert.equal(skew.liquidity.code,'INCONSISTENT_STATE');assert.equal(skew.quotesAvailable,false);
});
test('batched code verification hashes real bytes, links instance to code and fails closed',async()=>{
 // Hand-built to the XDR shape observed from live getLedgerEntries; collect-evidence exercises the real path.
 const code=Buffer.from('reviewed test fixture, not deployed code'),digest=createHash('sha256').update(code).digest();
 const codeEntry=(bytes=code,declared=digest,live=500)=>({liveUntilLedgerSeq:live,val:{type:'contractCode',contractCode:{hash:{value:declared},code:bytes}}});
 const instance=(contract:string,wasmHash:Uint8Array=digest,live=500,type='contractExecutableWasm')=>({liveUntilLedgerSeq:live,val:{type:'contractData',contractData:{contract:new Address(contract).toScAddress(),val:{instance:{executable:{type,wasmHash:{value:wasmHash}}}}}}});
 const withEntries=(entries:unknown[])=>{
  const t=new StellarTransport('https://soroban-testnet.stellar.org',1000);
  const calls:number[]=[];
  Object.assign(t,{server:{getLedgerEntries:async(...keys:unknown[])=>{calls.push(keys.length);return {entries,latestLedger:100};}}});
  return {t,calls};
 };
 const hex=digest.toString('hex');
 const good=withEntries([codeEntry(),instance(factory),instance(router)]);
 assert.deepEqual([...(await good.t.codeHashes([factory,router],[hex])).entries()],[[factory,hex],[router,hex]]);
 assert.deepEqual(good.calls,[3],'one RPC call for every contract');
 const fails=async(entries:unknown[],code:string)=>assert.rejects(()=>withEntries(entries).t.codeHashes([factory],[hex]),(e:unknown)=>e instanceof ServiceError&&e.code===code,code);
 await fails([codeEntry(Buffer.from('tampered')),instance(factory)],'CONTRACT_MISMATCH');
 await fails([instance(factory)],'CONTRACT_NOT_FOUND');
 await fails([codeEntry()],'CONTRACT_NOT_FOUND');
 await fails([codeEntry(code,digest,99),instance(factory)],'RESTORATION_REQUIRED');
 await fails([codeEntry(),instance(factory,digest,99)],'RESTORATION_REQUIRED');
 await fails([codeEntry(),instance(factory,digest,500,'contractExecutableStellarAsset')],'CONTRACT_MISMATCH');
 await fails([{val:{type:'account'}}],'INVALID_CHAIN_DATA');
 // A different deployed hash reaches the chain, which rejects it against the manifest.
 const other=Buffer.alloc(32,7);
 const changed=withEntries([codeEntry(),instance(factory,other),instance(router)]);
 const chain=new StellarChain(manifest,transport({codeHashes:(ids,expected)=>changed.t.codeHashes(ids,expected)}));
 await assert.rejects(()=>chain.verifyDeployment(),(e:unknown)=>e instanceof ServiceError&&e.code==='CONTRACT_MISMATCH');
});
test('large contract sets are split at the RPC ledger-entry limit',async()=>{
 const t=new StellarTransport('https://soroban-testnet.stellar.org',1000);const calls:number[]=[];
 const ids=Array.from({length:250},(_,i)=>StrKey.encodeContract(Buffer.alloc(32,i%200+1).fill(i>>8,0,1)));
 Object.assign(t,{server:{getLedgerEntries:async(...keys:unknown[])=>{calls.push(keys.length);return {entries:[],latestLedger:100};}}});
 await assert.rejects(()=>t.codeHashes(ids,['a'.repeat(64)]),/missing or archived/);
 assert.deepEqual(calls,[200,51]);
});
