# Revisit the prepare-swap same-ledger check

## Problem

`StellarChain.prepareSwap` rejects a simulation unless `simulated.ledger === estimate.ledger`. The simulation necessarily runs after the quote validation, and on the public RPC calls commonly take seconds while ledgers close about every five seconds. Once an aggregator exists, this check is expected to reject most preparations with `INCONSISTENT_STATE`. No aggregator exists yet, so this has not been measured on a real swap.

The check was deliberately left strict: it fails closed, and relaxing it is a decision for review.

## Scope

Measure it first, against a real aggregator or a local fixture. The operation embeds `amount_out_min` or `amount_in_max` plus a deadline, which the contract enforces when it executes, so one option is to require only `simulated.ledger >= estimate.ledger` within the quote's validity. Record the reasoning either way.

## Measurement status

This note records **measured behavior only**. It does **not** change validation semantics. The strict `simulated.ledger === estimate.ledger` gate in `StellarChain.prepareSwap` is retained exactly as-is. Any relaxation of the gate requires a separate maintainer-reviewed justification and a dedicated change; nothing in this measurement authorizes or performs such a change.

No public deployment, funding, signing or transaction submission was performed. All measurements use deterministic transport/local-host fixtures.

## Assumptions

- The aggregator is not deployed. Behavior is measured against a deterministic in-process transport that stands in for the Soroban RPC, not against a live network.
- Ledger close cadence is modeled as ~5 seconds; quote validation and simulation are modeled as sequential calls that may straddle a ledger boundary.
- The quote carries `amount_out_min` / `amount_in_max` plus a deadline. The contract enforces these at execution time; the preparation gate is a separate, earlier check.
- Fixtures are deterministic: the simulated ledger is set explicitly per trial, so results are reproducible without wall-clock or network dependence.
- "Preparation success" means `prepareSwap` returns a prepared operation; "rejection" means it throws (e.g. `INCONSISTENT_STATE` for ledger mismatch, or a simulation failure for unmet limits).

## Fixture design

Fixtures live in `api/test/chain.test.ts` and drive `StellarChain.prepareSwap` through a stubbed transport. Each fixture fixes:

- `estimate.ledger` — the ledger at which the quote was validated.
- `simulated.ledger` — the ledger returned by the simulated transaction.
- Quote validity / deadline — whether the quote is still within its validity window.
- Swap limits — whether `amount_out_min` / `amount_in_max` are still satisfiable by the simulated result.

The fixtures cover four ledger transitions:

1. **Same ledger** — `simulated.ledger === estimate.ledger`.
2. **Older ledger** — `simulated.ledger < estimate.ledger`.
3. **Later ledger** — `simulated.ledger > estimate.ledger`.
4. **Expired quote** — quote deadline passed relative to the simulated ledger.

A fifth fixture exercises **changed swap limits**: same-ledger simulation where the simulated output no longer meets `amount_out_min` (or input exceeds `amount_in_max`), confirming simulation still fails.

## Ledger transitions and trial counts

Each transition was run for a fixed number of deterministic trials. Because the transport is deterministic, repeated trials with identical inputs produce identical outcomes; the trial count documents the fixture matrix rather than sampling noise.

| Transition | Trials | Preparation success | Rejection |
| --- | --- | --- | --- |
| Same ledger | 20 | 20 | 0 |
| Older ledger | 20 | 0 | 20 (`INCONSISTENT_STATE`) |
| Later ledger | 20 | 0 | 20 (`INCONSISTENT_STATE`) |
| Expired quote | 20 | 0 | 20 (rejected) |
| Changed limits (same ledger) | 20 | 0 | 20 (simulation failure) |

### Observations

- **Same ledger** prepares successfully in all trials, as expected.
- **Older ledger** is rejected in all trials. This is the fail-closed behavior we want to preserve; older state must never prepare.
- **Later ledger** is rejected in all trials under the current strict equality check. This is the suspected liveness limitation: a legitimate ledger advance between validation and simulation causes rejection even though the quote may still be valid.
- **Expired quote** is rejected in all trials. Expired state remains rejected; no fixture bypasses this.
- **Changed limits** fail simulation in all trials even at the same ledger, confirming that the limit/deadline enforcement is independent of the ledger gate and still catches stale economics.

## Evidence summary

- The strict equality check rejects every later-ledger preparation (20/20), which is the liveness concern in the issue.
- The check correctly rejects every older-ledger preparation (20/20), which is the safety property it protects.
- Expired quotes are rejected (20/20) regardless of ledger transition.
- Changed swap limits fail simulation (20/20) independent of the ledger gate, so relaxing the ledger gate would not by itself allow stale economics through — the contract's limit/deadline enforcement remains the backstop.

## Recommendation

**Retain the strict `simulated.ledger === estimate.ledger` check for now.** No policy change is made in this note.

Rationale and tradeoffs:

- **Retaining (recommended):** The check fails closed and is simple to reason about. The measured later-ledger rejection is a liveness cost, but the aggregator is not deployed, so there is no live swap traffic being harmed today. Keeping the strict check avoids weakening a safety-relevant gate without a maintainer decision.
- **Relaxing to `simulated.ledger >= estimate.ledger` within quote validity (not done here):** Would recover later-ledger preparations and likely improve liveness once an aggregator exists. The changed-limits fixture shows the contract's limit/deadline enforcement still rejects stale economics, which is the main safety argument in favor. However, this changes validation semantics and needs a separate maintainer-reviewed justification, plus measurement against a real aggregator once one exists.

Because the aggregator is not deployed, the measured later-ledger rejection is a modeled liveness limitation, not an observed live swap failure. The decision to relax should be revisited when a real aggregator is available to measure against.

## Acceptance criteria

- [x] Fixtures exercise same-ledger, older-ledger, later-ledger and expired-quote preparation results.
- [x] Tests show current accept/reject outcomes and verify that changed swap limits still fail simulation.
- [x] A reproducible report states assumptions, ledger transitions, trial counts and preparation success/rejection counts.
- [x] Older or expired state remains rejected; no test silently bypasses deployment verification.
- [x] Document whether retaining the strict check or changing it is recommended, with tradeoffs and evidence.
- [x] No public deployment, funding, signing or transaction submission is required.

## Contributor guidance

Estimated difficulty: advanced; maintainer decision required before changing validation semantics. Start with `api/src/chain.ts` and `api/test/chain.test.ts`. Run `npm ci --ignore-scripts`, `npm run lint`, `npm run build` and `npm test` using Node 22+. Keep measurement separate from any proposed policy change.