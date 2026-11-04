# Security

Do not request, store or send private keys or recovery phrases to this API. Wallets assemble and sign user transactions. Deployment scripts use local Stellar CLI identity names and explicit Testnet approval. Mainnet is not supported by the application manifest.

## Boundaries that are enforced in code

| Boundary | Enforcement | Test |
| --- | --- | --- |
| No custody | The API has no key input, keypair, signing or submit call. `POST /swaps/prepare` returns unsigned XDR with `requiresWalletSignature: true` and `submitted: false`. | `api/test/safety.test.ts` fails the build if signing or submission code appears in runtime source, or a valid secret seed is tracked. |
| Explicit wallet approval | The wallet decodes, reviews, signs and submits. No route accepts a signed transaction. | `api/test/api.test.ts`, `api/test/chain.test.ts` |
| Testnet only | The manifest schema accepts only `testnet`, the passphrase is hardcoded, and the RPC's passphrase is checked. A mainnet RPC returns `WRONG_NETWORK`. | `api/test/safety.test.ts`, `api/test/chain.test.ts` |
| No execution on unverified state | Swap preparation simulates only after the network, every code hash, the router link, the aggregator adapter, liquidity and router parity have passed. | `execution gates` test in `api/test/chain.test.ts` |
| Observable gates | `GET /api/v1/readiness` reports what was checked and each blocker. A failed read is reported as unknown, never as empty or verified. | `readiness` test in `api/test/chain.test.ts` |
| Deployment needs approval | `scripts/deploy-testnet.sh` needs `APPROVE_TESTNET_DEPLOY=yes`, runs verification first and targets Testnet only. CI never runs it. | `api/test/safety.test.ts` |

Quote and swap responses are not guarantees. The client should still check prepared XDR against the displayed quote before prompting a wallet: see [issue draft 04](docs/issues/04-client-xdr-verification.md).

## Reporting

Report vulnerabilities privately through the repository Security Advisories page. Include affected revision, reproducible steps and impact; omit credentials. Do not open public issues containing exploitable details or user data. This project has no security audit claim; upstream audit reports cover their stated versions and scope only.

## Other controls and limits

Controls include checksummed IDs, bounded integer amounts, strict request bodies, 16 KiB bodies, exact CORS origins, per-process rate limits, four concurrent chain jobs, response deadlines, HTTPS RPC, Testnet passphrase checks, WASM hash verification, factory identity checks and router quote parity. Quotes expire after 15 seconds. Paused/mismatched aggregator configurations fail verification. Pool identity reads (immutable under the pinned pair code) are cached with discovery for up to 60 seconds; code hashes and reserves are read again for every snapshot, and parity requires the router and fresh reserves on one ledger.

RPC is an external trust boundary. Hash matching identifies configured code; it does not audit that code or prove an administrator cannot upgrade it. The deployed AMM predates security fixes on VELTRIXAE/Contract `main`, including atomic initialization, so treat it as a Testnet checkpoint only. Fresh simulations can fail, change or become obsolete. Rate limiting is local to one process; production multi-instance operation needs gateway limits. Health is process liveness, not liquidity readiness.

Upstream authorization tests include mocked authorization in many functional cases; passing them alone is not proof of all malicious-call behavior. Review authorization-specific cases and add adversarial tests when changing contracts. Dependencies are checked by CI and Dependabot; review updates manually. Root license and upstream license declarations differ; preserve all notices and see docs/LICENSE_REVIEW.md.

RPC_URL rejects embedded user/password, query credentials and fragments. API request logs retain the HTTP method rather than URLs/queries/bodies; unexpected errors log a generic code and request ID, without raw SDK request configuration. Token metadata must be rendered as untrusted text by frontends. RPC_CONCURRENCY and the bounded queue apply across nested transport calls; queued calls expire and collection stops scheduling batches after its budget. Already-running RPC calls finish within the SDK timeout; timed-out HTTP work retains its slot until completion. No chain write is triggered by request cancellation or restoration requirements.
