// @vitest-environment jsdom
// /muse-search のページ(2026-11-19)。上流から来た文字列は textContent でしか表示しない(innerHTML を使わない)。
import { describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { MUSE_SEARCH_SCRIPT, getMuseSearchPage } from './museSearch';

type Script = { initMuseSearchPage: (doc: Document, fetchFn: typeof fetch) => void; formatMuseSearchTime: (sec: number) => string };
const script = new Function(`${MUSE_SEARCH_SCRIPT}\nreturn { initMuseSearchPage, formatMuseSearchTime };`)() as Script;

function mount(fetchFn: typeof fetch) {
  const html = getMuseSearchPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>', html.indexOf('<body>')));
  script.initMuseSearchPage(document, fetchFn);
  const input = document.querySelector<HTMLInputElement>('input[name="q"]')!;
  const form = document.querySelector<HTMLFormElement>('form')!;
  const submit = (value: string) => { input.value = value; form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); };
  return { input, submit, status: () => document.querySelector('[data-field="status"]')!.textContent ?? '', items: () => [...document.querySelectorAll('.muse-search-item')] };
}
const item = (over: Record<string, unknown> = {}) => ({ postId: 'a:user', chatId: 'c-00001', role: 'user', createdAt: 100, threadMark: false, snippet: { before: '前', match: '静的', after: '後' }, ...over });
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ページの形', () => {
  const html = getMuseSearchPage();
  it('タイトル・検索欄・ボタンがある', () => {
    expect(html).toContain('<title>Museの会話を検索</title>');
    expect(html).toContain('name="q"');
    expect(html).toContain('type="submit"');
  });
  it('上部の帯は高さ44pxで固定表示し、右上へリンクを置かない(PWAのルール)', () => {
    expect(html).toMatch(/position:\s*sticky;\s*top:\s*0/);
    expect(html).toMatch(/height:\s*44px/);
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    expect(nav).not.toMatch(/<a\b/);
  });
  it('固定色を使わず、CSS変数を使う(ダークモード対応)', () => {
    // テーマ共通のCSS(getThemeCSS、変数の定義そのものなので色を持つ)は除き、このページ自身のCSSだけを見る。
    const start = html.indexOf('<style id="muse-search-style">');
    const style = html.slice(start, html.indexOf('</style>', start));
    expect(start).toBeGreaterThan(0);
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(style).toContain('var(--card-bg)');
  });
  it('innerHTML を使わない。生成HTMLの全scriptが node --check に通る', () => {
    expect(MUSE_SEARCH_SCRIPT).not.toContain('innerHTML');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const scripts = [...doc.querySelectorAll('script')];
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(() => execFileSync(process.execPath, ['--check'], { input: s.textContent ?? '' })).not.toThrow();
  });
});

describe('検索の動き', () => {
  it('空の検索文は上流へ送らず、入力を促す', async () => {
    const fetchFn = reply({ count: 0, posts: [] });
    const page = mount(fetchFn);
    page.submit('   ');
    await flush();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(page.status()).toContain('検索する文字を入力');
  });
  it('/api/muse-search に検索文を付けて呼び、結果を一致箇所の強調つきで並べる', async () => {
    const fetchFn = reply({ count: 2, posts: [item(), item({ postId: 'a:assistant', role: 'assistant', threadMark: true, snippet: { before: '', match: '静的', after: 'の回答' } })] });
    const page = mount(fetchFn);
    page.submit(' 静的 ');
    await flush();
    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('/api/muse-search?q=' + encodeURIComponent('静的'));
    expect(page.status()).toContain('2件');
    expect(page.items()).toHaveLength(2);
    expect(page.items()[0].querySelector('[data-field="role"]')!.textContent).toBe('質問');
    expect(page.items()[1].querySelector('[data-field="role"]')!.textContent).toBe('回答');
    expect(page.items()[0].querySelector('mark')!.textContent).toBe('静的');
    expect(page.items()[0].textContent).toContain('c-00001');
    expect(page.items()[1].textContent).toContain('スレッド');
  });
  it('上流から来た文字列は、HTMLとして解釈せず文字のまま表示する', async () => {
    const evil = '<img src=x onerror="window.__xss=1">';
    const page = mount(reply({ count: 1, posts: [item({ chatId: evil, snippet: { before: evil, match: '<b>x</b>', after: evil } })] }));
    page.submit('x');
    await flush();
    expect(document.querySelector('.muse-search-item img')).toBeNull();
    expect(document.querySelector('.muse-search-item b')).toBeNull();
    expect(page.items()[0].textContent).toContain(evil);
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });
  it('一致が無ければ、その旨を出す(エラーとは別の表示)', async () => {
    const page = mount(reply({ count: 0, posts: [] }));
    page.submit('無い');
    await flush();
    expect(page.status()).toContain('見つかりませんでした');
    expect(page.items()).toHaveLength(0);
  });
  it('エラーは、理由を画面に出す(空の結果に見せない)', async () => {
    const page = mount(reply({ errorCode: 'http_error', detail: 'https://dynamicneko.internal/x がステータス401を返しました' }, 502));
    page.submit('x');
    await flush();
    expect(page.status()).toContain('検索できませんでした');
    expect(page.status()).toContain('401');
    expect(page.items()).toHaveLength(0);
  });
  it('通信そのものが失敗しても、理由を出す', async () => {
    const page = mount(vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch);
    page.submit('x');
    await flush();
    expect(page.status()).toContain('network down');
  });
  it('検索中はボタンを無効にし、終わったら戻す(二重送信しない)', async () => {
    let release: (r: Response) => void = () => {};
    const fetchFn = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; })) as unknown as typeof fetch;
    const page = mount(fetchFn);
    const button = document.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    page.submit('x');
    expect(button.disabled).toBe(true);
    page.submit('x');
    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    release(new Response(JSON.stringify({ count: 0, posts: [] })));
    await flush();
    expect(button.disabled).toBe(false);
  });
  it('時刻は日本時間で表示する', () => {
    expect(script.formatMuseSearchTime(0)).toBe('1970/01/01 09:00:00');
  });
});
