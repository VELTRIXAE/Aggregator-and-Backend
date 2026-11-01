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
