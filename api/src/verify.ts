import { loadConfig } from './config.js';
const {chain} = await loadConfig();
console.log(JSON.stringify(await chain.verifyDeployment(),null,2));
console.log(JSON.stringify(await chain.snapshot(),null,2));
