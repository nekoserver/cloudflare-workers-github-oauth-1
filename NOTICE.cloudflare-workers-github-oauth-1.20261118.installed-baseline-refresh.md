# NOTICE: パッケージ新版状況の照合で、導入版の基準が古いまま固定される不具合の是正

日付: 2026-11-18
対象: `POST /api/cf-containers/package-release-status/check`、`src/utils/cfContainerInstalledBaseline.ts`（新規）、`src/views/cfContainers.ts`

## 不具合

照合は「配布元の最新版」と「今入っている版」を突き合わせるが、入っている版の基準は
画面のヘルスチェックで記録されたスナップショット（`getLatestVersionSnapshot`）だけだった。
スナップショットは、ヘルスチェックが成功したときにしか記録されない。結果として、
ヘルスチェックが押されない期間は基準が古いまま固定され、ページを開くたびに照合が
走っても、判定は古い基準との比較になっていた。実際、2026-11-11 の記録が 1 週間残り、
稼働コンテナの実態（旧イメージの版）と repo の固定版の食い違いを、この処理系は
検出できなかった。6 時間 cron のスナップショットは基準の対象外で、しかもその版は
最後のヘルスチェック記録の複写であるため、cron では回復しない。

## 是正

- 照合の前に、基準の新しさを判定する。基準が 6 時間（cron の周期）を超えて古い場合に限り、
  コンテナが既に稼働中なら、その /health から実測の版を取り直し、記録者
  `system:release-check` でスナップショットに記録して、新しい基準で照合する。
- コンテナが停止中なら起動はしない（ページ表示を契機にコンテナを起動しないという
  従来の設計を守る）。その場合は従来どおり古い基準で照合し、基準の時刻は応答と
  画面に表示される。
- 取り直しに失敗した場合は古い基準で照合し、応答に `installedRefreshError` を残す。
- 応答に `installedRefreshed` を追加し、画面の記録ログにも取り直しを表示する。

## 検証

- 新規テスト `src/cf-containers-installed-baseline.test.ts` 9 件（新しい基準では問い合わせない、
  停止中は起動しない、稼働中は取り直す、失敗時は古い基準のまま、health 応答の変換）。
  実装前に失敗を確認してから実装した。
- `npx vitest run src/cf-containers`: 345/346。失敗 1 件は
  `cf-containers-t3-pwa-diagnose-browser.test.ts` で、この VM に Chromium が無いための
  既存の環境要因（本変更前から同じ）。
- `tsc --noEmit` の `src/index.ts` のエラー件数は、変更前後とも 10 件で増えていない
  （いずれも本変更と無関係の既存エラー）。

## 未検証

- 本番での実挙動（デプロイ後に /cf-containers を開き、導入版が取り直されること）は
  未検証。デプロイとページ表示の後に、応答の `installedRefreshed` と
  `installedSnapshotAt` で確認できる。
