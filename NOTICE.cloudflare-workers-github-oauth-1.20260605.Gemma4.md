# NOTICE: Gemma-4 (@cf/google/gemma-4-26b-a4b-it) Workers AI 統合の注意事項

調査日: 2026-06-05

---

## 1. レスポンス形式が OpenAI 互換形式である

**最重要。他のモデルと異なる。**

Gemma-4 は Workers AI ネイティブ形式（`result.response`）ではなく、
**OpenAI 互換形式**でレスポンスを返す。

```typescript
// NG: 他のモデル（llama 等）と同じ参照方法
const text = result.response; // → 常に undefined → 空文字になる

// OK: Gemma-4 は choices 形式
const text = result.choices?.[0]?.message?.content;
// または thinking モード時は
const text = result.choices?.[0]?.message?.reasoning_content;
```

Cloudflare Observability の診断ログで確認した実際のキー一覧：

```
choices, created, id, kv_transfer_params, model, object,
prompt_logprobs, prompt_token_ids, service_tier, system_fingerprint, usage
```

`response` キーは存在しない。

---

## 2. Thinking モードがデフォルトで ON

Gemma-4 は "Built-in thinking mode" を持ち、デフォルトで有効。
`<think>...</think>` タグで思考過程を出力し、実際の回答は
`choices[0].message.content`（thinking OFF 時）または
`choices[0].message.reasoning_content`（thinking ON 時の思考部分）に入る。

### `enable_thinking: false` の効果

`chat_template_kwargs: { enable_thinking: false }` を渡しても
**thinking が完全に無効化されるとは限らない**（動作が不安定）。
thinking が ON のまま動いている場合、回答は
`choices[0].message.reasoning_content` に入り、`content` は空になる。

そのため両フィールドをフォールバックとして参照する実装が必要：

```typescript
const content   = String(choiceMsg['content'] ?? '');
const reasoning = String(choiceMsg['reasoning_content'] ?? '');
const raw = content || reasoning;
```

### `reasoning_effort: 'none'` は無効な値

`reasoning_effort` に渡せる値は `"low"` / `"medium"` / `"high"` のみ。
`"none"` は仕様外の値でAPIエラーを誘発する可能性がある。絶対に使わないこと。

---

## 3. max_tokens は大きめに確保する

Thinking モードが ON の場合、思考トークンが大量に消費される。
`max_tokens: 4096`（デフォルト）では思考だけで枯渇し、回答部分が空になる。

```typescript
// Gemma-4 専用設定
AICHAT_MODEL_MAX_TOKENS['@cf/google/gemma-4-26b-a4b-it'] = 65536;
```

---

## 4. モデルは有料（Neuron 課金）

| 項目 | 値 |
|---|---|
| 入力トークン | $0.10 / 1M トークン |
| 出力トークン | $0.30 / 1M トークン |

ただし Workers AI の無料枠（10,000 Neurons/日）の範囲内で利用可能。
Thinking モードで大量トークンを消費するとすぐに無料枠を使い切る点に注意。

---

## 5. Kimi K2.6 との違い（混同注意）

Gemma-4 と同時期に追加された Kimi K2.6 は **異なる**パラメータ体系を持つ。

| 項目 | Gemma-4 | Kimi K2.6 |
|---|---|---|
| Thinking 制御 | `chat_template_kwargs.enable_thinking` | `chat_template_kwargs.thinking` |
| Thinking 結果フィールド | `choices[0].message.reasoning_content` | `reasoning`（トップレベル） |

---

## 6. 問題切り分けチェックリスト

Gemma-4 が空レスポンスを返す場合の確認順序：

1. **`keys` を確認** — `choices` が含まれているか（`response` が含まれていたら別問題）
2. **`choicesCount` を確認** — 0 なら API レベルで回答なし（Neuron 枠超過等）
3. **`choiceMsgKeys` を確認** — `content,reasoning_content` か `content` のみか
4. **`choicesLen` / `choicesReasoningLen` を確認** — どちらかが > 0 なら取得できている
5. **`rawHead` を確認** — `<think>` タグしかない場合は `stripThinkTags` の問題

---

## 関連コミット

| コミット | 内容 |
|---|---|
| [`58dd444`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/58dd444) | Gemma-4 thinking モード無効化・max_tokens 16384 化 |
| [`f9735e2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f9735e2) | `reasoning_effort: 'none'` 除去・診断ログ追加 |
| [`4f4aadb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4f4aadb) | max_tokens 65536 化・`reasoning_content` フォールバック追加 |
| [`7113108`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7113108) | OpenAI 互換 `choices` フォーマットからの取得を実装（根本修正） |
| [`72c8f26`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/72c8f26) | `choices[0].message.reasoning_content` フォールバック追加・診断ログ強化 |
