import { describe, it, expect } from 'vitest';
import {
  MOONDREAM_MODEL,
  MOONDREAM_DEFAULT_PROMPT,
  MOONDREAM_MAX_TOKENS,
  validateMoondreamImageDataUrl,
  estimateImageByteLength,
  buildMoondreamRunParams,
  parseMoondreamResponse,
} from './moondreamAnalyze';
import { AICHAT_DEFAULT_VISION_MODEL } from './aichatImage';

// 故障シナリオ:
// (1) MOONDREAM_MODELが実際にはvision対応していないモデル(画像添付で拒否される)を指す
// (2) プロンプト未指定・空文字のときにデフォルトプロンプトへフォールバックしない
// (3) buildMoondreamRunParamsが生成するmessages配列の形式が/api/aichatの
//     マルチモーダル形式(image_url→text の順)とずれ、Workers AI側で拒否される
// (4) Workers AIのレスポンス形状(response/choices[0].message.contentのどちら)を
//     決め打ちで1つしか見ず、実際の応答が拾えず空になる
// (5) 空文字列・数値・null等の異常なレスポンスを文字列として誤って返してしまう
// (6) estimateImageByteLengthがpadding("="/"==")を考慮せずバイト数を過大に見積もる
describe('moondreamAnalyze', () => {
  it('MOONDREAM_MODELはAIチャットの画像添付機能で実績のあるvision対応モデルを指す(Moondream専用スキーマの不具合を回避するため)', () => {
    expect(MOONDREAM_MODEL).toBe(AICHAT_DEFAULT_VISION_MODEL);
  });

  it('validateMoondreamImageDataUrlはpng/jpeg/webp/gifを許可し、それ以外を拒否する', () => {
    expect(validateMoondreamImageDataUrl('data:image/png;base64,aGVsbG8=')).toEqual({ ok: true });
    expect(validateMoondreamImageDataUrl('data:image/svg+xml;base64,aGVsbG8=').ok).toBe(false);
    expect(validateMoondreamImageDataUrl('not-a-data-url').ok).toBe(false);
  });

  it('estimateImageByteLengthはbase64のpaddingを考慮してデコード後バイト数を概算する', () => {
    // "AB" -> base64 "QUI="(padding1文字) -> 2バイト
    expect(estimateImageByteLength('data:image/png;base64,QUI=')).toBe(2);
    // "A" -> base64 "QQ=="(padding2文字) -> 1バイト
    expect(estimateImageByteLength('data:image/png;base64,QQ==')).toBe(1);
    // "ABC" -> base64 "QUJD"(paddingなし) -> 3バイト
    expect(estimateImageByteLength('data:image/png;base64,QUJD')).toBe(3);
  });

  it('estimateImageByteLengthはカンマがない不正な入力に対して0を返す(例外を投げない)', () => {
    expect(estimateImageByteLength('not-a-data-url')).toBe(0);
  });

  it('buildMoondreamRunParamsはmax_tokensを含み、プロンプト未指定・空文字ならデフォルトプロンプトを使う', () => {
    const dataUrl = 'data:image/png;base64,QUI=';
    expect(buildMoondreamRunParams(dataUrl)).toEqual({
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: MOONDREAM_DEFAULT_PROMPT },
      ] }],
      max_tokens: MOONDREAM_MAX_TOKENS,
    });
    expect(buildMoondreamRunParams(dataUrl, '   ').messages[0].content).toEqual([
      { type: 'image_url', image_url: { url: dataUrl } },
      { type: 'text', text: MOONDREAM_DEFAULT_PROMPT },
    ]);
    expect(buildMoondreamRunParams(dataUrl, '  この猫の種類は? ').messages[0].content).toEqual([
      { type: 'image_url', image_url: { url: dataUrl } },
      { type: 'text', text: 'この猫の種類は?' },
    ]);
  });

  it('buildMoondreamRunParamsが生成するcontentはimage_urlがtextより先(AIチャットのattachImageToLastUserMessageと同じ順序)', () => {
    const params = buildMoondreamRunParams('data:image/png;base64,QUI=', '質問');
    const content = params.messages[0].content as Array<{ type: string }>;
    expect(content[0].type).toBe('image_url');
    expect(content[1].type).toBe('text');
  });

  it('parseMoondreamResponseはresponse/description/text/answer/reasoning_contentの順に候補キーを試す', () => {
    expect(parseMoondreamResponse({ response: '写真の説明です' })).toBe('写真の説明です');
    expect(parseMoondreamResponse({ description: '説明のみ' })).toBe('説明のみ');
    expect(parseMoondreamResponse({ text: 'テキストのみ' })).toBe('テキストのみ');
    expect(parseMoondreamResponse({ answer: '回答のみ' })).toBe('回答のみ');
    expect(parseMoondreamResponse({ reasoning_content: '推論のみ' })).toBe('推論のみ');
    // responseが優先される
    expect(parseMoondreamResponse({ response: '優先', description: '非優先' })).toBe('優先');
  });

  it('parseMoondreamResponseはOpenAI互換のchoices[0].message.content形式も読み取る', () => {
    const result = { choices: [{ message: { content: 'chat形式の応答' } }] };
    expect(parseMoondreamResponse(result)).toBe('chat形式の応答');
  });

  it('parseMoondreamResponseは異常な入力(null/文字列以外/空文字/空白のみ)に対してnullを返す(握りつぶさない)', () => {
    expect(parseMoondreamResponse(null)).toBeNull();
    expect(parseMoondreamResponse(undefined)).toBeNull();
    expect(parseMoondreamResponse('plain string')).toBeNull();
    expect(parseMoondreamResponse({ response: 123 })).toBeNull();
    expect(parseMoondreamResponse({ response: '' })).toBeNull();
    expect(parseMoondreamResponse({ response: '   ' })).toBeNull();
    expect(parseMoondreamResponse({ other: 'no match' })).toBeNull();
    expect(parseMoondreamResponse({ choices: [] })).toBeNull();
  });
});
