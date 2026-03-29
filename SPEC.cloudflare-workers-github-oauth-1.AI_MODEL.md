# SPEC: AI_MODEL フォールバック機構

**対象**: `src/utils/aiSummary.ts` の `resolveAiModel` / `runSummaryPipeline`、
`src/index.ts` の AI 要約呼び出し箇所 (L2648, L2687-2694)、
D1 `ai_summary_log.model` カラム
— 環境変数 `AI_MODEL` で実験モデルを試し、失敗時に `DEFAULT_AI_MODEL`（安定モデル）で
自動再試行することで、要約の成功率を維持しながらモデル切り替えを安全にテストできるようにする。

---

## 背景

- Workers AI のモデルを `@cf/openai/gpt-oss-120b` 等の新モデルに切り替えてテストした際、
  要約がエラーになるケースが発生した
- 現状は `resolveAiModel` が1つのモデルを返すだけで、失敗したらそのまま `[AI_ERROR]` が記録される
- 新モデルのテスト中でも要約が全滅しないよう、安定モデルへのフォールバックが必要

## 現状の動作

```
AI_MODEL 環境変数 (wrangler secret)
       │
       ▼
resolveAiModel(env.AI_MODEL)
       │
       ├─ AI_MODEL が設定済み → その値を返す
       └─ 未設定 / 空 / 空白のみ → DEFAULT_AI_MODEL を返す
       │
       ▼
runSummaryPipeline({ model }) ── 1回だけ試行 ── 失敗 → [AI_ERROR] 記録
```

| 定数/変数 | 定義場所 | 現在の値 |
|---|---|---|
| `DEFAULT_AI_MODEL` | `src/utils/aiSummary.ts:1` | `@cf/meta/llama-3.1-8b-instruct-fp8` |
| `AI_MODEL` | `wrangler secret` (環境変数) | 未設定時は `DEFAULT_AI_MODEL` にフォールバック |

## 設計: フォールバック付きパイプライン

### 概要

```
AI_MODEL (実験モデル) で要約試行
       │
       ├─ 成功 → そのまま使う (model = AI_MODEL の値を記録)
       └─ 失敗 (catch / [AI_*] プレフィックス)
              │
              ├─ AI_MODEL ≠ DEFAULT_AI_MODEL → DEFAULT_AI_MODEL で再試行
              │       │
              │       ├─ 成功 → 再試行結果を使う (model = DEFAULT_AI_MODEL を記録)
              │       └─ 失敗 → [AI_ERROR] 記録
              │
              └─ AI_MODEL = DEFAULT_AI_MODEL (同一) → 再試行しない → [AI_ERROR] 記録
```

### 変更対象ファイル

| ファイル | 変更内容 |
|---|---|
| `src/utils/aiSummary.ts` | `RunSummaryPipelineParams` に `fallbackModel?: string` 追加、`runSummaryPipeline` にフォールバック再試行ロジック追加、`SummaryPipelineResult` に `usedModel: string` 追加 |
| `src/index.ts` (L2648, L2687-2694) | `fallbackModel: DEFAULT_AI_MODEL` をパイプラインに渡す、D1記録の `model` を `pipelineResult.usedModel` に変更 |
| `src/utils/aiSummary.test.ts` | フォールバック成功/スキップ/両方失敗の3パターンのテスト追加 |

### 型変更

```typescript
// RunSummaryPipelineParams に追加
export type RunSummaryPipelineParams = {
  ai: AiBinding | null | undefined;
  model: string;
  fallbackModel?: string;  // 追加: 失敗時の再試行モデル
  title: string;
  description: string;
  trimmedDiff: string;
  designSpec?: string;
};

// SummaryPipelineResult に追加
export type SummaryPipelineResult = {
  summary: string;
  success: boolean;
  usedModel: string;  // 追加: 実際に使用されたモデル名
};
```

### runSummaryPipeline の変更イメージ

```typescript
export async function runSummaryPipeline(
  params: RunSummaryPipelineParams
): Promise<SummaryPipelineResult> {
  const { ai, model, fallbackModel, title, description, trimmedDiff, designSpec } = params;

  if (!ai) {
    return { summary: '[AI_NO_BINDING] Workers AI binding is not available', success: false, usedModel: model };
  }

  // 1回目: primary model で試行
  try {
    const summary = await generateAiSummary({ ai, model, title, description, trimmedDiff, designSpec });
    const success = !summary.startsWith('[AI_');
    if (success) {
      return { summary, success: true, usedModel: model };
    }
    // [AI_*] プレフィックス付きの失敗レスポンス → フォールバック判定へ
  } catch (error) {
    // catch → フォールバック判定へ
  }

  // 2回目: fallback model で再試行（primary と異なる場合のみ）
  if (fallbackModel && fallbackModel !== model) {
    try {
      const summary = await generateAiSummary({
        ai, model: fallbackModel, title, description, trimmedDiff, designSpec,
      });
      return { summary, success: !summary.startsWith('[AI_'), usedModel: fallbackModel };
    } catch (fallbackError) {
      const msg = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
      return { summary: `[AI_ERROR] fallback also failed: ${msg}`, success: false, usedModel: fallbackModel };
    }
  }

  // fallback なし or primary = fallback → エラー記録
  return { summary: '[AI_ERROR] primary model failed, no fallback available', success: false, usedModel: model };
}
```

### 呼び出し元 (index.ts) の変更イメージ

```typescript
// L2648
const aiModel = resolveAiModel(c.env.AI_MODEL);

// L2687-2694
const pipelineResult = await runSummaryPipeline({
  ai: ai as AiBinding | null,
  model: aiModel,
  fallbackModel: DEFAULT_AI_MODEL,  // 追加
  title,
  description,
  trimmedDiff,
  designSpec: DESIGN_SPEC_CHECKLIST,
});

// L2754: D1記録のmodelを実際に使用されたモデルに変更
// 変更前: aiModel
// 変更後: pipelineResult.usedModel
```

### D1 記録への影響

`ai_summary_log.model` カラムに記録される値が変わる:

| ケース | 記録される model 値 |
|---|---|
| AI_MODEL で成功 | `AI_MODEL` の値 (例: `@cf/openai/gpt-oss-120b`) |
| AI_MODEL で失敗 → DEFAULT で成功 | `DEFAULT_AI_MODEL` の値 (`@cf/meta/llama-3.1-8b-instruct-fp8`) |
| 両方失敗 | フォールバックモデル名 |
| AI_MODEL 未設定 | `DEFAULT_AI_MODEL` (primary = fallback で再試行なし) |

これにより `/status` の保存データモーダルや `/ai-summary/:id` ページで
「どのモデルで実際に要約されたか」が正確に確認できる。

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

2. デプロイ後、PRを作成してAI要約をトリガー
3. `/status` の `ai_summary_log` 保存データモーダルで `model` カラムを確認
   - 実験モデル名が入っていれば成功
   - `DEFAULT_AI_MODEL` の値が入っていればフォールバックが発動した
4. 実験モデルで安定動作を確認できたら `DEFAULT_AI_MODEL` の定数値を更新

### 実験モデルを解除して安定モデルのみに戻す方法

```
wrangler secret delete AI_MODEL
```

`AI_MODEL` を削除すると `resolveAiModel` が `DEFAULT_AI_MODEL` を返すため、
primary = fallback となり再試行なしの元の動作に戻る。

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

## 注意事項

- `AI_MODEL` は `wrangler secret put` で管理する。`wrangler.toml` の `[vars]` に書かない
- `DEFAULT_AI_MODEL` はソースコード内の定数。安定動作が確認されたモデルのみをここに設定する
- フォールバック発動時は Slack 通知や D1 ログから確認できる（`model` カラムの値が `DEFAULT_AI_MODEL` になる）
