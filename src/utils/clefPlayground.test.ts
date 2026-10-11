import { describe, it, expect, vi } from 'vitest';
import { resolveClefPlaygroundModel, callClefPlaygroundModel, DEFAULT_CLEF_MODEL, CLEF_PLAYGROUND_MODELS } from './clefPlayground';

describe('resolveClefPlaygroundModel', () => {
  it('CLEF_PLAYGROUND_MODELSに含まれる値はそのまま使う', () => {
    for (const model of CLEF_PLAYGROUND_MODELS) {
      expect(resolveClefPlaygroundModel(model)).toBe(model);
    }
  });

  it('未指定(undefined)の場合は既定モデルを返す', () => {
    expect(resolveClefPlaygroundModel(undefined)).toBe(DEFAULT_CLEF_MODEL);
  });

  it('リスト外の文字列(誤記・別モデルのID)は既定モデルへフォールバックする', () => {
    expect(resolveClefPlaygroundModel('@cf/meta/llama-3.1-8b-instruct')).toBe(DEFAULT_CLEF_MODEL);
    expect(resolveClefPlaygroundModel('clef')).toBe(DEFAULT_CLEF_MODEL);
  });

  it('文字列以外(数値・オブジェクト等)も既定モデルへフォールバックする', () => {
    expect(resolveClefPlaygroundModel(123)).toBe(DEFAULT_CLEF_MODEL);
    expect(resolveClefPlaygroundModel({})).toBe(DEFAULT_CLEF_MODEL);
    expect(resolveClefPlaygroundModel(null)).toBe(DEFAULT_CLEF_MODEL);
  });
});

describe('callClefPlaygroundModel', () => {
  it('解決したmodelでai.run(model, {state, questions})を呼び、結果を返す', async () => {
    const run = vi.fn().mockResolvedValue({ answers: { condition: { noul: 0.9 } } });
    const result = await callClefPlaygroundModel({ run }, {
      model: '@cf/cloudflare/clef',
      state: 'テスト状態',
      questions: { condition: { type: 'noul', question: '成立しているか？' } },
    });
    expect(result).toEqual({ ok: true, model: '@cf/cloudflare/clef', result: { answers: { condition: { noul: 0.9 } } } });
    expect(run).toHaveBeenCalledWith('@cf/cloudflare/clef', {
      state: 'テスト状態',
      questions: { condition: { type: 'noul', question: '成立しているか？' } },
    });
  });

  it('modelをpayloadからai.run入力に含めない(modelはURLパラメータ側、inputに混ぜない)', async () => {
    const run = vi.fn().mockResolvedValue({});
    await callClefPlaygroundModel({ run }, { model: '@cf/cloudflare/clef-flash', state: 's', questions: {} });
    const [, input] = run.mock.calls[0];
    expect(input).not.toHaveProperty('model');
  });

  it('ai.runが失敗した場合はerrorDetailに理由を入れて返す(握りつぶさない)', async () => {
    const run = vi.fn().mockRejectedValue(new Error('binding unavailable'));
    const result = await callClefPlaygroundModel({ run }, { state: 's', questions: {} });
    expect(result).toEqual({ ok: false, errorDetail: 'binding unavailable' });
  });

  it('modelが未指定の場合は既定モデルで呼ぶ', async () => {
    const run = vi.fn().mockResolvedValue({});
    await callClefPlaygroundModel({ run }, { state: 's', questions: {} });
    expect(run).toHaveBeenCalledWith(DEFAULT_CLEF_MODEL, expect.anything());
  });
});
