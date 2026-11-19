# SPEC: tree-view の Museタブの会話の検索(専用ページと、AIチャット・左サイドバーからの呼び出しの構想、2026-11-19)

## 1. 専用ページと読み出しルート(実装済み・本体の PR に含む)

**対象**: `GET /muse-search`(ページ)、`GET /api/muse-search?q=`(画面用の API)、`src/utils/museConversationSearch.ts`、dynamicneko の `GET /api/tree-view/muse-search` — dynamicneko の D1 にある Museタブの全会話(質問と回答)を、本体の管理者が検索できるようにする。

### 背景

- Museタブの会話は dynamicneko の D1(`tree_view_muse_posts` ほか)にあり、本体の D1 にはない。本体からは直接読めない。
- dynamicneko の既存の検索(`GET /api/tree-view/muse-threads`)は、スレッド化した投稿の根だけが対象で、全会話ではない。

### 読み出しのルート

| 段 | 内容 |
|---|---|
| ブラウザ → 本体 | `GET /muse-search`(ページ)。ページの script が同じオリジンの `GET /api/muse-search?q=` を呼ぶ。どちらも `authMiddleware` + `cfDashboardAdminMiddleware`(管理者のみ。`/muse-status` と同じ) |
| 本体の中 | `parseMuseSearchQuery`(前後の空白を除く。空と501文字以上は上流へ送らず 400)。`searchMuseConversations` が上流を呼ぶ。`toMuseSearchResultItems` が一致箇所の前後(snippet)だけにして返す(本文の全文は返さない) |
| 本体 → dynamicneko | サービスバインディング `DYNAMICNEKO` で `GET https://dynamicneko.internal/api/tree-view/muse-search?q=`。`CF-Worker` + `CF-Worker-Timestamp` + `CF-Worker-Signature`(HMAC-SHA256、本体のルール38)。署名のパスにはクエリを含む。シークレットは `DYNAMICNEKO_WORKER_HMAC_SECRET`(`/repo-onboarding-check` の⑤と同じ。新しい環境変数・シークレットは足さない) |
| dynamicneko の中 | 署名を検証してから D1 を読む。オーナー(`nekoserver`)の投稿だけを、`tree_view_muse_posts` 全体から部分一致・大文字小文字なしで探す。最大100件、新しい順 |

### 失敗の見え方

| 状況 | 本体の応答 | 画面 |
|---|---|---|
| 検索文が空・501文字以上 | 400(`errorCode`: `empty`・`too_long`) | 入力を促す |
| バインディング・シークレットが未設定 | 503(`binding_missing`・`secret_missing`、`detail` に理由) | 理由を表示 |
| 上流が 401 などを返した | 502(`http_error`、`detail` にステータスと本文の一部) | 理由を表示 |
| 上流の形式が違う | 502(`invalid_response`) | 理由を表示 |
| 一致が無い | 200(`count: 0`) | 「見つかりませんでした」(失敗とは別の表示) |

失敗を空の結果に見せない。

### dynamicneko 側の前提(判断が要る点)

dynamicneko は全ルートの前に、オーナーのセッションを要求する門番を置いている。署名付きの呼び出しも、セッションが無ければ 401 になる(README・コードで確認)。そのため、検索 API の1本だけ(GET・パス完全一致)を門番の例外にした。ハンドラが署名を必ず検証する。前例は Muse の Codex 連携の2本。dynamicneko の PR は [nekoserver/dynamicneko#457](https://github.com/nekoserver/dynamicneko/pull/457)。**これを先にマージ・デプロイしないと、本体の検索は 502(上流が 401)になる。**

## 2. 構想: 検索の呼び出し元を増やす

**対象**: AIチャットの入力欄(`/neko` のスラッシュコマンド、`src/utils/aichatSlashCommand.ts`)と、AIチャットの左サイドバーの検索窓(`#sidebarSearch`、`src/views/aichat.ts`) — 専用ページへ行かずに、今いる画面から Museタブの会話を探せるようにする。**構想の段階で、まだ作っていない。**

### 現状(コードで確認したこと)

- AIチャットの入力欄には、過去ログを探すコマンドがある。`/neko qsearch <キーワード>`(質問・回答の過去ログ。表で返し、行の質問IDのリンクから最上位モーダルで最新の回答を読む)、`/neko csearch <キーワード>`(Cursor VM の履歴)。
- 左サイドバーの検索窓は `#sidebarSearch`。検索対象の切り替えボタン(`#sidebarSearchTargetBtn`)が、`moondream3.1` → `kimi-gemma` → `llama-4` の順に切り替わり、`GET /api/aichat/shares/search?q=&target=` を呼んで `#sidebarResults` に並べる。
- どちらも、Museタブの会話(dynamicneko の D1)は対象外。

### 案A: AIチャットの入力欄から(`/neko msearch <キーワード>`)

- `/neko qsearch`・`/neko csearch` と同じ形の新しいコマンドを足す。応答は表で、各行に「時刻(JST)・質問か回答か・チャットID・一致箇所の前後」を出し、末尾に専用ページ(`/muse-search?q=`)へのリンクを付ける。
- 作り方: `interpretMsearch`(純粋に近い関数)を `aichatSlashCommand.ts` に足し、上流の呼び出しは依存(`searchMuseConversations`)として `index.ts` から渡す。既存のコマンドと同じ作りなので、テストしやすい。
- 一覧(`/neko help`)と「未対応のサブコマンドです」の案内文にも足す必要がある。
- AGENTS.md「AIチャットの言語モデルスイッチとプレフィックス」に従う。`/neko` は接頭語として、色丸で選んだ言語モデルの影響を受けない扱いにする。着手の前に、そのルールを読み直す。

### 案B: 左サイドバーの検索窓から(検索対象に「Museタブ」を足す)

- 検索対象の切り替えのサイクルに、4つ目として「Museタブ」を足す。選んでいる間は、`#sidebarSearch` の入力で `GET /api/muse-search?q=` を呼び、`#sidebarResults` に一致箇所の前後を並べる。クリックで専用ページを開く。
- 既存の結果の描画は、AIチャットの履歴(質問・回答・モデルの色丸)の形が前提で、Museの投稿(チャットID・質問か回答か)とは形が違う。描画を分ける必要がある。
- `aichat.ts` のスクリプトは大きなテンプレートリテラルの中にある。バックスラッシュ・正規表現の扱いに注意が要る(CLAUDE.mdルール29)。

### 案C: 併用(共通の部品を専用ページから切り出す)

- 専用ページのスクリプト(`MUSE_SEARCH_SCRIPT`)の中の、結果1件を描く関数と時刻の整形を共通部品にして、専用ページ・サイドバー(案B)が使う。案Aは表の文字列を作るので、別に作る。
- 専用ページは「全件を見る先」にする。案A・案Bの結果の末尾から、同じ検索文で開く。

### 比較

| | 案A 入力欄 | 案B サイドバー | 専用ページだけ(今) |
|---|---|---|---|
| 使う場面 | 会話の流れの中で探す | 履歴を見ながら探す | 腰を据えて探す |
| 変更の大きさ | 小(コマンド1つ、既存の形) | 中(描画の分岐、巨大なスクリプトの変更) | なし |
| 主なリスク | 接頭語のルールとの食い違い | 既存の履歴検索の表示を壊す | なし |
| テストのしやすさ | 高い(関数に切り出せる) | 中(jsdom で描画を確かめる) | 高い |

私の推奨は、まず案A、次に案B(専用ページを共通の行き先にする)。決めるのはユーザー。

## 3. 共通の前提と故障想定

**対象**: 専用ページ・案A・案Bのすべてが頼る、dynamicneko の検索 API と、その結果 — どの呼び出し元から使っても同じ前提と故障がある。

| 故障 | 検出・対処 |
|---|---|
| dynamicneko の PR(#457)が未デプロイ | 上流が 401 になり、本体は 502 と理由を返す。どの呼び出し元も、理由を表示する(空の結果にしない) |
| `CF_WORKER_SECRET_MAIN`(dynamicneko)と `DYNAMICNEKO_WORKER_HMAC_SECRET`(本体)の値が違う | 上流が 401。同じく理由を表示する。値は名前しか読めないので、本番で1回通して確かめる |
| 投稿が増えて検索が遅くなる | 今は D1 の全投稿に対する部分一致(`instr`)で、最大100件。件数と所要時間は測っていない。遅ければ、全文検索(FTS)や対象期間の絞り込みを検討する(D1 で FTS5 が使えるかは未確認) |
| 結果の取り違え | 返すのはオーナーの投稿だけ。ログイン名は小文字にそろえて比べる(`nekoserver` と `NekoServer` が混在していた) |
| 会話の漏えい | 管理者だけ。画面・コマンドへは全文を返さず、一致箇所の前後だけにする。検索結果を AI回答の履歴(`ai_chat_shares`)へ保存しない |
| 新しい設定の増加 | 新しい環境変数・シークレット・設定スイッチは足さない(CLAUDE.mdルール37) |

## 4. 決めること

- 案A・案B・案C のどれを、どの順で作るか。
- 案Aのコマンド名(`/neko msearch` でよいか)。コマンドの結果を、AI回答の履歴に残すかどうか(`/neko qsearch` の扱いに合わせる案が自然だが、まだ確かめていない)。
- 案Bの検索対象の名前とアイコン。
- 1回に返す件数(今は最大100件)と、並び順(今は新しい順)。
- 一致の見つけ方。今は部分一致のみ。単語単位・あいまい一致・全文検索が要るか。
- 一致した投稿から、元の会話を開く方法。dynamicneko の tree-view にはチャットIDから会話を開く画面の URL が、まだ見当たらない(未確認)。当面は、チャットIDを文字で見せるだけ。

## 5. 確かめたこと・確かめていないこと

- 確かめた(テスト): 検索文の検査、上流を呼ぶ署名とパス、上流の失敗の各パターン、snippet の切り出し(`İ` など小文字にすると長さが変わる文字を含む)、認可、画面の描画(文字のまま表示し、HTML として解釈しない)、dynamicneko 側の検索と署名の検証。
- 確かめた(目視): `/muse-search` のライトとダークの表示(上流はサンプルの応答に差し替えた)。
- 確かめていない:
  - 本番での疎通(本体 → dynamicneko の署名付き呼び出しが通ること)
  - 実際の投稿数での検索の速さ
  - 案A・案Bの作り(構想のみ)。`/neko qsearch` の履歴への保存の扱い、サイドバーの結果欄の拡張点は、コードを読んだだけで、試していない

## 関連

- dynamicneko の PR: [nekoserver/dynamicneko#457](https://github.com/nekoserver/dynamicneko/pull/457)(検索 API と、門番の例外1本)。知見は dynamicneko の `NOTICE.20261119.tree-view-muse.md`。
- 認証の基準方式: CLAUDE.mdルール38、`SPEC.cloudflare-workers-github-oauth-1.20261008.worker-auth-policy.md`。
- Museへの経路の一覧: `SPEC.cloudflare-workers-github-oauth-1.20261112.muse-request-routes.md`。
