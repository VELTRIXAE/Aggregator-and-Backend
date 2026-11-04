# Add seeded fuzz tests for route arithmetic

## Problem

An underfunded exact-output case was found by an ad hoc fuzz script, and only its counterexamples were kept as regression tests. The suite should keep looking for this class of bug.

## Scope

Add a deterministic, seeded test over `output`, `input` and `routeAmounts`, with no new dependency, that stays fast enough for `npm test`.

## Acceptance criteria

Across reserve scales up to the i128 limits, assert that:

- Advertised exact-output routes satisfy `(rin + in - fee) * (rout - out) >= rin * rout` on every hop.
- Exact-input output never exceeds the reserve, and rounding never favours the trader.
- Any failure prints the seed and inputs.
