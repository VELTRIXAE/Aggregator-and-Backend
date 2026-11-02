import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RpcLimiter} from '../src/limits.js';
import {ServiceError} from '../src/domain.js';

test('global RPC limiter bounds simultaneous work and recovers slots after failure',async()=>{
 const limiter=new RpcLimiter(2);let active=0,max=0;
 await Promise.all(Array.from({length:20},(_,i)=>limiter.run(async()=>{
  active++;max=Math.max(max,active);
  try {await new Promise(resolve=>setTimeout(resolve,1));if(i===0)throw Error('fixture');}
  finally {active--;}
 }).catch(e=>{assert.equal(e.message,'fixture');})));
 assert.equal(max,2);assert.equal(active,0);assert.equal(await limiter.run(async()=>42),42);
});
test('full and expired queues fail without running abandoned RPC work',async()=>{
 const limiter=new RpcLimiter(1,1,10);
 let release!:()=>void;
 const running=limiter.run(()=>new Promise<void>(resolve=>{release=resolve;}));
 let abandoned=false;
 const waiting=limiter.run(async()=>{abandoned=true;});
 await assert.rejects(()=>limiter.run(async()=>1),(e:unknown)=>e instanceof ServiceError&&e.code==='SERVICE_BUSY');
 await assert.rejects(()=>waiting,(e:unknown)=>e instanceof ServiceError&&e.code==='RPC_TIMEOUT');
 release();await running;assert.equal(abandoned,false);
 assert.equal(await limiter.run(async()=>7),7);
});
