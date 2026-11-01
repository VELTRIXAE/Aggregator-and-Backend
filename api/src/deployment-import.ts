import {createHash} from 'node:crypto';
import {contract, Address, StrKey, Networks} from '@stellar/stellar-sdk';
import {z} from 'zod';
import {manifestSchema, contractId, ServiceError, type Manifest} from './domain.js';
import {StellarChain, type Transport} from './chain.js';
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const publicKey=z.string().refine(StrKey.isValidEd25519PublicKey);
const deployed=z.object({id:contractId,wasm_sha256:hash,deploy_tx:hash,initialize_tx:hash,upload_tx:hash.optional(),version:z.string().regex(/^\d+\.\d+\.\d+$/).optional()}).strict();
// Matches VELTRIXAE/Contract scripts/deploy-testnet.sh and create-pool.sh.
export const contractsRecordSchema=z.object({
 network:z.literal('testnet'),network_passphrase:z.literal(Networks.TESTNET).optional(),schema_version:z.literal(1).optional(),version_source:z.literal('cargo-package-version').optional(),deployed_at:z.iso.datetime(),git_commit:z.string().regex(/^[a-f0-9]{40}$/),
 deployer:publicKey,fee_to_setter:publicKey,
 contracts:z.object({factory:deployed,router:deployed,pair:z.object({wasm_hash:hash,upload_tx:hash,version:z.string().regex(/^\d+\.\d+\.\d+$/).optional()}).strict()}).strict(),
 pools:z.array(z.object({pair:contractId,token_a:contractId,token_b:contractId,tx:hash,created_at:z.iso.datetime()}).strict()
  .refine(p=>p.token_a!==p.token_b,'Pool tokens must differ')).max(100),
}).strict().refine(r=>r.contracts.factory.id!==r.contracts.router.id,'Factory and router must differ')
 .refine(r=>new Set(r.pools.map(p=>p.pair)).size===r.pools.length,'Duplicate pool IDs');
export type ContractsRecord=z.infer<typeof contractsRecordSchema>;
export type ArtifactRole='factory'|'router'|'pair'|'aggregator';
export const requiredMethods:Record<ArtifactRole,string[]>={
 factory:['fee_to_setter','all_pairs_length','all_pairs','get_pair'],
 router:['get_factory','router_get_amounts_out','router_get_amounts_in','swap_exact_tokens_for_tokens','swap_tokens_for_exact_tokens'],
 pair:['factory','token_0','token_1','get_reserves'],
 aggregator:['get_admin','get_adapters','swap_exact_tokens_for_tokens','swap_tokens_for_exact_tokens'],
};
export const wasmHash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export function assertCompatibleSpec(candidate:Uint8Array|contract.Spec,reference:Uint8Array,role:ArtifactRole){
 try{
  const actual=candidate instanceof contract.Spec?candidate:contract.Spec.fromWasm(candidate);
  const expected=contract.Spec.fromWasm(reference);
  if(role==='aggregator'){
   for(const name of ['Protocol','Adapter','DexDistribution']){
    const clean=(spec:contract.Spec)=>JSON.stringify(spec.findEntry(name).toXdrObject(),(key,value)=>key==='doc'||key==='lib'?undefined:value);
    if(clean(actual)!==clean(expected))throw Error(name);
   }
  }
  for(const name of requiredMethods[role]){
   const a=actual.getFunc(name),e=expected.getFunc(name);
   // Positional argument types and result types matter; documentation/parameter names do not.
   const signature=(f:typeof a)=>JSON.stringify({inputs:f.inputs.map(i=>i.type.toXDR('base64')),outputs:f.outputs.map(o=>o.toXDR('base64'))});
   if(signature(a)!==signature(e))throw Error(name);
  }
 }catch{throw new ServiceError('INCOMPATIBLE_ABI',`${role} does not match required pinned interface signatures`,422);}
}
export function candidateFromRecord(value:unknown,expectedCommit:string,aggregator:Manifest['veltrixae']=null):{record:ContractsRecord;manifest:Manifest}{
 const record=contractsRecordSchema.parse(value);
 if(record.git_commit!==expectedCommit)throw new ServiceError('SOURCE_REVISION_MISMATCH','Deployment source revision differs from the independently reviewed commit',422);
 const manifest=manifestSchema.parse({network:'testnet',soroswap:{
  factory:record.contracts.factory.id,router:record.contracts.router.id,
  factoryWasmHash:record.contracts.factory.wasm_sha256,routerWasmHash:record.contracts.router.wasm_sha256,pairWasmHash:record.contracts.pair.wasm_hash,
 },veltrixae:aggregator,assets:[]});
 return {record,manifest};
}
export async function verifyImport(candidate:ReturnType<typeof candidateFromRecord>,artifacts:Record<'factory'|'router'|'pair',Uint8Array>,references:Record<ArtifactRole,Uint8Array>,transport:Transport,aggregatorAdmin?:string){
 const {record,manifest}=candidate;
 const expected={factory:manifest.soroswap!.factoryWasmHash,router:manifest.soroswap!.routerWasmHash,pair:manifest.soroswap!.pairWasmHash};
 for(const role of ['factory','router','pair'] as const){
  if(wasmHash(artifacts[role])!==expected[role])throw new ServiceError('ARTIFACT_MISMATCH',`${role} artifact differs from deployment record`,422);
  assertCompatibleSpec(artifacts[role],references[role],role);
 }
 const chain=new StellarChain(manifest,transport);
 await chain.verifyDeployment(); // Network, live factory/router hashes, router link, active aggregator router.
 if((await transport.read(manifest.soroswap!.factory,'fee_to_setter')).value!==record.fee_to_setter)throw new ServiceError('CONTRACT_MISMATCH','Factory fee setter differs from the contracts record');
 if(manifest.veltrixae){
  if(!aggregatorAdmin||!StrKey.isValidEd25519PublicKey(aggregatorAdmin))throw new ServiceError('EXPECTED_ADMIN_REQUIRED','A reviewed aggregator admin public account is required',422);
  const bytes=await transport.wasm(manifest.veltrixae.aggregator);
  assertCompatibleSpec(bytes,references.aggregator,'aggregator');
  if((await transport.read(manifest.veltrixae.aggregator,'get_admin')).value!==aggregatorAdmin)throw new ServiceError('CONTRACT_MISMATCH','Aggregator admin differs from the reviewed account');
 }
 const snapshot=await chain.snapshot();
 for(const pool of record.pools){
  const observed=snapshot.pools.find(p=>p.id===pool.pair);
  if(!observed||![observed.token0,observed.token1].includes(pool.token_a)||![observed.token0,observed.token1].includes(pool.token_b))throw new ServiceError('CONTRACT_MISMATCH','Recorded pool differs from factory discovery');
  const registered=await transport.read(manifest.soroswap!.factory,'get_pair',[new Address(pool.token_a).toScVal(),new Address(pool.token_b).toScVal()]);
  if(registered.value!==pool.pair)throw new ServiceError('CONTRACT_MISMATCH','Factory token-pair mapping differs from deployment record');
 }
 // Verify lookup mapping for every discovered pool, not only pools listed in the export.
 for(const pool of snapshot.pools){
  const found=await transport.read(manifest.soroswap!.factory,'get_pair',[new Address(pool.token0).toScVal(),new Address(pool.token1).toScVal()]);
  if(found.value!==pool.id)throw new ServiceError('CONTRACT_MISMATCH','Discovered pool is not registered for its tokens');
 }
 return {network:'testnet',sourceCommit:record.git_commit,ledger:snapshot.ledger,poolCount:snapshot.pools.length,
  fundedPoolCount:snapshot.pools.filter(p=>BigInt(p.reserve0)>0n&&BigInt(p.reserve1)>0n).length,
  ammVerified:true,pairCodeObservedOnChain:snapshot.pools.length>0,quoteParityVerified:false,aggregatorVerified:!!manifest.veltrixae,liveSwapVerified:false,
  transactionEvidence:'recorded hashes; transaction inclusion not verified by this importer',
  note:'Read-only checks at observation time; readiness and quotes must be refreshed before wallet signing'};
}
