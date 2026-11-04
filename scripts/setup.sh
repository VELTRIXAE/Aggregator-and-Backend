#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
git submodule update --init upstream/soroswap
# Aqua's pinned remote is unavailable. Preserve its gitlink and bundled WASM; do not replace its revision.
git -C upstream/soroswap submodule update --init protocols/soroswap protocols/phoenix-contracts protocols/CometDEX
rustup target add wasm32-unknown-unknown
# The remote SDK 29 compatibility harness requires Rust >=1.91; upstream contracts stay on 1.84.
rustup toolchain install 1.99.1 --profile minimal
npm ci --ignore-scripts
if ! command -v stellar >/dev/null; then
  # `stellar contract optimize` requires the CLI's opt feature. Without it, build-contracts.sh always fails.
  stellar_cli_version=22.8.1
  if [[ "$(uname -sm)" == "Linux x86_64" ]]; then
    # Official release binary, pinned by checksum; it already includes the optimizer.
    stellar_cli_sha256=910922b1b8e09effa565627d972cbffc4d55ddc1c06cb329545d0cd1e6e02bde
    if ! /sbin/ldconfig -p | grep -q libdbus-1.so.3; then
      sudo apt-get update -qq && sudo apt-get install -y -qq libdbus-1-3
    fi
    download_dir=$(mktemp -d)
    trap 'rm -rf -- "$download_dir"' EXIT
    curl --fail --silent --show-error --location --output "$download_dir/stellar.tar.gz" \
      "https://github.com/stellar/stellar-cli/releases/download/v${stellar_cli_version}/stellar-cli-${stellar_cli_version}-x86_64-unknown-linux-gnu.tar.gz"
    echo "$stellar_cli_sha256  $download_dir/stellar.tar.gz" | sha256sum --check --quiet
    tar -xzf "$download_dir/stellar.tar.gz" -C "$download_dir" stellar
    mkdir -p "${CARGO_HOME:-$HOME/.cargo}/bin"
    install -m 0755 "$download_dir/stellar" "${CARGO_HOME:-$HOME/.cargo}/bin/stellar"
  else
    cargo install --locked stellar-cli --version "$stellar_cli_version" --features opt
  fi
fi
