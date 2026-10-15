/**
 * Tailscale Webhook 署名検証(POST /webhook/ts)。
 * Tailscaleはリクエストヘッダー Tailscale-Webhook-Signature に
 * "t=<unix秒>,v1=<hex>" 形式で署名を付与する(Stripeと同系統の方式)。
 * 署名対象はエンドポイント作成時に一度だけ表示される署名シークレットで
 * "{t}.{rawBody}" をHMAC-SHA256した値。
 *
 * 注意: この検証ロジックはTailscale公式ドキュメントの署名方式に基づく実装
 * であり、実際の初回配信を/webhook/tsで受けてwebhook_logのrejected行
 * (rejected理由・ヘッダー名の食い違い)を確認し、ヘッダー名や形式が異なる
 * 場合はここを合わせて直すこと。
 */

export interface TailscaleWebhookVerifyResult {
  success: boolean;
  reason?: string;
}

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function parseSignatureHeader(signatureHeader: string): { timestamp: string; signature: string } | null {
  const parts: Record<string, string> = {};
  for (const pair of signatureHeader.split(',')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    parts[pair.slice(0, eqIndex).trim()] = pair.slice(eqIndex + 1).trim();
  }
  if (!parts.t || !parts.v1) return null;
  return { timestamp: parts.t, signature: parts.v1 };
}

/** タイミングセーフ比較(githubWebhook.tsのverifyGitHubWebhookSignatureと同じ方式)。 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyTailscaleWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<TailscaleWebhookVerifyResult> {
  if (!signatureHeader) {
    return { success: false, reason: 'Missing Tailscale-Webhook-Signature header' };
  }

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    return { success: false, reason: 'Invalid signature format' };
  }
  const { timestamp, signature: receivedSig } = parsed;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return { success: false, reason: 'Invalid timestamp' };
  }
  if (Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) {
    return { success: false, reason: 'Timestamp outside tolerance window' };
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expectedSig = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (!timingSafeEqual(receivedSig, expectedSig)) {
    return { success: false, reason: 'Signature mismatch' };
  }
  return { success: true };
}
