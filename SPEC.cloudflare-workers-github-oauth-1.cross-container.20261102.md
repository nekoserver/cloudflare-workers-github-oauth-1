# コンテナをまたぐ処理を本体Workerへ寄せる案（最終案、未着手）

**日付**: 2026-11-02
**状態**: 案。まだ決めていない。今の応急の対応をやめるときの行き先として残す。
**関連**: [`SPEC.cloudflare-workers-github-oauth-1.askgk-routes.20261026.md`](SPEC.cloudflare-workers-github-oauth-1.askgk-routes.20261026.md)（askgkの経路）、[`SPEC.cloudflare-workers-github-oauth-1.aichat-stream.20261102.md`](SPEC.cloudflare-workers-github-oauth-1.aichat-stream.20261102.md)（ストリームの接続先）、`nekoserver/lib` の `claude/`（Claude版のtunnels・worker・observer）

## 背景

Codex向けに作ったlibの処理（tunnels API・LLM worker・会話observer）は、コンテナごとに環境が違うため、そのままでは動かなかった。そこで2026-11-02までに、コンテナごとに次の応急の対応を入れた。

| どこで | 応急の対応 | 問題 |
|---|---|---|
| lib `claude/` | 元ファイルを読み込み、環境に依存する箇所だけを差し替えた別名版（`tunnels.claude.rb`・`llm_worker_claude.py`・`chat_observer_claude.py`） | 元ファイルと別名版の2系統を保守する。元の変更に追従しているかは手で確かめるしかない |
| 本体コンテナ（mygw）のApache | `/lib/api/tunnels` だけをCGIの `tunnels.claude.rb` へ向け、他は `server.js` へ中継。`/root/lib` を `/var/www/html/lib` へbind mount。秘密の値はroot専用の設定ファイル | 稼働中のコンテナを手で直しただけ。コンテナを作り直すと消える。イメージ（`containers/**`）には入っていない |
| Redmineコンテナ | Claude CLIを外した（redmine `e2e1242`）。claudeの依頼には `engine_unavailable` を返す | どのコンテナで何が動くかを、Worker側は知らない |
| 本体Worker `askgk-routes.json` | `engineRoutes: {"claude": "main"}` でclaudeの依頼だけを本体コンテナへ送る | 「claudeはmain」という知識を、コンテナの外に手で書いている |
| 本体Worker `conversation-stream-routes.json` | ストリームの接続先の一覧を手で書く | 同上。一覧のmygwは、現状 `server.js` の仮の応答を返す |

共通する問題は、**どのコンテナが何をできるか（エンジン・ストリーム・API）**という知識が、コンテナの中の設定と本体Workerの一覧に分かれて、手で合わせていることにある。

## 案

コンテナは同じ形のAPIを出すだけにし、どこへ送るか・どこが使えるかの判断は本体Workerに集める。

1. **コンテナの契約を1つにする**: どのコンテナも、同じパスで同じ署名付きAPIを出す（`/lib/api/tunnels`、`/lib/api/chat/*`、`/lib/conversation-embed.html`）。環境の違い（rubyの場所、`cf` の出力形式、CLIの有無）は、コンテナのイメージの中で吸収し、別名のスクリプトを作らない。
2. **コンテナが自分のできることを返す**: 署名付きの `GET /lib/api/capabilities` のような口を足し、使えるエンジン（codex・claude・nemotron）、ストリームの方式、版を返す。手で書く一覧の代わりにこれを正とする。
3. **本体Workerが経路を決める**: askgk・ストリーム・死活確認が、同じ「コンテナの台帳」と同じ解決関数を使う。台帳にはコンテナの公開ホストだけを書き、エンジンやストリームの可否は2の応答から決める。今の `askgk-routes.json` の `engineRoutes` と、`conversation-stream-routes.json` は、この台帳に統合する。
4. **切り替えの規則を明示する**: 送信済みの依頼は別のコンテナへ再送しない（今のaskgkと同じ）。新しい依頼だけを、使えるコンテナへ送る。使えるコンテナがなければ、理由（どのコンテナのどの機能がないか）を返す。

## 決めていないこと

- 2の応答を、毎回の依頼の前に確かめるか、一定時間ためておくか（Workerのプロセス内キャッシュは今は持たない方針）。
- Codex版とClaude版で、LLM workerを1つにするか、エンジンごとに分けたまま同じソケットの契約にそろえるか。
- コンテナのイメージに入れる作業は、ルール39・44（push前の `scripts/check-cf-containers.sh`、ソースビルドの許可）の対象になる。どのPRで入れるか。

## やめ方（今の応急の対応を外す順）

1. 1・2をコンテナのイメージに入れ、新しいイメージで `capabilities` が返ることを確かめる。
2. 本体Workerを3の台帳に切り替える。`engineRoutes` と `conversation-stream-routes.json` を消す。
3. mygwのApacheの手の変更（`/etc/apache2/sites-enabled/000-demo.conf` の `/lib/api/tunnels` の節、`/etc/apache2/lib-tunnels-secrets.conf`、bind mount）を外す。
4. lib `claude/` の別名版を、元ファイルへの統合が済んだものから消す。
