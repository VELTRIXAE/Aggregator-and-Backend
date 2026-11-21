# Read-only integration evidence

## Funded-pool and confirmed-swap demonstration — 2026-11-21

`testnet-funded-pool-2026-11-21.json` and
`testnet-confirmed-swap-2026-11-21.json` record real Testnet observations, not
mocked evidence: the pool file captures the test-only asset initialization,
liquidity provisioning, quote and simulation responses; the swap file captures
the confirmed transaction receipt and before/after balance changes. Both are
pinned in SHA256SUMS. No mainnet activity and no synthetic liquidity are
included. See [current remediation status](../READINESS_REMEDIATION_2026-11-21.md)
for explicit blockers and reproducible steps.

## Latest checks — 2026-11-21

See [current remediation status](../READINESS_REMEDIATION_2026-11-21.md).
`testnet-verification-2026-11-21.json` captures fresh read-only RPC checks;
`horizon-receipts-2026-11-21.json` rechecks seven historical successful
transactions beyond RPC retention; `routing-benchmark-2026-11-21.json` records
reproducible synthetic operation counts. All three are pinned in SHA256SUMS.
No writes, new deployment, pool funding or wallet swap occurred.
The sections below are historical snapshots, including their then-missing
deployment records; the November 2 records and November 21 checks supersede
that absence-of-records statement, not the unresolved licensing limitations.

## Historical checks — 2026-11-01

Observed on 2026-11-01; revalidation is required before use.

- `soroswap-core-testnet-candidate.json` matches the official file at https://github.com/soroswap/core/blob/bb90a65556d8eee0dc698ac75de0f280e547fedc/public/testnet.contracts.json. It is a candidate snapshot, never active application configuration.
- `testnet-readiness-2026-11-01.json` is the output of `node --import tsx api/src/check-protocols.ts --soroswap-candidate docs/evidence/soroswap-core-testnet-candidate.json`. It contains actual read-only RPC observations, not transaction submissions, swap guarantees or VELTRIXAE deployment claims.
- Contracts source inspection used https://github.com/VELTRIXAE/Contract/tree/c834dbe7efa42e64289ce8337ba2a37352220d9f. All 139 downloaded source files were compared byte-for-byte with the immutable revision archive. Required generated Factory/Router/Pair method signatures match the pinned compatible ABI. The repository has no published deployment record, and the user confirmed that contracts are not deployed yet.

Aquarius constants were cross-checked against https://docs.aqua.network/developers/code-examples/prerequisites-and-basics. Phoenix candidates come from the pinned upstream custom testing deployment. No reviewed Comet Testnet ID was available. Absence of an accessible candidate is not a protocol-wide nonexistence claim.

Do not activate these candidates, deploy, fund accounts/pools or push code based on this report. The active config/testnet.json remains unchanged.

## 2026-11-04 funding-readiness evidence

- `testnet-verification-2026-11-04.json` is the output of `npm run evidence:testnet -- --trials 20`, using only read-only RPC calls. Public Soroswap entries are a reference for funded-pool behaviour, not VELTRIXAE liquidity or active configuration. It supersedes neither the receipts nor the deployment manifest above.
- `quote-liveness-baseline-2026-11-04.txt` is the quote success baseline from before the changes, at commit 97d4fa1.
- `testnet-plan-simulation-2026-11-04.json` is the output of `npm run plan:simulate`: receipts compared with the chain, current expiries and simulated fees. Nothing was signed or submitted, and its `create_pair` result used placeholder tokens.
- `SHA256SUMS` pins every evidence file. A test fails if one changes. Add new evidence as new files, and add them to this list. Do not edit existing files.
