import { loadConfig } from './config.js';
import { buildApp } from './app.js';
const {env,origins,trustedProxies,chain} = await loadConfig();
const app = await buildApp(chain,origins,true,trustedProxies);
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{void app.close();});
await app.listen({port:env.PORT,host:env.HOST});
