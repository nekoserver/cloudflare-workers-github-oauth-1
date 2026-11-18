# NOTICE: 前提チェック（ロックと入力の一致）をガードへ配線

日付: 2026-11-18
対象: `src/cf-containers-image-lock.test.ts`、`src/cf-containers-demo-auto-build.test.ts`

## 背景

- ピンが最新でも稼働コンテナに適用されず、その状態がどの検査もすり抜けていた。
- 原因のひとつ: `demo-image-lock.mjs --check`（ロックと現在の入力の一致）は、フィクスチャでの単体テストしかなく、実リポジトリに対して回す主体がなかった。実測では --check は exit 1（REBUILD: apache 2.4.71 / git 2.56.1 等が未反映）。
- 利用者決定（2026-11-18）: 前提チェックとしてガードに入れ、ロックを更新するまで落ちる状態を正とする。

## 変更

- image-lock テストに前提チェックを追加: 実リポジトリで `demo-image-lock.mjs --check` を実行し、0 でなければ失敗する。
- demo-auto-build テストの container-image ワークフロー前提を是正: 削除済み（Actions は使わない）のため「存在しないこと」を assert する形に変更。demo-packages 側の assert は不変。

## 現在の状態

- 前提チェックは現行 main で失敗する（ロックが 2026-11-11 のイメージのまま）。これは欠陥ではなく、未反映を可視化するための意図した赤。
- 緑になる条件: Workers Builds で現行 Dockerfile のビルドが成功し、その digest で `scripts/demo-image-lock.mjs --write` を実行してロックを記録し直すこと。
- demo-auto-build 側は全通過。前提チェック以外の image-lock テストも通過。
