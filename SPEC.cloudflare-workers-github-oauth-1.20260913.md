# SPEC.cloudflare-workers-github-oauth-1.20260913

## 1. cursor-agentのAgent IDタップでアプリ先の回答文を最上位モーダルへ埋め込む

**対象**: `GET /cursor-agent`(`src/views/cursorAgent.ts`)、
`GET /api/cursor-agent/history/:id/conversation`、
`buildCursorAgentConversationUrl` / `extractCursorAgentConversationAnswers`
(`src/utils/cursorAgentLaunch.ts`) — 問答履歴の Agent ID をタップしたとき、
Cursorアプリ(`https://cursor.com/agents/{id}`)に表示される会話の回答文を
外部遷移せず、最上位レイヤーのモーダル内へ埋め込む。

### 背景

Agent ID は既にアプリ内モーダルを開いていたが、本文は状態タイムラインと
「Cursorで直接開く」リンクが中心で、アプリ先の回答文そのものはモーダルに
載っていなかった。回答を読むたびに外部アプリへ行く必要があった。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | 他ユーザーの launch_id で会話を読める | user_id 不一致は 404。Cursor API は呼ばない |
| 2 | agent_id 未記録なのに空 id で問い合わせる | 400。Cursor API は呼ばない |
| 3 | CURSOR_API_KEY 未設定でも会話 API を呼ぶ | 400 |
| 4 | Cursor API 失敗を空 answers の成功として返す | 502 + error。モーダル回答欄にエラーを表示 |
| 5 | user_message を回答として出す | assistant_message / assistant のみ採用 |
| 6 | 回答を innerHTML で流し XSS になる | textContent で描画 |
| 7 | モーダルが他パネルの裏に入る | 開く直前に `getNextZ()` で z-index を設定 |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/cursorAgentLaunch.ts` | 会話URL組み立てと assistant 回答文の抽出を追加 |
| `src/index.ts` | `GET /api/cursor-agent/history/:id/conversation` を追加 |
| `src/views/cursorAgent.ts` | 最上位モーダル先頭に「回答文」欄を追加し、Agent ID タップで会話APIの answers を埋め込む |
| `src/utils/cursorAgentLaunch.test.ts` | URL組み立て・抽出のユニットテスト |
| `src/cursor-agent-launch.test.ts` | 会話APIとページHTMLのテスト |
| `src/cursor-agent-answer-modal-e2e.test.ts` | Agent ID タップ → モーダルに回答文が出る jsdom E2E |

### 関連コミット

- [`8eb1aeb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8eb1aeba46e2a40654d20f8aa54c1909494d96f7) cursor-agentのAgent IDタップでアプリ先の回答文を最上位モーダルへ埋め込む
