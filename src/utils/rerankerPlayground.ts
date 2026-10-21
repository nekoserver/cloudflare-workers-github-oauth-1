/** Cloudflare Workers AI の cross-encoder リランカーを呼ぶ小さな試用API。 */
export const RERANKER_PLAYGROUND_MODEL = '@cf/baai/bge-reranker-base';
export const RERANKER_PLAYGROUND_MAX_CONTEXTS = 8;
export const RERANKER_PLAYGROUND_MAX_QUERY_LENGTH = 500;
export const RERANKER_PLAYGROUND_MAX_CONTEXT_LENGTH = 2000;

export type RerankerContext = { label: string; text: string };
export type RerankerAiBinding = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

export type RerankedContext = RerankerContext & { score: number; originalIndex: number };

/** 質問と候補文をモデルへ渡し、モデルの順位をラベル付き候補へ戻す。 */
export async function rerankPlaygroundContexts(
  ai: RerankerAiBinding,
  query: string,
  contexts: RerankerContext[],
): Promise<RerankedContext[]> {
  const raw: unknown = await ai.run(RERANKER_PLAYGROUND_MODEL, {
    query,
    contexts: contexts.map(({ text }) => ({ text })),
    top_k: contexts.length,
  });
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { response?: unknown }).response)) {
    throw new Error('reranker_response_invalid');
  }

  const ranked = (raw as { response: unknown[] }).response.map((item): RerankedContext => {
    if (!item || typeof item !== 'object') throw new Error('reranker_response_invalid');
    const result = item as { id?: unknown; score?: unknown };
    const index = typeof result.id === 'number' ? result.id : Number(result.id);
    if (!Number.isInteger(index) || index < 0 || index >= contexts.length
      || typeof result.score !== 'number' || !Number.isFinite(result.score)) {
      throw new Error('reranker_response_invalid');
    }
    return { ...contexts[index], score: result.score, originalIndex: index };
  });

  if (ranked.length !== contexts.length || new Set(ranked.map((item) => item.originalIndex)).size !== contexts.length) {
    throw new Error('reranker_response_invalid');
  }
  return ranked.sort((a, b) => b.score - a.score);
}

export function validateRerankerPlaygroundInput(value: unknown):
  | { ok: true; query: string; contexts: RerankerContext[] }
  | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'JSONオブジェクトを指定してください。' };
  const input = value as Record<string, unknown>;
  if (typeof input.query !== 'string' || !input.query.trim() || input.query.trim().length > RERANKER_PLAYGROUND_MAX_QUERY_LENGTH) {
    return { ok: false, error: `質問は1〜${RERANKER_PLAYGROUND_MAX_QUERY_LENGTH}文字で入力してください。` };
  }
  if (!Array.isArray(input.contexts) || input.contexts.length < 2 || input.contexts.length > RERANKER_PLAYGROUND_MAX_CONTEXTS) {
    return { ok: false, error: `候補文は2〜${RERANKER_PLAYGROUND_MAX_CONTEXTS}件にしてください。` };
  }

  const contexts: RerankerContext[] = [];
  for (const item of input.contexts) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, error: '各候補はlabelとtextを持つオブジェクトにしてください。' };
    const context = item as Record<string, unknown>;
    if (typeof context.label !== 'string' || !context.label.trim() || context.label.trim().length > 80
      || typeof context.text !== 'string' || !context.text.trim() || context.text.trim().length > RERANKER_PLAYGROUND_MAX_CONTEXT_LENGTH) {
      return { ok: false, error: `各候補のlabelは1〜80文字、textは1〜${RERANKER_PLAYGROUND_MAX_CONTEXT_LENGTH}文字で入力してください。` };
    }
    contexts.push({ label: context.label.trim(), text: context.text.trim() });
  }
  return { ok: true, query: input.query.trim(), contexts };
}
