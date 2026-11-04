# Original backend contributions

VELTRIXAE preserves the pinned Soroswap aggregator/adapters, attribution and licenses. It adds a separate TypeScript backend and frontend client; it does not claim ownership of upstream AMM math or the upstream Rust adapters. See UPSTREAM_ATTRIBUTION.md.

## Changes in this audit

- Configurable complete factory discovery in bounded index batches, collection deadlines, global RPC operation/queue limits, and explicit failures instead of truncated markets.
- In-flight snapshot coalescing with zero completed reserve TTL. Three overlapping mocked callers now read reserves once; a subsequent request reads them again. No executable quote cache is introduced.
- Adjacency-indexed route traversal and deterministic equal-price selection by hop count then pool IDs. Exact arithmetic, fee rounding, slippage, three-hop/10000-state bounds and router parity remain compatible with the reviewed VELTRIXAE AMM and pinned upstream behavior.
- Runtime factory token-pair registration checks and explicit archived-state restoration errors.
- Strict environment workload bounds, credential-free RPC URL validation, structured missing-route errors and safe structured request/error logging.
- Integration of the actual deployed AMM through ABI/hash/state verification, separate live empty-factory checks, bounded concurrency/deadline regressions and CI stages.

## Measured scope

npm run benchmark:routing uses a synthetic 1000-pool graph with direct and two-hop routes and 997 unrelated pools. The original flat traversal performs 2000 pool checks; indexed traversal performs four edge checks plus 1000 pool visits to construct the index. Both find the same two candidate paths. This measures operation counts, not live RPC or end-to-end latency. The 10000-state complexity bound remains; there is no claim of globally optimal execution or split-route optimization.

The mocked snapshot concurrency test demonstrates three overlapping callers sharing one reserve collection, followed by a new collection for the next request. The limiter tests observe at most two simultaneous workers when configured to two, including failure/queue timeout recovery. These are reproducible isolated measurements, not public Testnet throughput benchmarks.

## Upstream comparison

AMM fee and reserve formulas are preserved: exact input deducts ceil(input*3/1000); exact output uses ceil(reserveIn*out*1000/((reserveOut-out)*997))+1. The backend rejects out >= reserveOut, matching the deployed VELTRIXAE library's additional guard. The pinned older Soroswap source traps on an exact-reserve denominator; the backend returns a structured no-route error instead. All token amounts remain bigint decimal strings with i128 intermediate limits.

The original upstream Rust aggregation remains unchanged. Multi-protocol pricing, split-route optimization, historical analytics and USD pricing require additional validated data/models. No substitute liquidity, invented contract IDs, delegated user signing or live swap claim is introduced.

## Funding-readiness measurements — 2026-11-04

Quote attempts through the real `StellarChain` and public Testnet RPC, with discovery narrowed to one funded public Soroswap pool, went from 0 of 12 successful (median 21.7 s) to 17 of 20 (median 11.8 s). See [the baseline log](evidence/quote-liveness-baseline-2026-11-04.txt) and [the final report](evidence/testnet-verification-2026-11-04.json). This is one client, one pool and one period of RPC latency; it is not a throughput benchmark. The changes are concurrent read-only checks, one-call code verification, cached immutable pool identity and same-ledger parity on fresh reserves. A seeded fuzz of 400,000 exact-output cases found 2 inputs that fail the pair's own constant-product check, and those routes are now excluded.
