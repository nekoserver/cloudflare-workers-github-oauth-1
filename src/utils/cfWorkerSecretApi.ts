/**
 * 対象: /cf-containersページから、nekorootトンネルのトークン等のsecretを
 * Cloudflare Workers Scripts APIへ直接設定する機能。CLIが使えない環境
 * (タブレット等)でも、ページ上のフォームからsecretを設定できるようにする。
 *
 * このWorker自身がCloudflare API(api.cloudflare.com)を呼ぶため、
 * ローカル開発サンドボックスのネットワーク制約とは無関係に動く
 * (Cloudflare上で実行されるWorkerは通常のインターネット接続を持つ)。
 *
 * 任意のsecret名を書き換えられる口にしないよう、ALLOWED_SECRET_NAMESに
 * ある名前だけを許可する(JWT_SECRET等の重要なsecretを誤って上書きできない
 * ようにする)。
 */
export const ALLOWED_SECRET_NAMES = ['NEKOROOT_TUNNEL_TOKEN', 'TAILSCALE_AUTHKEY'] as const;
export type AllowedSecretName = (typeof ALLOWED_SECRET_NAMES)[number];

export type CfWorkerSecretCredentials = {
  accountId: string;
  apiKey: string;
  apiEmail?: string;
};

type CloudflareEnvelope<T> = {
  success: boolean;
  result: T;
  errors?: Array<{ code?: number; message?: string }>;
};

function apiHeaders(credentials: CfWorkerSecretCredentials): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (credentials.apiEmail) {
    headers['X-Auth-Email'] = credentials.apiEmail;
    headers['X-Auth-Key'] = credentials.apiKey;
  } else {
    headers.Authorization = `Bearer ${credentials.apiKey}`;
  }
  return headers;
}

/**
 * Workers Scripts secrets APIへPUTし、Worker自身のsecretを設定する
 * (設定すると自動的にWorkerが再デプロイされる)。
 */
export async function setWorkerSecret(
  credentials: CfWorkerSecretCredentials,
  scriptName: string,
  secretName: AllowedSecretName,
  value: string,
  fetcher: typeof fetch = fetch
): Promise<void> {
  if (!(ALLOWED_SECRET_NAMES as readonly string[]).includes(secretName)) {
    throw new Error(`許可されていないsecret名です: ${secretName}`);
  }
  const response = await fetcher(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId)}/workers/scripts/${encodeURIComponent(scriptName)}/secrets`,
    {
      method: 'PUT',
      headers: apiHeaders(credentials),
      body: JSON.stringify({ name: secretName, text: value, type: 'secret_text' }),
    }
  );
  const payload = (await response.json()) as CloudflareEnvelope<unknown>;
  if (!response.ok || !payload.success) {
    const message = payload.errors?.map((e) => e.message).filter(Boolean).join(', ');
    throw new Error(message || `Cloudflare API error (${response.status})`);
  }
}
