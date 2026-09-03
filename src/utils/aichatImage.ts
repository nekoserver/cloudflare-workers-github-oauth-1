// AIチャットの「＋」ボタンから送信する画像(data URL)の検証と、
// Workers AIのマルチモーダルmessages形式への変換を担う純粋関数群。
//
// 画像を受け付けられるモデルはWorkers AIの型定義(@cloudflare/workers-types)上、
// content配列に image_url: { url: 'data:image/...;base64,...' } を渡せるものに限られる
// (HTTP URLは受け付けられずbase64 data URLのみ)。AICHAT_ALLOWED_MODELS のうち
// 対応が確認できたのは llama-4-scout-17b-16e-instruct と gemma-4-26b-a4b-it の2つ
// (gemma-3-12b-itは画像対応モデルの世代交代でgemma-4-26b-a4b-itへ置き換えた)。

export const AICHAT_VISION_MODELS: ReadonlySet<string> = new Set([
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/google/gemma-4-26b-a4b-it',
]);

export const AICHAT_DEFAULT_VISION_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

/**
 * 実体の @cf/moondream/moondream3.1-9B-A2B。AICHAT_VISION_MODELS(OpenAI互換の
 * messages配列 + image_url形式で呼べることが確認済みの2モデル)には含めない。
 * moondream3.1は入力スキーマが不安定(過去に"5006: Type mismatch of '/image'"等の
 * エラーが実運用ログで発生し続けた実績があり、確実に動く形式が未確定)なため、
 * buildMoondream3RunParamsで専用の入力形式を組み立てて呼び出す必要がある。
 * 画像添付時のフォールバック順(primary→moondream3.1→もう一方のvisionモデル)でのみ使う。
 */
export const AICHAT_MOONDREAM3_MODEL = '@cf/moondream/moondream3.1-9B-A2B';

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
 * 失敗時に再試行するモデル(fallback、失敗したらさらにsecondFallback)を決定する。
 * 画像添付時はテキスト専用モデル(llama-3.3-70b等)には送れないため、
 * vision対応の2モデル(llama-4-scout / gemma-4-26b-a4b-it)とmoondream3.1の
 * 3モデルの中で完結させる。
 *
 * 画像添付時の優先順位: ユーザーが選択中のモデルがvision対応(gemma-4を
 * セットしていればgemma-4)ならそれをprimaryとし、fallbackはmoondream3.1、
 * secondFallbackはもう一方のvisionモデル、という順で振り分ける。
 */
export function resolveAichatModelsForRequest(
  params: ResolveAichatModelsParams
): { primaryModel: string; fallbackModel: string; secondFallbackModel?: string } {
  const { requestedModel, hasImage, allowedModels, configuredModel, textFallbackModel } = params;
  if (hasImage) {
    const primaryModel = requestedModel && AICHAT_VISION_MODELS.has(requestedModel)
      ? requestedModel
      : AICHAT_DEFAULT_VISION_MODEL;
    let otherVisionModel = primaryModel;
    for (const m of AICHAT_VISION_MODELS) {
      if (m !== primaryModel) { otherVisionModel = m; break; }
    }
    return { primaryModel, fallbackModel: AICHAT_MOONDREAM3_MODEL, secondFallbackModel: otherVisionModel };
  }
  const primaryModel = requestedModel && allowedModels.has(requestedModel)
    ? requestedModel
    : (configuredModel || textFallbackModel);
  return { primaryModel, fallbackModel: textFallbackModel };
}

/**
 * data URL(data:image/xxx;base64,....)のbase64部分をデコードしてバイト列にする。
 * moondream3.1のように { image: バイト列, prompt } 形式を要求するモデル向け
 * (AICHAT_VISION_MODELSが使うOpenAI互換のimage_url形式とは異なる)。
 */
export function decodeImageDataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx === -1 ? dataUrl : dataUrl.slice(commaIdx + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type Moondream3RunParams = { image: number[]; prompt: string; max_tokens: number };

/**
 * moondream3.1専用の入力パラメータを組み立てる(実際にCloudflare上で動作する
 * 保証がある形式ではなく、moondream3.1が本来使う想定の形式。過去にこのモデルへの
 * 呼び出しはスキーマ検証エラーで失敗し続けていた経緯があり、この形式で解消するかは
 * 未検証。失敗した場合はsecondFallbackModel(もう一方のvisionモデル)へ自動で
 * フォールバックされるため、画像分析全体が失敗するわけではない)。
 */
export function buildMoondream3RunParams(imageDataUrl: string, prompt: string): Moondream3RunParams {
  const promptText = prompt && prompt.trim() ? prompt.trim() : 'この画像に何が写っているか、日本語で詳しく説明してください。';
  return {
    image: Array.from(decodeImageDataUrlToBytes(imageDataUrl)),
    prompt: promptText,
    max_tokens: 512,
  };
}
