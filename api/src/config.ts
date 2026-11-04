import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';
import { manifestSchema } from './domain.js';
import { StellarChain, StellarTransport } from './chain.js';
export function parseEnvironment(values: NodeJS.ProcessEnv) {
  const env = z.object({PORT:z.coerce.number().int().min(1).max(65535).default(3000),HOST:z.string().default('127.0.0.1'),RPC_URL:z.url().default('https://soroban-testnet.stellar.org'),RPC_TIMEOUT_MS:z.coerce.number().int().min(100).max(15000).default(10000),DEPLOYMENTS_FILE:z.string().default('config/testnet.json'),CORS_ORIGINS:z.string().default(''),RPC_CONCURRENCY:z.coerce.number().int().min(1).max(10).default(5),MAX_DISCOVERY_POOLS:z.coerce.number().int().min(1).max(1000).default(1000),DISCOVERY_PAGE_SIZE:z.coerce.number().int().min(1).max(20).default(5),DISCOVERY_TIMEOUT_MS:z.coerce.number().int().min(100).max(15000).default(15000),TRUSTED_PROXIES:z.string().default('')}).parse(values);
  const rpcUrl = new URL(env.RPC_URL);
  if (rpcUrl.protocol !== 'https:' || rpcUrl.username || rpcUrl.password || rpcUrl.search || rpcUrl.hash) throw new Error('RPC_URL must use HTTPS without credentials, query parameters or fragments');
  const origins = env.CORS_ORIGINS.split(',').map(s=>s.trim()).filter(Boolean);
  for (const origin of origins) if (origin === '*' || new URL(origin).origin !== origin) throw new Error('CORS origins must be exact origins');
  // Forwarded headers are client-controlled unless they come from a listed proxy, so nothing is trusted by default.
  const trustedProxies = env.TRUSTED_PROXIES.split(',').map(s=>s.trim()).filter(Boolean);
  for (const proxy of trustedProxies) {
    const [address,prefix,...rest] = proxy.split('/');
    const version = isIP(address!);
    if (!version || rest.length || (prefix !== undefined && (!/^[0-9]{1,3}$/.test(prefix) || Number(prefix) > (version === 4 ? 32 : 128) || Number(prefix) === 0))) throw new Error('TRUSTED_PROXIES must list exact IP addresses or CIDR ranges');
  }
  return {env,origins,trustedProxies};
}
export async function loadConfig() {
  const root = fileURLToPath(new URL('../../',import.meta.url));
  try { loadEnvFile(resolve(root,'.env')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const {env,origins,trustedProxies} = parseEnvironment(process.env);
  const manifest = manifestSchema.parse(JSON.parse(await readFile(resolve(root,env.DEPLOYMENTS_FILE),'utf8')));
  return {env,origins,trustedProxies,chain:new StellarChain(manifest,new StellarTransport(env.RPC_URL,env.RPC_TIMEOUT_MS,env.RPC_CONCURRENCY),{maxPools:env.MAX_DISCOVERY_POOLS,pageSize:env.DISCOVERY_PAGE_SIZE,timeoutMs:env.DISCOVERY_TIMEOUT_MS})};
}
