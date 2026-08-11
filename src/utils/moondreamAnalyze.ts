// AIチャットの画像添付機能と /moondream-vlm ページの両方から使う、
// Workers AI `@cf/moondream/moondream3.1-9B-A2B` (画像分析VLM) 呼び出しの
// 入出力を組み立てる純粋関数群。
//
// 故障シナリオ:
// (1) data URLのbase64部分をバイト配列へ変換する際、不正な文字列だと
//     例外を投げてリクエスト全体が500になる → デコード関数はtry/catchで
//     包んだ呼び出し元がエラーを判定できるよう、例外はそのまま投げる
//     (呼び出し元のAPIハンドラでtry/catchする設計)
// (2) Workers AIのレスポンス形状はモデルによって response/description/text/answer
//     などフィールド名がまちまちなため、決め打ちで1つのキーだけ読むと
//     応答が空文字になり気づきにくい → 複数の候補キーを順に試し、
//     すべて空ならその旨を呼び出し元に伝える

import { validateImageDataUrl, type ImageValidationResult } from './aichatImage';

export const MOONDREAM_MODEL = '@cf/moondream/moondream3.1-9B-A2B';
export const MOONDREAM_DEFAULT_PROMPT = 'この画像に何が写っているか、日本語で詳しく説明してください。';
export const MOONDREAM_MAX_TOKENS = 512;

const DATA_URL_RE = /^data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/]+=*)$/;

export function validateMoondreamImageDataUrl(input: string): ImageValidationResult {
  return validateImageDataUrl(input);
}

/**
 * data URL(data:image/png;base64,....)のbase64部分をバイト配列に変換する。
 * validateMoondreamImageDataUrl() で ok:true を確認した入力を渡すこと。
 * 不正な形式の場合は例外を投げる(呼び出し元でtry/catchする設計)。
 *
 * Uint8Array(真の二進バイナリ型)で返す。当初はプレーンなnumber[]を渡していたが、
 * 実運用で "5006: Error: Type mismatch of '/image', 'string' not in 'array','binary'"
 * が発生し続けた。数十万要素のプレーン配列はWorkers AIバインディングの転送経路上で
 * 'binary'型として認識されず、意図しない文字列化を招いていたとみられるため、
 * 明確に'binary'型と判定されるUint8Arrayへ変更した。
 */
export function dataUrlToImageBytes(dataUrl: string): Uint8Array {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) {
    throw new Error('画像データの形式が不正です');
  }
  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export type MoondreamRunParams = {
  image: Uint8Array;
  prompt: string;
  max_tokens: number;
};

export function buildMoondreamRunParams(imageBytes: Uint8Array, prompt?: string): MoondreamRunParams {
  return {
    image: imageBytes,
    prompt: prompt && prompt.trim() ? prompt.trim() : MOONDREAM_DEFAULT_PROMPT,
    max_tokens: MOONDREAM_MAX_TOKENS,
  };
}

/**
 * Workers AIの実行結果から分析テキストを取り出す。
 * response/description/text/answer の順に候補キーを試し、
 * いずれも文字列でなければ握りつぶさずnullを返す(呼び出し元でエラー扱いにする)。
 */
export function parseMoondreamResponse(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  for (const key of ['response', 'description', 'text', 'answer']) {
    const v = r[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}
