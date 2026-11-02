# VELTRIXAE implementation plan

1. Inventory pinned upstream Rust contracts, nested protocols, interfaces, tests and deployment candidates; run baseline tests before contract changes.
2. Establish VELTRIXAE npm workspaces, Testnet-only configuration, branding and attribution without renaming on-chain interfaces.
3. Preserve upstream aggregator ABI and authorization; verify deployed WASM and active router configuration before enabling discovery.
4. Discover factory pools, validate identities and reserves, enumerate bounded single and multi-hop routes using checked integer arithmetic.
5. Provide exact-input/output indicative quotations, fee/impact/slippage bounds, expiration and router simulation comparison.
6. Complete isolated Fastify API, strict validation, errors, rate limits, CORS, timeouts and OpenAPI.
7. Supply typed frontend client, cancellation and transaction confirmation monitoring.
8. Prepare unsigned wallet operations and deployment manifest integration for veltrixae-contracts; never invent addresses.
9. Expand routing/API/chain/security tests, dependency audit and opt-in live Testnet verification.
10. Complete Codespaces, manual deployment, Docker, Dependabot and operational documentation.

Delivery uses at least 30 focused, nonempty commits. Keep upstream license files and gitlinks intact. No automatic deployment or mainnet enablement. No database until historical indexing is required. Unsupported/unverified protocols remain disabled.

## External prerequisites

The workspace has no veltrixae-contracts or veltrixae-frontend checkout and no verified VELTRIXAE contract IDs. Integration is through a reviewed manifest and typed client. Live swaps cannot be certified until deployments, ABI and liquidity pass verification. Record actual test outcomes in TESTING.md.

## Delivery status

| Milestone | Result |
| --- | --- |
| 1 inspection | Inventory and baseline results documented |
| 2 configuration | VELTRIXAE workspaces, Testnet-only manifest and development tooling |
| 3 compatibility | Preserved Rust ABI; byte-for-byte TypeScript encoding test from optimized WASM spec |
| 4 liquidity/routing | Verified Soroswap factory discovery and bounded integer multi-hop comparison |
| 5 quotations | Exact input/output, fees, impact, slippage, expiry and router parity checks |
| 6 API | Proposed endpoints plus unsigned swap preparation and OpenAPI export |
| 7 frontend | Typed client, cancellation, error handling and bounded confirmation polling |
| 8 contracts | Manifest integration and full unsigned simulation implemented; live VELTRIXAE deployment verification pending supplied IDs/artifacts |
| 9 security | API/client/routing tests, upstream Rust tests, WASM authorization tests, spec parity and dependency auditing |
| 10 operations/docs | Codespaces, manual Testnet deployment, Docker validation, Dependabot and requested documentation |

No protocol deployment is inferred from source presence. Live cross-protocol aggregation and external VELTRIXAE contract/frontend checkout integration remain conditional on reviewed artifacts and current Testnet liquidity. The shipped API prices Soroswap-compatible pools only. No deployment or Git push was performed.

Current-state update: the later authorized VELTRIXAE AMM deployment completed on 2026-11-02 and its verified Factory/Router configuration is active. The historical plan above predates that event. There are still no pools, separate aggregator or live swap verification.
