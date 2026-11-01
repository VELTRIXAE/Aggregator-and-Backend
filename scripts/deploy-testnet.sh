#!/usr/bin/env bash
# Explicit manual invocation only. Local Stellar CLI identities remain outside the API.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DEPLOYER_IDENTITY:?Set a Stellar CLI identity name (not a private key)}"
: "${APPROVE_TESTNET_DEPLOY:?Set APPROVE_TESTNET_DEPLOY=yes to confirm a manual Testnet deployment}"
[[ "$APPROVE_TESTNET_DEPLOY" == yes ]] || exit 1
bash scripts/build-contracts.sh
stellar contract deploy --wasm upstream/soroswap/contracts/target/wasm32-unknown-unknown/release/soroswap_aggregator.optimized.wasm --source-account "$DEPLOYER_IDENTITY" --network testnet
printf '%s\n' 'Record the returned ID and WASM hash. Initialize with reviewed admin and router addresses, then run npm run verify:deployment. See docs/DEPLOYMENT.md.'
