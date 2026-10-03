# Slackの`@メンション`から`/neko askgk`を呼べるようにする計画

**対象**: `src/index.ts`の`dispatchSlackAiReply`・`handleSlackAppMention`
(`src/utils/slackMentionReply.ts`)、`src/utils/aichatSlashCommand.ts`の
`interpretAichatSlashCommand`。[`EVAL.cloudflare-workers-github-oauth-1.askgk-slack-support.20261003.md`](EVAL.cloudflare-workers-github-oauth-1.askgk-slack-support.20261003.md)
で選定した選択肢A(`@メンション`本文の先頭が`/neko `ならslash解釈に回す)の実装手順。

**現状のステータス**: 実装済み(選択肢Aの初期スコープ`/neko askgk`のみ)。ブランチ`claude/askgk-settings-alias`。

---

## 1. 目的

Slackの`@メンション`で`@neko /neko askgk settings`のように打った場合に、
自由文章としてWorkers AIへ渡すのではなく`interpretAichatSlashCommand`で解釈し、
`/neko askgk`の結果(tunnels経由の`reply`)をそのままSlackに返信できるようにする。

初期スコープは`/neko askgk <質問文>`サブコマンドのみ。他のサブコマンドへの対応は
本計画の範囲外とし、必要になった時点で別途計画する。

## 2. 変更方針

### 2.1 `handleSlackAppMention`(`src/utils/slackMentionReply.ts`)への分岐追加

- `stripBotMentions`後の本文(`cleanedText`)が`/neko askgk `で始まるかを判定する
  新しい純粋関数`isAskgkSlashCommand(text: string): boolean`相当を追加
  (当面`/neko askgk`のみを対象にすることをテストで固定する)
- 該当する場合は`generateSlackAiReply`を呼ばず、呼び出し元から渡された
  `askTunnelSigner`相当の依存関数を介して`resolveAskgkCommand`→tunnel-signer呼び出し
  を行い、結果(または`formatAskgkResult`相当の整形文)をSlackへ返信する
- `SlackMentionReplyDeps`に新しい依存(例: `askTunnelSigner?: (message: string) => Promise<string>`)
  を追加する。未設定(Service Binding無し)の場合は、既存の`/neko askgk`が
  `/api/aichat`側で返す「❌ /neko askgk は現在利用できません」と同じ文言を返す

### 2.2 `dispatchSlackAiReply`(`src/index.ts`)での依存配線

- 既存の`buildAskTunnelSignerDep`相当(`/neko askgk`用にRUST_WORKER Service Bindingを
  組み立てている関数、`src/index.ts`の426行目付近)をそのまま流用し、
  `handleSlackAppMention`呼び出し時に新しい依存として渡す
- D1(`c.env.DB`)は`dispatchSlackAiReply`に既に`env.DB`として渡っているため、
  追加の配線は不要

### 2.3 テスト

- `src/utils/slackMentionReply.test.ts`: `/neko askgk <質問文>`形式の本文が
  来た場合に`askTunnelSigner`依存が呼ばれ、通常のAI応答(`generateSlackAiReply`)
  へは渡らないことを検証するテストを追加
- `askTunnelSigner`未設定時に「現在利用できません」を返すことを検証するテストを追加
- `/neko askgk`以外の本文(自由文章、他の`/neko`サブコマンド)は従来通り
  `generateSlackAiReply`に渡ることを検証する回帰テストを追加
  (スコープ外のサブコマンドを誤って解釈しないことの保証)

## 3. スコープ外(今回やらないこと)

- `/neko askgk`以外の`/neko`サブコマンド(`search`・`qsearch`・`tokens`等)への対応
- Slackのスラッシュコマンド(`POST /slack/commands`)側への`/neko`コマンド新設
  (EVALの選択肢B。Slack App側の設定変更が必要なため別途検討)
- `ai_chat_shares`への保存(`source='slack'`)をスラッシュコマンド結果にも適用するか否か
  の設計(現状の`/neko askgk`は`/api/aichat`経由でも`ai_chat_shares`に自動保存されない
  ため、Slack版でも同様に保存しない方針を踏襲する)

## 4. 実装結果

- `src/utils/slackMentionReply.ts`: `parseAskgkMentionCommand()`(`/neko askgk`判定・質問文抽出)、
  `resolveAskgkMentionReply()`(質問文なし/未設定/エラー/成功の4分岐、`/api/aichat`側と同じ文言)を追加。
  `SlackMentionReplyDeps`に`askTunnelSigner`を追加し、`handleSlackAppMention`内で
  `/neko askgk`本文のときだけAI応答(`generateSlackAiReply`)をバイパスする
- `src/index.ts`: `dispatchSlackAiReply`が`handleSlackAppMention`を呼ぶ際、
  既存の`askgkDep(env)`(`/neko askgk`用にRUST_WORKER Service Bindingを組み立てる
  関数、`/api/aichat`側と共用)を`askTunnelSigner`として渡すよう配線
- `src/utils/slackMentionReply.test.ts`: 受け入れ基準の5項目(質問文あり成功・未設定・
  エラー・質問文なし・askgk以外は従来通りAI応答・saveShareを呼ばない)をテストで保証

## 5. 受け入れ基準

- Slackで`@neko /neko askgk settings`とメンションすると、tunnels経由の`reply`が
  そのままSlackへ返信される
- `@neko` 単体の自由文章メンションは従来通りWorkers AIの応答が返る(回帰なし)
- `npx vitest run src/utils/slackMentionReply.test.ts` が新規テスト含め全件通過
- `npm run typecheck` に新規エラーが無い
