import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../src/app.js';
import {ServiceError} from '../src/domain.js';
import {A,B,fakeChain} from './fixtures.js';
test('all proposed read endpoints and OpenAPI are available',async()=>{
 const app=await buildApp(fakeChain());
 try {
  for(const path of ['health','tokens','pools','markets','network/status','analytics/overview','transactions/'+ 'a'.repeat(64)]) assert.equal((await app.inject('/api/v1/'+path)).statusCode,200,path);
  const doc=(await app.inject('/api/v1/openapi.json')).json();
  assert.equal(Object.keys(doc.paths).length,10);
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
