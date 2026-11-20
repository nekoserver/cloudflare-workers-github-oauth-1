// /muse-search の初期画面(2026-11-19、ユーザー指定): スレッドのタイトルのリンクを、最終書き込みの新しい順に並べ、押すと最終書き込みを段落つきで出す。
// スレッドの一覧・最終書き込みは dynamicneko のD1にあり、本体は持たない。本体は署名付きで取り、最終書き込みを段落に分けて返す。
// 仮説:
//   1. 最終書き込みの本文は、空行(空白だけの行を含む)で段落に分ける。段落の中の改行は残す。前後の空白と空の段落は除く。どんな入力でも、段落をつなぐと文字が失われない(空白・改行を除いて)。
//   2. 上流から来た一覧・最終書き込みの形が違えば通さない。
//   3. 署名付きで、スレッドIDをエンコードしたパスを呼ぶ。未設定・上流の失敗・形式違いは、理由つきの失敗(空の一覧にしない)。
import { describe, expect, it, vi } from 'vitest';
import { fetchMuseThreadLast, fetchMuseThreadList, highlightParagraphs, isMuseThreadLast, isMuseThreadList, toParagraphs } from './museThreads';

describe('toParagraphs', () => {
  it('空行で段落に分ける。段落の中の改行は残す', () => {
    expect(toParagraphs('一段落目\n二行目\n\n二段落目')).toEqual(['一段落目\n二行目', '二段落目']);
  });
  it('空白だけの行も空行として扱う。連続する空行は1つの区切り。前後の空白・空の段落は除く', () => {
    expect(toParagraphs('  \n\n  先頭の段落  \n \t \n\n\n次の段落\n\n  \n')).toEqual(['先頭の段落', '次の段落']);
  });
  it('CRLFも同じ。段落が1つなら1つ', () => {
    expect(toParagraphs('a\r\n\r\nb\r\nc')).toEqual(['a', 'b\nc']);
    expect(toParagraphs('だけ')).toEqual(['だけ']);
  });
  it('空・空白だけなら、段落なし(空の段落を出さない)', () => {
    expect(toParagraphs('')).toEqual([]);
    expect(toParagraphs('  \n \n\n')).toEqual([]);
  });
  it('どんな入力でも、空白と改行を除けば、元の文字がすべて残る', () => {
    const strip = (x: string) => x.replace(/\s+/g, '');
    for (const text of ['a\n\nb', '  x  \n\n\n  y\nz  ', '😀\n\n😀', '\n\n\nあ\n\n\n']) expect(strip(toParagraphs(text).join(''))).toBe(strip(text));
  });
});

describe('isMuseThreadList / isMuseThreadLast', () => {
  const thread = { threadId: 't1', title: 'タイトル', lastPostAt: 100 };
  const last = { threadId: 't1', chatId: 'c1', role: 'assistant', content: '本文', createdAt: 100 };
  it('正しい形を通す', () => {
    expect(isMuseThreadList({ threads: [thread] })).toBe(true);
    expect(isMuseThreadList({ threads: [] })).toBe(true);
    expect(isMuseThreadLast(last)).toBe(true);
    expect(isMuseThreadLast({ ...last, role: 'user' })).toBe(true);
  });
  it('形が違うものを通さない', () => {
    for (const bad of [null, {}, { threads: 'x' }, { threads: [{ ...thread, threadId: 1 }] }, { threads: [{ ...thread, title: undefined }] }, { threads: [{ ...thread, lastPostAt: '1' }] }, { threads: [thread, 'x'] }]) expect(isMuseThreadList(bad)).toBe(false);
    for (const bad of [null, 'x', { ...last, role: 'system' }, { ...last, content: 1 }, { ...last, createdAt: 1.5 }, { ...last, chatId: '' }, { ...last, threadId: undefined }]) expect(isMuseThreadLast(bad)).toBe(false);
  });
});

describe('fetchMuseThreadList / fetchMuseThreadLast', () => {
  it('一覧: 署名付きで呼ぶ', async () => {
    const fetcher = { fetch: vi.fn(async () => Response.json({ threads: [{ threadId: 't1', title: 'x', lastPostAt: 1 }] })) };
    expect(await fetchMuseThreadList(fetcher, 'secret')).toMatchObject({ ok: true });
    const [url, init] = fetcher.fetch.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toBe('https://dynamicneko.internal/api/tree-view/muse-thread-list');
    expect(init.headers['CF-Worker-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
  });
  it('最終書き込み: スレッドIDをエンコードしたパスを、署名付きで呼ぶ', async () => {
    const fetcher = { fetch: vi.fn(async () => Response.json({ threadId: 't 1&', chatId: 'c1', role: 'user', content: 'x', createdAt: 1 })) };
    expect(await fetchMuseThreadLast(fetcher, 'secret', 't 1&')).toMatchObject({ ok: true });
    const [url] = fetcher.fetch.mock.calls[0] as unknown as [string];
    expect(url).toBe('https://dynamicneko.internal/api/tree-view/muse-thread-last?threadId=' + encodeURIComponent('t 1&'));
  });
  it('未設定・上流の失敗・形式違いは、理由つきの失敗(空の一覧にしない)', async () => {
    expect(await fetchMuseThreadList(undefined, 's')).toMatchObject({ ok: false, errorCode: 'binding_missing' });
    expect(await fetchMuseThreadList({ fetch: vi.fn() }, undefined)).toMatchObject({ ok: false, errorCode: 'secret_missing' });
    const down = await fetchMuseThreadList({ fetch: vi.fn(async () => Response.json({ error: 'x' }, { status: 503 })) }, 's');
    expect(down).toMatchObject({ ok: false, errorCode: 'http_error', detail: expect.stringContaining('503') });
    expect(await fetchMuseThreadList({ fetch: vi.fn(async () => Response.json({ threads: 'x' })) }, 's')).toMatchObject({ ok: false, errorCode: 'invalid_response' });
    expect(await fetchMuseThreadLast({ fetch: vi.fn(async () => Response.json({ error: 'x' }, { status: 404 })) }, 's', 'a')).toMatchObject({ ok: false, errorCode: 'http_error' });
  });
});

// 各回答(スレッドの最終書き込み)に、閲覧ユーザーが持つキーワードを強調する(2026-11-19、ユーザー指定)。
describe('highlightParagraphs', () => {
  const hits = (segments: Array<{ text: string; hit: boolean }>) => segments.filter((x) => x.hit).map((x) => x.text);
  it('段落ごとに、キーワードに一致した箇所だけを強調した区間にする(大文字小文字を区別せず、元の文字のまま)。つなぐと元の段落に戻る', () => {
    const result = highlightParagraphs(['Workers の Static Assets', '二段落目に static と ASSETS'], ['static', 'assets']);
    expect(result).toHaveLength(2);
    expect(hits(result[0])).toEqual(['Static', 'Assets']);
    expect(hits(result[1])).toEqual(['static', 'ASSETS']);
    expect(result[0].map((x) => x.text).join('')).toBe('Workers の Static Assets');
    expect(result[1].map((x) => x.text).join('')).toBe('二段落目に static と ASSETS');
  });
  it('キーワードが無ければ、強調せず、段落ごとに1つの区間のまま。段落が無ければ空', () => {
    expect(highlightParagraphs(['一段落', '二段落'], [])).toEqual([[{ text: '一段落', hit: false }], [{ text: '二段落', hit: false }]]);
    expect(highlightParagraphs([], ['x'])).toEqual([]);
  });
  it('段落の中の改行は残る。段落をまたぐキーワードは、強調しない(段落ごとに照合する)', () => {
    const result = highlightParagraphs(['行1\n行2', 'ねこ'], ['行1\n行2', '1\n2', 'こね']);
    expect(hits(result[0])).toEqual(['行1\n行2']);
    expect(hits(result[1])).toEqual([]);
  });
});
