/**
 * Cloudflare Tunnel(cfd_tunnel)一覧取得。/cf-containersページで
 * nekorootトンネルを含むアカウント内の各トンネルの状態を確認するために使う。
 * `lib`リポジトリの`api/tunnels_lib.rb`と同様の方針(許可フィールドのみ
 * 返す・秘密情報は含めない)。
 */
export type CloudflareTunnelCredentials = {
  accountId: string;
  apiKey: string;
  apiEmail?: string;
};

type CloudflareTunnelRaw = {
  id?: string;
  name?: string;
  connections?: Array<{ colo_name?: string }>;
};

export type CloudflareTunnelSummary = {
  id: string;
  name: string;
  status: 'healthy' | 'down';
  connectionCount: number;
};

type CloudflareEnvelope<T> = {
  success: boolean;
  result: T;
  errors?: Array<{ code?: number; message?: string }>;
};

/** connections配列が1件以上あればhealthy、空または欠落していればdown。 */
export function summarizeTunnelStatus(tunnel: CloudflareTunnelRaw): 'healthy' | 'down' {
  return Array.isArray(tunnel.connections) && tunnel.connections.length > 0 ? 'healthy' : 'down';
}

export async function listCloudflareTunnels(
  credentials: CloudflareTunnelCredentials,
  fetcher: typeof fetch = fetch
): Promise<CloudflareTunnelSummary[]> {
  const response = await fetcher(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId)}/cfd_tunnel?is_deleted=false`,
    {
      headers: credentials.apiEmail
        ? { "X-Auth-Email": credentials.apiEmail, "X-Auth-Key": credentials.apiKey }
        : { Authorization: `Bearer ${credentials.apiKey}` },
    }
  );
  const payload = (await response.json()) as CloudflareEnvelope<CloudflareTunnelRaw[]>;
  if (!response.ok || !payload.success) {
    const message = payload.errors?.map((error) => error.message).filter(Boolean).join(', ');
    throw new Error(message || `Cloudflare API error (${response.status})`);
  }
  return (payload.result ?? []).map((tunnel) => ({
    id: tunnel.id ?? '',
    name: tunnel.name ?? '',
    status: summarizeTunnelStatus(tunnel),
    connectionCount: tunnel.connections?.length ?? 0,
  }));
}
