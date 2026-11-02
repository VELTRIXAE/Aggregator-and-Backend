# Live Testnet integration readiness

Read-only inspection on 2026-11-01. Existing application and Rust implementation remain intact. No deployment, funding, signing, transaction submission, activation or push was performed in this readiness session.

## Verified repository and source identity

The aggregator started clean at `55e8719887873d7295057c04a3fc9044b72b953a` on main, synchronized with origin/main. Origin fetch/push URL is `https://github.com/VELTRIXAE/Aggregator-and-Backend`; `git ls-remote origin refs/heads/main` confirmed that commit. Changes from this readiness session are left uncommitted for review; no push is authorized.

The contracts project is [VELTRIXAE/Contract](https://github.com/VELTRIXAE/Contract/tree/c834dbe7efa42e64289ce8337ba2a37352220d9f), inspected at `c834dbe7efa42e64289ce8337ba2a37352220d9f`. The public frontend is VELTRIXAE/frontend. Earlier references to the unavailable repository name veltrixae-contracts did not locate these projects.

Contract source README and deployments/README.md explicitly state that no deployment has been made from that repository. Its tree contains no deployments/testnet.json. This proves that a published deployment record is absent at that revision; it does not prove nobody deployed contracts elsewhere. No exact VELTRIXAE deployment IDs can be established from the supplied evidence. The user subsequently confirmed that the contracts are not deployed yet; work stops at that dependency.

Factory, Router and Pair required method signatures in checked-in generated bindings were compared against the backend's pinned Soroswap ABI and passed. This is offline interface evidence, not a deployed-code or security certification. AMM quote math matches the existing rounding model; the VELTRIXAE source additionally rejects exact output equal to or exceeding reserves, consistent with this backend.

## Exact required artifacts

| Required item | Authoritative location | Backend use | Current evidence |
| --- | --- | --- | --- |
| VELTRIXAE Factory contract ID | contracts.factory.id | soroswap.factory | No deployment record |
| VELTRIXAE Router contract ID | contracts.router.id | soroswap.router | No deployment record |
| Factory deployed WASM SHA-256 | contracts.factory.wasm_sha256 | soroswap.factoryWasmHash | No deployment record |
| Router deployed WASM SHA-256 | contracts.router.wasm_sha256 | soroswap.routerWasmHash | No deployment record |
| Uploaded Pair WASM hash and exact artifact | contracts.pair.wasm_hash | soroswap.pairWasmHash | No deployment record; pair IDs are per pool, not one global contract |
| Pool/token IDs and provenance | pools[].pair, token_a, token_b, tx, created_at | Discovery, metadata, quote integration inputs | No deployed pools published |
| Source revision and receipts | git_commit, deployed_at, deployer, fee_to_setter; upload/deploy/initialize transaction hashes | Revision review, identity checks and traceability | No deployment record |
| VELTRIXAE Aggregator ID and WASM hash | Separate aggregator deployment record | veltrixae.aggregator, aggregatorWasmHash | Not supplied; Contract repository contains AMM contracts, not this aggregator |
| Aggregator admin and initialization record | Reviewed public admin, active adapter router, pause state | get_admin/get_adapters checks | Not supplied |
| Exact build artifacts | veltrixae_factory/router/pair.optimized.wasm or matching .wasm | Record/hash/spec comparison | Generated bindings/metadata exist; deployed matching WASM not supplied |

The manifest's `soroswap` slot names the compatible pricing/adapter ABI; it can reference a verified VELTRIXAE AMM deployment. This does not relabel the source deployment as Soroswap-owned. protocol_id remains u32 0 for the existing ABI. `veltrixae` names the separate aggregator. Never fill that slot with the AMM router ID.

## Current Testnet observations

Configured RPC default: https://soroban-testnet.stellar.org (HTTPS). Its network passphrase matched `Test SDF Network ; September 2015`, live ledger status passed, and the protocol probe observed ledger 5509965. No additional RPC providers are configured. The Aquarius docs use the same Testnet RPC with explicit :443. Observations expire; recheck after Testnet resets or upgrades.

Evidence: [machine-readable read-only report](evidence/testnet-readiness-2026-11-01.json), [official Soroswap candidate snapshot](evidence/soroswap-core-testnet-candidate.json). The candidate is from [Soroswap Core address-file revision bb90a65556d8eee0dc698ac75de0f280e547fedc](https://github.com/soroswap/core/blob/bb90a65556d8eee0dc698ac75de0f280e547fedc/public/testnet.contracts.json). It is not active configuration.

| Protocol | Observed deployment evidence | Backend readiness |
| --- | --- | --- |
| Soroswap current candidate | Factory CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY; router CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD. Live hashes match published hashes; required signatures and router factory link match. Factory reports 605 pools. | Full discovery fails POOL_LIMIT because the existing safe limit is 100. No current quote was certified. An indexer or separately reviewed bounded discovery design is needed before using this factory. Do not silently raise the limit or label partial discovery complete. |
| Soroswap pinned historical IDs | Both return CONTRACT_NOT_FOUND (missing or archived). | Disabled; historical files remain provenance only. |
| Aquarius | Official documented router CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD has live WASM and returns 343 token sets. Required pinned swap_chained, swap_chained_strict_receive and get_pool method signatures match. | Deployment/discovery entry point exists. No pool reserves, funding, price parity or full swap was verified; the API has no Aqua pricing/discovery model and does not enable it. |
| Phoenix | Pinned custom Testnet factory and multihop IDs return CONTRACT_NOT_FOUND. | No current verified replacement was found. Do not infer all Phoenix deployments are absent. |
| Comet | No reviewed Testnet contract ID was supplied/found in the checked deployment records. | Unknown, not a claim that the protocol is unavailable. |

Aquarius source: [official constants](https://docs.aqua.network/developers/code-examples/prerequisites-and-basics). WASM presence and matching method signatures do not establish valid state, liquidity or upgrade safety.

Reproduce observations without changing configuration:

```sh
npm run check:protocols -- --soroswap-candidate docs/evidence/soroswap-core-testnet-candidate.json
npm run check:contracts-abi -- --repository /path/to/Contract
RUN_TESTNET_TESTS=1 npm run test:rpc
```

## Deployment readiness checklist

- [x] Preserve the 52 existing commits and pinned submodules; verify remote/main before any later push.
- [x] Confirm default RPC is Testnet using a read-only network/ledger check.
- [x] Inspect the real Contract repository deployment exporter and generated interfaces.
- [x] Recheck historical and current protocol candidates; keep active config unchanged.
- [x] Add a strict, read-only contracts-record importer with artifact and live-state checks.
- [ ] Obtain explicit approval before any contract deployment, account funding, liquidity funding or transaction submission. This document does not grant approval.
- [ ] Contracts maintainers review the source revision, build/test with that repository's toolchain, and authorize its AMM deployment procedure separately. Its documented CLI is v28+; the aggregator's pinned Rust/CLI build is a separate toolchain. Do not change either implicitly.
- [ ] After an authorized deployment, obtain real deployments/testnet.json, matching factory/router/pair WASM, independent source commit approval and deployment/initialization receipts. Do not invent receipts if CLI extraction returns empty strings.
- [ ] Verify factory fee_to_setter, router get_factory, hashes and factory token-pair mappings. Respect the AMM source's initialization/front-run verification and security guidance before adding value.
- [ ] Create/fund a test pool only after separate approval, then record its real pair/token IDs and transaction receipt.
- [ ] Import an AMM-only candidate, inspect it, and separately approve its use as deployment configuration.
- [ ] Separately authorize the aggregator deployment through the existing atomic deployer procedure; preserve recipient/admin authorization and record the actual aggregator ID, hash and admin. No aggregator currently exists in the published AMM artifacts.
- [ ] Import with the reviewed aggregator supplement; verify deployed aggregator ABI/structs, admin, active protocol 0 router and pause state.
- [ ] Configure real token-in/token-out base-unit test amounts; rerun live pool/metadata/router quote parity tests. No deployed quote test should be reported as passing if skipped.
- [ ] With a real public source account, perform read-only full swap preparation and inspect authorization, resource fees, limits and expiry. Submission/spending still requires approval.
- [ ] Frontend team configures the exact allowed origin and API URL, uses the existing typed client, refreshes expired quotes and keeps signing in the connected wallet.
- [ ] Review changes, tests and observed deployment evidence; obtain explicit approval before pushing this session's changes to GitHub.

## Safe import procedure

The contracts exporter writes network, deployed_at, git_commit, deployer, fee_to_setter, contracts and pools. Factory/router use `{id, wasm_sha256, deploy_tx, initialize_tx}`. Pair code uses `{wasm_hash, upload_tx}`. Pools use `{pair, token_a, token_b, tx, created_at}`. The importer rejects unknown fields, invalid IDs, invalid/missing transaction-hash strings, mainnet, duplicate pools, changed artifacts and an unapproved source revision.

Once real artifacts exist, verification-only mode is:

```sh
npm run import:contracts -- \
  --repository /path/to/Contract \
  --expected-commit REVIEWED_40_HEX_SOURCE_COMMIT \
  --artifact-dir /path/to/Contract/target/wasm32v1-none/release
```

The command above intentionally cannot succeed today against the inspected source: it exits DEPLOYMENT_RECORD_MISSING before network access or output creation. REVIEWED_40_HEX_SOURCE_COMMIT is an instruction placeholder, not a claimed revision or deployed value. Use the independently approved build revision from the real deployment record; it may precede the commit that publishes that record.

To write a reviewable, previously nonexistent candidate file, add `--output config/testnet.candidate.json`. Files are created exclusively and never overwritten. The importer refuses to write config/testnet.json and never changes DEPLOYMENTS_FILE. It does not run scripts from the contracts repository. No output option means verification only.

By default, veltrixae=null and assets=[]: AMM deployment data does not contain an aggregator or verified classic-asset issuer associations. Discovery obtains token metadata later. For a separate already deployed aggregator, add `--aggregator-manifest /path/to/reviewed-aggregator-manifest.json --expected-admin ACTUAL_PUBLIC_ACCOUNT`. That supplement uses the existing manifest schema and must reference the same AMM IDs/hashes. Build the existing aggregator WASM locally first so its reviewed ABI is available for comparison.

Checks include local artifact hashes/specs, Testnet identity, deployed factory/router hashes, router factory link, fee setter, fresh discovered pools/reserves and factory get_pair mappings. Every discovered pool's hash is checked against the pair artifact. With no pools, pairCodeObservedOnChain=false: only the local pair artifact hash has been checked. With an aggregator supplement, deployed code/ABI/structs, admin and active router configuration are checked too. Report fields explicitly leave quoteParityVerified and liveSwapVerified false. Receipt hashes are validated syntactically and retained as source provenance; the importer does not prove their inclusion in chain history. Use explorer/archive evidence for receipts outside RPC retention.

Stop at the deployment-artifact dependency. A missing record is not permission to deploy, substitute public Soroswap IDs for VELTRIXAE, manufacture a quote or push a configuration change.

## Subsequent authorized deployment attempt

After the initial readiness review, the user authorized contract deployment and a maximum 14 Testnet XLM fee budget. The three code uploads and Factory deployment were confirmed on Testnet; see [verified partial receipts](evidence/contracts-testnet-attempt-2026-11-01.json). Factory initialization simulation exceeded the approved per-transaction cap, so it was not signed. There is still no completed deployments/testnet.json, initialized Factory/Router system, pool, or aggregator deployment to import. Active backend configuration remains unchanged.

The four confirmed transactions charged 34813186 stroops (3.4813186 XLM). Factory initialization was simulated at 21582244 stroops (2.1582244 XLM), above the approved 2 XLM per-transaction cap. Resume tooling preserves verified receipts and the original contract build revision, avoids repeating confirmed work, and enforces an explicit total budget. Raising the per-transaction cap requires approval; no additional transaction is submitted automatically.

Contracts changes are locally committed on work/testnet-deployment-readiness. Pushing that branch to VELTRIXAE/Contract was rejected with HTTP 403 because the authenticated GitHub account Novastrum1 lacks repository write permission. Do not report that push as successful or substitute a partial receipt file for the completed deployment manifest.

## Completed AMM deployment — 2026-11-02

The subsequent user-authorized resume completed Router initialization. Factory and Router are now initialized and linked; all seven receipt envelopes and deployed code hashes passed verification. The real [completed manifest](evidence/contracts-testnet-deployment-2026-11-02.json), [fee/receipt checkpoint](evidence/contracts-testnet-completion-2026-11-02.json), and exact WASM archive are preserved in docs/evidence. Total charged fees were 9.7114662 Testnet XLM against the approved 14 XLM cumulative budget. This supersedes earlier missing/partial AMM deployment statements in this historical readiness report. No pool, liquidity, aggregator deployment, backend activation, or push occurred during this resume. See NEXT_SESSION.md for recovery and the SDK verification fix.
