# SPEC.cloudflare-workers-github-oauth-1.askgk-settings-alias.20261003.md

## `/neko askgk settings` エイリアス追加とSlack未対応の判明(2026-10-03)

**対象**: `src/utils/tunnelSignerAsk.ts`の`ASKGK_COMMAND_ALIASES`・`resolveAskgkCommand()`、
`src/utils/aichatSlashCommand.ts`の`/neko help`一覧表示、`POST /api/aichat`経由の
`/neko askgk <質問文>`スラッシュコマンド。

---

## 背景

`/neko askgk <質問文>`は、このWorker自身からrust-worker-sqlx-d1の`/tunnel-signer/send`を
Service Binding経由で呼び、rust-worker-sqlx-d1がHMAC-SHA256署名を付けて
`mynw.nekomaneki.work/lib/api/tunnels`へ転送し、返ってきた`reply`をチャットに表示する機能。

既存のエイリアス機構(`models-list` → `cf ai models list`、PR #2214)と同じパターンで、
「設定状況」を問い合わせたいという要望があった。

### エイリアスの意味(確認した要件)

- `settings`というエイリアスは、`ASKGK_COMMAND_ALIASES`で**日本語の`「設定状況」`という
  文字列そのもの**に変換される(スペースを含む実コマンド文字列への変換ではない)
- この変換は「コマンドとして構文解析する」ものではなく、**ただの文字列置換**であり、
  送信先(`message`フィールド)には「設定状況」という**データ**がそのまま渡るだけ。
  意味解釈(何の設定状況を返すか等)はtunnels側のBot(CLIから入れたClaude。
  Cloudflare Workers AIではない)が内部的に行う
- `settings`という短い英単語エイリアスを用意した理由は、半角スペースを含む表現
  (もしあれば)を毎回打たせずに済ませるための措置

### Slackからの呼び出しについて(誤りを訂正)

作業中、「たぶんSlackからも呼べる」という想定が出たが、コードを確認した結果、
**現時点ではSlackから`/neko askgk settings`相当は呼び出せない**ことが判明した。

- Slackの`@メンション`応答(`handleSlackAppMention`、`src/utils/slackMentionReply.ts`)は
  `generateSlackAiReply()`を直接呼んでWorkers AIに渡すだけで、
  `interpretAichatSlashCommand()`(`/neko ...`系コマンドの解釈)を一切経由していない
- Slack側のコマンド入口は`POST /slack/commands`の`/pts`(および`/pts f1`)のみで、
  `/neko`系コマンドのディスパッチが存在しない
- `/neko`系コマンド(`askgk`含む)が解釈されるのは`POST /api/aichat`
  (AIチャット入力窓・外部API・dynamicneko、`AichatSourceKey`でいう
  `textbox`/`api`/`dynamicneko`)経由のみで、`slack`はこの中に含まれない

Slackから`/neko askgk settings`相当を呼べるようにするには、Slackの`@メンション`または
`/slack/commands`側に`interpretAichatSlashCommand`への分岐を新設する必要がある。
この対応は[`EVAL.cloudflare-workers-github-oauth-1.askgk-slack-support.20261003.md`](EVAL.cloudflare-workers-github-oauth-1.askgk-slack-support.20261003.md)
で評価し、[`PLAN.cloudflare-workers-github-oauth-1.askgk-slack-support.20261003.md`](PLAN.cloudflare-workers-github-oauth-1.askgk-slack-support.20261003.md)
の計画に沿って実装済み(`@メンション`本文が`/neko askgk <質問文>`のときだけ
`interpretAichatSlashCommand`相当の処理に回す方式)。

---

## 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/tunnelSignerAsk.ts` | `ASKGK_COMMAND_ALIASES`に`settings: '設定状況'`を追加 |
| `src/utils/tunnelSignerAsk.test.ts` | `askTunnelSigner`が`settings`を`設定状況`へ変換して送ることを検証するテスト、`resolveAskgkCommand('settings')`が`'設定状況'`を返すことを検証するテストを追加 |
| `src/utils/aichatSlashCommand.ts` | `/neko help`の`askgk`行に、`settings`が「設定状況」へ変換される旨の説明を追記 |

---

## 関連コミット

| コミット | 内容 |
|---|---|
| [`4aaf224`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4aaf224) | `settings`エイリアス追加、Slackの`@メンション`からの`/neko askgk`対応(PR [#2235](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2235)) |

---

## 注意事項

- `settings`エイリアスは「設定状況」という文字列をそのままtunnels側へ渡すだけであり、
  このWorker側では「設定状況」が何を指すか一切関知しない(解釈は完全にtunnels側Bot任せ)
- Slack対応は`/neko askgk`サブコマンドのみに限定した初期スコープ。他の`/neko`
  サブコマンド(`search`等)はSlackの`@メンション`からはまだ呼べない
  (詳細はPLANファイルの「3. スコープ外」参照)

---

## 追記(2026-10-03): `sysstats`・`routines`(エイリアス不要)

`settings`に続き、`/neko askgk sysstats`・`/neko askgk routines`という要望があったが、
こちらは**`ASKGK_COMMAND_ALIASES`への登録(=エイリアス変換)は不要**と確認した。
`resolveAskgkCommand()`は登録の無い文字列をそのまま通す実装のため、`sysstats`・
`routines`という英単語自体をただのデータとしてtunnel-signer経由でそのまま送れば、
先方(tunnels側Bot)が内部的に意味解釈する。

- `src/utils/tunnelSignerAsk.test.ts`に、この2語が変換されずそのまま渡ることを
  回帰として固定するテストを追加(将来誤ってエイリアス登録してしまうと検出できる)
- `/neko help`の`askgk`行にも両コマンドが変換されずそのまま送られる旨を追記
- コードの実動作としては無変更(`ASKGK_COMMAND_ALIASES`に新規エントリなし)
