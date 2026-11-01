# Upstream attribution

VELTRIXAE preserves Soroswap Aggregator at https://github.com/soroswap/aggregator, pinned to 84de10e0f8d26168b4a76f8c23b963e50917517c under `upstream/soroswap`. Original contract names and interfaces, authors, audits, READMEs and licenses remain intact. Root VELTRIXAE branding does not imply authorship of upstream contracts.

The nested upstream protocol gitlinks identify Soroswap Core (https://github.com/soroswap/core), Phoenix (https://github.com/Phoenix-Protocol-Group/phoenix-contracts), Aqua (https://github.com/AquaToken/soroban-amm) and Comet (https://github.com/mootz12/comet-contracts-v1). Preserve their revisions and license files. Aqua remote availability does not authorize replacing its pinned implementation.

The original root MIT LICENSE is retained unchanged. Upstream root LICENSE contains Apache License 2.0, while its Cargo workspace declares GPL-3.0. Preserve both notices and obtain license clarification before redistribution if needed; this project does not resolve the discrepancy by relabeling upstream code. Bundled WASM and audit reports retain upstream provenance and are not new VELTRIXAE audits.

The API quotation model mirrors the pinned Soroswap Core library in protocols/soroswap/contracts/library/src/quotes.rs and its checked ceiling division. Protocol capabilities are based on checked-in interfaces, not marketing claims or assumptions of current Testnet availability.
