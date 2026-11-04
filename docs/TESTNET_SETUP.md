# Testnet setup

Use Node 22 or newer. For API development:

```sh
npm ci --ignore-scripts
cp .env.example .env
npm run lint
npm run build
npm test
npm start
```

The server binds 127.0.0.1:3000 by default. Set HOST=0.0.0.0 in a container. GET /api/v1/health reports process liveness; GET /api/v1/network/status checks Testnet RPC freshness; GET /api/v1/readiness reports observed deployment, liquidity and aggregator gates. Set CORS_ORIGINS to the exact frontend origin, for example http://localhost:5173. Wildcards and URL paths are rejected.

## Configuration

| Variable | Default | Constraint/purpose |
| --- | --- | --- |
| HOST | 127.0.0.1 | Listen address |
| PORT | 3000 | Integer 1–65535 |
| RPC_URL | https://soroban-testnet.stellar.org | HTTPS, no user/password/query/fragment; network passphrase must be Testnet |
| RPC_TIMEOUT_MS | 10000 | 100–15000 ms per SDK request and maximum queue wait |
| RPC_CONCURRENCY | 5 | 1–10 concurrent transport operations; at most 64 queued |
| DEPLOYMENTS_FILE | config/testnet.json | JSON manifest, relative to repository root or absolute mount path |
| CORS_ORIGINS | empty | Comma-separated exact origins; no credentials support |
| TRUSTED_PROXIES | empty | Comma-separated proxy IPs or CIDR ranges allowed to set X-Forwarded-For. Empty trusts none, so behind a proxy all clients share one rate limit. Never list untrusted networks, because forged headers would then evade limits |
| MAX_DISCOVERY_POOLS | 1000 | 1–1000; complete factory enumeration must fit this cap |
| DISCOVERY_PAGE_SIZE | 5 | 1–20 indexed all_pairs calls per discovery batch; global RPC limiter still applies |
| DISCOVERY_TIMEOUT_MS | 15000 | 100–15000 ms discovery, snapshot and metadata collection budget; no new batches after expiration |
| RUN_TESTNET_TESTS | 0 | Set 1 only for read-only live integration tests |
| TEST_TOKEN_IN / TEST_TOKEN_OUT | unset | Actual token contract IDs with a funded route for opt-in quote parity |
| TEST_AMOUNT | 10000 | Integer base units used by the optional live quotation test |

The checked-in manifest now references the verified VELTRIXAE Factory and Router deployed November 2, 2026. It leaves the separate aggregator null and has no invented asset entries. See [completed source manifest](evidence/contracts-testnet-deployment-2026-11-02.json) and [contract integration](CONTRACT_INTEGRATION.md). Testnet resets or code upgrades invalidate that evidence; reverify before use.

```sh
npm run verify:deployment
RUN_TESTNET_TESTS=1 npm run test:rpc
npm run evidence:testnet -- --trials 10
```

All three are read-only. Public RPC latency varies widely, so a single timeout is not proof of a deployment problem: `verify:deployment` exits non-zero when the deployment fails or liquidity could not be observed, and prints the reason.

The Factory was empty at verification. Empty pools/tokens are expected, quotes return NO_LIQUIDITY, and swaps/prepare returns NOT_CONFIGURED until a separate verified aggregator exists. Pool creation/liquidity funding and aggregator deployment require separately scoped operator authorization. These commands never perform them.

## Discovery limits

The Factory exposes all_pairs_length and all_pairs(u32), not an RPC cursor. The backend enumerates bounded index batches, caches IDs for 60 seconds, and collects fresh reserves for every completed snapshot. It never labels a truncated list a complete routing universe. POOL_LIMIT and DISCOVERY_TIMEOUT explain workload limits; INCONSISTENT_STATE requires refreshing rather than combining observations from different ledgers. Raising the pool cap cannot make a large factory fit one ledger. Use a reviewed indexer or atomic on-chain read design when complete fresh collection cannot fit the budget.

## Docker

```sh
docker build -f api/Dockerfile -t veltrixae-api .
docker run --rm -p 3000:3000 -e CORS_ORIGINS=http://localhost:5173 veltrixae-api
```

The runtime image uses the node user, production dependencies, an explicit host and a liveness health check. Mount a replacement reviewed manifest read-only and set DEPLOYMENTS_FILE if needed. No keys belong in the image, manifest, API requests or frontend backend calls. Use gateway/TLS controls and per-deployment rate limits for public hosting.

Rust contract checks retain the pinned upstream toolchain (1.84), separate SDK 29 host toolchain (1.99.1), submodules and actual WASM. Use bash scripts/setup.sh and npm run test:contracts. The standalone Contract AMM repository uses its own toolchain and Stellar CLI 28+; do not confuse it with the pinned upstream aggregator build.

Discovery IDs can lag new pool registration by up to their 60-second TTL; token metadata can lag by five minutes. These caches are bounded by the configured pool/asset universe. Reserve values and completed quotes are never reused through a positive TTL. Every quote is indicative and selected-route parity/freshness must pass before it is returned.
