/**
 * /muse-search の検索キーの記録(D1 muse_search_key_log、マイグレーション0195、2026-11-19、ユーザー指定)。
 * 検索キーを、AIチャットの応答ログでの出現回数・tree-viewの会話ログでの出現回数・検索日時とともに追記する。
 * 🔑ボタンのモーダルは、キーごとの最新の値を、AIチャットでの出現回数の多い順に並べて見せる。
 *
 * - 記録は追記だけ(同じキーを何度検索しても行が増える)。一覧のための集計は、読むときに行から作る(別の集計表を持たないので、ずれない)。
 * - 「出現回数」は件数ではなく回数。本文の中に、キーが重ならずに現れた回数の合計。大文字小文字は区別しない。
 * - AIチャットの応答ログは ai_chat_shares.answer。このユーザーの、論理削除されていない(deleted_at IS NULL)行だけを数え、質問(question)は数えない。
 * - tree-viewでの出現回数は dynamicneko の検索 API の occurrenceCount。取れなかったときはNULLで残し、0にもAIチャットの値にもしない。
 */

export const MUSE_SEARCH_KEYS_LIMIT = 200;

export type MuseSearchKeyItem = {
  searchKey: string;
  aiChatCount: number;
  treeViewCount: number | null;
  searchCount: number;
  firstSearchedAt: string;
  lastSearchedAt: string;
};

/** AIチャットの応答ログ(ai_chat_shares.answer)に、キーが現れた回数の合計。空のキーは0(空を全件一致にしない)。 */
export async function countAiChatOccurrences(db: D1Database, userId: string, key: string): Promise<number> {
  const text = key.trim();
  if (!text) return 0;
  const row = await db.prepare(
    `SELECT COALESCE(SUM((length(answer) - length(replace(lower(answer), lower(?2), ''))) / length(?2)), 0) AS n
     FROM ai_chat_shares
     WHERE user_id = ?1 AND deleted_at IS NULL AND instr(lower(answer), lower(?2)) > 0`,
  ).bind(userId, text).first<{ n: number }>();
  return row?.n ?? 0;
}

/** 検索キーを1行追記する。キーは前後の空白を除いて小文字にそろえる(SQLの lower で、検索の照合と同じ規則)。制約に反する値は拒否する。 */
export async function recordMuseSearchKey(
  db: D1Database,
  input: { userId: string; key: string; aiChatCount: number; treeViewCount: number | null; searchedAt?: string },
): Promise<void> {
  await db.prepare(
    `INSERT INTO muse_search_key_log (user_id, search_key, ai_chat_count, tree_view_count, searched_at)
     VALUES (?1, lower(?2), ?3, ?4, ?5)`,
  ).bind(input.userId, input.key.trim(), input.aiChatCount, input.treeViewCount, input.searchedAt ?? new Date().toISOString()).run();
}

/**
 * 🔑モーダルの一覧。キーごとに、最後に検索したときの値・検索回数・最初と最後の検索日時を返す。
 * 総キーワード数は、一覧の表示上限を適用する前の一意なキー数。
 * 並びは、AIチャットでの出現回数の降順 → tree-viewでの出現回数の降順(NULLは最後) → 最後に検索した新しい順 → キー。
 */
export async function listMuseSearchKeys(db: D1Database, userId: string, limit = MUSE_SEARCH_KEYS_LIMIT): Promise<{ keys: MuseSearchKeyItem[]; totalKeywords: number }> {
  const result = await db.prepare(
    `SELECT l.search_key AS searchKey, l.ai_chat_count AS aiChatCount, l.tree_view_count AS treeViewCount,
            c.search_count AS searchCount, c.first_searched_at AS firstSearchedAt, l.searched_at AS lastSearchedAt,
            COUNT(*) OVER () AS totalKeywords
     FROM muse_search_key_log l
     JOIN (SELECT search_key, MAX(id) AS max_id, COUNT(*) AS search_count, MIN(searched_at) AS first_searched_at
           FROM muse_search_key_log WHERE user_id = ?1 GROUP BY search_key) c ON c.max_id = l.id
     ORDER BY l.ai_chat_count DESC, l.tree_view_count DESC, l.searched_at DESC, l.search_key
     LIMIT ?2`,
  ).bind(userId, Math.min(Math.max(Math.floor(limit) || 1, 1), MUSE_SEARCH_KEYS_LIMIT)).all<MuseSearchKeyItem & { totalKeywords: number }>();
  return {
    keys: result.results.map(({ totalKeywords: _totalKeywords, ...key }) => key),
    totalKeywords: result.results[0]?.totalKeywords ?? 0,
  };
}

export const MUSE_VIEWER_KEYWORDS_LIMIT = 500;

/**
 * スレッド一覧の回答に、強調する、閲覧ユーザーが持つキーワード(2026-11-19、ユーザー指定)。
 * そのユーザーの検索キーの記録(muse_search_key_log)のキーだけを、重複なく、最後に検索した新しい順に返す。**他のユーザーのキーは使わない**(user_id で絞る)。
 * 読めなかったときは例外にする(空にしない。呼び出し側が、理由つきで扱う)。
 */
export async function listViewerKeywords(db: D1Database, userId: string, limit = MUSE_VIEWER_KEYWORDS_LIMIT): Promise<string[]> {
  const max = Math.min(Math.max(Math.floor(limit) || 1, 1), MUSE_VIEWER_KEYWORDS_LIMIT);
  const result = await db.prepare(
    'SELECT search_key AS searchKey FROM muse_search_key_log WHERE user_id = ?1 GROUP BY search_key ORDER BY MAX(id) DESC LIMIT ?2',
  ).bind(userId, max).all<{ searchKey: string }>();
  return result.results.map((row) => row.searchKey);
}

export type MuseSearchKeyLogResult =
  | { keyLogged: true; aiChatCount: number; treeViewCount: number | null }
  | { keyLogged: false; keyLogError: string; aiChatCount: number | null; treeViewCount: number | null };

/**
 * 検索が成功したあとの記録。AIチャットでの出現回数を数え、検索キーを追記する。
 * 失敗しても例外にしない(検索の結果は返す)。ただし成功には見せず、理由を返す(呼び出し側がログに出し、応答で伝える)。
 * AIチャットでの出現回数を数えられなかったときは、不完全な行を残さない。
 */
export async function recordSearchedKey(db: D1Database | undefined, userId: string, key: string, treeViewCount: number | null): Promise<MuseSearchKeyLogResult> {
  if (!db) return { keyLogged: false, keyLogError: 'D1(DB)が未設定のため、検索キーを記録できません', aiChatCount: null, treeViewCount };
  let aiChatCount: number | null = null;
  try {
    aiChatCount = await countAiChatOccurrences(db, userId, key);
    await recordMuseSearchKey(db, { userId, key, aiChatCount, treeViewCount });
    return { keyLogged: true, aiChatCount, treeViewCount };
  } catch (error) {
    return { keyLogged: false, keyLogError: (error instanceof Error ? error.message : String(error)).slice(0, 200), aiChatCount, treeViewCount };
  }
}

export type DeleteMuseKeyResult =
  | { ok: true; value: { keyRows: number; answerRows: number } }
  | { ok: false; errorCode: 'invalid_key' | 'not_found' | 'db_missing' | 'db_error'; detail: string };

/**
 * 🔑モーダルで左スワイプした行の検索キーの削除(2026-11-20、ユーザー指定)。
 * そのユーザー本人の、そのキーの記録(muse_search_key_log の全行と、キーごとの回答の記録 muse_search_answer_log)を、1回のバッチでまとめて消す(片方だけ残らない)。
 * 他のユーザーの同じキー・別のキーには触れない。キーは保存と同じ規則(前後の空白を除いて小文字)で照合する。
 */
export async function deleteMuseSearchKey(db: D1Database | undefined, userId: string, rawKey: string): Promise<DeleteMuseKeyResult> {
  const key = typeof rawKey === 'string' ? rawKey.trim().toLowerCase() : '';
  if (!key || key.length > 500) return { ok: false, errorCode: 'invalid_key', detail: '検索キーは1〜500文字で指定してください' };
  if (!db) return { ok: false, errorCode: 'db_missing', detail: 'D1(DB)が未設定のため、検索キーを削除できません' };
  try {
    const [keyResult, answerResult] = await db.batch([
      db.prepare('DELETE FROM muse_search_key_log WHERE user_id = ?1 AND search_key = ?2').bind(userId, key),
      db.prepare('DELETE FROM muse_search_answer_log WHERE user_id = ?1 AND search_key = ?2').bind(userId, key),
    ]);
    const keyRows = Number(keyResult.meta?.changes ?? 0);
    const answerRows = Number(answerResult.meta?.changes ?? 0);
    if (keyRows === 0) return { ok: false, errorCode: 'not_found', detail: '削除する検索キーが見つかりません' };
    return { ok: true, value: { keyRows, answerRows } };
  } catch (cause) {
    return { ok: false, errorCode: 'db_error', detail: cause instanceof Error ? cause.message : String(cause) };
  }
}
