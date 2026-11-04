# Support ordered RPC failover

## Problem

One `RPC_URL` is a single point of failure, and latency of public endpoints directly limits quote success. A snapshot must not mix observations from different providers, since they can be on different ledgers.

## Scope

Accept an ordered list of RPC URLs, each validated by the existing rules. Pin one provider per snapshot and quote, verify the Testnet passphrase for each, and report the failure of a provider without exposing its URL.

## Acceptance criteria

- Tests cover failover, a wrong-network provider being refused, and no mixing inside a snapshot.
- Documented in `docs/TESTNET_SETUP.md`.
