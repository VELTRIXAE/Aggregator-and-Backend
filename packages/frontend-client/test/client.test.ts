import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {VeltrixaeClient,ApiError} from '../src/index.js';

test('client encodes quote requests and polls until chain finalization',async()=>{
 let polls=0;
 const server=createServer(async(req,res)=>{
  res.setHeader('content-type','application/json');
  if(req.url?.startsWith('/api/v1/transactions/'))return res.end(JSON.stringify({finalized:++polls===2,status:polls===2?'SUCCESS':'NOT_FOUND'}));
  if(req.url==='/api/v1/readiness')return res.end(JSON.stringify({mainnetEnabled:false,blockers:['NO_POOLS']}));
  if(req.url==='/api/v1/quotes'){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const body=JSON.parse(Buffer.concat(chunks).toString());
   assert.equal(body.amount,'9007199254740993');
   return res.end(JSON.stringify({amountIn:body.amount}));
  }
  res.statusCode=503;res.end(JSON.stringify({error:{code:'NOT_CONFIGURED',message:'No reviewed deployment'}}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address() as {port:number};
 const client=new VeltrixaeClient(`http://127.0.0.1:${address.port}`);
 try{
  assert.deepEqual((await client.readiness()).blockers,['NO_POOLS']);
  assert.equal((await client.quote({tokenIn:'fixture',tokenOut:'fixture2',amount:'9007199254740993'})).amountIn,'9007199254740993');
  assert.equal((await client.monitorTransaction('a'.repeat(64),{maxAttempts:3,intervalMs:100})).status,'SUCCESS');
  assert.equal(polls,2);
  await assert.rejects(()=>client.tokens(),(e:unknown)=>e instanceof ApiError&&e.code==='NOT_CONFIGURED'&&e.status===503);
  await assert.rejects(()=>client.monitorTransaction('hash',{intervalMs:NaN}),/Invalid monitoring/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(()=>client.monitorTransaction('hash',{signal:controller.signal}));
 }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
