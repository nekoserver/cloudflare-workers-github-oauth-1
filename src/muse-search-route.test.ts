// /muse-search ページと GET /api/muse-search(tree-view の Museタブの会話の検索、2026-11-19、ユーザー指定)。
// 仮説: 管理者だけが使え、検索文の検査は上流へ送る前に行い、上流の失敗は理由つきで返す(空の結果にしない)。
//   画面へ返すのは一致箇所の前後(snippet)だけで、本文の全文・シークレットは返さない。
import { describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'muse-search-test';
const ADMIN_ID = 85157166;
const post = { postId: 'a:user', answerId: 'a', chatId: 'c-00001', role: 'user', content: '前置き。静的アセットの質問です。後ろの文', createdAt: 100, threadMark: false };
const DB = { prepare: (sql: string) => ({ first: async () => null, all: async () => ({ results: [] }), bind: () => ({ first: async () => sql.includes('user_sessions') ? { revoked_at: null } : null, run: async () => ({ success: true }) }) }) };

async function request(path: string, options: { githubId?: number | null; env?: Record<string, unknown> } = {}) {
  const headers: Record<string, string> = {};
  if (options.githubId !== null) headers.Authorization = 'Bearer ' + await createJWT({ sub: 'u', github_id: options.githubId ?? ADMIN_ID }, JWT_SECRET);
  return app.request(path, { headers }, { JWT_SECRET, DB, CF_DASHBOARD_ADMIN_GITHUB_IDS: String(ADMIN_ID), ...options.env } as never);
}
const dynamicneko = (respond: () => Promise<Response> = async () => Response.json({ posts: [post] })) => ({ fetch: vi.fn(respond) });
const upstream = (fetcher: ReturnType<typeof dynamicneko>) => ({ DYNAMICNEKO: fetcher, DYNAMICNEKO_WORKER_HMAC_SECRET: 'pair-secret-value' });
const q = (text: string) => '/api/muse-search?q=' + encodeURIComponent(text);

describe('認可', () => {
  it('未ログインは API もページも通さない', async () => {
    const fetcher = dynamicneko();
    expect((await request(q('x'), { githubId: null, env: upstream(fetcher) })).status).toBe(401);
    expect((await request('/muse-search', { githubId: null, env: upstream(fetcher) })).status).not.toBe(200);
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });
  it('管理者でないログインは 403(上流へ送らない)', async () => {
    const fetcher = dynamicneko();
    expect((await request(q('x'), { githubId: 2, env: upstream(fetcher) })).status).toBe(403);
    expect((await request('/muse-search', { githubId: 2, env: upstream(fetcher) })).status).toBe(403);
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });
});

describe('GET /api/muse-search', () => {
  it('検索文が空・未指定・501文字以上は 400 で、上流へ送らない', async () => {
    const fetcher = dynamicneko();
    for (const path of ['/api/muse-search', '/api/muse-search?q=', q('   ')]) {
      const res = await request(path, { env: upstream(fetcher) });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ errorCode: 'empty' });
    }
    const long = await request(q('a'.repeat(501)), { env: upstream(fetcher) });
    expect(long.status).toBe(400);
    expect(await long.json()).toMatchObject({ errorCode: 'too_long' });
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });
  it('一致箇所の前後(snippet)と件数を返し、本文の全文とシークレットは返さない', async () => {
    const fetcher = dynamicneko();
    const res = await request(q('静的アセット'), { env: upstream(fetcher) });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = await res.text();
    expect(text).not.toContain('pair-secret-value');
    const body = JSON.parse(text) as { count: number; pairs: Array<Record<string, unknown>>; posts?: unknown };
    expect(body.count).toBe(1);
    expect(body.pairs[0]).toEqual({
      answerId: 'a', chatId: 'c-00001', createdAt: 100,
      question: { hit: true, postId: 'a:user', threadMark: false, snippet: { before: '前置き。', match: '静的アセット', after: 'の質問です。後ろの文' } },
      answer: { hit: false },
    });
    expect(JSON.stringify(body.pairs)).not.toContain('content');
    expect(body.posts).toBeUndefined();
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    expect(String((fetcher.fetch.mock.calls[0] as unknown[])[0])).toBe('https://dynamicneko.internal/api/tree-view/muse-search?q=' + encodeURIComponent('静的アセット'));
  });
  it('前後の空白を除いて送る', async () => {
    const fetcher = dynamicneko();
    await request(q('  静的  '), { env: upstream(fetcher) });
    expect(String((fetcher.fetch.mock.calls[0] as unknown[])[0])).toContain('?q=' + encodeURIComponent('静的'));
  });
  it('一致が無いときは、空の一覧を 200 で返す(失敗と区別する)', async () => {
    const res = await request(q('無い'), { env: upstream(dynamicneko(async () => Response.json({ posts: [] }))) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ count: 0, pairs: [] });
  });
  it('バインディング・シークレットが未設定なら 503 で、理由を返す', async () => {
    const noBinding = await request(q('x'), { env: { DYNAMICNEKO_WORKER_HMAC_SECRET: 's' } });
    expect(noBinding.status).toBe(503);
    expect(await noBinding.json()).toMatchObject({ errorCode: 'binding_missing', detail: expect.any(String) });
    const noSecret = await request(q('x'), { env: { DYNAMICNEKO: dynamicneko() } });
    expect(noSecret.status).toBe(503);
    expect(await noSecret.json()).toMatchObject({ errorCode: 'secret_missing' });
  });
  it('上流が 401 を返したら 502 で、ステータスを含む理由を返す(空の結果にしない)', async () => {
    const res = await request(q('x'), { env: upstream(dynamicneko(async () => Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 }))) });
    expect(res.status).toBe(502);
    const body = await res.json() as { errorCode: string; detail: string };
    expect(body.errorCode).toBe('http_error');
    expect(body.detail).toContain('401');
  });
  it('上流の形式が違えば 502(invalid_response)', async () => {
    const res = await request(q('x'), { env: upstream(dynamicneko(async () => Response.json({ posts: 'x' }))) });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ errorCode: 'invalid_response' });
  });
});

describe('GET /muse-search', () => {
  it('ページを返し、CSP とキャッシュなしを付ける', async () => {
    const res = await request('/muse-search');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-security-policy')).toContain("connect-src 'self'");
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(await res.text()).toContain('<title>Museの会話を検索</title>');
  });
});
