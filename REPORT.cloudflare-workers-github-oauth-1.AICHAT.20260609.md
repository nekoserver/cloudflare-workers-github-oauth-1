# AIチャットページ 分析レポート

**対象**: `GET /aichat` ページ（`src/views/aichat.ts`）および関連 API エンドポイント・D1 テーブル・ユーティリティ — 本リポジトリの AI チャット機能の全体像を整理し、構成・機能・テスト状況・改善余地を記録する。

- 作成日: 2026-06-09
- 対象リビジョン: `claude/wizardly-goldberg-clq7d0` ブランチ時点のソースコード

---

## 1. 概要

| 項目 | 値 |
|---|---|
| URL パス | `/aichat` |
| 認証 | 必須（`authMiddleware` で保護） |
| 本体ファイル | `src/views/aichat.ts`（約4,841行） |
| 共有ページ | `src/views/aichat-share.ts`（`/s/:userHash/:shareToken`） |
| バックエンド | Cloudflare Workers + Hono + Workers AI + D1 |

Workers AI の複数 LLM モデルで日本語回答を生成・自動保存・共有できるチャットページ。過去ログの全文検索、キーワード分類、サブクエリ（追加質問リンク）管理、検索露出ログ、カレンダーヒートマップ、日次統計、トークン使用量表示などを備えた包括的なプラットフォームになっている。

---

## 2. ルーティング（API エンドポイント一覧）

ルート定義はすべて `src/index.ts` 内。行番号は本レポート作成時点のもの。

### 表示・コア機能

| メソッド | パス | 行 | 役割 |
|---|---|---|---|
| GET | `/aichat` | L2761 | チャットページ本体を返す |
| POST | `/api/aichat` | L2800 | メッセージ送信・AI回答生成・`ai_chat_shares` へ自動保存 |
| GET | `/api/aichat/shares/search` | L2924 | 質問・回答の全文キーワード検索（最新30件） |
| GET | `/api/aichat/shares/calendar` | L2945 | カレンダー用の月別集計 |
| GET | `/api/aichat/shares/by-date` | L3001 | 日付別の過去ログ取得 |
| GET | `/api/aichat/shares/:id` | L3758 | 個別ログ詳細取得 |
| DELETE | `/api/aichat/shares/:id` | L3775 | 過去ログの論理削除（`deleted_at` 更新） |
| POST | `/api/aichat/share` | L3796 | 共有リンク作成 |

### 検索ログ・履歴

| メソッド | パス | 行 | 役割 |
|---|---|---|---|
| GET | `/api/aichat/search-log` | L3058 | キーワード統計ログ取得（集計） |
| GET | `/api/aichat/search-history` | L3077 | キーワード検索明細取得 |
| POST | `/api/aichat/search-log` | L3173 | 検索ログ記録 |
| POST | `/api/aichat/search-log/open-modal` | L3122 | モーダル用検索ログ取得 |
| POST | `/api/aichat/search-log/approve` | L3150 | 検索ログ承認・一括登録 |

### 露出ログ・サブクエリ

| メソッド | パス | 行 | 役割 |
|---|---|---|---|
| GET | `/api/aichat/search-impressions` | L3199 | 検索結果露出ログ集計（質問単位） |
| POST | `/api/aichat/search-impressions` | L3240 | 露出ログ自動記録（バルク INSERT） |
| GET | `/api/aichat/subqueries` | L3260 | サブクエリマスタ一覧 |
| POST | `/api/aichat/subqueries` | L3296 | サブクエリ登録（重複防止） |
| GET | `/api/aichat/share-subquery-links` | L3357 | 質問×サブクエリリンク取得 |
| GET | `/api/aichat/share-subquery-links/all` | L3380 | 全リンク取得（グループ化） |
| POST | `/api/aichat/share-subquery-links` | L3739 | リンク登録 |
| GET | `/api/aichat/subquery-keyword-questions` | L3313 | サブクエリ×キーワードの質問一覧 |

### キーワード分類・カテゴリ

| メソッド | パス | 行 | 役割 |
|---|---|---|---|
| GET | `/api/aichat/all-keywords` | L3474 | 全キーワード一覧（分類状態含む） |
| GET | `/api/aichat/keyword-categories` | L3506 | キーワード分類一覧 |
| POST | `/api/aichat/keyword-categories` | L3697 | キーワード分類登録 |
| POST | `/api/aichat/keyword-category-map` | L3718 | キーワード×分類マッピング |
| GET | `/api/aichat/keyword-categories-summary` | L3675 | 分類サマリー取得 |
| GET | `/api/aichat/category-groups` | L3555 | 大分類グループ一覧 |
| POST | `/api/aichat/category-groups` | L3581 | グループ作成 |
| POST | `/api/aichat/category-groups/:id/add-category` | L3604 | グループに分類追加 |
| POST | `/api/aichat/category-groups/:id/remove-category` | L3632 | グループから分類削除 |
| DELETE | `/api/aichat/category-groups/:id` | L3657 | グループ削除 |

### 統計・分析

| メソッド | パス | 行 | 役割 |
|---|---|---|---|
| GET | `/api/aichat/daily-stats` | L2960 | 日別キーワード×質問数 |
| GET | `/api/aichat/shares/by-keyword` | L3021 | キーワード別質問一覧 |
| GET | `/api/aichat/keywords/monthly` | L3039 | 月別キーワード数推移 |
| GET | `/api/aichat/search-keyword-analysis` | L3096 | 質問×キーワード分析 |
| GET | `/api/aichat/share-keywords` | L3421 | 質問が含むキーワード取得 |
| GET | `/api/aichat/shares-by-question` | L3439 | 質問テキスト一致検索 |
| GET | `/api/aichat/shares-by-question-hash` | L3456 | `conversation_hash` による異モデル回答比較 |
| GET | `/api/aichat/token-usage` | L3526 | モデル別トークン使用量集計 |

---

## 3. AIモデルとモデル設定

### 利用可能モデル（`src/views/aichat.ts` L7-14、許可リストは `src/index.ts` L2791-2798）

| モデルID | 備考 |
|---|---|
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | デフォルト |
| `@cf/meta/llama-3.1-8b-instruct-fp8` | |
| `@cf/meta/llama-3.1-70b-instruct` | |
| `@cf/google/gemma-4-26b-a4b-it` | `enable_thinking` 等の固有パラメータあり |
| `@cf/google/gemma-3-12b-it` | |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | |

API 側でモデルIDのホワイトリスト検証を行い、不正なモデル指定を防止している。

### 設定の仕組み（`src/utils/aichatModelConfig.ts`）

| エクスポート | 役割 |
|---|---|
| `AICHAT_MODEL_MAX_TOKENS` | モデル別の最大トークン数 |
| `AICHAT_MODEL_EXTRA_PARAMS` | モデル固有パラメータ（例: gemma-4 の `enable_thinking`） |
| `getModelRunParams(model, base)` | 基本パラメータにモデル固有パラメータをマージ |

- ユーザーの選択モデルは Cookie に保存され、UI のドロップダウンで切り替え可能
- モデルごとの表示色は D1 `aichat_model_colors` で管理し、ページ表示時にロード（`src/index.ts` L2769-2775）
- 主モデル失敗時は別モデルで自動再試行するフォールバック機構あり（`src/index.ts` L2891-2918）

---

## 4. D1 テーブル

| テーブル名 | マイグレーション | 主カラム | 説明 |
|---|---|---|---|
| `ai_chat_shares` | 0036 | `id` (PK), `user_id` (FK), `question`, `answer`, `model`, `created_at`, `conversation_hash`, `question_hash`, `deleted_at`, `input_tokens`, `output_tokens`, `total_tokens` | AI回答の自動保存・共有レコード |
| `aichat_search_log` | 0040 | `id`, `user_id` (FK), `share_id` (FK), `keyword`, `first_searched_at`, `last_searched_at`, `select_count`, `result_count`, `deleted_at` | キーワード検索統計（集計） |
| `aichat_search_history` | 0041 | `id`, `user_id` (FK), `share_id` (FK), `keyword`, `seq_num`, `searched_at`, `result_count` | キーワード検索明細（全履歴） |
| `aichat_search_impressions` | 0044 | `id`, `user_id` (FK), `share_id` (FK), `result_count`, `searched_at`, `deleted_at` | 検索結果露出ログ（1検索×1質問=1行） |
| `aichat_subqueries` | 0045 | `id` (PK), `query` (UNIQUE) | サブクエリ（追加質問テキスト）マスタ |
| `aichat_share_subquery_links` | 0046 | `id`, `user_id`, `question`, `subquery_id` (FK), `url`, `created_at`, `question_hash`, UNIQUE(user_id, question, subquery_id) | 質問×サブクエリ×URL の関連テーブル |
| `aichat_model_colors` | 0048 | `model_id` (PK), `color`, `label` | モデル表示色定義 |
| `aichat_category_groups` | 0051 | `id` (PK), `user_id` (FK), `group_name`, `category_ids` | キーワード分類の大分類グループ |

主なインデックス: `idx_ai_chat_shares_user_id`、`idx_ai_chat_shares_conv_hash`（0047で追加）、`idx_aichat_search_log_unique`、`idx_aichat_search_history_user`、`idx_asl_question_hash` など。

---

## 5. 機能一覧

### コア
1. 会話・回答生成 — Workers AI の複数モデルで日本語回答を生成
2. 自動保存 — 回答を `ai_chat_shares` に自動 INSERT
3. 共有リンク — 読み取り専用ページ `/s/:userHash/:shareToken` を生成

### 検索・履歴
4. 全文検索（質問・回答、最新30件）
5. 検索ログ集計記録（`aichat_search_log`）
6. 検索明細履歴（`aichat_search_history`、`seq_num` で順序付け）
7. 質問×キーワード分析テーブル
8. 検索結果露出ログの自動記録と UI（キーワード数降順・上位30件）

### サブクエリ・追加質問
9. サブクエリのマスタ登録・管理
10. 1質問に複数サブクエリ+URL のリンク登録
11. 過去ログ詳細モーダル内での「追加質問リンク」表示

### キーワード分類
12. キーワードのカテゴリ分類
13. 配色カスタマイズ（パレットモーダルで4種の色定義）
14. 複数カテゴリを束ねる大分類グループ

### UI/UX
15. キーワードハイライト（モーダル内、ON/OFF切り替え）
16. サイドバー項目の左スワイプ削除（確認後に論理削除）
17. サイドバー検索窓（リアルタイム検索・件数表示）
18. キーワードモーダル（回数順/あいうえお順）
19. カレンダーヒートマップ（サイドバー下部）

### 統計・モデル管理
20. 日次統計グラフ（日別キーワード数・質問数）
21. モデル別トークン使用量集計
22. モデル選択ドロップダウンと色ドット表示
23. `conversation_hash` による同一質問の異モデル回答比較
24. モデルフォールバック（主モデル失敗時の自動再試行）

---

## 6. フロントエンド構造

`getAiChatPage()` が単一の HTML 文字列（CSS・JS 込み）を生成する。主な構成:

| 領域 | 内容 |
|---|---|
| ナビバー | サイドバートグル、モデル色ドット+ドロップダウン、モデルセレクト、機能ボタン群（リンク質問・サブクエリ・露出ログ・質問分析・日次統計・トークン使用量 等）、ユーザーメニュー |
| サイドバー（左） | 検索窓・クリアボタン・ヒット件数、過去ログ結果リスト（スワイプ対応）、カレンダーヒートマップ |
| メイン | チャットログ、入力フォーム（Ctrl+Enter / Shift+Enter 送信） |
| 結果パネル | 質問・回答の2カラム表示、トークン数・共有リンクフッター |
| モーダル群 | トークン使用量、日次統計、露出ログ、サブクエリ一覧/登録、キーワード分類、配色パレット、過去ログ詳細、削除確認 ほか多数 |

### z-index 管理

CLAUDE.md ルール26 に従い、`getNextZ()`（aichat.ts 内）でモーダルの z-index を動的に算出している。開いているモーダルの最大 z-index を走査し `max + 100` を割り当てる方式。静的モーダルのデフォルト値も `staticZDefaults` 相当のマップに登録されている。

### 主な状態管理変数（グローバル）

`currentResults`（検索結果キャッシュ）、`currentMode`（new / search / keyword）、`selectedIdx`、`swipeOpenItem` / `swipeOpenInner`（スワイプ状態）、`impressionsCachedItems`、`subqueriesAllItems`、`sqSelectedCats` / `sqSelectedGroupId` など。

---

## 7. 主要エクスポート関数

| ファイル | エクスポート | 役割 |
|---|---|---|
| `src/views/aichat.ts` | `getAiChatPage(user)` | チャットページ HTML 全体を生成 |
| `src/views/aichat-share.ts` | `getAiChatSharePage(share)` | 共有ページ生成 |
| `src/views/aichat-share.ts` | `getAiChatShareNotFoundPage()` | 共有404ページ生成 |
| `src/utils/aichatModelConfig.ts` | `getModelRunParams(model, base)` | モデル実行パラメータのマージ |
| `src/utils/buildAiMessages.ts` | `buildAiMessages(message, mode)` | システムプロンプトモード（a/b/c）付きメッセージ構築 |
| `src/utils/conversationHash.ts` | `computeConversationHash(...)` | 会話の SHA-256 ハッシュ算出 |
| `src/utils/conversationHash.ts` | `computeQuestionHash(userId, question)` | 質問ハッシュ算出 |
| `src/utils/stripThinkTags.ts` | `stripThinkTags(raw)` | 回答から `<think>` タグを除去 |
| `src/utils/aiTimeout.ts` | `withAiTimeout(promise, timeoutMs)` | AI呼び出しのタイムアウト制御（既定5000ms） |

---

## 8. テストカバレッジ

aichat 関連テストファイルは約40個。テーマ別の内訳:

| カテゴリ | 件数 | 例 |
|---|---|---|
| キーワード分類 | 6 | `aichat-keyword-classify.test.ts`, `aichat-kw-classify-badge.test.ts` |
| キーワードグループ | 5 | `aichat-kw-group-toggle.test.ts`, `aichat-kw-group-remove.test.ts` |
| ハイライト機能 | 6 | `aichat-highlight-toggle.test.ts`, `aichat-swipe-highlight-bugfix.test.ts` |
| サブクエリ・リンク質問 | 5 | `aichat-subqueries.test.ts`, `aichat-linked-questions.test.ts` |
| モデル管理 | 6 | `aichat-model-display.test.ts`, `aichat-model-colors.test.ts` |
| 検索・ログ | 4 | `aichat-search-history.test.ts`, `aichat-search-impressions.test.ts` |
| UI/UX | 4 | `aichat-sidebar-toggle.test.ts`, `aichat-navbar-visibility.test.ts` |
| 統計・データ | 3 | `aichat-daily-stats.test.ts`, `aichat-token-usage.test.ts` |
| その他 | 2 | `aichat-kw-palette.test.ts`, `aichat-kw-modal-models.test.ts` |

個別機能のユニットテストは充実している一方、`src/views/aichat.ts` 本体に直接対応するテストは `src/views/aichat.test.ts` の1ファイルのみで、API と UI を通した統合テストは手薄。

---

## 9. 問題点・改善余地

1. **サブクエリリンクのテキスト結合** — `aichat_share_subquery_links.question` は FK ではなくテキスト一致のため、質問テキストが変わるとリンクが孤立しうる（質問は不変設計のため実運用上の影響は小。`SPEC.cloudflare-workers-github-oauth-1.AICHAT_SUBQUERY_WORKFLOW.md` 参照）
2. **リンクURLの更新非対応** — 同一質問×同一サブクエリの URL 差し替えは DELETE→再登録が必要。UPDATE 対応の検討余地あり
3. **フォールバック発動の可視化不足** — フォールバックが発動しても通知上は正常に見える（`CAUTION.cloudflare-workers-github-oauth-1.AI_MODEL.md` 参照）。結果オブジェクトに `fallbackUsed` フラグを追加し通知に注記する案がある
4. **連続失敗の検知機構なし** — AI エラーが連続しても能動的に気づける仕組みがない。D1 直近N件全失敗時のアラートや `/status` への警告バナーが構想段階
5. **露出ログ POST のエラー握りつぶし** — クライアント側で `.catch(function(){})` により黙殺している（aichat.ts L1772 付近）。CLAUDE.md ルール8（記録・通知・テスト）の観点では最低限のログ記録が望ましい
6. **ハッシュ2種の用途整理** — `conversation_hash` と `question_hash` が併存しており、用途のドキュメント整理が望ましい
7. **統合テストの強化** — API×UI を通したエンドツーエンドの検証が手薄
8. **検索結果30件制限・カレンダー描画** — データ量増加時の妥当性検証とページング・遅延読み込みの検討余地

---

## まとめ

AIチャットページは、複数 LLM モデル対応・自動保存・共有・検索・キーワード分類・サブクエリ管理・統計表示を備えた本リポジトリ最大級の機能群であり、8つの D1 テーブルと約35の API エンドポイント、約40のテストファイルに支えられている。機能面は精巧に作り込まれている一方、フォールバックの可視化・連続失敗検知・エラー握りつぶしの記録など、運用監視面に改善余地がある。
