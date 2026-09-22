#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
script="$repo_root/scripts/audit-local-branches.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

git -C "$tmp" init -q -b main
git -C "$tmp" config user.name test
git -C "$tmp" config user.email test@example.com
printf 'base\n' >"$tmp/file.txt"
git -C "$tmp" add file.txt
git -C "$tmp" commit -qm base

git -C "$tmp" branch merged-topic
git -C "$tmp" switch -qc open-topic
printf 'open\n' >>"$tmp/file.txt"
git -C "$tmp" commit -qam open
git -C "$tmp" switch -q main

output=$(cd "$tmp" && "$script" --base main)
grep -Eq '^merged +0 +0 +merged-topic ' <<<"$output"
grep -Eq '^unmerged +1 +0 +open-topic ' <<<"$output"
grep -q 'Summary: 1 unmerged, 2 merged' <<<"$output"
git -C "$tmp" show-ref --verify --quiet refs/heads/merged-topic

delete_output=$(cd "$tmp" && "$script" --base main --delete-merged)
grep -q '^deleted: merged-topic$' <<<"$delete_output"
grep -q 'Summary: 1 unmerged, 2 merged, 1 deleted' <<<"$delete_output"
! git -C "$tmp" show-ref --verify --quiet refs/heads/merged-topic
git -C "$tmp" show-ref --verify --quiet refs/heads/main
git -C "$tmp" show-ref --verify --quiet refs/heads/open-topic

echo 'audit-local-branches tests passed'
