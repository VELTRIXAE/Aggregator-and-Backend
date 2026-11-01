import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {resolve} from 'node:path';
import {contract} from '@stellar/stellar-sdk';
import {assertCompatibleSpec} from './deployment-import.js';
const {values}=parseArgs({options:{repository:{type:'string'}}});
if(!values.repository)throw Error('--repository PATH is required');
const results=[];
for(const role of ['factory','router','pair'] as const){
 const source=await readFile(resolve(values.repository,`bindings/${role}/src/index.ts`),'utf8');
 // Read JSON literals only. Never execute another repository's code during inspection.
 const match=source.match(/new ContractSpec\(\s*(\[[\s\S]*?\])\s*\)/);
 if(!match)throw Error(`No generated base64 spec found for ${role}; supply reviewed bindings`);
 const entries:unknown=JSON.parse(match[1]!);
 if(!Array.isArray(entries)||!entries.every(e=>typeof e==='string'))throw Error('Expected a base64 contract-spec array');
 const reference=await readFile(new URL(`../../upstream/soroswap/contracts/aggregator/soroswap_contracts/soroswap_${role}.wasm`,import.meta.url));
 assertCompatibleSpec(new contract.Spec(entries),reference,role);
 results.push({role,requiredMethodSignatures:'compatible',evidence:'checked-in generated bindings; not deployed WASM'});
}
console.log(JSON.stringify({results,deploymentVerified:false},null,2));
