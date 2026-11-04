import {test} from 'node:test';
import assert from 'node:assert/strict';
import {input,output,quote} from '../src/routing.js';
import {MAX_I128,quoteRequest,ServiceError,type Pool} from '../src/domain.js';
import {A,B,C,address,pool,snapshot} from './fixtures.js';
// Deterministic, so a failure is reproducible from the printed seed and inputs. Change FUZZ_SEED to explore further.
const seed=BigInt(process.env.FUZZ_SEED??'20261104');
function random(start:bigint){
 let state=start;
 const next=(max:bigint)=>{state=(state*6364136223846793005n+1442695040888963407n)&((1n<<64n)-1n);return ((state>>11n)*(state|1n))%max;};
 return next;
}
const scales=[10n**3n,10n**6n,10n**9n,10n**12n,10n**15n,10n**18n,10n**24n,10n**30n];
const fee=(amount:bigint)=>(amount*3n+999n)/1000n;
const holds=(rin:bigint,rout:bigint,amountIn:bigint,amountOut:bigint)=>(rin+amountIn-fee(amountIn))*(rout-amountOut)>=rin*rout;
const skippable=(error:unknown)=>{if(error instanceof ServiceError)return true;throw error;};

test('exact input never pays out more than the pair invariant allows, and is monotonic',()=>{
 const next=random(seed);let checked=0;
 for(let i=0;i<20000;i++){
  const rin=1000n+next(scales[Number(next(8n))]!),rout=1000n+next(scales[Number(next(8n))]!),amount=10n+next(scales[Number(next(8n))]!);
  let got:bigint;
  try{got=output(amount,rin,rout);}catch(error){skippable(error);continue;}
  const context=`seed=${seed} i=${i} rin=${rin} rout=${rout} amount=${amount} out=${got}`;
  assert.ok(got>0n&&got<rout,context);
  assert.ok(holds(rin,rout,amount,got),context);
  // One more base unit of output must break the invariant, so the trader gets the exact floor rather than less.
  assert.ok(got+1n>=rout||!holds(rin,rout,amount,got+1n),context);
  try{assert.ok(output(amount+1n,rin,rout)>=got,context);}catch(error){skippable(error);}
  checked++;
 }
 assert.ok(checked>5000,`only ${checked} cases were representable`);
});
test('required input stays within bounds, and matches the deployed formula',()=>{
 const next=random(seed+1n);let checked=0;
 for(let i=0;i<20000;i++){
  const rin=1000n+next(scales[Number(next(6n))]!),rout=1000n+next(scales[Number(next(6n))]!),out=1n+next(rout-1n);
  let needed:bigint;
  try{needed=input(out,rin,rout);}catch(error){skippable(error);continue;}
  const n=rin*out*1000n,d=(rout-out)*997n;
  assert.equal(needed,(n+d-1n)/d+1n,`seed=${seed} i=${i} rin=${rin} rout=${rout} out=${out}`);
  assert.ok(needed>0n&&needed<=MAX_I128);
  checked++;
 }
 assert.ok(checked>5000,`only ${checked} cases were representable`);
});
test('every advertised route satisfies the invariant on every hop, with limits that hold',()=>{
 const next=random(seed+2n);let quotes=0;
 for(let i=0;i<1500;i++){
  const reserve=()=>(1000n+next(scales[Number(next(5n))]!)).toString();
  const pools:Pool[]=[pool(address(4),A,B,reserve(),reserve()),pool(address(5),A,C,reserve(),reserve()),pool(address(6),C,B,reserve(),reserve())];
  const kind=next(2n)===0n?'exactIn':'exactOut',amount=(10n+next(scales[Number(next(3n))]!)).toString(),slippageBps=Number(next(5001n));
  const byId=new Map(pools.map(p=>[p.id,p]));
  let result;
  try{result=quote(quoteRequest.parse({tokenIn:A,tokenOut:B,amount,kind,slippageBps}),snapshot(pools));}catch(error){skippable(error);continue;}
  quotes++;
  const context=`seed=${seed} i=${i} ${kind} amount=${amount} slippage=${slippageBps} pools=${pools.map(p=>p.reserve0+'/'+p.reserve1).join(',')}`;
  for(const route of result.routes){
   let hop=BigInt(route.amountIn);
   route.pools.forEach((id,index)=>{
    const p=byId.get(id)!,from=route.path[index]!;
    const [rin,rout]=from===p.token0?[BigInt(p.reserve0),BigInt(p.reserve1)]:[BigInt(p.reserve1),BigInt(p.reserve0)];
    const out=output(hop,rin,rout);
    assert.ok(holds(rin,rout,hop,out),context);
    hop=out;
   });
   // Walking forward from the quoted input must deliver at least what the route advertises.
   assert.ok(hop>=BigInt(route.amountOut),context);
  }
  assert.ok(BigInt(result.minimumReceived)<=BigInt(result.amountOut)&&BigInt(result.minimumReceived)>0n,context);
  assert.ok(BigInt(result.maximumInput)>=BigInt(result.amountIn),context);
  const best=result.routes.map(r=>BigInt(kind==='exactIn'?r.amountOut:r.amountIn));
  for(const value of best)assert.ok(kind==='exactIn'?value<=best[0]!:value>=best[0]!,context);
 }
 assert.ok(quotes>300,`only ${quotes} quotes were produced`);
});
test('inputs that would underfund the pair are found by the search and never quoted',()=>{
 const next=random(seed+3n);let found=0;
 for(let i=0;i<300000;i++){
  const rin=1000n+next(scales[Number(next(5n))]!),rout=1000n+next(scales[Number(next(5n))]!),out=10n+next(rout);
  if(out>=rout)continue;
  let needed:bigint;
  try{needed=input(out,rin,rout);}catch(error){skippable(error);continue;}
  let delivered=0n;
  try{delivered=output(needed,rin,rout);}catch(error){skippable(error);}
  if(delivered>=out)continue;
  found++;
  assert.equal(holds(rin,rout,needed,out),false,'output() must agree with the pair invariant');
  const pools=[pool(address(4),A,B,rin.toString(),rout.toString())];
  assert.throws(()=>quote(quoteRequest.parse({tokenIn:A,tokenOut:B,amount:out.toString(),kind:'exactOut'}),snapshot(pools)),/No supported route/,`seed=${seed} i=${i} rin=${rin} rout=${rout} out=${out}`);
 }
 // Without this, the test would pass by finding nothing.
 assert.ok(found>0,`seed=${seed} found no underfunded input; widen the search`);
});
