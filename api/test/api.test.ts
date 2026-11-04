import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../src/app.js';
import {ServiceError} from '../src/domain.js';
import {StrKey} from '@stellar/stellar-sdk';
import {A,B,fakeChain} from './fixtures.js';
test('all proposed read endpoints and OpenAPI are available',async()=>{
 const app=await buildApp(fakeChain());
 try {
  for(const path of ['health','readiness','tokens','pools','markets','network/status','analytics/overview','transactions/'+ 'a'.repeat(64)]) assert.equal((await app.inject('/api/v1/'+path)).statusCode,200,path);
  const doc=(await app.inject('/api/v1/openapi.json')).json();
  assert.equal(Object.keys(doc.paths).length,12);
  assert.ok(doc.paths['/api/v1/quotes'].post.requestBody);
 }finally{await app.close();}
});
test('quotes and route search have matching responses and safe validation',async()=>{
 const app=await buildApp(fakeChain());
 try{
  const body={tokenIn:A,tokenOut:B,amount:'10000'};
  const res=await app.inject({method:'POST',url:'/api/v1/quotes',payload:body});
  assert.equal(res.statusCode,200,res.body); assert.equal(res.json().executable,false);
  const route=await app.inject({url:'/api/v1/routes',query:{...body,maxHops:'1'}});
  assert.equal(route.statusCode,200,route.body);assert.equal(route.json().amountOut,res.json().amountOut);
  assert.equal((await app.inject({method:'POST',url:'/api/v1/quotes',payload:{...body,amount:'-1'}})).statusCode,400);
  assert.equal((await app.inject('/api/v1/transactions/bad')).statusCode,400);
  assert.equal((await app.inject('/api/v1/pools/'+A)).statusCode,404);
 }finally{await app.close();}
});
test('distinguishes no liquidity from upstream failure; never leaks error details',async()=>{
 for(const [error,status,code] of [[new ServiceError('NO_LIQUIDITY','None',422),422,'NO_LIQUIDITY'],[new ServiceError('RPC_UNAVAILABLE','Unavailable'),503,'RPC_UNAVAILABLE'],[new Error('secret must not leak'),500,'INTERNAL_ERROR']] as const){
  const app=await buildApp(fakeChain({snapshot:async()=>{throw error;}}));
  try{const r=await app.inject('/api/v1/pools');assert.equal(r.statusCode,status);assert.equal(r.json().error.code,code);assert.ok(!r.body.includes('secret'));}finally{await app.close();}
 }
});
test('restricts CORS and rate limits traffic',async()=>{
 const app=await buildApp(fakeChain(),['https://frontend.example']);
 try{
  const good=await app.inject({url:'/api/v1/health',headers:{origin:'https://frontend.example'}});assert.equal(good.headers['access-control-allow-origin'],'https://frontend.example');
  const bad=await app.inject({url:'/api/v1/health',headers:{origin:'https://evil.example'}});assert.equal(bad.headers['access-control-allow-origin'],undefined);
  let limited=false;for(let i=0;i<65;i++){if((await app.inject('/api/v1/health')).statusCode===429)limited=true;}assert.ok(limited);
 }finally{await app.close();}
});

test('preparation rejects arbitrary XDR and secrets and never returns cacheable quotes',async()=>{
 const app=await buildApp(fakeChain());
 try{
  const body={tokenIn:A,tokenOut:B,amount:'10000'};
  const quote=await app.inject({method:'POST',url:'/api/v1/quotes',payload:body});
  assert.equal(quote.headers['cache-control'],'no-store');
  for(const payload of [{transactionXdr:'untrusted'},{quote:body,privateKey:'never'},{quote:body,publicKey:A}]) {
   assert.equal((await app.inject({method:'POST',url:'/api/v1/swaps/prepare',payload})).statusCode,400);
  }
 }finally{await app.close();}
});

test('unknown endpoints and malformed or oversized bodies use the standard error envelope',async()=>{
 const app=await buildApp(fakeChain());
 try {
  const missing=await app.inject('/api/v1/unknown');assert.equal(missing.statusCode,404);assert.equal(missing.json().error.code,'NOT_FOUND');
  for(const payload of ['{bad',JSON.stringify({padding:'x'.repeat(17000)})]) {
   const response=await app.inject({method:'POST',url:'/api/v1/quotes',headers:{'content-type':'application/json'},payload});
   assert.ok([400,413].includes(response.statusCode));assert.equal(response.json().error.code,'INVALID_REQUEST');
  }
 } finally {await app.close();}
});

test('an empty CORS allowlist grants no browser origin',async()=>{
 const app=await buildApp(fakeChain());
 try{
  const response=await app.inject({url:'/api/v1/health',headers:{origin:'https://frontend.example'}});
  assert.equal(response.headers['access-control-allow-origin'],undefined);
 }finally{await app.close();}
});
test('readiness exposes disabled mainnet and blockers, and swap preparation carries no signature',async()=>{
 const unsigned={transactionXdr:'unsigned-fixture',resourceFee:'1',totalFee:'2',ledger:123,network:'testnet',aggregator:A,requiresWalletSignature:true,submitted:false} as const;
 const app=await buildApp(fakeChain({prepareSwap:async()=>({...unsigned,quote:{} as never})}));
 try{
  const readiness=(await app.inject('/api/v1/readiness')).json();
  assert.equal(readiness.mainnetEnabled,false);assert.equal(readiness.submitsTransactions,false);assert.deepEqual(readiness.blockers,['NO_POOLS','AGGREGATOR_NOT_DEPLOYED']);
  const body=(await app.inject({method:'POST',url:'/api/v1/swaps/prepare',payload:{quote:{tokenIn:A,tokenOut:B,amount:'10000'},publicKey:StrKey.encodeEd25519PublicKey(Buffer.alloc(32,9))}})).json();
  assert.equal(body.requiresWalletSignature,true);assert.equal(body.submitted,false);
 }finally{await app.close();}
});
test('no route accepts signed transactions for submission',async()=>{
 const app=await buildApp(fakeChain());
 try{
  const paths=Object.keys((await app.inject('/api/v1/openapi.json')).json().paths);
  assert.equal(paths.some(p=>/submit|send|broadcast|sign/i.test(p)),false);
 }finally{await app.close();}
});

async function limitedAfter(app:Awaited<ReturnType<typeof buildApp>>,forwardedFor:string,remoteAddress:string){
 let last=0;
 for(let i=0;i<61;i++)last=(await app.inject({url:'/api/v1/health',remoteAddress,headers:{'x-forwarded-for':forwardedFor}})).statusCode;
 return last;
}
test('forged forwarded headers cannot evade rate limits by default',async()=>{
 const app=await buildApp(fakeChain());
 try{
  let last=0;
  for(let i=0;i<61;i++)last=(await app.inject({url:'/api/v1/health',remoteAddress:'203.0.113.9',headers:{'x-forwarded-for':'198.51.100.'+i}})).statusCode;
  assert.equal(last,429);
 }finally{await app.close();}
});
test('a listed proxy gives each client its own rate limit, and an unlisted one does not',async()=>{
 const app=await buildApp(fakeChain(),[],false,['10.0.0.1']);
 try{
  assert.equal(await limitedAfter(app,'198.51.100.1','10.0.0.1'),429);
  assert.equal((await app.inject({url:'/api/v1/health',remoteAddress:'10.0.0.1',headers:{'x-forwarded-for':'198.51.100.2'}})).statusCode,200);
  assert.equal(await limitedAfter(app,'198.51.100.3','203.0.113.5'),429);
  assert.equal((await app.inject({url:'/api/v1/health',remoteAddress:'203.0.113.5',headers:{'x-forwarded-for':'198.51.100.4'}})).statusCode,429);
 }finally{await app.close();}
});
