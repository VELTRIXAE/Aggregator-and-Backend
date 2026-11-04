# Development and deployment

Codespaces installs Rust, Node 22, Docker and Stellar CLI (a checksum-pinned release binary on Linux x86-64, which includes the optimizer) through `.devcontainer/devcontainer.json` and `scripts/setup.sh`. The script initializes the top-level pinned upstream and available nested Soroswap/Phoenix/Comet gitlinks. Aqua's unavailable remote is not substituted; tracked WASM remains available for tests. Upstream yarn tools stay separate from the root npm workspaces.

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

For the full gated procedure, read the [Testnet plan](TESTNET_LIVE_PLAN.md) first. Manual contract deployment only:

```sh
DEPLOYER_IDENTITY=your-local-cli-identity APPROVE_TESTNET_DEPLOY=yes bash scripts/deploy-testnet.sh
```

This first verifies the configured factory/router, builds WASM, deploys the stateless upstream deployer, and uploads aggregator code. A local operator utility checks code hashes and uses the compiled spec to prepare deployment plus initialization in one atomic call. It sets the CLI public account as admin and the reviewed Soroswap router as the sole active adapter. Stellar CLI signs and submits that prepared call on explicit Testnet RPC/passphrase settings. An uninitialized aggregator is never published between deployment and initialization. Record the final transaction status, returned aggregator ID and WASM hash. Add those artifacts to the manifest, run verification and only then connect frontend wallets. This procedure concerns the separate aggregator, which has not been deployed. The AMM Factory and Router are already deployed and configured. Never change this command to mainnet without explicit authorization and security review.

Backend image: `docker build -f api/Dockerfile -t veltrixae-api .`. Start with `docker run --rm -p 3000:3000 veltrixae-api`. The image runs as node and health-checks process liveness. Mount a verified manifest before using quotations. Use TLS at a trusted ingress, gateway limits for multiple replicas and `/network/status` plus deployment verification for readiness. No deployment is run automatically by CI or this implementation.

Rollback uses a reviewed manifest and prior image. Contract upgrades require separate authorization and ABI/security review; rolling back the API does not revert chain state. Testnet resets require new verified deployment records.

## Live integration prerequisite

Read [the readiness checklist](LIVE_INTEGRATION_READINESS.md) before using any deployment command. The completed VELTRIXAE AMM export and matching WASM were verified and imported into the active Testnet manifest. The importer remains read-only, writes only a new candidate when explicitly requested, and never overwrites the active manifest. A separate aggregator deployment and funded pools are still required for live swaps. Documentation and tests do not authorize either action.

## Current verified AMM configuration

The November 2 VELTRIXAE AMM deployment is complete and its verified Factory/Router configuration is active. No pools or aggregator are deployed. Earlier missing-manifest statements describe the predeployment checkpoint. See TESTNET_SETUP.md for the full validated environment table, bounded discovery settings, startup commands and current prerequisites. This document's manual aggregator deployment procedure still requires its own explicit operator authorization.
