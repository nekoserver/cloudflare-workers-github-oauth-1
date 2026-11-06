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
