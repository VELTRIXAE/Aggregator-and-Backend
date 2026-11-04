# Read pool state atomically with getLedgerEntries

## Problem

Code hashes are already verified in one `getLedgerEntries` call (`StellarTransport.codeHashes`), but reserves are still read through one simulation per pool. Reserve reads across pools must land on one ledger, so a snapshot larger than one batch of pools is increasingly likely to fail with `INCONSISTENT_STATE` on a slow RPC. Quote success has only been measured with a single pool.

Pair reserves, tokens and factory are instance storage (`DataKey` in the deployed `contracts/pair/src/storage.rs`), and those entries are already being fetched. One call could therefore verify and read many pools at the same ledger.

## Scope

Extend that call to return instance storage, and decode reserves only for pools whose hash matches the manifest, because the storage layout is only known for that code. Router parity keeps catching a wrong decoding.

## Acceptance criteria

- Decoding is tested against real instance XDR, and checked against `get_reserves` on real funded pools.
- Unknown layouts and hash mismatches fail closed.
- Measured RPC calls, success rate and latency at 1, 5, 20 and 100 pools.
