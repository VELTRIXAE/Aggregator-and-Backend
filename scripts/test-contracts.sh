#!/usr/bin/env bash
# Test a disposable source copy so the pinned upstream remains unchanged.
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/build-contracts.sh
test_root=$(mktemp -d "${TMPDIR:-/tmp}/veltrixae-contract-tests.XXXXXX")
trap 'rm -rf -- "$test_root"' EXIT
tar -C upstream/soroswap --exclude=target --exclude=test_snapshots -cf - contracts | tar -C "$test_root" -xf -
patch -d "$test_root" -p1 < patches/soroswap-deployer-test-abi.patch
# Upstream contractimport! paths expect optimized WASM in contracts/target.
ln -s "$PWD/upstream/soroswap/contracts/target" "$test_root/contracts/target"
cargo test --manifest-path "$test_root/contracts/Cargo.toml" --workspace --locked
# The rehearsal uses the exact WASM deployed on Testnet, so refuse anything that differs from the manifest.
deployed_wasm="$PWD/upstream/soroswap/contracts/target/veltrixae-testnet-wasm"
mkdir -p "$deployed_wasm"
tar -xzf docs/evidence/contracts-testnet-wasm-2026-11-02.tar.gz -C "$deployed_wasm"
for role in factory router pair; do
  expected=$(node -p "require('./config/testnet.json').soroswap.${role}WasmHash")
  echo "$expected  $deployed_wasm/veltrixae_${role}.optimized.wasm" | sha256sum --check --quiet
done
CARGO_TARGET_DIR="$PWD/upstream/soroswap/contracts/target" cargo +1.99.1 test --manifest-path contract-tests/Cargo.toml --locked
npm run test:abi
