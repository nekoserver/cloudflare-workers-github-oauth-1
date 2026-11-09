# 世界遺産機能の別リポジトリ化

別リポジトリ: https://github.com/nekoserver/world-heritage （非公開）。
基点は `0f75c990`。本番反映は未実施。

4画面、47ルート、世界遺産マスタと専用補助処理、関連テストを移動した。
本体は既存URLを `HERITAGE` Service Bindingへ転送する。
別Workerは `MAIN` Bindingから本体の `/api/heritage/auth-context` を呼び、既存の
Cookie/Bearer認証・失効判定を使う。応答はユーザーIDのみで、JWTの中身は返さない。

DBは既存D1 `workers-github-oauth` を共通利用する。データ移行なし。
マイグレーション・DB管理・状態表示とそのテストは本体に残す。
空港・鉄道・都市など、他画面も使う共通データは両リポジトリにコピーを持つ。

## サイズ

本体 `src/index.ts`: 29,318 → 27,722行（1,596行減）。
同条件のローカルesbuild比較（Wasm別ファイル、非minify）では、JavaScriptが
11,664,048 → 10,275,740 bytes（約11.9%減）、gzipが
2,134,887 → 1,819,279 bytes（約14.8%減）。本番アップロード値ではない。

## 検証

- 本体側の対象6ファイル・38テスト成功。
- 別Worker側の対象18ファイル・228テスト成功（CPU負荷を考慮し60秒制限）。
- 別リポジトリの依存インストール・本番コードの型検査成功。
- 別WorkerのWrangler dry-run成功（Upload 1659.56 KiB / gzip 362.23 KiB）。実配備はしていない。
- 4画面の生成JavaScript、5 scriptを `node --check` で検証。画面のソース自体は移動のみ。
- 本体全体の型検査は既存エラーが残る。基点95診断、変更後76診断、新規診断0件。
- 本体全体テスト・Dockerビルド・本番D1操作・本番ブラウザ確認は未実施。

詳細な失敗履歴と制約は別リポジトリの `EXTRACTION-REPORT.md` に記載した。

## 配備と切り戻し

先に新Workerを同一Cloudflareアカウントへ配備する。その後、この本体変更を配備する。
本体の認証APIが存在するまでは、新Workerの認証は成功しない。
新Workerの `workers.dev` とpreview URLは無効。本体からのService Bindingを入口にする。
本番反映時に4画面・保存/削除・設定・旅程・AI連携・認証失効を確認する。
不具合時は本体を旧配備に戻す。共通D1なのでデータのコピーし直しは不要。

## コンテナ

- 再ビルド: 不要。コンテナのコード・Dockerfile・`[[containers]]` は変更していない。
- 再起動: 不要。コンテナが起動時に読む値は変更していない。

Workerのデプロイは必要。この環境でDockerビルドは実施していない。
