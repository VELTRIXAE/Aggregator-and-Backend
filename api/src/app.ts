import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import { z, ZodError } from 'zod';
import { prepareRequest, quoteRequest, contractId, ServiceError, type Chain } from './domain.js';
import { quote } from './routing.js';
const jsonObject = {type:'object',additionalProperties:true};
const responses = {200:jsonObject,400:jsonObject,404:jsonObject,422:jsonObject,429:jsonObject,503:jsonObject,504:jsonObject};
const quoteJson = z.toJSONSchema(quoteRequest, {io:'input',target:'draft-7'});
// Zod refinements (checksums and distinct tokens) are applied again in handlers.
export async function buildApp(chain: Chain, origins: string[] = [], logging = false) {
  const app = Fastify({logger:logging ? {serializers:{req: (request: {method: string}) => ({method:request.method})}} : false,ajv:{customOptions:{removeAdditional:false,coerceTypes:false}},bodyLimit:16384,requestTimeout:25000,connectionTimeout:30000});
  await app.register(cors,{origin:origins,credentials:false,methods:['GET','POST']});
  await app.register(rateLimit,{max:60,timeWindow:'1 minute'});
  await app.register(swagger,{openapi:{info:{title:'VELTRIXAE Aggregator',version:'0.1.0',description:'Testnet discovery and indicative quotations. Amounts are integer strings in token base units.'}}});
  // Reserve and quote responses must never be reused by browsers or shared HTTP caches.
  app.addHook('onSend', async (_request, reply) => { reply.header('cache-control', 'no-store'); });
  let active = 0;
  async function bounded<T>(work: () => Promise<T>): Promise<T> {
    if (active >= 4) throw new ServiceError('SERVICE_BUSY','Too many blockchain requests; retry shortly');
    active++;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A timed-out job retains its slot until its bounded RPC calls finish.
    const task = Promise.resolve().then(work).finally(()=>{active--;});
    try { return await Promise.race([task,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new ServiceError('REQUEST_TIMEOUT','Blockchain request exceeded its time budget',504)),20000);})]); }
    finally { if(timer) clearTimeout(timer); }
  }
  app.setErrorHandler((error,request,reply) => {
    if (error instanceof ZodError || (error as FastifyError).validation) return reply.code(400).send({error:{code:'INVALID_REQUEST',message:'Request validation failed'}});
    if (error instanceof ServiceError) return reply.code(error.status).send({error:{code:error.code,message:error.message}});
    const statusCode = (error as FastifyError).statusCode;
    const status = typeof statusCode === 'number' && statusCode >=400 && statusCode<500 ? statusCode : 500;
    if (status === 500) request.log.error({code:'INTERNAL_ERROR',requestId:request.id},'Unexpected service error');
    return reply.code(status!).send({error:{code:status===429?'RATE_LIMITED':status===500?'INTERNAL_ERROR':'INVALID_REQUEST',message:status===500?'Unexpected service error':'Request rejected'}});
  });
  app.setNotFoundHandler((_request,reply) => reply.code(404).send({error:{code:'NOT_FOUND',message:'Endpoint not found'}}));
  app.get('/api/v1/health',{schema:{summary:'Process liveness; does not imply chain readiness',response:responses}},async()=>({status:'ok',service:'VELTRIXAE Aggregator',network:'testnet'}));
  app.get('/api/v1/network/status',{schema:{summary:'Live RPC network and latest ledger',response:responses}},async()=>bounded(()=>chain.status()));
  app.get('/api/v1/tokens',{schema:{summary:'On-chain metadata; no trust or issuer endorsement',response:responses}},async()=>({tokens:await bounded(()=>chain.tokens())}));
  app.get('/api/v1/pools',{schema:{summary:'Fresh verified factory pools and reserves',response:responses}},async()=>bounded(()=>chain.snapshot()));
  app.get('/api/v1/pools/:id',{schema:{params:{type:'object',required:['id'],properties:{id:{type:'string'}}},response:responses}},async request=>{
    const id = contractId.parse((request.params as {id:string}).id);
    const snapshot = await bounded(()=>chain.snapshot()), pool = snapshot.pools.find(p=>p.id===id);
    if (!pool) throw new ServiceError('POOL_NOT_FOUND','Pool is not in the configured factory',404);
    return {pool};
  });
  app.get('/api/v1/markets',{schema:{summary:'Current pool markets; no fabricated historical prices',response:responses}},async()=>{
    const snapshot = await bounded(()=>chain.snapshot());
    return {ledger:snapshot.ledger,observedAt:snapshot.observedAt,markets:snapshot.pools.map(p=>({pool:p.id,protocol:p.protocol,token0:p.token0,token1:p.token1,feeBps:p.feeBps,spotRatio:{numerator:p.reserve1,denominator:p.reserve0},ratioUnits:'token1 base units per token0 base unit'}))};
  });
  async function quotation(body: unknown) {
    const req = quoteRequest.parse(body);
    return bounded(async()=>{
      const result = quote(req,await chain.snapshot());
      await chain.validateQuote(result);
      return result;
    });
  }
  app.post('/api/v1/quotes',{schema:{summary:'Fresh exact input or output quote; selected route checked by router simulation',body:quoteJson,response:responses}},async request=>quotation(request.body));
  app.post('/api/v1/swaps/prepare', {schema:{summary:'Simulate a fresh swap and return unsigned wallet XDR; never submits', body:z.toJSONSchema(prepareRequest, {io:'input', target:'draft-7'}), response:responses}}, async request => {
    const body = prepareRequest.parse(request.body);
    return bounded(() => chain.prepareSwap(body.quote, body.publicKey));
  });
  const routeQuery = structuredClone(quoteJson);
  routeQuery.properties!.maxHops = {type:'string',pattern:'^[1-3]$'};
  routeQuery.properties!.slippageBps = {type:'string',pattern:'^[0-9]{1,4}$'};
  // GET query values are strings; Zod applies defaults and strict validation after decoding integers.
  app.get('/api/v1/routes',{schema:{summary:'Same quotation search as POST /quotes',querystring:routeQuery,response:responses}},async request=>{
    const q = request.query as Record<string,unknown>;
    return quotation({...q,...(q.maxHops===undefined?{}:{maxHops:Number(q.maxHops)}),...(q.slippageBps===undefined?{}:{slippageBps:Number(q.slippageBps)})});
  });
  app.get('/api/v1/transactions/:hash',{schema:{params:{type:'object',required:['hash'],properties:{hash:{type:'string',pattern:'^[a-fA-F0-9]{64}$'}}},response:responses}},async request=>bounded(()=>chain.transaction(z.string().regex(/^[a-fA-F0-9]{64}$/).parse((request.params as {hash:string}).hash).toLowerCase())));
  app.get('/api/v1/analytics/overview',{schema:{summary:'Current observable counts; historical metrics unavailable',response:responses}},async()=>{
    const s = await bounded(()=>chain.snapshot());
    return {network:'testnet',ledger:s.ledger,observedAt:s.observedAt,poolCount:s.pools.length,tokenCount:new Set(s.pools.flatMap(p=>[p.token0,p.token1])).size,protocols:[...new Set(s.pools.map(p=>p.protocol))],historicalVolume:null,tvlUsd:null,historyAvailable:false};
  });
  app.get('/api/v1/openapi.json',{schema:{hide:true}},async()=>app.swagger());
  return app;
}
