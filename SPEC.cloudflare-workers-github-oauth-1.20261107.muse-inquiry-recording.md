# SPEC: Museへの問い合わせをデータベースに記録する処理

作成日: 2026-11-07

関連: [エージェントへの問い合わせを記録するデータベース（NOTICE）](NOTICE.cloudflare-workers-github-oauth-1.agent-inquiries.20261107.md)、スキーマ`migrations-agent-inquiries/`（8ファイル）、ジョブキューの仕様は[SPEC.cloudflare-workers-github-oauth-1.20261107.bridge-job-queue.md](SPEC.cloudflare-workers-github-oauth-1.20261107.bridge-job-queue.md)。

## 1. 目的と範囲

**対象**: Claude Code（またはCodex）がMuseへ送る問い合わせと、その結果をD1`agent-inquiries`（ID`ab65ff96-6333-4673-9ad4-4324be622184`）へ書く手順 — 解決した時点で「どの質問を辿ったか」「予備知識があれば早かったか」を読めるようにする。

### 背景

- Museへの問い合わせは、相手の返事から重要なキーワード（キー）を引き出すために行う。何手で、どのキーが得られたかを後から測れるようにする（ユーザー指定）。
- workerのジョブ記録（`/var/lib/lib-llm/jobs`）は1日で消えるため、回答の全文をD1に残す。
- BOT同士の会話は、人の問答集（`ai_chat_shares`）に混ぜない（ユーザー指定）。

### 範囲外

- 問い合わせの自動記録（Workerのバインディング、画面）。今はClaude Codeが手で登録する。
- キーの自動抽出。

## 2. 問い合わせの経路

**対象**: 本体コンテナから`muse-vm`のMuseへ届く経路と、記録に使う識別子 — どの経路で聞いたかで`ask_id`の意味が変わる。

| 経路 | 使い方 | `ask_id` |
|---|---|---|
| libのworker経由（既定） | `~/lib`で`ruby claude/test/manual/askgk_request.rb claude/api/tunnels.claude.rb 'muse_prompt="…"'` | 応答JSONの`ask_id`（`muse-<uuid>`）。workerのジョブ記録のID |
| 利用者がメインのチャットで聞いた | 利用者から内容を受け取る | なし（`NULL`） |

- `muse_prompt="…"`の本文には半角の`"`を入れない。括弧は`「」`を使う。
- 応答は30秒から5分。1つのジョブの上限は300秒（`llm_timeout`）なので、質問は分ける。
- 変更を伴わない問い合わせは「読み取りのみ」と明記する。変更が要るものは最後に回し、利用者の承認を得る。
- 外部への送信は1秒に1回以上の間隔を空ける（CLAUDE.md「外部サービスへのアクセス頻度制限」）。

## 3. 記録する単位とテーブル

**対象**: `inquiry_cases`・`inquiry_entries`・`inquiry_keys`・`inquiry_entry_keys`・`inquiry_knowledge` — 1回の問い合わせで何を何行書くか。

| 順 | テーブル | 書く内容 | いつ |
|---|---|---|---|
| 1 | `inquiry_cases` | `id`（`<話題>-<YYYYMMDD>`）、`goal`（解決条件を1文）、`stage`（構想`concept`・計画`plan`・実装`implementation`・試験運用`trial`。2026-11-08追加） | 問題に取りかかったとき。1問題1行。段階が進んだら`stage`を更新する |
| 2 | `inquiry_entries` | `seq`、`clue`（なぜこの質問か）、`asked_by`（`claude-code`・`codex`・`user`）、`agent`（`muse`・`muse-main-chat`）、`ask_id`、`question`（送った全文）、`answer`（全文）、`info`（聞き出した事実の要約）、`progress`（前進したこと）、`status`、`duration_seconds` | 回答を受け取った直後。失敗・取り下げも行として残す |
| 3 | `inquiry_keys` | 得たキー。`kind`は`known`（事実）・`unknown`（未確認で、答えが返ったら閉じる）・`pitfall`（落とし穴）。`blocking`（止まるか）、`mutating`（変更を伴うか）、`opened_by_entry_id`・`closed_by_entry_id` | 回答を読んだとき |
| 4 | `inquiry_entry_keys` | 問い合わせとキーの対応。`role`は`target`（狙った）・`obtained`（得た） | 3と同時 |
| 5 | `inquiry_knowledge` | 問題をまたいで使える予備知識。`scope`（例: `muse-vm`）、`source_key_id` | 次の問題で質問を省けると判断したとき |

- 未確認キーは、問いに実際に答えが返ったときだけ閉じる。回答が返っただけでは閉じない。
- 実測（例: SSHで実際に読めた）で確かめたキーは、`info`・`progress`に実測であることを書く。
- 判定（予備知識で何手省けたか）は、解決後にまとめて付ける。途中では付けない。
- 提案は`inquiry_proposals`に、採用・不採用・完了の状態と理由を付けて分けて書く。

## 4. 書き込みの方法

**対象**: D1への書き込みの手段 — 回答の全文（数KB）を、手で写さずに正確に保存する。

- **既定はD1のREST API。** `POST https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database/<ID>/query`に`{"sql": "…", "params": [...]}`を送る。トークンは本体コンテナのシェルの`CF_CONTAINER_API_TOKEN`（2026-11-07に読み書きできることを確認）。回答はworkerの応答JSONから読み、`params`で渡す。SQLへ文字列を埋め込まない。
- **短い行はCloudflare Developer PlatformのMCP（`d1_database_query`）でもよい。** 複数文を送れるが、途中で失敗したときに前の文が戻るかは未確認。このMCPは非推奨で、後継は`https://mcp.cloudflare.com/mcp`。
- 書いた後に件数を読み戻して確かめる（例: `SELECT COUNT(*) FROM inquiry_keys WHERE case_id = ?`）。
- `.sql`ファイルや利用者に示すSQLにはコメントを書かない（本体リポジトリの規則）。

## 5. 手順のまとめ

**対象**: 1件の問い合わせの流れ — 実際に2026-11-07のケース`bridge-jobs-queue-20261107`で行った手順。

1. 予備知識（`inquiry_knowledge`）と手元のコード・文書で閉じられるキーを先に閉じる（0手）。
2. 閉じられないものを、止まるもの、依存されるもの、解決条件に近いものの順に、1回の問い合わせにまとめる。
3. `inquiry_cases`が無ければ作る。
4. `askgk_request.rb`で送り、開始と終了の時刻を記録する（`duration_seconds`）。
5. 応答JSONから`ask_id`・`reply`を取り、`inquiry_entries`に書く。
6. 回答と実測からキーを`inquiry_keys`・`inquiry_entry_keys`に書く。
7. 次に使える事実を`inquiry_knowledge`に書く。
8. 件数を読み戻して確かめる。

## 6. 注意事項

- **回答を事実扱いする前に確かめる。** Museの回答は、手元のコードや実測と照らしてから使う（例: 「SSHが許可されるか判別できない」という回答は、`tailscale status`で所有者を見たうえで実測して閉じた）。
- **読み取りのみと指示した問い合わせは、Museがキューへ写さないことがある。** ジョブキューの運用とは別物として扱う。
- **ビューは`CREATE VIEW IF NOT EXISTS`では更新されない。** 依存する順に消して作り直す。
