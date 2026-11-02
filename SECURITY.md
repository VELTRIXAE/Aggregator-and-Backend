# Security

Do not request, store or send private keys or recovery phrases to this API. Wallets assemble and sign user transactions. Deployment scripts use local Stellar CLI identity names and explicit Testnet approval. Mainnet is not supported by the application manifest.

Report vulnerabilities privately through the repository Security Advisories page. Include affected revision, reproducible steps and impact; omit credentials. Do not open public issues containing exploitable details or user data. This project has no security audit claim; upstream audit reports cover their stated versions and scope only.

Controls include checksummed IDs, bounded integer amounts, strict request bodies, 16 KiB bodies, exact CORS origins, per-process rate limits, four concurrent chain jobs, response deadlines, HTTPS RPC, Testnet passphrase checks, WASM hash verification, factory identity checks and router quote parity. Quotes expire after 15 seconds. Paused/mismatched aggregator configurations fail verification.

RPC is an external trust boundary. Hash matching identifies configured code; it does not audit that code or prove an administrator cannot upgrade it. Fresh simulations can fail, change or become obsolete. Rate limiting is local to one process; production multi-instance operation needs gateway limits. Health is process liveness, not liquidity readiness.

Upstream authorization tests include mocked authorization in many functional cases; passing them alone is not proof of all malicious-call behavior. Review authorization-specific cases and add adversarial tests when changing contracts. Dependencies are checked by CI and Dependabot; review updates manually. Root license and upstream license declarations differ; preserve all notices.

RPC_URL rejects embedded user/password, query credentials and fragments. API request logs retain the HTTP method rather than URLs/queries/bodies; unexpected errors log a generic code and request ID, without raw SDK request configuration. Token metadata must be rendered as untrusted text by frontends. RPC_CONCURRENCY and the bounded queue apply across nested transport calls; queued calls expire and collection stops scheduling batches after its budget. Already-running RPC calls finish within the SDK timeout; timed-out HTTP work retains its slot until completion. No chain write is triggered by request cancellation or restoration requirements.
