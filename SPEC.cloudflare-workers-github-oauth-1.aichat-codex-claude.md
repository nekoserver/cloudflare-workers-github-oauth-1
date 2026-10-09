# AIチャットのCodex／Claude対応仕様

確認日: 2026-10-09。対象コード: `main` の `29cdb72b`。
本書はこのリポジトリの実装状況を記録する。外部Bot／CLIの実装・本番設定・実際のアカウント利用枠は、このコード確認だけでは保証しない。

## 1. 対応状況

| 項目 | Codex | Claude |
|---|---|---|
| `/aichat` のモデル選択 | `codex` を常に候補に追加 | `claude` を常に候補に追加 |
| 選択後の通常テキスト質問 | `codex_prompt="..."` に変換 | `claude_prompt="..."` に変換 |
| 明示的なスラッシュコマンド | `/neko askgk codex_prompt="質問"` | `/neko askgk claude_prompt="質問"` |
| 推論経路 | askgk → tunnel-signer → 外部Bot | 同左 |
| 回答保存 | `ai_chat_shares.model='codex'` | `ai_chat_shares.model='claude'` |
| 保存済み回答の検索・共有・回答操作 | 対応 | 対応 |
| チャットのスレッドへの追加質問 | 対応 | 対応 |
| CLIセッションID抽出・保存 | `codex_session_id` | 専用の抽出・保存なし |
| コードのハイライト／リンクの脚注化 | 回答バブル・共有ページで対応 | 同左 |
| 質問ツリー／同一質問の回答比較 | 対応 | 対応 |
| Workers AI用パラメータ調整 | 対象外 | 対象外 |
| SSEストリーミング | askgk経路は完成したJSON応答 | 同左 |

モデル名 `codex` / `claude` は本体の振り分け用識別子であり、実際のLLMバージョンではない。外部応答の `llm_model` / `llm_effort` があれば回答末尾へ表示する。

## 2. 入力と送信経路

入口は `POST /api/aichat`（`aichatAuthMiddleware`）。本文の `model` が `codex` または `claude` で、空でない `message` が `/neko` から始まらなければ、サーバーで次の形へ変換する。

```text
model=codex, message=質問 → /neko askgk codex_prompt="質問"
model=claude, message=質問 → /neko askgk claude_prompt="質問"
```

`/neko` コマンドは選択モデルに関係なくコマンドとして先に処理する。例えばClaudeを選択中でも、`/neko askgk codex_prompt="質問"` の回答モデルはCodexとなる。

```text
ブラウザ → 本体 POST /api/aichat
         → interpretAichatSlashCommand
         → RUST_WORKER（Service Binding）POST /tunnel-signer/send
         → https://mynw.nekomaneki.work/lib/api/tunnels
         → 外部Bot／CLI → reply → 本体で整形・保存 → JSON応答
```

本体は `/neko askgk` の後ろを生テキストで取り出す。引用符・改行・内部の空白・`claude_prompt=` / `codex_prompt=` の接頭語は中継時に除去しない。接頭語は送信先の判別に必要である。保存・表示用には、引用符で囲まれたprompt形式から質問本文を取り出す。

`askTunnelSigner` は `{status:'healthy', format:'json', message:...}` をJSON文字列にし、さらに `{url, contentType:'application/json', body:...}` として署名Workerに渡す。本体は署名秘密値を扱わず、署名と実際の外部POSTを別Workerに委ねる。

## 3. 関連スラッシュコマンド

| 入力 | 本体の処理／保存分類 |
|---|---|
| `/neko askgk codex_prompt="質問"` | Codex回答として整形・保存。保存質問はprompt本文 |
| `/neko askgk claude_prompt="質問"` | Claude回答として保存。保存質問はprompt本文 |
| `/neko askgk codex_status` | `codex_*` 判定でCodex回答として保存。コマンド文字列は質問として残る |
| `/neko askgk codex_resume="session-1"` | 引数をそのまま転送し、Codex回答として保存。再開の実処理・書式の有効性は送信先に依存 |
| `/neko askgk codex_...` | 先頭が正規表現 `^codex_\w+\b` に合う入力を大文字小文字を区別せずCodex扱い。本体に個々のサブコマンド実装はない |
| `/neko askgk 任意の質問` | 汎用中継。`neko/askgk` として保存し、Codex／Claude専用保存に分類されない |
| `/neko askgk` / `/neko askgk help` | 空文字／`help` を転送し送信先のヘルプを表示 |
| `/neko askgk settings` | 完全一致の小文字エイリアスを `設定状況` に変換 |
| `/neko askgk models-list` | `cf ai models list` に変換 |
| `/neko askgk tunnels-list` | `cf tunnels list` に変換 |
| `/neko askgk sysstats` / `/neko askgk routines` | 本体では変換せず転送。解釈は送信先に依存 |
| `/neko limit` | Codex／Claude Codeの利用枠の確認先を案内。ログインや実残量取得は行わない |
| `/neko search キーワード` | 保存済みAIチャットを検索し、結果表示と一覧モーダルにつなぐ |
| `/neko qsearch キーワード` | 保存済みAIチャットを検索し、質問の表を表示。Codex／Claudeも共通の保存ログが対象 |
| `/neko csearch キーワード` | Cursor VM履歴を検索。Codex／Claudeのaskgk履歴とは別経路 |
| `/neko help` | 本体のコマンド一覧を表示。外部Botのhelpとは別 |

Claude専用保存の判定は `^claude_prompt\s*=\s*["“”]`。Codexのような「すべての `claude_*` をClaude扱いにする」分岐はない。他エンジンの `xxx_prompt` 形式は汎用AI回答保存（`neko/askgk`）に分類される場合がある。

`/usage` や `/resume` をこのAIチャットのネイティブコマンドとして処理する実装はない。外部CLIのコマンドと本体の `/neko` コマンドを混同しない。

## 4. 回答の整形とLLM情報

Codexは `parseCodexAskgkReply` で `workdir:` から始まる連続したメタ情報バナー（model、provider、approval、sandbox、reasoning等）を除く。最初に見つかった `session id:` 行からIDを抽出し、その行と区切り線を表示本文から除く。想定書式に基づく処理であり、外部CLIの出力変更には追従が必要。

Claudeは `reply.trim()` を本文に使い、Codex用バナー／セッションID抽出は行わない。

どちらも送信先が返す文字列の `llm_model` / `llm_effort` があれば、本文末尾へ次のように追記する。片方だけならある項目だけを出し、両方なければ追記しない。この行を含む回答が保存される。

```text
Engine: Codex / Model: <送信先の値> / Effort: <送信先の値>
```

表示時にはMarkdownリンクを出現順の番号と末尾の一覧へ変換し、同じURLを重複させない。画像記法は脚注化対象外。コードブロックには軽量シンタックスハイライトを適用する。表示変換であり、保存回答本文を脚注版へ書き換える処理ではない。

## 5. 保存・回答操作・スレッド

Codex／Claude専用経路は、DBがある場合に `ai_chat_shares` へ以下を保存する。

- 本人の `user_id`、共有識別子 `id` / `user_hash`、質問・回答、モデル、作成時刻。
- `conversation_hash`、質問本文から算出する `question_hash`。
- `thread_id`、入力元（`source='textbox'` または `api`）。
- 推定トークン数、Codexから抽出した `codex_session_id`（Claudeまたは抽出なしはNULL）。

成功応答には `usedModel`、`usage`、`shareId`、`userHash`、`threadId`、モデル色等を付け、通常の回答表示、✂️／📔、共有、左サイドパネルの検索経路につなぐ。

トークン数は外部CLIの実測ではない。入力・出力はそれぞれ文字数÷4の切り上げ（最低1）、合計は両者の文字数の合計÷4の切り上げ（最低1）。入力側は変換後のコマンド文字列を数えるため、質問本文だけの長さとも異なる。実課金や利用枠の計算には使えない。

`threadId` 指定時は形式と本人所有の未削除ログを確認する。不正形式は400。Codex／Claudeでは所有を確認できないIDを再利用せず、新しいスレッドへ保存する。この確認は外部回答取得後に行われる。ID未指定時も新規発行する。

**チャットのスレッドとCLIセッションは別管理。** この中継で送るのは質問コマンドであり、`body.threadId`、保存済みの `codex_session_id`、過去の会話メッセージは自動送信しない。同じスレッドに保存できることは、外部CLIが同じ会話文脈を再開する保証ではない。必要な再開指示の扱いは送信先に依存する。

## 6. 色・保存ログの閲覧

ClaudeのUIの色丸は `#f97316`（オレンジ）を優先する。Codexの色は共通の `aichat_model_colors` の割当を使う。Codex／Claudeの既存割当が他モデルと衝突した場合は未使用色へ再割当する。サーバーの色割当とClaudeの固定表示色は別の処理である。

| ページ／API | 内容 |
|---|---|
| `/mcp-codex-tree` | Codex・Claude質問ツリー。名称にcodexが残るが両モデルを対象にする |
| `/api/mcp-sample/codex-questions` | 本人の未削除の両モデルのログを日時・IDの降順で100件ずつ取得 |
| `/api/mcp-sample/codex-questions/:id` | 本人の質問・回答・モデル・スレッドを取得 |
| `/api/mcp-sample/codex-questions/:id/keywords` | 回答内の登録検索語とカテゴリ、本人の全AI回答内の出現回数を取得 |
| `/aichat-cross-model` | 同じ質問に対するClaude／Codex回答の比較ページ |
| `/api/aichat/cross-model-questions` | 本人の `question_hash` が一致し、両モデルの回答がある組を取得 |

比較は質問ハッシュの完全一致のみ。類似表現をまとめる処理はない。同じモデルで複数回答がある場合は最新のものを採用する。ツリー・比較APIは認証付きで、本人の未削除データに限定する。

## 7. 前提・失敗・未対応

- `RUST_WORKER` Bindingが必要。未設定ならaskgkは「現在利用できません」と返す。モデル候補の表示はBindingの稼働確認ではない。
- 専用保存にはDBと必要な列が必要。`codex_session_id` の追加SQLは `src/index.ts` の `STATUS_MIGRATION_SQL['0166']` にある。ディスク上の `0166_seed_ai_chat_threads.sql` と同名の目的だと推測しない。
- askgk待機上限は120秒。検索系の待機上限は8秒。タイムアウト判定だけで外部CLIの処理が中断されたとは限らない。
- HTTP失敗、署名Workerのエラー、JSON解析失敗、空または欠落したreplyをエラーとして扱う。自動でWorkers AIへ振り替える分岐はない。
- 保存失敗時、新規質問は回答と `saveError` を返す。本人の既存スレッドへの追加保存が失敗した場合は500を返す。色登録だけの失敗は `modelColorError` に分ける。
- `systemPromptMode` は応答に残るが、askgkへWorkers AI用system promptを渡す処理はない。maxTokens／temperature調整もCodex／Claudeを対象にしていない。
- ブラウザが `stream` を送ってもaskgkは完成したJSON応答となる。外部CLIの逐次出力表示には未対応。
- askgkの送信payloadには画像データを含めない。Codex／Claudeへの画像添付対応は、この経路では実装されていない。
- 任意のCLIサブコマンドの有効性、モデル・effort設定、CLI認証、セッション再開、実利用枠は外部Bot／CLI側の責務。本書で本番動作確認済みとはしない。

## 8. 実装・テストの参照

主要実装:

- `src/index.ts`: `/api/aichat` の振り分け・保存、比較API、`askgkDep`。
- `src/utils/aichatSlashCommand.ts`: コマンド判定、タイムアウト、LLM情報追記。
- `src/utils/tunnelSignerAsk.ts`: Service Binding、エイリアス、応答検証。
- `src/utils/codexAskgkQuestion.ts` / `codexAskgkReply.ts`: 質問本文とCodex応答の整形。
- `src/utils/aichatModelConfig.ts` / `src/views/aichat.ts`: モデル候補・色・回答UI。
- `src/routes/codexQuestionTree.ts` / `src/views/codexQuestionTree.ts`: 両モデルの質問ツリー。
- `src/utils/aichatCrossModelQuestions.ts` / `src/views/aichatCrossModel.ts`: 完全一致の回答比較。
- `src/utils/aichatLinkFootnotes.ts` / `src/views/aichat-share.ts`: 回答の表示整形。

関連テスト: `aichat-slash-askgk.test.ts`、`aichat-slash-askgk-codex-persist.test.ts`、`aichat-askgk-save-integration.test.ts`、`utils/tunnelSignerAsk.test.ts`、`utils/codexAskgkQuestion.test.ts`、`utils/codexAskgkReply.test.ts`、`routes/codexQuestionTree.test.ts`、`utils/aichatCrossModelQuestions.test.ts`、`aichat-cross-model-page-20261008.test.ts`、`aichat-claude-codex-link-footnotes-20261008.test.ts`。

Cursor VMの起動・履歴・キャッシュについては [Cursor Agent仕様](SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md) を参照する。Codex／Claudeのaskgk経路とは独立している。
