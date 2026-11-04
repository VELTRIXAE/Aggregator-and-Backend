# API contract

Base path `/api/v1`. OpenAPI JSON is served at `/api/v1/openapi.json` and exported to `docs/openapi.json` with `npm run docs:api`. Amounts/reserves are decimal integer strings; times are Unix milliseconds. IDs are checksummed Soroban addresses; transaction hashes are 64 hexadecimal characters. Responses below are wrappers around the exported frontend TypeScript interfaces in `packages/frontend-client/src/index.ts`.

| Method/path | Response |
| --- | --- |
| GET /health | {status, service, network} liveness only |
| GET /readiness | Readiness with observed network, deployment, liquidity and aggregator gates, plus blockers |
| GET /tokens | {tokens: Token[]} with symbol/name/decimals/optional asset and metadata-only verification |
| GET /pools | Snapshot {pools, ledger, observedAt} |
| GET /pools/:id | {pool: Pool}, 404 when absent from verified factory |
| GET /markets | {ledger, observedAt, markets: Market[]} with raw rational reserve ratios |
| POST /quotes | Quote with routes, selectedRoute, bounds, fees, expiry and ledger |
| POST /swaps/prepare | PreparedSwap containing fresh quote, unsigned transactionXdr, resourceFee, totalFee and simulation ledger |
| GET /routes | Same Quote; request fields are query parameters |
| GET /transactions/:hash | TransactionStatus with finalized, ledger, XDR metadata and explorer URL |
| GET /network/status | NetworkStatus with latest sequence/closeTime and configuration flags |
| GET /analytics/overview | Overview with current counts and null historicalVolume/tvlUsd |

Quote body: `{tokenIn, tokenOut, amount, kind?, slippageBps?, maxHops?}`. kind is exactIn (default) or exactOut. maxHops defaults to 3, slippageBps to 50. Unknown fields, identical tokens, invalid checksums, decimal/negative/scientific amounts and invalid ranges return 400. No endpoint accepts a wallet secret.

Quote includes network, kind, tokenIn/out, amountIn/out, minimumReceived, maximumInput, slippageBps, routes, selectedRoute, ledger, observedAt, expiresAt, executable=false and networkFee=null. Route includes token path, pool IDs, protocol, amountIn/out, per-hop fees and priceImpactBps. Pool includes id/protocol/token0/token1/reserve0/reserve1/feeBps/ledger/observedAt.

Errors use `{error:{code,message}}`. 400 INVALID_REQUEST; 404 POOL_NOT_FOUND or NOT_FOUND; 422 NO_LIQUIDITY, ROUTE_LIMIT or amount limits; 429 RATE_LIMITED; 503 NOT_CONFIGURED, WRONG_NETWORK, CONTRACT_NOT_FOUND, CONTRACT_MISMATCH, RPC_UNAVAILABLE, CONTRACT_INVOCATION_FAILED, INVALID_CHAIN_DATA, INCONSISTENT_STATE, STALE_STATE (including reserves that moved after the quote), QUOTE_MISMATCH (router and local math disagree on one ledger) or SERVICE_BUSY; 504 REQUEST_TIMEOUT, RPC_TIMEOUT or DISCOVERY_TIMEOUT. Unexpected errors are logged server-side with a generic 500 response. Never reinterpret RPC failures as empty markets.

Transaction status is SUCCESS, FAILED or NOT_FOUND. SUCCESS/FAILED are finalized and contain result/meta XDR. NOT_FOUND is not proof of rejection: it may be pending, unknown or outside RPC retention. Poll with cancellation and bounded attempts. Network configuration flags indicate presence of config, not successful deployment verification.

Swap preparation body is `{quote: QuoteRequest, publicKey: string}` with an Ed25519 public account, never a secret. The server computes a fresh quote, validates deployments/router parity and simulates the aggregator invocation. Response: `{network, aggregator, quote, transactionXdr, resourceFee, totalFee, ledger, requiresWalletSignature:true, submitted:false}`. Fees are stroop integer strings from simulation. RESTORATION_REQUIRED and SWAP_SIMULATION_FAILED return 422. The source account must exist and have sufficient balances. The wallet must decode and review the contract, limits, auth entries, fees and deadline, sign and submit itself. Simulation success is not execution finality. HTTP responses carry Cache-Control: no-store.

The existing /pools endpoint returns a complete bounded snapshot, not a paginated/truncated routing universe. Operators configure discovery batches and caps through the environment; exceeding them returns POOL_LIMIT or DISCOVERY_TIMEOUT. Empty pools/tokens are valid for the currently deployed empty VELTRIXAE Factory. Quotes return NO_LIQUIDITY until funded routes exist. The absent separate aggregator yields NOT_CONFIGURED for swap preparation. Read simulations requiring archived-state restoration return RESTORATION_REQUIRED without submitting a restore transaction.

Readiness reports `mainnetEnabled:false`, `custody:'none'` and `submitsTransactions:false`, and its `blockers` are `NETWORK_UNVERIFIED`, `AMM_NOT_CONFIGURED`, `AMM_UNVERIFIED`, `NO_POOLS`, `NO_FUNDED_POOLS` or `AGGREGATOR_NOT_DEPLOYED`. `liquidity.status` is `funded`, `unfunded`, `empty` or `unknown`. When a read times out or spans ledgers, liquidity is `unknown` with its error in `liquidity.code`, never `empty`. It returns 200 even with blockers, so check the fields rather than the status. It can be slower than other endpoints, since it runs full deployment verification and a snapshot.
