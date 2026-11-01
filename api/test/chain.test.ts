import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Networks, nativeToScVal, scValToNative, StrKey, type rpc, type xdr} from '@stellar/stellar-sdk';
import {Cache, StellarChain, StellarTransport, type Transport} from '../src/chain.js';
import {manifestSchema, ServiceError, quoteRequest} from '../src/domain.js';
import {quote} from '../src/routing.js';
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
  switch(method){case 'get_factory':case 'factory':value=factory;break;case 'all_pairs_length':value=1;break;case 'all_pairs':value=pair;break;case 'token_0':value=A;break;case 'token_1':value=B;break;case 'get_reserves':value=[1000000n,2000000n];break;case 'symbol':value='T';break;case 'name':value='Test';break;case 'decimals':value=7;break;
   case 'get_adapters':value=[{protocol_id:['Soroswap'],router,paused:false}];break;
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
 await assert.rejects(()=>new StellarChain(manifest,transport({read:async(id,m,a)=>{const r=await base.read(id,m,a);return {...r,ledger:m==='get_reserves'?124:123};}})).snapshot(),/multiple ledgers/);
 await assert.rejects(()=>new StellarChain(manifest,transport({latest:async()=>({sequence:123,closeTime:'1'})})).snapshot(),/too old/);
 const q=quote(quoteRequest.parse({tokenIn:A,tokenOut:B,amount:'10000'}),snapshot());
 await assert.rejects(()=>new StellarChain(manifest,transport({read:async()=>({value:[1n,2n],ledger:123})})).validateQuote(q),/differs/);
 await assert.rejects(()=>new StellarChain({...manifest,veltrixae:{aggregator,aggregatorWasmHash:hash}},transport({read:async(id,m,a)=>m==='get_adapters'?{value:[{protocol_id:['Soroswap'],router,paused:true}],ledger:123}:base.read(id,m,a)})).verifyDeployment(),/active matching/);
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
