import { parseJevApiResponse, type JevLabel, type JevApiResult } from './jevEvaluation';

// Jevのラベル(JevLabel、jev_labels由来)をClef(Cloudflare Workers AI決定モデル)で
// 評価するための変換・呼び出し。PLAN.cloudflare-workers-github-oauth-1.20261011.
// judgment-models.mdのステップ②(既存のjev_evaluations・既存6箇所のJev呼び出しには
// 一切影響しない、新規追加のみ)。
//
// 2026-10-11、/clef-playground実機確認で判明した仕様(詳細は
// NOTICE.cloudflare-workers-github-oauth-1.20261011.md参照)を踏襲する:
// - 質問テキストは`question`ではなく`instructions`フィールドで渡す
// - `criteria`(score型、順序付き配列)はJevのcriteria([0側, 1側]の2要素配列)と
//   同じ形式・同じ並び順(最低レベルが先)のため、変換せずそのまま使える
// - input.modelはカタログの完全なIDではなく短い名前(clef/clef-flash)が必須
//
// レスポンス解析は、既存のparseJevApiResponse(jevEvaluation.ts)をそのまま再利用する。
// Clefのscore型回答(answers[id].score)は、parseJevApiResponseが探す
// score/value/probabilityの最初の候補(score)と偶然一致しており、
// Jev/Clefどちらの{answers: {<id>: {...}}}形のレスポンスも同じロジックで解析できる。

export const CLEF_SCORE_MODELS = ['@cf/cloudflare/clef', '@cf/cloudflare/clef-flash'] as const;
export type ClefScoreModel = (typeof CLEF_SCORE_MODELS)[number];
export const DEFAULT_CLEF_SCORE_MODEL: ClefScoreModel = '@cf/cloudflare/clef-flash';

export type ClefScoreAiBinding = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

/**
 * JevLabel[]をClefのquestionsオブジェクト({<質問ID>: {type, instructions, criteria}})へ
 * 変換する。質問IDはlabel.idの文字列化(callJevApiのbuildJevRequestBodyと同じ方式)。
 */
export function buildClefScoreQuestions(labels: JevLabel[]): Record<string, unknown> {
  const questions: Record<string, unknown> = {};
  for (const label of labels) {
    questions[String(label.id)] = {
      type: 'score',
      instructions: label.question_text,
      criteria: label.criteria,
    };
  }
  return questions;
}

/**
 * Clef(Workers AI決定モデル)呼び出し。fetch実装の注入(callJevApi)の代わりに、
 * Workers AIバインディング(env.AI)を注入する(テストでは本物のai.run()を
 * 発生させない)。戻り値はcallJevApiと同じJevApiResultの形を保つ
 * (呼び出し元がJev/Clefの違いを気にせず使えるようにするため)。
 */
export async function callClefScoreApi(params: {
  ai: ClefScoreAiBinding;
  state: string;
  labels: JevLabel[];
  model?: ClefScoreModel;
}): Promise<JevApiResult> {
  const { ai, state, labels } = params;
  if (labels.length === 0) return { ok: true, scores: [] };

  const model = params.model ?? DEFAULT_CLEF_SCORE_MODEL;
  const shortModel = model.replace(/^@cf\/cloudflare\//, '');

  let json: unknown;
  try {
    json = await ai.run(model, {
      model: shortModel,
      state,
      questions: buildClefScoreQuestions(labels),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, errorCode: 'http_error', detail: `Clef呼び出しに失敗しました: ${message}` };
  }

  return parseJevApiResponse(labels, json);
}
