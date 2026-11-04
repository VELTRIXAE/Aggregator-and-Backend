import {Address,Networks,Operation,TransactionBuilder,scValToNative,type Transaction,type xdr} from '@stellar/stellar-sdk';

/** What the person asked for. Take these from your own request and the configured aggregator, never from the API response. */
export interface ExpectedSwap {
 publicKey:string;
 aggregator:string;
 tokenIn:string;
 tokenOut:string;
 kind:'exactIn'|'exactOut';
 /** Exact input or exact output, in base units. */
 amount:string;
 /** The least acceptable output for exactIn, or the most acceptable input for exactOut. */
 limit:string;
 /** Refuse a deadline later than this, in Unix seconds. */
 latestDeadline:number;
 /** Refuse a total network fee above this, in stroops. */
 maxFeeStroops:string;
}
export class PreparedSwapRejected extends Error{
 constructor(public code:string,message:string){super(message);this.name='PreparedSwapRejected';}
}
interface ContractCall{contractAddress:xdr.ScAddress;functionName:{toString():string};args:xdr.ScVal[]}
interface AuthEntry{credentials:{type?:unknown;address?:unknown};rootInvocation:{function:{type?:unknown;contractFn?:ContractCall}}}
const reject=(code:string,message:string):never=>{throw new PreparedSwapRejected(code,message);};
const fnName=(kind:ExpectedSwap['kind'])=>kind==='exactIn'?'swap_exact_tokens_for_tokens':'swap_tokens_for_exact_tokens';
const same=(actual:unknown,expected:string|bigint)=>String(actual)===String(expected);
const parts=(value:unknown)=>value as {protocol_id?:unknown;path?:unknown;parts?:unknown;bytes?:unknown};

/**
 * Checks unsigned XDR from POST /swaps/prepare before a wallet prompt, because the API is outside the wallet's trust boundary.
 * This helps a wallet flow and does not replace the person's review. Throws PreparedSwapRejected on any difference.
 * An envelope does not name its network, so also pass the Testnet passphrase to the wallet when signing.
 * Authorization sub-invocations are not inspected, because they have not yet been observed from a deployed aggregator.
 */
export function verifyPreparedSwap(transactionXdr:string,expected:ExpectedSwap,now=Date.now()):void{
 let decoded:ReturnType<typeof TransactionBuilder.fromXDR>;
 try{decoded=TransactionBuilder.fromXDR(transactionXdr,Networks.TESTNET);}
 catch{return reject('INVALID_XDR','Transaction cannot be decoded');}
 if('innerTransaction' in decoded)return reject('FEE_BUMP','Fee-bump transactions are not accepted');
 const tx=decoded as Transaction;
 if(tx.signatures.length!==0)reject('ALREADY_SIGNED','Transaction already carries a signature');
 if(tx.source!==expected.publicKey)reject('WRONG_SOURCE','Transaction source is not the connected account');
 if(BigInt(tx.fee)>BigInt(expected.maxFeeStroops))reject('FEE_TOO_HIGH','Network fee exceeds the accepted maximum');
 if(tx.operations.length!==1)reject('WRONG_OPERATION_COUNT','Expected exactly one operation');
 const op=tx.operations[0]! as Operation.InvokeHostFunction;
 if(op.type!=='invokeHostFunction')reject('WRONG_OPERATION','Expected a contract invocation');
 if(op.source!==undefined&&op.source!==expected.publicKey)reject('WRONG_OPERATION_SOURCE','Operation runs as another account');
 const call=(op.func as unknown as {invokeContract?:ContractCall}).invokeContract;
 if(!call)return reject('WRONG_OPERATION','Expected a contract invocation');
 if(Address.fromScAddress(call.contractAddress).toString()!==expected.aggregator)reject('WRONG_CONTRACT','Transaction calls a different contract');
 if(call.functionName.toString()!==fnName(expected.kind))reject('WRONG_FUNCTION','Transaction calls a different function');
 if(call.args.length!==7)reject('WRONG_ARGUMENTS','Unexpected argument count');
 const [tokenIn,tokenOut,amount,limit,distribution,recipient,deadline]=call.args.map(arg=>scValToNative(arg)) as [unknown,unknown,unknown,unknown,unknown,unknown,unknown];
 if(!same(tokenIn,expected.tokenIn))reject('WRONG_TOKEN_IN','Input token differs');
 if(!same(tokenOut,expected.tokenOut))reject('WRONG_TOKEN_OUT','Output token differs');
 if(!same(amount,expected.amount))reject('WRONG_AMOUNT','Amount differs');
 if(expected.kind==='exactIn'?BigInt(limit as bigint)<BigInt(expected.limit):BigInt(limit as bigint)>BigInt(expected.limit))reject('WEAK_LIMIT','Slippage limit is worse than accepted');
 if(!same(recipient,expected.publicKey))reject('WRONG_RECIPIENT','Proceeds go to another account');
 if(!Array.isArray(distribution)||distribution.length!==1)return reject('WRONG_ROUTE','Expected a single route');
 const route=parts(distribution[0]);
 if(Number(route.protocol_id)!==0||Number(route.parts)!==1||route.bytes!==undefined&&route.bytes!==null)reject('WRONG_ROUTE','Unexpected route settings');
 const path=route.path;
 if(!Array.isArray(path)||path.length<2||path.length>4||!same(path[0],expected.tokenIn)||!same(path.at(-1),expected.tokenOut)||new Set(path.map(String)).size!==path.length)reject('WRONG_ROUTE','Route does not connect the requested tokens');
 const deadlineSeconds=Number(deadline);
 if(!Number.isSafeInteger(deadlineSeconds)||deadlineSeconds>expected.latestDeadline)reject('LATE_DEADLINE','Deadline is later than accepted');
 if(deadlineSeconds*1000<=now)reject('EXPIRED','Deadline has passed');
 const maxTime=Number(tx.timeBounds?.maxTime??0);
 if(maxTime===0)reject('NO_TIME_BOUND','Transaction never expires');
 if(maxTime>expected.latestDeadline)reject('LATE_TIME_BOUND','Transaction stays valid later than accepted');
 // Only the wallet's own account may authorize, and only this exact root call. Anything else could spend under another scope.
 for(const entry of (op.auth??[]) as unknown as AuthEntry[]){
  const credentialType=String(entry.credentials?.type??'');
  if(credentialType!=='sorobanCredentialsSourceAccount')reject('UNEXPECTED_AUTH','Authorization entry is not the source account');
  const root=entry.rootInvocation?.function?.contractFn;
  if(!root||Address.fromScAddress(root.contractAddress).toString()!==expected.aggregator||root.functionName.toString()!==fnName(expected.kind))reject('UNEXPECTED_AUTH','Authorization covers a different call');
 }
}
