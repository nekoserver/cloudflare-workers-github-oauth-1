# AI要約のモデル設定と summary NULL 問題の顛末

## AI_MODEL 環境変数によるモデル切り替え

環境変数 `AI_MODEL` で Workers AI のモデルを切り替えられるようになった。

| 設定方法 | コマンド / 設定箇所 |
|---|---|
| `[vars]` で設定 | `wrangler.toml` の `[vars]` セクションに `AI_MODEL = "モデル名"` |
| secret で設定 | `wrangler secret put AI_MODEL` |
| ダッシュボード | Workers > 設定 > 環境変数 |

- **未設定時のデフォルト**: `@cf/meta/llama-3.1-8b-instruct-fp8`
- 使用されたモデル名は `ai_summary_log.model` カラムに毎回記録される
- モデル変更時にコードの修正・再デプロイは不要

## ai_summary_log.summary が全件 NULL だった原因

2026-03-21〜03-24 の間、`ai_summary_log` 全32件で `summary` が NULL になっていた。

### 原因の連鎖

1. **diff取得失敗** — `GITHUB_TOKEN` 未設定のため PR diff が取得できず `trimmedDiff` が空文字
2. **AI呼び出しスキップ（旧コード）** — `if (ai && trimmedDiff)` の条件でdiffがないとAI呼び出し自体がスキップされていた
3. **catch握りつぶし** — AI呼び出しが例外を投げた場合も catch ブロックが `summary` を更新せず空文字のまま
4. **空文字→NULL変換** — `summary || null` により空文字が NULL として INSERT された
5. **エラー情報ゼロ** — ログにのみ出力されており、DB にもSlackにも異常が記録されなかった

### 修正内容

- diffなしでもタイトル+説明文でAI要約を実行するように変更
- `runSummaryPipeline` に全エラーパターンのハンドリングを集約し、どのケースでも `[AI_NO_BINDING]` `[AI_ERROR]` `[AI_EMPTY_RESPONSE]` `[AI_UNEXPECTED_FORMAT]` がsummaryに残るようにした
- `ai_summary_reviews` テーブルに `reviewer_type='system'`, `reviewer_name='auto-diagnosis'` の自動診断レコードを記録するようにした

## 今後の調査手順

AI要約に異常があった場合、以下の順に確認する:

1. `SELECT * FROM ai_summary_reviews WHERE reviewer_name = 'auto-diagnosis' ORDER BY created_at DESC LIMIT 10` — 自動診断の rating と comment を確認
2. `SELECT request_id, summary, model FROM ai_summary_log WHERE summary LIKE '[AI_%' ORDER BY id DESC LIMIT 10` — エラー付きsummaryの詳細を確認
3. デプロイ済みWorkerコードを Cloudflare MCP `workers_get_worker_code` で確認

## resolved_at / resolution_note が NULL であることについて

これらは異常ではない。`ai_summary_log` の `resolved_at` と `resolution_note` は、`POST /api/ai-summary/:id/resolve` で解決済みマークした時に初めて値が入る設計。未解決レコードが NULL なのは正常動作。
