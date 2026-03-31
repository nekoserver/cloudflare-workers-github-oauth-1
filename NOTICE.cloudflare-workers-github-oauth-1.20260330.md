# NOTICE — 2026-03-30

## 1. table_catalog / table_column_keys / table_group_permissions の用途

### table_catalog

**用途**: 全テーブルのグループ分け・メタ情報を格納するカタログテーブル。

任意のテーブルを起点に「そのテーブルが属するグループの全テーブル」を即座に引ける。特定テーブルの構造やリレーションを再評価するとき、関係ないグループのテーブルを視界から排除し、対象グループに集中できる。

例: `ai_summary_reviews` を調査中 → 同グループ(`ai`)の `ai_summary_log` だけが視界に入る。`email_send_log` 等は表示されない。

### table_column_keys

**用途**: 全テーブルの全カラムのPK/FK定義を格納する。

`/status` モーダルのヘッダーにPK/FKバッジを表示するための情報源。また、あるテーブルのFK先を辿ってグループ横断の関連テーブルを自動抽出できる。

例: `ai_summary_reviews.summary_request_id` → FK先は `ai_summary_log` → グループをまたいだ依存関係が明示される。

### table_group_permissions（将来）

**用途**: ロール別にテーブルグループへのアクセス権限を制御する。

`/status` モーダルで「このロールの人にはこのグループのテーブルを見せない」「参照のみ許可する」を実現する。UIレベルの制御であり、D1レベルのRBACではない。

例: ロール `guest` には `email` グループを `none`（非表示）に設定 → メール関連テーブルがモーダルにも API レスポンスにも表示されない。

## 2. マイグレーション0024の実行順序

table_column_keys は table_catalog への FK を持つため、以下の順序を厳守すること：

1. CREATE TABLE（0024のDDL）
2. table_catalog への INSERT（24行）
3. table_column_keys への INSERT（34行）

順序を間違えるとFK制約違反でINSERTが失敗する。

## 3. セッション無操作タイムアウト（デフォルト30分）の適用条件

無操作タイムアウトの30分デフォルトは、以下のどちらかの場合にのみ使う：

1. `SESSION_IDLE_TIMEOUT_SECONDS` が未設定または不正値
2. `/settings` で保持している `user_session_duration` が確認できない

上記以外（= 環境変数または `/settings` の値が確認できる場合）は、30分デフォルトを適用しない。
具体的には、環境変数があればそれを優先し、環境変数がなければ `/settings` のセッション有効期限値を無操作タイムアウト値として使う。
