#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v cargo >/dev/null
command -v stellar >/dev/null
cargo build --manifest-path upstream/soroswap/contracts/Cargo.toml --target wasm32-unknown-unknown --release --workspace --locked
for name in soroswap_aggregator_deployer soroswap_adapter phoenix_adapter aqua_adapter comet_adapter soroswap_aggregator; do
  stellar contract optimize --wasm "upstream/soroswap/contracts/target/wasm32-unknown-unknown/release/${name}.wasm" --wasm-out "upstream/soroswap/contracts/target/wasm32-unknown-unknown/release/${name}.optimized.wasm"
done
