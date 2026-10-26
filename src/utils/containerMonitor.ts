import { collectContainerFleet } from './containerFleet';

export type MonitorEnv = {
  CLOUDFLARE_ACCOUNT_ID?: string; CF_CONTAINER_API_TOKEN?: string;
  CLOUDFLARE_API_TOKEN?: string; CLOUDFLARE_API_KEY?: string; CLOUDFLARE_API_EMAIL?: string;
  TAILSCALE_API_TOKEN?: string; TAILSCALE_TAILNET?: string;
};
export type MonitorTarget = { id: string; name: string; group: string; status: string; addresses: string[]; observedAt: string | null; detail: string };
export type MonitorSnapshot = { provider: string; scope: string; fetchedAt: string; complete: boolean; targets: MonitorTarget[]; errors: string[] };
type Provider = { id: string; label: string; execution: 'worker' | 'browser'; scope: string; available: (env: MonitorEnv) => boolean; collect?: (env: MonitorEnv, fetcher: typeof fetch) => Promise<MonitorSnapshot> };
const cloudflareToken = (env: MonitorEnv) => env.CF_CONTAINER_API_TOKEN?.trim() || env.CLOUDFLARE_API_TOKEN?.trim();

/** One registry drives UI choices and server dispatch; secrets never leave the Worker. */
const providers: Provider[] = [
  {
    id: 'cloudflare-api', label: 'Cloudflare API', execution: 'worker', scope: 'Cloudflare APIから参照可能な全アプリケーション・インスタンス',
    available: env => !!env.CLOUDFLARE_ACCOUNT_ID?.trim() && !!cloudflareToken(env),
    async collect(env, fetcher) {
      const result = await collectContainerFleet({ accountId: env.CLOUDFLARE_ACCOUNT_ID!, apiToken: cloudflareToken(env)! }, fetcher);
      return { provider: this.id, scope: this.scope, fetchedAt: result.fetchedAt, complete: result.complete,
        errors: result.applications.filter(app => app.error).map(app => `${app.name}: ${app.error}`),
        targets: result.applications.flatMap(app => app.instances.length ? app.instances.map(instance => ({
          id: `${app.id}/${instance.id}`, name: instance.name || instance.id, group: app.name, status: instance.state,
          addresses: [], observedAt: instance.updatedAt, detail: [instance.region, instance.exitCode === null ? '' : `終了コード ${instance.exitCode}`].filter(Boolean).join(' / '),
        })) : [{ id: app.id, name: app.name, group: app.name, status: app.complete ? 'no-instances' : 'unknown', addresses: [], observedAt: null, detail: app.error || 'インスタンス記録なし' }]) };
    },
  },
  {
    id: 'tailscale-api', label: 'Tailscale API', execution: 'worker', scope: 'APIトークンから参照できるTailnetの端末',
    available: env => !!env.TAILSCALE_API_TOKEN?.trim(),
    async collect(env, fetcher) {
      const response = await fetcher(`https://api.tailscale.com/api/v2/tailnet/${encodeURIComponent(env.TAILSCALE_TAILNET?.trim() || '-')}/devices`, {
        headers: { Authorization: `Bearer ${env.TAILSCALE_API_TOKEN!.trim()}` }, signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Tailscale API HTTP ${response.status}`);
      const data = await response.json() as { devices?: Record<string, unknown>[] };
      if (!Array.isArray(data.devices)) throw new Error('Tailscale APIの一覧形式が不正です');
      return { provider: this.id, scope: this.scope, fetchedAt: new Date().toISOString(), complete: true, errors: [], targets: data.devices.map(device => ({
        id: String(device.id ?? ''), name: String(device.name ?? device.hostname ?? device.id ?? ''), group: 'Tailnet',
        status: typeof device.online === 'boolean' ? device.online ? 'online' : 'offline' : 'unknown',
        addresses: Array.isArray(device.addresses) ? device.addresses.filter((value): value is string => typeof value === 'string') : [],
        observedAt: typeof device.lastSeen === 'string' ? device.lastSeen : null, detail: 'Tailscale登録端末',
      })) };
    },
  },
  { id: 'tailscale-wasm', label: 'Tailscale WASM', execution: 'browser', scope: 'ログインしたTailscaleユーザーから見える端末', available: () => true },
];

export function getContainerMonitorProviders(env: MonitorEnv) {
  const available = providers.filter(provider => provider.available(env));
  return { defaultProvider: available[0].id, providers: available.map(({ id, label, execution, scope }) => ({ id, label, execution, scope })) };
}
export async function collectContainerMonitor(env: MonitorEnv, id: string, fetcher: typeof fetch = fetch): Promise<MonitorSnapshot> {
  const provider = providers.find(provider => provider.id === id);
  if (!provider || !provider.available(env)) throw new Error('選択した取得方式は利用できません');
  if (!provider.collect) throw new Error('この取得方式はブラウザで実行します');
  return provider.collect(env, fetcher);
}
