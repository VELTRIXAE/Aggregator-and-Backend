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
