# SPEC.cloudflare-workers-github-oauth-1.20260804.AICHAT_OVERVIEW

## AIチャット機能群 総まとめ（2026-05-30〜2026-08-02）

**対象**: `/aichat`（`src/views/aichat.ts`）、`/answer-graph`（`src/views/answerGraph.ts`）、共有ページ（`src/views/aichat-share.ts`）、関連APIエンドポイント群（`src/index.ts` の `/api/aichat/*`）、D1テーブル群（`ai_chat_shares` ほか多数）— AIチャット機能がゼロから実装された2026-05-30から本ドキュメント作成時点（2026-08-02 の最新コミットまで）の約2ヶ月間、全185コミットをテーマ別に整理し、各機能の対象・背景・現在の仕様を一望できるようにする。個別に詳細SPECが存在する「追加質問（サブクエリ）ワークフロー」は [`SPEC.cloudflare-workers-github-oauth-1.AICHAT_SUBQUERY_WORKFLOW.md`](./SPEC.cloudflare-workers-github-oauth-1.AICHAT_SUBQUERY_WORKFLOW.md) を、「過去ログのスワイプ削除」は [`SPEC.cloudflare-workers-github-oauth-1.AICHAT_SWIPE.md`](./SPEC.cloudflare-workers-github-oauth-1.AICHAT_SWIPE.md) を参照。本ドキュメントはそれらを含む全体像の索引を兼ねる。

---

## 目次

1. 基盤構築（ページ新設・Markdownレンダリング）
2. サイドバー・カレンダー
3. 詳細プレビューモーダルの基本UI
4. 共有リンク
5. 検索履歴・検索明細・質問分析
6. 露出ログ
7. 追加質問（サブクエリ）ワークフロー ※詳細は別ファイル
8. モデル選択・モデルカラー・フォールバック
9. 複数モデル比較（スワイプ・再問い合わせ）
10. z-index動的管理（`getNextZ()`）
11. 日次統計モーダル
12. キーワード分類システム（大分類・中分類・配色）
13. bge-m3埋め込みキャッシュ・AI推薦・Zanzibarツリー
14. `/answer-graph`（回答伝播グラフ）新規ページ
15. その他のUI改善・不具合修正

---

## 1. 基盤構築（ページ新設・Markdownレンダリング）

**対象**: `/aichat` ページの新規実装、モデル選択とフォールバックの初期ロジック、ダークモード対応、Markdownレンダリング機能。

**背景**: Cloudflare Workers AI を使ったチャットページとして `/aichat` をゼロから実装した。当初は環境変数 `AI_CHAT_MODEL` 固定のシンプルな構成で、レイアウト・ダークモード対応・Markdown描画を段階的に追加した。

**現在の仕様**: AI応答は `parseMd()`（後述14章で共有ユーティリティへ統合済み）でMarkdownとしてHTML化してから `innerHTML` で描画する。ダークモードはCookie未設定時にデフォルトON。

| コミット | 日付 | 件名 |
|---|---|---|
| [`0454881`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0454881) | 2026-05-30 | AIチャットページの追加とナビメニューへの追加 |
| [`a0b003e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a0b003e) | 2026-05-30 | AIチャットのモデル選択ロジックを修正（AI_CHAT_MODEL優先・実行失敗時のみフォールバック） |
| [`4883d79`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4883d79) | 2026-05-30 | ダークモードをデフォルトONに変更・AIチャットページのコントラスト改善 |
| [`4c74a08`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4c74a08) | 2026-05-30 | AIチャット: 入力欄が応答に重ならないようレイアウトを修正 |
| [`6fb436c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6fb436c) | 2026-05-30 | AIチャット: ヘッダーを削除しモデル名短縮形をナビバーに移動 |
| [`e689a0e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e689a0e) | 2026-05-30 | AIチャット: ダークモードが起動時に適用されない不具合を修正 |
| [`06758aa`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/06758aa) | 2026-06-02 | 機能: AIチャット詳細パネルと回答バブルにMarkdownレンダリングを追加 |
| [`1ad5a2b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1ad5a2b) | 2026-08-02 | aichat.ts/answerGraph.tsのMarkdownパーサー複製を既存の共有ユーティリティへ統合 |

---

## 2. サイドバー・カレンダー

**対象**: 左サイドバー（検索窓・過去ログ一覧・当月キーワード・カレンダーヒートマップ）。

**背景**: 過去ログを検索・日付・キーワードの3方向から辿れるよう、サイドバーを段階的に拡張した。カレンダーは月別の投稿件数をヒートマップで表示し、日付タップでその日のQ&A一覧を表示する。

**現在の仕様**: サイドバー開時に当日を自動ロード、キーワードモーダルはサイドバー外の `fixed` 配置（サイドバー幅を侵食しない）、余白タップでの自動クローズは設定ページでON/OFF切替可能。

| コミット | 日付 | 件名 |
|---|---|---|
| [`11a93b9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/11a93b9) | 2026-05-30 | AIチャット: ☰ボタンをナビバー内左端に移動・ヒートマップカレンダーを追加 |
| [`9843cb2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9843cb2) | 2026-05-30 | AIチャット: サイドバー検索・全幅結果パネルを追加 |
| [`d0c9cf1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d0c9cf1) | 2026-05-30 | AIチャット: サイドバーの余白タップ閉じを設定ページで制御できるようにする |
| [`b8a9ca2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b8a9ca2) | 2026-06-02 | feat: サイドバーフォーカスなし・削除ボタン即時表示・デフォルトモーダル表示 |
| [`cb5d6b1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cb5d6b1) | 2026-06-02 | 修正: 日付リンクタップ時にサイドバーが開かない問題（stopPropagation追加） |
| [`3a3dc78`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3a3dc78) | 2026-06-03 | AIチャット：キーワードモーダルをサイドバー外 fixed 配置に変更、日付ステータスを △/◯件 形式に更新 |
| [`49924c9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/49924c9) | 2026-06-03 | AIチャット：キーワードモーダルクリック時にサイドバーが閉じるバグを修正 |
| [`75f3fc1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/75f3fc1) | 2026-06-03 | feat: サイドバー開時に当日の質問を自動ロード・カレンダー当日フォーカス |
| [`85f7238`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/85f7238) | 2026-06-03 | feat: サイドバーにモデル名削除・新着/キーワードトグル・月次キーワードフィルタを追加 |
| [`7d7841f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7d7841f) | 2026-06-07 | モーダル検索ボタン押下時にサイドバーの既存結果を即消去してから再検索する |
| [`a49b550`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a49b550) | 2026-06-08 | AIチャット: 📈ボタンをカレンダー左端（タイトル左隣）に移動して見えない問題を修正 |
| [`dde02ec`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dde02ec) | 2026-06-08 | AIチャット: カレンダー欄📈ボタンで日次KW数・質問数グラフモーダルを追加 |
| [`30c1f48`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/30c1f48) | 2026-06-09 | サイドバートグル: 開閉のたびに初期化・クリアを徹底化 |
| [`e521e06`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e521e06) | 2026-06-09 | サイドバーカレンダー: 結果リスト溢れとAPIエラー時の非表示バグを修正 |
| [`54b1bd8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/54b1bd8) | 2026-06-28 | カレンダー: データ無し日付もクリック可能に・タップ時にサイドバーを開く |
| [`74ef30c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/74ef30c) | 2026-06-28 | W杯ラウンド32対戦表を最新データに更新、カレンダー全日付タップ対応 |

---

## 3. 詳細プレビューモーダルの基本UI

**対象**: `historyModalBackdrop`（AIチャットの詳細プレビューモーダル、通称「過去ログモーダル」）の吹き出し配置・日付連携・検索窓・キーワードハイライト表示。

**背景**: 質問・回答を中央モーダルで再現するUIとして開始し、吹き出しの向き（ユーザー＝左／AI＝右）、日付タップでのサイドバー連携、ヘッダー内検索窓などを積み上げた。`/answer-graph` の回答モーダル（14章）はこのモーダルの主要機能を移植したもの。

| コミット | 日付 | 件名 |
|---|---|---|
| [`550ec99`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/550ec99) | 2026-06-02 | AIチャット詳細プレビューモーダル: 吹き出し逆転・日付リンク・ハイライト |
| [`ba9f8bb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ba9f8bb) | 2026-06-02 | AIチャット詳細プレビューモーダルのUI改善 |
| [`34e6c03`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/34e6c03) | 2026-06-03 | fix: 過去ログモーダルのヘッダ検索ボタンで左サイドバーがすぐ閉じる問題を修正 |
| [`d31cbf2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d31cbf2) | 2026-06-07 | 詳細プレビューモーダル: ハイライト表示/非表示トグルボタンを追加 |
| [`62240e3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/62240e3) | 2026-06-09 | 詳細プレビューモーダル: 検索実行後に検索窓をクリアする |
| [`c6d0802`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c6d0802) | 2026-06-12 | 詳細プレビューモーダル: 🔑トグルOFF時にキーワードを出現回数順でアイコン上部に表示 |
| [`0d4dff1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0d4dff1) | 2026-07-04 | テキスト選択解除バグの修正と、世界遺産ランキングのサイドバー検索結果をAIチャット詳細プレビューモーダルで表示するよう変更 |

---

## 4. 共有リンク

**対象**: `/s/:userHash/:shareToken` 共有ページと「🔗 リンクをコピー」ボタン。

**背景**: 個々のQ&Aを認証不要の外部URLとして公開できるようにした（`ai_chat_shares` テーブル、migration 0036）。

| コミット | 日付 | 件名 |
|---|---|---|
| [`c0cb3f7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c0cb3f7) | 2026-05-30 | AIチャット共有リンク機能を追加 |
| [`3790834`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3790834) | 2026-06-03 | feat: リンクをコピーボタンの横に別タブで開くボタン（↗）を追加 |
| [`5bd353a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5bd353a) | 2026-07-05 | /neko コマンド応答で言語モデル表示・共有リンクと時刻プレフィックスを非表示化 |

---

## 5. 検索履歴・検索明細・質問分析

**対象**: 「📋 検索履歴」「🗂 検索明細」「📊 質問分析」の各モーダル、および `aichat_search_log` / `aichat_search_history` テーブル。

**背景**: 検索キーワードの選択ログを記録する仕組みから始まり、質問ごとにどのキーワードで何回ヒットしたかを分析するモーダル群へ発展した。

| コミット | 日付 | 件名 |
|---|---|---|
| [`4a5697b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4a5697b) | 2026-06-02 | feat: AIチャットナビバーに検索履歴モーダルを追加 |
| [`dce68b7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dce68b7) | 2026-06-02 | feat: 質問×キーワード分析ボタンを追加（aichat_search_history 集計表示） |
| [`8825a21`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8825a21) | 2026-06-02 | feat: 検索明細履歴ボタンを追加（aichat_search_history 最新30件表示） |
| [`34cf30f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/34cf30f) | 2026-06-02 | fix: 質問分析モーダルのキーワード表示ロジックを修正 |
| [`b3ce6f1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b3ce6f1) | 2026-06-02 | feat: 質問分析モーダルに連番列・降順ソート・上位30件制限を追加 |
| [`7e5e589`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7e5e589) | 2026-06-02 | feat: 質問分析モーダルの質問セルタップで過去ログを中央モーダル表示 |
| [`64222ab`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/64222ab) | 2026-06-02 | feat: 質問分析モーダルを過去ログ表示中も保持・全キーワードハイライト |
| [`b182936`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b182936) | 2026-06-02 | fix: 日付リンクで左サイドメニューを開く際に質問分析モーダルを閉じる |
| [`2aba787`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2aba787) | 2026-06-07 | DBキーワードハイライト: 🔑ボタンをDB検索履歴と連携し有効化 |
| [`f5070a9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f5070a9) | 2026-06-09 | AIチャットサイドバー: 検索ログ書き出しモーダルを追加 |
| [`db847f5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/db847f5) | 2026-06-09 | 検索ログモーダル: DB書き込みを承認ボタン押下時のみに変更 |
| [`131e055`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/131e055) | 2026-06-09 | 検索ログモーダル: 承認後に DB 実状態を再取得して不一致を修正 |

---

## 6. 露出ログ

**対象**: 「📋 露出ログ」モーダルと `aichat_search_impressions` テーブル。

**背景**: 検索結果に「露出した」全質問を記録し、キーワード数の多い順にランキング表示する。詳細は [`SPEC.cloudflare-workers-github-oauth-1.AICHAT_SUBQUERY_WORKFLOW.md`](./SPEC.cloudflare-workers-github-oauth-1.AICHAT_SUBQUERY_WORKFLOW.md) 5章にも記載。

| コミット | 日付 | 件名 |
|---|---|---|
| [`9d8dd09`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9d8dd09) | 2026-06-02 | feat: aichat_search_impressions テーブルと露出ログ機能を追加 |
| [`b02d02b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b02d02b) | 2026-06-02 | feat: 露出ログモーダルを質問分析モーダルと同等のパターンに変更 |
| [`0f8b580`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0f8b580) | 2026-06-03 | feat: 過去ログモーダルにヘッダ検索窓を追加・露出ログからの動線を整備 |
| [`05e18ef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/05e18ef) | 2026-06-03 | fix: 露出ログモーダルの左端カラムをキーワード数に変更・最終検索カラムをトグル化 |

---

## 7. 追加質問（サブクエリ）ワークフロー

**対象**: 「🔗 サブクエリ」「📎 リンク質問」モーダル群、`aichat_subqueries` / `aichat_share_subquery_links` テーブル。

**詳細は別ファイル**: [`SPEC.cloudflare-workers-github-oauth-1.AICHAT_SUBQUERY_WORKFLOW.md`](./SPEC.cloudflare-workers-github-oauth-1.AICHAT_SUBQUERY_WORKFLOW.md) を参照（本セクションはコミット一覧のみを補完する）。当該ファイルの「関連コミット」表は #450 時点までしか記録していなかったため、それ以降の関連コミットを以下に追記する。

| コミット | 日付 | 件名 |
|---|---|---|
| [`8567c0f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8567c0f) | 2026-06-03 | AIチャット：応答ごとの「＋ 追加質問を登録する」ボタンをインライン追加 |
| [`c7cad56`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c7cad56) | 2026-06-03 | feat: サイドバーのサブクエリ保有質問を薄青色でハイライト |
| [`6aac9fc`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6aac9fc) | 2026-06-03 | feat: サブクエリを持つ質問一覧ビュー（📎 リンク質問ボタン）を追加 |
| [`44c93f0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/44c93f0) | 2026-06-03 | feat: 露出ログモーダルでサブクエリ持ち質問行を薄水色にしサブクエリ詳細モーダルを表示 |
| [`30d2e3d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/30d2e3d) | 2026-06-03 | feat: リンク質問モーダルの質問タップで過去ログモーダルを開く |
| [`180b5c6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/180b5c6) | 2026-06-04 | AIチャット：サブクエリ一覧モーダルの表示を改善（#カラム削除・追加質問総数・多い順ソート） |
| [`2fdbcea`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2fdbcea) | 2026-06-04 | サブクエリ質問一覧モーダル：質問クリックで過去ログを最上位モーダルで表示 |
| [`46f1928`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/46f1928) | 2026-06-04 | サブクエリ一覧：キーワードバッジクリックで質問一覧モーダルを表示 |
| [`f1edc8a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f1edc8a) | 2026-06-04 | サブクエリ一覧モーダル: 追加質問数カラム左端化・キーワードバッジ表示 |
| [`6c0a972`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6c0a972) | 2026-06-05 | サブクエリ質問一覧のカラー表示をリンク行単位に変更し異モデル比較モーダルを追加 |
| [`246d85f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/246d85f) | 2026-06-06 | appendAiResponseRow の追加質問ボタンで addSubqueryModal が正しいレイヤーに表示されない問題を修正 |
| [`7f04a78`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7f04a78) | 2026-06-06 | サブクエリ一覧のサブクエリセルをタップして選択→質問一覧モーダルを表示する機能を追加 |
| [`fb7abeb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fb7abeb) | 2026-06-07 | 追加質問リンク: 各行の先頭にモデル色丸を表示 |
| [`ab73fd7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ab73fd7) | 2026-06-07 | サブクエリ一覧: 分類済みキーワードバッジを中抜き紫スタイルで表示 |
| [`523e2c8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/523e2c8) | 2026-06-08 | キーワード分類モーダル: バッジのサイズ・形をサブクエリ一覧バッジに統一 |
| [`8eb6589`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8eb6589) | 2026-06-09 | サブクエリ一覧モーダル: 「＋新規追加」ボタンをヘッダに移動 |
| [`40624d0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/40624d0) | 2026-06-09 | サブクエリを持つ質問一覧: ヘッダにソートトグルボタンを追加 |
| [`7ec0518`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7ec0518) | 2026-06-09 | サブクエリ一覧: 分類カテゴリ・大分類フィルタをthヘッダ上に移植 |
| [`22e85f6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/22e85f6) | 2026-06-09 | サブクエリ一覧: 分類カテゴリ選択時のキーワードハイライトを修正 |
| [`a278869`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a278869) | 2026-06-09 | サブクエリ一覧: 配色カスタマイズのパレット色をキーワードハイライトに適用 |
| [`94cfa7f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/94cfa7f) | 2026-06-10 | サブクエリ一覧: 複数カテゴリ所属キーワードが2つ目以降のカテゴリ選択でヒットしない問題を修正 |

---

## 8. モデル選択・モデルカラー・フォールバック

**対象**: ナビバーのモデル選択ドロップダウン、`aichat_model_colors` テーブル、フォールバック挙動、LaTeX記号変換、日本語system promptモード。

**背景**: 単一モデル固定から、複数モデルをドロップダウンで選べる構成へ拡張し、モデルごとに色を割り当てて視覚的に区別できるようにした。AIモデルが `$\rightarrow$` のようなLaTeX記法を出力するケースに対応するため、Unicode記号への変換ロジック（`mdInline` の `latexMap`、現在は `markdownRenderer.ts` の `inline()` に統合済み）を追加した。

**現在の仕様**: モデル一覧は `DEFAULT_AICHAT_MODELS` に一元化（`/apis` ページとも共有）。選択したモデルでの実行に失敗した場合のみフォールバックモデルへ自動切替し、バブルに「(フォールバック)」ラベルと通知文を表示する。

| コミット | 日付 | 件名 |
|---|---|---|
| [`be98fbd`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/be98fbd) | 2026-06-04 | AIチャット：ナビバーのモデル名をドロップダウン選択に変更 |
| [`9671be9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9671be9) | 2026-06-04 | AIチャット: モデルドロップダウンのデフォルトを llama-3.3-70b-instruct-fp8-fast に変更 |
| [`dcead7f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dcead7f) | 2026-06-04 | Gemma-4 応答なし修正・モデルリスト更新（DeepSeek削除・新モデル追加） |
| [`4d0bcd3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4d0bcd3) | 2026-06-04 | glm-4.7-flash をモデル選択肢から削除 |
| [`c5e048b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c5e048b) | 2026-06-04 | AIチャットのモデル名表示を動的化しライブバブルにもラベルを追加する |
| [`3e76be2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3e76be2) | 2026-06-04 | バブルラベルを常にナビバー選択モデルで表示するよう修正 |
| [`1711cc4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1711cc4) | 2026-06-04 | フォールバック発生時のバブル表示改善 |
| [`934760c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/934760c) | 2026-06-04 | AIチャットにsystem ロール日本語モードをデフォルト採用しUI切り替えを追加する |
| [`342c648`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/342c648) | 2026-06-04 | サブクエリ質問一覧モーダルにモデルカラー左枠線とフィルター機能を追加 |
| [`6bfd5dd`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6bfd5dd) | 2026-06-04 | AIチャットモデルカラー機能追加 |
| [`5262859`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5262859) | 2026-06-06 | mdInline に LaTeX 数式記号の Unicode 変換を追加 |
| [`ad37157`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ad37157) | 2026-06-07 | ハイライトトグルボタンをモデル名表示の左端に移動し 🔑 アイコン化 |
| [`5864ac9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5864ac9) | 2026-06-11 | AIチャットのモデル選択肢に @cf/openai/gpt-oss-120b を追加 |
| [`90a3da4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/90a3da4) | 2026-06-11 | AIチャットのモデル選択肢から @cf/openai/gpt-oss-120b を削除 |
| [`5de496c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5de496c) | 2026-06-22 | トークン使用量モーダルにCloudflare Workers AIモデル単価テーブルを追加 |
| [`39abdb3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/39abdb3) | 2026-06-27 | feat: DEFAULT_AICHAT_MODELSを一元化しモーダルと/apisページに反映 |
| [`a358c86`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a358c86) | 2026-06-27 | AIチャットのモデル選択肢に granite-4.0-h-micro を追加 |
| [`48fc6ca`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/48fc6ca) | 2026-06-27 | AIチャット: モデルリストに GLM-5.2 (@cf/zai-org/glm-5.2) を追加 |
| [`3b70999`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3b70999) | 2026-07-05 | gpt-oss-20b enabled |
| [`53cf1d7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/53cf1d7) | 2026-07-05 | nemotron-3-120b-a12b enabled |
| [`30f1c35`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/30f1c35) | 2026-07-08 | AIチャットのモデル一覧からgpt-oss-20bを撤去し、世界遺産以外の例外データの扱いを明確化 |

---

## 9. 複数モデル比較（スワイプ・再問い合わせ）

**対象**: 詳細プレビューモーダルの「同一質問への複数モデル回答」スワイプ切替、「別のモデルに質問する」再問い合わせフロー。

**背景**: 同じ質問文（`question_hash` 一致）を複数モデルへ問い合わせていた場合、詳細プレビューモーダル上でタッチスワイプ・矢印キー・モデルドットのクリックで回答を切り替えられるようにした。既に回答済みのモデルは水色ハイライトされ、再問い合わせなしでキャッシュを即表示する。

> 「AICHAT_SWIPE」という名称の既存ファイル（[`SPEC.cloudflare-workers-github-oauth-1.AICHAT_SWIPE.md`](./SPEC.cloudflare-workers-github-oauth-1.AICHAT_SWIPE.md)）は本機能ではなく「過去ログのスワイプ削除」を指す別機能なので混同しないこと。

| コミット | 日付 | 件名 |
|---|---|---|
| [`3532842`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3532842) | 2026-06-06 | 詳細プレビューから別モデルへ再問い合わせできる機能を追加 |
| [`b43e469`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b43e469) | 2026-06-06 | 応答表示を一本化: appendAiResponseRow / renderAiResultInModal を導入し再問い合わせ結果にも３ボタンを表示 |
| [`5d9c761`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5d9c761) | 2026-06-06 | AIチャット詳細プレビュー: 同一質問への複数モデル応答をスワイプで切り替え |
| [`70e9bad`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/70e9bad) | 2026-06-07 | ナビバーの色ポッチタップでモデル選択ドロップダウンを表示する機能を追加 |
| [`1e4c003`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1e4c003) | 2026-06-07 | 別のモデルに質問するモーダル: 回答済みモデルを薄い水色でハイライト表示しキャッシュ優先表示 |
| [`09cf955`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/09cf955) | 2026-06-07 | スワイプ・ハイライトボタンのバグ修正 |
| [`97e785c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/97e785c) | 2026-06-10 | 別モデル再質問の応答バブルをトップページ検索と共通化 |

---

## 10. z-index動的管理（`getNextZ()`）

**対象**: モーダル・オーバーレイの重なり順を制御する `getNextZ()` 関数（CLAUDE.mdルール26で恒久ルール化）。

**背景**: モーダルが増えるたびに固定z-index値の競合で「裏に隠れる」バグが頻発したため、DOM上の `[data-overlay]` 要素をスキャンして現在の最大値+100を返す動的算出方式へ統一した。

| コミット | 日付 | 件名 |
|---|---|---|
| [`948a5fc`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/948a5fc) | 2026-06-04 | モデル絞り込みモーダルをz-index最前面化し詳細プレビューのモデル名からも開けるように変更 |
| [`a23dd8e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a23dd8e) | 2026-06-06 | z-index を動的管理: getNextZ() を導入し全モーダルの重なり順を保証 |
| [`f906be1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f906be1) | 2026-06-06 | getNextZ: TypeScript 型注釈を除去（ブラウザ構文エラーの修正） |
| [`1d23c95`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1d23c95) | 2026-06-06 | getNextZ: style属性テキストマッチングをdata-overlay属性に変更 |

---

## 11. 日次統計モーダル

**対象**: カレンダー欄「📈」ボタンで開く「日ごとキーワード数・質問数」グラフモーダル。

**背景**: 日別の投稿数・キーワード数の推移を折れ線・棒グラフで可視化し、モデル別トークン使用量、分類カテゴリ別・大分類グループ別の内訳も追加した。

| コミット | 日付 | 件名 |
|---|---|---|
| [`dde02ec`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dde02ec) | 2026-06-08 | AIチャット: カレンダー欄📈ボタンで日次KW数・質問数グラフモーダルを追加 |
| [`c07ee6d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c07ee6d) | 2026-06-07 | モデル別トークン使用量の記録・集計・グラフ表示 |
| [`a456890`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a456890) | 2026-06-08 | 日次統計モーダル: 棒グラフ左側に総数リスト・パイチャート・比率リストを追加 |
| [`fe5afe2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fe5afe2) | 2026-06-08 | 日次統計モーダル: KW折れ線を日ごと集計から累計に変更 |
| [`a328d02`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a328d02) | 2026-06-08 | 日次統計モーダル: deepseek-r1 をデータ取り込み時に全除外 |
| [`8fc15e9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8fc15e9) | 2026-06-10 | 日次統計モーダル: 左パネル最下段にキーワード分類状況（総数・円グラフ・カテゴリ別棒グラフ）を追加 |
| [`83e47e8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/83e47e8) | 2026-06-10 | 日次統計グラフ: y軸目盛り数字（キーワード総数・質問総数）の文字サイズを倍に拡大 |
| [`8650a8c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8650a8c) | 2026-06-27 | 日ごと統計モーダルにAPI経由モデル別円グラフを追加 |
| [`e959c4e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e959c4e) | 2026-06-27 | 日次統計モーダルに大分類グループ別棒グラフを追加 |
| [`9f15172`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9f15172) | 2026-06-27 | AIチャット: カテゴリ変更後に日次統計チャートを自動更新 |
| [`a1c6429`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a1c6429) | 2026-08-02 | AIチャット日次統計モーダルの大分類別キーワード数チャートをカテゴリごとに配色 |

---

## 12. キーワード分類システム（大分類・中分類・配色）

**対象**: 「🔑分類」ナビバーボタン、キーワード分類一覧モーダル、「分類: ◯」個別分類モーダル、大分類グループ機能、`aichat_keyword_categories` / `aichat_keyword_category_map` / `aichat_category_groups` テーブル群。

**背景**: 検索キーワードを「中分類カテゴリ」にまとめ、さらに「大分類グループ」で束ねる2階層の分類体系を構築した。カテゴリには識別色を割り当て、キーワードバッジ・日次統計グラフ・`/answer-graph` のノード色にまで一貫して反映される。

**主な変遷**:
- 2026-06-07: 分類機能そのものを新規実装（ナビバーボタン・一覧・分類モーダル）
- 2026-06-08〜09: バッジのスタイル統一、大分類グループの導入（一括選択・登録・削除）
- 2026-06-10: 複数カテゴリ紐付け時のJOINファンアウト・分類決定ボタンのバグ修正、インクリメンタルサーチ追加
- 2026-06-12〜13: キーワードチップ（分類済み/未分類の色分けバッジ）の導入
- 2026-08-02: 分類カテゴリの識別色を「🎨」から選んだ瞬間に単独PATCHで即時保存する方式へ作り直し（詳細は本ファイルとは別に、直近のセッション内で複数回のバグ修正を経て確定。カテゴリ色は`aichat_keyword_categories.color`で一元管理され、`/answer-graph`のキーワードノード色もこの列を直接参照する）

| コミット | 日付 | 件名 |
|---|---|---|
| [`87544c8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/87544c8) | 2026-06-07 | キーワード分類機能: ナビバーボタン・一覧モーダル・分類モーダルを追加 |
| [`f6da82f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f6da82f) | 2026-06-07 | キーワード分類モーダル拡張: カテゴリサマリー上段・20色選択・分類後再描画 |
| [`449082c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/449082c) | 2026-06-07 | キーワード分類モーダル: カテゴリバッジタップでキーワードバッジをカテゴリ色で塗り替え |
| [`1fb4eb8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1fb4eb8) | 2026-06-07 | キーワード分類モーダル: カテゴリバッジを初期中抜き・独立 ON/OFF トグルに変更 |
| [`b3758b2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b3758b2) | 2026-06-07 | キーワード分類モーダル: Promise.allSettled による堅牢化とフォールバック追加 |
| [`d52b037`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d52b037) | 2026-06-08 | キーワード分類: 選択カテゴリ色でキーワードバッジをハイライト |
| [`2eea742`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2eea742) | 2026-06-08 | キーワード分類: 🎨ボタンで配色カスタマイズモーダルを追加 |
| [`59a4b0b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/59a4b0b) | 2026-06-08 | キーワード分類: 複数カテゴリ選択時に大分類グループ登録モーダルを追加 |
| [`2106acc`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2106acc) | 2026-06-08 | キーワード分類モーダル: カテゴリ選択→キーワードハイライト機能の修正・縦余白削減 |
| [`4ca09cb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4ca09cb) | 2026-06-08 | キーワード分類モーダル: バッジスタイルを既存 UI と統一 |
| [`65d58db`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/65d58db) | 2026-06-08 | キーワード分類モーダル: バッジ上下 padding を 1px 削減（0 6px に変更） |
| [`fe1ff6c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fe1ff6c) | 2026-06-08 | キーワード分類モーダル: 分類済みバッジ中抜き・余白統一・白枠残り修正 |
| [`523e2c8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/523e2c8) | 2026-06-08 | キーワード分類モーダル: バッジのサイズ・形をサブクエリ一覧バッジに統一 |
| [`c840d3f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c840d3f) | 2026-06-09 | キーワード分類: 大分類バッジトグル + 未選択カテゴリの大分類追加機能 |
| [`843eeb0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/843eeb0) | 2026-06-09 | キーワード分類: 大分類バッジタップで配下カテゴリを一括選択 |
| [`03f961c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/03f961c) | 2026-06-09 | キーワード分類モーダル: 大分類カテゴリのキーワード件数サマリー行を追加 |
| [`5e38984`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5e38984) | 2026-06-09 | キーワード分類: 大分類カテゴリ新規登録後に「大分類 :」行を再描画 |
| [`eba8514`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eba8514) | 2026-06-09 | キーワード分類: 大分類から分類カテゴリを削除する機能を追加 |
| [`17c5e22`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/17c5e22) | 2026-06-09 | キーワード分類: 分類決定後の選択カテゴリ状態を維持するよう修正 |
| [`6b754d2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6b754d2) | 2026-06-10 | 分類モーダル: 分類決定ボタンがテキスト入力の新カテゴリ名を無視する問題を修正 |
| [`e7c7fb9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e7c7fb9) | 2026-06-10 | キーワード分類: 複数カテゴリ紐付け時のJOINファンアウトとハイライト欠落を修正 |
| [`9488a80`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9488a80) | 2026-06-10 | キーワード分類モーダル: タイトル右側に検索窓を追加してインクリメンタルサーチを実装 |
| [`168e8f5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/168e8f5) | 2026-06-12 | キーワードチップ: バッジを「keyword (総出現回数)」形式に変更し、タップでハイライト＆スクロール対応 |
| [`3213ede`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3213ede) | 2026-06-12 | キーワードチップ: モーダル開時に常に表示・分類済/未分類で色分け・gap 1px |
| [`b042fca`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b042fca) | 2026-06-12 | キーワードチップパネル: バッジタップ後も自動で閉じないよう修正（🔑ボタンON時のみ閉じる） |
| [`923f89b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/923f89b) | 2026-06-13 | キーワードチップ配色: CSSクラスに切替・--kw-pal-act変数追加・選択状態のアクティブ表示 |
| [`cc39bba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cc39bba) | 2026-07-02 | AIチャット詳細プレビューに📝キーワード分類モードボタンを追加 |
| [`04171db`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/04171db) | 2026-08-02 | キーワード分類モーダルのキーワードボタンをカテゴリ固有の色で表示するよう修正 |
| [`a1d054d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a1d054d) | 2026-08-02 | 分類決定モーダルで既存カテゴリの識別色を変更してもDBに反映されないバグを修正 |
| [`1aaadcd`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1aaadcd) | 2026-08-02 | 色変更PATCHの失敗をcatchで握りつぶさずモーダルに表示するよう修正 |
| [`7d5d9ce`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7d5d9ce) | 2026-08-02 | 分類カテゴリの色変更を「分類決定」ボタン非依存の即時保存方式に作り直す |
| [`b3617fa`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b3617fa) | 2026-08-02 | 分類決定後に色変更が反映されることをDOM統合テストで検証 |
| [`8b3df05`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8b3df05) | 2026-07-31 | AIチャットに大分類・中分類のZanzibar形式分類ツリー(ZT)モーダルを追加 |

---

## 13. bge-m3埋め込みキャッシュ・AI推薦・Zanzibarツリー

**対象**: Zanzibarツリー（ZT）モーダル内の「bge-m3問い合わせ」プレビューモーダル、「埋め込みキャッシュ」モーダル（📖アイコン、🔍ベクタ分析）、`aichat_keyword_embeddings` / `aichat_keyword_category_suggestions` テーブル。

**背景**: Cloudflare Workers AI の `@cf/baai/bge-m3` テキスト埋め込みモデルを使い、キーワードのベクトル表現をキャッシュして「似ているキーワード」検索・分類のAI推薦に活用する仕組みを構築した。短い単語のベクトルは類似度が高く出やすい（anisotropy）問題があり、類似度閾値をユーザー調整可能なスライダー（Cookie記憶付き、1%刻み）にする対応を行った。

**現在の仕様**: 類似度閾値のUIデフォルトは75%（サーバー側フォールバックは0.85を安全域として維持、両者は意図的に独立）。AI推薦は既存の確定分類を自動上書きしない「参考情報」として表示する。

| コミット | 日付 | 件名 |
|---|---|---|
| [`7f1fa40`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7f1fa40) | 2026-08-01 | ZanzibarツリーにbGE-m3問い合わせデータのプレビューモーダルを追加 |
| [`e7063ef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e7063ef) | 2026-08-01 | bge-m3によるキーワード分類のAI推薦を実装し分類モーダルに表示 |
| [`5269399`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5269399) | 2026-08-01 | bge-m3問い合わせモーダルに登録ボタン、ZTツリー検索窓に埋め込みキャッシュ表示を追加 |
| [`4e515db`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4e515db) | 2026-08-01 | 埋め込みキャッシュモーダルに🔍ベクタ分析ボタンを追加 |
| [`30e8f9a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/30e8f9a) | 2026-08-01 | 埋め込みキャッシュの🔍分析に、似たキーワードの中分類別列挙とメタデータハイライトを追加 |
| [`01e9e3b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/01e9e3b) | 2026-08-01 | 埋め込みキャッシュの類似検索APIが例外を握りつぶし赤文字エラーになるバグを修正 |
| [`c9f85f1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c9f85f1) | 2026-08-01 | 似ているキーワード一覧の誤解を招く表現を修正し類似度閾値を引き上げ |
| [`124014b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/124014b) | 2026-08-01 | 類似度閾値をスライダーで0.1刻み調整できるようにし初期値を0.85→0.85維持で確定 |
| [`dd3952b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dd3952b) | 2026-08-01 | 埋め込みキャッシュモーダルのスライダーをCookie記憶付き1%刻み・初期値75%に変更 |

---

## 14. `/answer-graph`（回答伝播グラフ）新規ページ

**対象**: `/answer-graph` ページ全体（`src/views/answerGraph.ts`）、`buildAnswerPropagationGraph`（BFS構築）、`enrichGraphWithCategoryColors`（ノード色付け）、`aichat_answer_category_scores` テーブル。

**背景**: 起点となる回答から、含まれるキーワードを手がかりにBFSで関連する回答へ広がっていく様子をキャンバス上に可視化する新ページ。当初は色分けなしのシンプルな可視化から始まり、キーワード分類カテゴリとの類似度に基づく色分け（旅行寄り/コーディング寄り等）、ノードクリック時のツールチップ表示、AIチャット詳細プレビューモーダルの主要機能を移植した回答モーダルへと拡張した。

**主な技術的つまずきと解決**:
- 色分け処理が「Too many API requests by single Worker invocation」で失敗 → キーワード埋め込み取得・DB読み書きをすべてバッチ化して解消
- centroid計算が例外を投げると色分け全体が巻き添えで失敗 → キーワードノードの色付けと回答ノードの色付けを別々のtry/catchに分離
- エラー内容がサーバーログにしか残らず利用者から見えない → APIレスポンスに `_colorWarning` として実エラーメッセージを含め画面表示

**関連する共有コンポーネント**: `src/utils/markdownRenderer.ts`（Markdownパーサー、13章参照とは別に14章末で統合済み）。

| コミット | 日付 | 件名 |
|---|---|---|
| [`9cbd89e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9cbd89e) | 2026-08-01 | 新ページ /answer-graph を追加: 回答伝播グラフのBFS構築とキャンバス可視化 |
| [`598958a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/598958a) | 2026-08-01 | answer-graphページの凡例をグラフ横ではなく見出し直下に横幅いっぱいで表示 |
| [`1ae47f7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1ae47f7) | 2026-08-01 | answer-graphページのノード詳細パネルをグラフ真横ではなく真上に配置 |
| [`dffe0a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dffe0a2) | 2026-08-02 | /answer-graph のノードをカテゴリ類似度のブレンド色で色分け(旅行寄り/コーディング寄り等) |
| [`5fb279b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5fb279b) | 2026-08-02 | answer-graphの色分けがまだ機能しない件の2つ目の原因を修正し失敗理由を画面に表示 |
| [`7d3b5c5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7d3b5c5) | 2026-08-02 | answer-graphページ: ノードクリック時にツールチップ表示、質問行から回答モーダルを追加 |
| [`55193bc`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/55193bc) | 2026-08-02 | answer-graphページ: ツールチップの質問文からも回答モーダルを開けるように統一し、本文をマークダウン描画に変更 |
| [`1ad5a2b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1ad5a2b) | 2026-08-02 | aichat.ts/answerGraph.tsのMarkdownパーサー複製を既存の共有ユーティリティへ統合 |
| [`fe85dd6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fe85dd6) | 2026-08-02 | answer-graphページの回答モーダルをAIチャット履歴モーダルと同じ見た目に揃える |
| [`7c2f9c5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7c2f9c5) | 2026-08-02 | answer-graphの回答モーダルにAIチャット詳細プレビューモーダルの機能を移植 |

**注意**: `/answer-graph` は `/welcome` のナビドロップダウンには意図的に追加していない（CLAUDE.mdルール30、ユーザーの明示的な指示がない限り導線を勝手に追加しない方針）。

---

## 15. その他のUI改善・不具合修正

**対象**: 上記いずれのテーマにも明確に属さない単発の改善・修正。

| コミット | 日付 | 件名 |
|---|---|---|
| [`5063195`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5063195) | 2026-05-31 | 全ページのドロップダウンメニューに「関数辞典」リンクを追加 |
| [`1e3e739`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1e3e739) | 2026-06-02 | feat: add AI chat history preview mode |
| [`9c5402c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9c5402c) | 2026-06-02 | feat: 検索選択時の検索結果数を result_count として記録 |
| [`e39925d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e39925d) | 2026-06-02 | feat: 検索キーワードハイライト表示と選択ログDB記録を追加 |
| [`4afe646`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4afe646) | 2026-06-02 | AIチャット過去ログのスワイプ削除機能を追加（詳細: [`SPEC.cloudflare-workers-github-oauth-1.AICHAT_SWIPE.md`](./SPEC.cloudflare-workers-github-oauth-1.AICHAT_SWIPE.md)） |
| [`3816634`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3816634) | 2026-06-03 | AIチャット：新着/キーワードトグル修正・キーワードモーダル外タップ閉じ対応 |
| [`898cef6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/898cef6) | 2026-06-03 | AIチャット：キーワードモーダルにソートトグル・件数表示を追加、キーワード選択時の動作を検索窓自動補完に変更 |
| [`f652bfe`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f652bfe) | 2026-06-04 | AIチャット入力窓のEnterキーを改行に変更（送信はCtrl+EnterまたはShift+Enter） |
| [`2bdc01c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2bdc01c) | 2026-06-04 | AIチャット応答をD1に自動保存し履歴から復元可能にする |
| [`8d12a4d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8d12a4d) | 2026-06-07 | 履歴モーダルにトークン数（input/output）を表示する機能を追加 |
| [`a0d91ef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a0d91ef) | 2026-06-07 | ナビバー表示制御: langMode・モデル名を既定で非表示にし設定ページで切替可能に |
| [`ae798c2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ae798c2) | 2026-06-07 | 🔑 ボタン常時表示: キーワードなし状態でも opacity で可視化 |
| [`c84dbce`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c84dbce) | 2026-06-07 | 🔑ボタンで全キーワードがハイライトされない問題を修正 |
| [`70c3ffd`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/70c3ffd) | 2026-06-09 | 回答バブル: 回答内容をクリップボードにコピーするボタンを追加 |
| [`4fde8dd`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4fde8dd) | 2026-06-09 | 回答バブル コピーボタン: ホバー表示から左下常時表示に変更 |
| [`9c5d7d9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9c5d7d9) | 2026-06-09 | キーワード履歴モーダル: 検索モデルカラムを追加 |
| [`0ad3fdf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0ad3fdf) | 2026-06-10 | AIチャット詳細モーダル: 🔑押下時に全キーワードがハイライトされない問題を修正 |
| [`18c1135`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/18c1135) | 2026-06-22 | ai_chat_sharesにsourceカラムを追加し/aichat UIからの質問をtextboxとして記録 |
| [`f1f1206`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f1f1206) | 2026-07-26 | AIチャットの投稿フォームに写真添付「＋」ボタンを追加 |
| [`ee6a602`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ee6a602) | 2026-07-28 | tsc --noEmitのコンパイルエラー178件を解消 |
| [`a8bd352`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a8bd352) | 2026-07-31 | AIチャットのサイドパネル検索結果をキャンバス表示するモーダルを追加 |

---

## 更新履歴・付記

- 本ファイルは2026-08-02時点の最新コミットまでを対象に、GitHub API (`list_commits`, path=`src/views/aichat.ts` / `src/views/answerGraph.ts`, since=2026-05-01) から取得した185件のユニークなコミットをテーマ分類して作成した。
- コミットメッセージのキーワードマッチによる自動分類のため、一部のコミットは複数テーマにまたがる内容でも代表的なテーマ1つにのみ分類されている（例: 「サブクエリ一覧のキーワードバッジ」関連は7章ではなく12章に分類）。
- 本ファイルの対象範囲は `src/views/aichat.ts` と `src/views/answerGraph.ts` に変更のあったコミットに限る。`src/index.ts` 側のみでAPI追加・修正が行われ、上記2ファイルに変更がないコミットは本表に含まれていない。
