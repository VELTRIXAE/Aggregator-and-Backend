# Contributor issue drafts

Markdown drafts only: none has been published to GitHub. Each comes from something observed while verifying this backend. Copy one into a GitHub issue when a maintainer is ready to accept work on it.

| Draft | Size | Suggested labels |
| --- | --- | --- |
| [Revisit the prepare-swap same-ledger check](01-prepare-swap-ledger-check.md) | S | backend, needs-decision |
| [Give wallets a realistic signing window](02-execution-deadline.md) | M | backend, wallet, needs-decision |
| [Read pool state atomically with getLedgerEntries](03-atomic-snapshots.md) | L | backend, performance |
| [Verify prepared XDR in the frontend client before prompting a wallet](04-client-xdr-verification.md) | M | client, security |
| [Follow Contract main's exact-output rounding on redeployment](05-exact-output-parity.md) | S | backend, blocked |
| [Separate the ABI name from the pool operator in API responses](06-protocol-label.md) | M | api, breaking-change |
| [Make rate limits work behind a trusted proxy](07-trusted-proxy.md) | S | good first issue, security |
| [Add seeded fuzz tests for route arithmetic](08-route-fuzz-tests.md) | S | good first issue, testing |
| [Support ordered RPC failover](09-rpc-failover.md) | M | backend, reliability |
| [Add a Rust advisory scan to CI](10-rust-advisories-ci.md) | M | security, ci |

License questions are not contributor tasks. They are maintainer and legal decisions tracked in [the license review](../LICENSE_REVIEW.md).
