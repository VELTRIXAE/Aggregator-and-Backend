# Testing

`npm run build` compiles API and frontend client. `npm test` runs deterministic routing, chain transport and API tests with clearly marked mock fixtures. Fixtures are not live quotations. `npm run test:contracts` first builds optimized WASM and then runs the pinned Rust workspace directly; direct Cargo exit status is preserved because upstream Makefile loops can hide failures.

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
