import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Account,Address,Keypair,Networks,Operation,SorobanDataBuilder,StrKey,TransactionBuilder,nativeToScVal,rpc,xdr} from '@stellar/stellar-sdk';
import {StellarChain,type Transport} from '../../../api/src/chain.js';
import {quote} from '../../../api/src/routing.js';
import {manifestSchema,quoteRequest} from '../../../api/src/domain.js';
import {PreparedSwapRejected,verifyPreparedSwap,type ExpectedSwap} from '../src/verify.js';
// Mock fixtures: addresses and amounts are not live values. Keypairs here exist only to produce test signatures.
const contract=(n:number)=>StrKey.encodeContract(Buffer.alloc(32,n));
const account=(n:number)=>StrKey.encodeEd25519PublicKey(Buffer.alloc(32,n));
const aggregator=contract(12),tokenIn=contract(1),tokenOut=contract(2),via=contract(3),other=contract(99);
const publicKey=account(9),stranger=account(8);
const nowSeconds=Math.floor(Date.now()/1000),deadline=nowSeconds+15;
const expected=(overrides:Partial<ExpectedSwap>={}):ExpectedSwap=>({publicKey,aggregator,tokenIn,tokenOut,kind:'exactIn',amount:'10000',limit:'19000',latestDeadline:deadline,maxFeeStroops:'100000000',...overrides});
interface Fields{source:string;target:string;fn:string;input:string;output:string;amount:bigint;limit:bigint;recipient:string;deadline:bigint;path:string[];protocol:number;parts:number;count:number;maxTime:number;fee:string;auth:xdr.SorobanAuthorizationEntry[];opSource?:string;}
const defaults=():Fields=>({source:publicKey,target:aggregator,fn:'swap_exact_tokens_for_tokens',input:tokenIn,output:tokenOut,amount:10000n,limit:19000n,recipient:publicKey,deadline:BigInt(deadline),path:[tokenIn,tokenOut],protocol:0,parts:1,count:1,maxTime:deadline,fee:'1000',auth:[]});
const distribution=(f:Fields)=>{
 const entry=xdr.ScVal.scvMap([
  ['bytes',xdr.ScVal.scvVoid()],['parts',nativeToScVal(f.parts,{type:'u32'})],['path',nativeToScVal(f.path.map(p=>new Address(p).toScVal()))],['protocol_id',nativeToScVal(f.protocol,{type:'u32'})],
 ].map(([key,val])=>new xdr.ScMapEntry({key:xdr.ScVal.scvSymbol(key as string),val:val as xdr.ScVal})));
 return xdr.ScVal.scvVec(Array(f.count).fill(entry));
};
const authEntry=(target:string,fn:string,credentials:xdr.SorobanCredentials=xdr.SorobanCredentials.sorobanCredentialsSourceAccount())=>new xdr.SorobanAuthorizationEntry({credentials,rootInvocation:new xdr.SorobanAuthorizedInvocation({function:xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(new xdr.InvokeContractArgs({contractAddress:new Address(target).toScAddress(),functionName:fn,args:[]})),subInvocations:[]})});
function build(overrides:Partial<Fields>={},ops=1){
 const f={...defaults(),...overrides};
 const op=Operation.invokeContractFunction({contract:f.target,function:f.fn,args:[new Address(f.input).toScVal(),new Address(f.output).toScVal(),nativeToScVal(f.amount,{type:'i128'}),nativeToScVal(f.limit,{type:'i128'}),distribution(f),new Address(f.recipient).toScVal(),nativeToScVal(f.deadline,{type:'u64'})],auth:f.auth,...(f.opSource?{source:f.opSource}:{})});
 const builder=new TransactionBuilder(new Account(f.source,'41'),{fee:f.fee,networkPassphrase:Networks.TESTNET});
 for(let i=0;i<ops;i++)builder.addOperation(op);
 return builder.setTimebounds(0,f.maxTime).build();
}
const rejects=(xdrText:string,code:string,overrides:Partial<ExpectedSwap>={})=>assert.throws(()=>verifyPreparedSwap(xdrText,expected(overrides)),(e:unknown)=>e instanceof PreparedSwapRejected&&e.code===code,code);

test('accepts what was asked for, including the source-account authorization a simulation returns',()=>{
 verifyPreparedSwap(build().toXDR(),expected());
 verifyPreparedSwap(build({auth:[authEntry(aggregator,'swap_exact_tokens_for_tokens')]}).toXDR(),expected());
 verifyPreparedSwap(build({path:[tokenIn,via,tokenOut]}).toXDR(),expected());
 verifyPreparedSwap(build({limit:19500n}).toXDR(),expected(),Date.now());
 verifyPreparedSwap(build({fn:'swap_tokens_for_exact_tokens',limit:11000n}).toXDR(),expected({kind:'exactOut',limit:'11000'}));
 verifyPreparedSwap(build({fn:'swap_tokens_for_exact_tokens',limit:10500n}).toXDR(),expected({kind:'exactOut',limit:'11000'}));
});
test('each altered field gets its own rejection',()=>{
 const cases:[Partial<Fields>,string][]=[
  [{source:stranger},'WRONG_SOURCE'],[{target:other},'WRONG_CONTRACT'],[{fn:'set_admin'},'WRONG_FUNCTION'],[{fn:'swap_tokens_for_exact_tokens'},'WRONG_FUNCTION'],
  [{input:other,path:[other,tokenOut]},'WRONG_TOKEN_IN'],[{output:other,path:[tokenIn,other]},'WRONG_TOKEN_OUT'],[{amount:10001n},'WRONG_AMOUNT'],[{limit:18999n},'WEAK_LIMIT'],[{limit:1n},'WEAK_LIMIT'],
  [{recipient:stranger},'WRONG_RECIPIENT'],[{count:2},'WRONG_ROUTE'],[{protocol:1},'WRONG_ROUTE'],[{parts:2},'WRONG_ROUTE'],[{path:[other,tokenOut]},'WRONG_ROUTE'],[{path:[tokenIn,other]},'WRONG_ROUTE'],[{path:[tokenIn,via,tokenIn,tokenOut]},'WRONG_ROUTE'],
  [{deadline:BigInt(deadline+1)},'LATE_DEADLINE'],[{deadline:BigInt(nowSeconds-1)},'EXPIRED'],[{maxTime:deadline+1},'LATE_TIME_BOUND'],[{maxTime:0},'NO_TIME_BOUND'],[{fee:'100000001'},'FEE_TOO_HIGH'],[{opSource:stranger},'WRONG_OPERATION_SOURCE'],
  [{auth:[authEntry(other,'swap_exact_tokens_for_tokens')]},'UNEXPECTED_AUTH'],[{auth:[authEntry(aggregator,'set_admin')]},'UNEXPECTED_AUTH'],
 ];
 for(const [fields,code] of cases)rejects(build(fields).toXDR(),code);
 rejects(build({fn:'swap_tokens_for_exact_tokens',limit:11001n}).toXDR(),'WEAK_LIMIT',{kind:'exactOut',limit:'11000'});
 rejects(build({},2).toXDR(),'WRONG_OPERATION_COUNT');
 const addressCredentials=xdr.SorobanCredentials.sorobanCredentialsAddress(new xdr.SorobanAddressCredentials({address:new Address(stranger).toScAddress(),nonce:xdr.Int64.fromString('1'),signatureExpirationLedger:1,signature:xdr.ScVal.scvVoid()}));
 rejects(build({auth:[authEntry(aggregator,'swap_exact_tokens_for_tokens',addressCredentials)]}).toXDR(),'UNEXPECTED_AUTH');
});
test('refuses signed, fee-bump, non-contract, and undecodable transactions',()=>{
 const signer=Keypair.random();
 const signed=build({source:signer.publicKey(),recipient:signer.publicKey()});signed.sign(signer);
 rejects(signed.toXDR(),'ALREADY_SIGNED',{publicKey:signer.publicKey()});
 const inner=build({source:signer.publicKey()});inner.sign(signer);
 rejects(TransactionBuilder.buildFeeBumpTransaction(signer,'2000',inner,Networks.TESTNET).toXDR(),'FEE_BUMP');
 const payment=new TransactionBuilder(new Account(publicKey,'41'),{fee:'100',networkPassphrase:Networks.TESTNET}).addOperation(Operation.bumpSequence({bumpTo:'50'})).setTimebounds(0,deadline).build();
 rejects(payment.toXDR(),'WRONG_OPERATION');
 rejects('not base64 xdr','INVALID_XDR');
});
test('accepts the real unsigned output of the backend encoder and assembly path',()=>{
 const hash='a'.repeat(64);
 const manifest=manifestSchema.parse({network:'testnet',soroswap:{factory:contract(10),router:contract(11),factoryWasmHash:hash,routerWasmHash:hash,pairWasmHash:hash},veltrixae:{aggregator,aggregatorWasmHash:hash},assets:[]});
 const chain=new StellarChain(manifest,{} as Transport);
 const now=Date.now();
 const pool={id:contract(4),protocol:'Soroswap' as const,token0:tokenIn,token1:tokenOut,reserve0:'1000000',reserve1:'2000000',feeBps:30 as const,ledger:123,observedAt:now};
 for(const kind of ['exactIn','exactOut'] as const){
  const estimate=quote(quoteRequest.parse({tokenIn,tokenOut,amount:'10000',kind,slippageBps:100}),{pools:[pool],ledger:123,observedAt:now},now);
  const seconds=Math.floor(estimate.expiresAt/1000);
  const raw=new TransactionBuilder(new Account(publicKey,'41'),{fee:'100',networkPassphrase:Networks.TESTNET}).addOperation(chain.swapOperation(estimate,publicKey)).setTimebounds(0,seconds).build();
  const fn=kind==='exactIn'?'swap_exact_tokens_for_tokens':'swap_tokens_for_exact_tokens';
  const assembled=rpc.assembleTransaction(raw,{id:'1',latestLedger:123,events:[],minResourceFee:'1000',transactionData:new SorobanDataBuilder().setResourceFee(1000),result:{auth:[authEntry(aggregator,fn)],retval:xdr.ScVal.scvVoid()},_parsed:true} as unknown as rpc.Api.SimulateTransactionSuccessResponse).build();
  const limit=kind==='exactIn'?estimate.minimumReceived:estimate.maximumInput,amount=kind==='exactIn'?estimate.amountIn:estimate.amountOut;
  const ask={publicKey,aggregator,tokenIn,tokenOut,kind,amount,limit,latestDeadline:seconds,maxFeeStroops:'100000'};
  verifyPreparedSwap(assembled.toXDR(),ask,now);
  assert.throws(()=>verifyPreparedSwap(assembled.toXDR(),{...ask,aggregator:other},now),PreparedSwapRejected);
 }
});
