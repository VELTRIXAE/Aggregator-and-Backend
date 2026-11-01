#!/usr/bin/env bash
# Explicit manual invocation only. Signing stays in the operator's Stellar CLI.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DEPLOYER_IDENTITY:?Set a Stellar CLI identity name (not a private key)}"
: "${APPROVE_TESTNET_DEPLOY:?Set APPROVE_TESTNET_DEPLOY=yes for manual Testnet deployment}"
[[ "$APPROVE_TESTNET_DEPLOY" == yes ]] || exit 1
export RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}"
network_args=(--rpc-url "$RPC_URL" --network-passphrase 'Test SDF Network ; September 2015')
# Fail before any write if the factory/router configuration is unverified.
npm run verify:deployment
bash scripts/build-contracts.sh
export DEPLOYER_PUBLIC_KEY
DEPLOYER_PUBLIC_KEY=$(stellar keys address "$DEPLOYER_IDENTITY")
export DEPLOYER_CONTRACT_ID
DEPLOYER_CONTRACT_ID=$(stellar contract deploy --wasm upstream/soroswap/contracts/target/wasm32-unknown-unknown/release/soroswap_aggregator_deployer.optimized.wasm --source-account "$DEPLOYER_IDENTITY" "${network_args[@]}")
export AGGREGATOR_WASM_HASH
AGGREGATOR_WASM_HASH=$(stellar contract upload --wasm upstream/soroswap/contracts/target/wasm32-unknown-unknown/release/soroswap_aggregator.optimized.wasm --source-account "$DEPLOYER_IDENTITY" "${network_args[@]}")
deploy_work=$(mktemp -d "${TMPDIR:-/tmp}/veltrixae-deploy.XXXXXX")
trap 'rm -rf -- "$deploy_work"' EXIT
export DEPLOYMENT_XDR_FILE="$deploy_work/unsigned.xdr"
node --import tsx api/src/prepare-deployment.ts
stellar tx sign "$DEPLOYMENT_XDR_FILE" --sign-with-key "$DEPLOYER_IDENTITY" "${network_args[@]}" > "$deploy_work/signed.xdr"
stellar tx send "$deploy_work/signed.xdr" "${network_args[@]}"
printf '%s\n' 'Deployment and initialization were submitted atomically. Check final status and returned contract ID, record its WASM hash, and run npm run verify:deployment with the updated manifest.'
