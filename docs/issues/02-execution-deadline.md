# Give wallets a realistic signing window

## Problem

Quotes expire 15 seconds after reserves are observed, and `prepareSwap` uses that same instant for both the transaction's `maxTime` and the contract's `deadline`. Part of that window is already spent on RPC calls: live runs had 5 to 10 seconds left when validation finished. A person reviewing a wallet prompt may not be able to approve in time.

## Scope

Separate how long a quote may be displayed from the transaction's execution deadline. Keep the slippage limits as the protection against price movement. Choose the bound with reasoning, and make the remaining time visible in the response.

## Acceptance criteria

- `maxTime` and `deadline` stay equal, or the difference is explained.
- The deadline stays bounded, with tests at the boundary.
- `docs/ROUTING.md` and `docs/API.md` are updated.
