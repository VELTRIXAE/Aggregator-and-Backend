# Contributing

Use Node 22, the root npm lockfile, Rust 1.84 and Stellar CLI 22.8.1 with the `opt` feature (a CLI built without it cannot run `stellar contract optimize`). Run `bash scripts/setup.sh` to initialize the pinned upstream and available nested protocol submodules. Do not move gitlinks to newer revisions as part of unrelated changes.

Run `npm run lint`, `npm run build`, `npm test`, `npm run test:contracts` and `npm audit --audit-level=moderate`. Live integration tests require explicit environment opt-in. Report skipped and blocked tests honestly. The contract runner applies the documented deployer fixture patch only in a disposable source copy, then runs independent WASM authorization tests in contract-tests/. Run `npm run docs:api` when changing routes.

Keep contract changes in Rust and preserve ABI compatibility. Changes inside upstream require a maintained upstream commit and updated parent gitlink; do not leave dirty submodule source as the only deliverable. Preserve authorship, audits and licenses. Add protocol support only with reviewed addresses, interface evidence, quote parity tests and network verification.

Use focused commits describing behavior and validation. Never commit .env, wallet secrets, generated target directories or fabricated deployments. Dependabot opens reviewable updates; contract SDK/toolchain changes need WASM rebuild and upstream tests. See SECURITY.md for vulnerability reporting.

For backend changes run npm run benchmark:routing and keep its operation-count scope explicit. Configuration/discovery changes must test cap exhaustion, deadline failures, duplicate/forged pools, queue limits, and fresh-reserve behavior. CI runs offline tests on every push/PR and exposes a manual read-only Testnet workflow; missing live token/liquidity prerequisites must be reported as skips. Offline compiled-spec ABI tests run in the contracts job after actual WASM builds.

## Where to start

[Contributor issue drafts](docs/issues/README.md) lists scoped work, including good first issues. The [roadmap](docs/ROADMAP.md) shows how it fits together.

## Rules that are not negotiable

- Never add signing, key handling or transaction submission to the API. `api/test/safety.test.ts` fails if you do. Do not loosen that test to get a change through.
- Keep mainnet disabled. Enabling it is a separate decision, not a contribution.
- Never commit invented IDs, receipts, prices or liquidity. Mock fixtures must be labelled as mocks. Report live evidence only from a real run, and describe skipped checks as skipped.
- Do not run deployment, pool creation, funding or any other state-changing command without explicit maintainer approval. `npm run evidence:testnet`, `npm run verify:deployment` and `npm run test:rpc` are read-only.
- Do not relax a fail-closed check for convenience. If a check blocks real use, measure the problem and propose the change in its own reviewable PR, as issue 01 does.
- Preserve Soroswap and other upstream attribution. Read the [license review](docs/LICENSE_REVIEW.md) before copying upstream code, and do not describe an open license question as resolved.
