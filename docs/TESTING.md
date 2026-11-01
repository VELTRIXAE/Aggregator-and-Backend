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
