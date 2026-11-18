import defaults from '../data/askgk-routes.json';

export type AskgkRouteSettings = {
  ASKGK_ROUTES?: string;
  ASKGK_ROUTE_ID?: string;
  ASKGK_TUNNELS_URL?: string;
};

type Route = { id: string; url: string; enabled?: boolean };
type Registry = { defaultRouteId: string; engineRoutes?: Record<string, string>; routes: Route[] };

/**
 * `◯◯_prompt="..."` の◯◯(エンジン名)。接頭語がなければ undefined。
 * 経路を選ぶためだけに読む。tunnelsへ送る文字列からは接頭語を剥がさない。
 */
export function askgkEngine(message: string): string | undefined {
  return message.match(/^\s*([a-z0-9]+)_prompt\s*=/i)?.[1].toLowerCase();
}

function endpoint(value: unknown): string {
  if (typeof value !== 'string') throw new Error('askgk経路のURLが不正です');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('askgk経路のURLが不正です'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('askgk経路には認証情報・フラグメントなしのHTTPS URLを指定してください');
  }
  return url.href;
}

/**
 * Resolve for every operation. An explicit invalid registry never falls back.
 * engineRoutes にエンジンの送り先があれば、ASKGK_ROUTE_ID・defaultRouteId より優先する
 * (例: Claude CLIのないRedmineコンテナへclaudeの依頼を送らない)。
 */
export function resolveAskgkRoute(settings: AskgkRouteSettings = {}, engine?: string): string {
  // Preserve existing single-endpoint deployments until they adopt the registry.
  if (settings.ASKGK_ROUTES === undefined && settings.ASKGK_ROUTE_ID === undefined && settings.ASKGK_TUNNELS_URL?.trim()) {
    return endpoint(settings.ASKGK_TUNNELS_URL.trim());
  }
  let registry: Registry;
  try {
    registry = settings.ASKGK_ROUTES === undefined ? defaults : JSON.parse(settings.ASKGK_ROUTES);
  } catch { throw new Error('ASKGK_ROUTESをJSONとして解釈できません'); }
  if (!registry || typeof registry.defaultRouteId !== 'string' || !Array.isArray(registry.routes)) {
    throw new Error('askgk経路設定にはdefaultRouteIdとroutesが必要です');
  }
  const ids = new Set<string>();
  for (const route of registry.routes) {
    if (!route || typeof route.id !== 'string' || !route.id.trim() || ids.has(route.id) ||
        (route.enabled !== undefined && typeof route.enabled !== 'boolean')) {
      throw new Error('askgk経路のID・有効状態が不正、またはIDが重複しています');
    }
    ids.add(route.id);
    endpoint(route.url);
  }
  const engineRoutes = registry.engineRoutes ?? {};
  if (typeof engineRoutes !== 'object' || Array.isArray(engineRoutes) ||
      Object.values(engineRoutes).some(id => typeof id !== 'string' || !ids.has(id))) {
    throw new Error('askgk経路のengineRoutesには、登録済みの経路IDを指定してください');
  }
  const engineRouteId = engine && Object.hasOwn(engineRoutes, engine) ? engineRoutes[engine] : undefined;
  const id = engineRouteId ?? settings.ASKGK_ROUTE_ID ?? registry.defaultRouteId;
  const selected = registry.routes.find(route => route.id === id);
  if (!selected || selected.enabled === false) {
    throw new Error(`askgk経路「${id}」は未登録または無効です${engineRouteId ? `(${engine}の送り先)` : ''}`);
  }
  return endpoint(selected.url);
}
