import { test } from 'node:test';
import assert from 'node:assert/strict';
import { input, output, quote } from '../src/routing.js';
import { MAX_I128, quoteRequest } from '../src/domain.js';
import { A,B,C,address,pool,snapshot } from './fixtures.js';
const req = (overrides={}) => quoteRequest.parse({tokenIn:A,tokenOut:B,amount:'10000',...overrides});
test('exact-input rounding follows pinned Soroswap library, including ceil fee',()=>{
  assert.equal(output(1001n,1000000n,2000000n),1992n);
  assert.equal(output(10000n,1000000n,2000000n),19743n);
});
test('exact-output matches upstream ceil division plus one',()=>{
  const out=10000n, rin=1000000n, rout=2000000n;
  const n=rin*out*1000n,d=(rout-out)*997n;
  assert.equal(input(out,rin,rout),(n+d-1n)/d+1n);
  assert.ok(output(input(out,rin,rout),rin,rout)>=out);
});
test('slippage floors minimum and ceils maximum in base units',()=>{
  const q=quote(req(),snapshot());
  assert.equal(q.minimumReceived,(BigInt(q.amountOut)*9950n/10000n).toString());
  const x=quote(req({kind:'exactOut',amount:'10001'}),snapshot());
  assert.equal(x.minimumReceived,'10001');
  assert.equal(x.maximumInput,((BigInt(x.amountIn)*10050n+9999n)/10000n).toString());
});
test('compares direct and multi-hop pools, avoids cycles, reverses reserves',()=>{
  const pools=[pool(),pool(address(5),A,C,'1000000','5000000'),pool(address(6),C,B,'1000000','2000000')];
  const q=quote(req(),snapshot(pools));
  assert.deepEqual(q.selectedRoute.path,[A,C,B]);
  assert.ok(q.routes.length>=2);
  assert.equal(quote(req({maxHops:1}),snapshot(pools)).selectedRoute.pools.length,1);
  assert.ok(BigInt(quote(req({tokenIn:B,tokenOut:A}),snapshot()).amountOut)>0n);
});
test('rejects stale snapshots, unavailable liquidity and contract arithmetic overflow',()=>{
  assert.throws(()=>quote(req(),{...snapshot(),observedAt:Date.now()-16000}),/too old/);
  assert.throws(()=>quote(req(),snapshot([])),/No supported route/);
  assert.throws(()=>output(MAX_I128,1000n,1000n));
  assert.throws(()=>input(100n,1000n,100n));
  assert.throws(()=>output(1n,1000000n,1n));
});
test('validates integer amounts, i128 bounds, checksums, and slippage',()=>{
  for (const amount of ['0','-1','1.5','1e7','01',(MAX_I128+1n).toString()]) assert.throws(()=>req({amount}));
  assert.throws(()=>req({tokenIn:'CINVALID'})); assert.throws(()=>req({tokenOut:A}));
  assert.throws(()=>req({slippageBps:5001})); assert.throws(()=>req({privateKey:'never'}));
});
test('large values beyond Number safe range remain precise',()=>{
  const q=quote(req({amount:'9007199254740993'}),snapshot([pool(address(4),A,B,'1000000000000000000','2000000000000000000')]));
  assert.equal(q.amountOut,output(9007199254740993n,10n**18n,2n*10n**18n).toString());
});
