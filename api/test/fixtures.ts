import { StrKey } from '@stellar/stellar-sdk';
import { ServiceError } from '../src/domain.js';
import type { Chain, Pool, Quote, Snapshot } from '../src/domain.js';
export const address = (n: number) => StrKey.encodeContract(Buffer.alloc(32,n));
export const A = address(1), B = address(2), C = address(3);
export const pool = (id=address(4), token0=A, token1=B, reserve0='1000000',reserve1='2000000'):Pool => ({id,protocol:'Soroswap',token0,token1,reserve0,reserve1,feeBps:30,ledger:123,observedAt:Date.now()});
export const snapshot = (pools=[pool()]):Snapshot => ({pools,ledger:123,observedAt:Date.now()});
export const fakeChain = (overrides: Partial<Chain> = {}): Chain => ({snapshot:async()=>snapshot(),tokens:async()=>[],status:async()=>({network:'testnet',sequence:123}),readiness:async()=>({network:'testnet',mainnetEnabled:false,custody:'none',submitsTransactions:false,checkedAt:0,ledger:123,networkVerified:true,deployment:{status:'verified',code:null},liquidity:{status:'empty',pools:0,fundedPools:0,code:null},aggregator:{status:'not-deployed'},quotesAvailable:false,swapPreparationAvailable:false,blockers:['NO_POOLS','AGGREGATOR_NOT_DEPLOYED']}),transaction:async hash=>({hash,status:'NOT_FOUND',finalized:false}),validateQuote:async(_:Quote)=>{},prepareSwap:async()=>{throw new ServiceError('NOT_CONFIGURED','Test fixture has no swap deployment');},...overrides});

/**
 * Deterministic local-host/transport fixtures for measuring `prepareSwap`
 * behavior across ledger transitions.
 *
 * IMPORTANT: These fixtures are synthetic. They model a local transport that
 * returns fixed ledger reads and configurable simulation results. They are NOT
 * live evidence of swap behavior; the aggregator is not deployed. They exist
 * only to measure the current accept/reject outcomes of the ledger gate.
 */

export interface PrepareSwapTransportOptions {
  /** Ledger returned by the quote snapshot read (the ledger the quote was built against). */
  quoteLedger: number;
  /** Ledger returned by `simulateSwap` (the ledger the simulation ran against). */
  simulateLedger: number;
  /** Optional quote expiry (unix seconds). If omitted, the quote does not expire. */
  expiresAt?: number;
  /** Reserves returned by the quote snapshot read. Defaults to the standard pool reserves. */
  reserves?: { reserve0: string; reserve1: string };
  /** Reserves returned by `simulateSwap`. Defaults to `reserves` (unchanged). */
  simulatedReserves?: { reserve0: string; reserve1: string };
  /** Fixed clock (unix seconds) used for expiry checks. Defaults to 0. */
  now?: number;
}

export interface PrepareSwapTransport {
  /** The ledger the quote snapshot read reports. */
  quoteLedger: number;
  /** The ledger the simulation reports. */
  simulateLedger: number;
  /** Snapshot read used to build the quote. */
  readSnapshot: () => Snapshot;
  /** Simulation result used by `prepareSwap`. */
  simulateSwap: () => { ledger: number; reserve0: string; reserve1: string };
  /** Fixed clock used for expiry checks. */
  now: () => number;
}

/**
 * Build a deterministic transport for `prepareSwap` ledger-transition
 * measurement. The transport exposes a quote-snapshot read and a swap
 * simulation whose ledgers (and optionally reserves) are configurable.
 */
export const prepareSwapTransport = (opts: PrepareSwapTransportOptions): PrepareSwapTransport => {
  const reserves = opts.reserves ?? { reserve0: '1000000', reserve1: '2000000' };
  const simulatedReserves = opts.simulatedReserves ?? reserves;
  const fixedNow = opts.now ?? 0;
  return {
    quoteLedger: opts.quoteLedger,
    simulateLedger: opts.simulateLedger,
    readSnapshot: () => ({
      pools: [pool(address(4), A, B, reserves.reserve0, reserves.reserve1)],
      ledger: opts.quoteLedger,
      observedAt: fixedNow * 1000,
    }),
    simulateSwap: () => ({
      ledger: opts.simulateLedger,
      reserve0: simulatedReserves.reserve0,
      reserve1: simulatedReserves.reserve1,
    }),
    now: () => fixedNow,
  };
};

/**
 * Variant that simulates changed reserves so the swap limits no longer hold.
 * The simulation ledger is configurable; reserves are shifted enough that a
 * quote built against the original reserves should fail simulation.
 */
export const prepareSwapTransportWithChangedReserves = (
  opts: Omit<PrepareSwapTransportOptions, 'simulatedReserves'> & {
    simulatedReserves?: { reserve0: string; reserve1: string };
  },
): PrepareSwapTransport =>
  prepareSwapTransport({
    ...opts,
    simulatedReserves: opts.simulatedReserves ?? { reserve0: '1', reserve1: '1' },
  });

/** Named ledger-transition cases for deterministic measurement. */
export const prepareSwapLedgerCases = {
  /** Quote and simulation agree on the ledger. */
  sameLedger: (ledger = 123): PrepareSwapTransport =>
    prepareSwapTransport({ quoteLedger: ledger, simulateLedger: ledger }),
  /** Simulation ran on an older ledger than the quote. */
  olderLedger: (quoteLedger = 123, simulateLedger = 122): PrepareSwapTransport =>
    prepareSwapTransport({ quoteLedger, simulateLedger }),
  /** Simulation ran on a later ledger than the quote. */
  laterLedger: (quoteLedger = 123, simulateLedger = 124): PrepareSwapTransport =>
    prepareSwapTransport({ quoteLedger, simulateLedger }),
  /** Quote is expired relative to the fixed clock. */
  expiredQuote: (quoteLedger = 123, simulateLedger = 123, expiresAt = 100, now = 200): PrepareSwapTransport =>
    prepareSwapTransport({ quoteLedger, simulateLedger, expiresAt, now }),
} as const;