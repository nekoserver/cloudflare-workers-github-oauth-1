# NOTICE: /cf-containers の再起動中コメントを黄色で点滅させる

日付: 2026-11-18
対象: `src/views/cfContainers.ts`

## 変更

- 再起動ボタンを押すと、ログ欄の文言を「再起動中…」にし、クラス `restarting` を付ける。
- `#log.restarting` は、警告色（`var(--warn)`、黄色系）で、既存の `status-blink`
  アニメーション（ビルド中表示と同じ 1 秒周期）で点滅する。
- 再起動の応答が返った時点（完了・失敗のどちらでも）でクラスを外し、点滅を止める。
- 起動・停止の表示は従来どおり。

## 検証

- 新規テスト `src/cf-containers-restart-log.test.ts` 2 件（CSS ルールの存在と、
  再起動時だけクラスを付け外しする配線）。実装前に失敗を確認してから実装した。
- `npx vitest run src/cf-containers`: 338/339。失敗 1 件は
  `cf-containers-t3-pwa-diagnose-browser.test.ts` で、この VM に Chromium が無いための
  既存の環境要因（本変更前から同じ）。

## 未検証

- 本番ページでの見え方は未検証（デプロイ後に再起動ボタンを押して確認する）。
