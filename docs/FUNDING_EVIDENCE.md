# Funding evidence

What can and cannot be claimed about this backend, with a way to check each claim. Observed 2026-11-04 on Stellar Testnet. Live values change, so rerun the commands rather than relying on this page.

```sh
npm run verify:deployment                # read-only
npm run evidence:testnet -- --trials 20  # read-only, prints a report
```

Full output: [testnet-verification-2026-11-04.json](evidence/testnet-verification-2026-11-04.json).

## Current status

**VELTRIXAE currently has zero pools and no executable swaps.**

Do not claim otherwise, or any of the following, in an application or pitch:

- **No VELTRIXAE liquidity exists.** The Factory has 0 pools, so quotes return `NO_LIQUIDITY`.
- **No swap can execute and none ever has** through this system. The aggregator is not deployed, so swap preparation returns `NOT_CONFIGURED`. The local rehearsal below is not a live swap.
- **No quote has been produced from a VELTRIXAE pool.** Quote results below come from public Soroswap Testnet pools.
- **No mainnet deployment exists,** and mainnet is disabled in code.
- **No independent security audit covers VELTRIXAE contracts or this backend.** Audit reports in the upstream tree cover upstream versions and scope only.
- **No users, volume, TVL or revenue** are measured. The API reports these as unavailable.
- **The AMM is not an original design.** It derives from Soroswap Core and, in design, Uniswap V2.

## Demonstrated

| Claim | Result | How to check |
| --- | --- | --- |
| Factory and Router are deployed on Testnet with the manifest's code | `CCBE2WCH…` and `CDSNTA4D…`: observed SHA-256 equals the manifest for both | `npm run verify:deployment` |
| Router is linked to that Factory | `get_factory` returns the Factory | Same |
| Pair code is uploaded | Observed hash equals the manifest. No instance exists to show it running | Evidence report |
| The deployment receipts are real | 7 of 7 recorded transactions are `SUCCESS` on-chain, and each one's ledger, fee and source account match the record, within RPC retention at the time of checking | `npm run plan:simulate` |
| Deployed code matches its source | The Factory, Router and Pair rebuild **byte-for-byte** from commit `133b18d`, using a CLI optimizer of 23.3.0 or newer | [Reconciliation](DEPLOYMENT_RECONCILIATION.md) |
| The aggregator works with the deployed contracts, locally | 7 tests in the Soroban test host run the exact deployed WASM: pool creation, exact-in and exact-out at the backend's quote, limits and authorization. **No network was involved** | `npm run test:contracts` |
| Local quote math matches a live router | 20 of 20 comparisons against the public Soroswap router, 17 of them with reserves on the same ledger, covering exact input and exact output in one direction of one pool | Evidence report |
| The real quote path works on the public RPC | 17 of 20 attempts returned a quote validated by the router on one ledger; the other 3 failed closed with `STALE_STATE`. Median 11.8 s, maximum 20.9 s, narrowed to one funded public pool | Evidence report |
| Empty state is reported honestly | `/readiness`: deployment verified, liquidity empty, blockers `NO_POOLS` and `AGGREGATOR_NOT_DEPLOYED` | `GET /api/v1/readiness` |
| Transactions are assembled unsigned | Real RPC simulation from a public account returned an unsigned Testnet transaction with the expected time bound. This used a read-only router call, not a swap | Unit test, plus a one-off probe |
| No custody and no mainnet path | Enforced by tests that fail the build | `api/test/safety.test.ts` |

Quote success before this work was **0 of 12** ([log](evidence/quote-liveness-baseline-2026-11-04.txt)): funding a pool would not have made the API work. Parity was measured against Soroswap's router, not VELTRIXAE's, so it should be repeated on the first funded VELTRIXAE pool.

The public Soroswap Testnet factory reports 628 pools, of which a sample was read. It is used only as a reference, is not VELTRIXAE liquidity, and is never configured here.

## Open risks

| Risk | Detail | Owner |
| --- | --- | --- |
| **Pair code expiry** | Pair WASM is live until ledger 5,631,435, about 4.2 days after the 2026-11-04 check, so around November 8–9. Pool creation may then need a restore. Factory and Router entries last about 27 days. Extending TTL is a state-changing transaction and was not done. See [Phase A](TESTNET_LIVE_PLAN.md#phase-a-keep-the-existing-contracts-alive--write) | Maintainer approval |
| **Deployed source is not public** | Commit `133b18d` is not reachable from any branch of VELTRIXAE/Contract. It exists only in `docs/evidence/contracts-deployment-work.bundle`. It reproduces the deployed code, but outsiders need the bundle to check that | Maintainer |
| **Deployed code is behind `main`** | Contract `main` has since changed the contracts substantially, including atomic initialization and exact-output rounding. The Testnet deployment does not have those fixes | Maintainer decision |
| **Conflicting records** | Several VELTRIXAE/Contract documents say no deployment evidence is available, while this repository holds on-chain receipts. The cause and the corrections are in the [reconciliation](DEPLOYMENT_RECONCILIATION.md) | Maintainer |
| **Licensing** | [Unresolved conflicts](LICENSE_REVIEW.md#decisions-and-who-makes-them) between Apache-2.0, GPL-3.0, AGPL-3.0 and MIT declarations. The review lists each decision and its owner | Maintainer, rights holders and counsel |
| **Rust advisories** | Two are outstanding, and neither appears in contract WASM: RUSTSEC-2026-0387 and RUSTSEC-2026-0009. Neither is suppressed. No compatible fix is available for the first. Rust is not scanned in CI yet. See [Rust advisories](RUST_ADVISORIES.md) | Maintainer |
| **Quote reliability** | Measured with one pool from one client. Many pools will fail more often until [atomic snapshots](issues/03-atomic-snapshots.md) exist | Contributors |
| **Swap preparation** | Its same-ledger check is expected to reject most real attempts ([issue draft 01](issues/01-prepare-swap-ledger-check.md)), and its 15-second window is short for a person ([issue draft 02](issues/02-execution-deadline.md)). Neither can be measured without an aggregator | Contributors |

## Project history

- [Funding checklist](FUNDING_CHECKLIST.md) and [SCF technical evidence](SCF_TECHNICAL_EVIDENCE.md)
- [Testnet plan](TESTNET_LIVE_PLAN.md), [roadmap](ROADMAP.md) and [contributor issue drafts](issues/README.md)
- [Deployment reconciliation](DEPLOYMENT_RECONCILIATION.md) and [Rust advisories](RUST_ADVISORIES.md)
- [Backend audit](BACKEND_AUDIT.md), [testing record](TESTING.md) and [original contributions](ORIGINAL_CONTRIBUTIONS.md)
- [Upstream attribution](UPSTREAM_ATTRIBUTION.md), [license review](LICENSE_REVIEW.md) and [NOTICE](../NOTICE)
