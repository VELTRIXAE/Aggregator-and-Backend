#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
git submodule update --init upstream/soroswap
# Aqua's pinned remote is unavailable. Preserve its gitlink and bundled WASM; do not replace its revision.
git -C upstream/soroswap submodule update --init protocols/soroswap protocols/phoenix-contracts protocols/CometDEX
rustup target add wasm32-unknown-unknown
npm ci --ignore-scripts
if ! command -v stellar >/dev/null; then
  cargo install --locked stellar-cli --version 22.8.1
fi
