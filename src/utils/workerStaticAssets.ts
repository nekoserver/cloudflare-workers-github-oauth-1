import type { Bindings } from '../types';

const API = 'https://api.cloudflare.com/client/v4';

export type WorkerStaticAssetEntry = {
  name: string;
  hasAssets: boolean | null;
  modifiedOn: string | null;
  tag: string | null;
  sourceDirectory: string | null;
};

export type WorkerStaticAssetsResult = {
  checkedAt: string;
  workers: WorkerStaticAssetEntry[];
};

type ScriptRecord = { id?: unknown; tag?: unknown; modified_on?: unknown; has_assets?: unknown };
type Envelope<T> = { success?: boolean; result?: T; errors?: Array<{ code?: number; message?: string }> };

/** Cloudflare API上のWorker一覧から、現在配備されているStatic Assetsの有無を返す。 */
export async function collectWorkerStaticAssets(
  env: Pick<Bindings, 'CLOUDFLARE_ACCOUNT_ID' | 'CF_CONTAINER_API_TOKEN'>,
  fetcher: typeof fetch = fetch,
): Promise<WorkerStaticAssetsResult> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = env.CF_CONTAINER_API_TOKEN?.trim();
  if (!accountId || !token) throw new Error('Cloudflare APIのアカウントIDまたはAPIトークンが未設定です');
  const response = await fetcher(`${API}/accounts/${encodeURIComponent(accountId)}/workers/scripts`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const payload = (await response.json()) as Envelope<ScriptRecord[]>;
  if (!response.ok || payload.success !== true || !Array.isArray(payload.result)) {
    const message = payload.errors?.map((error) => error.message).filter(Boolean).join('、');
    throw new Error(`Cloudflare APIからWorker一覧を取得できませんでした（HTTP ${response.status}${message ? `: ${message}` : ''}）`);
  }
  const workers = payload.result
    .filter((script) => typeof script.id === 'string' && script.id.length > 0)
    .map((script) => ({
      name: script.id as string,
      hasAssets: typeof script.has_assets === 'boolean' ? script.has_assets : null,
      modifiedOn: typeof script.modified_on === 'string' ? script.modified_on : null,
      tag: typeof script.tag === 'string' ? script.tag : null,
      sourceDirectory: script.id === 'cloudflare-workers-github-oauth-1' ? './public' : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { checkedAt: new Date().toISOString(), workers };
}
