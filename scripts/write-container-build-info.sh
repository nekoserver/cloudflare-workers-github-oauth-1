#!/bin/sh
# wrangler.tomlの[build]から、Dockerのビルドより前に呼ばれる。
# どのコミット・ビルドから作ったイメージかを/healthで見られるよう、ビルドコンテキストに書き出す。
# Workers Buildsでは WORKERS_CI_* が渡される。ローカルではgitから補う。
set -eu
OUT="$(dirname "$0")/../containers/demo/build-info.json"
COMMIT="${WORKERS_CI_COMMIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
BRANCH="${WORKERS_CI_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)}"
BUILD_UUID="${WORKERS_CI_BUILD_UUID:-local}"
printf '{"commit":"%s","branch":"%s","buildUuid":"%s","builtAt":"%s"}\n' \
  "$COMMIT" "$BRANCH" "$BUILD_UUID" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$OUT"
cat "$OUT"
