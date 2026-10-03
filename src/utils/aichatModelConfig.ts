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
  const usedColors = new Set(Object.values(existingColors));
  const merged: Record<string, string> = { ...existingColors };
  const newAssignments: Array<{ model_id: string; color: string; label: string }> = [];

  for (const model of models) {
    if (merged[model.value]) continue;

    const color =
      AICHAT_COLOR_PALETTE.find(c => !usedColors.has(c)) ??
      AICHAT_COLOR_PALETTE[newAssignments.length % AICHAT_COLOR_PALETTE.length];

    merged[model.value] = color;
    usedColors.add(color);
    newAssignments.push({ model_id: model.value, color, label: model.label });
  }

  return { merged, newAssignments };
}

export const AICHAT_MODEL_MAX_TOKENS: Readonly<Record<string, number>> = {
  '@cf/google/gemma-4-26b-a4b-it': 65536,
  // 以前は4096にしていたが、AIチャットページで応答が見切れる(途中で
  // 打ち切られる)と報告された。このモデルはデフォルトでreasoning
  // (thinking)が強めに働き、最終回答の前に消費される思考トークンが
  // 多いため、4096では最終回答まで届かない場合がある。Cloudflare側の
  // 実際の上限はこの環境からdevelopers.cloudflare.comへ直接アクセスできず
  // 未確認のため、まずは倍の8192へ上げた(ユーザー確認済み、2026-10-03)。
  // これでも見切れる場合や400エラーになる場合は、実際のCloudflare
  // モデルページの値を確認して調整すること。
  '@cf/qwen/qwen3.8-27b': 8192,
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
