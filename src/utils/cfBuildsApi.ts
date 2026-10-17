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
): Promise<{ buildUuid: string; status: string | null; log: string; recentBuilds: string[]; responseShape: string[] }> {
  const account = `${API}/accounts/${encodeURIComponent(credentials.accountId)}`;
  let uuid = buildUuid;
  let status: string | null = null;
  let recentBuilds: string[] = [];
  if (!uuid) {
    const scripts = await call<Array<{ id: string; tag: string }>>(`${account}/workers/scripts`, credentials, fetcher);
    const tag = scripts.find((s) => s.id === scriptName)?.tag;
    if (!tag) throw new Error(`Worker ${scriptName} が一覧に見つかりません`);
    const builds = await call<Array<{ build_uuid: string; status?: string; created_on?: string }>>(
      `${account}/builds/workers/${encodeURIComponent(tag)}/builds`,
      credentials,
      fetcher
    );
    const sorted = [...builds].sort((a, b) => String(b.created_on ?? '').localeCompare(String(a.created_on ?? '')));
    // 「停止(stopped)」が新しいビルドに置き換えられたものかを判別できるよう直近の状態も返す
    recentBuilds = sorted.slice(0, 8).map((b) => `${b.created_on ?? '?'} ${b.status ?? '?'} ${b.build_uuid}`);
    const latest = sorted[0];
    if (!latest) throw new Error('ビルド履歴がありません');
    uuid = latest.build_uuid;
    status = latest.status ?? null;
  }
  // ログAPIはページ分割(truncated + cursor)で返るため、続きがある間は読み進める
  const MAX_PAGES = 50;
  const lines: unknown[] = [];
  let cursor: string | undefined;
  // 実APIの応答の形をそのまま記録する(想定したモックではなく実応答でテストを作るため)
  const responseShape: string[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${account}/builds/builds/${encodeURIComponent(uuid)}/logs` + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : '');
    const result = await call<{ lines?: unknown[]; truncated?: boolean; cursor?: string } | unknown[]>(url, credentials, fetcher);
    responseShape.push(describeShape(page, result));
    if (Array.isArray(result)) {
      lines.push(...result);
      break;
    }
    lines.push(...(result?.lines ?? []));
    if (!result?.truncated || !result.cursor || result.cursor === cursor) break;
    cursor = result.cursor;
  }
  return { buildUuid: uuid, status, log: formatBuildLogLines(lines), recentBuilds, responseShape };
}

/** ログAPIの1ページ分の応答の形(値は含めない)を1行で表す。 */
export function describeShape(page: number, result: unknown): string {
  if (Array.isArray(result)) return `page${page}: array(len=${result.length}) first=${JSON.stringify(result[0] ?? null).slice(0, 80)}`;
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    const parts = Object.keys(obj).map((k) => {
      const v = obj[k];
      if (Array.isArray(v)) return `${k}:array(len=${v.length}) first=${JSON.stringify(v[0] ?? null).slice(0, 80)}`;
      if (k === 'cursor') return `${k}:${v ? 'present' : String(v)}`;
      return `${k}:${typeof v === 'object' ? 'object' : JSON.stringify(v)}`;
    });
    return `page${page}: {${parts.join(', ')}}`;
  }
  return `page${page}: ${typeof result}`;
}
