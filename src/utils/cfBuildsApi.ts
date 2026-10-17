/**
 * 対象: /cf-containersページから、Workers Builds(Git連携の本番ビルド)の
 * ログを取得する機能。ビルドが失敗してもダッシュボードを開かずに原因を
 * 確認できるようにする。
 *
 * wrangler deployはコンテナイメージのビルドより先にWorkerコードを有効化する
 * (出典: https://developers.cloudflare.com/containers/configuration/rollouts/
 * 「The Worker is active before the image and rollout steps begin」)ため、
 * イメージのビルドが失敗していてもこの取得機能自体は本番で動く。
 *
 * Builds APIはユーザー単位のAPIトークンが必要(Workers Builds Configuration権限)。
 */
export type CfBuildsCredentials = { accountId: string; apiKey: string };

type Envelope<T> = { success: boolean; result: T; errors?: Array<{ code?: number; message?: string }> };

const API = 'https://api.cloudflare.com/client/v4';

async function call<T>(url: string, credentials: CfBuildsCredentials, fetcher: typeof fetch): Promise<T> {
  const response = await fetcher(url, { headers: { Authorization: `Bearer ${credentials.apiKey}` } });
  const payload = (await response.json()) as Envelope<T>;
  if (!response.ok || !payload.success) {
    const message = payload.errors?.map((e) => `${e.message}(code ${e.code})`).join(', ');
    throw new Error(`${message || 'Cloudflare API error'} [HTTP ${response.status}]`);
  }
  return payload.result;
}

/** ログAPIの各行([timestamp, line] / {message} / 文字列)を1行ずつの文字列にする。 */
export function formatBuildLogLines(lines: unknown[]): string {
  return lines
    .map((entry) => {
      if (Array.isArray(entry)) return String(entry[entry.length - 1] ?? '');
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        return String(obj.message ?? obj.line ?? JSON.stringify(obj));
      }
      return String(entry);
    })
    .join('\n');
}

export async function fetchLatestBuildLog(
  credentials: CfBuildsCredentials,
  scriptName: string,
  buildUuid?: string,
  fetcher: typeof fetch = fetch
): Promise<{ buildUuid: string; status: string | null; log: string }> {
  const account = `${API}/accounts/${encodeURIComponent(credentials.accountId)}`;
  let uuid = buildUuid;
  let status: string | null = null;
  if (!uuid) {
    const scripts = await call<Array<{ id: string; tag: string }>>(`${account}/workers/scripts`, credentials, fetcher);
    const tag = scripts.find((s) => s.id === scriptName)?.tag;
    if (!tag) throw new Error(`Worker ${scriptName} が一覧に見つかりません`);
    const builds = await call<Array<{ build_uuid: string; status?: string; created_on?: string }>>(
      `${account}/builds/workers/${encodeURIComponent(tag)}/builds`,
      credentials,
      fetcher
    );
    const latest = [...builds].sort((a, b) => String(b.created_on ?? '').localeCompare(String(a.created_on ?? '')))[0];
    if (!latest) throw new Error('ビルド履歴がありません');
    uuid = latest.build_uuid;
    status = latest.status ?? null;
  }
  const result = await call<{ lines?: unknown[] } | unknown[]>(
    `${account}/builds/builds/${encodeURIComponent(uuid)}/logs`,
    credentials,
    fetcher
  );
  const lines = Array.isArray(result) ? result : result?.lines ?? [];
  return { buildUuid: uuid, status, log: formatBuildLogLines(lines) };
}
