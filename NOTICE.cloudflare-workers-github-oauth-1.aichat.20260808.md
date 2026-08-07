# NOTICE.cloudflare-workers-github-oauth-1.aichat.20260808.md

## AIチャットへの入力経路が3方向あることと、共通化/個別特化の現状整理

### 対象

AIへの入力経路は現在3つある。

| 経路 | エントリポイント | source値 |
|---|---|---|
| 標準AIチャット(入力窓) | `/api/aichat`(`rawSource==='textbox'`) | `textbox` |
| 回答伝播ページ・その他API利用 | `/api/aichat`(それ以外) | `api` |
| Slack `@admin` メンション | `/slack/event` → `dispatchSlackAiReply` | `slack` |

いずれも最終的に`ai_chat_shares`テーブルへ保存され、`source`カラムで
経路を区別できる(2026-08-07の変更で`/api/aichat/daily-stats`の
`sourceTotals`として経路別に集計・円グラフ表示できるようにした)。

### 既にある共通化

- `aichatModelConfig.ts`: `AICHAT_MODEL_MAX_TOKENS`(モデル別トークン上限)・
  `AICHAT_MODEL_EXTRA_PARAMS`(モデル別追加パラメータ)・`getModelRunParams`
- `stripThinkTags.ts`: `<think>`タグ除去
- `aiUsage.ts`: `extractAiUsage`(usageオブジェクトからトークン数抽出)

### 既にある個別特化(Slack)

- `slackAiReply.ts`: `buildSlackAiMessages`(system roleを使わずuser
  メッセージ本文に指示文を埋め込む。gemma-4-26b-a4b-itがsystem message
  併用時にthinking modeを強制するバグの回避)
- `markdownToSlackMrkdwn.ts`: AI生成Markdown→Slack mrkdwn変換
  (`convertMarkdownToSlackMrkdwn`)
- `slackMentionReply.ts`: `formatSlackAiReplyText`(Slack向け整形)

### 教訓: 「共通化」に経路別の値を混ぜると事故る

2026-08-08、AIチャットページの検索窓からSlack由来の質問ログを開くと
ページがフリーズするバグが発生した
([`c6a066b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c6a066b))。

原因は、共通化されているはずの`AICHAT_MODEL_MAX_TOKENS`(モデル別の
トークン上限。gemma-4-26b-a4b-itは65536)を、Slack応答生成でもそのまま
使っていたこと。65536は「AIチャットページでの対話的な利用」を想定した
値であり、「Slackへの短い返信」には過大だった。結果として極端に長い
応答が`ai_chat_shares`に保存され、それをAIチャットページの検索窓経由で
開くとクライアント側のMarkdownパーサー・キーワードハイライト処理が
巨大な文字列に対して同期的に走り、タブがフリーズした。

対処として`slackAiReply.ts`に`SLACK_MAX_TOKENS`(4096)を追加し、
`AICHAT_MODEL_MAX_TOKENS`の値をそのまま使わずSlack向けの小さい上限に
丸めるようにした。**「モデル別の値」と「経路別の値」は別軸であり、
片方の表(AICHAT_MODEL_MAX_TOKENS)がもう片方の意味(経路ごとの適正値)を
兼ねられるとは限らない**、というのが今回の教訓。

### 今後の構想(ユーザーとの会話メモ、未着手)

3経路の個別メンテナンス性を上げるため、以下の3層構造をディレクトリか
命名規則で明示する案が出た。

1. **入力正規化**: 各経路のリクエストを共通の形(message/model/source)に
   変換する層
2. **AI呼び出し(共通)**: `getModelRunParams`・`extractAiUsage`・
   `stripThinkTags`など、モデル呼び出しそのものに関わる共通ロジック
3. **出力整形(経路別)**: 出力フォーマット・トークン上限・system role
   可否・保存先の意味など、経路ごとに違う制約を持つ部分

例: `aichat/core/`に共通ロジックを集約し、`aichat/channels/
{textbox,api,slack}/`に整形・上限値などの経路別設定を集約する構成。

大掛かりなリファクタは今すぐ必要ではなく、次に経路別の差分を触る
タイミングで該当ファイルをこの構造に寄せていく漸進的な移行が現実的、
という結論で会話は止まっている。着手する場合は先にどこまで
ディレクトリを切るかの範囲をユーザーと相談してから進めること
(CLAUDE.mdのルール30と同種の「頼まれていない範囲を勝手に広げない」
方針に従う)。
