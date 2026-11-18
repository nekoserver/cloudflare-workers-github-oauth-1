#!/usr/bin/env bash
# デモコンテナの明示ビルド付きデプロイ。
# SPEC: SPEC.cloudflare-workers-github-oauth-1.container-image-explicit-build
#
# Workers Builds のビルドコマンドを `bash scripts/deploy-with-container-build.sh` に変えて使う。
# wrangler deploy の変更判定（「no changes」で旧イメージを再利用する）に頼らず、
# 入力ハッシュのタグが registry になければ明示ビルドして push し、
# wrangler.toml と image.lock.json を新しい digest に固定してから deploy する。
# ビルドまたは push が失敗したら、その時点で中止し、構成は旧 digest のままになる。
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE_NAME="cloudflare-workers-github-oauth-1-democontainer"
ACCOUNT_ID="4eb48547c6f6a8194e6c3eb5e700463f"
REGISTRY="registry.cloudflare.com/${ACCOUNT_ID}/${IMAGE_NAME}"

# 入力（Dockerfile と packages/）のハッシュから、内容で決まるタグを作る。
CTX_SHA="$(node scripts/demo-image-lock.mjs --print-context | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).contextSha256))")"
TAG="ctx-${CTX_SHA:0:12}"
echo "container inputs ${CTX_SHA} -> tag ${TAG}"

images_json="$(npx wrangler containers images list --json)"
if printf '%s' "${images_json}" | grep -q "${TAG}"; then
  echo "image ${IMAGE_NAME}:${TAG} is already in the registry; skipping build"
else
  npx wrangler containers build -p -t "${IMAGE_NAME}:${TAG}" containers/demo
  images_json="$(npx wrangler containers images list --json)"
fi

# タグに対応する digest を取り出す。取れなければ中止する。
DIGEST="$(printf '%s' "${images_json}" | TAG="${TAG}" node -e "
let s='';
process.stdin.on('data',d=>s+=d).on('end',()=>{
  const tag=process.env.TAG;
  const walk=(v)=>{
    if (Array.isArray(v)) { for (const e of v) { const r=walk(e); if (r) return r; } return null; }
    if (v && typeof v==='object') {
      const str=JSON.stringify(v);
      if (str.includes(tag)) { const m=str.match(/sha256:[0-9a-f]{64}/); if (m) return m[0]; }
      for (const e of Object.values(v)) { const r=walk(e); if (r) return r; }
    }
    return null;
  };
  const d=walk(JSON.parse(s));
  if (!d) { console.error('digest not found for tag '+tag); process.exit(1); }
  console.log(d);
});")"
IMAGE_REF="${REGISTRY}@${DIGEST}"
echo "container image ${IMAGE_REF}"

# wrangler.toml の image を digest 固定へ。現在が Dockerfile パスの場合は先に差し替える
# （demo-image-lock.mjs --write は registry 固定行を前提とする）。
if grep -q '^image = "./containers/demo/Dockerfile"' wrangler.toml; then
  sed -i "s|^image = \"./containers/demo/Dockerfile\"|image = \"${IMAGE_REF}\"|" wrangler.toml
fi
node scripts/demo-image-lock.mjs --write --image "${IMAGE_REF}" --built-from "Workers Builds explicit build (tag ${TAG})"

npx wrangler deploy
echo "CONTAINER_IMAGE=${IMAGE_REF}"
