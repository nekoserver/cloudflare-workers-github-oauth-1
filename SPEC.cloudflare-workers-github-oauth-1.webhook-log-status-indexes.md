# SPEC.cloudflare-workers-github-oauth-1.webhook-log-status-indexes — webhook_logへのインデックス追加(migration 0162)

## 1. `webhook_log`の`status`絞り込みクエリを高速化するインデックスを追加

**対象**: `src/index.ts`の`STATUS_MIGRATION_SQL`(migration `0162`) — 姉妹Worker(`rust-worker-sqlx-d1`)の`/sqlx-d1-examples`ページが指摘した改善提案のうち、リスクが無く即座に対応できるもの(インデックス追加)を実施した。

### 背景

`webhook_log`の既存インデックスは`source`と`received_at`のみ(migration `0061`)。`/sqlx-d1-examples`ページだけで、`status`を絞り込み条件に使うクエリが5つ存在する(送信元×ステータス、IN句、AND(ステータス×日時)等)。`status`にインデックスが無いため、これらは全件スキャンになっている。

### 追加したインデックス

```sql
CREATE INDEX IF NOT EXISTS idx_webhook_log_status ON webhook_log(status);
CREATE INDEX IF NOT EXISTS idx_webhook_log_source_status ON webhook_log(source, status);
CREATE INDEX IF NOT EXISTS idx_webhook_log_status_received_at ON webhook_log(status, received_at);
```

- `idx_webhook_log_status`: `WHERE status = ?`・`WHERE status IN (...)`単体の絞り込み用
- `idx_webhook_log_source_status`: `WHERE source = ? AND status = ?`のAND複合条件用
- `idx_webhook_log_status_received_at`: `WHERE status = 'error' AND received_at >= ?`(直近の障害抽出)や`ORDER BY received_at`との組み合わせ用

## 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `STATUS_MIGRATION_SQL`に`'0162'`エントリを追加(このリポジトリの`STATUS_MIGRATION_SQL`は`/status`ページの「このSQLを実行」機能で参照される登録簿であり、追加しただけではD1へは自動適用されない。実際の適用はユーザーが下記SQLをD1で実行する必要がある) |
| `SPEC.cloudflare-workers-github-oauth-1.webhook-log-status-indexes.md` | 本変更のSPECファイル |

## 実行が必要なSQL

このリポジトリの`STATUS_MIGRATION_SQL`はデプロイされても自動実行されない(`/status`ページでSQLを表示するための登録簿)。以下をD1コンソールまたは`wrangler d1 execute`でそのまま実行してください。

```sql
CREATE INDEX IF NOT EXISTS idx_webhook_log_status ON webhook_log(status);
CREATE INDEX IF NOT EXISTS idx_webhook_log_source_status ON webhook_log(source, status);
CREATE INDEX IF NOT EXISTS idx_webhook_log_status_received_at ON webhook_log(status, received_at);
```

## テスト・検証

- `npx vitest run src/db-table-registry-completeness-20260728.test.ts src/api-endpoint-stats.test.ts`: migration番号の重複・欠落を検査するテストを含めて実行。既存の失敗3件(`d1_query_catalog_0154_new`関連、`git stash`で本変更前でも同じ失敗を確認済み)は本変更と無関係。本変更に起因する新規失敗は0件
- `npx tsc --noEmit`: `src/index.ts`に起因するエラー0件(他の既存失敗は本変更と無関係なテストファイル)

## 今回は対応しなかった改善提案とその理由

`/sqlx-d1-examples`側のSPECで提案した残り4項目は、リスク・要判断事項があるため今回は見送った。

- **`status`へのCHECK制約**: SQLiteの制約上、既存の`webhook_log`テーブルへCHECK制約を後付けするにはテーブルの作り直し(新テーブル作成→データコピー→旧テーブル削除→リネーム)が必要。ライブで書き込みが続くテーブルに対してこの手順を安全に行うには、書き込みを一時停止するか十分なメンテナンス計画が要る。データ消失リスクがあるため、実行のタイミングはユーザーの判断に委ねたい
- **保持期間(retention)の自動削除**: 新たにCron Triggerを追加し定期的にデータを削除する仕組みが必要。「何日分残すか」という運用ポリシーの決定がユーザー側に必要なため、今回は実装していない
- **`delivery_id`カラムの追加**: `logWebhookEvent()`と13箇所の呼び出し元すべてに影響する変更で、GitHub以外の送信元(cf-auth・cf-wh1・resend)には同等の識別子が無く設計判断が必要。今回のスコープでは見送った
- **`duration_ms`(処理時間)の記録**: 同様に多くの呼び出し元へ計測コードを追加する必要があり、今回のスコープでは見送った

これらが必要であれば、個別に依頼してください。
