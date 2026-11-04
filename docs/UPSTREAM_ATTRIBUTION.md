# Upstream attribution

VELTRIXAE preserves Soroswap Aggregator at https://github.com/soroswap/aggregator, pinned to 84de10e0f8d26168b4a76f8c23b963e50917517c under `upstream/soroswap`. Original contract names and interfaces, authors, audits, READMEs and licenses remain intact. Root VELTRIXAE branding does not imply authorship of upstream contracts. Upstream manifests name authors including coderipper and esteblock of PaltaLabs.

The nested upstream protocol gitlinks identify Soroswap Core (https://github.com/soroswap/core), Phoenix (https://github.com/Phoenix-Protocol-Group/phoenix-contracts), Aqua (https://github.com/AquaToken/soroban-amm) and Comet (https://github.com/mootz12/comet-contracts-v1). Preserve their revisions and license files. Aqua remote availability does not authorize replacing its pinned implementation.

The original root MIT LICENSE is retained unchanged. Upstream root LICENSE contains Apache License 2.0, while its Cargo workspace declares GPL-3.0. Preserve both notices and obtain license clarification before redistribution; this project does not resolve the discrepancy by relabeling upstream code. See the [license review](LICENSE_REVIEW.md) for the full inventory and open questions, including GPL-3.0 Phoenix and AGPL-3.0 Comet, and the root [NOTICE](../NOTICE). Bundled WASM and audit reports retain upstream provenance and are not new VELTRIXAE audits.

The API quotation model mirrors the pinned Soroswap Core library in protocols/soroswap/contracts/library/src/quotes.rs and its checked ceiling division. Protocol capabilities are based on checked-in interfaces, not marketing claims or assumptions of current Testnet availability.

A VELTRIXAE-maintained patch in patches/soroswap-deployer-test-abi.patch updates one stale upstream deployer test fixture to the already-existing compiled ABI. It is applied only to temporary test sources, never deployed contract code or the pinned gitlink. Additional VELTRIXAE WASM boundary tests live in contract-tests/ under the preserved root license.

The Testnet Factory, Router and Pair configured in `config/testnet.json` are built from VELTRIXAE/Contract, which is derived from Soroswap Core and records that lineage in its own NOTICE. API fields and the manifest slot named `soroswap` describe that ABI compatibility. They do not mean Soroswap operates these contracts, and they do not make the deployment an original VELTRIXAE design ([issue draft 06](issues/06-protocol-label.md)).
