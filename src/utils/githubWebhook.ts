/**
 * GitHub Webhook 署名検証
 * GitHub は HMAC-SHA256 で署名し、X-Hub-Signature-256 ヘッダーに
 * sha256=<hex> 形式で付与する
 */

export interface GitHubWebhookVerifyResult {
  success: boolean;
  reason?: string;
}

/**
 * GitHub Webhook の署名を検証する
 */
export async function verifyGitHubWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): Promise<GitHubWebhookVerifyResult> {
  if (!signatureHeader) {
    return { success: false, reason: 'Missing X-Hub-Signature-256 header' };
  }

  if (!signatureHeader.startsWith('sha256=')) {
    return { success: false, reason: 'Invalid signature format' };
  }

  const receivedSig = signatureHeader.slice('sha256='.length);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody)
  );

  const expectedSig = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // タイミングセーフ比較
  if (receivedSig.length !== expectedSig.length) {
    return { success: false, reason: 'Signature length mismatch' };
  }

  let mismatch = 0;
  for (let i = 0; i < receivedSig.length; i++) {
    mismatch |= receivedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }

  if (mismatch !== 0) {
    return { success: false, reason: 'Signature mismatch' };
  }

  return { success: true };
}
