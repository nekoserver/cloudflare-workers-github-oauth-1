import defaults from '../data/conversation-stream-routes.json';

/**
 * 会話ストリームの接続先(コンテナのCloudflare Tunnel公開ホスト)の台帳。
 * どのコンテナを起動するかでトンネルの公開ホストが変わるため、接続先は
 * src/data/conversation-stream-routes.json(台帳)を書き換えて切り替える(試験運用)。
 * 台帳が不正なときは、誤った接続先を黙って使わないよう止める。
 */

/** 埋め込みページと各通信方式のURL。lib側(conversation-embed.html・chat/*.mjs)のパスと対応する。 */
export type ConversationStreamEndpoints = {
  embed: string;
  websocket: string;
  sse: string;
  ndjson: string;
  jsonseq: string;
};

export type ConversationStreamRoute = {
  id: string;
  origin: string;
  label: string;
  endpoints: ConversationStreamEndpoints;
};

export type ConversationStreamRoutes = {
  /** 接続先の選択肢の表示順(有効なものだけ)。 */
  routes: ConversationStreamRoute[];
  /** 「自動」で試す順(有効なものだけ)。 */
  autoPriority: string[];
};

type LedgerRoute = { id?: unknown; origin?: unknown; label?: unknown; enabled?: unknown };
type Ledger = { autoPriority?: unknown; routes?: unknown };

const ROUTE_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

function invalid(detail: string): never {
  throw new Error(`会話ストリームの接続先の設定が不正です: ${detail}`);
}

function bareOrigin(value: unknown): string {
  if (typeof value !== 'string') invalid('originは文字列で指定してください');
  let url: URL;
  try { url = new URL(value); } catch { invalid(`originをURLとして解釈できません(${value})`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    invalid(`originはパス・認証情報・クエリなしのHTTPSにしてください(${value})`);
  }
  return url.origin;
}

/** トンネルの公開ホストから、埋め込みページと各通信方式のURLを組み立てる。 */
export function conversationStreamEndpoints(origin: string): ConversationStreamEndpoints {
  const base = bareOrigin(origin);
  const websocket = new URL('/lib/api/chat/ws', base);
  websocket.protocol = 'wss:';
  return {
    embed: new URL('/lib/conversation-embed.html', base).href,
    websocket: websocket.href,
    sse: new URL('/lib/api/chat/sse', base).href,
    ndjson: new URL('/lib/api/chat/ndjson', base).href,
    jsonseq: new URL('/lib/api/chat/jsonseq', base).href,
  };
}

/** 台帳を検証して接続先を解決する。引数を省くと同梱の台帳。 */
export function resolveConversationStreamRoutes(source: unknown = defaults): ConversationStreamRoutes {
  const ledger = source as Ledger;
  if (!ledger || typeof ledger !== 'object' || !Array.isArray(ledger.routes)) invalid('routes(配列)が必要です');
  const ids = new Set<string>();
  const routes: ConversationStreamRoute[] = [];
  for (const entry of ledger.routes as LedgerRoute[]) {
    if (!entry || typeof entry !== 'object') invalid('routesの要素はオブジェクトにしてください');
    const { id, label, enabled } = entry;
    if (typeof id !== 'string' || !ROUTE_ID.test(id) || id === 'auto') invalid(`IDは英小文字・数字・ハイフンにしてください(autoは予約): ${String(id)}`);
    if (ids.has(id)) invalid(`IDが重複しています: ${id}`);
    ids.add(id);
    if (enabled !== undefined && typeof enabled !== 'boolean') invalid(`enabledは真偽値にしてください: ${id}`);
    if (label !== undefined && (typeof label !== 'string' || !label.trim() || label.length > 80)) invalid(`labelは1〜80文字の文字列にしてください: ${id}`);
    const origin = bareOrigin(entry.origin);
    if (enabled === false) continue;
    routes.push({ id, origin, label: label === undefined ? new URL(origin).host : label, endpoints: conversationStreamEndpoints(origin) });
  }
  if (routes.length === 0) invalid('有効な接続先がありません');
  let priority = routes.map(route => route.id);
  if (ledger.autoPriority !== undefined) {
    if (!Array.isArray(ledger.autoPriority)) invalid('autoPriorityは配列にしてください');
    const seen = new Set<string>();
    for (const id of ledger.autoPriority) {
      if (typeof id !== 'string' || !ids.has(id)) invalid(`autoPriorityに未登録のIDがあります: ${String(id)}`);
      if (seen.has(id)) invalid(`autoPriorityのIDが重複しています: ${id}`);
      seen.add(id);
    }
    const enabled = new Set(priority);
    // 無効化した接続先は自動選択からも外す。台帳に載せ忘れた有効な接続先は自動選択の対象にしない。
    priority = (ledger.autoPriority as string[]).filter(id => enabled.has(id));
  }
  return { routes, autoPriority: priority };
}

/** CSPのframe-srcに並べるorigin(自動選択の順、重複なし)。 */
export function conversationStreamFrameOrigins({ routes, autoPriority }: ConversationStreamRoutes): string {
  const byId = new Map(routes.map(route => [route.id, route.origin]));
  const ordered = [...autoPriority.map(id => byId.get(id)!), ...routes.map(route => route.origin)];
  return [...new Set(ordered)].join(' ');
}
