# Development and deployment

Codespaces installs Rust, Node 22, Docker and Stellar CLI through `.devcontainer/devcontainer.json` and `scripts/setup.sh`. The script initializes the top-level pinned upstream and available nested Soroswap/Phoenix/Comet gitlinks. Aqua's unavailable remote is not substituted; tracked WASM remains available for tests. Upstream yarn tools stay separate from the root npm workspaces.

| Variable | Default / purpose |
| --- | --- |
| HOST | 127.0.0.1, use 0.0.0.0 in container |
| PORT | 3000 |
| RPC_URL | https://soroban-testnet.stellar.org; HTTPS required, Testnet checked |
| RPC_TIMEOUT_MS | 10000, allowed 100–15000 |
| DEPLOYMENTS_FILE | config/testnet.json, relative to repository root |
| CORS_ORIGINS | empty, comma-separated exact frontend origins |
| RUN_TESTNET_TESTS | 0, set 1 explicitly for live RPC tests |
| TEST_TOKEN_IN / TEST_TOKEN_OUT / TEST_AMOUNT | opt-in live pool quotation test inputs |

Use `.env` locally; it is ignored by Git. The API does not read wallet signing secrets. Containers use runtime environment values and a mounted/reviewed manifest; do not bake secrets into images.

```sh
npm run build
npm test
npm audit --audit-level=moderate
npm run test:contracts
npm run verify:deployment
```

Manual contract deployment only:

```sh
DEPLOYER_IDENTITY=your-local-cli-identity APPROVE_TESTNET_DEPLOY=yes bash scripts/deploy-testnet.sh
```

This builds and deploys the preserved aggregator to Testnet, then prints the returned ID. It does not initialize admin/adapters or invent router addresses. Review get_admin/get_adapters and use the pinned contract spec to initialize explicitly; retain the resulting WASM hash and reviewed initialization transaction. Add those artifacts to the manifest, run verification and only then connect frontend wallets. Never change this command to mainnet without explicit authorization and security review.

Backend image: `docker build -f api/Dockerfile -t veltrixae-api .`. Start with `docker run --rm -p 3000:3000 veltrixae-api`. The image runs as node and health-checks process liveness. Mount a verified manifest before using quotations. Use TLS at a trusted ingress, gateway limits for multiple replicas and `/network/status` plus deployment verification for readiness. No deployment is run automatically by CI or this implementation.

Rollback uses a reviewed manifest and prior image. Contract upgrades require separate authorization and ABI/security review; rolling back the API does not revert chain state. Testnet resets require new verified deployment records.
