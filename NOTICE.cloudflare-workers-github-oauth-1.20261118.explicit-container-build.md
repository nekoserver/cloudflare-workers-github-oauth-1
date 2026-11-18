# NOTICE: デモコンテナの明示ビルド付きデプロイスクリプト

日付: 2026-11-18
SPEC: SPEC.cloudflare-workers-github-oauth-1.container-image-explicit-build 版2（U1 は Workers Builds のビルドコマンドに追加、で決定）

## 背景

- 2026-11-18 14:28 のデプロイログで実証: wrangler deploy は Dockerfile が現行ピンと異なってもコンテナを「no changes」と判定し、2026-11-11 ビルドの digest（c945ea02…）を再利用する。このためピンが進んでも稼働イメージは変わらない。

## 追加内容

- `scripts/deploy-with-container-build.sh`: Workers Builds のビルドコマンドを `bash scripts/deploy-with-container-build.sh` に変えて使う。
  1. 入力ハッシュ（demo-image-lock --print-context）からタグ ctx-<12桁> を作る。
  2. タグが registry になければ `wrangler containers build -p` で明示ビルドして push する（あれば作らない）。
  3. タグの digest を取り出し、wrangler.toml の image を digest 固定し、demo-image-lock --write で image.lock.json を再記録する。
  4. `wrangler deploy` する。最後に CONTAINER_IMAGE=<ref@digest> を出力する。
  - ビルド / push / digest 取得のいずれかが失敗したら、その時点で中止し、構成は旧 digest のまま。
- `src/cf-containers-deploy-script.test.ts`: 上記の配線（タグ生成、明示ビルド、--write が deploy より前）を固定するテスト 3 件。

## 検証

- テスト: 3/3 通過（先に失敗を確認してから実装）。
- ローカル模擬: タグ生成、wrangler.toml の digest 固定、--write、--check の OK までを通しで確認した。
- 未検証（実経路）: Builds 環境での `wrangler containers build -p` と `images list --json` の出力形式、deploy の結果。ビルドコマンドを切り替えて最初のビルドで確認する。
- 前提チェック（PR #2649 のロック照合）は、この仕組みで新しいイメージが記録されるまで赤いまま（設計どおり）。

## 残作業（ダッシュボード側）

- Workers Builds のビルドコマンドを `bash scripts/deploy-with-container-build.sh` に変更する。
- 最初のビルド後、出力された digest をリポジトリ側の wrangler.toml / image.lock.json にも記録する（追随 PR）。
