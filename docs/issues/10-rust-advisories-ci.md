# Add a Rust advisory scan to CI

## Problem

CI runs `npm audit` but nothing for Rust. A manual `cargo audit` on 2026-11-04 reported RUSTSEC-2026-0387 (`crypto-bigint` 0.5.5) in `contract-tests/Cargo.lock` and `upstream/soroswap/contracts/Cargo.lock`, and RUSTSEC-2026-0009 (`time` 0.3.36) in the upstream lockfile, plus unmaintained, unsound and yanked warnings. VELTRIXAE/Contract found no compatible upgrade for the first.

## Scope

Scan both lockfiles in CI. Determine which findings reach compiled contract WASM and which are test-host only. Any exception must be listed with its reason and a review date, never silently ignored. Do not change the upstream pin as part of this work.

## Acceptance criteria

- New advisories fail CI.
- Each current finding is either fixed or documented with evidence of reachability.
