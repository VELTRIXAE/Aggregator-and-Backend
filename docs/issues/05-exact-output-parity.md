# Follow Contract main's exact-output rounding on redeployment

**Blocked** until a decision is made to redeploy the AMM.

## Problem

The deployed AMM (commit `133b18d`) uses `ceil(rin*out*1000/((rout-out)*997))+1` for required input. In a seeded fuzz, 2 of 400,000 such inputs failed the pair's constant-product check. The backend now excludes those routes.

VELTRIXAE/Contract `main` changed `get_amount_in` to take the larger of that value and a fee-rounded input. If it is deployed, `api/src/routing.ts` must match it, or router parity will return `QUOTE_MISMATCH` for the affected amounts.

## Acceptance criteria

- `input()` matches the router of the deployment in the manifest, verified by live parity on funded pools.
- Manifest hashes and evidence are updated in the same change.
- The underfunding regression fixtures still pass.
