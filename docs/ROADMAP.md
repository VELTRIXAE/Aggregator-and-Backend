# Roadmap

Each milestone is finished when its exit evidence exists, and not before. There are no dates or budgets here because none have been agreed. Current status is in [funding evidence](FUNDING_EVIDENCE.md).

## 1. Backend readiness (this branch)

Live quote path works against funded pools on the public RPC, with fail-closed gates, a readiness endpoint, reproducible evidence and a green CI.

**Exit evidence:** CI passes on `main`, and `npm run evidence:testnet` records successful quotes with router parity.

## 2. Decisions that need a person

- Answer the [license questions](LICENSE_REVIEW.md). Blocks redistribution and any aggregator deployment.
- Publish deployed source commit `133b18d` in VELTRIXAE/Contract and correct its records, as listed in the [reconciliation](DEPLOYMENT_RECONCILIATION.md).
- Decide whether to redeploy from current Contract `main`. Its contracts differ materially from the deployed ones, including atomic initialization and the exact-output rounding fix.

**Exit evidence:** recorded decisions, with links.

## 3. First real VELTRIXAE liquidity on Testnet

Follow the [Testnet plan](TESTNET_LIVE_PLAN.md). It needs explicit approval for each state-changing step: TTL extension, pool creation and funding with test assets.

**Exit evidence:** real pool and token IDs with transaction receipts, `/readiness` reporting `funded`, and quote parity on the VELTRIXAE router.

## 4. Aggregator on Testnet and a wallet-approved swap

Follow the [Testnet plan](TESTNET_LIVE_PLAN.md). It needs explicit approval, plus question 4 of the license review answered. Issues [01](issues/01-prepare-swap-ledger-check.md) and [02](issues/02-execution-deadline.md) must be settled first.

**Exit evidence:** aggregator ID, hash, admin and pause state verified; a Testnet swap prepared here, reviewed and signed by a wallet, and its receipt recorded.

## 5. Scale and operations

Atomic snapshots ([issue 03](issues/03-atomic-snapshots.md)), an indexer for large factories, RPC failover, gateway rate limits and monitoring.

**Exit evidence:** measured quote success and latency at a stated pool count.

## 6. Independent security review

Scope agreed and performed by an independent reviewer, findings published and fixed.

**Exit evidence:** published report covering the exact deployed hashes.

## 7. Mainnet: not planned yet

Mainnet stays disabled. It would require milestones 2 to 6, a separate decision, and code changes: the manifest schema, transport and tests all reject it today. No document here authorizes it.
