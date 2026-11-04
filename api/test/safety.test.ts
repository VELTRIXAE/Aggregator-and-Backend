import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {StrKey} from '@stellar/stellar-sdk';
import {manifestSchema} from '../src/domain.js';
import {parseEnvironment} from '../src/config.js';
// Repository-level guards for the custody and network boundaries. These fail the build instead of relying on review.
const root=fileURLToPath(new URL('../../',import.meta.url));
const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const read=(file:string)=>readFileSync(root+file,'utf8');
const runtime=tracked.filter(f=>/^(api|packages\/frontend-client)\/src\/.*\.ts$/.test(f));
test('runtime source cannot sign, submit or reach mainnet',()=>{
 assert.ok(runtime.length>5);
 for(const file of runtime){
  const source=read(file);
  for(const [name,pattern] of [['sendTransaction',/\bsendTransaction\b/],['Keypair',/\bKeypair\b/],['signing',/\.sign\(|signTransaction|signAuthEntry|authorizeEntry/],['mainnet passphrase',/Networks\.PUBLIC|Public Global Stellar Network/],['secret input',/\b(SECRET_KEY|PRIVATE_KEY|SIGNING_KEY|MNEMONIC)\b/]] as const)
   assert.equal(pattern.test(source),false,`${file} must not contain ${name}`);
 }
});
test('no valid Stellar secret seed is tracked',()=>{
 const text=tracked.filter(f=>!/\.(bundle|tar\.gz|wasm|pdf)$/.test(f)&&!f.startsWith('upstream/'));
 for(const file of text){
  let body:string;
  try{body=read(file);}catch{continue;}
  for(const match of body.match(/\bS[A-Z2-7]{55}\b/g)??[]) assert.equal(StrKey.isValidEd25519SecretSeed(match),false,`${file} contains a secret seed`);
 }
});
test('environment files and local secrets stay ignored',()=>{
 assert.equal(tracked.some(f=>/(^|\/)\.env$|(^|\/)\.env\.(?!example$)/.test(f)),false);
 const example=read('.env.example');
 for(const line of example.split('\n').filter(l=>l&&!l.startsWith('#'))) assert.equal(/SECRET|PRIVATE|MNEMONIC|SEED/i.test(line.split('=')[0]!),false,line);
});
test('the active manifest and schema accept only Testnet',()=>{
 const manifest=manifestSchema.parse(JSON.parse(read('config/testnet.json')));
 assert.equal(manifest.network,'testnet');
 for(const network of ['mainnet','public','futurenet'])assert.equal(manifestSchema.safeParse({...manifest,network}).success,false,network);
});
test('configuration exposes no key material or network switch',()=>{
 const {env}=parseEnvironment({SECRET_KEY:'ignored',NETWORK:'mainnet'});
 assert.equal('SECRET_KEY' in env,false);assert.equal('NETWORK' in env,false);
 for(const url of ['http://soroban-testnet.stellar.org','https://user:pw@rpc.example','https://rpc.example/?apikey=x'])assert.throws(()=>parseEnvironment({RPC_URL:url}));
});
test('the manual deployment script stays gated, Testnet-only and verified first',()=>{
 const script=read('scripts/deploy-testnet.sh');
 assert.match(script,/APPROVE_TESTNET_DEPLOY:\?/);assert.match(script,/== yes \]\] \|\| exit 1/);
 assert.match(script,/Test SDF Network ; September 2015/);assert.equal(/Public Global|--network mainnet|pubnet/.test(script),false);
 assert.ok(script.indexOf('npm run verify:deployment')<script.indexOf('stellar contract deploy'));
});
test('preserved deployment evidence is unchanged and consistent with the active manifest',()=>{
 const sums=read('docs/evidence/SHA256SUMS').trim().split('\n').map(line=>line.split(/\s+/) as [string,string]);
 assert.ok(sums.length>=11);
 for(const [hash,file] of sums) assert.equal(createHash('sha256').update(readFileSync(root+'docs/evidence/'+file)).digest('hex'),hash,`${file} changed; add new evidence as a new file`);
 const pinned=new Set(sums.map(([,file])=>file));
 for(const file of tracked.filter(f=>f.startsWith('docs/evidence/')&&!/\/(README\.md|SHA256SUMS)$/.test(f))) assert.ok(pinned.has(file.slice('docs/evidence/'.length)),`${file} is not pinned in SHA256SUMS`);
 const record=JSON.parse(read('docs/evidence/contracts-testnet-deployment-2026-11-02.json'));
 const completion=JSON.parse(read('docs/evidence/contracts-testnet-completion-2026-11-02.json'));
 const manifest=manifestSchema.parse(JSON.parse(read('config/testnet.json')));
 assert.deepEqual(manifest.soroswap,{factory:record.contracts.factory.id,router:record.contracts.router.id,factoryWasmHash:record.contracts.factory.wasm_sha256,routerWasmHash:record.contracts.router.wasm_sha256,pairWasmHash:record.contracts.pair.wasm_hash});
 assert.equal(completion.receipts.length,7);
 assert.ok(completion.receipts.every((r:{status:string})=>r.status==='SUCCESS'));
 assert.equal(completion.receipts.reduce((sum:bigint,r:{feeChargedStroops:string})=>sum+BigInt(r.feeChargedStroops),0n),97114662n);
});
test('public status documents state zero pools and no executable swaps until a real pool is recorded',()=>{
 const record=JSON.parse(read('docs/evidence/contracts-testnet-deployment-2026-11-02.json'));
 assert.deepEqual(record.pools,[]);
 for(const file of ['README.md','docs/FUNDING_EVIDENCE.md']) assert.match(read(file),/currently has zero pools and no executable swaps/,file);
 assert.equal(manifestSchema.parse(JSON.parse(read('config/testnet.json'))).veltrixae,null);
});
