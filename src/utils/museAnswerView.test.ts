// /muse-search の🗒️モーダルで、回答IDのリンクを押したときの回答表示(2026-11-19、ユーザー指定)。
// 回答の全文は dynamicneko のD1にあり、本体は持たない。押すたびに署名付きで取り、その回答に当たったキーワードを強調して見せる。
// 仮説:
//   1. 強調の区間は、大文字小文字を区別せずに一致した箇所だけ。元の文字(大文字小文字)を変えない。区間をつなぐと元の文章に戻る。
//   2. 複数のキーワードが重なる・接するときは、1つの強調にまとめる。空のキーワードは無視する(全部を強調しない)。
//   3. 小文字にすると長さが変わる文字(İ)や、サロゲートペア(絵文字)でも、位置がずれない。
//   4. 上流から来た回答の形が違えば、通さない。
//   5. 回答の記録(muse_search_answer_log)に無い回答IDは、キーワードが分からないので扱わない。他のユーザーの記録は混ぜない。
import { describe, expect, it, vi } from 'vitest';
import { createD1, createMuseSearchKeysSqlite } from './museSearchKeys.testdb';
import { MUSE_ANSWER_MAX_CHARS, buildHighlightSegments, fetchMuseAnswer, isMuseAnswer, listAnswerKeys, truncateAnswer } from './museAnswerView';

const joined = (segments: Array<{ text: string }>) => segments.map((s) => s.text).join('');
const hits = (segments: Array<{ text: string; hit: boolean }>) => segments.filter((s) => s.hit).map((s) => s.text);

describe('buildHighlightSegments', () => {
  it('一致した箇所だけを強調し、元の文字(大文字小文字)のまま返す。つなぐと元の文章に戻る', () => {
    const text = 'Workers の Static Assets と static assets';
    const segments = buildHighlightSegments(text, ['static assets']);
    expect(hits(segments)).toEqual(['Static Assets', 'static assets']);
    expect(joined(segments)).toBe(text);
    expect(segments.map((s) => s.hit)).toEqual([false, true, false, true]);
  });
  it('複数のキーワードをそれぞれ強調する。キーワードの順に関係なく、文章の順に並ぶ', () => {
    const segments = buildHighlightSegments('alpha と beta と alpha', ['beta', 'alpha']);
    expect(hits(segments)).toEqual(['alpha', 'beta', 'alpha']);
  });
  it('重なる・接するキーワードは、1つの強調にまとめる', () => {
    expect(hits(buildHighlightSegments('static assets', ['static assets', 'assets']))).toEqual(['static assets']);
    expect(hits(buildHighlightSegments('abcdef', ['abc', 'cde']))).toEqual(['abcde']);
    expect(hits(buildHighlightSegments('abcdef', ['abc', 'def']))).toEqual(['abcdef']);
  });
  it('キーワードが無い・空・空白だけなら、強調せずに全文を1つの区間で返す(全部を強調しない)', () => {
    for (const keys of [[], [''], ['   '], ['', '  ']]) expect(buildHighlightSegments('本文', keys)).toEqual([{ text: '本文', hit: false }]);
  });
  it('本文が空なら区間も空。一致が無ければ強調なし', () => {
    expect(buildHighlightSegments('', ['a'])).toEqual([]);
    expect(buildHighlightSegments('abc', ['x'])).toEqual([{ text: 'abc', hit: false }]);
  });
  it('重ならない一致を、すべて強調する(aa は aaaa に2回)', () => {
    expect(hits(buildHighlightSegments('aaaa', ['aa']))).toEqual(['aaaa']);
    expect(buildHighlightSegments('aaaa', ['aa']).length).toBe(1);
    expect(hits(buildHighlightSegments('aa b aa', ['aa']))).toEqual(['aa', 'aa']);
  });
  it('小文字にすると長さが変わる文字(İ)でも、位置がずれない', () => {
    const text = 'İstanbul';
    const rest = buildHighlightSegments(text, ['stanbul']);
    expect(hits(rest)).toEqual(['stanbul']);
    expect(joined(rest)).toBe(text);
    const whole = buildHighlightSegments(text, ['i̇']);
    expect(hits(whole)).toEqual(['İ']);
    expect(joined(whole)).toBe(text);
  });
  it('サロゲートペア(絵文字)や改行を壊さない', () => {
    const text = '前😀A\n後😀a';
    const segments = buildHighlightSegments(text, ['😀a', 'a']);
    expect(joined(segments)).toBe(text);
    expect(hits(segments)).toEqual(['😀A', '😀a']);
  });
  it('どんな入力でも、区間をつなぐと元の文章に戻る', () => {
    const texts = ['', 'a', 'ABCabc', 'İİİ iii', '改行\n\n本文\t', '😀😀😀'];
    const keySets = [[], ['a'], ['ab', 'bc'], ['i'], ['̇'], ['😀'], ['\n']];
    for (const text of texts) for (const keys of keySets) expect(joined(buildHighlightSegments(text, keys))).toBe(text);
  });
});

describe('truncateAnswer', () => {
  it('上限以内はそのまま。超えたら上限で切り、切ったことを返す(サロゲートペアの途中で切らない)', () => {
    expect(truncateAnswer('abc', 10)).toEqual({ content: 'abc', truncated: false });
    expect(truncateAnswer('abcdef', 3)).toEqual({ content: 'abc', truncated: true });
    const cut = truncateAnswer('a😀b', 2);
    expect(cut.truncated).toBe(true);
    expect(cut.content).toBe('a');
    expect(MUSE_ANSWER_MAX_CHARS).toBe(100000);
  });
});

describe('isMuseAnswer', () => {
  const answer = { answerId: 'a1', chatId: 'c1', content: '本文', createdAt: 100 };
  it('正しい形を通し、形が違うものを通さない', () => {
    expect(isMuseAnswer(answer)).toBe(true);
    expect(isMuseAnswer({ ...answer, content: '' })).toBe(true);
    for (const bad of [null, 'x', { ...answer, answerId: 1 }, { ...answer, content: undefined }, { ...answer, createdAt: '100' }, { ...answer, createdAt: 1.5 }, { ...answer, chatId: '' }]) expect(isMuseAnswer(bad)).toBe(false);
  });
});

describe('fetchMuseAnswer', () => {
  it('署名付きで、回答IDをエンコードしたパスを呼ぶ', async () => {
    const fetcher = { fetch: vi.fn(async () => Response.json({ answerId: 'a 1&', chatId: 'c1', content: 'x', createdAt: 1 })) };
    const result = await fetchMuseAnswer(fetcher, 'secret', 'a 1&');
    expect(result).toMatchObject({ ok: true });
    const [url, init] = fetcher.fetch.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toBe('https://dynamicneko.internal/api/tree-view/muse-answer?answerId=' + encodeURIComponent('a 1&'));
    expect(init.headers['CF-Worker-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
  });
  it('未設定・上流の失敗・形式違いは、理由つきの失敗(空の回答にしない)', async () => {
    expect(await fetchMuseAnswer(undefined, 's', 'a')).toMatchObject({ ok: false, errorCode: 'binding_missing' });
    expect(await fetchMuseAnswer({ fetch: vi.fn() }, undefined, 'a')).toMatchObject({ ok: false, errorCode: 'secret_missing' });
    const notFound = await fetchMuseAnswer({ fetch: vi.fn(async () => Response.json({ error: 'x' }, { status: 404 })) }, 's', 'a');
    expect(notFound).toMatchObject({ ok: false, errorCode: 'http_error' });
    expect(await fetchMuseAnswer({ fetch: vi.fn(async () => Response.json({ content: 1 })) }, 's', 'a')).toMatchObject({ ok: false, errorCode: 'invalid_response' });
  });
});

describe('listAnswerKeys', () => {
  const seed = (sqlite: ReturnType<typeof createMuseSearchKeysSqlite>, userId: string, key: string, answerId: string, searchedAt = '2026-11-19T00:00:00Z') =>
    sqlite.prepare("INSERT INTO muse_search_answer_log (user_id, search_key, answer_id, chat_id, thread_id, occurrences, preview, answer_created_at, searched_at) VALUES (?, ?, ?, 'c1', NULL, 1, 'p', 1, ?)").run(userId, key, answerId, searchedAt);
  it('その回答に当たったキーを、重複なく、キー順に返す。他のユーザー・他の回答のキーは混ぜない', async () => {
    const sqlite = createMuseSearchKeysSqlite();
    const db = createD1(sqlite);
    seed(sqlite, 'u1', 'beta', 'a1'); seed(sqlite, 'u1', 'alpha', 'a1'); seed(sqlite, 'u1', 'alpha', 'a1', '2026-11-19T05:00:00Z');
    seed(sqlite, 'u1', 'other', 'a2'); seed(sqlite, 'someone', 'secret', 'a1');
    expect(await listAnswerKeys(db, 'u1', 'a1')).toEqual(['alpha', 'beta']);
    expect(await listAnswerKeys(db, 'u1', 'none')).toEqual([]);
  });
  it('読めなかったときは、空にせず例外にする', async () => {
    const db = createD1(createMuseSearchKeysSqlite(), { failOn: /FROM muse_search_answer_log/ });
    await expect(listAnswerKeys(db, 'u1', 'a1')).rejects.toThrow('d1 down');
  });
});
