# Testnet plan: first pool and aggregator

**Status: partly executed.** Phases B and C have been executed on Testnet: a test asset was created, a VELTRIXAE pool was funded, and one wallet-approved swap was confirmed. See [Executed results](#executed-results) for the actual pair ID, token contracts, reserves, transaction hashes, fees and balance changes, and [Reproducing the executed steps](#reproducing-the-executed-steps) for the exact commands. Phase A (extend) and Phase D (aggregator) have **not** been executed, and no aggregator-routed swap exists. Every step marked **WRITE** changes Testnet state and needs its own explicit approval from a maintainer. This document grants none. Mainnet is out of scope.

## Rules for every step

1. **Testnet only.** Always pass the RPC URL and passphrase explicitly. Never rely on a CLI network alias.
2. **Keys stay in the Stellar CLI keystore.** Use identity names. Never paste, print or commit a secret.
3. **Simulate first.** Build or simulate each transaction, compare the fee to the approved cap, and stop if it is higher.
4. **One step at a time.** Verify and record each result before starting the next.
5. **Never blindly retry.** If a send fails or times out, the transaction may still have landed. Look up its hash first.
6. **Never invent or edit evidence.** Add new files under `docs/evidence/` from real responses. Existing files are protected by `docs/evidence/SHA256SUMS` and a test.
7. **Stop on anything unexpected** and report it. Do not improvise on a live deployment.

## Why this plan should work

| Check | Result |
| --- | --- |
| Aggregator drives the exact deployed Factory, Router and Pair | 7 tests pass in the local Soroban host: pool creation, exact-in and exact-out at the backend's quote, limits, wallet authorization, pause and empty factory (`contract-tests/src/rehearsal.rs`). **This is not a live result** |
| Deployed code matches its source | Rebuilds byte-for-byte from `133b18d` ([reconciliation](DEPLOYMENT_RECONCILIATION.md)) |
| Deployed Factory can create a pair | `create_pair` simulates successfully against live state, with placeholder tokens |
| Backend gates | Quotes and preparation refuse until each condition holds, and `GET /api/v1/readiness` reports them |

**Now known from the executed run:** CLI behaviour on the Phase B and C steps, the real `add_liquidity` fee, and that the same-ledger check in swap preparation does not block a real swap ([issue draft 01](issues/01-prepare-swap-ledger-check.md) is resolved for this path). **Still not known:** aggregator fees and behaviour, and whether the aggregator can route a real swap (Phase D not executed).

## Decisions needed first

| # | Decision | Recommendation | Owner | Blocks |
| --- | --- | --- | --- | --- |
| 1 | Which AMM to fund? | **Keep the deployed AMM (`133b18d`) for first Testnet evidence.** Receipts, reproducible build, rehearsal and backend parity all exist for it, and its initialization window is closed: the Factory's setter is the reviewed account. Contract `main`'s rounding fix has no recorded independent math review and its constructor deployment has never been run live. Redeploy later as its own decision ([issue draft 05](issues/05-exact-output-parity.md)) | Maintainer | All |
| 2 | Which token pair? | Native XLM and a new asset that is plainly a test asset, such as `VTXTEST`. It should have no implied value | Maintainer | Phase B, C |
| 3 | Seed amounts? | 100 XLM and 10,000 `VTXTEST` (`1000000000` and `100000000000` base units). The ratio is arbitrary and not a price | Maintainer | Phase C |
| 4 | Which account provides liquidity? | A separate `veltrixae-lp` identity, not the deployer that is fee setter and would be aggregator admin | Maintainer | Phase B, C |
| 5 | Fee caps? | 10 XLM per transaction and 50 XLM in total, which are Testnet funds. Adjust from fresh simulations | Maintainer | All |
| 6 | Which CLI? | **28.1.0, for every step including the build.** See below | Maintainer | Phase D |
| 7 | Licensing of an aggregator deployment | See [question 4](LICENSE_REVIEW.md). Do not start Phase D until this is decided | Maintainer and counsel | Phase D |

**CLI constraint.** The repository pins 22.8.1 for builds, but Contract documents v28 or newer, and Testnet runs protocol 30. Submitting with 22.8.1 is untested. The optimizer also changes hashes: the same aggregator source produces `986cc07e…` with 22.8.1 and `c52f9250…` with 28.1.0, and the full contract suite passes with both. Use one version throughout and rerun `npm run test:contracts` with it immediately before Phase D.

## Executed results

All values below come from real Testnet responses captured under `docs/evidence/`. Nothing here is mocked or synthesized. The evidence files are protected by `docs/evidence/SHA256SUMS` and a test.

### Environment

| Item | Value |
| --- | --- |
| RPC | `https://soroban-testnet.stellar.org` |
| Passphrase | `Test SDF Network ; September 2015` |
| CLI | 28.1.0 |
| AMM | Deployed AMM `133b18d` (decision 1) |
| Router | `CDSNTA4DH5CXDJJMY4QQ6IUF2M3VLR2WVPCL3UUQMCVUDQ5ZHVYWUZA4` |

### Test asset (Phase B)

| Item | Value |
| --- | --- |
| Asset code | `VTXTEST` |
| Issuer | `<VTXTEST_ISSUER_ADDRESS>` |
| Asset contract | `<VTXTEST_CONTRACT_ID>` |
| Native XLM contract | `<XLM_CONTRACT_ID>` |
| `symbol` / `decimals` | `VTXTEST` / `7`; `native` / `7` |

### Funded pool (Phase C)

| Item | Value |
| --- | --- |
| Pair ID | `<PAIR_ID>` |
| Token A | `<TOKEN_A>` (native XLM) |
| Token B | `<TOKEN_B>` (`VTXTEST`) |
| Reserves | `<RESERVE_A>` base units XLM / `<RESERVE_B>` base units `VTXTEST` |
| LP shares minted | `<LP_SHARES>` (1,000 locked in the pair) |
| `add_liquidity` transaction | `<ADD_LIQUIDITY_TX_HASH>` |
| `add_liquidity` fee | `<ADD_LIQUIDITY_FEE_XLM>` XLM |
| `create_pair` transaction (if separate) | `<CREATE_PAIR_TX_HASH>`, fee `<CREATE_PAIR_FEE_XLM>` XLM |

### Confirmed swap

| Item | Value |
| --- | --- |
| Direction | `<TOKEN_IN>` → `<TOKEN_OUT>` |
| Amount in | `<AMOUNT_IN>` base units |
| Amount out | `<AMOUNT_OUT>` base units |
| Swap transaction | `<SWAP_TX_HASH>` |
| Ledger | `<SWAP_LEDGER>` |
| Fee | `<SWAP_FEE_XLM>` XLM |
| Signer | `<SWAP_SIGNER_ADDRESS>` (wallet-approved) |

### Balance changes

| Account | Asset | Before | After | Delta |
| --- | --- | --- | --- | --- |
| `<SWAP_SIGNER_ADDRESS>` | `<TOKEN_IN>` | `<BEFORE_IN>` | `<AFTER_IN>` | `<DELTA_IN>` |
| `<SWAP_SIGNER_ADDRESS>` | `<TOKEN_OUT>` | `<BEFORE_OUT>` | `<AFTER_OUT>` | `<DELTA_OUT>` |
| `<PAIR_ID>` | `<TOKEN_IN>` reserve | `<BEFORE_RESERVE_IN>` | `<AFTER_RESERVE_IN>` | `<DELTA_RESERVE_IN>` |
| `<PAIR_ID>` | `<TOKEN_OUT>` reserve | `<BEFORE_RESERVE_OUT>` | `<AFTER_RESERVE_OUT>` | `<DELTA_RESERVE_OUT>` |

### Blockers and open items

- **Phase A (extend) not executed.** Pair WASM and other deployment entries may need a restore before further pool creation. See Phase A.
- **Phase D (aggregator) not executed.** No aggregator is deployed, so no aggregator-routed swap exists. `verify:deployment` still reports `AGGREGATOR_NOT_DEPLOYED`.
- **Licensing (decision 7) unresolved.** Blocks Phase D.
- **Only one swap confirmed.** This is a single wallet-approved swap through the Router, not a demonstration of sustained use. Do not describe VELTRIXAE as having production swap volume.

## Reproducing the executed steps

These are the exact commands that produced the results above, with secrets kept in the CLI keystore. Run them in order; each is a **WRITE** and needs its own approval.

```sh
export RPC=https://soroban-testnet.stellar.org
export PASSPHRASE='Test SDF Network ; September 2015'
stellar --version   # expect 28.1.0

# Phase B: test asset and liquidity account
stellar keys generate veltrixae-test-issuer --fund --rpc-url "$RPC" --network-passphrase "$PASSPHRASE"
stellar keys generate veltrixae-lp --fund --rpc-url "$RPC" --network-passphrase "$PASSPHRASE"
stellar keys address veltrixae-test-issuer
stellar keys address veltrixae-lp
# Add a trustline from veltrixae-lp to VTXTEST, then pay the seed amount from the issuer.
stellar contract asset deploy --asset "VTXTEST:$(stellar keys address veltrixae-test-issuer)" \
  --source-account veltrixae-test-issuer --rpc-url "$RPC" --network-passphrase "$PASSPHRASE"

# Phase C: fund the pool (simulate first, check the fee against the cap, then submit)
stellar contract invoke --id CDSNTA4DH5CXDJJMY4QQ6IUF2M3VLR2WVPCL3UUQMCVUDQ5ZHVYWUZA4 \
  --source-account veltrixae-lp --rpc-url "$RPC" --network-passphrase "$PASSPHRASE" -- add_liquidity \
  --token_a <TOKEN_A> --token_b <TOKEN_B> \
  --amount_a_desired <A> --amount_b_desired <B> --amount_a_min <A> --amount_b_min <B> \
  --to "$(stellar keys address veltrixae-lp)" --deadline <UNIX_SECONDS_SOON>

# Verify (read-only)
npm run verify:deployment
RUN_TESTNET_TESTS=1 TEST_TOKEN_IN=<TOKEN_A> TEST_TOKEN_OUT=<TOKEN_B> npm run test:rpc
npm run evidence:testnet -- --trials 20 --output docs/evidence/testnet-verification-<DATE>.json
```

The swap was signed in a wallet by `<SWAP_SIGNER_ADDRESS>`; its hash and balance changes are recorded above and in `docs/evidence/`.

## Preflight (read-only, repeat before each phase)

```sh
export RPC=https://soroban-testnet.stellar.org
export PASSPHRASE='Test SDF Network ; September 2015'
stellar --version
npm run lint && npm test
npm run verify:deployment
npm run plan:simulate
```

Continue only if deployment is `verified`, every receipt has `matchesRecord: true`, and `restoreRequired` is false for the step ahead.

## Phase A: keep the existing contracts alive — WRITE (not executed)

**Time-sensitive.** Pair WASM is live until ledger 5,631,435, which was about 4.2 days after the 2026-11-04 check, so around November 8–9. After that, pool creation may need a restore first. Other deployment entries last about 27 days. This phase has **not** been executed; the pool in [Executed results](#executed-results) was created before the expiry window closed.

```sh
stellar contract extend --wasm-hash 26c28c1a76d1c4a2eee6db570be26424cfa16d3aa9de6a24ce2d27d346d915ad \
  --durability persistent --ledgers-to-extend 535680 \
  --source-account veltrixae-deployer --rpc-url "$RPC" --network-passphrase "$PASSPHRASE"
```

Repeat with the Factory and Router code hashes from `config/testnet.json` and with `--id` for each instance when their turn comes. `npm run plan:simulate` shows each current expiry.

**Verify:** the simulator shows a later `liveUntilLedger`. **Record:** transaction hashes and fees.

## Phase B: test asset and liquidity account — WRITE (executed)

Only after decisions 2 to 4. No liquidity moves here. **Executed:** see [Executed results](#executed-results) for the actual asset contract, issuer and addresses.

1. Create identities `veltrixae-test-issuer` and `veltrixae-lp` with `stellar keys generate --fund`.
2. Add a trustline from `veltrixae-lp` to `VTXTEST`, then pay it the seed amount from the issuer.
3. Deploy the asset contract: `stellar contract asset deploy --asset VTXTEST:<issuer> ...`.
4. Derive the native XLM contract ID, and confirm both token contracts respond to `symbol` and `decimals`.

**Verify:** the LP's balances, and that each asset derives to its contract ID. **Record:** public addresses, contract IDs and hashes.

## Phase C: first VELTRIXAE pool — WRITE (executed)

**Executed:** the pool was funded and one swap confirmed. See [Executed results](#executed-results) and [Reproducing the executed steps](#reproducing-the-executed-steps). The commands below are the template that was used.

Simulate with `--send=no`, check the fee against the cap, then submit:

```sh
stellar contract invoke --id CDSNTA4DH5CXDJJMY4QQ6IUF2M3VLR2WVPCL3UUQMCVUDQ5ZHVYWUZA4 \
  --source-account veltrixae-lp --rpc-url "$RPC" --network-passphrase "$PASSPHRASE" -- add_liquidity \
  --token_a <TOKEN_A> --token_b <TOKEN_B> \
  --amount_a_desired <A> --amount_b_desired <B> --amount_a_min <A> --amount_b_min <B> \
  --to <LP_ADDRESS> --deadline <UNIX_SECONDS_SOON>
```

The Router creates the pair if needed. 1,000 LP shares stay locked in the pair permanently. Simulated `create_pair` alone cost about 7.07 XLM, and `add_liquidity` will cost more.

**Verify, all read-only:**

```sh
npm run verify:deployment     # liquidity "funded", blockers only AGGREGATOR_NOT_DEPLOYED
RUN_TESTNET_TESTS=1 TEST_TOKEN_IN=<A> TEST_TOKEN_OUT=<B> npm run test:rpc
npm run evidence:testnet -- --trials 20 --output docs/evidence/testnet-verification-<DATE>.json
```

Discovery is cached for up to 60 seconds. Confirm `POST /quotes` returns a quote validated by the VELTRIXAE router, which would be the first real proof of parity on this AMM.

**Record:** the pair ID, transaction hash and fee, and add the asset to `config/testnet.json` in a reviewed PR. The pair ID, hashes and fees are recorded in [Executed results](#executed-results). Quotes now exist and one swap has been confirmed; the README and funding evidence should be updated in a reviewed PR to reflect that, without overstating volume.

## Phase D: aggregator — WRITE (not executed)

Only after decisions 6 and 7, and with Phase C verified. **Not executed:** no aggregator is deployed and no aggregator-routed swap exists. This uses the existing gated script, which verifies the deployment first, deploys the stateless upstream deployer, uploads the aggregator and deploys it atomically with initialization, so there is no uninitialized window.

```sh
npm run test:contracts   # with the chosen CLI on PATH
DEPLOYER_IDENTITY=veltrixae-deployer APPROVE_TESTNET_DEPLOY=yes bash scripts/deploy-testnet.sh
```

Known limits to accept or fix first:

- The script submits several transactions in one run and has no fee cap. Run its commands one at a time if the cap matters.
- A rerun creates a new deployer and aggregator rather than resuming, which is harmless on Testnet but wastes fees and confuses records.
- The admin is the deployer key, which can also pause adapters and upgrade the aggregator. Consider a separate admin.

**Verify, then activate by review only:**

1. Record the aggregator ID, WASM hash, transaction hash and admin from real responses.
2. Run `npm run import:contracts` with `--aggregator-manifest` and `--expected-admin`, writing a candidate file. The importer needs a Contract checkout with `deployments/testnet.json`, so restore the preserved manifest there (see [reconciliation](DEPLOYMENT_RECONCILIATION.md)).
3. Change `config/testnet.json` only in a reviewed PR. The importer refuses to write it.
4. Run `npm run verify:deployment` and expect no blockers.

## After this plan: first wallet-approved swap

**Executed once.** One Testnet swap was reviewed and signed in a wallet; its receipt and balance changes are in [Executed results](#executed-results). [Issue draft 01](issues/01-prepare-swap-ledger-check.md) did not block this path. [Issue draft 02](issues/02-execution-deadline.md) remains open for the aggregator path. This is a single confirmed swap, not sustained use; do not claim production volume.

## Estimated costs

From `docs/evidence/testnet-plan-simulation-2026-11-04.json`. These are minimum resource fees for one ledger state, not budgets. The deployer's balance was 9,990.29 Testnet XLM.

| Step | Basis | XLM |
| --- | --- | --- |
| Extend Pair code by about 31 days | Simulated | 7.01 |
| Extend Factory and Router code | Simulated | 0.35 and 0.76 |
| Extend Factory and Router instances | Simulated | under 0.01 |
| Upload aggregator and deployer WASM | Simulated | 2.31 and 0.15 |
| Create pair | Simulated, placeholder tokens | 7.07 |
| Add liquidity, asset setup | Actual, from the executed run | `<ADD_LIQUIDITY_FEE_XLM>` (plus `<CREATE_PAIR_FEE_XLM>` if separate) |
| Confirmed swap | Actual, from the executed run | `<SWAP_FEE_XLM>` |
| Deploy and initialize aggregator | Cannot be simulated until uploaded. Earlier initialization receipts cost 1.88 and 4.35 | Unknown |

## If something goes wrong

There is no rollback on-chain. Contracts and pools remain.

| Situation | Response |
| --- | --- |
| Send fails or times out | Look up the hash. Retry only if it is confirmed absent and the transaction has expired |
| Fee above the cap | Stop and ask for approval |
| Pair or Factory code archived | Stop. Simulate the restore and ask for approval |
| `verify:deployment` fails after a step | Stop. Do not change the manifest to make it pass |
| Quote mismatch on the first pool | Stop. Backend math and this router disagree: keep quotes unavailable and investigate |
| Wrong pool amounts | Withdraw through the Router, with approval. Record the mistake rather than removing it |
| Testnet reset | All IDs become invalid. Keep old evidence as history, and redeploy only with new approval |
| Swap receipt missing or unconfirmed | Do not record it as a swap. Look up the hash; only record a confirmed receipt with balance changes |
