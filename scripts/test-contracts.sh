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
CARGO_TARGET_DIR="$PWD/upstream/soroswap/contracts/target" cargo test --manifest-path contract-tests/Cargo.toml --locked
