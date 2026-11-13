# tree-viewのMuseタブの会話に回答IDを割り振り、派生をたどれるようにする（テーブル設計）

作成日: 2026-11-13（UTC）
状態: 設計（案）。マイグレーション・実装は未着手。未決の2点は末尾。
**対象**: dynamicnekoのtree-viewのMuseタブ（`src/components/tree-view-muse-chat.tsx`）と、本体Workerの`POST /api/tree-view/muse-chat-external`（`src/routes/treeViewMuseChat.ts`）、本体のD1（`DB`）に足すテーブル`muse_tab_messages` — AIチャットの回答ID（`ai_chat_shares.id`）のように、Museタブの入力とMuseの回答にそれぞれIDを割り振り、つなぐことで、会話がどう派生したかを分かるようにする（利用者の依頼、2026-11-13）。

## 今の状態

- Museタブの履歴は、ブラウザのメモリ（Reactの状態）にだけある。毎回、履歴全体を送る（40件・UTF-8で16KiBまで）。どこにも保存せず、ページを開き直すと消える。
- 経路: ブラウザ → dynamicneko `/api/tree-view/muse-chat` → 本体Worker `/api/tree-view/muse-chat-external` → `worker`（本体Worker内のTailscale、WASM）か`container`（本体コンテナの`tailscale nc`）→ muse-vm。どちらの経路も本体Workerの同じルートを通る。
- AIチャットの回答IDは`ai_chat_shares.id`（32桁の16進）で、1行が質問と回答の組。`thread_id`が会話のターンを束ねるが、どこから派生したかは持たない。

## 設計

入力と回答に**別々のID**を割り振り、各行の`parent_id`が直前のメッセージを指す。1つのメッセージに子が複数あれば、そこで会話が派生している。

1つの表に入力と回答を両方入れる。派生は入力からも回答からも起きるため。

- 回答から聞き直す → その回答の下に新しい入力の行
- 回答を作り直す → 同じ入力の下に新しい回答の行

保存先は本体WorkerのD1（`DB`）。Museへの要求はどの経路でも本体Workerの`/api/tree-view/muse-chat-external`を通り、`ai_chat_shares`と同じデータベースになる。

```sql
CREATE TABLE IF NOT EXISTS muse_tab_messages (
  id          TEXT PRIMARY KEY CHECK (length(id) = 32),
  user_login  TEXT NOT NULL,
  root_id     TEXT NOT NULL,
  parent_id   TEXT REFERENCES muse_tab_messages(id),
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  model       TEXT,
  transport   TEXT CHECK (transport IN ('worker', 'container')),
  status      TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'failed')),
  error_code  TEXT,
  created_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_muse_tab_messages_user_root ON muse_tab_messages(user_login, root_id, created_at);
CREATE INDEX IF NOT EXISTS idx_muse_tab_messages_parent ON muse_tab_messages(parent_id);
```

| 列 | 意味 |
|---|---|
| `id` | 回答ID。`ai_chat_shares.id`と同じ32桁の16進（16バイトの乱数） |
| `user_login` | GitHubのlogin。このルートは`userToken`からloginを得る |
| `root_id` | 会話の最初の入力の`id`（根は自分自身） |
| `parent_id` | 直前のメッセージの`id`。根はNULL |
| `role` | `user`（Museタブの入力）か`assistant`（Museの回答） |
| `content` | 本文（Museへ送った内容・Museの回答そのもの） |
| `model` | `assistant`のみ（`muse`など） |
| `transport` | `worker`か`container` |
| `status`・`error_code` | 失敗した回答は`failed`と理由（`muse_usage_limit`など） |
| `created_at` | ISO8601のUTC（`ai_chat_shares`と同じ） |
| `deleted_at` | 論理削除 |

- 利用者は`user_login`で持つ。`/api/tree-view/muse-chat-external`は`userToken`を検証してGitHubのloginを得るだけで、`user.sub`を持たない（今はloginが`nekoserver`のときだけ通す）。`ai_chat_shares.user_id`（`user.sub`）とは列の意味が違うため、名前を分ける。

## 書き込みと読み出し

1. 送信: ブラウザは、履歴全体ではなく`parentId`（画面の最新のメッセージ）と新しい入力だけを送る。本体Workerは`parentId`が同じ利用者のものかを確かめ、`parent_id`を再帰CTEでたどって履歴を組み立てる（40件・16KiBの上限は今と同じ）。入力の行を保存してからMuseへ送る。
2. 回答: 入力を親にした回答の行を保存し、`{inputId, replyId, reply}`を返す。失敗は`status='failed'`と`error_code`で残す。送り直しは失敗した回答の兄弟になり、再試行も木に残る。
3. 交互の規則: 入力の親は回答かNULL、回答の親は入力。SQLのCHECKでは行をまたいで比べられないため、本体Workerで守り、テストで確かめる。
4. 派生の表示: `root_id`から再帰CTEで木全体を取る。子が2つ以上ある行が分岐点。

### 2つの表（入力・回答）に分けない理由

分けると「親がどちらの表にあるか」を別に持つ必要があり、たどるたびに分岐する。1つの表なら`parent_id`だけで全部たどれる。

## 実装のときに守ること

- マイグレーションは`migrations/0192_create_muse_tab_messages.sql`（2026-11-13時点のmainの次の番号）。`CREATE TABLE`したテーブルは`src/index.ts`の3つの台帳（`STATUS_TABLE_DEFINITIONS`・`TABLE_COLUMN_KEYS`・`TABLE_GROUP_MAP`）に登録する（`scripts/check-migration-table-registry.js`のフックが検査する）。
- 先にテストを書いて失敗を確かめる。本体のルート（保存・親の検証・交互の規則・失敗の記録）と、dynamicnekoの送信の形（`parentId`と入力だけ）の両方。
- 本文はMuseへ送った内容そのもの。秘密（キー・トークン）は保存しない。

## tree-viewの専用ページの構想との関係

dynamicnekoの`SPEC.dynamicneko.20261113.tree-view-default-dependencies.md`の構想（タブごとに専用ページ、案1はMuseのページをWorker経由だけにする）を採っても、この設計は変わらない。保存はどの経路でも通る本体Workerのルートで行うため。専用ページになれば、`root_id`ごとの会話の一覧と木の表示をそのページに置ける。

## 未決（利用者の判断待ち）

1. **派生をどこで作るか。** 今のMuseタブには、過去のメッセージから送り直す操作が無い。このままでは木はいつも一本道になる。過去のメッセージに「ここから続ける」を付けるか。テーブルは最初から分岐を持てる形にしてあるので、操作は後から足せる。
2. **AIチャットの回答IDとつなぐか。** AIチャットの回答から会話を始められるようにするなら、`origin_share_id`（`ai_chat_shares.id`を指す。回答を消したらNULL）の列を足す。必要になるまで入れない。
