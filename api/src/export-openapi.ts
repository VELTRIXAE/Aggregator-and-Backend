import {writeFile} from 'node:fs/promises';
import {loadConfig} from './config.js';
import {buildApp} from './app.js';
// Registration is local: exporting documentation does not query or deploy contracts.
const {chain}=await loadConfig();
const app=await buildApp(chain);
try {
  await app.ready();
  await writeFile(new URL('../../docs/openapi.json',import.meta.url),JSON.stringify(app.swagger(),null,2)+'\n');
} finally { await app.close(); }
