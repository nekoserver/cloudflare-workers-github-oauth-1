/**
 * /r9-statusページが使う、r9.nekomaneki.workへのHMAC署名付きGETリクエスト処理。
 * deploy/redmine/のHMACゲートウェイ(src/utils/redmineProxy.ts)と同じ方式
 * (HMAC-SHA256、タイムスタンプ+nonce付き)を採用する。ブラウザは経由せず、
 * 本体Workerがサーバー間でr9.nekomaneki.workへ直接fetchする。
 */

const R9_ORIGIN = 'https://r9.nekomaneki.work/';
const R9_RESPONSE_BODY_LIMIT = 500 * 1024;

const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

export async function r9Signature(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  contentType: string
): Promise<string> {
  const digest = async (value: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  const canonical = ['r9-v1', method, path, timestamp, nonce, await digest(contentType)].join('\n');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(canonical)));
}

export type R9StatusResult =
  | { ok: true; status: number; bodyText: string }
  | { ok: false; errorCode: 'redirect' | 'http_error' | 'network_error'; detail: string; status?: number };

/**
 * r9.nekomaneki.workへ署名付きGETを送り、本文をそのまま返す。
 * リダイレクトは追跡しない(署名ヘッダーが別ホストへ漏れる可能性があるため)。
 */
export async function fetchR9Status(secret: string, fetchImpl: typeof fetch = fetch): Promise<R9StatusResult> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const signature = await r9Signature(secret, 'GET', '/', timestamp, nonce, '');

  let response: Response;
  try {
    response = await fetchImpl(R9_ORIGIN, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
      headers: {
        'X-R9-Timestamp': timestamp,
        'X-R9-Nonce': nonce,
        'X-R9-Signature': signature,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, errorCode: 'network_error', detail: `r9.nekomaneki.workに接続できません: ${message}` };
  }

  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    return { ok: false, errorCode: 'redirect', detail: `r9.nekomaneki.workがリダイレクトを返しました(ステータス${response.status})。` };
  }

  const bodyText = (await response.text()).slice(0, R9_RESPONSE_BODY_LIMIT);

  if (!response.ok) {
    return { ok: false, errorCode: 'http_error', status: response.status, detail: bodyText };
  }

  return { ok: true, status: response.status, bodyText };
}
