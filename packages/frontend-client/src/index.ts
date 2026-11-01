/** All amounts are decimal integer strings in token base units. Times are Unix milliseconds. */
export interface QuoteRequest { tokenIn:string; tokenOut:string; amount:string; kind?:'exactIn'|'exactOut'; slippageBps?:number; maxHops?:number; }
export interface Token { contract:string; symbol:string; name:string; decimals:number; asset?:{code:string;issuer?:string}; verification:'onchain-metadata-only'; }
export interface Pool { id:string; protocol:'Soroswap'; token0:string; token1:string; reserve0:string; reserve1:string; feeBps:30; ledger:number; observedAt:number; }
export interface Snapshot { pools:Pool[]; ledger:number; observedAt:number; }
export interface Route {path:string[];pools:string[];protocol:'Soroswap';amountIn:string;amountOut:string;fees:{token:string;amount:string;feeBps:number}[];priceImpactBps:number;}
export interface Quote {network:'testnet';kind:'exactIn'|'exactOut';tokenIn:string;tokenOut:string;amountIn:string;amountOut:string;minimumReceived:string;maximumInput:string;slippageBps:number;routes:Route[];selectedRoute:Route;ledger:number;observedAt:number;expiresAt:number;executable:false;networkFee:null;}
export interface TransactionStatus {hash:string;network:'testnet';status:'SUCCESS'|'FAILED'|'NOT_FOUND';finalized:boolean;ledger:number|null;latestLedger:number;resultXdr:string|null;metadataXdr:string|null;failure:string|null;explorerUrl:string;note:string|null;}
export interface NetworkStatus {network:'testnet';sequence:number;closeTime:string;soroswapConfigured:boolean;veltrixaeConfigured:boolean;}
export interface Market {pool:string;protocol:'Soroswap';token0:string;token1:string;feeBps:number;spotRatio:{numerator:string;denominator:string};ratioUnits:string;}
export interface Overview {network:'testnet';ledger:number;observedAt:number;poolCount:number;tokenCount:number;protocols:string[];historicalVolume:null;tvlUsd:null;historyAvailable:false;}
export class ApiError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
export class VeltrixaeClient {
 constructor(private baseUrl:string,private timeoutMs=15000){}
 private async request<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
  const timeout=AbortSignal.timeout(this.timeoutMs);
  const response=await fetch(new URL('/api/v1/'+path,this.baseUrl),{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:signal?AbortSignal.any([timeout,signal]):timeout});
  const data=await response.json();
  if(!response.ok)throw new ApiError(response.status,data.error?.code??'API_ERROR',data.error?.message??'Request failed');
  return data as T;
 }
 health(signal?:AbortSignal){return this.request<{status:'ok';service:string;network:'testnet'}>('health',undefined,signal);}
 tokens(signal?:AbortSignal){return this.request<{tokens:Token[]}>('tokens',undefined,signal);}
 pools(signal?:AbortSignal){return this.request<Snapshot>('pools',undefined,signal);}
 pool(id:string,signal?:AbortSignal){return this.request<{pool:Pool}>('pools/'+encodeURIComponent(id),undefined,signal);}
 quote(request:QuoteRequest,signal?:AbortSignal){return this.request<Quote>('quotes',request,signal);}
 routes(request:QuoteRequest,signal?:AbortSignal){
  const params=new URLSearchParams(Object.entries(request).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)]));
  return this.request<Quote>('routes?'+params,undefined,signal);
 }
 markets(signal?:AbortSignal){return this.request<{ledger:number;observedAt:number;markets:Market[]}>('markets',undefined,signal);}
 transaction(hash:string,signal?:AbortSignal){return this.request<TransactionStatus>('transactions/'+encodeURIComponent(hash),undefined,signal);}
 network(signal?:AbortSignal){return this.request<NetworkStatus>('network/status',undefined,signal);}
 overview(signal?:AbortSignal){return this.request<Overview>('analytics/overview',undefined,signal);}
 async monitorTransaction(hash:string,options:{signal?:AbortSignal;intervalMs?:number;maxAttempts?:number}={}):Promise<TransactionStatus>{
  const max=options.maxAttempts??30,interval=options.intervalMs??2000;
  if(!Number.isInteger(max)||max<1||max>300||interval<100||interval>60000)throw new Error('Invalid monitoring limits');
  for(let attempt=0;attempt<max;attempt++){
   options.signal?.throwIfAborted();
   const state=await this.transaction(hash,options.signal);
   if(state.finalized||attempt===max-1)return state;
   await new Promise<void>((resolve,reject)=>{
    const signal=options.signal;
    const abort=()=>{clearTimeout(timer);reject(signal?.reason??new Error('Aborted'));};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},interval);
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
   });
  }
  throw new Error('Invalid monitoring limits');
 }
}
