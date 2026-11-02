# Backend audit — 2026-11-02

Scope: API and frontend client source/tests, manifests/environment, Rust contract interfaces and pinned upstream, deployment tooling, Docker, CI/Dependabot and repository documentation. Existing functionality is retained. Deployment evidence from the preceding authorized session is included in this audit's baseline.

## Initial findings

| Finding | Evidence and consequence | Planned correction |
| --- | --- | --- |
| Deployment configuration is empty despite completed AMM deployment | config/testnet.json has null AMM; all pool/quote requests fail NOT_CONFIGURED | Verify/import the actual completed manifest and enable only the AMM |
| Hardcoded 100-pool discovery ceiling | chain.ts snapshot rejects larger factories; caller cannot configure workload | Validated bounded discovery settings and bounded pages, fail explicitly before partial results |
| Pool reads multiply concurrency | Five pool workers each launch four reads; simultaneous snapshots duplicate reserve work | Global transport concurrency/queue bound and coalesce concurrent snapshots without reusing completed reserves |
| Snapshot collection does not stop after HTTP timeout | Request race retains slot, but worker batches continue until all pools finish | Discovery/snapshot time budgets that stop scheduling new batches |
| Pair registration only verified during import | Runtime checks pair factory but not factory get_pair mapping | Verify registration on each fresh pool observation |
| Equal-price route choice depends on factory order | Sort only compares amounts and hop count; graph scans all pools per node | Indexed adjacency and deterministic tie break, measured counters and permutation regressions |
| Expiry boundary differs | quote accepts age exactly 15000 ms; validator rejects at expiresAt | Reject boundary consistently |
| Error envelopes differ for unknown routes | Fastify default 404 bypasses custom error shape | Structured NOT_FOUND response |
| Logs may retain RPC error request configuration | Generic error logger receives raw exception; configurable RPC URL permits credentials | Safe structured logs; reject credential/query-bearing RPC URLs |
| CI lacks explicit lint and offline integration stages | Builds/tests exist, but ABI tests are only under expensive contract job | Source hygiene check, offline ABI job step and explicitly opt-in live checks |
| Documentation is stale/incomplete | README says deployment incomplete; TESTNET_SETUP, ORIGINAL_CONTRIBUTIONS, CHANGELOG absent | Update actual status, environment/API contracts, evidence and limitations |
| Live execution prerequisites missing | Verified AMM has zero pools; separate aggregator absent | Clearly distinguish AMM verification from quote parity/full swap verification; no funding/deployment invented |

## Resolution

All planned corrections in the table were implemented and covered by focused regressions. The completed AMM manifest was activated only after live hash, ABI, fee-setter, Router link and empty-factory verification. No pool, liquidity, asset metadata or separate aggregator was invented. See TESTING.md for final results and ORIGINAL_CONTRIBUTIONS.md for measured algorithm changes.

## Baseline validation

TypeScript workspace builds pass. API unit/API test files pass in the sandbox; frontend test runner fails there without useful diagnostics and will be retried with required runtime permissions before diagnosing a product defect. All live checks are read-only. No user transaction signing, pool creation, funding or aggregator deployment is part of this audit.

Existing strengths: strict Zod/checksummed IDs, bigint/i128 pricing, direct/multi-hop exact input/output routes, router parity simulation, ledger/age checks, unsigned swap preparation, rate limits, exact CORS origins, Testnet network checks, code hash checks, RPC timeouts, no-store HTTP responses, mocked/live test separation, Dependabot, preserved attribution/licenses.
