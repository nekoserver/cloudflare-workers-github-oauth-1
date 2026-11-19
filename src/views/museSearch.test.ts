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

// 🔑ボタン(2026-11-19、ユーザー指定): 最上位のモーダルに、検索キーを、AIチャットでの出現回数の多い順に、tree-viewでの出現回数とともに出す。
describe('🔑ボタンのモーダル', () => {
  const key = (over: Record<string, unknown> = {}) => ({ searchKey: 'static', aiChatCount: 7, treeViewCount: 3, searchCount: 2, firstSearchedAt: '2026-11-19T01:00:00.000Z', lastSearchedAt: '2026-11-19T03:00:00.000Z', ...over });
  /** URLごとに応答を変える。 */
  const router = (routes: Record<string, () => Promise<Response> | Response>) => vi.fn(async (url: string) => {
    const handler = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))?.[1];
    if (!handler) throw new Error('想定外のURL: ' + url);
    return handler();
  }) as unknown as typeof fetch;
  const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const keysButton = () => document.querySelector<HTMLButtonElement>('button[data-action="keys"]')!;
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const overlays = () => document.querySelectorAll('[data-overlay="muse-keys"]');
  const rowsText = () => [...document.querySelectorAll('[role="dialog"] tbody tr')].map(tr => [...tr.children].map(td => td.textContent));

  it('🔑ボタンがあり、名前と説明がある', () => {
    mount(router({}));
    expect(keysButton().textContent).toContain('🔑');
    expect(keysButton().getAttribute('aria-label')).toBeTruthy();
  });
  it('押すと /api/muse-search/keys を読み、モーダルに、AIチャットでの出現回数の順(APIの順)に並べて出す', async () => {
    const fetchFn = router({ '/api/muse-search/keys': json({ keys: [key({ searchKey: 'alpha', aiChatCount: 30, treeViewCount: 4, searchCount: 5 }), key({ searchKey: 'beta', aiChatCount: 2, treeViewCount: 90, searchCount: 1 })] }) });
    mount(fetchFn);
    keysButton().click();
    await flush();
    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('/api/muse-search/keys');
    expect(dialog()!.getAttribute('aria-modal')).toBe('true');
    expect(dialog()!.getAttribute('aria-labelledby')).toBeTruthy();
    const headers = [...document.querySelectorAll('[role="dialog"] thead th')].map(th => th.textContent);
    expect(headers.indexOf('AIチャットでの出現回数')).toBeGreaterThanOrEqual(0);
    expect(headers.indexOf('tree-viewでの出現回数')).toBeGreaterThan(headers.indexOf('AIチャットでの出現回数'));
    const rows = rowsText();
    expect(rows.map(r => r[0])).toEqual(['alpha', 'beta']);
    expect(rows[0]).toEqual(['alpha', '30', '4', '5', '2026/11/19 12:00:00']);
    expect(rows[1].slice(0, 4)).toEqual(['beta', '2', '90', '1']);
  });
  it('tree-viewでの出現回数が未取得(null)のキーは「—」で出す(0にしない)', async () => {
    mount(router({ '/api/muse-search/keys': json({ keys: [key({ treeViewCount: null })] }) }));
    keysButton().click();
    await flush();
    expect(rowsText()[0][2]).toBe('—');
  });
  it('読み込み中は、その旨を出す', async () => {
    let release: (r: Response) => void = () => {};
    mount(vi.fn(() => new Promise<Response>((resolve) => { release = resolve; })) as unknown as typeof fetch);
    keysButton().click();
    expect(dialog()!.textContent).toContain('読み込んでいます');
    release(new Response(JSON.stringify({ keys: [] })));
    await flush();
    expect(dialog()!.textContent).not.toContain('読み込んでいます');
  });
  it('記録が無いときは、その旨を出す(エラーとは別の表示)', async () => {
    mount(router({ '/api/muse-search/keys': json({ keys: [] }) }));
    keysButton().click();
    await flush();
    expect(dialog()!.textContent).toContain('まだ検索キーが記録されていません');
    expect(document.querySelectorAll('[role="dialog"] tbody tr')).toHaveLength(0);
  });
  it('読めなかったときは、理由を出し、記録が無い表示にしない', async () => {
    mount(router({ '/api/muse-search/keys': json({ error: '検索キーの一覧を読めませんでした', detail: 'd1 down' }, 503) }));
    keysButton().click();
    await flush();
    expect(dialog()!.textContent).toContain('読み込めませんでした');
    expect(dialog()!.textContent).toContain('d1 down');
    expect(dialog()!.textContent).not.toContain('まだ検索キーが記録されていません');
  });
  it('通信が失敗しても、理由を出す', async () => {
    mount(vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch);
    keysButton().click();
    await flush();
    expect(dialog()!.textContent).toContain('network down');
  });
  it('検索キーなどの文字列は、HTMLとして解釈せず文字のまま出す', async () => {
    const evil = '<img src=x onerror="window.__xss2=1">';
    mount(router({ '/api/muse-search/keys': json({ keys: [key({ searchKey: evil })] }) }));
    keysButton().click();
    await flush();
    expect(document.querySelector('[role="dialog"] img')).toBeNull();
    expect(rowsText()[0][0]).toBe(evil);
    expect((window as unknown as { __xss2?: number }).__xss2).toBeUndefined();
  });

  describe('最上位のレイヤー(重なり順は getNextZ で決める。固定値を書かない)', () => {
    it('ほかに固定位置の要素が無ければ、基準(700)より上に出す', async () => {
      mount(router({ '/api/muse-search/keys': json({ keys: [] }) }));
      keysButton().click();
      await flush();
      expect(Number((overlays()[0] as HTMLElement).style.zIndex)).toBeGreaterThanOrEqual(800);
      // jsdom のこのテストは <body> だけを入れるので、CSS は読み込まれない。重なり順の対象(position: fixed)であることは、CSSの定義で確かめる。
      // 実際のブラウザでの重なりは、Playwright での目視で確かめる。
      expect(overlays()[0].className).toBe('muse-keys-overlay');
      expect(getMuseSearchPage()).toMatch(/\.muse-keys-overlay \{ position: fixed; inset: 0;/);
    });
    it('すでに開いている固定位置の要素(z-index 5000)より、上に出す', async () => {
      mount(router({ '/api/muse-search/keys': json({ keys: [] }) }));
      const other = document.createElement('div');
      other.style.cssText = 'position:fixed;z-index:5000';
      document.body.appendChild(other);
      keysButton().click();
      await flush();
      expect(Number((overlays()[0] as HTMLElement).style.zIndex)).toBe(5100);
    });
  });

  describe('閉じ方', () => {
    const open = async () => {
      mount(router({ '/api/muse-search/keys': json({ keys: [key()] }) }));
      keysButton().focus();
      keysButton().click();
      await flush();
    };
    it('✕ボタンで閉じ、🔑ボタンへフォーカスを戻す', async () => {
      await open();
      expect(document.activeElement).toBe(document.querySelector('[role="dialog"] button[data-action="close"]'));
      document.querySelector<HTMLButtonElement>('[role="dialog"] button[data-action="close"]')!.click();
      expect(dialog()).toBeNull();
      expect(document.activeElement).toBe(keysButton());
    });
    it('Escキーで閉じる', async () => {
      await open();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(dialog()).toBeNull();
    });
    it('背景(モーダルの外)を押すと閉じる。モーダルの中を押しても閉じない', async () => {
      await open();
      dialog()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(dialog()).not.toBeNull();
      (overlays()[0] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(dialog()).toBeNull();
    });
    it('開いている間に🔑をもう一度押しても、モーダルを重ねない。閉じたあとはまた開ける', async () => {
      await open();
      keysButton().click();
      await flush();
      expect(overlays()).toHaveLength(1);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      keysButton().click();
      await flush();
      expect(overlays()).toHaveLength(1);
    });
    it('閉じたあとは、Escキーのイベントを持ち越さない(別の操作に反応しない)', async () => {
      await open();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))).not.toThrow();
      expect(dialog()).toBeNull();
    });
  });
});

// 🗒️ボタン(2026-11-19、ユーザー指定): 🔑モーダルのタイトル行の末尾。押すと、本体D1の記録から、スレッドごとに出現回数の多い順に回答を並べる。
describe('🗒️ボタン(チャットごとの回答の一覧)', () => {
  const answer = (over: Record<string, unknown> = {}) => ({ answerId: 'a1', occurrences: 2, searchKeys: ['static'], preview: '前…静的…後', createdAt: 1763535000, ...over });
  const thread = (over: Record<string, unknown> = {}) => ({ chatId: 'c1', threadId: 't1', totalOccurrences: 7, answers: [answer()], ...over });
  const router = (routes: Record<string, () => Promise<Response> | Response>) => vi.fn(async (url: string) => {
    const handler = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))?.[1];
    if (!handler) throw new Error('想定外のURL: ' + url);
    return handler();
  }) as unknown as typeof fetch;
  const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const keysButton = () => document.querySelector<HTMLButtonElement>('button[data-action="keys"]')!;
  const notesButton = () => document.querySelector<HTMLButtonElement>('[role="dialog"] button[data-action="answers"]');
  const title = () => document.querySelector('#muse-keys-title')!.textContent;
  const sections = () => [...document.querySelectorAll('[role="dialog"] .muse-answers-thread')];
  const open = async (fetchFn: typeof fetch) => { mount(fetchFn); keysButton().click(); await flush(); };

  it('モーダルを開いたときだけあり、タイトルと✕の間(タイトル行の末尾側)に置く。名前と状態を持つ', async () => {
    mount(router({}));
    expect(document.querySelector('button[data-action="answers"]')).toBeNull();
    await open(router({ '/api/muse-search/keys': json({ keys: [] }) }));
    const head = document.querySelector('.muse-keys-head')!;
    expect([...head.children].map((el) => el.tagName + ':' + (el.getAttribute('data-action') ?? el.id))).toEqual(['H2:muse-keys-title', 'BUTTON:answers', 'BUTTON:close']);
    expect(notesButton()!.textContent).toContain('🗒️');
    expect(notesButton()!.getAttribute('aria-label')).toBeTruthy();
    expect(notesButton()!.getAttribute('aria-pressed')).toBe('false');
  });
  it('押すと /api/muse-search/answers を読み、チャットIDごとのループの中に、回答IDを回答日時の順(APIの順)に並べて出す', async () => {
    const fetchFn = router({
      '/api/muse-search/keys': json({ keys: [] }),
      '/api/muse-search/answers': json({ chats: [
        thread({ chatId: 'c-00012', threadId: 'thread-7', totalOccurrences: 10, answers: [answer({ answerId: 'b0', occurrences: 4, createdAt: 1763535000 }), answer({ answerId: 'b1', occurrences: 6, searchKeys: ['alpha', 'beta'], preview: 'ぷれびゅー', createdAt: 1763538600 })] }),
        thread({ chatId: 'c-00003', threadId: null, totalOccurrences: 3, answers: [answer({ answerId: 'z1', occurrences: 3, createdAt: 1763535000 })] }),
      ] }),
    });
    await open(fetchFn);
    notesButton()!.click();
    await flush();
    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual(['/api/muse-search/keys', '/api/muse-search/answers']);
    expect(title()).toContain('チャット');
    expect(title()).toContain('回答日時');
    expect(notesButton()!.getAttribute('aria-pressed')).toBe('true');
    expect(sections().map((el) => el.querySelector('.muse-answers-heading')!.textContent)).toEqual([
      expect.stringMatching(/チャット c-00012.*スレッド thread-7.*10回.*2件/),
      expect.stringMatching(/チャット c-00003.*スレッド化なし.*3回.*1件/),
    ]);
    const rows = (el: Element) => [...el.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent));
    expect(rows(sections()[0])).toEqual([
      ['b0', script.formatMuseSearchTime(1763535000), '4', 'static', '前…静的…後'],
      ['b1', script.formatMuseSearchTime(1763538600), '6', 'alpha, beta', 'ぷれびゅー'],
    ]);
    expect([...sections()[0].querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['回答ID', '回答日時(日本時間)', '出現回数', '検索キー', '一致箇所の前後']);
  });
  it('読み込み中は表示を出し、記録が無ければ空の案内、読めなければ理由つきのエラー(空の一覧に見せない)', async () => {
    let release!: (res: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    await open(router({ '/api/muse-search/keys': json({ keys: [] }), '/api/muse-search/answers': () => pending }));
    notesButton()!.click();
    expect(document.querySelector('.muse-keys-body')!.textContent).toContain('読み込んでいます');
    release(new Response(JSON.stringify({ chats: [] })));
    await flush();
    expect(document.querySelector('.muse-keys-body')!.textContent).toContain('まだ');
    document.body.innerHTML = '';
    await open(router({ '/api/muse-search/keys': json({ keys: [] }), '/api/muse-search/answers': json({ error: 'x', detail: 'd1 down' }, 503) }));
    notesButton()!.click();
    await flush();
    expect(document.querySelector('.muse-keys-body')!.textContent).toMatch(/503.*d1 down/);
    expect(sections()).toHaveLength(0);
  });
  it('もう一度押すと、🔑の検索キーの一覧へ戻る。タイトルと状態も戻る', async () => {
    await open(router({ '/api/muse-search/keys': json({ keys: [{ searchKey: 'alpha', aiChatCount: 1, treeViewCount: 1, searchCount: 1, firstSearchedAt: '2026-11-19T00:00:00Z', lastSearchedAt: '2026-11-19T00:00:00Z' }] }), '/api/muse-search/answers': json({ chats: [thread()] }) }));
    const firstTitle = title();
    notesButton()!.click();
    await flush();
    notesButton()!.click();
    await flush();
    expect(title()).toBe(firstTitle);
    expect(notesButton()!.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('.muse-keys-table')).not.toBeNull();
    expect(sections()).toHaveLength(0);
  });
  it('遅れて届いた応答が、いま見ている画面を上書きしない(一覧へ戻ったあとに答えが届いても、検索キーのまま)', async () => {
    let release!: (res: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    await open(router({ '/api/muse-search/keys': json({ keys: [{ searchKey: 'alpha', aiChatCount: 1, treeViewCount: 1, searchCount: 1, firstSearchedAt: '2026-11-19T00:00:00Z', lastSearchedAt: '2026-11-19T00:00:00Z' }] }), '/api/muse-search/answers': () => pending }));
    notesButton()!.click();
    notesButton()!.click();
    await flush();
    release(new Response(JSON.stringify({ chats: [thread()] })));
    await flush();
    expect(document.querySelector('.muse-keys-table')).not.toBeNull();
    expect(sections()).toHaveLength(0);
  });
  it('サーバーから来た文字列は、HTMLとして解釈せず文字のまま出す', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    await open(router({ '/api/muse-search/keys': json({ keys: [] }), '/api/muse-search/answers': json({ chats: [thread({ chatId: evil, threadId: evil, answers: [answer({ answerId: evil, preview: evil, searchKeys: [evil] })] })] }) }));
    notesButton()!.click();
    await flush();
    expect(document.querySelectorAll('[role="dialog"] img')).toHaveLength(0);
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain(evil);
  });
  it('🗒️を押してもモーダルは閉じず、Escと✕で閉じる。閉じたあと🔑へフォーカスが戻る', async () => {
    await open(router({ '/api/muse-search/keys': json({ keys: [] }), '/api/muse-search/answers': json({ chats: [thread()] }) }));
    notesButton()!.click();
    await flush();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(keysButton());
  });
  it('Tabキーは、モーダルの外へ出ず、🗒️と✕の間を行き来する', async () => {
    await open(router({ '/api/muse-search/keys': json({ keys: [] }) }));
    const close = document.querySelector<HTMLButtonElement>('[role="dialog"] button[data-action="close"]')!;
    expect(document.activeElement).toBe(close);
    const tab = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    tab();
    expect(document.activeElement).toBe(notesButton());
    tab();
    expect(document.activeElement).toBe(close);
  });
  it('CSS: 固定色を使わない(変数のみ)。ページのscriptは構文が通る', () => {
    const html = getMuseSearchPage();
    const start = html.indexOf('<style id="muse-search-style">');
    const style = html.slice(start, html.indexOf('</style>', start));
    expect(style).toContain('.muse-answers-thread');
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('検索キーを記録できなかったときの表示', () => {
  it('keyLogged が false なら、結果は出したまま、記録できなかったことと理由を伝える', async () => {
    const page = mount(reply({ count: 1, posts: [item()], aiChatCount: null, treeViewCount: 3, keyLogged: false, keyLogError: 'd1 down' }));
    page.submit('x');
    await flush();
    expect(page.items()).toHaveLength(1);
    expect(page.status()).toContain('検索キーを記録できませんでした');
    expect(page.status()).toContain('d1 down');
  });
  it('記録できたときは、その警告を出さない', async () => {
    const page = mount(reply({ count: 1, posts: [item()], aiChatCount: 2, treeViewCount: 3, keyLogged: true }));
    page.submit('x');
    await flush();
    expect(page.status()).not.toContain('記録できませんでした');
  });
});
