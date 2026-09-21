export type CloudflareD1Database = {
  uuid: string;
  name: string;
  created_at?: string;
  file_size?: number;
  num_tables?: number;
};

export type CloudflareD1Table = { name: string };

type CloudflareEnvelope<T> = {
  success: boolean;
  result: T;
  errors?: Array<{ code?: number; message?: string }>;
};

export type CloudflareD1Credentials = {
  accountId: string;
  apiKey: string;
  apiEmail?: string;
};

function apiHeaders(credentials: CloudflareD1Credentials): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (credentials.apiEmail) {
    headers['X-Auth-Email'] = credentials.apiEmail;
    headers['X-Auth-Key'] = credentials.apiKey;
  } else {
    // API Tokenも同じsecret名で利用可能にする。Global API Keyの場合は
    // CLOUDFLARE_API_EMAILも設定するとX-Auth-Key方式へ切り替わる。
    headers.Authorization = `Bearer ${credentials.apiKey}`;
  }
  return headers;
}

async function cloudflareRequest<T>(
  credentials: CloudflareD1Credentials,
  path: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch
): Promise<T> {
  const response = await fetcher(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { ...apiHeaders(credentials), ...(init.headers as Record<string, string> | undefined) },
  });
  const payload = await response.json() as CloudflareEnvelope<T>;
  if (!response.ok || !payload.success) {
    const message = payload.errors?.map((error) => error.message).filter(Boolean).join(', ');
    throw new Error(message || `Cloudflare API error (${response.status})`);
  }
  return payload.result;
}

export async function listCloudflareD1Databases(
  credentials: CloudflareD1Credentials,
  fetcher: typeof fetch = fetch
): Promise<CloudflareD1Database[]> {
  const result = await cloudflareRequest<CloudflareD1Database[]>(
    credentials,
    `/accounts/${encodeURIComponent(credentials.accountId)}/d1/database?per_page=100`,
    {},
    fetcher
  );
  return result;
}

export async function listCloudflareD1Tables(
  credentials: CloudflareD1Credentials,
  databaseId: string,
  fetcher: typeof fetch = fetch
): Promise<CloudflareD1Table[]> {
  const result = await cloudflareRequest<Array<{ results?: CloudflareD1Table[] }>>(
    credentials,
    `/accounts/${encodeURIComponent(credentials.accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
      }),
    },
    fetcher
  );
  return result[0]?.results ?? [];
}
