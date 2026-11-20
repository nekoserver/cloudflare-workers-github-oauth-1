/**
 * /muse-search のスレッド検索(スレッド一覧のタイトルの絞り込み)の記録(D1 muse_thread_search_log、マイグレーション0199、2026-11-20、ユーザー指定)。
 * 検索キー・ヒット件数・ヒットしたスレッドIDを1行追記する。追記のみ(同じキーを何度検索しても行が増える)。
 *
 * - ヒット件数は、重複を除いたスレッドIDの数から作る。呼び出し元の件数は受け取らない(ずれない)。
 * - 失敗は文字列のprefixではなく、判別可能な型(ok / errorCode)で返す(ルール32)。
 */

export const MUSE_THREAD_SEARCH_KEY_MAX = 500;
export const MUSE_THREAD_SEARCH_IDS_MAX = 2000;

export type MuseThreadSearchErrorCode = 'invalid_key' | 'invalid_thread_ids' | 'db_missing' | 'db_error';
export type MuseThreadSearchResult =
  | { ok: true; value: { hitCount: number } }
  | { ok: false; errorCode: MuseThreadSearchErrorCode; detail: string };

export async function recordThreadSearch(
  db: D1Database | undefined,
  input: { userId: string; key: string; threadIds: string[]; searchedAt?: string },
): Promise<MuseThreadSearchResult> {
  const key = typeof input.key === 'string' ? input.key.trim().toLowerCase() : '';
  if (!key || key.length > MUSE_THREAD_SEARCH_KEY_MAX) return { ok: false, errorCode: 'invalid_key', detail: '検索キーは1〜' + MUSE_THREAD_SEARCH_KEY_MAX + '文字で指定してください' };
  const ids = input.threadIds;
  if (!Array.isArray(ids) || ids.length > MUSE_THREAD_SEARCH_IDS_MAX || ids.some((id) => typeof id !== 'string' || id.trim() === '')) {
    return { ok: false, errorCode: 'invalid_thread_ids', detail: 'スレッドIDは、空でない文字の配列(最大' + MUSE_THREAD_SEARCH_IDS_MAX + '件)で指定してください' };
  }
  if (!db) return { ok: false, errorCode: 'db_missing', detail: 'D1(DB)が未設定のため、スレッド検索を記録できません' };
  const unique = [...new Set(ids)];
  try {
    await db.prepare(
      'INSERT INTO muse_thread_search_log (user_id, search_key, hit_count, thread_ids, searched_at) VALUES (?1, ?2, ?3, ?4, ?5)',
    ).bind(input.userId, key, unique.length, JSON.stringify(unique), input.searchedAt ?? new Date().toISOString()).run();
  } catch (cause) {
    return { ok: false, errorCode: 'db_error', detail: cause instanceof Error ? cause.message : String(cause) };
  }
  return { ok: true, value: { hitCount: unique.length } };
}
