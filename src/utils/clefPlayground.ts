// Cloudflare Workers AIのClef(決定モデル)プレイグラウンド用。
// Clefは「Jev互換」(state+questions、質問type=noul/choice/scoreが同じ形)を
// 公式に名乗っているため、既存のJev Playground(validateJevPlaygroundPayload、
// src/index.ts)のリクエスト検証をそのまま使い、ここではモデルIDの解決と
// env.AI.run呼び出しだけを担う。

/** Workers AIカタログに存在するClef系モデルID(2026-10時点)。 */
export const CLEF_PLAYGROUND_MODELS = [
  '@cf/cloudflare/clef',
  '@cf/cloudflare/clef-flash',
  '@cf/cloudflare/clef-omni',
] as const;

export type ClefPlaygroundModel = (typeof CLEF_PLAYGROUND_MODELS)[number];

/** 既定モデル。レイテンシ・コストが低いclef-flashを試用のデフォルトにする。 */
export const DEFAULT_CLEF_MODEL: ClefPlaygroundModel = '@cf/cloudflare/clef-flash';

/**
 * リクエストのmodel指定を検証する。CLEF_PLAYGROUND_MODELSに無い値
 * (未指定・誤記・他モデルのID等)は既定モデルへフォールバックする
 * (存在しないモデルIDをそのままenv.AI.run()へ渡して例外にしない)。
 */
export function resolveClefPlaygroundModel(model: unknown): ClefPlaygroundModel {
  return typeof model === 'string' && (CLEF_PLAYGROUND_MODELS as readonly string[]).includes(model)
    ? (model as ClefPlaygroundModel)
    : DEFAULT_CLEF_MODEL;
}

export type ClefAiBinding = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

export type ClefPlaygroundOutcome =
  | { ok: true; model: ClefPlaygroundModel; result: unknown }
  | { ok: false; errorDetail: string };

/**
 * ai.run()の成功結果をHTTPレスポンス本文用のオブジェクトに整形する。
 * 呼び出したmodel名を先頭に付け、result自体がオブジェクトならそのフィールドを
 * 展開し、オブジェクトでない場合(文字列・配列等)は{result: ...}へ包む。
 * /api/clef-playground・/api/clef-playground-externalの両方で使う。
 */
export function buildClefPlaygroundResponseBody(outcome: { model: ClefPlaygroundModel; result: unknown }): Record<string, unknown> {
  const resultFields = typeof outcome.result === 'object' && outcome.result !== null
    ? outcome.result as Record<string, unknown>
    : { result: outcome.result };
  return { model: outcome.model, ...resultFields };
}

/**
 * 検証済みpayload({state, questions, model?})からmodelを解決し、
 * env.AI.run(model, {state, questions})を呼ぶ。失敗はerrorDetailに
 * メッセージを入れて返す(呼び出し元でログ記録・HTTPステータス決定を行う)。
 */
export async function callClefPlaygroundModel(
  ai: ClefAiBinding,
  payload: Record<string, unknown>
): Promise<ClefPlaygroundOutcome> {
  const model = resolveClefPlaygroundModel(payload.model);
  const { model: _model, ...input } = payload;
  try {
    const result = await ai.run(model, input);
    return { ok: true, model, result };
  } catch (error) {
    return { ok: false, errorDetail: error instanceof Error ? error.message : String(error) };
  }
}
