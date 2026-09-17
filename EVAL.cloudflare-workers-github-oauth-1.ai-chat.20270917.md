# AIチャットページ: チャートの変更履歴とスラッシュコマンドの現状

**対象**: `src/views/aichat.ts`(AIチャットページ本体)のチャート機能、および
`src/utils/aichatSlashCommand.ts`の`/neko`スラッシュコマンド群。ルーティングは
`src/index.ts`が`./views/aichat`から`getAiChatPage`をimportして提供している。

## 1. 現在存在するチャート一覧

**対象**: `src/views/aichat.ts`内のクライアント側描画コード、および
`src/utils/aichatSlashCommand.ts`のサーバー側SVG生成。いずれも外部チャートライブラリ
(Chart.js/D3等)は使わず、**手組みのインラインSVGまたは`<canvas>`**で実装されている。

| # | 名称 | 場所 | 内容 |
|---|---|---|---|
| A | `#canvasSearchCanvas` | `aichat.ts` 約1294行/2584-2713行 | 「質問・回答・キーワードのキャンバス表示」モーダル用の`<canvas>`(720x200、DPR対応)。統計チャートではなくテキスト・検索結果のカスタム描画用途 |
| B | 埋め込みモデル別 登録済みキーワード率 | `aichat.ts` 約1323行/5523-6210行、`buildEmbeddingModelRatioSectionHtml()`約6455行 | bge-m3・plamo-embedding-1b・embeddinggemma-300mの各モデルごとに、登録済み/未登録キーワードの比率をSVG円グラフ(ドーナツ/パイ)で表示。表示状態はCookie`aichat_zt_overview_chart_visible`で保持 |
| C | 分類済み/未分類キーワード円グラフ+内訳 | `buildKwClassifyStatsHtml()` 約6365-6435行 | 日次統計モーダル左パネル内。分類済み/未分類の2値円グラフに加え、大分類グループまたは分類カテゴリ別の横棒リスト内訳(色分け付き) |
| D | 日次統計グラフ(メイン) | `renderDailyStatsChart()` 約6482-6773行 | 📈ボタン(`dailyStatsBtn`、カレンダーヘッダー内)から開く。左パネル: モデル別質問総数リスト・モデル比率円グラフ(`deepseek-r1`は`EXCL`フィルタで除外)・API経由モデル別円グラフ・リクエスト元別円グラフ(`SOURCE_COLORS`: `slack:#611f69`/`textbox:#0ea5e9`/`api:#f59e0b`/`dynamicneko:#10b981`)・B/Cのブロック。右パネル: 累積キーワード数の折れ線/エリアチャートと、日別モデル別質問数の積み上げ棒グラフを1つのSVG内で上下結合表示(1日〜月末日、1/10/20/末日にグリッド線とラベル) |
| E | `/neko aireqst`用 自前生成SVG円グラフ | `src/utils/aichatSlashCommand.ts` 約682-720行、`buildAichatSourceTotalsSvg()` | 今月のリクエスト元別(Slack/textbox/API/dynamicneko)比率をチャットバブル内にSVGで返す。D同様の`SOURCE_COLORS`/16進値(`AICHAT_SOURCE_HEX`)を使うが、**サーバー側で固定パレット+件数のみから生成**する専用実装。理由はコード内コメント(約625-631行)にあり、CLAUDE.mdの「外部入力由来テキストのMarkdownエスケープ」ルールを回避せずに済む(固定パレットしか使わないため安全)ことを明記している |

D・Cを裏付けるテストファイル: `src/aichat-daily-stats.test.ts`(ボタン+モーダルHTML)、
`src/aichat-daily-stats-classify.test.ts`(分類円グラフ+カテゴリ集計API呼び出し)、
`src/aichat-daily-stats-group-chart.test.ts`(`category-groups` APIがグループを返した場合の
グループ別棒グラフ)。

## 2. チャートの変更履歴

**対象**: `src/views/aichat.ts`および`src/utils/aichatSlashCommand.ts`のgit履歴。

このブランチで`git log --oneline -- src/views/aichat.ts`を辿ると、日次統計チャート本体の
大半は`2e970d4`(PR #1762由来のマージコミット、「cloudflare-dynamic-worker-migration」)で
一括して入っており、それ以前の個別コミット単位でのチャート導入経緯はこのチェックアウトの
履歴からは追跡できなかった(スカッシュマージ済みのため、元ブランチ側の詳細履歴が必要)。

チャート関連で個別に特定できたコミットは以下の1件のみ:

- **`5ac6104`**「`/neko aireqstを比率降順ソート+自前生成SVG円グラフ対応にする`」(2026-09-12) —
  `src/utils/aichatSlashCommand.ts`に`buildAichatSourceTotalsSvg()`を追加し、
  `AichatSlashCommandResult`/JSONレスポンス/`buildAssistantBubble`/`appendBubble`まで
  `svg`フィールドを配線した。`formatAichatSourceTotals`と新SVGビルダーの両方を比率降順
  ソートに変更(同率の場合はSlack→textbox→api→dynamicnekoの元の順で安定ソート)。
  単一カテゴリのみ(100%)の場合は退化した円弧パスではなく`<circle>`要素を描画。
  全件0件の場合は`svg`フィールド自体を省略しテキストのみにフォールバックする。
  このコミットの差分は日次統計系のテストファイルにも触れているが、これは広範なリファクタ
  コミットの一部としてであり、日次統計チャート自体の起源はこのコミットではない

`git log --oneline --all | grep -i "aichat.*chart\|chart.*aichat\|daily-stats"`で検出できた
コミットメッセージは`5ac6104`とマージコミット`2e970d4`の2件のみで、それ以外に
チャート専用の改修コミットは見つからなかった。**教訓**: PRをスカッシュマージする運用では、
後から「このチャートはいつ・どういう経緯で追加されたか」を調べたくても、マージコミット
単位の粒度でしか追えなくなる。チャートのような視覚的な変更こそ、個々のコミットメッセージに
「何を・なぜ変えたか」を残しておく価値が高い。

## 3. スラッシュコマンドの現状(全件)

**対象**: `src/utils/aichatSlashCommand.ts`の`formatAichatSlashCommandHelp()`
(約149-188行、`/neko help`の出力そのものであり、コマンド一覧として最も信頼できる情報源)。

| コマンド | 説明 |
|---|---|
| `/neko hms` | 現在時刻(JST)表示 |
| `/neko epoch` | 現在のepoch秒表示 |
| `/neko ip` | リクエスト元IPアドレス表示 |
| `/neko cal` | 今月のカレンダーをMarkdown表で表示 |
| `/neko fymd` | 今日以降で最初に素数になる日付(YYYYMMDD)を表示 |
| `/neko clog` | 最新のcommit-agentログを表示 |
| `/neko sessions` | ユーザーのセッションログイン時刻を新しい順に表示 |
| `/neko limit` | Codex/Claude Codeの利用上限確認リンクを表示(ログイン不要・情報表示のみ) |
| `/neko uuidgen4` | UUIDv4を1件生成、生成履歴に保存 |
| `/neko uuidgen7` | UUIDv7を1件生成、生成履歴に保存 |
| `/neko search <keyword>` | 質問/回答本文にキーワードを含む過去ログの件数(モーダルで最大30件閲覧可) |
| `/neko qsearch <keyword>` | 過去AIチャットログ検索。質問+モデルの表、行IDから最上位モーダルで最新回答を(id, model)指定で開く |
| `/neko csearch <keyword>` | Cursor VM過去ログ検索。作成時刻(JST)+「表示」リンクでキャッシュ済み回答をモーダル表示 |
| `/neko s [--enable-logging] <term ...>` | 最大20個の引用符区切り検索語を順次検索。`--enable-logging`で検索キーワード履歴に記録 |
| `/neko vcount` | ベクトル化済み回答テキストの件数・割合(モーダルで最大30件) |
| `/neko tokens` | 過去24時間のモデル別トークン使用量、時間別Markdown表+モデル別合計 |
| `/neko tcheck <nkapi_token>` | APIトークンの有効性チェック |
| `/neko 256 <string>` | WASM(Rust)によるSHA-256ハッシュ |
| `/neko kana <全角カナ>` | 全角カタカナを半角カナに変換 |
| `/neko aireqst` | 今月のリクエスト元別(Slack/textbox/API/dynamicneko)件数+比率。**自前生成SVG円グラフ付き**(`5ac6104`で追加、1節E参照) |
| `/neko factor <n>` | WASM(Rust)による素因数分解(0 ≤ n ≤ 2^53) |
| `/neko factor -a <days>` | WASMによるN日以内の素数日付(YYYYMMDD)一覧 |
| `/neko dig <domain> [type]` | WASM(Rust)によるDNSルックアップ。`/neko dig --help`でオプション表示 |
| `/neko ls [-l] [-a]` | WASMモジュール一覧をGNU coreutilsの`ls`風出力で表示 |
| `/neko gh pr list <owner/repo>` | WASM描画のMarkdown表でオープンPR一覧を表示 |
| `/neko tree <owner/repo> [options]` | リポジトリのツリー表示。`--depth`・`--pattern`・`--files-only`・`--dirs-only`・`--hidden`・`--sort name\|time`・`--reverse`対応(詳細は[`NOTICE.cloudflare-workers-github-oauth-1.tree-wasm.md`](NOTICE.cloudflare-workers-github-oauth-1.tree-wasm.md)参照。実行系統は本物のWASMではなくTypeScriptパリティ実装) |
| `/neko tlist` | `/countdown`ページに登録済みの今後のイベント一覧を表示 |
| `/neko sql impact <table>` | D1クエリカタログからSQLの影響範囲を表示 |
| `/neko mlb` | MLB本日の試合(開始時刻・対戦カード・先発投手)。リーグ/地区フィルタ引数対応(`parseMlbFilterArgs`) |
| `/neko hellodw` | dynamicnekoダイナミックWorkerへの疎通確認(hello→world) |
| `/neko rubyver` | `/ruby-wasm`が使用するRuby/WASMビルド行+パッケージバージョンを表示 |
| `/neko vlink <keyword>` | Google検索「YouTube <keyword>」からyoutube.comリンクのみ抽出 |
| `/neko help` | このコマンド一覧を表示 |

`AichatSlashCommandDeps`の全フィールドはこの一覧のいずれかのコマンドに対応しており、
一覧に載っていない内部専用・未完成のフックは見つからなかった。

### 最近追加された機能(新しい順)

`git log --oneline -- src/utils/aichatSlashCommand.ts`より:

1. `/neko tree`・`/neko gh pr list`(`da9c81f`・`51236a1`・`04babd0`・`fb81246`)
2. `/neko qsearch`(`a0eaf9a`・`a214f33`・`9dca313`・`2d6aa48`・`50c40a4` —
   `50c40a4`/`2d6aa48`の時点では「qseqrch」という誤字だったものを後で修正している)
3. `/neko csearch`(`bd0d7cf`・`92f4dc5`・`d944bf8`・`be77572`)
4. `/neko vlink`(`d7d2b63`)
5. `/neko aireqst`のSVGグラフ対応(`5ac6104`、1節E・2節参照)

コード・コメント上でdeprecated/experimentalと明記されたコマンドは無い。日次統計チャート側の
`deepseek-r1`除外(`EXCL`フィルタ、`aichat.ts`)はチャート表示上のフィルタであり、
スラッシュコマンドの非推奨化とは無関係。

## 4. その他の現状機能(参考・簡易記載)

**対象**: 本ドキュメントの主題(チャート・スラッシュコマンド)を補足する周辺機能の棚卸し。
詳細な裏取りは行っておらず、参考情報として記載する。

- **モデル選択**: `DEFAULT_AICHAT_MODELS`(`aichat.ts`からexport)、モデル別色は
  `aichatModelConfig.ts`(`assignModelColors`・`AICHAT_MODEL_MAX_TOKENS`・
  `getModelRunParams`)、モデルスワイプUI・モデルドットのドロップダウン
  (テスト名: `aichat-model-swipe.test.ts`・`aichat-model-dot-dropdown.test.ts`)
- **画像添付**: `src/utils/aichatImage.ts` — data URL検証、直近ユーザーメッセージへの添付、
  Moondream3(moondream3.1-9B-A2B)による画像解析(`aichat_moondream_analyses`テーブル)、
  内容ハッシュによる重複排除(`aichat_images`テーブル)
- **キーワード分類システム**: カテゴリ・カテゴリグループ・埋め込み(bge-m3/
  plamo-embedding-1b/embeddinggemma-300m、`aichat_keyword_embeddings`でキャッシュ)、
  AIによる分類提案(`aichat_keyword_category_suggestions`)、監査ログ
  (`aichat_category_audit_log`)
- **回答伝播グラフ**(`/answer-graph`、`aichat.ts`本体とは別ページだがデータ連携あり):
  `aichat_answer_category_scores`・`aichat_answer_vectors`(モーダルボタンから生成する
  plamo埋め込み)
- **qsearch/csearch/searchの「最上位モーダル」パターン**: 検索結果をチャット本文へ直接
  流し込まず、最大30件までモーダルに表示してチャット履歴を短く保つ設計方針
- **レート制限**: `aichat_rate_limit`テーブル(migration 0055)、
  `aichat-rate-limit.test.ts`で検証
- **共有機能**: `src/views/aichat-share.ts`(`getAiChatSharePage`/
  `getAiChatShareNotFoundPage`)による共有回答の固定リンクページ、
  `aichat-shares-token-display.test.ts`
- **画像ギャラリー**: `src/views/aichatImageGallery.ts` — 添付画像専用のギャラリーページ
- **dynamicneko連携**: `/neko hellodw`が別のダイナミックCloudflare Workerへ疎通確認、
  `dynamicneko_aichat_allowed_users`テーブルでdynamicneko側のAI問い合わせウィジェット
  利用者を制限
- **APIエンドポイント自動集計**: CLAUDE.mdルール28の通り、新規`/api/*`配下ルートは
  追加配線不要で`api_endpoint_stats`に自動集計される

## 5. 今後の課題

**対象**: 本調査で判明した、今後追加調査・改善が望ましい点。

1. `src/views/aichat.ts`のチャート導入経緯は、スカッシュマージ済みのPR #1762より前の
   詳細な個別コミット履歴を、このリポジトリのローカルチェックアウトからは追跡できなかった。
   必要であれば元ブランチのgit履歴、またはPR #1762自体のコミット一覧を別途参照する必要がある
2. `#canvasSearchCanvas`(1節A)の描画内容(`getContext('2d')`で具体的に何を描画しているか)は
   今回未調査。統計チャートではなく検索結果のカスタム描画と推測されるが、詳細化する場合は
   別途コードを追う必要がある
