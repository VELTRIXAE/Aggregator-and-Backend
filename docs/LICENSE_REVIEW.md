# License review

Engineering inventory, reviewed 2026-11-04 against the pinned submodules. This records what the repositories declare. It is not legal advice and does not settle distribution rights. Nothing here changes a license or notice.

## What each component declares

| Component | How it is included | License file | Manifest declaration |
| --- | --- | --- | --- |
| VELTRIXAE API, client, tests, docs | Original files in this repository | MIT (`LICENSE`) | MIT (`contract-tests`, root `package.json`) |
| Soroswap Aggregator contracts | Submodule `upstream/soroswap` | **Apache-2.0** | **GPL-3.0** (`contracts/Cargo.toml` workspace; aggregator and deployer inherit it; adapters declare nothing) |
| Soroswap Core | Nested submodule | **Apache-2.0** | **GPL-3.0** on `contracts/library` |
| Uniswap V2 reference in Soroswap Core | `protocols/soroswap/contracts/factory/UniswapV2` | GPL-3.0 | n/a |
| Phoenix | Nested submodule, plus WASM in `contracts/aggregator/phoenix_contracts` | GPL-3.0 | GPL-3.0 |
| Comet | Nested submodule, plus WASM in `contracts/aggregator/comet_contracts` | AGPL-3.0 | none at the workspace root |
| Aqua | Nested gitlink with an unavailable remote, plus WASM in `contracts/aggregator/aqua_contracts` | **Unknown: source could not be fetched** | Unknown |
| VELTRIXAE/Contract AMM | Not a dependency. Build output and history are kept under `docs/evidence/` | MIT, Apache-2.0 and NOTICE | Apache-2.0 at deployed commit `133b18d`, including the library that upstream declares GPL-3.0 |

## Conflicts and open questions

These need a maintainer or legal decision. No code change in this repository resolves them.

1. **Apache-2.0 file versus GPL-3.0 manifest in Soroswap.** Both Soroswap repositories ship an Apache-2.0 `LICENSE` while manifests declare GPL-3.0. Which governs is for the rights holders to say. Ask the Soroswap maintainers for written clarification.
2. **Quote formulas in MIT-labelled code.** `api/src/routing.ts` is written to return exactly what the GPL-3.0-declared `soroswap-library` returns. Whether matching a constant-product formula creates a derivative work is a legal question. It is flagged here and in `NOTICE` rather than assumed either way.
3. **The deployed AMM's library.** The contracts deployed at Testnet derive from Soroswap Core. At commit `133b18d` the workspace declares Apache-2.0 for a library that upstream declares GPL-3.0. VELTRIXAE/Contract records the same conflict in its `docs/LICENSING_REVIEW.md` and adds a question about the Uniswap V2 lineage of its router, pair and factory. Redistributing the WASM archive and source bundle in `docs/evidence/` is covered by this question.
4. **A future aggregator deployment.** The upstream aggregator is declared GPL-3.0, and its adapters build against Phoenix (GPL-3.0), Comet (AGPL-3.0) and Aqua (unknown) interfaces. Resolve this before deploying or distributing a VELTRIXAE aggregator build. AGPL-3.0 network terms in particular need review.
5. **The MIT test harness.** `contract-tests/` is declared MIT and loads the GPL-3.0-declared aggregator WASM at test time. The WASM is built locally, not committed. Confirm this separation is sufficient.

## Evidence reported by VELTRIXAE/Contract

Its `docs/LICENSING_REVIEW.md` on `main` records that the upstream library's README and manifest both state GPL-3.0 and that its source files have no per-file headers. It maps the conflict to `contracts/library`, which is linked into the Router WASM, while Factory and Pair have no dependency on it. Open Contract PR #11, which is not merged and which this review did not re-verify, reports that all 16 published crate versions and 43 upstream refs declare GPL-3.0, so no permissive replacement version exists.

General background, not advice on this case: Apache-2.0 and MIT code can generally be combined into a GPL-3.0 work, but GPL-3.0 code cannot be relabelled as MIT or Apache-2.0 without permission from its rights holders. That is why the direction of this conflict matters.

## Decisions and who makes them

Engineers can keep the record accurate. They cannot decide the first group.

| # | Decision | Owner | Blocks | Until decided |
| --- | --- | --- | --- | --- |
| L1 | Which license governs Soroswap's Aggregator and Core library code (questions 1 and 3)? | **Soroswap rights holders**, in writing | Any unqualified license claim | Preserve both notices |
| L2 | If GPL-3.0 applies, what must VELTRIXAE do for its Router, the bundled artifacts and any release? | **Legal counsel** | Commercial release, relicensing | Do not change declarations |
| L3 | Does the Uniswap V2 lineage extend the question to the Factory, Pair and Router? | **Legal counsel** | Same as L2 | Keep the lineage notice |
| L4 | Do GPL-3.0 and AGPL-3.0 terms apply to deploying or running an aggregator with those adapters (question 4)? Could a Soroswap-only build narrow it? | **Legal counsel** | Phase D of the [Testnet plan](TESTNET_LIVE_PLAN.md) | Do not deploy |
| L5 | Do matching quote formulas in MIT-labelled `routing.ts` create an obligation (question 2)? | **Legal counsel** | Stating the API is purely MIT | Keep the NOTICE entry |
| L6 | Is it acceptable to keep the WASM and bundle under `docs/evidence/`, and is the MIT test harness sufficiently separate (questions 3 and 5)? | **Legal counsel** | Unqualified redistribution claims | Keep them labelled in NOTICE |
| M1 | Ask Soroswap for written clarification | **Maintainer** | L1 | Not yet sent |
| M2 | Retain counsel, and decide how much certainty the funding application needs | **Maintainer** | L2 to L6 | Not started |
| M3 | Choose what the application says about licensing | **Maintainer**, after M1 and M2 | Application | Use the statement below |
| M4 | Confirm Aqua's license, since its source could not be fetched | **Maintainer or a contributor** | Any build including Aqua | Treat as unknown |

Suggested wording while these are open:

> VELTRIXAE builds on Soroswap, which is derived in design from Uniswap V2. Upstream license declarations conflict (Apache-2.0 and GPL-3.0), and related protocols use GPL-3.0 and AGPL-3.0. We have documented these conflicts and are seeking clarification. We make no claim that they are resolved.

## What the API image ships

`api/Dockerfile` copies only `api/`, `packages/frontend-client/`, `config/` and npm dependencies. It does not include `upstream/` or `docs/evidence/`.

## Rules for contributors

- Do not edit, relabel or remove upstream license files, notices, authors or audit reports.
- Do not add "MIT" to a file derived from upstream code.
- Do not describe any of the questions above as resolved without a written decision from the rights holders or counsel.
- New third-party code needs an entry in `NOTICE` and in the table above.
