/**
 * /muse-search の初期画面(2026-11-19、ユーザー指定): スレッドのタイトルのリンクを、最終書き込みの新しい順に並べ、
 * 押すと、そのスレッドの最終書き込みを、段落に分けて、リンクの下に出す。
 * スレッドの一覧・最終書き込みは dynamicneko のD1にあり、本体は持たない(本文を本体のD1へ複製しない)。押すたびに署名付きで取る。
 * スレッドにタイトル列は無いので、タイトルは dynamicneko が、根の投稿の最初の空でない行から作る。
 */
import { buildHighlightSegments, type HighlightSegment } from './museAnswerView';
import { callSignedWorkerEndpoint, type RemoteCheckResult, type WorkerFetcher } from './repoOnboardingRemoteCheck';

export const MUSE_THREAD_ID_MAX = 200;

/** dynamicneko の GET /api/tree-view/muse-thread-list の応答の1件。 */
export type MuseThreadSummary = { threadId: string; title: string; lastPostAt: number };
export type MuseThreadList = { threads: MuseThreadSummary[] };
/** dynamicneko の GET /api/tree-view/muse-thread-last の応答。 */
export type MuseThreadLast = { threadId: string; chatId: string; role: 'user' | 'assistant'; content: string; createdAt: number };

const text = (x: unknown) => typeof x === 'string' && x.trim().length > 0;

export function isMuseThreadList(value: unknown): value is MuseThreadList {
  if (!value || typeof value !== 'object') return false;
  const { threads } = value as { threads?: unknown };
  return Array.isArray(threads) && threads.every((t) => {
    if (!t || typeof t !== 'object') return false;
    const v = t as Record<string, unknown>;
    return text(v.threadId) && typeof v.title === 'string' && typeof v.lastPostAt === 'number' && Number.isInteger(v.lastPostAt);
  });
}

export function isMuseThreadLast(value: unknown): value is MuseThreadLast {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return text(v.threadId) && text(v.chatId) && (v.role === 'user' || v.role === 'assistant') && typeof v.content === 'string'
    && typeof v.createdAt === 'number' && Number.isInteger(v.createdAt);
}

/** スレッドの一覧(最終書き込みの新しい順)を、署名付きで取る。失敗は理由つきで返し、空の一覧にはしない。 */
export function fetchMuseThreadList(fetcher: WorkerFetcher | undefined, secret: string | undefined): Promise<RemoteCheckResult<MuseThreadList>> {
  return callSignedWorkerEndpoint(fetcher, secret, 'https://dynamicneko.internal', '/api/tree-view/muse-thread-list', isMuseThreadList);
}

/** スレッドの最終書き込みを、署名付きで取る。 */
export function fetchMuseThreadLast(fetcher: WorkerFetcher | undefined, secret: string | undefined, threadId: string): Promise<RemoteCheckResult<MuseThreadLast>> {
  return callSignedWorkerEndpoint(fetcher, secret, 'https://dynamicneko.internal', `/api/tree-view/muse-thread-last?threadId=${encodeURIComponent(threadId)}`, isMuseThreadLast);
}

/** dynamicneko の GET /api/tree-view/muse-chat の応答(チャットIDが同じ質問と回答を、やりとりの順に)。 */
export type MuseChatPost = { answerId: string; role: 'user' | 'assistant'; content: string; createdAt: number };
export type MuseChat = { chatId: string; posts: MuseChatPost[] };

export function isMuseChat(value: unknown): value is MuseChat {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (!text(v.chatId) || !Array.isArray(v.posts) || v.posts.length === 0) return false;
  return v.posts.every((post) => {
    if (!post || typeof post !== 'object') return false;
    const q = post as Record<string, unknown>;
    return text(q.answerId) && (q.role === 'user' || q.role === 'assistant') && typeof q.content === 'string' && typeof q.createdAt === 'number' && Number.isInteger(q.createdAt);
  });
}

/** チャットIDが同じ質問と回答を、署名付きで取る(2026-11-20、ユーザー指定)。失敗は理由つきで返し、空のチャットにはしない。 */
export function fetchMuseChat(fetcher: WorkerFetcher | undefined, secret: string | undefined, chatId: string): Promise<RemoteCheckResult<MuseChat>> {
  return callSignedWorkerEndpoint(fetcher, secret, 'https://dynamicneko.internal', `/api/tree-view/muse-chat?chatId=${encodeURIComponent(chatId)}`, isMuseChat);
}

/**
 * 本文を段落に分ける。空行(空白だけの行を含む)が区切り。段落の中の改行は残し、前後の空白と空の段落は除く。
 * 画面は、段落ごとに <p> にして、段落の中の改行は white-space: pre-wrap で残す。
 */
export function toParagraphs(content: string): string[] {
  return content.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * 各回答(スレッドの最終書き込み)の段落に、閲覧ユーザーが持つキーワードを強調する(ユーザー指定 2026-11-19)。
 * 段落ごとに照合する(段落をまたぐキーワードは強調しない)。大文字小文字は区別せず、元の文字のまま。キーワードが無ければ、強調しない。
 */
export function highlightParagraphs(paragraphs: string[], keywords: string[]): HighlightSegment[][] {
  return paragraphs.map((paragraph) => buildHighlightSegments(paragraph, keywords));
}
