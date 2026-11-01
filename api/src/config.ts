import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';
import { manifestSchema } from './domain.js';
import { StellarChain, StellarTransport } from './chain.js';
export async function loadConfig() {
  const root = fileURLToPath(new URL('../../',import.meta.url));
  try { loadEnvFile(resolve(root,'.env')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const env = z.object({PORT:z.coerce.number().int().min(1).max(65535).default(3000),HOST:z.string().default('127.0.0.1'),RPC_URL:z.url().default('https://soroban-testnet.stellar.org'),RPC_TIMEOUT_MS:z.coerce.number().int().min(100).max(15000).default(10000),DEPLOYMENTS_FILE:z.string().default('config/testnet.json'),CORS_ORIGINS:z.string().default('')}).parse(process.env);
  if (new URL(env.RPC_URL).protocol !== 'https:') throw new Error('RPC_URL must use HTTPS');
  const origins = env.CORS_ORIGINS.split(',').map(s=>s.trim()).filter(Boolean);
  for (const origin of origins) if (origin === '*' || new URL(origin).origin !== origin) throw new Error('CORS origins must be exact origins');
  const manifest = manifestSchema.parse(JSON.parse(await readFile(resolve(root,env.DEPLOYMENTS_FILE),'utf8')));
  return {env,origins,chain:new StellarChain(manifest,new StellarTransport(env.RPC_URL,env.RPC_TIMEOUT_MS))};
}
