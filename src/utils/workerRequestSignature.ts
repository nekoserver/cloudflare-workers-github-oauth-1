// 本Workerが他Worker(cf-auth・dynamicneko等)のエンドポイントを呼ぶ際に使う、
// CF-Workerヘッダー+HMAC-SHA256照合方式の署名ヘッダー生成。
// SPEC.cloudflare-workers-github-oauth-1.20261008.worker-auth-policy.md /
// CLAUDE.mdルール38で定義された、ワーカー間リクエスト認証の基準方式の
// 最初の実装(本Workerが呼び出し元になるケース)。verifyGitHubWebhookSignature
// (src/utils/githubWebhook.ts)と同じcrypto.subtle HMAC-SHA256を使う。
//
// 署名対象文字列は "{caller}\n{timestamp}\n{method}\n{path}\n{rawBody}"。
// pathはクエリ文字列を含む(例: "/api/wspace/repo-check?repo=nekoserver%2Frailway")。
// 呼び出し元(本関数)と受信側(verify側、他リポジトリに実装)が全く同じpath文字列を
// 使わないと署名が一致しないため、呼び出し側はURLオブジェクトのpathname+searchを、
// 受信側もnew URL(c.req.url).pathname + .searchを使うことで一致させる。

export const MAIN_WORKER_NAME = 'cloudflare-workers-github-oauth-1';

export type WorkerSignatureHeaders = {
  'CF-Worker': string;
  'CF-Worker-Timestamp': string;
  'CF-Worker-Signature': string;
};

/**
 * HMAC計算前の署名対象メッセージを組み立てる純粋関数(テスト容易化のため、
 * crypto.subtleを呼ぶ本体から切り出した)。
 */
export function buildWorkerSignatureMessage(
  callerName: string,
  timestamp: number,
  method: string,
  path: string,
  rawBody: string
): string {
  return `${callerName}\n${timestamp}\n${method.toUpperCase()}\n${path}\n${rawBody}`;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * CF-Worker / CF-Worker-Timestamp / CF-Worker-Signature の3ヘッダーを組み立てる。
 * timestampは省略時に現在時刻(UNIX秒)を使う(テストから固定値を注入できるよう引数化)。
 */
export async function signWorkerRequest(
  secret: string,
  callerName: string,
  method: string,
  path: string,
  rawBody: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): Promise<WorkerSignatureHeaders> {
  const message = buildWorkerSignatureMessage(callerName, timestamp, method, path, rawBody);
  const hex = await hmacSha256Hex(secret, message);
  return {
    'CF-Worker': callerName,
    'CF-Worker-Timestamp': String(timestamp),
    'CF-Worker-Signature': `sha256=${hex}`,
  };
}
