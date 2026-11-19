import { conversationStreamEndpoints, type ConversationStreamRoute, type ConversationStreamRoutes } from './conversationStreamRoutes';

/**
 * 会話ストリームの接続先を、台帳(src/data/conversation-stream-routes.json)を既定とし、
 * D1 conversation_stream_hosts(マイグレーション0194)の行で上書きする。
 *
 * - 同じIDの行: 台帳の位置を保ったまま、origin・表示名を上書きする。
 * - 台帳に無いIDの行: 選択肢の末尾(優先度の昇順)に加える。
 * - enabled=0の行: その接続先を選択肢と自動選択の両方から外す。
 * - 自動選択: 台帳のautoPriorityの先頭から10,20,…の優先度とし、D1の有効な行はその行の優先度で加わる。
 *   優先度の昇順(同じならID順)で並べる。
 * D1に行が無ければ、台帳の解決結果をそのまま返す。行を消せば台帳の値に戻る。
 */

export type ConversationStreamHostRecord = {
  id: string;
  label: string;
  origin: string;
  priority: number;
  enabled: boolean;
};

export type ConversationStreamHostErrorCode =
  | 'invalid_body'
  | 'invalid_id'
  | 'invalid_label'
  | 'invalid_origin'
  | 'origin_not_allowed'
  | 'invalid_priority';

export type NormalizedConversationStreamHost =
  | { ok: true; value: Omit<ConversationStreamHostRecord, 'enabled'> }
  | { ok: false; errorCode: ConversationStreamHostErrorCode; detail: string };

export type SkippedConversationStreamHost = { id: string; errorCode: ConversationStreamHostErrorCode };

export type ConversationStreamOverrideResult =
  | { ok: true; config: ConversationStreamRoutes; applied: number; skipped: SkippedConversationStreamHost[] }
  | { ok: false; errorCode: 'no_enabled_routes'; detail: string; skipped: SkippedConversationStreamHost[] };

/** 台帳のIDと同じ形(英小文字・数字・ハイフン、autoは予約)。 */
const ROUTE_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
/** 接続先にできるドメイン。ヘルスチェックが任意のURLを取りに行かないよう、ここに限る。 */
const ALLOWED_HOST_SUFFIXES = ['nekomaneki.work', 'nekoflare.workers.dev'];
const MAX_PRIORITY = 10_000;

function failure(errorCode: ConversationStreamHostErrorCode, detail: string): NormalizedConversationStreamHost {
  return { ok: false, errorCode, detail };
}

/** 管理APIの入力とD1の行を、台帳と同じ規則で検証する。 */
export function normalizeConversationStreamHost(input: unknown): NormalizedConversationStreamHost {
  if (!input || typeof input !== 'object') return failure('invalid_body', '接続先はJSONオブジェクトで指定してください');
  const value = input as Record<string, unknown>;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  if (!ROUTE_ID.test(id) || id === 'auto') return failure('invalid_id', 'IDは英小文字・数字・ハイフンで32文字まで(autoは予約)にしてください');
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  if (!label || label.length > 80) return failure('invalid_label', '表示名は1〜80文字にしてください');
  if (typeof value.origin !== 'string' || value.origin.length > 512) return failure('invalid_origin', '接続先はHTTPSのURLで指定してください');
  let url: URL;
  try { url = new URL(value.origin); } catch { return failure('invalid_origin', '接続先のURLを解釈できません'); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || !ALLOWED_HOST_SUFFIXES.some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`))) {
    return failure('origin_not_allowed', `接続先は ${ALLOWED_HOST_SUFFIXES.join('・')} 配下の、パス・ポートなしのHTTPSオリジンにしてください`);
  }
  const priority = Number(value.priority);
  if (!Number.isInteger(priority) || priority < 0 || priority > MAX_PRIORITY) return failure('invalid_priority', `優先度は0〜${MAX_PRIORITY}の整数にしてください`);
  return { ok: true, value: { id, label, origin: url.origin, priority } };
}

/** 台帳の解決結果に、D1の行を重ねる。 */
export function applyConversationStreamOverrides(base: ConversationStreamRoutes, rows: ConversationStreamHostRecord[]): ConversationStreamOverrideResult {
  const skipped: SkippedConversationStreamHost[] = [];
  const routes = new Map<string, ConversationStreamRoute>(base.routes.map(route => [route.id, route]));
  const order = base.routes.map(route => route.id);
  const priority = new Map<string, number>(base.autoPriority.map((id, index) => [id, (index + 1) * 10]));
  const added: { id: string; priority: number }[] = [];
  let applied = 0;

  for (const row of rows) {
    const normalized = normalizeConversationStreamHost(row);
    if (!normalized.ok) {
      skipped.push({ id: String((row as { id?: unknown })?.id ?? ''), errorCode: normalized.errorCode });
      continue;
    }
    const host = normalized.value;
    applied += 1;
    if (!row.enabled) {
      routes.delete(host.id);
      priority.delete(host.id);
      continue;
    }
    if (!routes.has(host.id) && !order.includes(host.id)) added.push({ id: host.id, priority: host.priority });
    routes.set(host.id, { id: host.id, origin: host.origin, label: host.label, endpoints: conversationStreamEndpoints(host.origin) });
    priority.set(host.id, host.priority);
  }

  const byPriority = (a: { id: string; priority: number }, b: { id: string; priority: number }) => a.priority - b.priority || a.id.localeCompare(b.id);
  const ids = [...order, ...added.sort(byPriority).map(entry => entry.id)].filter(id => routes.has(id));
  if (ids.length === 0) {
    return { ok: false, errorCode: 'no_enabled_routes', detail: 'D1の上書きで有効な接続先がなくなります', skipped };
  }
  const autoPriority = [...priority.entries()]
    .filter(([id]) => routes.has(id))
    .map(([id, value]) => ({ id, priority: value }))
    .sort(byPriority)
    .map(entry => entry.id);
  return { ok: true, config: { routes: ids.map(id => routes.get(id)!), autoPriority }, applied, skipped };
}
