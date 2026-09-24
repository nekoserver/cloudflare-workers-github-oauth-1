export type JevLabel = { id: number; question_text: string; criteria: string[] };

/**
 * jev_labels.options_jsonから、Jev API送信用のcriteria(0側/1側の説明2要素配列)を
 * 取り出す。実測したJev APIの仕様で`criteria`は文字列ではなくlistが必須
 * (HTTP 422 "Input should be a valid list"で判明)なため、不正な形式は
 * nullを返して呼び出し元に判断を委ねる(黙って空配列などで誤魔化さない)。
 */
export function parseLabelCriteria(optionsJson: string | null): string[] | null {
  if (!optionsJson) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(optionsJson);
  } catch {
    return null;
  }
  if (Array.isArray(parsed) && parsed.length === 2 && parsed.every((v) => typeof v === 'string')) {
    return parsed;
  }
  return null;
}

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

/**
 * Jev APIの`questions`は配列ではなく、質問ID(ここではjev_labels.idの文字列化)を
 * キーにした辞書(オブジェクト)を要求する
 * (実測: 配列で送るとHTTP 422 "Input should be a valid dictionary")。
 * score型の質問には`criteria`(0側/1側の説明を2要素の配列で)が必須
 * (実測: 無いとHTTP 422 "Field required"、文字列で送るとHTTP 422
 * "Input should be a valid list")。
 */
export function buildJevRequestBody(state: string, labels: JevLabel[]) {
  const questions: Record<string, { type: 'score'; question: string; criteria: string[] }> = {};
  for (const label of labels) {
    questions[String(label.id)] = { type: 'score', question: label.question_text, criteria: label.criteria };
  }
  return {
    model: 'jev-latest',
    state,
    questions,
  };
}

export type JevApiResult =
  | { ok: true; scores: JevScoreResult[] }
  | { ok: false; errorCode: 'http_error' | 'invalid_json' | 'unexpected_shape'; detail: string };

/**
 * Jevのレスポンス(answersも質問IDをキーにした辞書で返る想定)をlabelIdに
 * 結び付ける。文字列prefixでの判定はせず、常にこの判別可能な戻り値型
 * (JevApiResult)で成否を表現する(ルール32)。
 */
export function parseJevApiResponse(labels: JevLabel[], json: unknown): JevApiResult {
  if (labels.length === 0) return { ok: true, scores: [] };
  if (json === null || typeof json !== 'object') {
    return { ok: false, errorCode: 'unexpected_shape', detail: 'レスポンスがオブジェクトではありません' };
  }
  const answers = (json as { answers?: unknown }).answers;
  if (answers === null || typeof answers !== 'object' || Array.isArray(answers)) {
    return { ok: false, errorCode: 'unexpected_shape', detail: 'answersが辞書(オブジェクト)ではありません' };
  }
  const answersObj = answers as Record<string, unknown>;

  const scores: JevScoreResult[] = [];
  for (const label of labels) {
    const key = String(label.id);
    if (!(key in answersObj)) {
      return { ok: false, errorCode: 'unexpected_shape', detail: `answersに質問ID ${key} の結果が含まれていません` };
    }
    const value = extractScoreValue(answersObj[key]);
    if (value === null) {
      return { ok: false, errorCode: 'unexpected_shape', detail: `answers[${key}]から数値のscoreを取り出せませんでした` };
    }
    scores.push({ labelId: label.id, value });
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

/**
 * /ai-cacheの左サイドパネルの質問文リストで、既にJev評価済みの回答を
 * 緑背景にするためのフラグを付与する。qsearch-externalのレスポンス組み立てで使う。
 */
export function attachJevResultFlags<T extends { id: string }>(
  items: T[],
  evaluatedShareIds: ReadonlySet<string>,
): (T & { hasJevResult: boolean })[] {
  return items.map((item) => ({ ...item, hasJevResult: evaluatedShareIds.has(item.id) }));
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
