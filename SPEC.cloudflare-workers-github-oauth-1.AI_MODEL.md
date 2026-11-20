# SPEC: PR 要約と push 通知要約の AI_MODEL フォールバック

**対象**は、本体 Worker の `POST /webhook/github` が `pull_request` と `push` イベントから生成する要約。モデル選択は `src/utils/aiSummary.ts` の `resolveSummaryModel`、生成と再試行は `runSummaryPipeline` が担当する。push の通知経路と要約の記録は [push/PR 通知パイプラインの SPEC](SPEC.cloudflare-workers-github-oauth-1.20261004.md) を参照。

## モデルの選択

通常モデルと再試行モデルは、どちらも `DEFAULT_AI_MODEL` の Gemma 4（`@cf/google/gemma-4-26b-a4b-it`）。

| `AI_MODEL` の値 | 最初に試すモデル | 生成失敗時 |
|---|---|---|
| 未設定、空文字、空白のみ | Gemma 4 | エラーを記録 |
| 旧設定 `@cf/meta/llama-3.1-8b-instruct-fp8` | Gemma 4 | エラーを記録 |
| Gemma 4 を明示 | Gemma 4 | エラーを記録 |
| 上記以外のモデルを明示 | 前後の空白を除いた設定値 | Gemma 4 で1回だけ再試行 |

生成の例外、空応答、想定外の応答形式を失敗として扱う。Workers AI バインディングがない場合は `[AI_NO_BINDING]` を記録する。最初に Gemma 4 を試した場合、同一モデルでの再試行は行わない。両方が失敗した場合は、両方の失敗理由を記録する。

## Gemma 4 の入力と応答

要約指示とタイトル・説明・差分を単一の `user` メッセージにまとめ、`chat_template_kwargs.enable_thinking` を `false` に設定する。応答本文は空でない `response` または `choices[0].message.content` から取得する。PR 要約には初期設計チェックリストも渡す。

## D1 記録

| `ai_summary_log` のカラム | 記録内容 |
|---|---|
| `primary_model` | 最初に試すよう解決されたモデル名 |
| `model` | 要約を返したモデル名。失敗時は最後に試したモデル名。Workers AI バインディングがない場合は解決済みのモデル名 |
| `fallback_used` | 再試行を行った場合は `1`、それ以外は `0` |

`/status` の保存データモーダルや `/ai-summary/:id` で、記録されたモデル名を確認できる。

## 運用手順

### 新モデルのテスト方法

1. `wrangler secret put AI_MODEL` で実験モデル名をセット

```
wrangler secret put AI_MODEL
```

プロンプトが出たら実験モデル名を入力:

```
@cf/openai/gpt-oss-120b
```

2. デプロイ後、PR を作成するか push して要約をトリガー
3. `/status` の `ai_summary_log` 保存データモーダルで `model` カラムを確認
   - 実験モデル名が入っていれば成功
   - `fallback_used = 1` であればフォールバックが発動した

### 実験モデルを解除して安定モデルのみに戻す方法

```
wrangler secret delete AI_MODEL
```

`AI_MODEL` を削除すると Gemma 4 の単一試行に戻る。

## テスト方針

| テストケース | primary | fallback | 期待結果 |
|---|---|---|---|
| primary 成功 | 成功 | 任意 | primary の要約、`usedModel` = primary |
| primary 失敗 → fallback 成功 | throw | 成功 | fallback の要約、`usedModel` = fallback |
| primary `[AI_*]` → fallback 成功 | `[AI_EMPTY_RESPONSE]` | 成功 | fallback の要約、`usedModel` = fallback |
| primary = fallback で失敗 | throw | (同一) | 再試行なし、`[AI_ERROR]` |
| 両方失敗 | throw | throw | `[AI_ERROR] fallback also failed` |
| fallback 未指定 | throw | undefined | `[AI_ERROR]`、再試行なし |
| AI binding なし | - | - | `[AI_NO_BINDING]`、再試行なし |

`src/utils/aiSummary.test.ts` でモデル選択、Gemma 4 の応答形式、再試行を検証する。push Webhook のテストでは旧設定からの切り替え、明示モデル失敗時の再試行、D1 に記録するモデルを検証する。

## 注意事項

- `AI_MODEL` は `wrangler secret put` で管理する。`wrangler.toml` の `[vars]` に書かない
- `DEFAULT_AI_MODEL` はソースコード内の定数。安定動作が確認されたモデルのみをここに設定する
- PR 通知が送信される場合は、フォールバックの発動を通知にも表示する。D1 では PR と push の両方を `fallback_used` で確認できる。
