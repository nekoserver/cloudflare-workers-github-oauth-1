export const CODEX_ASKGK_MODEL = { value: 'codex', label: 'codex' };

export const AICHAT_COLOR_PALETTE: readonly string[] = [
  '#4f46e5', // indigo
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#16a34a', // green
  '#22c55e', // light-green
  '#a855f7', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f43f5e', // rose
  '#84cc16', // lime
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#64748b', // slate
];

export function assignModelColors(
  existingColors: Record<string, string>,
  models: Array<{ value: string; label: string }>
): { merged: Record<string, string>; newAssignments: Array<{ model_id: string; color: string; label: string }> } {
  const usedColors = new Set(Object.values(existingColors).map(color => color.toLowerCase()));
  const merged: Record<string, string> = { ...existingColors };
  const newAssignments: Array<{ model_id: string; color: string; label: string }> = [];

  for (const model of models) {
    const codexColorConflict = model.value === 'codex' && merged.codex &&
      Object.entries(merged).some(([id, color]) => id !== 'codex' && color.toLowerCase() === merged.codex.toLowerCase());
    if (merged[model.value] && !codexColorConflict) continue;

    let color = AICHAT_COLOR_PALETTE.find(c => !usedColors.has(c));
    if (!color) {
      // パレットが埋まっていても既存モデルと同じ色を再利用しない。
      let candidate = 0x5b8def;
      do {
        color = '#' + candidate.toString(16).padStart(6, '0');
        candidate = (candidate + 0x3779b9) & 0xffffff;
      } while (usedColors.has(color));
    }

    merged[model.value] = color;
    usedColors.add(color);
    newAssignments.push({ model_id: model.value, color, label: model.label });
  }

  return { merged, newAssignments };
}

export const AICHAT_MODEL_MAX_TOKENS: Readonly<Record<string, number>> = {
  '@cf/google/gemma-4-26b-a4b-it': 65536,
  // パラメータ調整モーダルとサーバー側の上限を16384に引き上げる
  // (ユーザー指定、2026-10-04)。パラメータ未指定時もこの値を使う。
  '@cf/qwen/qwen3.8-27b': 16384,
};

/**
 * 既知の制限: gemma-4-26b-a4b-it は system message が含まれると
 * enable_thinking:false を無視して thinking mode を強制的に有効化し、
 * <think>タグではなく <|channel>...</channel|> 形式で推論過程を応答に
 * 混入させることがある（stripThinkTagsでは除去できない）。このためこのモデルを
 * デフォルトモデルとして使うと、system messageを付与するsystemPromptMode='a'
 * （既定値）でSlack応答等が壊れる場合がある。ユーザーが明示的に選択する分には
 * 許容するが、デフォルトモデルには採用しないこと。
 */
export const AICHAT_MODEL_EXTRA_PARAMS: Readonly<Record<string, Record<string, unknown>>> = {
  '@cf/google/gemma-4-26b-a4b-it': {
    chat_template_kwargs: { enable_thinking: false },
  },
};

export function getModelRunParams(
  model: string,
  base: Record<string, unknown>
): Record<string, unknown> {
  const extra = AICHAT_MODEL_EXTRA_PARAMS[model];
  return extra ? { ...base, ...extra } : base;
}

// AIチャットの色丸ドロップダウンから「パラメータ調整」モーダルを開ける対象
// モデル(ユーザー要望2026-10-03: よく使うGemma-4とQwenだけで良いとのこと)。
// 対象外のモデルに対してmaxTokens/temperatureが送られてきても無視する
// (resolveAichatRunOverrides参照)。
export const AICHAT_TUNABLE_MODELS: readonly string[] = [
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/qwen/qwen3.8-27b',
];

export function isAichatTunableModel(model: string): boolean {
  return AICHAT_TUNABLE_MODELS.includes(model);
}

// temperatureはWorkers AIのchat系モデルが受け付ける一般的な範囲(0〜2)に
// クランプする。範囲外の値をそのまま渡すとモデル側で400になる場合がある。
export const AICHAT_TEMPERATURE_MIN = 0;
export const AICHAT_TEMPERATURE_MAX = 2;

export type AichatRunOverrides = { maxTokens?: unknown; temperature?: unknown };
export type AichatResolvedRunParams = { maxTokens: number; temperature?: number };

/**
 * パラメータ調整モーダルから送られてきたmaxTokens/temperatureを、対象
 * モデル(AICHAT_TUNABLE_MODELS)に限って適用する。
 * - 対象外のモデルの場合はoverridesを一切見ず、デフォルトのmaxTokensだけを返す
 *   (他モデルへパラメータ調整機能が及ばないようにする)。
 * - maxTokensはデフォルト値(AICHAT_MODEL_MAX_TOKENS[model])を上限として
 *   クランプする(ユーザーがデフォルトより大きい値を指定して、サーバー側の
 *   コスト・レイテンシ上限を超えさせないため)。下限は1。
 * - temperatureは0〜2にクランプする。
 * - 数値として不正な値(NaN・文字列・未指定)は無視し、デフォルトのまま扱う。
 */
export function resolveAichatRunOverrides(
  model: string,
  defaultMaxTokens: number,
  overrides: AichatRunOverrides
): AichatResolvedRunParams {
  if (!isAichatTunableModel(model)) return { maxTokens: defaultMaxTokens };

  let maxTokens = defaultMaxTokens;
  if (typeof overrides.maxTokens === 'number' && Number.isFinite(overrides.maxTokens)) {
    maxTokens = Math.min(defaultMaxTokens, Math.max(1, Math.floor(overrides.maxTokens)));
  }

  let temperature: number | undefined;
  if (typeof overrides.temperature === 'number' && Number.isFinite(overrides.temperature)) {
    temperature = Math.min(AICHAT_TEMPERATURE_MAX, Math.max(AICHAT_TEMPERATURE_MIN, overrides.temperature));
  }

  return temperature === undefined ? { maxTokens } : { maxTokens, temperature };
}
