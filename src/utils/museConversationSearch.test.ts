// tree-view の Museタブの会話の検索(本体Workerの /muse-search、2026-11-19、ユーザー指定)。
// 会話は dynamicneko のD1にあるので、本体は CF-Worker + HMAC(ルール38)で dynamicneko の GET /api/tree-view/muse-search を呼ぶ。
// 仮説:
//   1. 検索文は前後の空白を除き、空と501文字以上は呼ぶ前に断る(上流へ無駄に送らない)。
//   2. dynamicneko へ送る要求は署名付きで、署名したパスと実際のパス(クエリ込み)が一致する。
//   3. 上流の失敗(未設定・401・形式違い)は、理由が分かる形で返し、空の結果にしない。
//   4. 一致箇所は、元の文字(大文字小文字そのまま)のまま前後を切り出す。小文字にして長さが変わる文字でも、ずれた位置を切らない。
import { describe, expect, it, vi } from 'vitest';
import {
  MUSE_SEARCH_MAX_QUERY, isMuseSearchData, makeMuseSnippet, parseMuseSearchQuery, searchMuseConversations,
} from './museConversationSearch';
import { buildWorkerSignatureMessage, MAIN_WORKER_NAME } from './workerRequestSignature';

const post = { postId: 'a:user', chatId: 'c-00001', role: 'user', content: '静的アセットの質問', createdAt: 100, threadMark: false } as const;

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))).map(n => n.toString(16).padStart(2, '0')).join('');
}

describe('parseMuseSearchQuery', () => {
  it('前後の空白を除く', () => expect(parseMuseSearchQuery('  静的 アセット \n')).toEqual({ ok: true, query: '静的 アセット' }));
  it('空・空白だけ・未指定は断る', () => {
    for (const raw of ['', '   ', '\n', undefined, null]) expect(parseMuseSearchQuery(raw)).toEqual({ ok: false, errorCode: 'empty' });
  });
  it(`${MUSE_SEARCH_MAX_QUERY}文字まで通し、それを超えたら断る`, () => {
    expect(parseMuseSearchQuery('a'.repeat(MUSE_SEARCH_MAX_QUERY)).ok).toBe(true);
    expect(parseMuseSearchQuery('a'.repeat(MUSE_SEARCH_MAX_QUERY + 1))).toEqual({ ok: false, errorCode: 'too_long' });
  });
});

describe('isMuseSearchData', () => {
  it('正しい形を通す', () => expect(isMuseSearchData({ posts: [post] })).toBe(true));
  it('空の結果も通す', () => expect(isMuseSearchData({ posts: [] })).toBe(true));
  it('tree-viewでの出現回数(occurrenceCount)は、あってもなくても通す(古い版には無い)', () => {
    expect(isMuseSearchData({ posts: [post], occurrenceCount: 12 })).toBe(true);
    expect(isMuseSearchData({ posts: [], occurrenceCount: 0 })).toBe(true);
    expect(isMuseSearchData({ posts: [post] })).toBe(true);
  });
  it('occurrenceCountが、負・小数・数以外・NaNなら通さない(0や別の値に読み替えない)', () => {
    for (const occurrenceCount of [-1, 1.5, '12', null, Number.NaN, Infinity]) expect(isMuseSearchData({ posts: [], occurrenceCount })).toBe(false);
  });
  it('形が違うものは通さない', () => {
    for (const v of [null, {}, { posts: 'x' }, { posts: [{ ...post, role: 'system' }] }, { posts: [{ ...post, createdAt: '100' }] },
      { posts: [{ ...post, content: undefined }] }, { posts: [{ ...post, threadMark: 1 }] }, { posts: [{ postId: 'a' }] }]) expect(isMuseSearchData(v)).toBe(false);
  });
});

describe('makeMuseSnippet', () => {
  it('一致箇所を元の文字のまま取り出し、前後を切る', () => {
    const content = 'x'.repeat(200) + 'Static Assets' + 'y'.repeat(200);
    const s = makeMuseSnippet(content, 'static assets', 20);
    expect(s.match).toBe('Static Assets');
    expect(s.before).toBe('…' + 'x'.repeat(20));
    expect(s.after).toBe('y'.repeat(20) + '…');
  });
  it('先頭の一致は、前を切らず「…」も付けない', () => {
    const s = makeMuseSnippet('静的アセットの質問', '静的', 20);
    expect(s).toEqual({ before: '', match: '静的', after: 'アセットの質問' });
  });
  it('一致が無ければ、強調なしで先頭だけを返す', () => {
    const s = makeMuseSnippet('あ'.repeat(100), '無い', 10);
    expect(s.match).toBe('');
    expect(s.before + s.after).toBe('あ'.repeat(20) + '…');
  });
  it('小文字にすると長さが変わる文字でも、ずれた位置を強調しない', () => {
    const s = makeMuseSnippet('İstanbul', 'i', 20);
    expect(s.match === '' || s.match.toLowerCase() === 'i̇' || s.match.toLowerCase() === 'i').toBe(true);
    expect(s.before + s.match + s.after).toBe('İstanbul');
  });
  it('改行を含む本文も、そのまま切り出す', () => {
    const s = makeMuseSnippet('1行目\n2行目 target\n3行目', 'target', 5);
    expect(s.match).toBe('target');
    expect(s.before + s.match + s.after).toContain('target');
  });
});

describe('searchMuseConversations', () => {
  const SECRET = 'pair-secret';
  it('署名付きで、クエリ込みのパスを呼ぶ(署名したパスと実際のパスが一致する)', async () => {
    const fetcher = { fetch: vi.fn(async () => Response.json({ posts: [post] })) };
    const result = await searchMuseConversations(fetcher, SECRET, '静的 & アセット');
    expect(result).toEqual({ ok: true, data: { posts: [post] } });
    const [url, init] = fetcher.fetch.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    const pathAndQuery = '/api/tree-view/muse-search?q=' + encodeURIComponent('静的 & アセット');
    expect(url).toBe('https://dynamicneko.internal' + pathAndQuery);
    expect(init.headers['CF-Worker']).toBe(MAIN_WORKER_NAME);
    const expected = await hmacHex(SECRET, buildWorkerSignatureMessage(MAIN_WORKER_NAME, Number(init.headers['CF-Worker-Timestamp']), 'GET', pathAndQuery, ''));
    expect(init.headers['CF-Worker-Signature']).toBe('sha256=' + expected);
  });
  it('バインディング未設定・シークレット未設定は、理由つきで失敗する(空の結果にしない)', async () => {
    expect(await searchMuseConversations(undefined, SECRET, 'x')).toMatchObject({ ok: false, errorCode: 'binding_missing' });
    expect(await searchMuseConversations({ fetch: vi.fn() }, undefined, 'x')).toMatchObject({ ok: false, errorCode: 'secret_missing' });
  });
  it('上流の401は、ステータスと本文の一部を含めて失敗にする', async () => {
    const fetcher = { fetch: vi.fn(async () => Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })) };
    const result = await searchMuseConversations(fetcher, SECRET, 'x');
    expect(result).toMatchObject({ ok: false, errorCode: 'http_error' });
    expect(!result.ok && result.detail).toContain('401');
    expect(!result.ok && result.detail).toContain('Unauthorized');
  });
  it('形式の違う応答は invalid_response にする', async () => {
    const fetcher = { fetch: vi.fn(async () => Response.json({ posts: 'x' })) };
    expect(await searchMuseConversations(fetcher, SECRET, 'x')).toMatchObject({ ok: false, errorCode: 'invalid_response' });
  });
});
