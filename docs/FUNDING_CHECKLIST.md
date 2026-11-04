# Funding-readiness checklist

For GitHub Sponsors and the Stellar Community Fund. Checked 2026-11-04. Program rules change, so confirm them on the official pages before applying.

**Status: VELTRIXAE currently has zero pools and no executable swaps.**

## Verified accomplishments

Each can be rechecked. See [SCF technical evidence](SCF_TECHNICAL_EVIDENCE.md) for links.

- [x] Factory and Router are deployed on Testnet, with on-chain code matching the record
- [x] Seven deployment receipts are on-chain and decoded against the record
- [x] Deployed WASM rebuilt byte-for-byte from its recorded commit
- [x] Backend works against real funded public pools: 17 of 20 live quotes, up from 0 of 12
- [x] Quote math matched a live router in 20 of 20 comparisons, on public Soroswap pools
- [x] Aggregator works with the exact deployed WASM in a local test host
- [x] No custody and Testnet only, enforced by build-failing tests
- [x] 81 unit tests and 161 contract tests pass, and CI passes on `main`
- [x] Evidence files are checksum-pinned
- [x] Clients can check prepared transactions before a wallet prompt (tested with mocks and the real encoder, not a deployed aggregator)
- [x] CI scans Rust dependencies and fails on any new advisory
- [x] Threat model and monitoring plan are written (not independently reviewed, and monitoring isn't automated)
- [x] Roadmap, security, license and risk disclosures are published
- [x] Soroswap attribution is preserved

## Outstanding work

### Needs a maintainer

- [ ] Turn on private vulnerability reporting for this repository, `Contract` and `frontend`, then update `SECURITY.md`
- [ ] Apply the Contract documentation patch and review its PR
- [ ] Decide how the deployed source commit is made available
- [ ] Add a repository description
- [ ] Publish the [issue drafts](issues/README.md) as real issues, so outsiders can contribute
- [ ] Publish a private contact for conduct and security reports, and assign a monitoring owner

### Needs legal or rights-holder input

- [ ] Get written license clarification from Soroswap
- [ ] Get counsel's view on the [open license questions](LICENSE_REVIEW.md#decisions-and-who-makes-them)

### Needs explicit approval for a Testnet transaction

Not approved or executed. See the [Testnet plan](TESTNET_LIVE_PLAN.md).

- [ ] Extend the Pair WASM TTL (expiry estimated 2026-11-08, about 23:33 UTC). Pool creation may need a restore afterward
- [ ] Create a test asset and the first pool
- [ ] Deploy the aggregator, after the license decision
- [ ] Complete one wallet-signed Testnet swap

### Engineering

- [ ] Settle [swap preparation's ledger check](issues/01-prepare-swap-ledger-check.md) and [signing window](issues/02-execution-deadline.md)
- [ ] Close the [route allowlist](issues/11-route-allowlist.md) and [pool spam](issues/12-pool-spam.md) gaps from the [threat model](THREAT_MODEL.md)
- [ ] Resolve the [two outstanding Rust advisories](RUST_ADVISORIES.md), which depends on upstream
- [ ] Automate the [monitoring plan](MONITORING_PLAN.md)
- [ ] Measure quote reliability beyond one pool
- [ ] Arrange an independent security review

## GitHub Sponsors

The best fit today. Sponsors supports open-source contributors, and doesn't depend on live liquidity.

Requirements from GitHub's documentation:

- [ ] Contribute to open source: **met**, see the public repositories
- [ ] Live in a supported region: **check**, since it can't be verified from the repository
- [ ] Enable two-factor authentication: **check**
- [ ] Apply as an individual: **recommended**. An organization needs an invitation or the waitlist
- [ ] Choose payouts, Stripe Connect or a fiscal host. A fiscal host can only be chosen at signup
- [ ] Submit the tax form: W-9 or W-8BEN for an individual
- [ ] Complete the profile, then request approval
- [ ] After approval, add `.github/FUNDING.yml`

Use the open-source work, tests, verified deployment and disclosures. Describe the funded work as maintenance and the items in this checklist, not as a live product.

## Stellar Community Fund

**Not ready for the Build Award yet.** The awards page lists SCF #46 as closing 2026-11-09, and its interest stage alone is listed at about two weeks, so plan for a later round unless already invited.

- [ ] Submit the interest form
- [ ] Show significant traction or a validated need: **not met**
- [ ] Show the project is unique or meaningfully differentiated: **not met**
- [ ] Define three tranches with costs and verification, ending in a Mainnet launch: **not met**. Mainnet is disabled, so this needs a decision
- [ ] Supply a complete architecture and Stellar integration: **available**
- [ ] Include a plan to open-source the contracts: **partial**, pending licensing and the source decision
- [ ] Keep the budget to development costs, excluding audits and marketing
- [ ] Map the [threat model](THREAT_MODEL.md) and [monitoring plan](MONITORING_PLAN.md) to SCF's current templates for tranche 2: **drafts exist**
- [ ] Copy evidence into the submission, since external materials are not considered

The first real pool and verified quotes on the VELTRIXAE router would be the strongest addition.

The Public Goods Award needs an SCF Pilot role or higher and usage by ecosystem teams, and its listed categories don't obviously include an aggregator. It isn't a current fit.

## Evidence by program

| Evidence | Sponsors | SCF |
| --- | --- | --- |
| Open-source work, tests, CI, documentation | Use | Use as support |
| Testnet code hashes and seven receipts | Use | Use |
| Safety gates, no custody | Use | Use |
| Roadmap and disclosures | Use | Use |
| Quote math and live quote results | Optional, label as public Soroswap pools | Use, label as public Soroswap pools |
| Local rehearsal | Optional, label as local | Use, label as local |
| Byte-identical rebuild | Say it can't yet be reproduced from Contract | Same |
| Contract repository records | Only after its PR merges | Only after its PR merges |

## Do not claim

Liquidity, executable or completed swaps, users, volume, TVL, an audit, mainnet readiness, resolved licensing, or an original AMM design. Don't describe the deployed build as Contract `main`.

Sources: [Sponsors for individuals](https://docs.github.com/en/sponsors/receiving-sponsorships-through-github-sponsors/setting-up-github-sponsors-for-your-personal-account), [Sponsors for organizations](https://docs.github.com/en/sponsors/receiving-sponsorships-through-github-sponsors/setting-up-github-sponsors-for-your-organization), [SCF awards](https://communityfund.stellar.org/awards), [Build Award criteria](https://stellar.gitbook.io/scf-handbook/scf-awards/build-award/submission-criteria), [Public Goods rules](https://stellar.gitbook.io/scf-handbook/supporting-programs/public-goods-award/official-rules).
