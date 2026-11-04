# Changelog

## Funding readiness — 2026-11-04

- Fix CI: install a Stellar CLI that can optimize contracts, pinned by checksum.
- Make live quotes work on the public RPC: 0 of 12 attempts succeeded before, 17 of 20 after, against one funded public pool. Parity now requires the router and fresh reserves on one ledger.
- Exclude exact-output routes that the pair's constant-product check would reject.
- Add `GET /api/v1/readiness`, structured `verify:deployment` output and a reproducible `evidence:testnet` report.
- Add build-level guards for custody, signing, mainnet and tracked secrets.
- Add NOTICE, a license review flagging unresolved conflicts, funding evidence, a roadmap and contributor issue drafts.

No VELTRIXAE pool, liquidity or aggregator exists, and nothing was deployed, funded, signed or submitted.

## Unreleased — 2026-11-02

- Configure the verified VELTRIXAE Testnet AMM; preserve completed deployment receipts, WASM and recovery evidence.
- Add bounded configurable discovery, global RPC concurrency/queue limits and in-flight snapshot coalescing.
- Verify runtime pair registration; distinguish restoration-required reads.
- Index route adjacency, stabilize ties and reject quotes at their exact expiry boundary.
- Standardize unknown-route errors, validate RPC URLs/workload settings and redact request/error logging.
- Expand unit/API/live contract verification tests, measurable graph benchmark, CI checks and setup/audit documentation.

The Factory has no funded pools and no separate aggregator is configured. Live pool quotation and full swap execution remain unverified. Existing attribution, licenses, endpoints and integer quote formulas are preserved.
