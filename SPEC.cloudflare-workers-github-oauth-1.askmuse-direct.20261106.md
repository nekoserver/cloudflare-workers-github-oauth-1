# SPEC.cloudflare-workers-github-oauth-1.askmuse-direct.20261106.md

## /askmuseによるMuseへの直接の問い合わせ

**対象**: `/aichat`のスラッシュコマンド`/askmuse prompt="◯"` — tunnels.rbとLLM workerを通らず、本体デモコンテナからtailnet上の`muse-vm`へ問い合わせる。

関連: 既存の経路は[SPEC.cloudflare-workers-github-oauth-1.aichat-muse.20261106.md](SPEC.cloudflare-workers-github-oauth-1.aichat-muse.20261106.md)の`/neko askgk muse_prompt="◯"`。こちらは変更しない。

---

## 背景

**2026-11-08追記**: 以下の「WorkerはTailscaleのノードになれない」は当初の構成を前提とした記述。実workerd内のTailscale WASMでノード登録・muse-vmへの認証付きPOST・実回答取得を確認した。成功時の質問・回答、認証条件と未反映範囲は [Worker内WASMからMuseブリッジへの直接POST](SPEC.cloudflare-workers-github-oauth-1.wasm-muse-bridge.20261108.md) を参照。既存の/askmuseの本番経路を切り替えたことは意味しない。

`/neko askgk muse_prompt="◯"`は5段を経由し、ジョブの登録と照会を行う。WorkerはTailscaleのノードになれないため、tailnetへ届くには必ずノードを1つ経由する。本体デモコンテナはWorkerのDurable Object（`DEMO_CONTAINER`）から直接呼べるノードなので、これを唯一の中継にする。

---

## 経路

| 項目 | `/neko askgk muse_prompt` | `/askmuse prompt` |
|---|---|---|
| 経路 | Worker → rust-worker-sqlx-d1 → 公開URL → tunnels.rb → LLM worker → `tailscale nc` → muse-vm | Worker → `DEMO_CONTAINER` → `server.js` → `tailscale nc` → muse-vm |
| 認証 | HMAC署名 | `/api/aichat`の認証。Durable Objectの呼び出しは公開URLを通らない |
| 実行 | ジョブ登録と`ask_id`の照会 | 1回の要求で待つ |
| キーの場所 | LLM workerの環境 | Workerのsecret`MUSE_API_KEY` |
| 独立経路（Redmine側） | 設定で選べる | なし。本体コンテナだけ |

---

## 仕様

| 項目 | 動作 |
|---|---|
| 入力 | `/askmuse prompt="◯"`。`"`と`“ ”`のどちらでもよい。大文字小文字は区別しない |
| 形式が違う、本文が空 | 使い方を返す。送らない |
| Museへ送る文字列 | `◯`だけ |
| 吹き出し・`ai_chat_shares.question` | `◯`だけ |
| `ai_chat_shares.model`、`usedModel` | `muse` |
| 回答末尾 | `Engine: Muse / Model: <応答のmodel>`。不正な値なら`muse` |
| スレッド | `muse_prompt`と同じ |
| 色丸の選択 | `/askmuse`はどのモデルを選んでいても変換しない。送信しても色丸の選択は変えない（[AGENTS.md](AGENTS.md#aiチャットの言語モデルスイッチとプレフィックス)） |
| 待ち時間 | `/neko askgk`と同じ保存値（`askgk_timeout_settings`） |
| 上限 | 質問16KiB、回答32KiB（lib/ops/llm_worker.pyと同じ）。中継の本文と応答は1MiB |
| コンテナの停止中 | 起動せず、`/cf-containers`からの起動を案内する |
| 失敗時 | ❌で返す。Museの回答としては保存しない。lib経由へ切り替えない |

### コンテナを起動しない理由

`stub.fetch`は`Container.containerFetch`を通り、停止中のコンテナを起動する。`/api/aichat`の問い合わせが課金の開始になるのを避けるため、先に`getState`で確かめる。確認と送信の間にコンテナが止まった場合は起動が走りうる。

### キーをコンテナへ置かない理由

`DemoContainer.envVars`に入れると、コンテナ内のT3とエージェントの子プロセスから読める。libの`llm_worker_claude.py`も同じ理由で環境から取り除いている。`server.js`は`Authorization`を中継するだけで保存しない。

### 中継の入口

`POST /muse/v1/chat/completions`（`containers/demo/server.js`）。送り先は`muse-vm:8080/v1/chat/completions`に固定し、`Authorization`と本文だけを渡す。8080番はtailnetの端末からも届くので、Bearerキーが無い要求は上流へつながない。

| 状態 | 応答 |
|---|---|
| 上流の応答 | 状態コードと本文をそのまま返す |
| Bearerキーが無い | 401 `muse_not_authenticated` |
| POST以外 | 405 |
| 本文が1MiB超 | 413 |
| 応答が1MiB超 | 502 `muse_response_too_large` |
| 接続できない | 502 `muse_connection_failed` |
| 300秒で応答がない | 504 `llm_timeout` |

### 死活確認と入力窓の枠色

`/aichat`で言語モデルスイッチが`muse`のとき、`/askmuse`の経路が使える間は、入力窓の枠をMuseの色にする。

| 項目 | 動作 |
|---|---|
| 枠の色 | 言語モデルの色の設定でMuseに割り当てられた色（`getModelDotColor('muse')`）。固定の色は使わない |
| 確認する条件 | スイッチが`muse`で、シグナル送信がONのときだけ |
| 確認の時機 | 送信間隔ごと（既定600秒）。`muse`へ切り替えたとき、設定を保存したときはすぐ確認する |
| タブが隠れている間 | 確認を送らない。表示に戻ったとき、前回から送信間隔が空いていれば確認する |
| 設定の入口 | 言語モデルの選択パネルのMuseの行末の⚙。モーダルは`getNextZ()`で最上位に開く |
| シグナル送信 | チェックボックス。既定は有効。OFFなら信号を送らず、枠は既定の色にする |
| 送信間隔 | 60〜86400秒の整数。既定は600秒。入力はチェックボックスに連動し、OFFの間は無効。ONで範囲外なら保存しない |
| 設定の保存先 | Cookie`aichat_muse_signal`（ブラウザごと、1年）。読めない値は既定値として扱う。「デフォルトに戻す」で消す |
| 稼働中でないとき、確認に失敗したとき | 枠を既定の色へ戻す |
| `muse`以外へ切り替えたとき | すぐ既定の色へ戻す。切り替え前の確認の応答は捨てる |
| 入力中 | 枠の色を保つ。インラインのスタイルなので`.chat-input:focus`より優先する |
| 確認の入口 | `GET /api/aichat/muse-health`（認証が必要）。応答は`{"healthy":true}`か`{"healthy":false}` |
| 中継の入口 | `GET /muse/health`（`containers/demo/server.js`）。送り先は`muse-vm:8080/health`に固定する。推論は走らない |
| コンテナの停止中 | 起動しない。定期の確認で課金が始まらないよう、先に`getState`で確かめる |
| 待ち時間 | 中継は5秒、Workerは8秒で打ち切り、稼働中でないものとして扱う |

確かめるのは`/askmuse`の経路（コンテナ、中継、`muse-vm`）とキーの有無までで、モデルが回答を生成できることは確かめない。`/neko askgk muse_prompt`の経路の状態も表さない。`MUSE_API_KEY`が誤っていても`/health`は認証が要らないので稼働中と表示する。

`muse-vm`がオフラインだと`tailscale nc`は応答しないまま待ち続ける（2026-11-06に実機で確認）。`connectMuse`のDuplexには`setTimeout`が無く`http.request`の`timeout`は発火しないため、中継の打ち切りは自前のタイマーで行う。

---

## 修正内容

| ファイル | 変更 |
|---|---|
| `src/utils/museDirectAsk.ts` | 新規。状態確認、送信、応答の解釈、エラーの分類 |
| `src/utils/aichatSlashCommand.ts` | `/askmuse`の解釈、ヘルプ |
| `src/utils/codexAskgkQuestion.ts` | `parseAskMusePrompt`を追加。`formatAskgkPromptQuestion`の対象に追加 |
| `src/index.ts` | 依存の注入。色丸の変換から`/askmuse`を除外 |
| `src/types.ts` | `MUSE_API_KEY` |
| `containers/demo/server.js` | 中継の入口、死活確認の入口 |
| `src/views/aichatMuseHealth.ts`、`src/views/aichat.ts` | 死活確認の監視、入力窓の枠色、シグナル送信の設定モーダル、Museの行の⚙ |

---

## テスト

| 対象 | テスト |
|---|---|
| 送信、エラーの分類、上限、待ち時間 | `src/utils/museDirectAsk.test.ts` |
| 中継、切断、`tailscale nc`の契約 | `src/cf-containers-muse-proxy.test.ts` |
| コマンドの解釈 | `src/utils/aichatSlashCommand.test.ts` |
| 本文の抽出 | `src/utils/codexAskgkQuestion.test.ts`、`src/aichat-codex-question-display.test.ts` |
| `/api/aichat`全体 | `src/aichat-askmuse-integration.test.ts` |
| 死活確認の監視と枠色、設定の読み取り、モーダル、Museの行の⚙ | `src/views/aichatMuseHealth.test.ts` |

---

## 反映

1. `wrangler secret put MUSE_API_KEY`（`muse-vm`のAPIキー）
2. Workerをデプロイする。`containers/demo/server.js`を変えたのでコンテナイメージの更新が要る
3. 本体コンテナを新しいイメージで起動し直す
4. `/aichat`で`/askmuse prompt="今日は何日？"`を送り、`Engine: Muse`の行を確かめる

---

## 注意事項

**対象**: 2026-11-06時点の未確認の項目 — 反映後に実環境で確かめる。

- 有効なキーでの回答。無効なキーを`tailscale nc`経由で送り、muse-vmが401を返すところまでは確認した。
- Durable Object越しの長時間の応答と、`signal`による打ち切りがコンテナまで届くこと。
- イメージのビルド。`scripts/check-cf-containers.sh`は実行していない。
- `forwardToMuse`の300秒の`timeout`も同じ理由で発火しない。Worker側の待ち時間で打ち切られるが、未修正。
- 死活確認の実画面での表示。中継の`checkMuseHealth`は2026-11-06に実際の`tailscale nc`越しで200を確認した。オフライン時の打ち切りは、`setTimeout`の無いストリームを使う単体テストでの確認。

## 2026-11-07: Museの通常入力と任意のtunnelsフォールバック

初期（要求時）のモデルがMuseで、明示プレフィックスのない入力は、本文をコマンドへ変換せず本体コンテナ→Tailscale→muse-vmへ直接送る。Tailscale確認は送信の直前に行い、Runningかつ宛先muse-vm onlineを必要とする。

| Tailscale確認 | tunnelsフォールバック | 処理 |
|---|---|---|
| 接続可能 | OFF/ON | 本文のまま直接Museへ送る |
| 接続不可/確認不可 | OFF（初期状態） | 送信せず接続エラーを表示 |
| 接続不可/確認不可 | ON | この場合だけ/neko askgk muse_prompt="本文"へ変換し、既存tunnels経路へ1回送る |

Museの⚙の「接続・シグナル設定」に「Tailscale未接続時に tunnels を使う（初期OFF）」を追加。設定はブラウザごとのCookie aichat_muse_tunnels=on/offに保存し、リセットでOFFに戻す。シグナル送信のON/OFFとは独立している。サーバーの/api/aichatはCookieを読むため、通常送信と再質問など同じブラウザの経路に共通して効く。APIのmuseTunnelsFallbackを明示した場合はboolean trueだけをONとし、false/不正値はOFFとしてCookieより優先する。

直接Museへ送信後のHTTP/認証/実行失敗・タイムアウトはtunnelsへの再送条件にしない。接続確認の失敗時だけ経路を決めてから1回送る。フォールバック使用時もmodel=museで質問本文と回答を保存し、fallbackUsed=trueを返す。X-Muse-Tailscaleはフォールバック成功時もunavailableのままにして、Tailscaleで接続したと誤表示しない。

明示/neko askgk muse_promptと/askmuse、Codex/Claude通常入力の経路は維持し、選択中のスイッチを変更しない。tunnelsのONは現LLM workerのMuse対応を保証するものではなく、非対応ならその経路のエラーを返す。
