import { describe, expect, it } from 'vitest';
import {
  attachJevResultFlags,
  buildJevRequestBody,
  callJevApi,
  computeJevEvaluationPlan,
  parseJevApiResponse,
  type JevLabel,
} from './utils/jevEvaluation';

const labels: JevLabel[] = [
  { id: 1, question_text: '事実性(0=事実誤認がある, 1=事実として正しい)' },
  { id: 2, question_text: '根拠(0=根拠・出典が不足, 1=根拠が明示されている)' },
];

describe('computeJevEvaluationPlan', () => {
  it('未評価のラベルだけをpendingに、評価済みはcachedに振り分ける', () => {
    const plan = computeJevEvaluationPlan(labels, [{ jev_label_id: 1, value: 0.8 }]);
    expect(plan.pending).toEqual([labels[1]]);
    expect(plan.cached).toEqual([{ labelId: 1, value: 0.8 }]);
  });

  it('全て未評価ならpendingが全ラベル、cachedは空', () => {
    const plan = computeJevEvaluationPlan(labels, []);
    expect(plan.pending).toEqual(labels);
    expect(plan.cached).toEqual([]);
  });

  it('全て評価済みならpendingは空(Jevへ再送しない)', () => {
    const plan = computeJevEvaluationPlan(labels, [
      { jev_label_id: 1, value: 0.8 },
      { jev_label_id: 2, value: 0.3 },
    ]);
    expect(plan.pending).toEqual([]);
    expect(plan.cached).toHaveLength(2);
  });

  it('ラベルが0件なら常に空のplanを返す', () => {
    const plan = computeJevEvaluationPlan([], [{ jev_label_id: 1, value: 0.8 }]);
    expect(plan.pending).toEqual([]);
    expect(plan.cached).toEqual([]);
  });
});

describe('buildJevRequestBody', () => {
  it('questionsをラベルIDをキーにした辞書として組み立てる(配列だとJev APIが422を返すため)', () => {
    const body = buildJevRequestBody('回答本文', labels);
    expect(body).toEqual({
      model: 'jev-latest',
      state: '回答本文',
      questions: {
        '1': { type: 'score', question: labels[0].question_text },
        '2': { type: 'score', question: labels[1].question_text },
      },
    });
  });
});

describe('parseJevApiResponse', () => {
  it('answers辞書(数値)をラベルIDのキーでlabelIdへ結び付ける', () => {
    const result = parseJevApiResponse(labels, { answers: { '1': 0.9, '2': 0.2 } });
    expect(result).toEqual({
      ok: true,
      scores: [
        { labelId: 1, value: 0.9 },
        { labelId: 2, value: 0.2 },
      ],
    });
  });

  it('answers辞書(オブジェクト形式 {score})にも対応する', () => {
    const result = parseJevApiResponse(labels, { answers: { '1': { score: 0.7 }, '2': { value: 0.4 } } });
    expect(result).toEqual({
      ok: true,
      scores: [
        { labelId: 1, value: 0.7 },
        { labelId: 2, value: 0.4 },
      ],
    });
  });

  it('answersが無いレスポンスはunexpected_shapeで失敗を返す(空文字列やnullで誤魔化さない)', () => {
    const result = parseJevApiResponse(labels, { foo: 'bar' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('unexpected_shape');
  });

  it('answersが配列(辞書ではない)場合はunexpected_shapeで失敗を返す', () => {
    const result = parseJevApiResponse(labels, { answers: [0.9, 0.2] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('unexpected_shape');
  });

  it('一部のラベルIDがanswersに含まれない場合はunexpected_shapeで失敗を返す', () => {
    const result = parseJevApiResponse(labels, { answers: { '1': 0.9 } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('unexpected_shape');
  });

  it('answersの値から数値を取り出せない場合はunexpected_shapeで失敗を返す', () => {
    const result = parseJevApiResponse(labels, { answers: { '1': { foo: 'bar' }, '2': 0.4 } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('unexpected_shape');
  });

  it('labelsが0件なら常に成功・空配列を返す', () => {
    const result = parseJevApiResponse([], { anything: true });
    expect(result).toEqual({ ok: true, scores: [] });
  });
});

describe('attachJevResultFlags', () => {
  it('evaluatedShareIdsに含まれるidだけhasJevResultをtrueにする', () => {
    const items = [{ id: 'share-1', question: 'q1' }, { id: 'share-2', question: 'q2' }];
    const result = attachJevResultFlags(items, new Set(['share-1']));
    expect(result).toEqual([
      { id: 'share-1', question: 'q1', hasJevResult: true },
      { id: 'share-2', question: 'q2', hasJevResult: false },
    ]);
  });

  it('evaluatedShareIdsが空なら全件falseになる', () => {
    const items = [{ id: 'share-1' }];
    const result = attachJevResultFlags(items, new Set());
    expect(result).toEqual([{ id: 'share-1', hasJevResult: false }]);
  });
});

describe('callJevApi', () => {
  it('正常応答時はparseJevApiResponse相当の結果を返す', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ answers: { '1': 0.5, '2': 0.6 } }),
      text: async () => '',
    });
    const result = await callJevApi({ apiKey: 'key', state: 'text', labels, fetchImpl });
    expect(result).toEqual({
      ok: true,
      scores: [
        { labelId: 1, value: 0.5 },
        { labelId: 2, value: 0.6 },
      ],
    });
  });

  it('HTTPエラー応答はhttp_errorとして記録される(握りつぶさない)', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => 'internal error',
    });
    const result = await callJevApi({ apiKey: 'key', state: 'text', labels, fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('http_error');
      expect(result.detail).toContain('500');
    }
  });

  it('fetch自体が例外を投げてもhttp_errorとして返り値に残る(戻り値が空にならない)', async () => {
    const fetchImpl = async () => {
      throw new Error('network down');
    };
    const result = await callJevApi({ apiKey: 'key', state: 'text', labels, fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('http_error');
      expect(result.detail).toContain('network down');
    }
  });

  it('JSON解析に失敗した場合はinvalid_jsonとして返る', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad json');
      },
      text: async () => '',
    });
    const result = await callJevApi({ apiKey: 'key', state: 'text', labels, fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('invalid_json');
  });

  it('labelsが0件ならfetchを呼ばずに成功を返す(不要なJev呼び出しをしない)', async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
    };
    const result = await callJevApi({ apiKey: 'key', state: 'text', labels: [], fetchImpl });
    expect(result).toEqual({ ok: true, scores: [] });
    expect(called).toBe(false);
  });
});
