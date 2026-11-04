# Rust advisories

Two RustSec advisories are outstanding. **Neither is fixed, ignored or suppressed.** No `audit.toml`, `.cargo/audit` exception or ignore flag exists in this repository, and `npm audit` remains a CI gate. Checked 2026-11-04 with cargo-audit 0.22.2. Rerun rather than relying on this page.

```sh
cargo install --locked cargo-audit
cargo audit --file contract-tests/Cargo.lock
cargo audit --file upstream/soroswap/contracts/Cargo.lock
```

## Outstanding advisories

| Advisory | Package | Patched in | Lockfiles | In contract WASM? |
| --- | --- | --- | --- | --- |
| [RUSTSEC-2026-0387](https://rustsec.org/advisories/RUSTSEC-2026-0387.html): timing variability in operations meant to be constant-time | `crypto-bigint` 0.5.5 | >= 0.7.6 | `contract-tests`, upstream | No |
| [RUSTSEC-2026-0009](https://rustsec.org/advisories/RUSTSEC-2026-0009.html): denial of service via stack exhaustion | `time` 0.3.36 | >= 0.3.47 | Upstream only | No |

### RUSTSEC-2026-0387

```text
crypto-bigint 0.5.5
└── elliptic-curve 0.13.8
    └── ecdsa, k256
        └── soroban-env-host
            └── soroban-ledger-snapshot
                └── soroban-sdk (test utilities)
```

- **Reach:** `cargo tree -e normal` for the WASM targets finds no `crypto-bigint`. It is on the host and test side, and in `contract-tests` it comes only through dev-dependencies.
- **Exposure here:** this repository's Rust runs in tests with no secrets. The API is TypeScript and does not use this crate. This says nothing about other software using the same host code.
- **Why it is unfixed:** `elliptic-curve` 0.13 requires `crypto-bigint` 0.5, so the patched range cannot be selected. VELTRIXAE/Contract's [dependency review](https://github.com/VELTRIXAE/Contract/blob/main/docs/DEPENDENCY_SECURITY.md) reached the same result, and open Contract PR #11 reports that SDK versions up to 30.0.0-rc.1 still resolve to 0.5.5. The fix has to come from the Stellar host dependency chain.
- **Do not:** patch cryptography locally or force an incompatible override.

### RUSTSEC-2026-0009

- **Reach:** in the upstream lockfile `time` is required only by `serde_with`, and `cargo tree -i time` across all targets and the workspace prints nothing. It is locked but not in the build as currently configured.
- **Why it is unfixed:** that lockfile belongs to the pinned upstream submodule. Changing it means moving the upstream pin or carrying a local patch, which needs its own review.
- **Caveat:** this conclusion depends on the feature set used. Rerun it if the pin or features change.

## Warnings

These are not vulnerabilities and are also recorded rather than suppressed.

| Kind | Packages |
| --- | --- |
| Unmaintained | `paste` 1.0.15 (both), `derivative` 2.2.0 (upstream) |
| Unsound | `keccak` 0.1.5, `rand` 0.8.5 (both) |
| Yanked | `keccak` 0.1.5, `spin` 0.9.8 (both) |

Their reach has not been analysed individually.

## Current limits and next steps

- **CI does not scan Rust dependencies yet.** Adding that without either a permanently red job or a hidden exception needs a decision: see [issue draft 10](issues/10-rust-advisories-ci.md).
- **VELTRIXAE/Contract's** advisory gate is expected to stay red on RUSTSEC-2026-0387, per its review.
- **Reachability is not exploitability analysis.** No one has performed an independent review of these findings.
- **Review again** when `soroban-sdk`, `soroban-env-host` or the upstream pin changes, and before any release claim.
