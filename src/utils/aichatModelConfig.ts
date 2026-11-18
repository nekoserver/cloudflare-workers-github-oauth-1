export const CODEX_ASKGK_MODEL = { value: 'codex', label: 'codex' };
export const CLAUDE_ASKGK_MODEL = { value: 'claude', label: 'claude' };
export const MUSE_ASKGK_MODEL = { value: 'muse', label: 'muse' };

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

/**
 * 特定モデルに固定で割り当てる色。パレットの自動循環より優先し、かつ
 * 他モデルとの「色の衝突回避」の対象からも除外する(ユーザー指定、
 * 2026-10-07: claude用の色丸はオレンジにする)。
 *
 * 旧実装は「他モデルが既にこの色を使っていたら衝突回避でパレット循環に
 * フォールバックする」という設計だったが、通常のパレット循環で既に
 * 別のモデル(llama系等)が#f97316を獲得していた場合、claudeの固定色
 * 割り当てそのものが「衝突」とみなされて毎回パレット循環側へ弾かれて
 * しまい、オレンジに統一されない不具合があった(2026-10-07報告)。
 * この関数ではFIXED_MODEL_COLORSの値を(1)通常のパレット循環からは
 * 常に除外し(他モデルがこの色を新規に獲得できないようにする)、
 * (2)固定色モデル自身は衝突判定を行わず常にこの色を使う、という
 * 2点で対処する。
 */
const FIXED_MODEL_COLORS: Readonly<Record<string, string>> = {
  claude: '#f97316', // オレンジ
  muse: '#2563eb', // 青(ユーザー指定、2026-11-06)
  '@cf/deepseek-ai/deepseek-v4.1-flash-1017': '#14b8a6', // ティール
};

const FIXED_MODEL_COLOR_VALUES = new Set(
  Object.values(FIXED_MODEL_COLORS).map((c) => c.toLowerCase())
);

export function assignModelColors(
  existingColors: Record<string, string>,
  models: Array<{ value: string; label: string }>
): { merged: Record<string, string>; newAssignments: Array<{ model_id: string; color: string; label: string }> } {
  const usedColors = new Set(Object.values(existingColors).map(color => color.toLowerCase()));
  const merged: Record<string, string> = { ...existingColors };
  const newAssignments: Array<{ model_id: string; color: string; label: string }> = [];

  for (const model of models) {
    const fixedColor = FIXED_MODEL_COLORS[model.value];

    if (fixedColor) {
      // 固定色モデルは衝突判定をせず常にこの色を使う。既に正しい値なら
      // 何もしない(newAssignmentsにも入れない)。
      if (merged[model.value]?.toLowerCase() === fixedColor.toLowerCase()) continue;
      merged[model.value] = fixedColor;
      usedColors.add(fixedColor.toLowerCase());
      newAssignments.push({ model_id: model.value, color: fixedColor, label: model.label });
      continue;
    }

    // codexは固定色を持たないが、CLIモデルとして過去に他モデルと色が
    // 衝突した場合のみ再割り当てする(既存の挙動を維持)。
    const cliColorConflict = model.value === 'codex' && merged[model.value] &&
      Object.entries(merged).some(([id, color]) => id !== model.value && color.toLowerCase() === merged[model.value].toLowerCase());
    if (merged[model.value] && !cliColorConflict) continue;

    // 固定色として予約されている値は、固定色を持たない他モデルには割り当てない。
    let color = AICHAT_COLOR_PALETTE.find(c => !usedColors.has(c) && !FIXED_MODEL_COLOR_VALUES.has(c.toLowerCase()));
    if (!color) {
      // パレットが埋まっていても既存モデルと同じ色・固定色を再利用しない。
      let candidate = 0x5b8def;
      do {
        color = '#' + candidate.toString(16).padStart(6, '0');
        candidate = (candidate + 0x3779b9) & 0xffffff;
      } while (usedColors.has(color) || FIXED_MODEL_COLOR_VALUES.has(color));
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
  '@cf/deepseek-ai/deepseek-v4.1-flash-1017': {
    reasoning_effort: 'high',
  },
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
