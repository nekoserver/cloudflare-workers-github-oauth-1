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
    // 一時的な診断情報: secretの値そのものは含めず、
    // - secretのSHA-256ハッシュ先頭8文字(secretの同一性を安全に比較するため)
    // - rawBodyの先頭/末尾(GitHubペイロードは非機密なJSON構造のため、取得の健全性確認用)
    // を追加で記録する。原因特定後はこのブロックを元の 'Signature mismatch' のみに戻すこと。
    const secretHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
    const secretHash = Array.from(new Uint8Array(secretHashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 8);
    return {
      success: false,
      reason: `Signature mismatch (secretLen=${secret.length}, secretHash=${secretHash}, bodyLen=${rawBody.length}, bodyHead=${JSON.stringify(rawBody.slice(0, 24))}, bodyTail=${JSON.stringify(rawBody.slice(-8))}, received=${receivedSig.slice(0, 8)}..., expected=${expectedSig.slice(0, 8)}...)`,
    };
  }

  return { success: true };
}
