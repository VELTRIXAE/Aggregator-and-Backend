# Liquidity aggregation

The enabled API adapter is the pinned Soroswap constant-product ABI. Factory methods `all_pairs_length` and `all_pairs(u32)` discover up to 100 pools. Pair methods `token_0`, `token_1`, `factory`, `get_reserves` expose identities and reserves. Router `get_factory` must match the configured factory. Factory, router and every pair WASM must match reviewed SHA-256 hashes.

Discovery coalesces concurrent loads and caches successful IDs for 60 seconds. Reserves are never served from that cache. Pool reads must agree on one latest ledger and timestamps must remain current. Archived state, invocation failures and RPC errors are not reported as absent liquidity. Duplicate pools, malformed amounts and mismatched identities fail closed.

Soroswap is the only API-priced protocol at present. Upstream Rust retains Phoenix, Aqua and Comet. No verified VELTRIXAE or current Soroswap Testnet deployments have been supplied. Historical candidates are checked through `npm run check:upstream`; this command never modifies active config. The official upstream README also warns that Phoenix uses custom testing deployments rather than an official Testnet deployment: https://github.com/soroswap/aggregator.

Multiple pools and paths are compared within the verified factory. Cross-protocol price comparison and split-route optimization are not enabled. Adding them requires protocol-specific pool discovery, exact arithmetic, execution ABI tests and reviewed active deployments. Token verification means only on-chain metadata retrieval; asset issuer association additionally requires the configured classic asset to derive to the Testnet token contract.
