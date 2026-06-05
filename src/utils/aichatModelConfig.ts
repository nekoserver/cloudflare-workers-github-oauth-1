export const AICHAT_MODEL_MAX_TOKENS: Readonly<Record<string, number>> = {
  '@cf/google/gemma-4-26b-a4b-it': 16384,
};

export const AICHAT_MODEL_EXTRA_PARAMS: Readonly<Record<string, Record<string, unknown>>> = {
  '@cf/google/gemma-4-26b-a4b-it': {
    chat_template_kwargs: { enable_thinking: false },
    reasoning_effort: 'none',
  },
};

export function getModelRunParams(
  model: string,
  base: Record<string, unknown>
): Record<string, unknown> {
  const extra = AICHAT_MODEL_EXTRA_PARAMS[model];
  return extra ? { ...base, ...extra } : base;
}
