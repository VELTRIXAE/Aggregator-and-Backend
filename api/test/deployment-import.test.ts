import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Networks,StrKey,type rpc} from '@stellar/stellar-sdk';
import {candidateFromRecord,contractsRecordSchema,assertCompatibleSpec,verifyImport,wasmHash} from '../src/deployment-import.js';
import type {Transport} from '../src/chain.js';
import {address,A,B} from './fixtures.js';
const artifacts=Object.fromEntries(await Promise.all(['factory','router','pair'].map(async role=>[role,await readFile(new URL(`../../upstream/soroswap/contracts/aggregator/soroswap_contracts/soroswap_${role}.wasm`,import.meta.url))]))) as Record<'factory'|'router'|'pair',Buffer>;
const references={...artifacts,aggregator:new Uint8Array()};
const factory=address(10),router=address(11),pair=address(4);
const admin=StrKey.encodeEd25519PublicKey(Buffer.alloc(32,9));
const revision='a'.repeat(40),tx='b'.repeat(64); // Explicitly synthetic evidence; never live addresses or transactions.
const record=()=>({network:'testnet',deployed_at:'2026-11-01T00:00:00Z',git_commit:revision,deployer:admin,fee_to_setter:admin,
 contracts:{factory:{id:factory,wasm_sha256:wasmHash(artifacts.factory),deploy_tx:tx,initialize_tx:tx},router:{id:router,wasm_sha256:wasmHash(artifacts.router),deploy_tx:tx,initialize_tx:tx},pair:{wasm_hash:wasmHash(artifacts.pair),upload_tx:tx}},
 pools:[{pair,token_a:A,token_b:B,tx,created_at:'2026-11-01T00:00:00Z'}]});
function transport(overrides:Partial<Transport>={}):Transport{
 return {network:async()=>({passphrase:Networks.TESTNET}),latest:async()=>({sequence:123,closeTime:String(Math.floor(Date.now()/1000))}),
 wasm:async id=>id===factory?artifacts.factory:id===router?artifacts.router:artifacts.pair,
 transaction:async()=>({status:'NOT_FOUND',latestLedger:123} as rpc.Api.GetTransactionResponse),
 read:async(_id,method)=>({ledger:123,value:({get_factory:factory,factory,all_pairs_length:1,all_pairs:pair,token_0:A,token_1:B,get_reserves:[1000000n,2000000n],get_pair:pair,fee_to_setter:admin} as Record<string,unknown>)[method]}),...overrides};
}
test('maps actual contracts export fields to the existing compatible AMM manifest without inventing an aggregator',()=>{
 const candidate=candidateFromRecord(record(),revision);
 assert.equal(candidate.manifest.soroswap?.factory,factory);
 assert.equal(candidate.manifest.soroswap?.pairWasmHash,record().contracts.pair.wasm_hash);
 assert.equal(candidate.manifest.veltrixae,null);assert.deepEqual(candidate.manifest.assets,[]);
 assert.throws(()=>candidateFromRecord(record(),'c'.repeat(40)),/reviewed commit/);
 for(const bad of [{...record(),network:'mainnet'},{...record(),privateKey:'never'},{...record(),git_commit:'unknown'},{...record(),contracts:{...record().contracts,factory:{...record().contracts.factory,deploy_tx:''}}}])assert.equal(contractsRecordSchema.safeParse(bad).success,false);
});
test('checks actual pinned WASM interfaces and rejects another contract role or malformed WASM',()=>{
 for(const role of ['factory','router','pair'] as const)assertCompatibleSpec(artifacts[role],artifacts[role],role);
 assert.throws(()=>assertCompatibleSpec(artifacts.pair,artifacts.router,'router'),/required pinned interface/);
 assert.throws(()=>assertCompatibleSpec(Buffer.from('not wasm'),artifacts.router,'router'),/required pinned interface/);
});
test('verifies export artifacts, live identities and factory mappings; reports AMM-only readiness honestly',async()=>{
 const result=await verifyImport(candidateFromRecord(record(),revision),artifacts,references,transport());
 assert.equal(result.ammVerified,true);assert.equal(result.aggregatorVerified,false);assert.equal(result.liveSwapVerified,false);
 assert.equal(result.quoteParityVerified,false);assert.equal(result.fundedPoolCount,1);
});
test('rejects changed artifacts, wrong networks, fee setter mismatch and forged pool registration',async()=>{
 const candidate=candidateFromRecord(record(),revision);
 await assert.rejects(()=>verifyImport(candidate,{...artifacts,pair:artifacts.router},references,transport()),/artifact differs/);
 await assert.rejects(()=>verifyImport(candidate,artifacts,references,transport({network:async()=>({passphrase:Networks.PUBLIC})})),/not Stellar Testnet/);
 const base=transport();
 for(const [method,value]of [['fee_to_setter',address(20)],['get_pair',address(21)]]as const){
  await assert.rejects(()=>verifyImport(candidate,artifacts,references,transport({read:async(id,m,a)=>m===method?{ledger:123,value}:base.read(id,m,a)})),/differs|registered/);
 }
 const unknown=record();unknown.pools[0]!.pair=address(50);
 await assert.rejects(()=>verifyImport(candidateFromRecord(unknown,revision),artifacts,references,transport()),/Recorded pool differs/);
});

test('CLI stops at missing deployment record before creating a candidate or contacting RPC',async()=>{
 const {mkdtemp,access,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {execFile}=await import('node:child_process');
 const {promisify}=await import('node:util');
 const dir=await mkdtemp(join(tmpdir(),'veltrixae-import-test-'));
 const output=join(dir,'candidate.json');
 try{
  await assert.rejects(()=>promisify(execFile)(process.execPath,['--import','tsx','api/src/import-deployment.ts','--repository',dir,'--expected-commit',revision,'--artifact-dir',dir,'--output',output],{cwd:new URL('../../',import.meta.url),env:{...process.env,RPC_URL:'https://unreachable.invalid'}}),(error:unknown)=>String((error as {stderr?:string}).stderr).includes('DEPLOYMENT_RECORD_MISSING'));
  await assert.rejects(()=>access(output));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('accepts the contracts deployment schema with explicit Testnet passphrase, versions and upload receipts',()=>{
 const base=record();
 const exported={...base,schema_version:1,network_passphrase:Networks.TESTNET,version_source:'cargo-package-version',contracts:{
  factory:{...base.contracts.factory,version:'0.0.2',upload_tx:tx},router:{...base.contracts.router,version:'0.0.1',upload_tx:tx},pair:{...base.contracts.pair,version:'0.0.1'},
 }};
 assert.ok(contractsRecordSchema.safeParse(exported).success);
 assert.equal(candidateFromRecord(exported,revision).manifest.veltrixae,null);
 assert.equal(contractsRecordSchema.safeParse({...exported,network_passphrase:Networks.PUBLIC}).success,false);
});
