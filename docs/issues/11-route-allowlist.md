# Keep routes away from unreviewed tokens

## Problem

`create_pair` on the Factory has no authorization, so anyone can create a pool with any token. Route search considers every pool and picks the best price, and it doesn't use `manifest.assets`. An attacker could create pools through their own token with attractive reserves, so that a multi-hop route goes through it. Router parity would pass because the reserves are real. The token's code then runs during the user's swap. The final slippage limit protects the output amount, but not against whatever else that token does when called.

## Scope

Add a mode where intermediate hops may only use tokens from a reviewed list, with tokens the person explicitly requested allowed as endpoints. Decide the default, noting that `assets` is empty today and so would disable multi-hop until assets are reviewed.

## Acceptance criteria

- Tests show an attacker's better-priced route being excluded, and the reviewed route selected.
- The selected route's tokens are clearly shown in the API response.
- `docs/ROUTING.md`, `docs/API.md` and the threat model are updated.
