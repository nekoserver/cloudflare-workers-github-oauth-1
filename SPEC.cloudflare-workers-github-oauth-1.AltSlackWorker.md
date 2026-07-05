# SPEC.cloudflare-workers-github-oauth-1.AltSlackWorker

**対象**: `NOTIFY_TARGET=worker` で切り替えた先に置く、別Worker（以下「Altワーカー」）の設計仕様。本ドキュメントはドキュメントのみで、アプリケーションコードの変更は含まない。

このリポジトリ（以下「本体Worker」）は `src/utils/notifyDispatch.ts` により、Slackへ送るはずだった通知をすべて外部Workerへリダイレクトできるようになっている（`NOTIFY_TARGET=worker`）。本仕様は、そのリダイレクト先である「Altワーカー」が

1. 本来Slackへ投稿されるはずだったコミットログ・AI要約をどう読み出すか
2. それをどう表示するか（Slack風UI）
3. `@admin` 宛の問い合わせをWorkers AI APIにどう投げ、結果をどう保存するか

を定義する。

---

## 1. 全体アーキテクチャ

**対象**: 本体WorkerとAltワーカーの責務分担、およびD1共有方針。

Altワーカーは本体Workerとは独立した Cloudflare Worker（別 `wrangler.toml`、別デプロイ）だが、**本体Workerと同じD1データベース（同一 `database_id`）を `[[d1_databases]]` でバインドする**。理由は、`notifyDispatch` が送るペイロードはSlackの `text`/`blocks` 形式に整形済みのメッセージ文字列であり、`ai_summary_log.summary` の全文や `commit_agent_log` の構造化列など、Slack投稿用に丸められる前の生データを含まないため。Altワーカーが「Slack風だがSlackよりリッチなUI」を出すには、D1の生テーブルを直接読みに行く必要がある。

| コンポーネント | 役割 |
|---|---|
| 本体Worker | イベント発生源。GitHub Webhook受信・AI要約生成・D1書き込み・`notifyDispatch`経由の通知送信 |
| Altワーカー ingestエンドポイント | `notifyDispatch.sendToWorker()` からのPOSTを受け、`webhook_log` 等への到達確認・即時表示用の軽量キャッシュ更新のみ行う（詳細はD1から読む） |
| Altワーカー 表示ページ | D1を直接クエリし、Slack風フィードを描画する通常のHonoルート |
| Altワーカー `@admin` エンドポイント | Workers AI (`env.AI`) を呼び出し、質問と回答をD1に保存する |
| D1（共有） | 本体Workerが書き込み、Altワーカーが読み出す唯一の真実源 |

Altワーカーは本体WorkerのD1に対して**読み取り専用の利用を基本**とする。書き込みが必要なのは、Altワーカー固有のテーブル（`@admin` の質問・回答ログなど、後述）に限る。

---

## 2. Ingest エンドポイントの受信契約

**対象**: `NOTIFY_WORKER_URL` が指すAltワーカー側HTTPエンドポイントの実装仕様。`src/utils/notifyDispatch.ts` の `sendToWorker()` が送信するリクエストと一致させること。

### リクエスト

| 項目 | 値 |
|---|---|
| メソッド | `POST` |
| URL | `NOTIFY_WORKER_URL`（本体Worker側の環境変数で指定） |
| ヘッダー | `Content-Type: application/json; charset=utf-8` |
| 認証ヘッダー | `Authorization: Bearer <NOTIFY_WORKER_SECRET>`（`NOTIFY_WORKER_SECRET` 未設定時は付与されない） |

### ボディ（JSON）

| フィールド | 型 | 説明 |
|---|---|---|
| `channel` | string \| undefined | 本体Worker側の `SLACK_CHANNEL_ID` 相当。Altワーカーでは論理チャンネル名として扱ってよい |
| `text` | string | Slackの `text` に相当する本文（Markdownテーブル・`•`箇条書きを含む場合がある） |
| `blocks` | object[] \| undefined | Slack Block Kit形式。Altワーカーが独自レンダリングする場合はこの構造をパースする |
| `thread_ts` | string \| undefined | Slackスレッド識別子相当。Altワーカーでは会話グルーピングのキーとして利用可 |
| `source` | string | 固定値 `"cloudflare-workers-github-oauth-1"`。将来複数の送信元Workerからingestする場合の識別子 |

### Altワーカー側の受信処理

1. `Authorization` ヘッダーを `NOTIFY_WORKER_SECRET`（Altワーカー側にも同じ値をsecretとして保存）と比較検証する。不一致は `401` を返す
2. 受信内容を `webhook_log` 相当のテーブル（Altワーカー固有、後述の `alt_notify_ingest_log`）へ**そのまま**記録する（記録なしで処理を続けない。CLAUDE.mdルール8「握りつぶすなら記録」に準拠）
3. 2xxを返す。Altワーカーの表示は基本的にD1直読みで完結するため、ingest受信はあくまで「到達確認・タイムライン更新のトリガー」として扱い、詳細情報の再構築はしない
4. `text` 中に `/ai-summary/{request_id}` 形式のURLが含まれる場合、正規表現ではなく `indexOf` ベースの文字列走査で `request_id` を抽出し、`alt_notify_ingest_log.linked_request_id` に保存しておくと、後述の「AI要約詳細への逆引き」が高速になる（CLAUDE.mdルール29: template literal内に正規表現リテラルを書かないルールがある。Altワーカー側は別ファイルなので直接該当しないが、同じ理由でregexより文字列探索を推奨）

### Altワーカー固有テーブル: `alt_notify_ingest_log`

```sql
CREATE TABLE IF NOT EXISTS alt_notify_ingest_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  channel TEXT,
  text TEXT NOT NULL,
  blocks_json TEXT,
  thread_ts TEXT,
  linked_request_id TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alt_notify_ingest_log_received_at ON alt_notify_ingest_log(received_at);
CREATE INDEX IF NOT EXISTS idx_alt_notify_ingest_log_linked_request_id ON alt_notify_ingest_log(linked_request_id);
```

---

## 3. D1読み出し対象テーブルと用途

**対象**: 本体WorkerのD1のうち、Altワーカーの表示機能が読みに行くべき既存テーブルの一覧と、それぞれの表示上の役割。

| テーブル | 用途 | 主要カラム |
|---|---|---|
| `ai_summary_log` | PRのAI要約本体。フィードの1エントリの中核データ | `request_id`(UK), `event_date`, `event_type`, `repo_full_name`, `pr_number`, `pr_action`, `pr_url`, `model`, `summary`, `diff_length`, `slack_notified`, `resolved`, `resolution_note`, `tags`, `created_at` |
| `ai_summary_reviews` | AI要約に対する評価・コメント（人間 or 自動診断） | `summary_request_id`(FK→ai_summary_log.request_id), `rating`, `reviewer_type`, `reviewer_name`, `comment`, `created_at` |
| `commit_agent_log` | PR内コミットのAIエージェント検出結果（Copilot等の検出） | `request_id`(FK→ai_summary_log.request_id), `commit_sha`, `commit_message`, `detected_agent_name`, `detected_agent_version`, `detected_signal`, `created_at` |
| `installation_permissions` | GitHub Appのインストール・権限変更イベント | `installation_id`, `repo_name`, `repository_selection`, `permissions`, `updated_at` |
| `webhook_log` | 全Webhookソース共通の受信ログ（成否含む） | `source`, `event_type`, `status`, `payload`, `error`, `received_at` |
| `cf_auth_access_log` | Cloudflareアクセス認証のログイン試行・結果 | `username`, `event`, `action`, `result`, `reason`, `checked_at` |
| `resend_webhook_log` | メール送受信イベント（バウンス等）のログ | `source_id`(FK), `event_type`, `email_from`, `email_to`, `bounce_type`, `error_detail`, `created_at` |
| `slack_interaction_log` | Slackインタラクティブコンポーネント操作ログ（参考用・本体Slack機能に依存するため過去分のみ） | `step`, `detail`, `created_at` |

**優先度**: `ai_summary_log` + `ai_summary_reviews` + `commit_agent_log` の3テーブルがフィードの主役（PRごとの1スレッド相当）。`installation_permissions` / `webhook_log` / `cf_auth_access_log` / `resend_webhook_log` はシステムイベント系のサブフィード（別タブ・別チャンネル扱い）として分離表示する。

### 代表クエリ（フィード1ページ分の取得例）

```sql
SELECT
  s.request_id,
  s.event_date,
  s.repo_full_name,
  s.pr_number,
  s.pr_action,
  s.pr_url,
  s.model,
  s.summary,
  s.created_at,
  (SELECT COUNT(*) FROM ai_summary_reviews r WHERE r.summary_request_id = s.request_id) AS review_count,
  (SELECT COUNT(*) FROM commit_agent_log c WHERE c.request_id = s.request_id) AS agent_detected_count
FROM ai_summary_log s
ORDER BY s.created_at DESC
LIMIT 50;
```

---

## 4. 表示フォーマット（Slack風フィードUI）

**対象**: Altワーカーの表示ページ（例: `/feed`）が採用すべきUI構造。CLAUDE.mdルール16（罫線・ツリー文字禁止、Markdownテーブル/箇条書きで統一）に準拠する。

### フィード1件（= PR 1件のAI要約）の構造

- ヘッダー行: `リポジトリ名 #PR番号`（owner一意ならownerは表の外に1回だけ表示。ルール7準拠）とPRアクション（opened/synchronize/closed等）
- 本文: `ai_summary_log.summary`（日本語翻訳済みの要約。ルール19に従い翻訳済み文面をそのまま表示する）
- メタ情報: `model`・`diff_length`・投稿日時
- スレッド返信相当:
  - `ai_summary_reviews` の各行を「評価者名（`reviewer_type`）: `comment`」の箇条書きで時系列表示
  - `commit_agent_log` に検出行があれば「検出エージェント: `detected_agent_name` (`detected_signal`)」を箇条書きで併記
- フッターリンク: `/ai-summary/{request_id}` へのディープリンク（本体Worker側の詳細ページ。CLAUDE.mdルール22の `commit_agent_log.request_id` リンク化ルールと同じ思想をAltワーカー側でも踏襲する）

### サブフィード（システムイベント）

`installation_permissions` / `webhook_log` / `cf_auth_access_log` / `resend_webhook_log` は、PRフィードとは別セクション（例: `/feed/system`）に、以下のMarkdownテーブル形式で表示する。

```markdown
| 発生時刻 | 種別 | 内容 | 結果 |
|---|---|---|---|
| 2026-07-05 10:00 | webhook | pull_request opened | success |
```

罫線文字・ツリー文字（`├` `└` `│` 等）は一切使用しない。

---

## 5. `@admin` 問い合わせ機能

**対象**: フィード内で `@admin <質問文>` の形式で入力されたテキストを起点に、Workers AI へ問い合わせ、結果を保存・表示する機能。

### 5.1 起動条件

Altワーカーのフィード画面（またはSlack風の入力欄）に `@admin ` プレフィックス付きテキストが送信された場合に発火する。本体Workerの `buildAiMessages.ts` と同じ規約（システムプロンプトは日本語固定、モード `a`/`b`/`c`）を踏襲し、Altワーカー内に同名の関数 `buildAiMessages()` を複製せず、可能であれば本体Workerの `src/utils/buildAiMessages.ts` 相当のロジックをAltワーカー側にも独立実装として持つ（共有npmパッケージ化は本仕様のスコープ外）。

```ts
const SYSTEM_PROMPT_JA = 'あなたは親切なアシスタントです。必ず日本語で回答してください。';
```

### 5.2 Workers AI 呼び出し

- モデル選択は本体Workerの `resolveAiModel()` / `DEFAULT_AI_MODEL`（`@cf/google/gemma-4-26b-a4b-it`）/ `FALLBACK_AI_MODEL`（`@cf/meta/llama-3.1-8b-instruct-fp8`）と同じ規約に合わせる。Altワーカー独自の環境変数 `ADMIN_AI_MODEL` で上書き可能にし、未設定時は上記デフォルトにフォールバックする
- 呼び出し失敗時のフォールバック方針は本体Workerの `runSummaryPipeline()` と同じ二段構え（primaryモデル失敗 → fallbackModelで再試行 → それも失敗なら `[AI_ERROR]` プレフィックス付きエラー文字列を返す）を採用する
- `env.AI` バインディングが存在しない場合は `[AI_NO_BINDING] Workers AI binding is not available` を返し、例外を投げない（本体Workerの `runSummaryPipeline()` と同じエラー文字列規約を踏襲し、AltワーカーのD1診断データとしても本体と一貫した文字列で検索できるようにする）

### 5.3 質問に与えるコンテキスト

`@admin` への質問には、フィード上で参照していたPR（`request_id`）が特定できる場合、`ai_summary_log.summary` と直近の `ai_summary_reviews.comment` をプロンプトに含める（本体Workerの `generateAiSummary` 相当のコンテキスト注入パターンを踏襲）。PR文脈がない場合は質問文のみを渡す。

### 5.4 保存方式

本体Workerの `ai_chat_shares` テーブルと同一設計思想（質問・回答・モデル・アクセス統計を1レコードに保持）で、Altワーカー固有のテーブル `alt_admin_queries` を新設する。`ai_chat_shares` をそのまま共有DBに書き込むことも技術的には可能だが、本体Workerの機能（`/ai-chat` 系）と用途が異なるため**テーブルを分離**し、責務の混在を避ける。

```sql
CREATE TABLE IF NOT EXISTS alt_admin_queries (
  id TEXT PRIMARY KEY,
  linked_request_id TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  model TEXT NOT NULL,
  fallback_used INTEGER NOT NULL DEFAULT 0,
  asked_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alt_admin_queries_linked_request_id ON alt_admin_queries(linked_request_id);
CREATE INDEX IF NOT EXISTS idx_alt_admin_queries_created_at ON alt_admin_queries(created_at);
```

- `linked_request_id`: 質問時に参照していた `ai_summary_log.request_id`（フィード外からの質問はNULL）
- `fallback_used`: フォールバックモデルが使われたかを本体Workerの `ai_summary_log.fallback_used` と同じ意味論で記録する
- `asked_by`: 質問者の識別子（Altワーカーの認証方式に依存。未認証で使う場合はIPハッシュ等、`ai_chat_shares.user_hash` と同様に生の個人情報を保存しない）

### 5.5 表示

`@admin` への回答はフィード上で該当PRエントリへのスレッド返信として表示する（`alt_notify_ingest_log.thread_ts` 相当の関連付けは不要で、`linked_request_id` による突合のみで十分）。回答本文は翻訳済み日本語のみを表示し、原文（英語プロンプトの生出力等）は表示しない（ルール19の思想をAltワーカーの新機能にも適用）。

---

## 6. 認可・レート制限・セキュリティ

**対象**: Altワーカーのingestエンドポイントと `@admin` エンドポイントに対する保護策。

- ingestエンドポイント（`POST /ingest` 等）は `NOTIFY_WORKER_SECRET` によるBearer認証を必須とする。シークレット自体は `wrangler secret put NOTIFY_WORKER_SECRET`（Altワーカー側）で管理し、`wrangler.toml` の `[vars]` には書かない（CLAUDE.mdルール4と同じ制約をAltワーカーにも適用する）
- `@admin` エンドポイントは、本体WorkerのAI要約機能同様、`aichat_rate_limit` 相当のレート制限テーブルをAltワーカー側にも用意し、同一質問者からの連続呼び出しを制限する（Workers AIの呼び出しコスト対策）
- D1への読み取りアクセスはAltワーカーの認証済みセッションを持つユーザーに限定する（本体Workerの `user_sessions` をAltワーカー側でも共有バインドして検証するか、独自の認証を持たせるかは実装フェーズで決定する。本仕様では「未認証での生データ閲覧を許可しない」ことのみを必須要件とする）

---

## 7. スラッシュコマンド（`/pts`・`/neko hms` 等）由来の通知の扱い

**対象**: `/slack/commands` エンドポイントが受け付けるスラッシュコマンド（現行の `/pts`、および将来追加が想定される `/neko hms` 等）が `sendNotification` 経由で発火する通知メッセージを、Altワーカーがどう区別・表示するか。

### 7.1 現状の仕組み（本体Worker側）

本体Workerのスラッシュコマンドは単一エンドポイント `/slack/commands` に集約されており、`command` フィールドで一次分岐、`text` フィールドでサブコマンドを分岐する（例: `/pts f1`）。Slackの署名検証・タイムスタンプ検証、および `response_type: ephemeral` の同期応答（Slackに200を返す部分）は**Slackプロトコル自体の要求**であり、`NOTIFY_TARGET=worker` に切り替えても本体Workerが引き続き処理する。Altワーカーはこの同期応答には一切関与しない。Altワーカーが受け取るのは、その同期応答と並行して `sendNotification`（内部的には `dispatchNotification`）経由で送られる「共有用の通知メッセージ」のみである。

| command | サブコマンド(`text`) | ハンドラ関数 | 通知メッセージの例 |
|---|---|---|---|
| `/pts` | (指定なし・自由文) | `handleTsubuyakiSlashCommand` | `📮 *user* さんの投稿:\n本文` |
| `/pts` | `f1` | `handleF1ScheduleSlashCommand` | `📅 *F1 開催予定*\n・日付　国旗 サーキット名（GP名）` |
| `/neko`（未実装・将来想定） | `hms` | 未実装（新設想定: `handleNekoHmsSlashCommand`） | `🏠 *HMS ...*\n本文`（絵文字・文言は実装時に決定） |

### 7.2 `/neko hms` 等を追加する場合の実装パターン（本体Worker側）

新しいスラッシュコマンドを追加する場合も、既存の `f1ScheduleSlackPost.ts` と同じ構造を踏襲する。

1. `command === '/neko'` の分岐を `/slack/commands` ハンドラに追加する
2. `text.toLowerCase() === 'hms'` でサブコマンドを判定する
3. メッセージ文字列を組み立てる**純粋関数**（例: `buildNekoHmsMessage()`）を切り出し、単体でテストする（CLAUDE.mdルール15: ロジック抽出→ユニットテスト→ハンドラ呼び出しの順で進める）
4. 組み立てたメッセージを `deps.sendNotification({ text })` に渡す。送信先の切り替え（Slack/Altワーカー）はこの関数自体が意識する必要はなく、`notifyDispatch` が `NOTIFY_TARGET` に応じて自動的に振り分ける

この構造を守る限り、新しいスラッシュコマンドは追加コード無しで自動的にAltワーカーへもリダイレクト可能になる。

### 7.3 Altワーカー側での種別判定

現行の `notifyDispatch` ペイロードには、どのコマンド／どの経路から発火したメッセージかを示す明示的なフィールド（`kind`等）が存在しない。そのため当面は、各ハンドラが統一して使っている「絵文字＋太字ラベルを先頭に置く」という表示規約を手がかりに分類する。

| 先頭の絵文字ラベル | 種別 | 発生源 |
|---|---|---|
| `📮` | 自由投稿 | `/pts`（サブコマンドなし） |
| `📅` | F1スケジュール | `/pts f1` |
| `🏠`（想定） | HMS通知 | `/neko hms`（将来実装時） |

Altワーカーの ingest 処理では、`text` の先頭行を（正規表現ではなく）`startsWith`/`indexOf` で判定し、`alt_notify_ingest_log` に `message_kind TEXT` カラムを追加して分類結果を保存する（CLAUDE.mdルール29: template literal内へのregexリテラル埋め込みで壊れた実例があるため、Altワーカー側でも文字列探索を基本方針とする）。

```sql
ALTER TABLE alt_notify_ingest_log ADD COLUMN message_kind TEXT;
```

将来的に本体Worker側の `notifyDispatch` ペイロードへ `kind` フィールドを追加する拡張も選択肢になるが、既存のSlack向けtext/blocksのみで完結する後方互換設計を崩さないため、まずはAltワーカー側のテキスト解析で対応する方針とする。

---

## 8. Resend送信通知webhookの代替処理具体例

**対象**: `POST /webhook/resend`（および `sourceId` 付き複数アカウント版）がResendから受信したメール配信結果（配信成功・バウンス等）を契機に送る通知を、Altワーカーがどう再現・表示するかの具体例。3節で述べた「ingestは到達確認のトリガー、詳細情報はD1直読み」という原則を、Resend連携という具体的なケースに当てはめたもの。

### 8.1 本体Worker側の現状の流れ

1. Resendからのwebhookペイロードを署名検証・重複排除する（`svix_id` 単位）
2. `deliveryStatus`（`email.delivered` 等）が確定したら `resendNotifyConfig = resolveNotifyConfig(c.env)` を作る
3. `isNotifyConfigured(resendNotifyConfig)` が `false` の場合は実際には送信せず、`slackResultText = 'skipped:missing_config'` として記録する（CLAUDE.mdルール8「記録」義務。送信しなかった事実自体をログに残す）
4. 設定済みの場合、`Resend: ${deliveryStatus}` / `from:` / `to:` / `subject:` 等の行からなる `slackText` を組み立て、`dispatchNotification(resendNotifyConfig, { text: slackText })` を呼ぶ
5. 結果を `resend_webhook_log.slack_result` / `slack_result_at` に保存する。`NOTIFY_TARGET=worker` に切り替えた場合もカラム名は歴史的経緯でそのまま `slack_result` を流用するが、実体は「通知結果全般」を意味する（Altワーカー実装時に読み替えること）

### 8.2 Altワーカー側の再現手順

1. ingestで受信した `text`（`Resend: delivered\nfrom: ...\nto: ...\nsubject: ...` 形式）の先頭行が `Resend: ` であることを判定し、システムイベント種別 `email` に分類する（7.3節と同じ先頭文字列判定の方針）
2. 詳細情報は `text` をパースして復元するのではなく、D1の `resend_webhook_log` を直接クエリして取得する
3. 代表クエリ例:

```sql
SELECT
  w.event_type,
  w.email_from,
  w.email_to,
  w.bounce_type,
  w.error_detail,
  w.slack_result,
  w.slack_result_at,
  s.label AS source_label,
  w.created_at
FROM resend_webhook_log w
LEFT JOIN resend_webhook_sources s ON s.id = w.source_id
ORDER BY w.created_at DESC
LIMIT 50;
```

4. 表示は4節の「システムイベント」サブフィードと同じMarkdownテーブル形式に合わせる:

```markdown
| 発生時刻 | 種別 | 内容 | 結果 |
|---|---|---|---|
| 2026-07-05 10:05 | email | delivered: user@example.com（subject: ご案内） | slack_result=ok |
| 2026-07-05 10:08 | email | bounced: user2@example.com（reason: mailbox_full） | slack_result=skipped:missing_config |
```

5. `slack_result` が `skipped:missing_config` の行は「通知未達」として強調表示する（背景色などでNGを示す。3状態区別ルールと同様、正常・異常を混同しない）。これはCLAUDE.mdルール8の「通知」義務——ログに残すだけでなく異常に気づける仕組みを用意する——をAltワーカーの表示面でも満たすためであり、本体Worker側の `NOTIFY_TARGET`/`NOTIFY_WORKER_URL` 設定不備にAltワーカーの管理者が気づける状態を作る

---

## 9. 今後の実装ステップ（チェックリスト）

**対象**: 本仕様を実装に移す際の作業順序の目安。本ドキュメント自体はコード変更を含まないため、以下は次セッション以降の実装タスク一覧として記録する。

1. Altワーカー用リポジトリ作成、`wrangler.toml` に本体Workerと同一 `database_id` の `[[d1_databases]]` を設定
2. `alt_notify_ingest_log` / `alt_admin_queries` テーブルのマイグレーション作成（本体Workerのマイグレーション運用パターンに合わせ、番号付きSQL文字列として管理）
3. ingestエンドポイント実装 + Bearer認証 + テスト（Authorizationヘッダ不一致で401を返すことを検証）
4. フィード表示ページ実装（3節のクエリを使用）+ テスト
5. `@admin` エンドポイント実装（Workers AI呼び出し + `alt_admin_queries` 保存）+ テスト（AIバインディング未設定時に `[AI_NO_BINDING]` を返すことを検証）
6. 本体Worker側で `NOTIFY_TARGET=worker` / `NOTIFY_WORKER_URL` / `NOTIFY_WORKER_SECRET` を設定し、実際に通知が届くことを確認
