/**
 * /muse-search の🗒️ボタン用の記録(D1 muse_search_answer_log、マイグレーション0196、2026-11-19、ユーザー指定)。
 * 検索のたびに、dynamicneko が返した「回答ごとの出現回数」を、キー・検索日時とともに追記する。
 * 🗒️のモーダルは、全キーを合算して、チャットIDごとに(合計の多い順)、回答IDを回答日時の古い順に並べる。
 *
 * - 記録は追記だけ。一覧は読むときに、(回答, キー)ごとの最後の行だけを足す(同じキーを何度検索しても増えない)。
 * - チャットは、Museタブの1つのチャット。threadId は、dynamicneko のスレッド化(tree_view_muse_discussions)のID(スレッド化していなければ null)で、チャットの見出しに添える。
 * - 回答のチャットは、その回答の最新の記録に従う(1つの回答が2つに割れない)。
 * - 本文の全文は保存しない。一致箇所の前後(preview)だけ。
 */

export const MUSE_ANSWER_LOG_ROW_LIMIT = 5000;

/** dynamicneko の応答の answers の1件。occurrences はその回答の中での回数(1以上)。 */
export type MuseAnswerHit = { answerId: string; chatId: string; threadId: string | null; occurrences: number; preview: string; createdAt: number };

export function isMuseAnswerHit(value: unknown): value is MuseAnswerHit {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const text = (x: unknown) => typeof x === 'string' && x.trim().length > 0;
  return text(v.answerId) && text(v.chatId) && (v.threadId === null || text(v.threadId))
    && typeof v.occurrences === 'number' && Number.isInteger(v.occurrences) && v.occurrences >= 1
    && typeof v.preview === 'string' && typeof v.createdAt === 'number' && Number.isInteger(v.createdAt);
}

export type MuseAnswerLogResult =
  | { answersLogged: true; answersCount: number }
  | { answersLogged: false; answersLogError: string };

/**
 * 検索結果の回答ごとの出現回数を追記する。例外にしない(検索の結果は返す)が、成功には見せず理由を返す。
 * answers が undefined(dynamicneko が古い版で返さない)のときも、失敗として理由を返す。1行でも制約に反すれば、1行も残さない(1文で書く)。
 */
export async function recordSearchedAnswers(db: D1Database | undefined, userId: string, key: string, answers: MuseAnswerHit[] | undefined, searchedAt = new Date().toISOString()): Promise<MuseAnswerLogResult> {
  if (!db) return { answersLogged: false, answersLogError: 'D1(DB)が未設定のため、回答ごとの出現回数を記録できません' };
  if (!answers) return { answersLogged: false, answersLogError: 'dynamicneko が answers(回答ごとの出現回数)を返しませんでした(古い版の可能性)' };
  if (answers.length === 0) return { answersLogged: true, answersCount: 0 };
  try {
    await db.prepare(
      `INSERT INTO muse_search_answer_log (user_id, search_key, answer_id, chat_id, thread_id, occurrences, preview, answer_created_at, searched_at)
       SELECT ?1, lower(?2), json_extract(value, '$.answerId'), json_extract(value, '$.chatId'), json_extract(value, '$.threadId'),
              json_extract(value, '$.occurrences'), json_extract(value, '$.preview'), json_extract(value, '$.createdAt'), ?3
       FROM json_each(?4)`,
    ).bind(userId, key.trim(), searchedAt, JSON.stringify(answers)).run();
    return { answersLogged: true, answersCount: answers.length };
  } catch (error) {
    return { answersLogged: false, answersLogError: (error instanceof Error ? error.message : String(error)).slice(0, 200) };
  }
}

type LogRow = { id: number; search_key: string; answer_id: string; chat_id: string; thread_id: string | null; occurrences: number; preview: string; answer_created_at: number };

export type MuseChatAnswer = { answerId: string; occurrences: number; searchKeys: string[]; preview: string; createdAt: number };
export type MuseChatGroup = { chatId: string; threadId: string | null; totalOccurrences: number; answers: MuseChatAnswer[] };

/**
 * (回答, キー)ごとの最後の行を、全キー合算でチャットIDごとにまとめる(ユーザー指定 2026-11-19: チャットIDのループの中に回答IDを並べる)。
 * チャット: 合計の多い順(同数は、含む回答のうち新しい方が先)。チャットの中: 回答日時の古い順(会話の流れ。同時刻は回答ID順)。
 * 回答のチャットは、その回答の最新の記録に従う。threadId は、チャットの中でいちばん新しい記録のスレッド(スレッド化していなければ null)。
 */
export function groupAnswersByChat(latestRows: LogRow[]): MuseChatGroup[] {
  const answers = new Map<string, { latest: LogRow; occurrences: number; keys: string[] }>();
  for (const row of latestRows) {
    const entry = answers.get(row.answer_id);
    if (!entry) { answers.set(row.answer_id, { latest: row, occurrences: row.occurrences, keys: [row.search_key] }); continue; }
    entry.occurrences += row.occurrences;
    entry.keys.push(row.search_key);
    if (row.id > entry.latest.id) entry.latest = row;
  }
  const groups = new Map<string, MuseChatGroup & { newest: number; threadFromId: number }>();
  for (const [answerId, entry] of answers) {
    const { latest } = entry;
    let group = groups.get(latest.chat_id);
    if (!group) { group = { chatId: latest.chat_id, threadId: latest.thread_id, totalOccurrences: 0, answers: [], newest: 0, threadFromId: latest.id }; groups.set(latest.chat_id, group); }
    if (latest.id > group.threadFromId) { group.threadId = latest.thread_id; group.threadFromId = latest.id; }
    group.totalOccurrences += entry.occurrences;
    group.newest = Math.max(group.newest, latest.answer_created_at);
    group.answers.push({ answerId, occurrences: entry.occurrences, searchKeys: [...entry.keys].sort(), preview: latest.preview, createdAt: latest.answer_created_at });
  }
  return [...groups.values()]
    .sort((a, b) => b.totalOccurrences - a.totalOccurrences || b.newest - a.newest || a.chatId.localeCompare(b.chatId))
    .map(({ newest: _newest, threadFromId: _threadFromId, ...group }) => ({ ...group, answers: group.answers.sort((a, b) => a.createdAt - b.createdAt || a.answerId.localeCompare(b.answerId)) }));
}

/** 🗒️モーダルの一覧。読めなかったときは例外にする(呼び出し側が、空の一覧にせず理由つきで失敗にする)。 */
export async function listMuseAnswersByChat(db: D1Database, userId: string): Promise<MuseChatGroup[]> {
  const result = await db.prepare(
    `SELECT l.id, l.search_key, l.answer_id, l.chat_id, l.thread_id, l.occurrences, l.preview, l.answer_created_at
     FROM muse_search_answer_log l
     JOIN (SELECT MAX(id) AS max_id FROM muse_search_answer_log WHERE user_id = ?1 GROUP BY answer_id, search_key) c ON c.max_id = l.id
     ORDER BY l.id DESC
     LIMIT ?2`,
  ).bind(userId, MUSE_ANSWER_LOG_ROW_LIMIT).all<LogRow>();
  return groupAnswersByChat(result.results);
}
