# Resume checkpoint — AMM Testnet deployment complete

Historical checkpoint from 2026-11-02. For current status see [funding evidence](FUNDING_EVIDENCE.md).

Verified on 2026-11-02. All seven transactions succeeded. Do not repeat deployment or initialization.

- Factory: CCBE2WCHO5PY6WVXTKZLIZA446M43RTOVD4S6XZYHPHJEL7K33LHW6RA, initialized with the reviewed fee setter.
- Router: CDSNTA4DH5CXDJJMY4QQ6IUF2M3VLR2WVPCL3UUQMCVUDQ5ZHVYWUZA4, initialized and linked to that Factory.
- Router initialization: 74c6c3fbbd59b56a5882185d2ee64236705a8f633bce5bb42ad4a738d8b90993, ledger 5515146, fee 43516969 stroops.
- Cumulative charged fees: 97114662 stroops (9.7114662 Testnet XLM). User approved 60000000 stroops per transaction and 140000000 total including prior fees.
- All seven receipt envelopes, code hashes, Factory fee setter and Router Factory link were verified read-only after completion.
- No pools/liquidity or aggregator deployment. Active backend configuration is unchanged. Those next steps require their separately scoped authorization.

## Durable artifacts

- Completed real manifest: docs/evidence/contracts-testnet-deployment-2026-11-02.json. In the contracts checkout this is deployments/testnet.json.
- Complete receipt/fee checkpoint: docs/evidence/contracts-testnet-completion-2026-11-02.json. The November 1 attempt remains historical evidence.
- Exact optimized deployment WASM: docs/evidence/contracts-testnet-wasm-2026-11-02.tar.gz. Rebuilt WASM matched the original uploads exactly.
- Verification fix and regression assertion: docs/evidence/contracts-sdk-hash-verification-fix.patch. The SDK requires a 32-byte Buffer for getContractWasmByHash, rather than a hex string. Router initialization succeeded before this verification error; finalization reused all receipts without signing or submitting anything further.
- Deployment-tool tests passed after the fix, before the manifest was written. The existing wrapper test assumes the checkout has no completed manifest.

## Source and Git recovery

Contracts checkout: /tmp/veltrixae-contracts-work, branch work/testnet-deployment-readiness, origin https://github.com/VELTRIXAE/Contract.git. Its push was rejected with HTTP 403 for the authenticated GitHub account Novastrum1. User approval/ownership is clear; the session credential still needs repository write access.

The verified bundle docs/evidence/contracts-deployment-work.bundle preserves all local contracts commits on top of public base c834dbe7efa42e64289ce8337ba2a37352220d9f. Recover in a fresh contracts checkout if needed:

```sh
git fetch /path/to/Aggregator-and-Backend/docs/evidence/contracts-deployment-work.bundle work/testnet-deployment-readiness
git switch -c work/testnet-deployment-readiness FETCH_HEAD
```

Secrets remain in the Stellar CLI keystore, never the bundle or either repository. Identity: veltrixae-deployer. Public source/fee setter: GCOK3K62FKMGHI4AJRRNEN6WJQUERE5ZPOHEKF6BB5M4GH3BDCQQMXFL. Configure the existing CLI identity locally; never print or request its secret material.


## Recovery after temporary-directory cleanup

Recover the contracts branch from the bundle as above, apply the saved SDK verification patch, restore the completed manifest to deployments/testnet.json, and extract the WASM archive to target/wasm32v1-none/release. The hash fix is currently uncommitted in the temporary contracts checkout and preserved as a patch here. No push was attempted this session.

The completed manifest retains original build commit 133b18d00505108c26382cb44045abab48b51882. Recheck Testnet state read-only before any backend import or subsequent separately authorized deployment. Never use the old six-receipt attempt to resume now that initialization is complete.
