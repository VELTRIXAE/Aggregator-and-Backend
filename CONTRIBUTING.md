# Contributing

Use Node 22, the root npm lockfile, Rust 1.84 and Stellar CLI 22.8.1. Run `bash scripts/setup.sh` to initialize the pinned upstream and available nested protocol submodules. Do not move gitlinks to newer revisions as part of unrelated changes.

Run `npm run lint`, `npm run build`, `npm test`, `npm run test:contracts` and `npm audit --audit-level=moderate`. Live integration tests require explicit environment opt-in. Report skipped and blocked tests honestly. The contract runner applies the documented deployer fixture patch only in a disposable source copy, then runs independent WASM authorization tests in contract-tests/. Run `npm run docs:api` when changing routes.

Keep contract changes in Rust and preserve ABI compatibility. Changes inside upstream require a maintained upstream commit and updated parent gitlink; do not leave dirty submodule source as the only deliverable. Preserve authorship, audits and licenses. Add protocol support only with reviewed addresses, interface evidence, quote parity tests and network verification.

Use focused commits describing behavior and validation. Never commit .env, wallet secrets, generated target directories or fabricated deployments. Dependabot opens reviewable updates; contract SDK/toolchain changes need WASM rebuild and upstream tests. See SECURITY.md for vulnerability reporting.

For backend changes run npm run benchmark:routing and keep its operation-count scope explicit. Configuration/discovery changes must test cap exhaustion, deadline failures, duplicate/forged pools, queue limits, and fresh-reserve behavior. CI runs offline tests on every push/PR and exposes a manual read-only Testnet workflow; missing live token/liquidity prerequisites must be reported as skips. Offline compiled-spec ABI tests run in the contracts job after actual WASM builds.
