# VELTRIXAE Aggregator

VELTRIXAE is a decentralized liquidity aggregation and trading infrastructure built on Stellar.

The pinned Soroswap Soroban contracts remain Rust contracts in `upstream/soroswap`. The separate `api/` service discovers verified Soroswap factory pools and produces indicative single/multi-hop exact-input and exact-output quotes. The aggregator retains upstream Phoenix, Aqua and Comet adapters; the API does not advertise these protocols without verified deployments and quote models.

## Develop

Use the included Codespaces configuration, or install Rust 1.84, Node.js 22 and Stellar CLI 22.8.1.

```sh
bash scripts/setup.sh
cp .env.example .env
npm run lint
npm run build
npm test
npm run dev
```

Health: `http://localhost:3000/api/v1/health`. OpenAPI: `/api/v1/openapi.json`.

The checked-in manifest references the verified VELTRIXAE Testnet Factory and Router. The November 2 deployment is complete; its real manifest, code hashes and receipts are preserved in docs/evidence. Run `npm run verify:deployment` to recheck live state. The Factory currently has zero pools and the separate aggregator is not deployed: quotes return `NO_LIQUIDITY`, and swap preparation returns `NOT_CONFIGURED`. No synthetic liquidity is returned. See [Testnet setup](docs/TESTNET_SETUP.md), [backend audit](docs/BACKEND_AUDIT.md) and [contract integration](docs/CONTRACT_INTEGRATION.md).

Discovery uses configurable bounded index batches and global RPC limits. It requires complete fresh observations on one ledger and fails explicitly if a factory cannot fit the collection budget; increasing the cap alone does not solve that limit.

Use `@veltrixae/frontend-client` in veltrixae-frontend. Integrate veltrixae-contracts through the reviewed manifest and existing ABI, as described in [contract integration](docs/CONTRACT_INTEGRATION.md). Signing stays in the wallet. Quotes are estimates with integer base-unit amounts, never guaranteed execution.

## Documentation

- [Architecture](docs/ARCHITECTURE.md), [repository inventory](docs/REPOSITORY_ANALYSIS.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Aggregation](docs/AGGREGATION.md), [routing](docs/ROUTING.md), [API](docs/API.md)
- [Frontend](docs/FRONTEND_INTEGRATION.md), [contract integration](docs/CONTRACT_INTEGRATION.md)
- [Deployment and environment](docs/DEPLOYMENT.md), [testing](docs/TESTING.md)
- [Original contributions and measurements](docs/ORIGINAL_CONTRIBUTIONS.md), [changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md), [security](SECURITY.md), [upstream attribution](docs/UPSTREAM_ATTRIBUTION.md)

The root MIT license is preserved. Upstream has its own Apache-2.0 license and GPL-3.0 Cargo declarations; review both before distribution. No upstream license is replaced by branding.
