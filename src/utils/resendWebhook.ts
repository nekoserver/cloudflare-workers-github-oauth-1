const BASE64_DECODE = (() => {
  if (typeof atob === 'function') {
    return atob;
  }
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob.bind(globalThis);
  }
  throw new Error('Base64 decoder unavailable');
})();

const BASE64_ENCODE = (() => {
  if (typeof btoa === 'function') {
    return btoa;
  }
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa.bind(globalThis);
  }
  throw new Error('Base64 encoder unavailable');
})();

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

type ResendWebhookHeaders = {
  id?: string | null;
  timestamp?: string | null;
  signature?: string | null;
};

export type WebhookVerificationResult =
  | { success: true }
  | { success: false; reason: string };

function decodeWebhookSecret(secret: string): Uint8Array {
  const trimmed = secret.trim();
  const normalized = trimmed.startsWith('whsec_') ? trimmed.slice(6) : trimmed;

  if (normalized.length === 0) {
    throw new Error('Webhook secret is empty after removing prefix');
  }

  const decoded = BASE64_DECODE(normalized);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.charCodeAt(i);
  }

  return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return BASE64_ENCODE(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function computeSignatureBase64(secret: string, payload: string): Promise<string> {
  const keyBytes = decodeWebhookSecret(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const data = new TextEncoder().encode(payload);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  return arrayBufferToBase64(signatureBuffer);
}

function parseSignatureHeader(headerValue: string): { version: string; signature: string }[] {
  const entries: { version: string; signature: string }[] = [];
  const regex = /v(\d+),([A-Za-z0-9+/=]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(headerValue)) !== null) {
    entries.push({
      version: match[1],
      signature: match[2],
    });
  }

  return entries;
}

export async function verifyResendWebhookSignature(
  rawBody: string,
  headers: ResendWebhookHeaders,
  webhookSecret: string,
  nowMs = Date.now()
): Promise<WebhookVerificationResult> {
  if (!webhookSecret || webhookSecret.trim().length === 0) {
    return { success: false, reason: 'Missing webhook secret' };
  }

  const id = headers.id?.trim();
  const timestamp = headers.timestamp?.trim();
  const signatureHeader = headers.signature?.trim();

  if (!id || !timestamp || !signatureHeader) {
    return { success: false, reason: 'Missing required signed headers' };
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) {
    return { success: false, reason: 'Invalid timestamp header' };
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  if (Math.abs(nowSeconds - timestampNumber) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { success: false, reason: 'Timestamp outside tolerance' };
  }

  const signatureEntries = parseSignatureHeader(signatureHeader);
  if (signatureEntries.length === 0) {
    return { success: false, reason: 'No signatures found in header' };
  }

  let expectedSignature: string;
  try {
    expectedSignature = await computeSignatureBase64(webhookSecret, `${id}.${timestamp}.${rawBody}`);
  } catch (error) {
    return { success: false, reason: 'Failed to compute expected signature' };
  }

  const normalizedExpected = expectedSignature;

  for (const entry of signatureEntries) {
    if (entry.version !== '1') {
      continue;
    }

    if (timingSafeEqual(normalizedExpected, entry.signature)) {
      return { success: true };
    }
  }

  return { success: false, reason: 'Signature mismatch' };
}
