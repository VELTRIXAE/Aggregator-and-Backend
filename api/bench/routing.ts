// Synthetic offline graph workload; this is not live liquidity or an RPC latency benchmark.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {StrKey} from '@stellar/stellar-sdk';
import {findRoutes} from '../src/routing.js';
import {quoteRequest,type Pool} from '../src/domain.js';
const id=(n:number)=>StrKey.encodeContract(createHash('sha256').update(String(n)).digest());
const A=id(1),B=id(2),C=id(3),D=id(4),E=id(5);
const pool=(n:number,token0:string,token1:string):Pool=>({id:id(n+10),protocol:'Soroswap',token0,token1,reserve0:'1000000',reserve1:'2000000',feeBps:30,ledger:1,observedAt:0});
const pools=[pool(0,A,B),pool(1,A,C),pool(2,C,B),...Array.from({length:997},(_,i)=>pool(i+3,D,E))];
const req=quoteRequest.parse({tokenIn:A,tokenOut:B,amount:'10000'});
let flatPoolChecks=0;
function oldWalk(path:string[],used:Pool[]) {
 const last=path.at(-1)!;
 if(last===B||used.length>=req.maxHops)return;
 for(const p of pools){flatPoolChecks++;if(p.token0!==last&&p.token1!==last)continue;const next=p.token0===last?p.token1:p.token0;if(path.includes(next)||used.some(u=>u.id===p.id))continue;oldWalk([...path,next],[...used,p]);}
}
oldWalk([A],[]);
const stats={states:0,poolChecks:0};const routes=findRoutes(req,pools,stats);
assert.equal(routes.length,2);assert.equal(flatPoolChecks,2000);assert.equal(stats.poolChecks,4);
console.log(JSON.stringify({workload:'1000 synthetic pools, 997 disconnected, direct and two-hop routes',baselineFlatPoolChecks:flatPoolChecks,indexedPoolChecks:stats.poolChecks,indexBuildPoolVisits:pools.length,routeStates:stats.states,returnedRoutes:routes.length,note:'Operation counts only. Index construction is O(pools); no end-to-end latency claim.'},null,2));
