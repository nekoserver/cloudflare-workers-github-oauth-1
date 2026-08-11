// AIチャットの画像添付機能と /moondream-vlm ページの両方から使う、
// 画像分析(VLM)呼び出しの入出力を組み立てる純粋関数群。
//
// もともとは `@cf/moondream/moondream3.1-9B-A2B` 専用の入力形式
// (image: バイト配列, prompt, max_tokens)を使っていたが、実運用ログ
// (/moondream-analyze-log)で毎回 "5006: Type mismatch of '/image', ..." が
// 発生し続けた。number[]→Uint8Arrayへ変更しても "'string' not in 'object'" と
// 期待型自体が変化し、Cloudflare側のこの新モデル固有のスキーマ検証が
// 不安定(既知の未解決不具合、Cloudflareコミュニティにも同様の報告あり)と
// 判断した。AIチャット本体の画像添付機能(/api/aichat, messages配列に
// image_url: {url: dataURL} を載せるOpenAI互換のマルチモーダル形式)は
// 同じ環境で実際に画像を読み取れることが確認済みのため、画像分析APIも
// 同じ実績のある形式・モデル(AICHAT_VISION_MODELS)に統一した。
//
// 故障シナリオ:
// (1) Workers AIのレスポンス形状はモデルによって response/reasoning_content/
//     choices[0].message.content などフィールド名がまちまちなため、
//     決め打ちで1つのキーだけ読むと応答が空文字になり気づきにくい →
//     複数の候補キーを順に試し、すべて空ならその旨を呼び出し元に伝える
// (2) 画像添付時に使えないテキスト専用モデルを指定してしまうとWorkers AI側で
//     拒否される → AICHAT_VISION_MODELS(vision対応が確認済みの2モデル)のみを使う

import { validateImageDataUrl, type ImageValidationResult, AICHAT_DEFAULT_VISION_MODEL, type AiMultimodalMessage } from './aichatImage';

export const MOONDREAM_MODEL = AICHAT_DEFAULT_VISION_MODEL;
export const MOONDREAM_DEFAULT_PROMPT = 'この画像に何が写っているか、日本語で詳しく説明してください。';
export const MOONDREAM_MAX_TOKENS = 512;

export function validateMoondreamImageDataUrl(input: string): ImageValidationResult {
  return validateImageDataUrl(input);
}

/**
 * data URLのbase64部分の長さから、デコード後のおおよそのバイト数を計算する。
 * ログ記録(moondream_analyze_log.image_bytes)専用の概算値であり、
 * Workers AIへの送信自体はdata URL文字列をそのまま渡すため厳密なデコードは不要。
 */
export function estimateImageByteLength(imageDataUrl: string): number {
  const commaIdx = imageDataUrl.indexOf(',');
  if (commaIdx === -1) return 0;
  const base64 = imageDataUrl.slice(commaIdx + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export type MoondreamRunParams = {
  messages: AiMultimodalMessage[];
  max_tokens: number;
};

/**
 * 画像分析リクエストのmessages配列を組み立てる(OpenAI互換のマルチモーダル形式)。
 * data URLはそのまま image_url.url に渡す(バイト配列へのデコードは不要)。
 */
export function buildMoondreamRunParams(imageDataUrl: string, prompt?: string): MoondreamRunParams {
  const promptText = prompt && prompt.trim() ? prompt.trim() : MOONDREAM_DEFAULT_PROMPT;
  const messages: AiMultimodalMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text: promptText },
      ],
    },
  ];
  return { messages, max_tokens: MOONDREAM_MAX_TOKENS };
}

/**
 * Workers AIの実行結果から分析テキストを取り出す。
 * response/reasoning_content/choices[0].message.content の順に候補を試し、
 * いずれも文字列でなければ握りつぶさずnullを返す(呼び出し元でエラー扱いにする)。
 */
export function parseMoondreamResponse(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  for (const key of ['response', 'description', 'text', 'answer', 'reasoning_content']) {
    const v = r[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const choices = Array.isArray(r['choices']) ? r['choices'] as Array<Record<string, unknown>> : [];
  if (choices.length > 0) {
    const message = choices[0]['message'] as Record<string, unknown> | undefined;
    const content = message?.['content'];
    if (typeof content === 'string' && content.trim()) return content.trim();
  }
  return null;
}
