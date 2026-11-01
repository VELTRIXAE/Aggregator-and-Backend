// Read-only observations. WASM presence is not liquidity or adapter compatibility.
import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {resolve} from 'node:path';
import {contract} from '@stellar/stellar-sdk';
import {loadConfig} from './config.js';
import {manifestSchema,type Manifest} from './domain.js';
import {assertCompatibleSpec,wasmHash} from './deployment-import.js';
const {values}=parseArgs({options:{'soroswap-candidate':{type:'string'}}});
const root=new URL('../../',import.meta.url);
const historical=JSON.parse(await readFile(new URL('upstream/soroswap/public/testnet.contracts.json',root),'utf8'));
const pinned=JSON.parse(await readFile(new URL('upstream/soroswap/protocols/soroswap/public/testnet.contracts.json',root),'utf8'));
const aqua=JSON.parse(await readFile(new URL('upstream/soroswap/protocols/aqua-addresses/testnet.contracts.json',root),'utf8'));
const probes:{name:string;id:string;role?:'factory'|'router';expectedHash?:string;source:string}[]=[
 {name:'Soroswap pinned factory',id:pinned.ids.factory,role:'factory',expectedHash:pinned.hashes.factory,source:'pinned upstream Core'},
 {name:'Soroswap pinned router',id:pinned.ids.router,role:'router',expectedHash:pinned.hashes.router,source:'pinned upstream Core'},
 {name:'Phoenix historical factory',id:historical.ids.phoenix_factory,source:'pinned upstream aggregator custom Testnet deployment'},
 {name:'Phoenix historical multihop',id:historical.ids.phoenix_multihop,source:'pinned upstream aggregator custom Testnet deployment'},
 {name:'Aquarius documented router',id:aqua.ids.aqua_router,source:'https://docs.aqua.network/developers/code-examples/prerequisites-and-basics'},
];
let candidate:Manifest['soroswap']=null;
if(values['soroswap-candidate']){
 const data=JSON.parse(await readFile(resolve(values['soroswap-candidate']),'utf8'));
 candidate=manifestSchema.parse({network:'testnet',soroswap:{factory:data.ids.factory,router:data.ids.router,factoryWasmHash:data.hashes.factory,routerWasmHash:data.hashes.router,pairWasmHash:data.hashes.pair},veltrixae:null,assets:[]}).soroswap;
 for(const role of ['factory','router']as const)probes.push({name:`Soroswap candidate ${role}`,id:candidate![role],role,expectedHash:candidate![`${role}WasmHash`],source:values['soroswap-candidate']});
}
const {chain}=await loadConfig();const network=await chain.status();
const results=await Promise.all(probes.map(async probe=>{
 try{
  const wasm=await chain.transport.wasm(probe.id),spec=contract.Spec.fromWasm(wasm);
  const result:Record<string,unknown>={...probe,status:'WASM_PRESENT',wasmSha256:wasmHash(wasm),methodCount:spec.funcs().length,liquidityVerified:false};
  if(probe.expectedHash)result.hashMatches=wasmHash(wasm)===probe.expectedHash;
  if(probe.role){
   try{assertCompatibleSpec(wasm,await readFile(new URL(`upstream/soroswap/contracts/aggregator/soroswap_contracts/soroswap_${probe.role}.wasm`,root)),probe.role);result.requiredSignaturesCompatible=true;}
   catch{result.requiredSignaturesCompatible=false;}
  }
  if(probe.name==='Aquarius documented router'){
   const reference=contract.Spec.fromWasm(await readFile(new URL('upstream/soroswap/contracts/aggregator/aqua_contracts/soroban_liquidity_pool_router_contract.wasm',root)));
   result.pinnedSwapSignaturesCompatible=['swap_chained','swap_chained_strict_receive','get_pool'].every(name=>{
    try{const a=spec.getFunc(name),b=reference.getFunc(name);const sig=(f:typeof a)=>JSON.stringify({i:f.inputs.map(x=>x.type.toXDR('base64')),o:f.outputs.map(x=>x.toXDR('base64'))});return sig(a)===sig(b);}catch{return false;}
   });
   try{result.tokenSetsCount=String((await chain.transport.read(probe.id,'get_tokens_sets_count')).value);}catch{result.discoveryRead='unavailable';}
  }
  return result;
 }catch(error){return {...probe,status:(error as {code?:string}).code??'RPC_ERROR'};}
}));
let candidateState:Record<string,unknown>|null=null;
if(candidate){
 try{
  const factory=(await chain.transport.read(candidate.router,'get_factory')).value;
  const count=(await chain.transport.read(candidate.factory,'all_pairs_length')).value;
  candidateState={routerFactoryMatches:factory===candidate.factory,poolCount:String(count),backendDiscoveryLimit:100,fullDiscoveryWithinLimit:typeof count==='number'?count<=100:typeof count==='bigint'?count<=100n:false};
 }catch(error){candidateState={error:(error as {code?:string}).code??'RPC_ERROR'};}
}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),network,results,candidateState,comet:{status:'NO_REVIEWED_TESTNET_ID',liquidityVerified:false},activated:false,submitted:false},null,2));
