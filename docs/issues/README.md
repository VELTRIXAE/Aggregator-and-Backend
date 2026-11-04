# Contributor issue drafts

Markdown drafts only: none has been published to GitHub. Each comes from something observed while verifying this backend. Copy one into a GitHub issue when a maintainer is ready to accept work on it.

| Draft | Size | Suggested labels |
| --- | --- | --- |
| [Revisit the prepare-swap same-ledger check](01-prepare-swap-ledger-check.md) | S | backend, needs-decision |
| [Give wallets a realistic signing window](02-execution-deadline.md) | M | backend, wallet, needs-decision |
| [Read pool state atomically with getLedgerEntries](03-atomic-snapshots.md) | L | backend, performance |
| ~~[Verify prepared XDR in the frontend client](04-client-xdr-verification.md)~~ | Done | Sub-invocations remain unchecked |
| [Follow Contract main's exact-output rounding on redeployment](05-exact-output-parity.md) | S | backend, blocked |
| [Separate the ABI name from the pool operator in API responses](06-protocol-label.md) | M | api, breaking-change |
| ~~[Make rate limits work behind a trusted proxy](07-trusted-proxy.md)~~ | Done | |
| ~~[Add seeded fuzz tests for route arithmetic](08-route-fuzz-tests.md)~~ | Done | |
| [Support ordered RPC failover](09-rpc-failover.md) | M | backend, reliability |
| ~~[Add a Rust advisory scan to CI](10-rust-advisories-ci.md)~~ | Done | Reachability of warnings not analysed |
| [Keep routes away from unreviewed tokens](11-route-allowlist.md) | M | security, routing |
| [Stop pool spam from disabling quotes](12-pool-spam.md) | L | security, performance |

License questions are not contributor tasks. They are maintainer and legal decisions tracked in [the license review](../LICENSE_REVIEW.md).
