#!/usr/bin/env bash
# Upstream Makefile loops mask failures. Invoke Cargo directly and propagate every error.
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/build-contracts.sh
cargo test --manifest-path upstream/soroswap/contracts/Cargo.toml --workspace --locked
