# NOTICE.cloudflare-workers-github-oauth-1.20260915

## APIキー発行の PK期限 はログイン時と同じ upsert

**対象**: `POST /api/api-keys` と `POST /webhook/cf-auth` の `countdown_events` 登録。

ログイン時の `cf-auth 期限` は、同じ `user_id` + 予定名の行があれば `target_at` だけ更新する。
APIキー発行の `PK期限` も同じ `upsertCountdownEvent` を使う。発行のたびに行は増えない。

- 有効期限付きキー: 予定名 `PK期限`、日時は発行した `expires_at`
- 無期限キー: 登録しない
- 予定名が違えば別行。`cf-auth 期限` と `PK期限` は共存する
- 同じユーザーが期限付きキーを出し直すと、`PK期限` の日時は最新キーの期限で上書きされる
