// Manual operator utility only. This module never signs or submits a transaction.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {Address,Contract,Networks,StrKey,TransactionBuilder,contract,nativeToScVal,rpc,xdr} from '@stellar/stellar-sdk';
import {z} from 'zod';
import {loadConfig} from './config.js';
import {contractId} from './domain.js';
const {env,chain}=await loadConfig();
const vars=z.object({DEPLOYER_CONTRACT_ID:contractId,DEPLOYER_PUBLIC_KEY:z.string().refine(StrKey.isValidEd25519PublicKey),AGGREGATOR_WASM_HASH:z.string().regex(/^[a-f0-9]{64}$/),DEPLOYMENT_XDR_FILE:z.string().min(1)}).parse(process.env);
await chain.verifyDeployment();
const artifact=new URL('../../upstream/soroswap/contracts/target/wasm32-unknown-unknown/release/',import.meta.url);
const [aggregator,deployer]=await Promise.all(['soroswap_aggregator','soroswap_aggregator_deployer'].map(name=>readFile(new URL(name+'.optimized.wasm',artifact))));
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
if(digest(aggregator!)!==vars.AGGREGATOR_WASM_HASH)throw Error('Uploaded aggregator hash differs from local artifact');
if(digest(await chain.transport.wasm(vars.DEPLOYER_CONTRACT_ID))!==digest(deployer!))throw Error('Deployer code differs from local reviewed artifact');
const initArgs=contract.Spec.fromWasm(aggregator!).funcArgsToScVals('initialize',{
 admin:vars.DEPLOYER_PUBLIC_KEY,
 adapter_vec:[{protocol_id:0,router:chain.manifest.soroswap!.router,paused:false}],
});
const op=new Contract(vars.DEPLOYER_CONTRACT_ID).call('deploy',
 new Address(vars.DEPLOYER_PUBLIC_KEY).toScVal(),nativeToScVal(Buffer.from(vars.AGGREGATOR_WASM_HASH,'hex')),
 nativeToScVal(randomBytes(32)),xdr.ScVal.scvSymbol('initialize'),xdr.ScVal.scvVec(initArgs));
const server=new rpc.Server(env.RPC_URL,{timeout:env.RPC_TIMEOUT_MS});
const source=await server.getAccount(vars.DEPLOYER_PUBLIC_KEY);
const tx=new TransactionBuilder(source,{fee:'100',networkPassphrase:Networks.TESTNET}).addOperation(op).setTimeout(180).build();
const simulation=await server.simulateTransaction(tx);
if(rpc.Api.isSimulationRestore(simulation)||!rpc.Api.isSimulationSuccess(simulation))throw Error('Atomic deployment simulation failed or requires restoration');
await writeFile(vars.DEPLOYMENT_XDR_FILE,rpc.assembleTransaction(tx,simulation).build().toXDR()+'\n',{mode:0o600});
console.log('Prepared atomic Testnet deployment and initialization; admin is the CLI public account.');
