/**
 * /muse-search の🗒️モーダルで、回答IDのリンクを押したときの回答表示(2026-11-19、ユーザー指定)。
 * 回答の全文は dynamicneko のD1にあり、本体は持たない(本文を本体のD1へ複製しない)。押すたびに署名付きで取り、
 * その回答に当たったキーワード(muse_search_answer_log に記録されたキー)を強調した区間にして返す。
 * 強調の区間は、画面ではなくここで計算する(テストできるように。画面は区間を <mark> で描くだけ)。
 */
import { callSignedWorkerEndpoint, type RemoteCheckResult, type WorkerFetcher } from './repoOnboardingRemoteCheck';

export const MUSE_ANSWER_MAX_CHARS = 100000;
export const MUSE_ANSWER_ID_MAX = 200;

/** dynamicneko の GET /api/tree-view/muse-answer の応答。 */
export type MuseAnswer = { answerId: string; chatId: string; content: string; createdAt: number };

export function isMuseAnswer(value: unknown): value is MuseAnswer {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const text = (x: unknown) => typeof x === 'string' && x.trim().length > 0;
  return text(v.answerId) && text(v.chatId) && typeof v.content === 'string' && typeof v.createdAt === 'number' && Number.isInteger(v.createdAt);
}

/** 回答IDから、dynamicneko の回答の全文を署名付きで取る。失敗は理由つきで返し、空の回答にはしない。 */
export function fetchMuseAnswer(fetcher: WorkerFetcher | undefined, secret: string | undefined, answerId: string): Promise<RemoteCheckResult<MuseAnswer>> {
  const pathAndQuery = `/api/tree-view/muse-answer?answerId=${encodeURIComponent(answerId)}`;
  return callSignedWorkerEndpoint(fetcher, secret, 'https://dynamicneko.internal', pathAndQuery, isMuseAnswer);
}

/** 長すぎる回答を上限で切り、切ったことを返す(サロゲートペアの途中では切らない)。 */
export function truncateAnswer(content: string, max = MUSE_ANSWER_MAX_CHARS): { content: string; truncated: boolean } {
  if (content.length <= max) return { content, truncated: false };
  let cut = content.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return { content: cut, truncated: true };
}

export type HighlightSegment = { text: string; hit: boolean };

/** 小文字にした文字列と、小文字の各UTF-16単位が元の文章のどの範囲(start〜end)に当たるか。İ のように、小文字にすると長さが変わる文字でも位置がずれない。 */
function lowerWithMap(text: string): { lower: string; start: number[]; end: number[] } {
  let lower = '';
  const start: number[] = [];
  const end: number[] = [];
  let index = 0;
  for (const ch of text) {
    const lc = ch.toLowerCase();
    for (let k = 0; k < lc.length; k++) { start.push(index); end.push(index + ch.length); }
    lower += lc;
    index += ch.length;
  }
  return { lower, start, end };
}

/**
 * 回答の本文を、キーワードに一致した箇所(強調)とそれ以外の区間に分ける。大文字小文字は区別せず、元の文字のまま返す。
 * 重なる・接する一致は1つにまとめる。空・空白だけのキーは無視する(全部を強調しない)。区間をつなぐと、必ず元の本文に戻る。
 */
export function buildHighlightSegments(text: string, keys: string[]): HighlightSegment[] {
  if (text === '') return [];
  const { lower, start, end } = lowerWithMap(text);
  const ranges: Array<[number, number]> = [];
  for (const key of keys) {
    const needle = key.trim().toLowerCase();
    if (!needle) continue;
    for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + needle.length)) {
      ranges.push([start[at], end[at + needle.length - 1]]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const [from, to] of merged) {
    if (from > cursor) segments.push({ text: text.slice(cursor, from), hit: false });
    segments.push({ text: text.slice(from, to), hit: true });
    cursor = to;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false });
  return segments;
}

/** その回答に当たったキーを、重複なく、キー順に返す(muse_search_answer_log。このユーザーの記録だけ)。読めなかったときは例外にする。 */
export async function listAnswerKeys(db: D1Database, userId: string, answerId: string): Promise<string[]> {
  const result = await db.prepare(
    'SELECT DISTINCT search_key FROM muse_search_answer_log WHERE user_id = ?1 AND answer_id = ?2 ORDER BY search_key',
  ).bind(userId, answerId).all<{ search_key: string }>();
  return result.results.map((row) => row.search_key);
}
