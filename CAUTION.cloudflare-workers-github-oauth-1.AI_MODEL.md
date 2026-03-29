# CAUTION: AI_MODEL 運用上の注意と将来構想

## 対象

`AI_MODEL` 環境変数、`DEFAULT_AI_MODEL` 定数、`runSummaryPipeline` のフォールバック機構
— AI要約モデルの切り替え・障害時に起こりうる問題と、現状の対処範囲・未対処の構想をまとめる。

---

## 起こりうるシナリオ一覧

| # | シナリオ | 現状の対処 | 残存リスク |
|---|---|---|---|
| A | `AI_MODEL` に壊れたモデルを指定、`DEFAULT_AI_MODEL` は健在 | fallback で自動再試行、`usedModel` に実際のモデルを記録 | フォールバック発動が Slack 上で見えない (シナリオG参照) |
| B | `AI_MODEL` に壊れたモデルを指定、`DEFAULT_AI_MODEL` も壊れている | 両方失敗 → `[AI_ERROR] fallback also failed` が D1・Slack に記録 | Slack 通知で気づける。問題は小さい |
| C | `AI_MODEL` 未設定、`DEFAULT_AI_MODEL` が壊れている (モデル廃止等) | primary = fallback 同一 → 1回試行 → `[AI_ERROR]` | Slack エラー通知で気づける。問題は小さい |
| D | AI バインディング (`AI`) 自体が未設定 | `[AI_NO_BINDING]` → Slack エラー通知 | 気づける。問題なし |
| E | モデルは動くが品質が低い (空要約、意味不明な出力) | `[AI_EMPTY_RESPONSE]` / `[AI_UNEXPECTED_FORMAT]` → fallback 発動 | fallback で救われる可能性あり |
| F | エラーに気づかずデプロイを重ねる | Slack に `:warning: AI要約エラー` が毎回出る。D1 にも `[AI_*]` 蓄積 | **Slack を見ていない場合、気づけない** |
| G | フォールバック発動が常態化しているのに放置 | 毎回 fallback で要約成功 → Slack 通知は正常に見える | **`AI_MODEL` が壊れたまま放置される事実に気づけない** |

---

## 現状で対処済みの範囲

- フォールバック機構 (`runSummaryPipeline` の `fallbackModel` 引数)
- D1 `ai_summary_log.model` に実際に使用されたモデル名を記録
- Slack 通知に `[AI_*]` エラー時の警告メッセージ表示
- D1 `ai_summary_reviews` に自動診断レコード記録 (`classifySummaryResult`)

---

## 未対処: フォールバック発動の可視化 (シナリオG)

### 問題

フォールバックが発動しても Slack 通知は「正常な要約」として表示される。
`AI_MODEL` が壊れたまま気づかず放置される。

### 対処方針

- `SummaryPipelineResult` に `fallbackUsed: boolean` を追加
- Slack メッセージで `fallbackUsed === true` のとき要約に注記を追加
  - 例: `実験モデル (gpt-oss-120b) が失敗したためフォールバックモデルで要約しました`
- D1 には `model` カラムの値で判定可能 (`model !== resolveAiModel(AI_MODEL)` ならフォールバック発動)
  - 追加カラムは不要

---

## 未対処: 連続失敗検知 (シナリオF)

### 問題

Slack を常時監視していない場合、連続失敗に気づけない。
D1 に蓄積されるが能動的に `/status` を見に行かない限りわからない。

### 構想: 連続失敗時の管理者通知

パイプライン実行時または定期バッチで D1 の直近 N 件を確認し、
連続失敗を検知した場合に管理者へ通知する。

**段階1: Slack 専用チャンネルへのアラート**

- `runSummaryPipeline` の呼び出し元で、失敗時に D1 の直近5件を `SELECT`
- 直近5件すべてが `[AI_*]` プレフィックス付きなら Slack の管理者チャンネルに専用アラートを送る
- パイプライン自体の責務には含めず、呼び出し元 (`index.ts`) で判定する

**段階2: 管理者メール通知**

- Resend (メール送信サービス) の Webhook は既にこのワーカーで受信実績がある
- 連続失敗検知 → Resend API でメール送信、という流れは技術的に可能
- ただし以下の考慮が必要:
  - メール送信の頻度制御 (同じ障害で何十通も送らない)
  - 最終メール送信日時を D1 or KV に記録し、一定時間 (例: 24時間) は再送しない
  - メール本文に「直近の失敗ログ」「設定されている AI_MODEL の値」「対処手順」を含める

**段階3: /status ページでの警告表示**

- `/status` ページ表示時に D1 の直近 N 件を集計
- 失敗率が閾値を超えていれば警告バナーを表示
- これはパイプラインとは独立した表示ロジックなので、副作用なく追加できる

### 実装優先度

| 段階 | 内容 | 複雑度 | 効果 |
|---|---|---|---|
| 段階1 | Slack アラート | 小 | Slack を見ていれば気づける |
| 段階3 | /status 警告表示 | 小 | 能動的に確認すれば気づける |
| 段階2 | 管理者メール | 中 | Slack を見ていなくても気づける |

段階1と段階3は小規模な変更で実現可能。
段階2はメール送信の頻度制御とテンプレートの設計が必要なため、
必要性が確認されてから着手する。

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `src/utils/aiSummary.ts` | `runSummaryPipeline`, `DEFAULT_AI_MODEL`, フォールバックロジック |
| `src/index.ts` (L2648, L2687-2695) | パイプライン呼び出し、D1 記録 |
| `SPEC.cloudflare-workers-github-oauth-1.AI_MODEL.md` | フォールバック機構の設計仕様 |
