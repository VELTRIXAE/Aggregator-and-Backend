# Revisit the prepare-swap same-ledger check

## Problem

`StellarChain.prepareSwap` rejects a simulation unless `simulated.ledger === estimate.ledger`. The simulation necessarily runs after the quote validation, and on the public RPC calls commonly take seconds while ledgers close about every five seconds. Once an aggregator exists, this check is expected to reject most preparations with `INCONSISTENT_STATE`. No aggregator exists yet, so this has not been measured on a real swap.

The check was deliberately left strict: it fails closed, and relaxing it is a decision for review.

## Scope

Measure it first, against a real aggregator or a local fixture. The operation embeds `amount_out_min` or `amount_in_max` plus a deadline, which the contract enforces when it executes, so one option is to require only `simulated.ledger >= estimate.ledger` within the quote's validity. Record the reasoning either way.

## Acceptance criteria

- Measured preparation success rate, with the method described.
- Older-ledger simulations stay rejected, with a test.
- A swap whose limits are no longer met still fails simulation, with a test.
