import type { JevCreditsInfo } from './aichatSlashCommand';

const TYPESAFE_CREDITS_URL = 'https://api.typesafe.ai/v1/credits';

/**
 * TypeSafe AI `GET /api/v1/credits` のレスポンスJSONを検証しつつパースする。
 * 想定外の形(フィールド欠落・型不一致)の場合は例外を投げる(握りつぶさない)。
 */
export function parseJevCreditsResponse(body: unknown): JevCreditsInfo {
  if (typeof body !== 'object' || body === null) {
    throw new Error('TypeSafe AI /v1/credits の応答形式が不正です(オブジェクトではありません)');
  }
  const obj = body as Record<string, unknown>;
  const creditsRemainingUsd = obj.creditsRemaining;
  const paidInputTokensRemaining = obj.paidInputTokensRemaining;
  if (typeof creditsRemainingUsd !== 'number' || !Number.isFinite(creditsRemainingUsd)) {
    throw new Error('TypeSafe AI /v1/credits の応答にcreditsRemaining(数値)がありません');
  }
  if (typeof paidInputTokensRemaining !== 'number' || !Number.isFinite(paidInputTokensRemaining)) {
    throw new Error('TypeSafe AI /v1/credits の応答にpaidInputTokensRemaining(数値)がありません');
  }
  return { creditsRemainingUsd, paidInputTokensRemaining };
}

/** `/neko jev` 用に、TypeSafe AIの残クレジット・残入力トークン数を取得する。 */
export async function fetchJevCreditsFromTypesafeApi(apiKey: string): Promise<JevCreditsInfo> {
  const res = await fetch(TYPESAFE_CREDITS_URL, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`TypeSafe AI /v1/credits の取得に失敗しました(status ${res.status})`);
  }
  const body = await res.json();
  return parseJevCreditsResponse(body);
}
