export interface SlackSignatureVerifyResult {
  success: boolean;
  reason?: string;
}

export async function verifySlackSignature(
  rawBody: string,
  timestamp: string | undefined,
  signature: string | undefined,
  signingSecret: string
): Promise<SlackSignatureVerifyResult> {
  if (!timestamp) {
    return { success: false, reason: 'Missing X-Slack-Request-Timestamp header' };
  }

  if (!signature) {
    return { success: false, reason: 'Missing X-Slack-Signature header' };
  }

  const ts = Number(timestamp);
  if (Number.isNaN(ts)) {
    return { success: false, reason: 'Invalid timestamp' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    return { success: false, reason: 'Timestamp too old' };
  }

  const sigBasestring = `v0:${timestamp}:${rawBody}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(sigBasestring)
  );

  const expectedSig = 'v0=' + Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (signature.length !== expectedSig.length) {
    return { success: false, reason: 'Signature mismatch' };
  }

  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }

  if (mismatch !== 0) {
    return { success: false, reason: 'Signature mismatch' };
  }

  return { success: true };
}
