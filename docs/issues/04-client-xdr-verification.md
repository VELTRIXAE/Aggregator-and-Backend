# Verify prepared XDR in the frontend client before prompting a wallet

## Problem

`POST /swaps/prepare` returns unsigned XDR. The API is a trust boundary for the frontend: a compromised or buggy API could return a transaction that differs from the displayed quote. The docs ask wallets to review the transaction, but `@veltrixae/frontend-client` offers nothing to help, and it has no dependencies today.

## Scope

Add a helper that decodes `transactionXdr` and checks it against what the user asked for: Testnet passphrase, source account, one invoke operation on the expected aggregator, function name, tokens, amount, limit, recipient, deadline and no signatures. Decide whether this is an optional entry point, so the base client keeps zero dependencies.

## Acceptance criteria

- Each altered field produces a distinct rejection, with a test for each.
- Fixtures come from real `swapOperation` encoding.
- Documented in `docs/FRONTEND_INTEGRATION.md`.
