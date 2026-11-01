# Repository inspection

The original root commit contains an MIT LICENSE and minimal README. Existing uncommitted work adds a pinned Soroswap submodule and TypeScript service. This implementation continues that work rather than replacing it.

| Area | Location | Finding |
| --- | --- | --- |
| Upstream | upstream/soroswap | Git revision 84de10e0f8d26168b4a76f8c23b963e50917517c |
| Rust workspace | upstream/soroswap/contracts/Cargo.toml | Soroban SDK 22.0.7; checked release arithmetic |
| Aggregator | contracts/aggregator/src | initialize, admin, adapter/pause management, exact input/output distribution |
| Adapters | contracts/adapters and aggregator/src/adapters | Soroswap, Phoenix, Aqua, Comet; shared adapter interface |
| Factory/router | protocols/soroswap/contracts | Factory enumeration, pair reserves, router chained quote methods |
| Other protocols | protocols/phoenix-contracts, aqua, CometDEX | Nested gitlinks; Aqua remote unavailable in prior setup, bundled WASM preserved |
| TypeScript upstream | src, scripts, test | Upstream deployment/interaction tools use yarn; left intact |
| App API | api/src | Separate Node/TypeScript/Fastify service, no replacement of Rust |
| Routing | api/src/routing.ts | BigInt AMM model mirrors pinned Soroswap library rounding |
| Frontend | packages/frontend-client | Typed fetch client and confirmation polling |
| Tests | contracts/**/src/test*, api/test | Authorization, swaps, pauses, routing, validation, RPC opt-in |
| Config | .env.example, config/testnet.json | Testnet only, HTTPS RPC, no private-key API environment variables |

Upstream adapters and aggregator include direct protocol contract imports. The API currently enables only the reviewed Soroswap ABI. Phoenix exact-output is unsupported by its adapter; Aqua and Comet require different pricing/discovery semantics. Their presence in source does not establish a live Testnet deployment.

The pinned historical Soroswap candidate is in protocols/soroswap/public/testnet.contracts.json. Live verification on 2026-11-01 returned CONTRACT_NOT_FOUND (missing or archived WASM). It must not be copied into the active manifest. Testnet resets invalidate old IDs.

No sibling veltrixae-contracts repository, frontend checkout, reviewed VELTRIXAE ABI artifact or deployment IDs are present. External integration remains conditional on those artifacts. No database/indexer exists or is needed for current-state discovery. Historical volume and USD TVL are unavailable.
