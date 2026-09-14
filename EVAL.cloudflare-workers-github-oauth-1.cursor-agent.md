# EVAL.cloudflare-workers-github-oauth-1.cursor-agent.md

**対象**: `/cursor-agent` と Cursor Background Agent（VM）まわりの実装 —
[`SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md`](SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md)
が定める「いまできること / 今日以降にやること」に対し、コミットログ（2026-09-13〜2026-09-14）から
いつ何をやって何を得たかを時系列で評価する。実装そのものはこの文書では行わない。

評価時点: 2026-09-14（`204ebac` まで）。日時は各コミットの author date。

---

## 1. 総評と達成度

**対象**: SPEC 節0の3区分に対する現段階の到達。

| SPEC の区分 | 達成 | 得たもの | 残る穴 |
|---|---|---|---|
| `/cursor-agent` から Cursor API 問い合わせ | 達成 | 許可リポジトリへ VM 起動。D1 に問答が残る | 許可 repo は1件。ナビ導線なし |
| 応答チャンク処理 | 達成 | assistant 断片を1本の回答文にできる | 会話 JSON の型変化には弱い |
| キャッシュ保存 | 達成（条件付き） | 成功終端だけ保存し、再表示で API を省略できる | 0139 未適用だと本文検索はフォールバック |
| 応答検索 | 達成 | 入力途中でも本文＋画面列で絞れる | 全文索引なし。件数増で INSTR が重い |
| 過去応答検索 | 達成 | キーワード×ヒット起動が D1 に残る | 0140 未適用だと `persistError` |
| AIチャット入力窓からの同一操作 | 部分達成 | `/neko csearch` で質問文表＋キャッシュ全文モーダル | 起動と 0140 保存は未着手。`/neko search` は `ai_chat_shares` のまま |
| ダイナミックワーカーからの同一操作 | 未着手 | なし | `-external` API が無い |

総合: **本体ページ経路のコアは一通り動く（SPEC 実装済み欄は充足）。入口3つのうち1つだけ完了。全体到達はおおよそ 1/3。**
2026-09-13 に起動と状態表示、2026-09-14 に回答本文・キャッシュ・検索・過去ログと文書化、という2日の積み上げである。

[`EVAL.cloudflare-workers-github-oauth-1.20260914.md`](EVAL.cloudflare-workers-github-oauth-1.20260914.md)
は同日午前の CI 警告用で、(1) 途中回答の永久キャッシュは後続で成功終端条件を入れ、(2) インクリメンタル撤去方針は後で撤回して 300ms デバウンス付きで戻した。
**あの EVAL の「着手順」は現行では半分古い。** 本評価を以降の正とする。

---

## 2. 時系列コミットログ（いつ・何をやって・何を得た）

**対象**: cursor-agent 実装と、その仕様を固定した SPEC コミット。
マージだけの行と、無関係テスト修復で SPEC ファイルが触れた行は除く。

| 日時 | コミット | やったこと | 実現したこと（得たもの） |
|---|---|---|---|
| 2026-09-13 08:52 | [`75a299d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/75a299d) | `/cursor-agent` と `POST /api/cursor-agent/launch` を追加。`cursor_agent_launch_log`（0137）へ起動を記録 | 本体 Worker から Cursor VM を起動できる入口を得た |
| 2026-09-13 09:28 | [`62fee07`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/62fee07) | 起動成功後の D1 失敗を 500 にしない | Agent は生きているのに失敗画面になる事故を避け、`historySaved: false` で気づけるようになった |
| 2026-09-13 09:36 | [`c2dedd4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c2dedd4) | 起動結果を生 JSON 垂れ流しから要点表示へ | 画面で agent 名 / 状態 / レポートを読めるようになった |
| 2026-09-13 09:37 | [`5978e2c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5978e2c) | 履歴日時を UTC のまま出さず JST 明記 | 「何時の起動か」を誤解せず読めるようになった |
| 2026-09-13 10:40 | [`5943afb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5943afb) | 履歴の削除ボタンとクライアント側検索窓 | 一覧の掃除と、当面の画面内絞り込みができるようになった |
| 2026-09-13 11:09 | [`e1391d2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e1391d2) | 「最新状態を取得」で Cursor API を再問い合わせし、結果を返す | 起動直後の RUNNING を後から完了状態へ更新できるようになった |
| 2026-09-13 12:01 | [`c1c7931`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c1c7931) | `agent_id` をトップレベル `id` ではなく `agent.id` から取る | 常に null だった Agent ID が残り、以降の状態取得・会話取得が可能になった |
| 2026-09-13 16:49 | [`4d0d5e2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4d0d5e2) | 応答 JSON からレポート本文を抽出して表示 | 一覧で「何が返ったか」の要約を読めるようになった |
| 2026-09-13 17:25 | [`c6d0e28`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c6d0e28) | launch_log / status_log に分離（0138）。状態は追記型 | 上書きで履歴が消えない連鎖（起動→refresh の時系列）を得た |
| 2026-09-13 17:52 | [`3995e05`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3995e05) | Agent ID を外部リンクではなくアプリ内モーダル＋状態バッジへ | Cursor アプリへ逃げずに状態を見られるようになった |
| 2026-09-13 18:15 | [`2e68f5f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2e68f5f) | タイムラインに生データを出し、空記録を積まない | 解析失敗を「未取得」行として残さず、原因を追えるようになった |
| 2026-09-13 18:25 | [`3941e67`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3941e67) | 未終了行を開いたとき自動 refresh。空レポートの誤表示を止める | ページを開くだけで進行中 Agent が更新されるようになった |
| 2026-09-13 18:36 | [`ff566e3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ff566e3) | レポート抽出を実レスポンスの `run.text` 優先へ | 推測フィールドではなく実データでレポートが埋まるようになった |
| 2026-09-13 18:56 | [`7c705fc`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7c705fc) | 一覧レポート欄から生 JSON を撤去 | 意味の無い JSON 塊を見せなくなった |
| 2026-09-13 19:16 | [`8eb1aeb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8eb1aeb) | 会話 API から assistant 文を抜き、モーダル先頭へ埋め込む | **応答チャンク処理の起点**。アプリ先の回答文をアプリ内で読めるようになった |
| 2026-09-14 00:34 | [`af7b23a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/af7b23a) | 回答を Markdown 表示。0139 キャッシュ優先。成功終端だけ保存する方向へ | **キャッシュ保存を得た**。開き直しで会話 API を省略できるようになった |
| 2026-09-14 00:55 | [`245906c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/245906c) | 履歴検索を画面列フィルタからサーバ側 `answer_text` INSTR へ | **応答本文で検索できる**ようになった |
| 2026-09-14 01:20 | [`bc95820`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bc95820) | 入力ごとの検索を止め、ボタン / Enter の明示検索だけにした | 初期読み込みが検索結果を潰す見え方と、入力連打の D1 負荷を避けた |
| 2026-09-14 02:18 | [`a9a5f83`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a9a5f83) | プロンプト等の画面列も INSTR。`searchError` を見える領域へ | キャッシュ未作成行でも画面の語でヒットし、失敗が「0件」に化けなくなった |
| 2026-09-14 02:31 | [`4f125c1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4f125c1) | 問答履歴の「再読み込み」ボタンを撤去 | 検索と紛らわしい重複操作を無くした |
| 2026-09-14 02:52 | [`2082ec9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2082ec9) | 300ms デバウンスのインクリメンタルを戻し、0140 過去ログ検索を追加 | **入力中の絞り込み**と、**キーワード×ヒット起動の永続**を同時に得た。GET は保存しない |
| 2026-09-14 03:20 | [`8d0cc6e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8d0cc6e) | 本番 D1 の `no such table: cursor_agent_answer_cache` を SPEC に必載 | 未作成とキャッシュ0件を区別するテスト用文言を固定した |
| 2026-09-14 03:34 | [`afc8f75`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/afc8f75) | 0139 欠落時は画面列で再検索。`searchError` は残す。「解除」撤去 | 0140 だけ適用してもインクリメンタルが死ななくなった。空欄化で一覧復帰 |
| 2026-09-14 04:06 | [`6dd3308`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6dd3308) | 実装済み範囲と入力窓・dynamicneko 到達点を横断 SPEC にまとめる | 次工程の境界（コーパス分離、`user_id` を分裂させない）を文書として得た |
| 2026-09-14 05:17 | [`bd0d7cf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bd0d7cf) | `/neko csearch` で入力窓から Cursor VM 履歴を表検索し、回答全文をキャッシュモーダルで読む | AIチャット入口の表示検索を得た。起動と 0140 保存は残る |

SPEC への関連コミット追記（`c2ffca8` / `870afe7` / `b542e59` / `4797ef5` / `55d3d2c` / `8a8e0f2` / `510d36a` / `414e58a` / `204ebac`）は機能増ではない。ハッシュを SPEC に残し、後から「いつ入れたか」を辿れるようにした行である。

[`323009b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/323009b)（2026-09-14）は CI 警告を日付付き EVAL に整理した。当時はインクリメンタル撤去が正だった。その後 `2082ec9` で方針が戻っている。

---

## 3. 段階ごとの評価

**対象**: 上表を機能の塊に分けたときの質。

### 3.1 起動基盤（09-13 08:52–12:01）

やったこと: ページ追加、D1 失敗の握りつぶし禁止、要点表示、JST、削除、refresh、`agent_id` 修正。

評価: 初手で VM 起動はできたが、`agent_id` が数時間 null のままだった（[`c1c7931`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c1c7931)）。
状態取得も会話も ID 無しでは成立しない。**基盤が「起動できる」から「後で追える」になったのはこの修正が分岐点。**
D1 失敗を 500 にしない判断（[`62fee07`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/62fee07)）はルール8に沿っており、後の `searchError` / `persistError` / `historySaved` と同じ型の対処の原型になった。

### 3.2 状態とレポート（09-13 16:49–18:56）

やったこと: 親子テーブル、モーダル、自動 refresh、`run.text` 優先、JSON 撤去。

評価: 一覧が「起動した事実」から「今どうなっているか」へ進んだ。推測でのフィールド拾いを実レスポンス確認に切り替えた
[`ff566e3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ff566e3) はルール12の実例で、以降の会話抽出にも効いている。
空の status_log を積まない判断で、タイムラインがゴミで埋まらなくなった。

### 3.3 回答本文（09-13 19:16〜09-14 00:34）

やったこと: 会話 API、チャンク抽出、Markdown、0139 キャッシュ。

評価: SPEC の「チャンク処理」と「キャッシュ保存」はここで実体化した。
当初は完了判定なし INSERT が入り、CI 監視が妥当に警告した。その後成功終端だけ書く契約になった。
**得たものは「回答をアプリ内で読み、完了後は API を節約できる」こと。途中文の永久固定は回避できた。**

### 3.4 検索（09-14 00:55–03:34）

やったこと: サーバ検索、明示検索化、画面列ヒット、インクリメンタル復活、過去ログ、0139 欠落フォールバック。

評価: 半日で方針が二転した。

1. 本文検索へ切替（得た: 回答で探せる）
2. インクリメンタル撤去（得た: 上書きバグと連打負荷を避ける）
3. 画面列も見る（得た: 未キャッシュ行が 0 件にならない）
4. インクリメンタル復活＋過去ログ分離（得た: 入力中の絞り込みと、保存は完了操作だけ）
5. 表欠落フォールバック（得た: 0140 だけでは死なない）

最終形は AIチャット左サイドバーと同じ分離（表示は GET、保存は完了 POST）であり、SPEC 節4と一致する。
途中の撤去は無駄ではなく、上書き競合の対策（世代番号）を残した。

---

## 4. 能力チェック（SPEC 実装済み欄）

**対象**: SPEC 節1–6 が「実装済み」と書いた項目が、コミット時点で本当に手元にあるか。

| 能力 | 根拠コミット | 判定 |
|---|---|---|
| VM 起動 | [`75a299d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/75a299d) | あり |
| 自分の履歴だけ | 当初から `user_id`。他人は 404 | あり |
| 状態の追記と refresh | [`c6d0e28`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c6d0e28) [`e1391d2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e1391d2) | あり |
| assistant チャンク結合 | [`8eb1aeb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8eb1aeb) | あり |
| 成功終端キャッシュ | [`af7b23a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/af7b23a) 以降の終端判定 | あり |
| 本文＋画面列検索 | [`245906c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/245906c) [`a9a5f83`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a9a5f83) | あり |
| インクリメンタル（非保存） | [`2082ec9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2082ec9) | あり |
| 過去ログ保存 | [`2082ec9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2082ec9) | あり |
| 0139 欠落でも画面列検索 | [`afc8f75`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/afc8f75) | あり |
| 診断 `searchError` 文言の固定 | [`8d0cc6e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8d0cc6e) | あり |
| 入力窓から起動・検索 | なし | なし |
| dynamicneko から起動・検索 | なし | なし |

---

## 5. 未達と次に測る達成

**対象**: SPEC 節7・節8。

| 次工程 | 達成の定義 | いま無い理由 |
|---|---|---|
| AIチャット入力窓 | `/neko cursor` 系で起動・検索・過去検索でき、`/neko search` のコーパスを汚さない | 横断 SPEC まで。slash 未実装 |
| ダイナミックワーカー | Binding + Bearer で同じコア関数を呼び、`login` が `user_id` になる | aichat/kimi の `-external` はあるが cursor-agent 用が無い |

次の EVAL で「達成」と書いてよい条件は、上の定義を満たすコミットがログに残ること。SPEC を書いただけでは達成に数えない。

---

## 6. 関連

**対象**: 仕様と、同日の警告 EVAL。

### 関連コミット

- [`762eaaf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/762eaaf) cursor-agentの実装評価と達成度をEVALに時系列でまとめる
- [`bd0d7cf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bd0d7cf) AIチャットに /neko csearch を追加しCursor VM過去ログを表で返す

### 関連資料

- [`SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md`](SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md)
- [`SPEC.cursor-agent.md`](SPEC.cursor-agent.md)
- [`SPEC.cloudflare-workers-github-oauth-1.20260913.md`](SPEC.cloudflare-workers-github-oauth-1.20260913.md)
- [`SPEC.cloudflare-workers-github-oauth-1.20260914.md`](SPEC.cloudflare-workers-github-oauth-1.20260914.md)
- [`NOTICE.cloudflare-workers-github-oauth-1.20260914.md`](NOTICE.cloudflare-workers-github-oauth-1.20260914.md)
- [`EVAL.cloudflare-workers-github-oauth-1.20260914.md`](EVAL.cloudflare-workers-github-oauth-1.20260914.md) — 警告時点。本 EVAL のあとでは補助資料
