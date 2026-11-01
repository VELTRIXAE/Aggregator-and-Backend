# VELTRIXAE Aggregator

VELTRIXAE is a decentralized liquidity aggregation and trading infrastructure built on Stellar.

The pinned Soroswap Soroban contracts remain Rust contracts in `upstream/soroswap`. The separate `api/` service discovers verified Soroswap factory pools and produces indicative single/multi-hop exact-input and exact-output quotes. The aggregator retains upstream Phoenix, Aqua and Comet adapters; the API does not advertise these protocols without verified deployments and quote models.

## Develop

Use the included Codespaces configuration, or install Rust 1.84, Node.js 22 and Stellar CLI 22.8.1.

```sh
bash scripts/setup.sh
cp .env.example .env
npm run build
npm test
npm run dev
```

Health: `http://localhost:3000/api/v1/health`. OpenAPI: `/api/v1/openapi.json`.

The default manifest intentionally contains no deployment addresses. Health can succeed while quote requests return `NOT_CONFIGURED`. Provide reviewed Testnet IDs and WASM hashes in `config/testnet.json`, then run `npm run verify:deployment`. The historical upstream candidate was checked and is missing or archived; it is not enabled. No VELTRIXAE contracts deployment was supplied. No deployment has been performed.

Use `@veltrixae/frontend-client` in veltrixae-frontend. Integrate veltrixae-contracts through the reviewed manifest and existing ABI, as described in [contract integration](docs/CONTRACT_INTEGRATION.md). Signing stays in the wallet. Quotes are estimates with integer base-unit amounts, never guaranteed execution.

## Documentation

- [Architecture](docs/ARCHITECTURE.md), [repository inventory](docs/REPOSITORY_ANALYSIS.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Aggregation](docs/AGGREGATION.md), [routing](docs/ROUTING.md), [API](docs/API.md)
- [Frontend](docs/FRONTEND_INTEGRATION.md), [contract integration](docs/CONTRACT_INTEGRATION.md)
- [Deployment and environment](docs/DEPLOYMENT.md), [testing](docs/TESTING.md)
- [Contributing](CONTRIBUTING.md), [security](SECURITY.md), [upstream attribution](docs/UPSTREAM_ATTRIBUTION.md)

The root MIT license is preserved. Upstream has its own Apache-2.0 license and GPL-3.0 Cargo declarations; review both before distribution. No upstream license is replaced by branding.
