import { describe, it, expect } from 'vitest';
import {
  AICHAT_MODEL_MAX_TOKENS,
  AICHAT_MODEL_EXTRA_PARAMS,
  getModelRunParams,
  AICHAT_COLOR_PALETTE,
  assignModelColors,
  AICHAT_TUNABLE_MODELS,
  isAichatTunableModel,
  resolveAichatRunOverrides,
} from './aichatModelConfig';

describe('AICHAT_COLOR_PALETTE', () => {
  it('パレットに16色以上の色が定義されている', () => {
    expect(AICHAT_COLOR_PALETTE.length).toBeGreaterThanOrEqual(16);
  });

  it('パレット内に重複した色がない', () => {
    const unique = new Set(AICHAT_COLOR_PALETTE);
    expect(unique.size).toBe(AICHAT_COLOR_PALETTE.length);
  });

  it('各色が # で始まる有効な16進数カラーコードである', () => {
    for (const c of AICHAT_COLOR_PALETTE) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('assignModelColors', () => {
  const MODELS = [
    { value: 'model-a', label: 'Model A' },
    { value: 'model-b', label: 'Model B' },
    { value: 'model-c', label: 'Model C' },
  ];

  it('未割り当てモデルに色を付与する', () => {
    const { merged, newAssignments } = assignModelColors({}, MODELS);
    expect(Object.keys(merged).length).toBe(3);
    expect(newAssignments.length).toBe(3);
  });

  it('既存の色を持つモデルはスキップされる', () => {
    const existing = { 'model-a': '#ff0000' };
    const { merged, newAssignments } = assignModelColors(existing, MODELS);
    expect(merged['model-a']).toBe('#ff0000');
    expect(newAssignments.length).toBe(2);
    expect(newAssignments.find(a => a.model_id === 'model-a')).toBeUndefined();
  });

  it('割り当てる色は既存使用色と被らない', () => {
    const usedColors = AICHAT_COLOR_PALETTE.slice(0, 3);
    const existing: Record<string, string> = {};
    usedColors.forEach((c, i) => { existing[`used-${i}`] = c; });
    const { newAssignments } = assignModelColors(existing, MODELS);
    const usedSet = new Set(usedColors);
    for (const a of newAssignments) {
      expect(usedSet.has(a.color)).toBe(false);
    }
  });

  it('新規割り当て同士で色が重複しない', () => {
    const { newAssignments } = assignModelColors({}, MODELS);
    const colors = newAssignments.map(a => a.color);
    const unique = new Set(colors);
    expect(unique.size).toBe(colors.length);
  });

  it('newAssignments に model_id, color, label が含まれる', () => {
    const { newAssignments } = assignModelColors({}, [MODELS[0]]);
    expect(newAssignments[0].model_id).toBe('model-a');
    expect(newAssignments[0].label).toBe('Model A');
    expect(typeof newAssignments[0].color).toBe('string');
  });

  it('全モデルに既存色がある場合は newAssignments が空', () => {
    const existing = { 'model-a': '#aaa', 'model-b': '#bbb', 'model-c': '#ccc' };
    const { newAssignments } = assignModelColors(existing, MODELS);
    expect(newAssignments.length).toBe(0);
  });

  it('パレットを使い切った場合もクラッシュせずフォールバックする', () => {
    const manyModels = Array.from({ length: AICHAT_COLOR_PALETTE.length + 3 }, (_, i) => ({
      value: `model-${i}`,
      label: `Model ${i}`,
    }));
    expect(() => assignModelColors({}, manyModels)).not.toThrow();
    const { newAssignments } = assignModelColors({}, manyModels);
    expect(newAssignments.length).toBe(manyModels.length);
  });
});

describe('AICHAT_MODEL_MAX_TOKENS', () => {
  it('Gemma-4 は 65536 トークンを返す（thinking モード対応のため大きめに確保）', () => {
    expect(AICHAT_MODEL_MAX_TOKENS['@cf/google/gemma-4-26b-a4b-it']).toBe(65536);
  });

  it('未設定モデルは undefined を返す（呼び出し元でフォールバック）', () => {
    expect(AICHAT_MODEL_MAX_TOKENS['@cf/meta/llama-3.3-70b-instruct-fp8-fast']).toBeUndefined();
  });

  it('qwen3.8-27b のパラメータ調整上限は 16384 トークン', () => {
    expect(AICHAT_MODEL_MAX_TOKENS['@cf/qwen/qwen3.8-27b']).toBe(16384);
  });
});

describe('AICHAT_MODEL_EXTRA_PARAMS', () => {
  it('Gemma-4 に enable_thinking: false が設定されている', () => {
    const params = AICHAT_MODEL_EXTRA_PARAMS['@cf/google/gemma-4-26b-a4b-it'];
    expect(params).toBeDefined();
    expect((params.chat_template_kwargs as Record<string, unknown>)?.enable_thinking).toBe(false);
  });

  it('Gemma-4 に reasoning_effort は設定されていない（仕様外のため除去）', () => {
    const params = AICHAT_MODEL_EXTRA_PARAMS['@cf/google/gemma-4-26b-a4b-it'];
    expect(params?.reasoning_effort).toBeUndefined();
  });

  it('Gemma-3 には extra params が設定されていない', () => {
    expect(AICHAT_MODEL_EXTRA_PARAMS['@cf/google/gemma-3-12b-it']).toBeUndefined();
  });

  it('Llama 系モデルには extra params が設定されていない', () => {
    expect(AICHAT_MODEL_EXTRA_PARAMS['@cf/meta/llama-3.3-70b-instruct-fp8-fast']).toBeUndefined();
  });
});

describe('getModelRunParams', () => {
  it('Gemma-4 は base params に extra params をマージして返す', () => {
    const base = { messages: [], max_tokens: 65536 };
    const result = getModelRunParams('@cf/google/gemma-4-26b-a4b-it', base);
    expect(result.max_tokens).toBe(65536);
    expect(result.reasoning_effort).toBeUndefined();
    expect((result.chat_template_kwargs as Record<string, unknown>)?.enable_thinking).toBe(false);
  });

  it('extra params のないモデルは base params をそのまま返す', () => {
    const base = { messages: [], max_tokens: 4096 };
    const result = getModelRunParams('@cf/meta/llama-3.3-70b-instruct-fp8-fast', base);
    expect(result).toEqual(base);
    expect(result.reasoning_effort).toBeUndefined();
  });

  it('extra params が base params を上書きしない（base が優先されるべきキーは残る）', () => {
    const base = { messages: [{ role: 'user', content: 'test' }], max_tokens: 65536 };
    const result = getModelRunParams('@cf/google/gemma-4-26b-a4b-it', base);
    expect(result.messages).toEqual(base.messages);
  });
});

describe('AICHAT_TUNABLE_MODELS / isAichatTunableModel', () => {
  it('Gemma-4とQwenの2モデルだけがパラメータ調整の対象', () => {
    expect(AICHAT_TUNABLE_MODELS).toEqual(['@cf/google/gemma-4-26b-a4b-it', '@cf/qwen/qwen3.8-27b']);
    expect(isAichatTunableModel('@cf/google/gemma-4-26b-a4b-it')).toBe(true);
    expect(isAichatTunableModel('@cf/qwen/qwen3.8-27b')).toBe(true);
    expect(isAichatTunableModel('@cf/meta/llama-3.3-70b-instruct-fp8-fast')).toBe(false);
  });
});

describe('resolveAichatRunOverrides', () => {
  it('対象外モデルはoverridesを無視し、デフォルトのmaxTokensだけを返す', () => {
    const result = resolveAichatRunOverrides('@cf/meta/llama-3.3-70b-instruct-fp8-fast', 4096, {
      maxTokens: 100,
      temperature: 1.5,
    });
    expect(result).toEqual({ maxTokens: 4096 });
  });

  it('対象モデルは有効な範囲内のmaxTokens/temperatureをそのまま適用する', () => {
    const result = resolveAichatRunOverrides('@cf/qwen/qwen3.8-27b', 8192, {
      maxTokens: 2048,
      temperature: 0.7,
    });
    expect(result).toEqual({ maxTokens: 2048, temperature: 0.7 });
  });

  it('maxTokensはデフォルト値を超える指定をデフォルト値へクランプする（コスト・レイテンシ上限を超えさせない）', () => {
    const result = resolveAichatRunOverrides('@cf/qwen/qwen3.8-27b', 8192, { maxTokens: 999999 });
    expect(result.maxTokens).toBe(8192);
  });

  it('maxTokensは1未満の指定を1へクランプする', () => {
    const result = resolveAichatRunOverrides('@cf/qwen/qwen3.8-27b', 8192, { maxTokens: -5 });
    expect(result.maxTokens).toBe(1);
  });

  it('temperatureは0〜2の範囲外を境界値へクランプする', () => {
    expect(resolveAichatRunOverrides('@cf/qwen/qwen3.8-27b', 8192, { temperature: -1 }).temperature).toBe(0);
    expect(resolveAichatRunOverrides('@cf/qwen/qwen3.8-27b', 8192, { temperature: 5 }).temperature).toBe(2);
  });

  it('不正な値（文字列・NaN・未指定）はデフォルトのまま扱い、エラーにしない', () => {
    expect(resolveAichatRunOverrides('@cf/qwen/qwen3.8-27b', 8192, {})).toEqual({ maxTokens: 8192 });
    expect(
      resolveAichatRunOverrides('@cf/qwen/qwen3.8-27b', 8192, { maxTokens: 'abc', temperature: NaN })
    ).toEqual({ maxTokens: 8192 });
  });
});

describe('Codexモデル色の重複防止', () => {
  it('パレットを使い切っていてもCodexの色を重複させない', () => {
    const existing = Object.fromEntries(AICHAT_COLOR_PALETTE.map((color, index) => ['model-' + index, color]));
    const result = assignModelColors(existing, [{ value: 'codex', label: 'codex' }]);
    expect(Object.values(existing)).not.toContain(result.merged.codex);
    expect(result.merged.codex).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('既存のCodex色が他モデルと被る場合はCodexだけ再割り当てする', () => {
    const result = assignModelColors({ other: '#4f46e5', codex: '#4f46e5' }, [{ value: 'codex', label: 'codex' }]);
    expect(result.merged.codex).not.toBe(result.merged.other);
    expect(result.newAssignments).toHaveLength(1);
  });
});
