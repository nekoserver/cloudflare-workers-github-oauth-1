import { describe, it, expect, vi } from 'vitest';
import { resolveClefPlaygroundModel, toClefShortModelName, callClefPlaygroundModel, DEFAULT_CLEF_MODEL, CLEF_PLAYGROUND_MODELS } from './clefPlayground';

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

  // clef-omni(音声・動画対応)は実在するが、別の(未検証の)リクエスト
  // スキーマを使うと見られ、テキストのみのstate+questions形式を前提とする
  // 本プレイグラウンドではスキーマ非対応としてCLEF_PLAYGROUND_MODELSから
  // 外している。この関数がclef-omniを既定モデルへ正しくフォールバック
  // させることを保証する。
  it('clef-omniは本プレイグラウンドの対象外のため既定モデルへフォールバックする', () => {
    expect(resolveClefPlaygroundModel('@cf/cloudflare/clef-omni')).toBe(DEFAULT_CLEF_MODEL);
  });

  it('文字列以外(数値・オブジェクト等)も既定モデルへフォールバックする', () => {
    expect(resolveClefPlaygroundModel(123)).toBe(DEFAULT_CLEF_MODEL);
    expect(resolveClefPlaygroundModel({})).toBe(DEFAULT_CLEF_MODEL);
    expect(resolveClefPlaygroundModel(null)).toBe(DEFAULT_CLEF_MODEL);
  });
});

describe('toClefShortModelName', () => {
  // 2026-10-11、実機で確認: input.modelフィールドは正規表現
  // ^\s*(clef|clef-flash)\s*$ でのみ検証を通る短い名前が必要で、
  // カタログの完全なID(@cf/cloudflare/clef-flash等)をそのまま渡すと
  // "'/model' failed test ... pattern" で失敗する。
  it('@cf/cloudflare/プレフィックスを取り除いた短い名前を返す', () => {
    expect(toClefShortModelName('@cf/cloudflare/clef')).toBe('clef');
    expect(toClefShortModelName('@cf/cloudflare/clef-flash')).toBe('clef-flash');
  });
});

describe('callClefPlaygroundModel', () => {
  // 2026-10-11、実機で確認した故障(2件目): 1件目の修正(inputにmodelを
  // 含める)だけでは不十分で、input.modelには短い名前(clef・clef-flash)を
  // 渡す必要がある。ai.run()の第一引数(Workers AIバインディングのモデル
  // 選択)は従来通りカタログの完全なIDのまま。
  it('ai.run(完全なモデルID, {...state/questions, model: 短い名前})を呼び、結果を返す', async () => {
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
      model: 'clef',
    });
  });

  it('inputに渡すmodelは、未知の値からフォールバックした後の解決済みmodelの短い名前と一致する(payloadの生の値ではない)', async () => {
    const run = vi.fn().mockResolvedValue({});
    await callClefPlaygroundModel({ run }, { model: 'not-a-real-model', state: 's', questions: {} });
    const [calledModel, input] = run.mock.calls[0];
    expect(calledModel).toBe(DEFAULT_CLEF_MODEL);
    expect((input as { model: string }).model).toBe('clef-flash');
  });

  it('ai.runが失敗した場合はerrorDetailに理由を入れて返す(握りつぶさない)', async () => {
    const run = vi.fn().mockRejectedValue(new Error('binding unavailable'));
    const result = await callClefPlaygroundModel({ run }, { state: 's', questions: {} });
    expect(result).toEqual({ ok: false, errorDetail: 'binding unavailable' });
  });

  it('modelが未指定の場合は既定モデルで呼び、inputのmodelは短い名前(clef-flash)になる', async () => {
    const run = vi.fn().mockResolvedValue({});
    await callClefPlaygroundModel({ run }, { state: 's', questions: {} });
    expect(run).toHaveBeenCalledWith(DEFAULT_CLEF_MODEL, expect.objectContaining({ model: 'clef-flash' }));
  });
});
