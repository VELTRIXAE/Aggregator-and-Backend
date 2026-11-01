import {readFile,writeFile,realpath} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadConfig} from './config.js';
import {manifestSchema} from './domain.js';
import {candidateFromRecord,verifyImport,type ArtifactRole} from './deployment-import.js';
const {values}=parseArgs({options:{repository:{type:'string'},'expected-commit':{type:'string'},'artifact-dir':{type:'string'},output:{type:'string'},'aggregator-manifest':{type:'string'},'expected-admin':{type:'string'},help:{type:'boolean'}}});
if(values.help){
 console.log('Read-only import: --repository PATH --expected-commit SHA --artifact-dir PATH [--aggregator-manifest PATH --expected-admin G...] [--output NEW_FILE]. No output file means verification only. Never deploys, signs, submits or overwrites files.');
}else{
 if(!values.repository||!values['expected-commit']||!values['artifact-dir'])throw Error('--repository, --expected-commit and --artifact-dir are required');
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const repo=await realpath(resolve(values.repository));
 // Check for the real deployment export before making network requests or creating output.
 let recordPath:string;
 try{recordPath=await realpath(resolve(repo,'deployments/testnet.json'));}catch{throw Error('DEPLOYMENT_RECORD_MISSING: contracts repository has no deployments/testnet.json; obtain an authorized real deployment record before importing');}
 const rel=relative(repo,recordPath);if(rel.startsWith('..')||isAbsolute(rel))throw Error('Deployment record must remain inside the reviewed repository');
 const record=JSON.parse(await readFile(recordPath,'utf8'));
 const supplement=values['aggregator-manifest']?manifestSchema.parse(JSON.parse(await readFile(resolve(values['aggregator-manifest']),'utf8'))):null;
 if(supplement&&!supplement.veltrixae)throw Error('Aggregator supplement has no aggregator deployment');
 const candidate=candidateFromRecord(record,values['expected-commit'],supplement?.veltrixae??null);
 if(supplement&&(!supplement.soroswap||Object.entries(candidate.manifest.soroswap!).some(([key,value])=>supplement.soroswap![key as keyof NonNullable<typeof supplement.soroswap>]!==value)))throw Error('Aggregator supplement references a different AMM deployment');
 const dir=resolve(values['artifact-dir']);
 const expected={factory:candidate.manifest.soroswap!.factoryWasmHash,router:candidate.manifest.soroswap!.routerWasmHash,pair:candidate.manifest.soroswap!.pairWasmHash};
 const {wasmHash}=await import('./deployment-import.js');
 const artifacts={} as Record<'factory'|'router'|'pair',Uint8Array>;
 for(const role of ['factory','router','pair'] as const){
  for(const suffix of ['.optimized.wasm','.wasm']){
   try{const bytes=await readFile(resolve(dir,`veltrixae_${role}${suffix}`));if(wasmHash(bytes)===expected[role]){artifacts[role]=bytes;break;}}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  }
  if(!artifacts[role])throw Error(`ARTIFACT_MISMATCH: no ${role} WASM matches the deployment record`);
 }
 const refs={} as Record<ArtifactRole,Uint8Array>;
 for(const role of ['factory','router','pair'] as const)refs[role]=await readFile(resolve(root,`upstream/soroswap/contracts/aggregator/soroswap_contracts/soroswap_${role}.wasm`));
 refs.aggregator=candidate.manifest.veltrixae?await readFile(resolve(root,'upstream/soroswap/contracts/target/wasm32-unknown-unknown/release/soroswap_aggregator.optimized.wasm')):new Uint8Array();
 const {chain}=await loadConfig();
 const report=await verifyImport(candidate,artifacts,refs,chain.transport,values['expected-admin']);
 if(values.output){
  const dest=resolve(values.output);
  if(dest===resolve(root,'config/testnet.json'))throw Error('Active config/testnet.json cannot be written by the importer; write a candidate for review');
  await writeFile(dest,JSON.stringify(candidate.manifest,null,2)+'\n',{flag:'wx',mode:0o644});
 }
 console.log(JSON.stringify({...report,checkedAt:new Date().toISOString(),output:values.output??null,activated:false},null,2));
}
