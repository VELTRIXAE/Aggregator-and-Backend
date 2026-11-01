// Explicit operator command: checks the pinned upstream candidate, never enables it automatically.
import {readFile} from 'node:fs/promises';
import {loadConfig} from './config.js';
import {manifestSchema} from './domain.js';
import {StellarChain} from './chain.js';
const candidate=JSON.parse(await readFile(new URL('../../upstream/soroswap/protocols/soroswap/public/testnet.contracts.json',import.meta.url),'utf8'));
const {chain}=await loadConfig();
const manifest=manifestSchema.parse({network:'testnet',soroswap:{factory:candidate.ids.factory,router:candidate.ids.router,factoryWasmHash:candidate.hashes.factory,routerWasmHash:candidate.hashes.router,pairWasmHash:candidate.hashes.pair},veltrixae:null,assets:[]});
const checked=new StellarChain(manifest,chain.transport);
await checked.verifyDeployment();
await checked.snapshot();
console.log(JSON.stringify(manifest,null,2));
