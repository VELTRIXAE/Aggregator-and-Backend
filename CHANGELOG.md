# Changelog

## Unreleased — 2026-11-02

- Configure the verified VELTRIXAE Testnet AMM; preserve completed deployment receipts, WASM and recovery evidence.
- Add bounded configurable discovery, global RPC concurrency/queue limits and in-flight snapshot coalescing.
- Verify runtime pair registration; distinguish restoration-required reads.
- Index route adjacency, stabilize ties and reject quotes at their exact expiry boundary.
- Standardize unknown-route errors, validate RPC URLs/workload settings and redact request/error logging.
- Expand unit/API/live contract verification tests, measurable graph benchmark, CI checks and setup/audit documentation.

The Factory has no funded pools and no separate aggregator is configured. Live pool quotation and full swap execution remain unverified. Existing attribution, licenses, endpoints and integer quote formulas are preserved.
