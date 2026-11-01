import { StrKey } from '@stellar/stellar-sdk';
import { z } from 'zod';
export const MAX_I128 = (1n << 127n) - 1n;
export class ServiceError extends Error {
  constructor(public code: string, message: string, public status = 503) { super(message); }
}
export const contractId = z.string().refine(StrKey.isValidContract, 'Expected a checksummed Soroban contract ID');
export const amount = z.string().regex(/^[1-9][0-9]{0,38}$/).refine(v => BigInt(v) >= 10n && BigInt(v) <= MAX_I128, 'Amount must be between 10 and i128::MAX base units');
export const quoteRequest = z.object({
  tokenIn: contractId, tokenOut: contractId, amount,
  kind: z.enum(['exactIn', 'exactOut']).default('exactIn'),
  slippageBps: z.number().int().min(0).max(5000).default(50),
  maxHops: z.number().int().min(1).max(3).default(3),
}).strict().refine(v => v.tokenIn !== v.tokenOut, 'Tokens must differ');
export type QuoteRequest = z.infer<typeof quoteRequest>;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const deployment = z.object({factory: contractId, router: contractId, factoryWasmHash: hash, routerWasmHash: hash, pairWasmHash: hash}).strict();
export const manifestSchema = z.object({
  network: z.literal('testnet'), soroswap: deployment.nullable(),
  veltrixae: z.object({aggregator: contractId, aggregatorWasmHash: hash}).strict().nullable(),
  assets: z.array(z.object({contract: contractId, code: z.string().regex(/^[a-zA-Z0-9]{1,12}$/).optional(), issuer: z.string().refine(StrKey.isValidEd25519PublicKey).optional(), native: z.boolean().optional()}).strict()).max(500),
}).strict();
export type Manifest = z.infer<typeof manifestSchema>;
export interface Token { contract: string; symbol: string; name: string; decimals: number; asset?: {code: string; issuer?: string}; verification: 'onchain-metadata-only'; }
export interface Pool { id: string; protocol: 'Soroswap'; token0: string; token1: string; reserve0: string; reserve1: string; feeBps: 30; ledger: number; observedAt: number; }
export interface Snapshot { pools: Pool[]; ledger: number; observedAt: number; }
export interface Route { path: string[]; pools: string[]; protocol: 'Soroswap'; amountIn: string; amountOut: string; fees: {token: string; amount: string; feeBps: number}[]; priceImpactBps: number; }
export interface Quote { network: 'testnet'; kind: QuoteRequest['kind']; tokenIn: string; tokenOut: string; amountIn: string; amountOut: string; minimumReceived: string; maximumInput: string; slippageBps: number; routes: Route[]; selectedRoute: Route; ledger: number; observedAt: number; expiresAt: number; executable: false; networkFee: null; }
export interface Chain {
  validateQuote(quote: Quote): Promise<void>; snapshot(): Promise<Snapshot>; tokens(): Promise<Token[]>; status(): Promise<unknown>;
  transaction(hash: string): Promise<unknown>;
}
export function bounded(value: bigint): bigint {
  if (value <= 0n || value > MAX_I128) throw new ServiceError('INSUFFICIENT_LIQUIDITY', 'Amount cannot be represented or rounds to zero', 422);
  return value;
}
