# 調査報告: `/status` で migration `0025` が表示されない事象

- 調査日: 2026-04-01
- 調査ブランチ: `investigation/0025-not-visible-main-safe`
- 対象: `commit_agent_log`（migration `0025`）が `/status` の「テーブル別マイグレーション状況」から消えるケース

## 結論（原因）

`0025` が消える主因は、**表示元データ（`data.tables`）に `commit_agent_log` が含まれない経路が存在したこと**。

具体的には以下の複合要因。

1. `/status` の一覧は `data.tables` をそのまま描画しており、欠落時の強制補完がなければ `0025` 行が出ない。
2. 競合解消・表示差分・定義差分（`STATUS_TABLE_DEFINITIONS` と `table_catalog` 側の差）で `commit_agent_log` が脱落すると、そのまま UI から見えなくなる。
3. `table_catalog` 由来のマッピングが未投入/不整合だと、`commit_agent_log` のグループ・表示関連の情報解決も崩れやすい。

## 現在コードで確認できる再発防止（2026-04-01 時点）

再発防止として、以下の3層ガードが実装済みであることを確認。

1. **定義層**: 必須テーブル定義 `REQUIRED_STATUS_TABLE_DEFINITIONS` で `commit_agent_log` を補強。
2. **集計層（API）**: `/status` データ生成時、`data.tables` に `commit_agent_log` が無ければ `migration: '0025'` 行を補完追加。
3. **描画層（View）**: 最終描画直前でも `statusTables` に `commit_agent_log` が無い場合は表示側で補完。

## テスト観点

`src/views/status-warning.test.ts` で、`commit_agent_log` 行が欠ける入力でも `>0025<` を含む HTML になることを検証済み。

## main とのコンフリクト回避方針

本調査は新規ブランチで実施。
コードへの機能変更は加えず、調査内容のみを文書化しているため、`main` への影響は最小。

