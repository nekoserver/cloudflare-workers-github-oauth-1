/**
 * tree-view の Museタブの会話の検索(/muse-search、2026-11-19、ユーザー指定)。
 * 会話は dynamicneko のD1にあり、本体からは読めない。本体は CF-Worker + HMAC(CLAUDE.mdルール38)で、
 * dynamicneko の GET /api/tree-view/muse-search を呼ぶ。新しいシークレットは足さず、/repo-onboarding-check の⑤と同じ
 * サービスバインディング(DYNAMICNEKO)とシークレット(DYNAMICNEKO_WORKER_HMAC_SECRET)を使う。
 * 知見は dynamicneko の NOTICE.20261119.tree-view-muse.md。
 */
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
export type MuseSearchData = { posts: MuseSearchPost[]; occurrenceCount?: number };

function isMuseSearchPost(value: unknown): value is MuseSearchPost {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.postId === 'string' && typeof v.chatId === 'string' && (v.role === 'user' || v.role === 'assistant')
    && typeof v.content === 'string' && typeof v.createdAt === 'number' && typeof v.threadMark === 'boolean';
}

export function isMuseSearchData(value: unknown): value is MuseSearchData {
  if (!value || typeof value !== 'object') return false;
  const { posts, occurrenceCount } = value as { posts?: unknown; occurrenceCount?: unknown };
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

export type MuseSearchResultItem = Omit<MuseSearchPost, 'content'> & { snippet: MuseSnippet };

/** 画面へ返す形。全文は返さず、一致箇所の前後だけにする。 */
export function toMuseSearchResultItems(posts: MuseSearchPost[], query: string): MuseSearchResultItem[] {
  return posts.map(({ content, ...rest }) => ({ ...rest, snippet: makeMuseSnippet(content, query) }));
}
