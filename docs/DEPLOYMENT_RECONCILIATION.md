# Deployment reconciliation

Compares this repository's deployment records with VELTRIXAE/Contract at `main` (`9ce68de`), checked 2026-11-04. Blockchain evidence is unchanged: this only compares it. Evidence files are protected by `docs/evidence/SHA256SUMS`.

## Conclusion

**The Factory and Router are deployed and verifiable. Contract's documents do not know about them.** The cause is that the deployment was run from a local branch whose push was rejected, so its commit and manifest never reached that repository. Contract's documents are careful about this, and say absence of records does not prove there was no deployment. Its statements describe its own checkout, and the two repositories can be reconciled without changing any evidence.

## What was checked

| Fact | Result | How |
| --- | --- | --- |
| Factory and Router on-chain code | SHA-256 matches the manifest | `npm run verify:deployment` |
| Pair code on-chain | SHA-256 matches the manifest | `npm run plan:simulate` |
| Seven receipts | All `SUCCESS`, and status, ledger, fee and source account each match the record | `npm run plan:simulate` |
| Fee total | 97,114,662 stroops recorded. The deployer's balance of 9,990.2885338 XLM is exactly 10,000 minus that | Public account data. That the account began with 10,000 XLM is inferred from the usual Friendbot amount |
| Source commit | `133b18d` is in the preserved bundle and descends from public commit `c834dbe`. It is **not** on any public branch | `git` |
| Build reproducibility | **Byte-identical** rebuild of all three contracts from `133b18d` | Commands below |
| Factory and Router link, fee setter | Router's factory is the Factory; the setter is the deployer account | Simulation |
| Pools | 0 | `all_pairs_length` |

## Statements that conflict

| Contract document | It says | Evidence here | Action for Contract |
| --- | --- | --- | --- |
| `docs/TESTNET_VERIFICATION.md` | "Project deployment evidence: NOT VERIFIED"; the maintainer confirmed no IDs or hashes are available | IDs, hashes and receipts exist and check out on-chain | Link the evidence, and replace the status with what is verified |
| `deployments/README.md` | No record is present, so there is no `testnet.json` | A complete manifest is in `docs/evidence/contracts-testnet-deployment-2026-11-02.json` | Explain the older deployment and link evidence copies |
| `docs/DEPLOYMENT.md` | Scripts not yet exercised against the network, and no verified IDs | The deployment ran from an earlier version of those scripts. Today's constructor flow still has not run | Separate the two statements |
| `CHANGELOG.md` | "No contracts have been deployed from this repository yet" | Deployed from `133b18d`, a local branch of it | Correct once the commit is public |
| `docs/review/PR9_REMEDIATION.md`, `PR_SUMMARY.md`, `VERIFICATION_RESULTS.md` | Deployment is not verified | As above | Leave these as dated history. Add a pointer if needed |

## Statements that stay true

These do not conflict and should not be weakened:

- Contract's current constructor-based deployment has never been run live.
- Existing immutable deployments are not retroactively fixed by Contract `main`. They lack its constructors and exact-output rounding fix.
- The AMM is unaudited, and licensing is unresolved.
- Contract `main`'s code differs from what is deployed, so **the deployment must not be described as `main`**.

## Actions on VELTRIXAE/Contract

Maintainer decisions, 2026-11-04:

| Action | Decision |
| --- | --- |
| Correct Contract's documents and add evidence copies, in a documentation-only PR | **Approved.** Not yet opened, because it needs a maintainer's write access |
| Publish commit `133b18d` on Contract | **Not approved**, pending review of author metadata and licensing |
| Extend the Pair WASM TTL | **Not approved** |

Evidence copies belong in `docs/evidence/testnet-2026-11-02/` rather than `deployments/testnet.json`: Contract's scripts act on that directory, and its deploy script refuses to overwrite a manifest. Copies must stay byte-for-byte identical. Until the commit is on Contract, say that the build can't be reproduced from that repository alone.

## Reproduce the deployed build

```sh
git clone https://github.com/VELTRIXAE/Contract.git && cd Contract
git fetch /path/to/docs/evidence/contracts-deployment-work.bundle work/testnet-deployment-readiness
git checkout --detach 133b18d00505108c26382cb44045abab48b51882
rustup target add wasm32v1-none --toolchain 1.99.1
cargo build --target wasm32v1-none --release --locked
for c in factory pair router; do
  stellar contract optimize --wasm target/wasm32v1-none/release/veltrixae_$c.wasm --wasm-out $c.wasm
  sha256sum $c.wasm
done
```

Expected, matching `config/testnet.json`:

| Contract | SHA-256 |
| --- | --- |
| Factory | `469d6366d0be2b431466c6530b9f2418c30d765ab9dcbf33cc51f7265d53afa0` |
| Router | `4c1edf7f3a7b9fa659f69c35e6803e95f4a3b4467c1ab1543e87147b7f9b8c17` |
| Pair | `26c28c1a76d1c4a2eee6db570be26424cfa16d3aa9de6a24ce2d27d346d915ad` |

The optimizer matters. On 2026-11-04, CLI releases 23.3.0 through 30.0.1 that were tried all reproduced these hashes. 22.8.1 and 23.2.1 did not, and neither did an unoptimized build. Expect a different result if toolchains change.
