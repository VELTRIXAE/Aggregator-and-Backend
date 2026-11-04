# SCF technical evidence summary

For a Stellar Community Fund application. Observed 2026-11-04 on Stellar Testnet. SCF states that no external materials are considered, so **copy what you need into the submission** rather than relying on these links alone. Most links are pinned to commit `90b9d87`.

## Status

**VELTRIXAE currently has zero pools and no executable swaps.** It is Testnet only, with no users or volume and no independent audit. The AMM derives from [Soroswap Core](https://github.com/soroswap/core), and the aggregator contracts are unmodified [Soroswap Aggregator](https://github.com/soroswap/aggregator).

## Deployed contracts

| Contract | Testnet ID | Code SHA-256 |
| --- | --- | --- |
| Factory | `CCBE2WCHO5PY6WVXTKZLIZA446M43RTOVD4S6XZYHPHJEL7K33LHW6RA` | `469d6366…3afa0` |
| Router | `CDSNTA4DH5CXDJJMY4QQ6IUF2M3VLR2WVPCL3UUQMCVUDQ5ZHVYWUZA4` | `4c1edf7f…b8c17` |
| Pair (code only, no instances) | n/a | `26c28c1a…915ad` |

This is an **older build than VELTRIXAE/Contract `main`**, and `main` has not been deployed. Its recorded source commit is not on any Contract branch or tag, so reviewers can't yet rebuild it from that repository.

## Evidence

| Claim | Result | File |
| --- | --- | --- |
| Deployment record and manifest | Contract IDs and hashes | [record](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/evidence/contracts-testnet-deployment-2026-11-02.json), [manifest](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/config/testnet.json) |
| Seven deployment receipts | All `SUCCESS` on-chain, and decoded operations match the record | [receipts](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/evidence/contracts-testnet-completion-2026-11-02.json), [comparison](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/evidence/testnet-plan-simulation-2026-11-04.json) |
| Live state | Hashes match, Router linked to Factory, 0 pools | [report](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/evidence/testnet-verification-2026-11-04.json) |
| Quote math | 20 of 20 matched a live router, 17 on one ledger. **Public Soroswap pools, not VELTRIXAE** | [report](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/evidence/testnet-verification-2026-11-04.json) |
| Live quote path | 17 of 20 succeeded, 3 failed closed, up from 0 of 12. **One public Soroswap pool, one client** | [report](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/evidence/testnet-verification-2026-11-04.json), [baseline](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/evidence/quote-liveness-baseline-2026-11-04.txt) |
| Aggregator with the deployed WASM | 7 passing tests: pool creation, both swap types, limits, authorization. **Local test host, not live** | [tests](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/contract-tests/src/rehearsal.rs) |
| No custody, Testnet only | Tests fail the build on signing, submission, mainnet access or a tracked secret | [tests](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/api/test/safety.test.ts), [security](../SECURITY.md) |
| Backend gates | Quotes and swap preparation refuse until each condition holds | [chain](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/api/src/chain.ts), [routing](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/api/src/routing.ts) |
| Test suite and CI | 70 unit tests and 161 contract tests pass | [workflow](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/.github/workflows/ci.yml), [testing record](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/TESTING.md) |

## Architecture and plan

- [Architecture](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/ARCHITECTURE.md) and [API](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/API.md)
- [Testnet plan](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/TESTNET_LIVE_PLAN.md): gated and **not executed**
- [Roadmap](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/ROADMAP.md)

## Disclosures to include

- [Open risks](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/FUNDING_EVIDENCE.md), including what must not be claimed
- [License conflicts](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/LICENSE_REVIEW.md): unresolved
- [Rust advisories](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/RUST_ADVISORIES.md): two outstanding, neither in contract WASM
- [Upstream attribution](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/docs/UPSTREAM_ATTRIBUTION.md) and [NOTICE](https://github.com/VELTRIXAE/Aggregator-and-Backend/blob/90b9d8728dae179baae4a7d15da2c6ece1e9803b/NOTICE)

## Gaps against the Build Award criteria

Address these directly in the application:

| Criterion | Current position |
| --- | --- |
| Significant traction or a clearly validated need | **Not shown.** No users or usage |
| Unique or meaningfully differentiated | **Not shown.** Soroswap already provides an aggregator |
| Final tranche is a Mainnet launch | **Not planned yet.** Mainnet is disabled in code, and a decision is required |
| Plan to open-source the contracts | **Partial.** Repositories are public, but licensing is unresolved and the deployed source commit isn't on a Contract branch |
| Threat model and monitoring plan, due at tranche 2 | **Not written** |

## Reproduce

Read-only, with no key needed:

```sh
npm ci --ignore-scripts
npm run verify:deployment
npm run plan:simulate
npm run evidence:testnet -- --trials 20
```
