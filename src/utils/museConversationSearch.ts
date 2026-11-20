/**
 * tree-view の Museタブの会話の検索(/muse-search、2026-11-19、ユーザー指定)。
 * 会話は dynamicneko のD1にあり、本体からは読めない。本体は CF-Worker + HMAC(CLAUDE.mdルール38)で、
 * dynamicneko の GET /api/tree-view/muse-search を呼ぶ。新しいシークレットは足さず、/repo-onboarding-check の⑤と同じ
 * サービスバインディング(DYNAMICNEKO)とシークレット(DYNAMICNEKO_WORKER_HMAC_SECRET)を使う。
 * 知見は dynamicneko の NOTICE.20261119.tree-view-muse.md。
 */
import { isMuseAnswerHit, type MuseAnswerHit } from './museSearchAnswers';
import { callSignedWorkerEndpoint, type RemoteCheckResult, type WorkerFetcher } from './repoOnboardingRemoteCheck';

export const MUSE_SEARCH_MAX_QUERY = 500;
const SNIPPET_RADIUS = 60;

export type MuseSearchQueryResult =
  | { ok: true; query: string }
  | { ok: false; errorCode: 'empty' | 'too_long' };

/** 検索文の検査。前後の空白を除き、空と上限超えは上流へ送る前に断る(dynamicneko側の上限と同じ500文字)。 */
export function parseMuseSearchQuery(raw: string | null | undefined): MuseSearchQueryResult {
  const query = (raw ?? '').trim();
  if (!query) return { ok: false, errorCode: 'empty' };
  if (query.length > MUSE_SEARCH_MAX_QUERY) return { ok: false, errorCode: 'too_long' };
  return { ok: true, query };
}

export type MuseSearchPost = { postId: string; chatId: string; role: 'user' | 'assistant'; content: string; createdAt: number; threadMark: boolean };
/** occurrenceCount: tree-viewの会話ログでの出現回数(全件の回数)。dynamicnekoの古い版は返さないので、無いこともある。 */
/** answers: 回答ごとの出現回数(🗒️モーダル用)。dynamicnekoの古い版は返さないので、無いこともある。 */
export type MuseSearchData = { posts: MuseSearchPost[]; occurrenceCount?: number; answers?: MuseAnswerHit[] };

function isMuseSearchPost(value: unknown): value is MuseSearchPost {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.postId === 'string' && typeof v.chatId === 'string' && (v.role === 'user' || v.role === 'assistant')
    && typeof v.content === 'string' && typeof v.createdAt === 'number' && typeof v.threadMark === 'boolean';
}

export function isMuseSearchData(value: unknown): value is MuseSearchData {
  if (!value || typeof value !== 'object') return false;
  const { posts, occurrenceCount, answers } = value as { posts?: unknown; occurrenceCount?: unknown; answers?: unknown };
  if (answers !== undefined && !(Array.isArray(answers) && answers.every(isMuseAnswerHit))) return false;
  if (occurrenceCount !== undefined && !(typeof occurrenceCount === 'number' && Number.isInteger(occurrenceCount) && occurrenceCount >= 0)) return false;
  return Array.isArray(posts) && posts.every(isMuseSearchPost);
}

export type MuseSnippet = { before: string; match: string; after: string };

/**
 * 一致箇所の前後を切り出す(画面で match だけを強調する)。match は本文の元の文字のまま。
 * 小文字にすると長さが変わる文字(例: İ)を含むと、小文字の位置が元の位置とずれるので、その場合は強調せず先頭だけを返す。
 */
export function makeMuseSnippet(content: string, query: string, radius = SNIPPET_RADIUS): MuseSnippet {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.length === content.length && lowerQuery.length === query.length && lowerQuery ? lowerContent.indexOf(lowerQuery) : -1;
  if (index < 0) {
    const head = content.slice(0, radius * 2);
    return { before: head + (content.length > head.length ? '…' : ''), match: '', after: '' };
  }
  const end = index + query.length;
  return {
    before: (index > radius ? '…' : '') + content.slice(Math.max(0, index - radius), index),
    match: content.slice(index, end),
    after: content.slice(end, end + radius) + (content.length > end + radius ? '…' : ''),
  };
}

/** dynamicneko の検索 API を署名付きで呼ぶ。失敗は理由つきで返し、空の結果にはしない。 */
export function searchMuseConversations(
  fetcher: WorkerFetcher | undefined,
  secret: string | undefined,
  query: string,
): Promise<RemoteCheckResult<MuseSearchData>> {
  const pathAndQuery = `/api/tree-view/muse-search?q=${encodeURIComponent(query)}`;
  return callSignedWorkerEndpoint(fetcher, secret, 'https://dynamicneko.internal', pathAndQuery, isMuseSearchData);
}

/**
 * 検索結果の1組(質問と回答のペア、2026-11-20、ユーザー指定)。ペア = 1往復 = 回答ID(answerId)。質問の投稿と回答の投稿が、同じ回答IDを持つ。
 * チャットIDは、複数のペアを入れる会話の容れ物なので、ペアの単位にしない。一致した側にだけ snippet を持つ(一致していない側の本文は、ここでは持たない)。
 */
export type MuseSearchSide = { hit: true; postId: string; threadMark: boolean; snippet: MuseSnippet } | { hit: false };
export type MuseSearchPair = { answerId: string; chatId: string; createdAt: number; question: MuseSearchSide; answer: MuseSearchSide };

/** 上流が回答IDを返さないときは、投稿ID(回答ID:user / 回答ID:assistant)から取る。 */
function answerIdOf(post: MuseSearchPost & { answerId?: unknown }): string {
  return typeof post.answerId === 'string' && post.answerId ? post.answerId : post.postId.replace(/:(user|assistant)$/, '');
}

/**
 * 一致した投稿を、回答IDでまとめて、質問と回答のペアにする。質問と回答の両方に当たっても1組。同じチャットの別のペアは別の組。
 * 順は上流の順(新しい順)。時刻は、一致した投稿のうち、いちばん古いもの(質問に当たっていれば質問の時刻)。
 */
export function groupMuseSearchPairs(posts: MuseSearchPost[], query: string): MuseSearchPair[] {
  const pairs = new Map<string, MuseSearchPair>();
  for (const post of posts) {
    const answerId = answerIdOf(post);
    let pair = pairs.get(answerId);
    if (!pair) {
      pair = { answerId, chatId: post.chatId, createdAt: post.createdAt, question: { hit: false }, answer: { hit: false } };
      pairs.set(answerId, pair);
    }
    pair.createdAt = Math.min(pair.createdAt, post.createdAt);
    const side: MuseSearchSide = { hit: true, postId: post.postId, threadMark: post.threadMark, snippet: makeMuseSnippet(post.content, query) };
    if (post.role === 'user') pair.question = side; else pair.answer = side;
  }
  return [...pairs.values()];
}

export type MuseSearchResultItem = Omit<MuseSearchPost, 'content'> & { snippet: MuseSnippet };

/** 画面へ返す形。全文は返さず、一致箇所の前後だけにする。 */
export function toMuseSearchResultItems(posts: MuseSearchPost[], query: string): MuseSearchResultItem[] {
  return posts.map(({ content, ...rest }) => ({ ...rest, snippet: makeMuseSnippet(content, query) }));
}
