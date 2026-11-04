# Monitoring plan

**This is a plan. Nothing here runs automatically yet, except the weekly Rust advisory scan.** The checks below exist as read-only commands and need scheduling, alert routing and an owner. Check it against SCF's current template before submitting.

## What to watch

Thresholds are starting points and have not been tuned against real traffic.

| Signal | Source | Warn | Act | Response |
| --- | --- | --- | --- | --- |
| Deployed code hash | `npm run verify:deployment` | n/a | Any mismatch | Quotes already fail closed. Investigate, and don't change the manifest to make it pass |
| Readiness blockers | `GET /api/v1/readiness` | A new blocker | `deployment.status` is `failed` | Follow the [Testnet plan](TESTNET_LIVE_PLAN.md)'s failure table |
| Contract state expiry | `npm run plan:simulate` | Under 14 days | Under 7 days | Request approval to extend. Never extend automatically |
| Pool count against the cap | `all_pairs_length` | 50% of `MAX_DISCOVERY_POOLS` | 80% | Spam is an open risk: see [issue 12](issues/12-pool-spam.md) |
| Quote success and latency | `npm run evidence:testnet` | Below 80% | Below 50% | Check the RPC provider. Do not relax consistency checks |
| API errors | Error codes in API logs | `RPC_UNAVAILABLE` or `INCONSISTENT_STATE` rising | `QUOTE_MISMATCH` or `CONTRACT_MISMATCH` at any rate | Stop and investigate. These are real divergence signals |
| Liveness | `GET /api/v1/health` | n/a | Failing | Restart. Note it says nothing about chain state |
| Deployer account activity | Public account data | Any transaction not in an approved plan | Same | Treat the key as compromised until explained |
| Rust advisories | `.github/workflows/rust-advisories.yml` (weekly) | Warnings | New advisory | See [Rust advisories](RUST_ADVISORIES.md) |

## Roles and rules

- **Owner:** not yet assigned. A maintainer must take this before tranche 2.
- **Monitoring is read-only.** It must never sign, restore or extend. Those stay manual and approved.
- **Public RPC limits apply.** Poll gently: each verification makes several calls, and public latency varies.
- **Incidents:** record what happened and when. Publish security-relevant incidents after they are fixed.

## To build

1. Schedule the read-only commands, and route alerts to the owner.
2. Add structured counters for error codes and quote latency.
3. Decide on log retention, keeping logs free of keys and personal data.
