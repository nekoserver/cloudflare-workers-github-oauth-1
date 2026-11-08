#!/bin/bash
# Workers Buildsのデプロイの命令(ダッシュボード: Workers → Settings → Builds → Deploy command に `bash scripts/workers-deploy.sh` を設定する)。
# ユーザー指定(2026-11-08)「不要ならビルド指示をつけるな」: mainへのマージごとに、Worker側だけの変更でも
# コンテナのイメージが作り直され、コンテナが入れ替わっていた(本番D1: #2544のマージ3秒後にビルド57段)。
# コンテナに関わるファイルが変わったときだけ通常の wrangler deploy でイメージを作る。それ以外は
# wrangler deploy --containers-rollout=none で、Workerだけをデプロイする(公式: イメージのビルド・送信と入れ替えを飛ばす)。
# 差分が分からないとき(浅いクローンなど)は安全側で通常のデプロイにする。FORCE_CONTAINER_BUILD=1 なら常にイメージを作る。
# テスト用: WORKERS_DEPLOY_CHANGED(変わったファイルの一覧、__UNKNOWN__ で取得失敗)、WORKERS_DEPLOY_DRY_RUN=1(実行せず命令だけ出す)。
set -eu

CONTAINER_PATHS_RE='^(containers/|src/containers/|wrangler\.toml$)'

if [ -n "${WORKERS_DEPLOY_CHANGED+x}" ]; then
  changed="$WORKERS_DEPLOY_CHANGED"
elif changed=$(git diff --name-only HEAD^1 HEAD 2>/dev/null); then
  :
else
  changed="__UNKNOWN__"
fi

full=0
if [ "${FORCE_CONTAINER_BUILD:-}" = "1" ]; then
  echo "workers-deploy: FORCE_CONTAINER_BUILD=1 のため、イメージを作る"
  full=1
elif [ "$changed" = "__UNKNOWN__" ]; then
  echo "workers-deploy: 直前のコミットとの差分を取れないため、安全側でイメージも作る"
  full=1
else
  hits=$(printf '%s\n' "$changed" | grep -E "$CONTAINER_PATHS_RE" || true)
  if [ -n "$hits" ]; then
    echo "workers-deploy: コンテナに関わるファイルが変わったため、イメージを作る:"
    printf '  %s\n' $hits
    full=1
  else
    echo "workers-deploy: コンテナに関わるファイルの変更が無いため、Workerだけをデプロイする(イメージのビルドとコンテナの入れ替えをしない)"
  fi
fi

if [ "$full" = "1" ]; then deploy=(npx wrangler deploy); else deploy=(npx wrangler deploy --containers-rollout=none); fi
echo "DEPLOY: ${deploy[*]}"
if [ "${WORKERS_DEPLOY_DRY_RUN:-}" = "1" ]; then exit 0; fi
exec "${deploy[@]}"
