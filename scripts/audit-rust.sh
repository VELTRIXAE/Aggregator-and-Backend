#!/usr/bin/env bash
# Scans the Rust lockfiles against RustSec. Fails on any advisory that is not in config/rust-advisories.json, on a listed
# advisory whose review date has passed, on one that is no longer found, and if a scan cannot run. Listed advisories are
# printed every time, and nothing is passed to cargo-audit as an ignore. Read-only.
set -euo pipefail
cd "$(dirname "$0")/.."
known=config/rust-advisories.json
today=$(date -u +%F)
scan_dir=$(mktemp -d)
trap 'rm -rf -- "$scan_dir"' EXIT
status=0
found_all="$scan_dir/found"
: > "$found_all"
for lockfile in contract-tests/Cargo.lock upstream/soroswap/contracts/Cargo.lock; do
  report="$scan_dir/report.json"
  # cargo-audit exits non-zero when it finds advisories, so success is judged from its report.
  cargo-audit audit --file "$lockfile" --json > "$report" 2> "$scan_dir/stderr" || true
  if [[ ! -s "$report" ]] || ! jq -e '.vulnerabilities.list | type == "array"' "$report" > /dev/null 2>&1; then
    echo "FAIL $lockfile: the scan did not produce a report"; cat "$scan_dir/stderr"; exit 1
  fi
  echo "== $lockfile"
  jq -r '.warnings | to_entries[] | .key as $kind | .value[] | "warning (\($kind)): \(.package.name) \(.package.version)"' "$report" | sort -u
  while IFS=$'\t' read -r id package version title; do
    echo "$id" >> "$found_all"
    entry=$(jq -c --arg id "$id" '.advisories[] | select(.id == $id)' "$known")
    if [[ -z "$entry" ]]; then
      echo "FAIL new advisory: $id $package $version: $title"; status=1
    elif [[ $(jq -e -r --arg lockfile "$lockfile" '.lockfiles | index($lockfile) != null' <<<"$entry") != true ]]; then
      echo "FAIL $id appears in a lockfile that is not listed: $package $version"; status=1
    else
      echo "known advisory, unresolved: $id $package $version (review by $(jq -r .review_by <<<"$entry")): $title"
    fi
  done < <(jq -r '.vulnerabilities.list[] | [.advisory.id, .package.name, .package.version, .advisory.title] | @tsv' "$report")
done
while IFS=$'\t' read -r id review_by; do
  if [[ "$review_by" < "$today" ]]; then echo "FAIL $id review date $review_by has passed: re-review it in docs/RUST_ADVISORIES.md"; status=1; fi
  if ! grep -qx "$id" "$found_all"; then echo "FAIL $id is listed but no longer found: remove it from $known"; status=1; fi
done < <(jq -r '.advisories[] | [.id, .review_by] | @tsv' "$known")
exit "$status"
