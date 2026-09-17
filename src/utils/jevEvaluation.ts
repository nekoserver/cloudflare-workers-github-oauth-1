export type JevLabel = { id: number; question_text: string };

export type JevScoreResult = { labelId: number; value: number };

export type JevEvaluationPlan = {
  pending: JevLabel[];
  cached: JevScoreResult[];
};

/**
 * 全ラベルのうち、まだ評価済みでないものだけをpendingとして返す。
 * 既に評価済みのものはJevへ再送しない(重複呼び出し・重複課金の防止)。
 */
export function computeJevEvaluationPlan(
  allLabels: JevLabel[],
  evaluatedRows: { jev_label_id: number; value: number }[],
): JevEvaluationPlan {
  const evaluated = new Map<number, number>();
  for (const row of evaluatedRows) evaluated.set(row.jev_label_id, row.value);

  const pending: JevLabel[] = [];
  const cached: JevScoreResult[] = [];
  for (const label of allLabels) {
    if (evaluated.has(label.id)) {
      cached.push({ labelId: label.id, value: evaluated.get(label.id) as number });
    } else {
      pending.push(label);
    }
  }
  return { pending, cached };
}

export function buildJevRequestBody(state: string, labels: JevLabel[]) {
  return {
    model: 'jev-latest',
    state,
    questions: labels.map((label) => ({ type: 'score' as const, question: label.question_text })),
  };
}

export type JevApiResult =
  | { ok: true; scores: JevScoreResult[] }
  | { ok: false; errorCode: 'http_error' | 'invalid_json' | 'unexpected_shape' | 'length_mismatch'; detail: string };

/**
 * Jevのレスポンス(質問の並び順=labelsの並び順で1件ずつ値が返る想定)を
 * labelIdに結び付ける。文字列prefixでの判定はせず、常にこの判別可能な
 * 戻り値型(JevApiResult)で成否を表現する(ルール32)。
 */
export function parseJevApiResponse(labels: JevLabel[], json: unknown): JevApiResult {
  if (labels.length === 0) return { ok: true, scores: [] };
  if (json === null || typeof json !== 'object') {
    return { ok: false, errorCode: 'unexpected_shape', detail: 'レスポンスがオブジェクトではありません' };
  }
  const answers = (json as { answers?: unknown }).answers;
  if (!Array.isArray(answers)) {
    return { ok: false, errorCode: 'unexpected_shape', detail: 'answers配列がレスポンスに含まれていません' };
  }
  if (answers.length !== labels.length) {
    return {
      ok: false,
      errorCode: 'length_mismatch',
      detail: `送信した質問数(${labels.length})とレスポンスの件数(${answers.length})が一致しません`,
    };
  }

  const scores: JevScoreResult[] = [];
  for (let i = 0; i < labels.length; i++) {
    const entry = answers[i];
    const value = extractScoreValue(entry);
    if (value === null) {
      return {
        ok: false,
        errorCode: 'unexpected_shape',
        detail: `answers[${i}]から数値のscoreを取り出せませんでした`,
      };
    }
    scores.push({ labelId: labels[i].id, value });
  }
  return { ok: true, scores };
}

function extractScoreValue(entry: unknown): number | null {
  if (typeof entry === 'number' && Number.isFinite(entry)) return entry;
  if (entry !== null && typeof entry === 'object') {
    const obj = entry as Record<string, unknown>;
    for (const key of ['score', 'value', 'probability']) {
      const v = obj[key];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
  }
  return null;
}

export type JevFetch = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

/**
 * Jev(TypeSafe AI System One Model) API呼び出し。fetch実装を注入できるようにし、
 * 実際のネットワークアクセスをテストで発生させない。
 */
export async function callJevApi(params: {
  apiKey: string;
  state: string;
  labels: JevLabel[];
  fetchImpl: JevFetch;
}): Promise<JevApiResult> {
  const { apiKey, state, labels, fetchImpl } = params;
  if (labels.length === 0) return { ok: true, scores: [] };

  let response;
  try {
    response = await fetchImpl('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildJevRequestBody(state, labels)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, errorCode: 'http_error', detail: `Jev APIへのリクエストに失敗しました: ${message}` };
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    return {
      ok: false,
      errorCode: 'http_error',
      detail: `Jev APIがステータス${response.status}を返しました: ${bodyText.slice(0, 500)}`,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, errorCode: 'invalid_json', detail: `Jev APIのレスポンスJSON解析に失敗しました: ${message}` };
  }

  return parseJevApiResponse(labels, json);
}
