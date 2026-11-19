# 会話ストリームの接続先: 台帳と D1 の上書き

**対象**: 会話ストリームの接続先(AIチャットのパネル・tree-view のワーカータブが埋め込む lib のホスト) — 台帳ファイル `src/data/conversation-stream-routes.json` を既定とし、D1 `conversation_stream_hosts`(マイグレーション 0194)で上書きする仕組みと、その管理 API。

## 決め方

| 段 | 内容 |
|---|---|
| 既定 | 台帳 `src/data/conversation-stream-routes.json`。不正なら今までどおり止める(ヘルスチェックは 500、AIチャットは `frame-src` に接続先を入れない) |
| 上書き | D1 `conversation_stream_hosts` の行。同じ ID は origin・表示名を上書き(選択肢の位置は台帳のまま)、台帳に無い ID は選択肢の末尾に追加、`enabled=0` はその接続先を外す |
| 自動選択 | 台帳の `autoPriority` の先頭から 10, 20, … の優先度。D1 の有効な行は、その行の `priority` で自動選択の候補になる。優先度の昇順(同じなら ID 順) |
| 元に戻す | D1 の行を消すと、その ID は台帳の値に戻る |

D1 に行が無ければ、結果は台帳とまったく同じになる。2026-11-04 の変更(使っていない接続先を確認しない。台帳の `autoPriority` は `mygw` だけ)も、そのまま保たれる。

同じ結果を、次のすべてが使う(`src/utils/conversationStreamRegistry.ts` の `loadConversationStreamRoutes`)。

- `GET /api/aichat/conversation-stream/health`(ヘルスチェック。経路 ID `via=health` を付ける)
- `GET /aichat`(CSP の `frame-src` と、パネルに渡す接続先)
- `GET /api/tree-view/conversation-stream-routes-external`(tree-view へ渡す接続先)

## 台帳だけで動くとき

次のときは台帳だけで動き、応答の `registry` に理由を載せる。ログ(`logger.warn`)にも残す。

| 状況 | `registry` |
|---|---|
| D1 のバインドが無い | `{ "source": "ledger", "overrides": 0, "skipped": [] }` |
| 表が無い(0194 未適用)・D1 が読めない | `error: "registry_unavailable"`、`detail` に D1 のエラー文 |
| D1 の上書きで有効な接続先がなくなる | `error: "no_enabled_routes"` |
| 不正な行がある | その行だけ使わず、`skipped` に `{ id, errorCode }` を載せる。ほかの行は使う |

上書きが効いているときは `{ "source": "ledger+d1", "overrides": <使った行数>, "skipped": [...] }`。

## 管理 API

| メソッド・パス | 誰が | 内容 |
|---|---|---|
| `GET /api/aichat/conversation-stream/hosts` | ログインした利用者 | D1 の行(`hosts`)、合わせた結果(`routes`・`autoPriority`)、`registry` |
| `POST /api/aichat/conversation-stream/hosts` | 管理者 | 行を足す。ID か URL が既にあれば 409、50 件まで |
| `PUT /api/aichat/conversation-stream/hosts/:id` | 管理者 | 表示名・origin・優先度・有効を変える。`enabled` を省いたときは今の値を保つ |
| `DELETE /api/aichat/conversation-stream/hosts/:id` | 管理者 | 行を消す(その ID は台帳の値に戻る) |

- 管理者は `CF_DASHBOARD_ADMIN_GITHUB_IDS`。変更は同じ Origin からだけ受け付ける(`Origin` ヘッダーが無い要求は受け付ける)。
- 値の検証(`normalizeConversationStreamHost`): ID は台帳と同じ形(英小文字・数字・ハイフンで 32 文字まで、`auto` は予約)。表示名は 1〜80 文字。origin は `nekomaneki.work`・`nekoflare.workers.dev` 配下の、パス・ポート・認証情報なしの HTTPS。優先度は 0〜10000 の整数。不正なら 400 と `errorCode`(`invalid_id`・`invalid_label`・`invalid_origin`・`origin_not_allowed`・`invalid_priority`・`invalid_body`)。
- 埋め込みページと各通信方式のパスは固定(`conversationStreamEndpoints`)。ヘルスチェックが任意の URL を取りに行かないよう、origin のドメインを限っている。

例(行を足す):

```json
{
  "id": "newcontainer",
  "label": "New container",
  "origin": "https://newcontainer.nekomaneki.work",
  "priority": 15,
  "enabled": true
}
```

## 表

マイグレーション `migrations/0194_create_conversation_stream_hosts.sql`。初期データは入れない(入れると台帳の自動選択の絞り込みが崩れるため)。

| 列 | 内容 |
|---|---|
| `id` | 主キー。台帳の ID と同じ形 |
| `label` | 表示名 |
| `origin` | 一意。HTTPS のオリジン |
| `priority` | 自動選択の優先度(小さいほど先) |
| `enabled` | 0 か 1 |
| `created_at`・`updated_at` | ISO 8601(UTC) |

## 別の仕組みとの関係

- Cloudflare Tunnel の接続状態とは別。トンネルがつながっていても、その lib の observer が設定されているとは限らない。埋め込みページのヘルスチェックと、lib の tunnels API の `conversation_stream`(lib #98)で、それぞれ確かめる。
- Redmine の Worker がこの表を読んで lib へ渡す(`LIB_STREAM_HOSTS_JSON`)経路は、Redmine 側の変更(redmine #13)。この PR には含まれない。
