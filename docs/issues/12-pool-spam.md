# Stop pool spam from disabling quotes

## Problem

`create_pair` has no authorization. Anyone who creates enough pools to pass `MAX_DISCOVERY_POOLS` makes `snapshot()` fail with `POOL_LIMIT`, so every quote fails. It fails closed, which is safe, but it's a cheap denial of service on Testnet. Discovery reads every pool, so spam below the cap also makes quotes slower and more likely to time out.

## Scope

Stop scanning unrelated pools for each quote. Options include resolving only reviewed tokens through `get_pair`, or an indexer. Compare them and choose one. Linked to [issue 03](03-atomic-snapshots.md) and [issue 11](11-route-allowlist.md).

## Acceptance criteria

- Quotes between reviewed tokens keep working with more factory pools than the cap, shown by a test.
- A measured comparison of RPC calls and latency.
- Partial data is never presented as a complete market.
