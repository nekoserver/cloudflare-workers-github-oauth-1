import * as logger from './logger';
import { resolveConversationStreamRoutes, type ConversationStreamRoutes } from './conversationStreamRoutes';
import {
  applyConversationStreamOverrides,
  type ConversationStreamHostRecord,
  type SkippedConversationStreamHost,
} from './conversationStreamOverrides';

/**
 * 会話ストリームの接続先を、台帳とD1 conversation_stream_hostsから決める。
 * ヘルスチェック・AIチャットのCSPと画面・tree-viewへ渡す接続先は、すべてこの結果を使う。
 *
 * 台帳が不正なときは、今までどおり例外を投げる(呼び出し側が理由を返す)。
 * D1が無い・読めない・上書きで接続先がなくなるときは、台帳だけで動き、その事実を registry に残す。
 * registry は API の応答に載せ、ログを見なくても台帳だけで動いていることが分かるようにする。
 */

export type ConversationStreamRegistryStatus = {
  source: 'ledger' | 'ledger+d1';
  overrides: number;
  skipped: SkippedConversationStreamHost[];
  error?: 'registry_unavailable' | 'no_enabled_routes';
  detail?: string;
};

export type LoadedConversationStreamRoutes = {
  config: ConversationStreamRoutes;
  registry: ConversationStreamRegistryStatus;
};

type HostRow = { id: string; label: string; origin: string; priority: number; enabled: number };

/** D1の上書きの行を読む(優先度・ID順)。 */
export async function readConversationStreamHostRows(db: D1Database): Promise<ConversationStreamHostRecord[]> {
  const rows = await db.prepare('SELECT id, label, origin, priority, enabled FROM conversation_stream_hosts ORDER BY priority, id').all<HostRow>();
  return (rows.results ?? []).map(row => ({ id: row.id, label: row.label, origin: row.origin, priority: Number(row.priority), enabled: Number(row.enabled) === 1 }));
}

/** 台帳を既定とし、D1の行で上書きした接続先を返す。 */
export async function loadConversationStreamRoutes(db: D1Database | undefined): Promise<LoadedConversationStreamRoutes> {
  const ledger = resolveConversationStreamRoutes();
  if (!db) return { config: ledger, registry: { source: 'ledger', overrides: 0, skipped: [] } };
  let rows: ConversationStreamHostRecord[];
  try {
    rows = await readConversationStreamHostRows(db);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.warn('Conversation stream host registry unavailable; using the ledger only', { error: detail });
    return { config: ledger, registry: { source: 'ledger', overrides: 0, skipped: [], error: 'registry_unavailable', detail } };
  }
  const result = applyConversationStreamOverrides(ledger, rows);
  if (!result.ok) {
    logger.warn('Conversation stream host overrides leave no destination; using the ledger only', { detail: result.detail });
    return { config: ledger, registry: { source: 'ledger', overrides: 0, skipped: result.skipped, error: result.errorCode, detail: result.detail } };
  }
  if (result.skipped.length) logger.warn('Conversation stream host overrides skipped', { skipped: result.skipped });
  return {
    config: result.config,
    registry: { source: result.applied > 0 ? 'ledger+d1' : 'ledger', overrides: result.applied, skipped: result.skipped },
  };
}
