// AIチャットの「＋」ボタンから送信する画像(data URL)の検証と、
// Workers AIのマルチモーダルmessages形式への変換を担う純粋関数群。
//
// 画像を受け付けられるモデルはWorkers AIの型定義(@cloudflare/workers-types)上、
// content配列に image_url: { url: 'data:image/...;base64,...' } を渡せるものに限られる
// (HTTP URLは受け付けられずbase64 data URLのみ)。AICHAT_ALLOWED_MODELS のうち
// 対応が確認できたのは llama-4-scout-17b-16e-instruct と gemma-3-12b-it の2つ。

export const AICHAT_VISION_MODELS: ReadonlySet<string> = new Set([
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/google/gemma-3-12b-it',
]);

export const AICHAT_DEFAULT_VISION_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

const ALLOWED_IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

// クライアント側の上限(6MB)をbase64化した際の長さ(4/3倍、切り上げ)に少し余裕を持たせた値。
export const MAX_IMAGE_BASE64_LENGTH = 8_400_000;

export type ImageValidationResult = { ok: true } | { ok: false; reason: string };

const DATA_URL_RE = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]+=*)$/;

export function validateImageDataUrl(input: string): ImageValidationResult {
  const match = DATA_URL_RE.exec(input);
  if (!match) {
    return { ok: false, reason: '画像データの形式が不正です' };
  }
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
    return { ok: false, reason: '対応していない画像形式です(png/jpeg/webp/gifのみ)' };
  }
  if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
    return { ok: false, reason: '画像サイズが大きすぎます(上限6MB程度)' };
  }
  return { ok: true };
}

export type AiTextContent = { type: 'text'; text: string };
export type AiImageContent = { type: 'image_url'; image_url: { url: string } };
export type AiMultimodalMessage = { role: string; content: string | Array<AiTextContent | AiImageContent> };

/**
 * messages配列のうち最後のuserメッセージのcontentを、
 * [image_url, text] の配列形式に差し替える(Workers AIのマルチモーダル形式)。
 * userメッセージが存在しない場合は何もせずそのまま返す。
 */
export function attachImageToLastUserMessage(
  messages: Array<{ role: string; content: string }>,
  imageDataUrl: string
): AiMultimodalMessage[] {
  let lastUserIdx = -1;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user') lastUserIdx = i;
  }
  if (lastUserIdx === -1) return messages;
  return messages.map((m, i): AiMultimodalMessage => {
    if (i !== lastUserIdx) return m;
    return {
      role: m.role,
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text: m.content },
      ],
    };
  });
}

export type ResolveAichatModelsParams = {
  requestedModel: string;
  hasImage: boolean;
  allowedModels: ReadonlySet<string>;
  configuredModel: string;
  textFallbackModel: string;
};

/**
 * 画像添付の有無に応じて、実際に呼び出すモデル(primary)と
 * 失敗時に再試行するモデル(fallback)を決定する。
 * 画像添付時はテキスト専用モデル(llama-3.3-70b等)には送れないため、
 * vision対応の2モデル(llama-4-scout / gemma-3-12b-it)の中で完結させる。
 */
export function resolveAichatModelsForRequest(
  params: ResolveAichatModelsParams
): { primaryModel: string; fallbackModel: string } {
  const { requestedModel, hasImage, allowedModels, configuredModel, textFallbackModel } = params;
  if (hasImage) {
    const primaryModel = requestedModel && AICHAT_VISION_MODELS.has(requestedModel)
      ? requestedModel
      : AICHAT_DEFAULT_VISION_MODEL;
    let otherVisionModel = primaryModel;
    for (const m of AICHAT_VISION_MODELS) {
      if (m !== primaryModel) { otherVisionModel = m; break; }
    }
    return { primaryModel, fallbackModel: otherVisionModel };
  }
  const primaryModel = requestedModel && allowedModels.has(requestedModel)
    ? requestedModel
    : (configuredModel || textFallbackModel);
  return { primaryModel, fallbackModel: textFallbackModel };
}
