# API contract

Base path `/api/v1`. OpenAPI JSON is served at `/api/v1/openapi.json`. Amounts/reserves are decimal integer strings; times are Unix milliseconds. IDs are checksummed Soroban addresses; transaction hashes are 64 hexadecimal characters. Responses below are wrappers around the exported frontend TypeScript interfaces in `packages/frontend-client/src/index.ts`.

| Method/path | Response |
| --- | --- |
| GET /health | {status, service, network} liveness only |
| GET /tokens | {tokens: Token[]} with symbol/name/decimals/optional asset and metadata-only verification |
| GET /pools | Snapshot {pools, ledger, observedAt} |
| GET /pools/:id | {pool: Pool}, 404 when absent from verified factory |
| GET /markets | {ledger, observedAt, markets: Market[]} with raw rational reserve ratios |
| POST /quotes | Quote with routes, selectedRoute, bounds, fees, expiry and ledger |
| GET /routes | Same Quote; request fields are query parameters |
| GET /transactions/:hash | TransactionStatus with finalized, ledger, XDR metadata and explorer URL |
| GET /network/status | NetworkStatus with latest sequence/closeTime and configuration flags |
| GET /analytics/overview | Overview with current counts and null historicalVolume/tvlUsd |

Quote body: `{tokenIn, tokenOut, amount, kind?, slippageBps?, maxHops?}`. kind is exactIn (default) or exactOut. maxHops defaults to 3, slippageBps to 50. Unknown fields, identical tokens, invalid checksums, decimal/negative/scientific amounts and invalid ranges return 400. No endpoint accepts a wallet secret.

Quote includes network, kind, tokenIn/out, amountIn/out, minimumReceived, maximumInput, slippageBps, routes, selectedRoute, ledger, observedAt, expiresAt, executable=false and networkFee=null. Route includes token path, pool IDs, protocol, amountIn/out, per-hop fees and priceImpactBps. Pool includes id/protocol/token0/token1/reserve0/reserve1/feeBps/ledger/observedAt.

Errors use `{error:{code,message}}`. 400 INVALID_REQUEST; 404 POOL_NOT_FOUND; 422 NO_LIQUIDITY, ROUTE_LIMIT or amount limits; 429 RATE_LIMITED; 503 NOT_CONFIGURED, WRONG_NETWORK, CONTRACT_NOT_FOUND, CONTRACT_MISMATCH, RPC_UNAVAILABLE, CONTRACT_INVOCATION_FAILED, INVALID_CHAIN_DATA, INCONSISTENT_STATE, STALE_STATE, QUOTE_MISMATCH or SERVICE_BUSY; 504 REQUEST_TIMEOUT. Unexpected errors are logged server-side with a generic 500 response. Never reinterpret RPC failures as empty markets.

Transaction status is SUCCESS, FAILED or NOT_FOUND. SUCCESS/FAILED are finalized and contain result/meta XDR. NOT_FOUND is not proof of rejection: it may be pending, unknown or outside RPC retention. Poll with cancellation and bounded attempts. Network configuration flags indicate presence of config, not successful deployment verification.
