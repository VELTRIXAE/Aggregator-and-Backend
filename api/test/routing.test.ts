import { test } from 'node:test';
import assert from 'node:assert/strict';
import { input, output, quote, routeAmounts } from '../src/routing.js';
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

test('equal-price route selection is stable across factory enumeration order',()=>{
  const first=pool(address(7)),second=pool(address(8));
  const a=quote(req(),snapshot([second,first]));
  const b=quote(req(),snapshot([first,second]));
  assert.deepEqual(a.routes,b.routes);
});
test('quote expiry is rejected at the exact deadline',()=>{
  const s=snapshot();
  assert.throws(()=>quote(req(),s,s.observedAt+15000),/too old/);
});
test('indexed route search inspects only connected edges',async()=>{
  const {findRoutes}=await import('../src/routing.js');
  const disconnected=Array.from({length:100},(_,i)=>pool(address(i+20),address(200),address(201)));
  const stats={states:0,poolChecks:0};
  const routes=findRoutes(req(),[pool(),...disconnected],stats);
  assert.equal(routes.length,1);assert.equal(stats.poolChecks,1);assert.equal(stats.states,2);
});
test('exact input is monotonic and exact output funds the requested amount for a bounded integer grid',()=>{
  for(const reserve of [10000n,1000000n,9007199254740993n]) {
    let previous=0n;
    for(const n of [10n,100n,1000n]) {
      const got=output(n,reserve,reserve*2n);assert.ok(got>=previous);previous=got;
      assert.ok(output(input(n,reserve,reserve*2n),reserve,reserve*2n)>=n);
    }
  }
});
test('exact-output routes the pair would reject after fee rounding are never advertised',()=>{
  // Found by fuzzing the deployed formula: ceil(in*out*1000/((rout-out)*997))+1 underfunds these inputs by a few base units.
  for(const [rin,rout,out] of [[400142939n,225402188312938n,24865236663858n],[582552658119n,5921n,4683n]] as const){
    const required=input(out,rin,rout);
    const fee=(required*3n+999n)/1000n;
    assert.ok((rin+required-fee)*(rout-out)<rin*rout,'fixture must violate the constant-product check');
    assert.throws(()=>quote(req({kind:'exactOut',amount:out.toString()}),snapshot([pool(address(4),A,B,rin.toString(),rout.toString())])),/No supported route/);
  }
});
test('every advertised exact-output route satisfies the constant-product check on each hop',()=>{
  const pools=[pool(),pool(address(5),A,C,'777777777','333333333'),pool(address(6),C,B,'123456789','987654321')];
  for(const amount of ['10','999','1000','123457','1000000']) {
    const q=quote(req({kind:'exactOut',amount,maxHops:2}),snapshot(pools));
    for(const route of q.routes){
      assert.equal(route.amountOut,amount);
      const hops=routeAmounts('exactOut',BigInt(amount),route.path,route.pools.map(id=>pools.find(p=>p.id===id)!));
      assert.equal(hops[0]!.toString(),route.amountIn);
    }
  }
});
test('exact-output slippage ceiling and exact-input floor cannot round to an unusable limit',()=>{
  assert.throws(()=>quote(req({amount:'10',slippageBps:5000}),snapshot([pool(address(4),A,B,'1000000000','1')])),/No supported route/);
  const q=quote(req({amount:'10',slippageBps:0}),snapshot());
  assert.equal(q.minimumReceived,q.amountOut);assert.equal(q.maximumInput,q.amountIn);
});
test('amounts stay integer strings across decimals-independent base units near i128 limits',()=>{
  const reserve=(MAX_I128/1000n).toString();
  // 10^17 * 2*10^19 stays inside i128 and is well beyond Number.MAX_SAFE_INTEGER.
  const q=quote(req({amount:'100000000000000000'}),snapshot([pool(address(4),A,B,'10000000000000000000','20000000000000000000')]));
  assert.match(q.amountOut,/^[1-9][0-9]*$/);assert.equal(q.amountOut,output(10n**17n,10n**19n,2n*10n**19n).toString());assert.ok(q.selectedRoute.priceImpactBps>=0&&q.selectedRoute.priceImpactBps<=10000);
  assert.throws(()=>quote(req({amount:reserve}),snapshot([pool(address(4),A,B,reserve,reserve)])),/No supported route/);
});
