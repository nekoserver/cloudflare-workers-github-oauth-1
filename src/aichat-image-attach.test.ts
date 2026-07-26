import { describe, expect, it } from 'vitest';
import {
  validateImageDataUrl,
  attachImageToLastUserMessage,
  resolveAichatModelsForRequest,
  AICHAT_VISION_MODELS,
  AICHAT_DEFAULT_VISION_MODEL,
  MAX_IMAGE_BASE64_LENGTH,
} from './utils/aichatImage';

// 対象: AIチャットページの「＋」ボタンから写真を送信する機能のバックエンド側純粋関数
// (src/utils/aichatImage.ts)。UIから送られてくる画像data URLの検証、
// Workers AIのマルチモーダルmessages形式への変換、画像添付時のモデル選択ロジックを扱う。
//
// 故障シナリオ:
//   (1) 不正な形式のdata URL(http URL・base64でない・プレフィックス欠落)を弾けない
//   (2) 許可していない画像形式(svgなど)を弾けない
//   (3) 巨大な画像データを弾けずWorker/AIのリクエスト上限に抵触する
//   (4) 画像添付時に、画像を受け付けられないテキスト専用モデルへ送ってしまう
//   (5) 画像添付時のフォールバックモデルが存在しない/primaryと同じになり再試行が効かない
//   (6) messages配列のcontent変換で、他のメッセージ(system等)まで巻き込んで壊してしまう

describe('validateImageDataUrl', () => {
  const validBase64 = Buffer.from('hello-image-bytes').toString('base64');

  it('png/jpeg/webp/gifのdata URLを許可する', () => {
    for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      const result = validateImageDataUrl(`data:${mime};base64,${validBase64}`);
      expect(result.ok, `${mime} が許可されない`).toBe(true);
    }
  });

  it('許可していない画像形式(svg)は拒否する', () => {
    const result = validateImageDataUrl(`data:image/svg+xml;base64,${validBase64}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('対応していない画像形式');
  });

  it('data URL形式でない文字列(HTTP URL)は拒否する', () => {
    const result = validateImageDataUrl('https://example.com/photo.png');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('形式が不正');
  });

  it('base64マーカーが無い文字列は拒否する', () => {
    const result = validateImageDataUrl('data:image/png,not-base64-data');
    expect(result.ok).toBe(false);
  });

  it('上限を超える巨大なbase64データは拒否する', () => {
    const huge = 'A'.repeat(MAX_IMAGE_BASE64_LENGTH + 100);
    const result = validateImageDataUrl(`data:image/png;base64,${huge}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('サイズが大きすぎます');
  });

  it('上限ちょうどのbase64データは許可する', () => {
    const atLimit = 'A'.repeat(MAX_IMAGE_BASE64_LENGTH);
    const result = validateImageDataUrl(`data:image/png;base64,${atLimit}`);
    expect(result.ok).toBe(true);
  });
});

describe('attachImageToLastUserMessage', () => {
  const IMG = 'data:image/png;base64,AAAA';

  it('system+userの2件構成(モードa)で、userメッセージだけがcontent配列に変換される', () => {
    const messages = [
      { role: 'system', content: 'あなたは親切なアシスタントです。必ず日本語で回答してください。' },
      { role: 'user', content: 'この写真は何ですか?' },
    ];
    const result = attachImageToLastUserMessage(messages, IMG);
    expect(result[0]).toEqual(messages[0]);
    expect(Array.isArray(result[1].content)).toBe(true);
    const content = result[1].content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({ type: 'image_url', image_url: { url: IMG } });
    expect(content[1]).toEqual({ type: 'text', text: 'この写真は何ですか?' });
  });

  it('userメッセージ1件のみ(モードc)でも正しく変換される', () => {
    const messages = [{ role: 'user', content: 'これは何?' }];
    const result = attachImageToLastUserMessage(messages, IMG);
    expect(result).toHaveLength(1);
    const content = result[0].content as Array<{ type: string }>;
    expect(content[0].type).toBe('image_url');
    expect(content[1].type).toBe('text');
  });

  it('userロールのメッセージが存在しない場合は変更せずそのまま返す', () => {
    const messages = [{ role: 'system', content: 'システム指示のみ' }];
    const result = attachImageToLastUserMessage(messages, IMG);
    expect(result).toEqual(messages);
  });

  it('元のmessages配列を破壊的に変更しない', () => {
    const messages = [{ role: 'user', content: '元テキスト' }];
    const original = JSON.parse(JSON.stringify(messages));
    attachImageToLastUserMessage(messages, IMG);
    expect(messages).toEqual(original);
  });
});

describe('resolveAichatModelsForRequest', () => {
  const allowedModels = new Set([
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    '@cf/meta/llama-3.1-8b-instruct-fp8',
    '@cf/meta/llama-4-scout-17b-16e-instruct',
    '@cf/google/gemma-3-12b-it',
  ]);
  const textFallbackModel = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

  it('画像なし・許可済みモデル指定時はそのモデルを使い、fallbackはテキスト用フォールバック', () => {
    const r = resolveAichatModelsForRequest({
      requestedModel: '@cf/meta/llama-3.1-8b-instruct-fp8',
      hasImage: false,
      allowedModels,
      configuredModel: '',
      textFallbackModel,
    });
    expect(r.primaryModel).toBe('@cf/meta/llama-3.1-8b-instruct-fp8');
    expect(r.fallbackModel).toBe(textFallbackModel);
  });

  it('画像なし・未指定時はconfiguredModelを使う', () => {
    const r = resolveAichatModelsForRequest({
      requestedModel: '',
      hasImage: false,
      allowedModels,
      configuredModel: '@cf/meta/llama-3.1-70b-instruct',
      textFallbackModel,
    });
    expect(r.primaryModel).toBe('@cf/meta/llama-3.1-70b-instruct');
  });

  it('画像あり・vision対応モデルを明示指定した場合はそれを使い、fallbackはもう一方のvisionモデル', () => {
    const r = resolveAichatModelsForRequest({
      requestedModel: '@cf/google/gemma-3-12b-it',
      hasImage: true,
      allowedModels,
      configuredModel: '',
      textFallbackModel,
    });
    expect(r.primaryModel).toBe('@cf/google/gemma-3-12b-it');
    expect(r.fallbackModel).toBe('@cf/meta/llama-4-scout-17b-16e-instruct');
    expect(AICHAT_VISION_MODELS.has(r.fallbackModel)).toBe(true);
  });

  it('画像あり・テキスト専用モデルを指定していた場合はvisionのデフォルトモデルに差し替える', () => {
    const r = resolveAichatModelsForRequest({
      requestedModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      hasImage: true,
      allowedModels,
      configuredModel: '',
      textFallbackModel,
    });
    expect(r.primaryModel).toBe(AICHAT_DEFAULT_VISION_MODEL);
    expect(AICHAT_VISION_MODELS.has(r.primaryModel)).toBe(true);
  });

  it('画像あり時、primaryとfallbackが異なるモデルになる(再試行が意味を持つ)', () => {
    const r = resolveAichatModelsForRequest({
      requestedModel: '',
      hasImage: true,
      allowedModels,
      configuredModel: '',
      textFallbackModel,
    });
    expect(r.primaryModel).not.toBe(r.fallbackModel);
    expect(AICHAT_VISION_MODELS.has(r.primaryModel)).toBe(true);
    expect(AICHAT_VISION_MODELS.has(r.fallbackModel)).toBe(true);
  });
});
