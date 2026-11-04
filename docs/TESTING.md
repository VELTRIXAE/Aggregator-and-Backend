# Testing

`npm run build` compiles API and frontend client. `npm test` runs deterministic routing, chain transport, API and frontend HTTP client tests with clearly marked mock fixtures. Fixtures are not live quotations. `npm run test:contracts` first builds optimized WASM and then runs the pinned Rust workspace from a disposable source copy; Cargo exit status is preserved because upstream Makefile loops can hide failures.

`RUN_TESTNET_TESTS=1 npm run test:rpc` opts into live network status. Set TEST_TOKEN_IN, TEST_TOKEN_OUT and optionally TEST_AMOUNT with a verified deployment manifest to run pool/quote parity integration. Without those inputs the liquidity test is explicitly skipped. `npm run check:upstream` checks the historical pinned upstream candidate and prints a candidate manifest only after all checks; it never enables addresses automatically.

Routing tests cover pinned fee rounding, exact output, slippage floors/ceilings, direct/multi-hop ranking, reverse reserves, cycles, empty/stale state, overflow and values above JavaScript safe integers. Chain tests cover identity/hash/network validation, malformed data, pauses, mixed ledgers, fresh reserves, cache failure behavior and unsigned ABI encoding. API tests cover endpoints, OpenAPI, strict validation, no-liquidity versus RPC errors, error redaction, CORS and rate limits. Upstream Rust tests retain admin, adapters, invalid routes/amounts, deadline, slippage and protocol failure coverage.

## Verified baseline on 2026-11-01

- npm build: passed for both workspaces.
- npm test: all three original test files passed.
- npm audit --audit-level=moderate: zero vulnerabilities reported.
- Live Testnet network/ledger test: passed; live configured pool/quote test skipped because deployment/token inputs are absent.
- Historical upstream Testnet candidate verification: failed CONTRACT_NOT_FOUND (missing or archived contract/WASM). No addresses enabled.
- Initial contract runner stopped because Stellar CLI was absent. Direct Cargo baseline attempted before changes; final results are recorded below after tool setup.

No deployment has been performed. Docker validation and external veltrixae-contracts integration require their respective environment/artifacts and must not be inferred from TypeScript tests.

Frontend client tests use a localhost HTTP server to verify request serialization, error propagation, finalization polling and cancellation; constrained sandboxes must allow localhost binding for that test. Additional chain/API regressions cover malformed ledger metadata, ambiguous asset manifests, fresh unsigned swap preparation and no-store response headers.

## Upstream fixture compatibility

The initial upstream workspace test build exposed a stale deployer fixture: Adapter used a string protocol_id and an address field while the compiled aggregator ABI requires Protocol::Soroswap and router. `patches/soroswap-deployer-test-abi.patch` corrects only that fixture in a disposable source copy. The pinned submodule remains byte-for-byte unchanged. The runner copies contracts without build outputs, links existing optimized artifacts, applies the reviewed patch and propagates Cargo failures. Temporary snapshots are removed with that source copy.

`contract-tests/` is a separate Rust test crate importing the actual optimized aggregator WASM. Four additional tests verify unauthorized initialization, unauthorized admin mutation with unchanged state, unauthorized exact-input/output swaps, and invalid amounts/paths/distribution. Initialization for relevant tests is authorized, then authorization mocking is explicitly disabled before adversarial calls. Run it after building WASM with `cargo test --manifest-path contract-tests/Cargo.toml --locked`.

Static OpenAPI is exported with `npm run docs:api`; CI checks that the checked-in docs/openapi.json matches route registration. Exporting it does not query or deploy contracts.

The final contract runner also executes `npm run test:abi`, which compares the TypeScript unsigned exact-input/output operation arguments byte-for-byte against encoding produced from the actual optimized Rust aggregator contract spec. This validates enum, struct, Option, address, integer and deadline encoding without claiming a live deployment.

The compiled-spec test exposed two pre-existing scaffold encoding errors: Protocol is a u32 enum, and Rust distribution struct fields require Symbol map keys. Both the active-adapter check and unsigned swap encoding now match the pinned Rust spec. Fixture transports were corrected to return the real numeric protocol representation rather than hiding the mismatch.

Manual deployment preparation has been TypeScript-compiled and shell syntax checked. Its initialization arguments come from the compiled aggregator spec; it validates the configured Testnet factory/router and local/deployed code hashes. Deployment uses the preserved atomic deployer, avoiding a separate uninitialized instance. No signing or submission test was run, and this is not a deployment-success claim.

## Final verified results (2026-11-01)

| Check | Observed result |
| --- | --- |
| npm run build | API and frontend client compiled successfully |
| npm test | 22 API/chain/routing tests and 1 frontend HTTP client test passed |
| npm run test:contracts | Six contract artifacts built/optimized; 149 upstream tests, 4 additional WASM tests and 1 TypeScript ABI parity test passed; exit status 0 |
| npm audit --audit-level=moderate | Zero vulnerabilities reported by npm |
| Live Testnet RPC integration | Network/ledger passed; configured liquidity/quote test explicitly skipped without deployment/token inputs |
| Native token read simulation | Live Testnet symbol read succeeded |
| Historical upstream deployment verification | CONTRACT_NOT_FOUND; candidate remains disabled |
| Docker | Backend image built; non-root application health and invalid-request handling passed |
| Shell/OpenAPI | Script syntax checked; static OpenAPI generated without drift |

No deployment, contract initialization, mainnet operation or Git push was performed. No full live VELTRIXAE swap was tested: reviewed deployment IDs, ABI artifacts and liquidity were not provided. The named public contracts repository lookup returned 404; this may indicate private or unavailable content, not proof that the repository does not exist. Source-preserved Phoenix/Aqua/Comet adapters pass their upstream tests, but only Soroswap-compatible pools are enabled in the API quote model.

## Live-integration readiness follow-up (2026-11-01)

The user confirmed that the VELTRIXAE contracts are **not deployed yet**. Read-only checks stop at that dependency. The actual source repository is VELTRIXAE/Contract, revision c834dbe7efa42e64289ce8337ba2a37352220d9f; it publishes no deployments/testnet.json. Offline required binding signatures passed for Factory/Router/Pair. This is not live deployed-VELTRIXAE verification.

| Check in this follow-up | Actual result |
| --- | --- |
| npm run build | API and frontend client passed |
| npm test | 28 API/chain/routing/importer tests and 1 frontend client test passed |
| npm run test:contracts | 149 upstream Rust tests, 4 WASM authorization tests and 1 TypeScript ABI parity test passed; exit 0 |
| RUN_TESTNET_TESTS=1 npm run test:rpc | Network/ledger passed; configured live liquidity/quote test explicitly skipped because deployments/tokens are absent |
| npm audit --audit-level=moderate | Zero vulnerabilities reported |
| npm run docs:api and generated-file diff | Passed; no OpenAPI drift |
| Shell syntax and git diff --check | Passed |
| npm run check:contracts-abi against inspected Contract source | Required Factory/Router/Pair signatures passed; no deployed-WASM claim |
| npm run import:contracts against inspected source | Expected failure DEPLOYMENT_RECORD_MISSING, before RPC/output creation |
| npm run verify:deployment with unchanged active config | Expected failure NOT_CONFIGURED |
| npm run check:upstream | Historical candidate still fails CONTRACT_NOT_FOUND |
| Current official Soroswap candidate | Factory/router WASM hashes, signatures and router link verified; 605 pools exceed discovery limit 100, so full discovery returned POOL_LIMIT; no successful current quote claimed |
| Aquarius documented router | WASM present; pinned required swap signatures match; 343 token sets observed. Pool liquidity, full swap compatibility and execution not verified |

New importer tests cover the actual contracts-export field mapping, unknown/private fields, wrong networks, source revision mismatch, artifact mismatch, ABI mismatch, fee setter and pair-registration mismatches, and refusal to create output when the deployment record is missing. Test IDs, transaction-hash strings and mock transports are explicitly synthetic and are never used as live evidence. Network status now exposes its intended typed fields instead of leaking large, unrelated raw ledger metadata returned by newer RPC responses. The API CI checkout initializes the pinned top-level upstream submodule because importer ABI tests read its bundled WASM; nested protocol builds retain their existing setup.

No Rust contract source or upstream pin was changed. No deployment, funding, signing, submission, active-manifest change, new commit or push occurred in this follow-up. Deployment-side scripts in VELTRIXAE/Contract were inspected but not run. See [readiness and exact next steps](LIVE_INTEGRATION_READINESS.md) and [observation provenance](evidence/README.md).

## Deployment-manifest interoperability follow-up

The contracts exporter now includes an explicit Testnet passphrase, schema version, package versions and upload receipts. The importer accepts those known fields while retaining strict validation and rejects a wrong passphrase. The expanded backend test run passed 29 API/chain/routing/importer tests and 1 frontend client test; both workspaces built successfully. Contract ABI comparison against the inspected source bindings passed.

A later user-approved Testnet attempt confirmed four transactions but stopped before Factory initialization at the per-transaction fee cap. The partial receipt report is evidence of those four transactions only. It is not a successful complete deployment, live quotation test, or reason to activate configuration. The Contracts push was denied by GitHub permissions; the local commits remain preserved.

## Preserving remote dependency updates

The remote main branch subsequently merged Soroban SDK 29.0.1 for the standalone contract-tests harness, TypeScript 7 and rate-limit 11. These updates are preserved. SDK 29 declares rust-version=1.91.0, so the harness now uses its own pinned Rust 1.99.1 toolchain; the unchanged upstream contract workspace still builds with Rust 1.84. Setup installs both toolchains, and the runner selects the harness compiler explicitly. This is a test-host migration, not a deployed contract SDK change. The API checkout keeps remote actions/checkout v7 while initializing the pinned upstream submodule required by ABI tests.

The remote SDK 29 harness passed all four WASM compatibility tests on Rust 1.99.1. TypeScript 7/rate-limit 11 build and all 30 API/frontend tests passed; OpenAPI export has no drift. Latest deployment state is checkpointed in NEXT_SESSION.md after the user explicitly paused further transactions.

## Current verification — 2026-11-02

The later authorized resume completed the AMM deployment. The active manifest now contains the verified Factory and Router; the Factory is initialized and the Router points to it. Read-only import and live checks observed zero pools. The separate aggregator remains absent, so quote parity and full swap execution are still unavailable.

| Check | Result |
| --- | --- |
| npm run lint / npm run build | Both workspaces passed |
| npm test | 42 API/config/chain/routing/import tests and 1 frontend client test passed |
| Focused 101-pool discovery regression | Complete discovery passed in batches of 3; configured cap failure and timeout behavior passed |
| npm run test:contracts | 145 upstream Rust tests, 4 SDK 29 WASM authorization tests and 1 compiled-spec TypeScript ABI test passed |
| RUN_TESTNET_TESTS=1 npm run test:rpc | Network and verified empty-factory discovery passed; funded-route quote test skipped because no pool/token route exists |
| npm run verify:deployment | AMM verified; pool snapshot empty; aggregator configuration false |
| npm audit --audit-level=moderate | Zero vulnerabilities reported |
| Docker build/start/health | Production image built; container became healthy; health, network status and empty pools returned HTTP 200 |
| Routing operation benchmark | 1000-pool synthetic graph: 2000 flat pool checks versus 4 indexed edge checks plus 1000 index-build visits; operation counts only |

Historical sections above record what was true at each earlier checkpoint. This section and NEXT_SESSION.md describe the current state.

## Funding-readiness verification — 2026-11-04

Observed results on this branch, before CI. CI results are on the pull request.

| Check | Result |
| --- | --- |
| npm run lint / npm run build | Both workspaces passed |
| npm test | 67 API tests and 1 frontend client test passed |
| npm run test:contracts | 149 upstream Rust tests, 4 SDK 29 WASM authorization tests and 1 compiled-spec ABI test passed, with a real optimized build |
| bash scripts/setup.sh | Passed with no CLI installed beforehand; installed the checksum-pinned Stellar CLI 22.8.1 |
| RUN_TESTNET_TESTS=1 npm run test:rpc | 3 passed. 1 explicitly skipped: funded-route parity needs a VELTRIXAE pool, which does not exist |
| npm run verify:deployment | Exit 0: AMM verified, liquidity empty, blockers `NO_POOLS` and `AGGREGATOR_NOT_DEPLOYED` |
| npm run evidence:testnet -- --trials 20 | See [the report](evidence/testnet-verification-2026-11-04.json) and [funding evidence](FUNDING_EVIDENCE.md) |
| npm audit --audit-level=moderate | Zero vulnerabilities |
| cargo audit (manual, not in CI) | Not clean: RUSTSEC-2026-0387 in `contract-tests` and upstream, RUSTSEC-2026-0009 in upstream, plus warnings. See issue draft 10 |
| Docker build and run | Non-root image. Inside the container: health 200, readiness accurate, empty pools 200, quote 422 `NO_LIQUIDITY`, prepare 503 `NOT_CONFIGURED`, a secret field 400. Port publishing from this development container was not reachable, so requests ran inside the container |
| Routing benchmark, OpenAPI export, shell syntax | Passed. OpenAPI updated for the new route |

Not tested, because it would need a state-changing transaction or does not exist yet: quotes on a VELTRIXAE pool, aggregator behaviour on Testnet, swap simulation through an aggregator, wallet signing and execution.

Rust formatting and Clippy are not part of this project's checks, and the pinned upstream sources are not modified here.

## Testnet plan verification — 2026-11-04

Merged `main` (`bd624d2`) was checked first, with no changes applied: lint and build passed, 67 API and 1 client tests passed, 153 Rust and 1 ABI contract tests passed (154), and `npm audit` reported zero vulnerabilities. CI passed on that commit.

Results on this branch, before CI. CI results are on the pull request.

| Check | Result |
| --- | --- |
| npm run lint / npm run build | Both workspaces passed |
| npm test | 69 API tests and 1 client test passed: the new tests pin evidence and status wording |
| npm run test:contracts, CLI 22.8.1 | 149 upstream, 11 WASM (4 authorization, 7 rehearsal) and 1 ABI test passed: 161 |
| npm run test:contracts, CLI 28.1.0 | The same 161 passed. The optimizer gives a different aggregator hash, which the plan accounts for |
| Deployed WASM rebuild from `133b18d` | Byte-identical for Factory, Router and Pair, using CLI 23.3.0 to 30.0.1. Not with 22.8.1, 23.2.1 or no optimizer |
| npm run plan:simulate | 7 of 7 receipts match the chain. TTLs and fees recorded. Nothing signed or submitted |
| npm run verify:deployment | Passed earlier in this review: AMM verified, zero pools, aggregator not deployed |
| npm audit --audit-level=moderate | Zero vulnerabilities |
| cargo audit (manual, not in CI) | Not clean: see [Rust advisories](RUST_ADVISORIES.md). Nothing suppressed |

The rehearsal runs in the local Soroban test host with mocked authorization where noted in its source. It is not a live pool or swap. No plan step was executed.

## Hardening verification — 2026-11-04

Results on this branch, before CI. CI results are on the pull request.

| Check | Result |
| --- | --- |
| npm run lint / npm run build | Both workspaces passed |
| npm test | 76 API tests and 5 client tests passed |
| Fuzz sensitivity | Temporarily breaking fee rounding, required-input rounding or the underfunding guard each makes the fuzz suite fail. The suite first missed the guard, so a targeted case was added |
| `verifyPreparedSwap` | Accepts real encoder and assembly output. 26 altered transactions and fields are each rejected. Not run against a deployed aggregator, because none exists |
| scripts/audit-rust.sh | Real scan passes with both known advisories printed. Fails on a new advisory, a passed review date, a stale entry and a failed scan, each exercised |
| npm audit --audit-level=moderate | Zero vulnerabilities |
| Docker build | Passed |
| npm run test:contracts | Not rerun locally, since no contract or contract tooling changed. CI runs it |

Run with another seed using `FUZZ_SEED=<number> npm test --workspace api`.
