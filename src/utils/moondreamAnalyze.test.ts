import { describe, it, expect } from 'vitest';
import {
  MOONDREAM_MODEL,
  MOONDREAM_DEFAULT_PROMPT,
  MOONDREAM_MAX_TOKENS,
  validateMoondreamImageDataUrl,
  dataUrlToImageBytes,
  buildMoondreamRunParams,
  parseMoondreamResponse,
} from './moondreamAnalyze';

// 故障シナリオ:
// (1) data URLのbase64デコードで不正な入力を渡すと例外を投げず変な配列を返す
// (2) プロンプト未指定・空文字のときにデフォルトプロンプトへフォールバックしない
// (3) Workers AIのレスポンス形状(response/description/text/answerのどれか)を
//     決め打ちで1つしか見ず、実際の応答が拾えず空になる
// (4) 空文字列・数値・null等の異常なレスポンスを文字列として誤って返してしまう
describe('moondreamAnalyze', () => {
  it('MOONDREAM_MODELは@cf/moondream/moondream3.1-9B-A2Bを指す', () => {
    expect(MOONDREAM_MODEL).toBe('@cf/moondream/moondream3.1-9B-A2B');
  });

  it('validateMoondreamImageDataUrlはpng/jpeg/webp/gifを許可し、それ以外を拒否する', () => {
    expect(validateMoondreamImageDataUrl('data:image/png;base64,aGVsbG8=')).toEqual({ ok: true });
    expect(validateMoondreamImageDataUrl('data:image/svg+xml;base64,aGVsbG8=').ok).toBe(false);
    expect(validateMoondreamImageDataUrl('not-a-data-url').ok).toBe(false);
  });

  it('dataUrlToImageBytesはbase64部分を正しいUint8Arrayに変換する', () => {
    // "AB" -> base64 "QUI="
    const bytes = dataUrlToImageBytes('data:image/png;base64,QUI=');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual([65, 66]);
  });

  it('dataUrlToImageBytesは不正な形式に対して例外を投げる(呼び出し元でtry/catchする設計)', () => {
    expect(() => dataUrlToImageBytes('not-a-data-url')).toThrow();
    expect(() => dataUrlToImageBytes('data:text/plain;base64,QUI=')).not.toThrow(); // mime不問、形式だけ見る
  });

  it('buildMoondreamRunParamsはmax_tokensを含み、プロンプト未指定・空文字ならデフォルトプロンプトを使う', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(buildMoondreamRunParams(bytes)).toEqual({
      image: bytes,
      prompt: MOONDREAM_DEFAULT_PROMPT,
      max_tokens: MOONDREAM_MAX_TOKENS,
    });
    expect(buildMoondreamRunParams(bytes, '   ')).toEqual({
      image: bytes,
      prompt: MOONDREAM_DEFAULT_PROMPT,
      max_tokens: MOONDREAM_MAX_TOKENS,
    });
    expect(buildMoondreamRunParams(bytes, '  この猫の種類は? ')).toEqual({
      image: bytes,
      prompt: 'この猫の種類は?',
      max_tokens: MOONDREAM_MAX_TOKENS,
    });
  });

  it('buildMoondreamRunParamsのimageはUint8Array(真の二進バイナリ型)のまま渡る(プレーンなnumber[]に変換しない)', () => {
    // 実運用で "Type mismatch of '/image', 'string' not in 'array','binary'" が
    // 発生し続けた原因は、数十万要素のプレーンnumber[]がWorkers AI側で
    // 'binary'型と認識されなかったためとみられる。回帰防止のため、
    // buildMoondreamRunParamsの出力が常にUint8Arrayであることを保証する。
    const bytes = dataUrlToImageBytes('data:image/png;base64,QUI=');
    const params = buildMoondreamRunParams(bytes);
    expect(params.image).toBeInstanceOf(Uint8Array);
    expect(Array.isArray(params.image)).toBe(false);
  });

  it('parseMoondreamResponseはresponse/description/text/answerの順に候補キーを試す', () => {
    expect(parseMoondreamResponse({ response: '写真の説明です' })).toBe('写真の説明です');
    expect(parseMoondreamResponse({ description: '説明のみ' })).toBe('説明のみ');
    expect(parseMoondreamResponse({ text: 'テキストのみ' })).toBe('テキストのみ');
    expect(parseMoondreamResponse({ answer: '回答のみ' })).toBe('回答のみ');
    // responseが優先される
    expect(parseMoondreamResponse({ response: '優先', description: '非優先' })).toBe('優先');
  });

  it('parseMoondreamResponseは異常な入力(null/文字列以外/空文字/空白のみ)に対してnullを返す(握りつぶさない)', () => {
    expect(parseMoondreamResponse(null)).toBeNull();
    expect(parseMoondreamResponse(undefined)).toBeNull();
    expect(parseMoondreamResponse('plain string')).toBeNull();
    expect(parseMoondreamResponse({ response: 123 })).toBeNull();
    expect(parseMoondreamResponse({ response: '' })).toBeNull();
    expect(parseMoondreamResponse({ response: '   ' })).toBeNull();
    expect(parseMoondreamResponse({ other: 'no match' })).toBeNull();
  });
});
