// Read-only cost and state check for docs/TESTNET_LIVE_PLAN.md. It only reads ledger state and simulates:
// no key is accepted and nothing is signed or submitted. Simulated transactions are discarded.
//
//   npm run plan:simulate -- --output docs/evidence/testnet-plan-simulation-YYYY-MM-DD.json
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {Account,Asset,Contract,Networks,Operation,SorobanDataBuilder,TransactionBuilder,Address,rpc,xdr} from '@stellar/stellar-sdk';
import {loadConfig} from './config.js';

const {values}=parseArgs({options:{output:{type:'string'},'extend-to':{type:'string',default:'535680'}}});
const extendTo=Number(values['extend-to']);
if(!Number.isInteger(extendTo)||extendTo<1||extendTo>3110400)throw new Error('--extend-to must be a ledger count up to 3110400');
const {env,chain}=await loadConfig();
const server=new rpc.Server(env.RPC_URL,{timeout:env.RPC_TIMEOUT_MS});
const repository=new URL('../../',import.meta.url);
const json=async(path:string)=>JSON.parse(await readFile(new URL(path,repository),'utf8'));
const d=chain.manifest.soroswap;
if(!d)throw new Error('No AMM is configured');
const network=await server.getNetwork();
if(network.passphrase!==Networks.TESTNET)throw new Error('Refusing to simulate: RPC is not Stellar Testnet');
const record=await json('docs/evidence/contracts-testnet-deployment-2026-11-02.json');
const completion=await json('docs/evidence/contracts-testnet-completion-2026-11-02.json');
const source:string=record.deployer;
const account=await server.getAccount(source);
const entry=await server.getAccountEntry(source);
const latest=await server.getLatestLedger();

async function simulate(label:string,operation:xdr.Operation,sorobanData?:xdr.SorobanTransactionData){
 const builder=new TransactionBuilder(new Account(source,account.sequenceNumber()),{fee:'100',networkPassphrase:Networks.TESTNET}).addOperation(operation).setTimeout(60);
 if(sorobanData)builder.setSorobanData(sorobanData);
 const simulation=await server.simulateTransaction(builder.build());
 if(rpc.Api.isSimulationError(simulation))return {label,simulated:false,error:simulation.error.split('\n')[0]!.slice(0,200)};
 const fee=BigInt(simulation.minResourceFee);
 return {label,simulated:true,restoreRequired:rpc.Api.isSimulationRestore(simulation),minResourceFeeStroops:fee.toString(),minResourceFeeXlm:Number(fee)/1e7};
}
const codeKey=(hash:string)=>xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({hash:Buffer.from(hash,'hex') as never}));
async function extend(label:string,key:xdr.LedgerKey){
 const found=(await server.getLedgerEntries(key)).entries[0];
 const liveUntilLedger=found?.liveUntilLedgerSeq??null;
 const estimate=await simulate(label,Operation.extendFootprintTtl({extendTo}),new SorobanDataBuilder().setReadOnly([key]).build());
 return {...estimate,liveUntilLedger,ledgersRemaining:liveUntilLedger===null?null:liveUntilLedger-latest.sequence,approximateDaysRemaining:liveUntilLedger===null?null:Math.round((liveUntilLedger-latest.sequence)*5/864)/100};
}
async function upload(label:string,file:string){
 const wasm=await readFile(new URL(`upstream/soroswap/contracts/target/wasm32-unknown-unknown/release/${file}`,repository));
 return {...await simulate(label,Operation.uploadContractWasm({wasm})),sizeBytes:wasm.length,localBuildSha256:createHash('sha256').update(wasm).digest('hex')};
}

// Every recorded receipt is compared with the chain. This reads evidence and never rewrites it.
const receipts=[];
for(const {operation,txHash,status,ledger,feeChargedStroops} of completion.receipts as {operation:string;txHash:string;status:string;ledger:number;feeChargedStroops:string}[]){
 const tx=await server.getTransaction(txHash);
 if(tx.status==='NOT_FOUND'){receipts.push({operation,hash:txHash,chain:'NOT_FOUND_IN_RETENTION',recordedLedger:ledger});continue;}
 const envelope=TransactionBuilder.fromXDR(tx.envelopeXdr.toXDR('base64'),Networks.TESTNET) as {source?:string};
 const chainFee=String((tx.resultXdr as unknown as {feeCharged:unknown}).feeCharged);
 receipts.push({operation,hash:txHash,chain:tx.status,chainLedger:tx.ledger,source:envelope.source,feeChargedStroops:chainFee,matchesRecord:tx.status===status&&tx.ledger===ledger&&chainFee===feeChargedStroops&&envelope.source===source});
}

const nativeToken=Asset.native().contractId(Networks.TESTNET);
const reference=(await json('docs/evidence/testnet-verification-2026-11-04.json')).publicSoroswapReference.samplePool.token0 as string;
const report={
 checkedAt:new Date().toISOString(),
 method:'Read-only: getLedgerEntries, getAccount, getTransaction and simulateTransaction. No key was used; nothing was signed or submitted.',
 caution:'Simulation fees are estimates for one ledger state, not budgets or quotes. Re-simulate immediately before any approved transaction.',
 rpc:{url:env.RPC_URL,passphrase:network.passphrase,protocolVersion:network.protocolVersion,latestLedger:latest.sequence},
 deployerAccount:{address:source,balanceStroops:String(entry.balance),note:'Public account data. The key was not used.'},
 receipts,
 ttl:{
  extendToLedgers:extendTo,
  pairCode:await extend('Extend Pair WASM TTL',codeKey(d.pairWasmHash)),
  factoryCode:await extend('Extend Factory WASM TTL',codeKey(d.factoryWasmHash)),
  routerCode:await extend('Extend Router WASM TTL',codeKey(d.routerWasmHash)),
  factoryInstance:await extend('Extend Factory instance TTL',new Contract(d.factory).getFootprint()),
  routerInstance:await extend('Extend Router instance TTL',new Contract(d.router).getFootprint()),
 },
 aggregatorUpload:[await upload('Upload aggregator WASM','soroswap_aggregator.optimized.wasm'),await upload('Upload deployer WASM','soroswap_aggregator_deployer.optimized.wasm')],
 firstPool:await simulate('create_pair on the deployed Factory: real code and state, placeholder tokens',new Contract(d.factory).call('create_pair',new Address(nativeToken).toScVal(),new Address(reference).toScVal())),
 notSimulatable:{
  deployerAndAggregatorDeployment:'Their WASM is not on the ledger until uploaded, so these can only be simulated after the upload step.',
  addLiquidity:'Needs a funded liquidity account holding both tokens, which does not exist yet.',
  swap:'Needs a deployed aggregator and a funded pool.',
 },
};
const text=JSON.stringify(report,(_,value)=>typeof value==='bigint'?value.toString():value,2)+'\n';
if(values.output)await writeFile(values.output,text,{flag:'wx'});
console.log(text);
