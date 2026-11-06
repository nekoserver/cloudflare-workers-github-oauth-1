import { describe, it, expect } from 'vitest';
import {
  AICHAT_MODEL_MAX_TOKENS,
  AICHAT_MODEL_EXTRA_PARAMS,
  getModelRunParams,
  AICHAT_COLOR_PALETTE,
  assignModelColors,
  MUSE_ASKGK_MODEL,
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
  it('museは既存の割り当てがあっても青に固定される', () => {
    const { merged, newAssignments } = assignModelColors({ muse: '#ec4899' }, [MUSE_ASKGK_MODEL]);
    expect(merged.muse).toBe('#2563eb');
    expect(newAssignments).toEqual([{ model_id: 'muse', color: '#2563eb', label: 'muse' }]);
  });

  it('museの青は他モデルの自動割り当てに使われない', () => {
    const models = Array.from({ length: 40 }, (_, i) => ({ value: `m${i}`, label: `m${i}` }));
    const { merged } = assignModelColors({}, [MUSE_ASKGK_MODEL, ...models]);
    expect(Object.entries(merged).filter(([, color]) => color === '#2563eb').map(([id]) => id)).toEqual(['muse']);
  });

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

describe('claudeの色丸固定(オレンジ)', () => {
  // 対象: assignModelColors()のclaude専用の固定色ロジック。
  // 2026-10-08: 旧実装は「既に他モデルが同じ色を使っていたら衝突回避で
  // 別の色へ再割り当てする」設計だったため、通常のパレット循環で
  // #f97316を獲得していた別モデルが既存データにいる場合、claudeの
  // 固定色割り当てがその都度「衝突」とみなされて外れてしまい、
  // オレンジに統一されない不具合があった(ユーザー報告)。
  // claudeは他モデルとの衝突を一切考慮せず、常にオレンジを使う。
  it('claudeは常にオレンジ(#f97316)が割り当てられる', () => {
    const { merged, newAssignments } = assignModelColors({}, [{ value: 'claude', label: 'claude' }]);
    expect(merged.claude).toBe('#f97316');
    expect(newAssignments).toEqual([{ model_id: 'claude', color: '#f97316', label: 'claude' }]);
  });

  it('他モデルと混在していてもclaudeはオレンジになる(パレット循環の対象外)', () => {
    const { merged } = assignModelColors({}, [
      { value: 'model-a', label: 'Model A' },
      { value: 'claude', label: 'claude' },
      { value: 'model-b', label: 'Model B' },
    ]);
    expect(merged.claude).toBe('#f97316');
  });

  it('既にclaudeがオレンジ以外の色を持っていても常にオレンジへ上書きする(既存色より固定色を優先)', () => {
    const { merged, newAssignments } = assignModelColors({ claude: '#4f46e5' }, [{ value: 'claude', label: 'claude' }]);
    expect(merged.claude).toBe('#f97316');
    expect(newAssignments).toEqual([{ model_id: 'claude', color: '#f97316', label: 'claude' }]);
  });

  it('既にclaudeが正しくオレンジの場合はnewAssignmentsに入れない(無駄な再書き込みをしない)', () => {
    const { merged, newAssignments } = assignModelColors({ claude: '#f97316' }, [{ value: 'claude', label: 'claude' }]);
    expect(merged.claude).toBe('#f97316');
    expect(newAssignments).toHaveLength(0);
  });

  it('既に他モデルがオレンジを使っていてもclaudeは衝突を無視してオレンジになる(固定色は衝突回避の対象外)', () => {
    const { merged } = assignModelColors({ other: '#f97316' }, [{ value: 'claude', label: 'claude' }]);
    expect(merged.claude).toBe('#f97316');
    expect(merged.other).toBe('#f97316');
  });

  it('固定色(オレンジ)は固定色を持たない他モデルの新規パレット割り当てには使われない(予約される)', () => {
    const manyModels = Array.from({ length: AICHAT_COLOR_PALETTE.length }, (_, i) => ({ value: 'model-' + i, label: 'Model ' + i }));
    const { merged } = assignModelColors({}, manyModels);
    expect(Object.values(merged)).not.toContain('#f97316');
  });

  it('claude以外のモデル(codex等)はオレンジ固定の対象にならず通常のパレット循環を使う', () => {
    const { merged } = assignModelColors({}, [{ value: 'codex', label: 'codex' }]);
    expect(merged.codex).toBe(AICHAT_COLOR_PALETTE[0]);
  });
});

describe('Codexモデル色の重複防止', () => {
  // claudeは固定色(常にオレンジ)のため、この「パレットを使い切っていても
  // 重複させない」という衝突回避ロジックの対象はcodexのみ
  // (claude用の固定色テストはdescribe('claudeの色丸固定(オレンジ)')参照)。
  it('パレットを使い切っていてもcodexの色を重複させない', () => {
    const existing = Object.fromEntries(AICHAT_COLOR_PALETTE.map((color, index) => ['model-' + index, color]));
    const result = assignModelColors(existing, [{ value: 'codex', label: 'codex' }]);
    expect(Object.values(existing)).not.toContain(result.merged.codex);
    expect(result.merged.codex).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('既存のcodex色が他モデルと被る場合は再割り当てする', () => {
    const result = assignModelColors({ other: '#4f46e5', codex: '#4f46e5' }, [{ value: 'codex', label: 'codex' }]);
    expect(result.merged.codex).not.toBe(result.merged.other);
    expect(result.newAssignments).toHaveLength(1);
  });
  // claudeは固定色のため「他モデルと被ったら再割り当て」ではなく、常に
  // オレンジへ収束する(衝突していても他モデルから色を奪わない)。
  it('既存のclaude色が他モデルと被る場合もオレンジへ収束する(他モデルの色は変えない)', () => {
    const result = assignModelColors({ other: '#4f46e5', claude: '#4f46e5' }, [{ value: 'claude', label: 'claude' }]);
    expect(result.merged.claude).toBe('#f97316');
    expect(result.merged.other).toBe('#4f46e5');
  });
});
