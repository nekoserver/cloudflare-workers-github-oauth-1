# SPEC.cloudflare-workers-github-oauth-1.aichat-muse.20261106.md

## /aichatでのmuse_promptの扱い

**対象**: `/neko askgk muse_prompt="◯"` — `/aichat`での質問の表示・回答の保存・エンジン情報の表示を、Codex・Claudeと揃える。

関連: lib側の修正 [nekoserver/lib#111](https://github.com/nekoserver/lib/pull/111)、コンテナ側の設定 `lib/SETTINGS.claude-host.20261102.md`の「muse_prompt」。

---

## 背景

`muse_prompt`の送信経路は#2524で追加されたが、`/aichat`側の処理はCodex・Claudeと揃っていなかった。2026-11-06に次の症状を確認した。

| 症状 | 原因 |
|---|---|
| 質問の吹き出しに`/neko askgk muse_prompt="◯"`がそのまま出る | `formatAskgkPromptQuestion`の正規表現が`codex`・`claude`だけを対象にしていた |
| 回答が`neko/askgk`として保存される | `askgkModel`が`codex`・`claude`だけで、Museは`autoSave`の経路へ入っていた |
| `Engine:`・`Model:`の行が出ない | libのworkerが`llm_model`だけを保存し、`tunnels_lib.rb`が読む`model`が無かった |

libはメッセージの`muse_prompt=`を正しく除去しており、Museへ接頭語は渡っていない。接頭語が残っていたのは本体Workerの表示と保存である。

---

## 経路

```
/aichat の入力
  → 本体Worker（接頭語ごとaskTunnelSignerへ渡す）
  → rust-worker-sqlx-d1 /tunnel-signer
  → https://mygw.nekomaneki.work/lib/api/tunnels
  → LLM worker → tailscale nc → muse-vm:8080 /v1/chat/completions
```

Museへの送信はCodex・Claudeと違いCLIを実行せず、sandboxの外でHTTPを送る。

---

## 仕様

| 項目 | 動作 |
|---|---|
| Workerからlibへ送る文字列 | `muse_prompt="◯"`のまま。接頭語を除去しない |
| 吹き出し・共有・`ai_chat_shares.question` | 引用符の内側の本文`◯`だけ。`"`と`“ ”`のどちらでもよい |
| 閉じていない入力 | 変換せず、入力のまま扱う |
| `ai_chat_shares.model` | `muse` |
| 応答の`usedModel` | `muse` |
| スレッド | Claudeと同じ。所有を確認できないスレッドIDは再利用せず、新しいスレッドへ保存する |
| 回答末尾の情報行 | `Engine: Muse / Model: muse` |
| 色丸のモデル一覧 | `muse`を`commandOnly`で追加する。色は`assignModelColors`で割り当てる |
| 色丸で`muse`を選んだ通常の質問 | `/neko askgk muse_prompt="…"`に変換して送る |
| 色丸とプレフィックスの関係 | 互いに影響しない。プレフィックス付きの質問は、色丸で選択中のモデルの影響を受けない（[AGENTS.md](AGENTS.md#aiチャットの言語モデルスイッチとプレフィックス)） |
| 回答の表示 | Claude・Codexと同じく、リンクの脚注化とコードの色付けを行う |
| 質問ツリー（`/api/mcp-sample/codex-questions`） | `model`に`muse`を含める。表示名は`Muse` |

### Effort

MuseのAPIの応答にeffortの項目は無い。返るのは`id`・`object`・`created`・`model`・`choices`・`usage`で、`choices[0]`は`index`・`message`・`finish_reason`。そのため`Effort:`は表示しない。値を推定して補わない。

`Model:`はAPIの`model`の値で、2026-11-06時点では`muse`のみ。

---

## 対象外

- `/aichat`のCodex・Claude比較（`src/views/aichatCrossModel.ts`、`src/index.ts`の`model IN ('claude', 'codex')`）。2エンジンの比較のまま変えない。
- `nemotron`。libの`route`は受け付けるが、`run`が`unsupported_engine`を返す。
- 変更前に`neko/askgk`として保存したMuseの回答の移行。
- Museの応答の`usage`の利用。トークン数はCodex・Claudeと同じく文字数から推定する。

---

## 修正内容

| ファイル | 変更 |
|---|---|
| `src/utils/codexAskgkQuestion.ts` | 質問本文の抽出の対象に`muse`を追加 |
| `src/utils/aichatSlashCommand.ts` | `muse_prompt="…"`で`museAskgk`を返す |
| `src/index.ts` | `askgkModel`に`muse`を追加。色の割り当てと色丸からの送信にも追加 |
| `src/utils/aichatModelConfig.ts` | `MUSE_ASKGK_MODEL`を追加 |
| `src/views/aichat.ts` | モデル一覧・色・回答の表示に`muse`を追加 |
| `src/routes/codexQuestionTree.ts`、`src/views/codexQuestionTree.ts` | 質問ツリーの対象に`muse`を追加 |

---

## テスト

| 対象 | テスト |
|---|---|
| 質問本文の抽出 | `src/utils/codexAskgkQuestion.test.ts` |
| 吹き出し・共有・モデル一覧 | `src/aichat-codex-question-display.test.ts` |
| 接頭語を保ったまま送り、`museAskgk`を返す | `src/utils/aichatSlashCommand.test.ts` |
| `ai_chat_shares`への保存 | `src/aichat-askgk-save-integration.test.ts` |
| 質問ツリー | `src/routes/codexQuestionTree.test.ts` |
| workerの`model`（lib） | `claude/test/llm_worker_muse_test.py` |

---

## 関連コミット

- lib: [`4d10939`](https://github.com/nekoserver/lib/commit/4d10939) fix: muse_promptのモデル名をtunnelsの応答へ渡す

---

## 反映

lib側はworkerの再起動で反映する。本体Worker側はデプロイが必要。

---

## 注意事項

**対象**: 2026-11-06時点の未確認の項目 — 修正後に実環境で確かめる。


- 本体Workerの修正を反映した実画面での表示と保存。
- Slackからの`/neko askgk muse_prompt="◯"`の動作。

---

## Muse選択の接頭語なし投稿は、tunnelsへ切り替えず直接muse-vmへ送る（2026-11-07）

**対象**: `src/index.ts`の`POST /api/aichat`、`src/views/aichatMuseHealth.ts`のMuseの⚙モーダル — 言語モデルスイッチがMuseのときの、プレフィックスの無い投稿の経路。

### 背景

[#2533](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2533)で、Tailscaleを確かめられないときに設定がONなら`/neko askgk muse_prompt="…"`（tunnels経由）へ変換して送るフォールバックを入れた。ユーザー指定（2026-11-07）により、スイッチがMuseのときの接頭語なし投稿は、tunnels方向ではなく直接muse-vmへ送る。AGENTS.md「AIチャットの言語モデルスイッチとプレフィックス」の「2つの経路を互いの代替として扱わない」にも合わせる。

### 修正内容

| ファイル | 変更 |
|---|---|
| `src/index.ts` | Tailscaleを確かめられないときは、設定やCookieに関係なく止める（tunnelsへ変換しない）。`museTunnelsFallback`と`fallbackUsed`を削除 |
| `src/views/aichatMuseHealth.ts` | 「Tailscale未接続時に tunnels を使う」の設定と`aichat_muse_tunnels`のCookieの読み書きを削除 |
| `src/aichat-askmuse-integration.test.ts`・`src/views/aichatMuseHealth.test.ts` | 指定やCookieがONでもtunnelsへ送らないこと、設定を表示しないことを確かめる |

明示の`/neko askgk muse_prompt="…"`（tunnels経由）と`/askmuse prompt="…"`（直接）は変えていない。ブラウザに残った`aichat_muse_tunnels`のCookieは読まなくなるだけで、消してはいない。

---

## Muse選択の接頭語なし投稿は、muse-vmを確認できれば直接を最優先し、失敗時はtunnels接続のポリシーで決める（2026-11-07、2回目）

**対象**: `src/utils/museRoute.ts`（新規、`routeMusePrompt`・`readMuseTunnelsPolicy`）、`src/utils/museTailscalePreflight.ts`（`checkMuseVmOnTailnet`・`museVmNotConfirmedMessage`）、`src/index.ts`の`POST /api/aichat`、`src/views/aichatMuseHealth.ts`のMuseの⚙モーダル — 言語モデルスイッチがMuseのときの、プレフィックスの無い投稿の経路と停止の条件。

### 背景

muse-vmとtunnels経由の経路（このホストのtunnels.rb → LLM worker → `tailscale nc`）が動いているのに、本体コンテナ（`DEMO_CONTAINER`）が停止中だったため「❌ Muse投稿を停止しました: Muse投稿を停止しました。本体コンテナが停止中のためTailscaleへ接続できません。」と表示され、投稿できなかった。ユーザー指定（2026-11-07）:

1. tunnels.rbへ問い合わせる前に、tailnet上のmuse-vmが生きているかを確かめ、生きていれば直接接続を最優先する。
2. それでも失敗し、選択中の言語モデルがMuseなら、tunnels接続のポリシー（ON/OFF）を確かめる。OFF（既定）ならtunnels.rbへの問い合わせも中止する。
3. Muse投稿を停止してよいのは、tailnet上にmuse-vmを確認できない場合だけ。
4. 判定と振り分けは単独の関数にして、ほかからも呼べるようにしてよい。

### 振り分け

| tailnet上のmuse-vm | 直接経路の結果 | ポリシーON | ポリシーOFF（既定） |
|---|---|---|---|
| 確認できた | 成功 | 直接の回答 | 直接の回答 |
| 確認できた | muse-vmへ届かない（`container_not_running`・`muse_connection_failed`・`muse_not_authenticated`、または直接経路が未設定） | tunnels.rbへ問い合わせる | 直接のエラーを返す。停止とは書かない |
| 確認できた | muse-vmが応答した失敗、タイムアウト | 直接のエラー（再送しない） | 直接のエラー |
| 確認できない（本体コンテナ停止中を含む） | 送らない | tunnels.rbへ問い合わせる | 「❌ Muse投稿を停止しました。tailnet上にmuse-vmを確認できません（理由）。」tunnels.rbへも問い合わせない |

- tunnels.rbへは本文を`/neko askgk muse_prompt="…"`で送る。このとき本体コンテナでの事前確認（`askgkDep`の`withMuseTailscalePreflight`）は挟まない。停止中のコンテナを起動しないため。
- tunnels経由の回答には`fallbackUsed: true`を付ける。保存する質問は元の本文。
- ポリシー: リクエストの`museTunnelsFallback`（`true`だけがON）を優先し、無ければCookie`aichat_muse_tunnels=on`、どちらも無ければOFF。⚙モーダルの「muse-vmへ直接届かないとき tunnels.rb を使う（初期OFF）」で保存し、「デフォルトに戻す」で消す。
- 停止の文言から「停止しました」の重複（「停止しました: 停止しました。」）をなくした。

### 修正内容

| ファイル | 変更 |
|---|---|
| `src/utils/museRoute.ts` | 新規。`routeMusePrompt`（確認→直接→ポリシー→tunnelsまたは停止）、`readMuseTunnelsPolicy` |
| `src/utils/museTailscalePreflight.ts` | 確認を`checkMuseVmOnTailnet`（`online`か`not_confirmed`と理由、例外なし）に切り出し、`requireMuseTailscale`はその薄い包みにした。停止の文言を`museVmNotConfirmedMessage`にそろえた |
| `src/index.ts` | Muse選択の接頭語なし投稿を`routeMusePrompt`で扱う。`museTunnelsFallback`と`fallbackUsed`を戻した |
| `src/views/aichatMuseHealth.ts` | ポリシーの設定（既定OFF）を戻した |
| `AGENTS.md` | 「互いの代替として扱わない」に、この投稿だけの例外と停止の条件を書いた |
| テスト | `src/utils/museRoute.test.ts`（新規）、`src/aichat-askmuse-integration.test.ts`、`src/views/aichatMuseHealth.test.ts` |

明示の`/neko askgk muse_prompt="…"`と`/askmuse prompt="…"`の経路は変えていない（明示の`muse_prompt`は今も本体コンテナでの事前確認を通る）。

### 確認

- 新しい仕様のテストを先に書き、10件が失敗することを確かめてから実装した。
- 関連テスト6ファイル308件が通る。`routeMusePrompt`を「muse-vmが応答した失敗も再送する」「ポリシーを無視する」「確認前にtunnelsへ送る」の3通りに壊すと、それぞれ8・14・11件が失敗する。
- `tsc --noEmit`の型エラーは変更前と同じ87件で、増えていない。⚙モーダルのscriptは`node --check`を通る。
- 未確認: デプロイ後の実画面、本体コンテナ停止中に実際にtunnels.rb経由で回答が届くこと（Workerのデプロイはこの環境からできない）。
