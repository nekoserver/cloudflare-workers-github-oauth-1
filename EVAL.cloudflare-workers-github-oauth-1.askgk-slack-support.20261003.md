# EVAL: Slackから`/neko askgk`(スラッシュコマンド全般)を呼べるようにするか

**対象**: [`SPEC.cloudflare-workers-github-oauth-1.askgk-settings-alias.20261003.md`](SPEC.cloudflare-workers-github-oauth-1.askgk-settings-alias.20261003.md)
で判明した「Slackから`/neko askgk settings`相当を呼べない」という制約への対応要否と、
対応する場合の実装方針を評価する。

---

## 1. 現状の整理

- `/neko`系スラッシュコマンド(`askgk`含む全コマンド)は`interpretAichatSlashCommand()`
  (`src/utils/aichatSlashCommand.ts`)が解釈し、呼び出し元は`POST /api/aichat`
  (`src/index.ts`)経由の3系統(AIチャット入力窓=`textbox`、外部API=`api`、
  dynamicneko=`dynamicneko`)のみ
- Slackの`@メンション`応答(`handleSlackAppMention`)は`generateSlashCommand`を経由せず、
  `generateSlackAiReply()`で直接Workers AIへメッセージを渡すだけ
- Slackのスラッシュコマンド入口(`POST /slack/commands`)は`/pts`(フリーテキスト投稿)
  専用で、`/neko`系コマンドのディスパッチが存在しない

## 2. 対応する場合の選択肢

### 選択肢A: `@メンション`本文の先頭が`/neko `ならslash解釈に回す

`handleSlackAppMention`内で、`stripBotMentions`後の本文が`/neko `で始まる場合は
`generateSlackAiReply`を呼ばず`interpretAichatSlashCommand`へ渡し、結果をそのまま
Slackに返信する。

- 長所: Slack側の設定変更(新規スラッシュコマンド登録等)が不要。既存の`@メンション`
  フローに分岐を足すだけ
- 短所: `interpretAichatSlashCommand`の依存(`AichatSlashCommandDeps`、D1クエリ・
  Service Binding類)をSlackイベントハンドラ(`/slack/event`、`dispatchSlackAiReply`)
  側にも配線する必要があり、依存の組み立てが`/api/aichat`ハンドラと二重管理になる
- `AICHAT_SOURCE_ORDER`の`source='slack'`との整合: 現状`source='slack'`は
  `ai_chat_shares`への保存ラベルとしてのみ使われており、スラッシュコマンド結果
  (`ai_chat_shares`に保存されない)をどう扱うかの設計が別途必要

### 選択肢B: 新規Slackスラッシュコマンド`/neko`を追加登録する

Slack App側で新しいSlash Command(`/neko`)を登録し、`POST /slack/commands`に
`command === '/neko'`の分岐を追加して`interpretAichatSlashCommand`へ渡す。

- 長所: `@メンション`の文章と明確に分離でき、`/pts`と同じ「フォームが先に決まった
  コマンド」という扱いに揃えられる
- 短所: Slack側App設定の変更(新規コマンド登録、ユーザーの操作が必要)が要る。
  このセッションからはSlack Appのダッシュボード設定を直接変更できないため、
  ユーザー側の追加作業(Slash Commands設定で`/neko`を登録しRequest URLを合わせる)
  が発生する

### 選択肢C: 対応しない(現状維持)

`/neko askgk settings`はAIチャット入力窓・外部API・dynamicnekoからのみ利用可能とし、
Slackからは引き続き`@メンション`の自由文章応答のみとする。

- 長所: 追加実装・追加設定が一切不要
- 短所: 「たぶんSlackからも呼べる」というユーザーの期待に応えられない

## 3. 評価

- 選択肢Bは外部(Slack App)設定変更をユーザーに要求するため、「コード変更だけで
  完結しない」点でこのセッションの作業範囲を超える
- 選択肢Aはコード変更のみで完結し、既存の`@メンション`導線をそのまま使えるため、
  実装コストと「Slackからも呼べるようにしたい」という要望への適合度のバランスが良い
- ただし選択肢Aは`interpretAichatSlashCommand`の全依存(`AichatSlashCommandDeps`)を
  Slackイベントハンドラ側にも組み立てる必要があり、対象を「全`/neko`コマンド」にすると
  変更範囲が大きくなる。初期スコープは`/neko askgk <質問文>`(今回の起点)のみに絞り、
  他のサブコマンドへの対応は別タスクとして段階展開するのが妥当

## 4. 推奨

**選択肢Aを、まず`/neko askgk`サブコマンドのみに絞って実装する**ことを推奨する。
全`/neko`コマンドへの対応は、`AichatSlashCommandDeps`の各依存をSlack側でどこまで
用意できるか(D1バインディングはSlackイベントハンドラにも`c.env.DB`で渡せるため
大半は流用可能)を個別に確認しながら段階的に広げる。

この推奨の詳細な実装手順は [`PLAN.cloudflare-workers-github-oauth-1.askgk-slack-support.20261003.md`](PLAN.cloudflare-workers-github-oauth-1.askgk-slack-support.20261003.md) に記載する。
