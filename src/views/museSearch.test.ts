// @vitest-environment jsdom
// /muse-search のページ(2026-11-19)。上流から来た文字列は textContent でしか表示しない(innerHTML を使わない)。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { MUSE_SEARCH_SCRIPT, getMuseSearchPage } from './museSearch';

type Script = { initMuseSearchPage: (doc: Document, fetchFn: typeof fetch) => void; formatMuseSearchTime: (sec: number) => string; shortenMuseAnswerId: (id: string) => string };
const script = new Function(`${MUSE_SEARCH_SCRIPT}\nreturn { initMuseSearchPage, formatMuseSearchTime, shortenMuseAnswerId };`)() as Script;

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
/** 呼ばれたURLの一覧。読み込み時に必ず取る、初期画面のスレッド一覧(/api/muse-search/threads)は除く(それぞれのテストが見たいのは、そのほかの呼び出し)。 */
const callUrls = (fetchFn: unknown) => (fetchFn as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c[0] as string).filter((u) => u !== '/api/muse-search/threads');

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
    expect(callUrls(fetchFn)).toEqual([]);
    expect(page.status()).toContain('検索する文字を入力');
  });
  it('/api/muse-search に検索文を付けて呼び、結果を一致箇所の強調つきで並べる', async () => {
    const fetchFn = reply({ count: 2, posts: [item(), item({ postId: 'a:assistant', role: 'assistant', threadMark: true, snippet: { before: '', match: '静的', after: 'の回答' } })] });
    const page = mount(fetchFn);
    page.submit(' 静的 ');
    await flush();
    expect(callUrls(fetchFn)[0]).toBe('/api/muse-search?q=' + encodeURIComponent('静的'));
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
    expect(callUrls(fetchFn)).toHaveLength(1);
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
  // スマホ幅の表示(2026-11-19、ユーザー指定「直して」): 5列の表が幅に収まらず、右の列が切れていた。スマホ幅では、1行を「項目名: 値」の縦並びにする。
  it('検索キーの表のセルは、項目名(data-label)を持つ。キーのセルは項目名なし(行の見出し)。表の文字は変えない', async () => {
    mount(router({ '/api/muse-search/keys': json({ keys: [key({ searchKey: 'alpha', aiChatCount: 30, treeViewCount: null, searchCount: 5 })] }) }));
    keysButton().click();
    await flush();
    const table = document.querySelector('[role="dialog"] table')!;
    expect(table.classList.contains('muse-keys-list')).toBe(true);
    const cells = [...table.querySelectorAll('tbody tr:first-child td')];
    expect(cells.map((td) => td.getAttribute('data-label'))).toEqual([null, 'AIチャットでの出現回数', 'tree-viewでの出現回数', '検索回数', '最後に検索した日時(日本時間)']);
    expect(cells.slice(0, 4).map((td) => td.textContent)).toEqual(['alpha', '30', '—', '5']);
  });
  it('CSS: 縦並び(項目名: 値)は、設定がON(.muse-stacked)で、幅560px以下のときだけ。設定がOFFのときの既定の表には、縦並びの指定を入れない。固定色は使わない', () => {
    const html = getMuseSearchPage();
    const start = html.indexOf('<style id="muse-search-style">');
    const style = html.slice(start, html.indexOf('</style>', start));
    const mediaStart = style.indexOf('@media (max-width: 560px)');
    const before = style.slice(0, mediaStart);
    const media = style.slice(mediaStart);
    expect(mediaStart).toBeGreaterThan(0);
    expect(media).toMatch(/\.muse-stacked \.muse-keys-list tr, \.muse-stacked \.muse-keys-list td \{ display: block;/);
    expect(media).toMatch(/\.muse-stacked \.muse-keys-list td\[data-label\]::before \{[^}]*content: attr\(data-label\)/);
    expect(media).toMatch(/\.muse-stacked \.muse-keys-list thead tr \{[^}]*display: flex; flex-wrap: wrap/);
    // メディアクエリの中のセレクタは、すべて .muse-stacked から始まる(設定がOFFなら、何も効かない)。
    const selectors = [...media.matchAll(/^\s{6}([^{}\n]+?) \{/gm)].flatMap((m) => m[1].split(',').map((x) => x.trim()));
    expect(selectors.length).toBeGreaterThan(5);
    for (const selector of selectors) expect(selector.startsWith('.muse-stacked ')).toBe(true);
    expect(before).not.toContain('content: attr(data-label)');
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it('押すと /api/muse-search/keys を読み、モーダルに、AIチャットでの出現回数の順(APIの順)に並べて出す', async () => {
    const fetchFn = router({ '/api/muse-search/keys': json({ keys: [key({ searchKey: 'alpha', aiChatCount: 30, treeViewCount: 4, searchCount: 5 }), key({ searchKey: 'beta', aiChatCount: 2, treeViewCount: 90, searchCount: 1 })] }) });
    mount(fetchFn);
    keysButton().click();
    await flush();
    expect(callUrls(fetchFn)[0]).toBe('/api/muse-search/keys');
    expect(dialog()!.getAttribute('aria-modal')).toBe('true');
    expect(dialog()!.getAttribute('aria-labelledby')).toBeTruthy();
    const headers = [...document.querySelectorAll('[role="dialog"] thead th')].map(th => { const c = th.cloneNode(true) as Element; c.querySelectorAll('.muse-sort-indicator').forEach(el => el.remove()); return c.textContent; });
    expect(headers.indexOf('AIチャットでの出現回数')).toBeGreaterThanOrEqual(0);
    expect(headers.indexOf('tree-viewでの出現回数')).toBeGreaterThan(headers.indexOf('AIチャットでの出現回数'));
    const rows = rowsText();
    expect(rows.map(r => r[0])).toEqual(['alpha', 'beta']);
    expect(rows[0]).toEqual(['alpha', '30', '4', '5', '2026/11/19 12:00:00']);
    expect(rows[1].slice(0, 4)).toEqual(['beta', '2', '90', '1']);
  });
  // 見出しで並べ替え(2026-11-19、ユーザー指定): 各thを押すと、その要素の降順/昇順がトグルし、押すたびに表が書き換わる。
  describe('見出しを押して並べ替える(検索キーの表)', () => {
    const sortKeys = () => ({ keys: [
      key({ searchKey: 'alpha', aiChatCount: 30, treeViewCount: 4, searchCount: 5, lastSearchedAt: '2026-11-19T03:00:00.000Z' }),
      key({ searchKey: 'delta', aiChatCount: 7, treeViewCount: 10, searchCount: 3, lastSearchedAt: '2026-11-19T04:00:00.000Z' }),
      key({ searchKey: 'gamma', aiChatCount: 7, treeViewCount: null, searchCount: 9, lastSearchedAt: '2026-11-19T02:00:00.000Z' }),
      key({ searchKey: 'beta', aiChatCount: 2, treeViewCount: 90, searchCount: 1, lastSearchedAt: '2026-11-19T01:00:00.000Z' }),
    ] });
    const openSorted = async () => {
      mount(router({ '/api/muse-search/keys': json(sortKeys()), '/api/muse-search/answers': json({ chats: [] }) }));
      keysButton().click();
      await flush();
    };
    const sortBtn = (k: string) => document.querySelector<HTMLButtonElement>(`[role="dialog"] thead button[data-sort-key="${k}"]`)!;
    const order = () => rowsText().map((r) => r[0]);
    const ariaSort = (k: string) => sortBtn(k).closest('th')!.getAttribute('aria-sort');
    const title = () => document.querySelector('#muse-keys-title')!.textContent;
    const press = (k: string) => sortBtn(k).click();

    it('5つの見出しすべてが押せるボタン。最初は、AIチャットでの出現回数の降順(▼)で、タイトルも今までのまま', async () => {
      await openSorted();
      expect([...document.querySelectorAll('[role="dialog"] thead th')].map((th) => th.querySelector('button')?.getAttribute('data-sort-key'))).toEqual(['searchKey', 'aiChatCount', 'treeViewCount', 'searchCount', 'lastSearchedAt']);
      expect(order()).toEqual(['alpha', 'delta', 'gamma', 'beta']);
      expect(ariaSort('aiChatCount')).toBe('descending');
      expect(sortBtn('aiChatCount').textContent).toContain('▼');
      for (const k of ['searchKey', 'treeViewCount', 'searchCount', 'lastSearchedAt']) expect(ariaSort(k)).toBe('none');
      expect(title()).toBe('検索キー(AIチャットでの出現回数の多い順)');
    });
    it('検索キー: 押すたびに 降順 → 昇順', async () => {
      await openSorted();
      press('searchKey');
      expect(order()).toEqual(['gamma', 'delta', 'beta', 'alpha']);
      expect(ariaSort('searchKey')).toBe('descending');
      press('searchKey');
      expect(order()).toEqual(['alpha', 'beta', 'delta', 'gamma']);
      expect(ariaSort('searchKey')).toBe('ascending');
    });
    it('AIチャットでの出現回数: 最初は降順なので、押すと昇順、もう一度で降順。同数はtree-viewでの回数の多い順', async () => {
      await openSorted();
      press('aiChatCount');
      expect(order()).toEqual(['beta', 'delta', 'gamma', 'alpha']);
      expect(ariaSort('aiChatCount')).toBe('ascending');
      press('aiChatCount');
      expect(order()).toEqual(['alpha', 'delta', 'gamma', 'beta']);
    });
    it('tree-viewでの出現回数: 降順 → 昇順。未取得(—)は、どちらの向きでも最後', async () => {
      await openSorted();
      press('treeViewCount');
      expect(order()).toEqual(['beta', 'delta', 'alpha', 'gamma']);
      press('treeViewCount');
      expect(order()).toEqual(['alpha', 'delta', 'beta', 'gamma']);
    });
    it('検索回数: 降順 → 昇順', async () => {
      await openSorted();
      press('searchCount');
      expect(order()).toEqual(['gamma', 'alpha', 'delta', 'beta']);
      press('searchCount');
      expect(order()).toEqual(['beta', 'delta', 'alpha', 'gamma']);
    });
    it('最後に検索した日時: 降順 → 昇順', async () => {
      await openSorted();
      press('lastSearchedAt');
      expect(order()).toEqual(['delta', 'alpha', 'gamma', 'beta']);
      press('lastSearchedAt');
      expect(order()).toEqual(['beta', 'gamma', 'alpha', 'delta']);
    });
    it('押すたびに、表を書き換える(行が作り直される)。値は変わらない', async () => {
      await openSorted();
      const before = document.querySelector('[role="dialog"] tbody')!;
      const firstRowBefore = before.querySelector('tr')!;
      press('searchCount');
      const after = document.querySelector('[role="dialog"] tbody')!;
      expect(after).not.toBe(before);
      expect(after.querySelector('tr')).not.toBe(firstRowBefore);
      expect(rowsText().find((r) => r[0] === 'alpha')).toEqual(['alpha', '30', '4', '5', script.formatMuseSearchTime(Date.parse('2026-11-19T03:00:00.000Z') / 1000)]);
      expect(rowsText().find((r) => r[0] === 'gamma')![2]).toBe('—');
    });
    it('別の列を押すと、その列の降順から始まる。印(aria-sort・矢印)は押した列だけ。押した見出しにフォーカスが残る。タイトルは基準を示す', async () => {
      await openSorted();
      press('searchCount');
      expect(ariaSort('searchCount')).toBe('descending');
      expect(ariaSort('aiChatCount')).toBe('none');
      expect(sortBtn('searchCount').textContent).toContain('▼');
      expect(sortBtn('aiChatCount').textContent).not.toMatch(/[▲▼]/);
      expect(document.activeElement).toBe(sortBtn('searchCount'));
      expect(title()).toBe('検索キー(検索回数の降順)');
      press('searchCount');
      expect(title()).toBe('検索キー(検索回数の昇順)');
      press('aiChatCount');
      expect(title()).toBe('検索キー(AIチャットでの出現回数の多い順)');
      press('aiChatCount');
      expect(title()).toBe('検索キー(AIチャットでの出現回数の昇順)');
    });
    it('🗒️へ切り替えて戻っても、選んだ基準を覚えている。モーダルを閉じて開き直したら最初に戻る', async () => {
      await openSorted();
      press('searchKey');
      const notes = document.querySelector<HTMLButtonElement>('[role="dialog"] button[data-action="answers"]')!;
      notes.click();
      await flush();
      notes.click();
      await flush();
      expect(ariaSort('searchKey')).toBe('descending');
      expect(order()).toEqual(['gamma', 'delta', 'beta', 'alpha']);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      keysButton().click();
      await flush();
      expect(ariaSort('aiChatCount')).toBe('descending');
    });
    it('Tabは、見出しのボタンにも届く(キーボードで並べ替えられる)', async () => {
      await openSorted();
      const items = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button:not([hidden])')].map((el) => el.getAttribute('data-sort-key') ?? el.getAttribute('data-action'));
      expect(items).toEqual(['answers', 'recent', 'close', 'searchKey', 'aiChatCount', 'treeViewCount', 'searchCount', 'lastSearchedAt']);
    });
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
  /** 見出しの文字(並べ替えの矢印は除く)。 */
  const headerLabel = (th: Element) => { const c = th.cloneNode(true) as Element; c.querySelectorAll('.muse-sort-indicator').forEach((el) => el.remove()); return c.textContent; };

  it('モーダルを開いたときだけあり、タイトルと✕の間(タイトル行の末尾側)に置く。名前と状態を持つ', async () => {
    mount(router({}));
    expect(document.querySelector('button[data-action="answers"]')).toBeNull();
    await open(router({ '/api/muse-search/keys': json({ keys: [] }) }));
    const head = document.querySelector('.muse-keys-head')!;
    expect([...head.children].map((el) => el.tagName + ':' + (el.getAttribute('data-action') ?? el.id))).toEqual(['H2:muse-keys-title', 'BUTTON:answers', 'BUTTON:recent', 'BUTTON:close']);
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
    expect(callUrls(fetchFn)).toEqual(['/api/muse-search/keys', '/api/muse-search/answers']);
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
    expect([...sections()[0].querySelectorAll('thead th')].map(headerLabel)).toEqual(['回答ID', '回答日時(日本時間)', '出現回数', '検索キー', '一致箇所の前後']);
  });

  // 並べ替え(2026-11-19、ユーザー指定): 「出現回数」か「回答日時(日本時間)」の見出しを押すと、その列を基準に降順/昇順に並べ替える。
  describe('見出しを押して並べ替える', () => {
    const sortChats = () => ({ chats: [
      thread({ chatId: 'c-A', threadId: null, totalOccurrences: 12, answers: [
        answer({ answerId: 'a-mid', occurrences: 5, createdAt: 2000 }),
        answer({ answerId: 'a-old', occurrences: 9, createdAt: 1000 }),
        answer({ answerId: 'a-new', occurrences: 2, createdAt: 3000 }),
        answer({ answerId: 'a-tie', occurrences: 5, createdAt: 2500 }),
      ] }),
      thread({ chatId: 'c-B', threadId: 't9', totalOccurrences: 4, answers: [
        answer({ answerId: 'b-1', occurrences: 1, createdAt: 500 }),
        answer({ answerId: 'b-2', occurrences: 3, createdAt: 400 }),
      ] }),
    ] });
    const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    /** 🔑を開き、🗒️へ切り替える。 */
    const open2 = async () => {
      await open(router({ '/api/muse-search/keys': json({ keys: [] }), '/api/muse-search/answers': json(sortChats()) }));
      notesButton()!.click();
      await flush();
    };
    const ids = (index: number) => [...sections()[index].querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent);
    const sortButton = (key: string, index = 0) => sections()[index].querySelector<HTMLButtonElement>(`thead button[data-sort-key="${key}"]`)!;
    const ariaSort = (key: string, index = 0) => sortButton(key, index).closest('th')!.getAttribute('aria-sort');
    const chatOrder = () => sections().map((el) => el.querySelector('.muse-answers-heading')!.textContent!.slice(0, 8));

    it('「出現回数」と「回答日時(日本時間)」の見出しだけが、押せるボタン。ほかの見出しは押せない', async () => {
      await open2();
      expect([...sections()[0].querySelectorAll('thead th')].map((th) => th.querySelector('button')?.getAttribute('data-sort-key') ?? null)).toEqual([null, 'createdAt', 'occurrences', null, null]);
      expect(sortButton('createdAt').type).toBe('button');
    });
    it('最初は回答日時の昇順(これまでと同じ)。見出しにも、そう示す(aria-sort と矢印)', async () => {
      await open2();
      expect(ids(0)).toEqual(['a-old', 'a-mid', 'a-tie', 'a-new']);
      expect(ariaSort('createdAt')).toBe('ascending');
      expect(ariaSort('occurrences')).toBe('none');
      expect(sortButton('createdAt').textContent).toContain('▲');
      expect(sortButton('occurrences').textContent).not.toMatch(/[▲▼]/);
    });
    it('回答日時を押すと降順、もう一度押すと昇順に戻る', async () => {
      await open2();
      sortButton('createdAt').click();
      expect(ids(0)).toEqual(['a-new', 'a-tie', 'a-mid', 'a-old']);
      expect(ariaSort('createdAt')).toBe('descending');
      expect(sortButton('createdAt').textContent).toContain('▼');
      sortButton('createdAt').click();
      expect(ids(0)).toEqual(['a-old', 'a-mid', 'a-tie', 'a-new']);
      expect(ariaSort('createdAt')).toBe('ascending');
    });
    it('出現回数を押すと、まず降順(多い順)。もう一度押すと昇順。同数は回答日時の古い順', async () => {
      await open2();
      sortButton('occurrences').click();
      expect(ids(0)).toEqual(['a-old', 'a-mid', 'a-tie', 'a-new']);
      expect(ariaSort('occurrences')).toBe('descending');
      expect(ariaSort('createdAt')).toBe('none');
      sortButton('occurrences').click();
      expect(ids(0)).toEqual(['a-new', 'a-mid', 'a-tie', 'a-old']);
      expect(ariaSort('occurrences')).toBe('ascending');
    });
    it('別の列を押すと、その列の降順から始まる。すべてのチャットの表が同じ基準で並ぶ。チャットの並び(合計の多い順)は変わらない', async () => {
      await open2();
      sortButton('occurrences').click();
      expect(ids(1)).toEqual(['b-2', 'b-1']);
      expect(chatOrder()).toEqual(['チャット c-A', 'チャット c-B']);
      sortButton('createdAt', 1).click();
      expect(ids(0)).toEqual(['a-new', 'a-tie', 'a-mid', 'a-old']);
      expect(ids(1)).toEqual(['b-1', 'b-2']);
      expect(ariaSort('createdAt', 1)).toBe('descending');
    });
    it('並べ替えても、リンクは押せる(回答のモーダルが開く)。押した見出しにフォーカスが残る。タイトルは基準を示す', async () => {
      await open2();
      sortButton('occurrences').click();
      expect(document.activeElement).toBe(sortButton('occurrences'));
      expect(document.querySelector('#muse-keys-title')!.textContent).toContain('出現回数');
      expect(document.querySelector('#muse-keys-title')!.textContent).toContain('降順');
      expect(sections()[0].querySelectorAll('a[data-answer-id]')).toHaveLength(4);
    });
    it('🔑の一覧へ戻って🗒️を開き直しても、選んだ基準を覚えている。モーダルを閉じて開き直したら最初に戻る', async () => {
      await open2();
      sortButton('occurrences').click();
      const notes = document.querySelector<HTMLButtonElement>('[role="dialog"] button[data-action="answers"]')!;
      notes.click();
      await flush();
      notes.click();
      await flush();
      expect(ariaSort('occurrences')).toBe('descending');
      press('Escape');
      keysButton().click();
      await flush();
      document.querySelector<HTMLButtonElement>('[role="dialog"] button[data-action="answers"]')!.click();
      await flush();
      expect(ariaSort('createdAt')).toBe('ascending');
    });
  });

  it('回答IDのリンクに下線を付けない', () => {
    const html = getMuseSearchPage();
    const style = html.slice(html.indexOf('<style id="muse-search-style">'), html.indexOf('</style>', html.indexOf('<style id="muse-search-style">')));
    const rule = style.match(/\.muse-answers-link \{[^}]*\}/)![0];
    expect(rule).toContain('text-decoration: none');
    expect(rule).not.toContain('underline');
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
  it('Tabキーは、モーダルの外へ出ず、モーダルの中のボタンとリンクの間を行き来する(Shift+Tabは逆向き)', async () => {
    await open(router({ '/api/muse-search/keys': json({ keys: [] }) }));
    const close = document.querySelector<HTMLButtonElement>('[role="dialog"] button[data-action="close"]')!;
    const recent = document.querySelector<HTMLButtonElement>('[role="dialog"] button[data-action="recent"]')!;
    expect(document.activeElement).toBe(close);
    const tab = (shiftKey = false) => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));
    tab();
    expect(document.activeElement).toBe(notesButton());
    tab();
    expect(document.activeElement).toBe(recent);
    tab();
    expect(document.activeElement).toBe(close);
    tab(true);
    expect(document.activeElement).toBe(recent);
  });
  it('Tabは、🗒️の一覧では、見出しのボタン・回答IDのリンクにも届き、最後の次は最初へ戻る', async () => {
    await open(router({ '/api/muse-search/keys': json({ keys: [] }), '/api/muse-search/answers': json({ chats: [thread()] }) }));
    notesButton()!.click();
    await flush();
    const items = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button:not([hidden]), [role="dialog"] a[href]')];
    expect(items.map((el) => el.getAttribute('data-sort-key') ?? el.getAttribute('data-action') ?? el.getAttribute('data-answer-id'))).toEqual(['answers', 'recent', 'close', 'createdAt', 'occurrences', 'a1']);
    const tab = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    items[items.length - 1].focus();
    tab();
    expect(document.activeElement).toBe(items[0]);
  });
  it('CSS: 固定色を使わない(変数のみ)。ページのscriptは構文が通る', () => {
    const html = getMuseSearchPage();
    const start = html.indexOf('<style id="muse-search-style">');
    const style = html.slice(start, html.indexOf('</style>', start));
    expect(style).toContain('.muse-answers-thread');
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// 回答IDのリンク(2026-11-19、ユーザー指定): 表示は前後4文字ずつを残して残りを「…」にし、押すと最上位のモーダルに、その回答をキーワード強調つきで出す。
describe('回答IDのリンクと、回答のモーダル', () => {
  const LONG_ID = 'answer-2026-11-19-0042-abcdef';
  const answer = (over: Record<string, unknown> = {}) => ({ answerId: LONG_ID, occurrences: 2, searchKeys: ['static'], preview: '前…静的…後', createdAt: 1763535000, ...over });
  const chat = (over: Record<string, unknown> = {}) => ({ chatId: 'c1', threadId: null, totalOccurrences: 2, answers: [answer()], ...over });
  const detail = (over: Record<string, unknown> = {}) => ({ answerId: LONG_ID, chatId: 'c1', createdAt: 1763535000, keys: ['static'], truncated: false, segments: [{ text: '前置き ', hit: false }, { text: 'Static', hit: true }, { text: ' 後ろ', hit: false }], ...over });
  const router = (routes: Record<string, () => Promise<Response> | Response>) => vi.fn(async (url: string) => {
    const handler = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))?.[1];
    if (!handler) throw new Error('想定外のURL: ' + url);
    return handler();
  }) as unknown as typeof fetch;
  const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const keysButton = () => document.querySelector<HTMLButtonElement>('button[data-action="keys"]')!;
  const link = () => document.querySelector<HTMLAnchorElement>('a[data-answer-id]');
  const answerOverlay = () => document.querySelector<HTMLElement>('[data-overlay="muse-answer"]');
  const answerDialog = () => answerOverlay()?.querySelector<HTMLElement>('[role="dialog"]') ?? null;
  const keysOverlay = () => document.querySelector<HTMLElement>('[data-overlay="muse-keys"]');
  const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  /** 🔑を開き、🗒️へ切り替える(回答IDのリンクが並ぶ)。 */
  const openList = async (fetchFn: typeof fetch) => {
    mount(fetchFn);
    keysButton().click();
    await flush();
    document.querySelector<HTMLButtonElement>('[role="dialog"] button[data-action="answers"]')!.click();
    await flush();
  };
  const baseRoutes = (extra: Record<string, () => Promise<Response> | Response> = {}) => ({ '/api/muse-search/keys': json({ keys: [] }), '/api/muse-search/answers': json({ chats: [chat()] }), ...extra });

  describe('shortenMuseAnswerId(前後4文字ずつを残して、残りを…にする)', () => {
    it('9文字以上は、前4文字+…+後ろ4文字', () => {
      expect(script.shortenMuseAnswerId(LONG_ID)).toBe('answ…cdef');
      expect(script.shortenMuseAnswerId('123456789')).toBe('1234…6789');
    });
    it('8文字以下は、そのまま(省く文字が無い)。空は空', () => {
      expect(script.shortenMuseAnswerId('12345678')).toBe('12345678');
      expect(script.shortenMuseAnswerId('abc')).toBe('abc');
      expect(script.shortenMuseAnswerId('')).toBe('');
    });
    it('サロゲートペア(絵文字)を、途中で割らない', () => {
      expect(script.shortenMuseAnswerId('😀😀😀😀abc😀😀😀😀')).toBe('😀😀😀😀…😀😀😀😀');
    });
  });

  it('回答IDは、前後4文字ずつを残した文字のリンクで出す。全文は title と aria-label に持つ', async () => {
    await openList(router(baseRoutes()));
    expect(link()!.textContent).toBe('answ…cdef');
    expect(link()!.getAttribute('data-answer-id')).toBe(LONG_ID);
    expect(link()!.title).toBe(LONG_ID);
    expect(link()!.getAttribute('aria-label')).toContain(LONG_ID);
    expect(link()!.getAttribute('href')).toBeTruthy();
  });
  it('押すと /api/muse-search/answer を、回答IDをエンコードして読む。ページ遷移はしない', async () => {
    const fetchFn = router(baseRoutes({ '/api/muse-search/answer?': json(detail()) }));
    await openList(fetchFn);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link()!.dispatchEvent(event);
    await flush();
    expect(event.defaultPrevented).toBe(true);
    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).at(-1)).toBe('/api/muse-search/answer?answerId=' + encodeURIComponent(LONG_ID));
  });
  it('最上位のモーダルに、回答の全文を出し、当たったキーワードを <mark> で強調する。つなぐと元の文章', async () => {
    await openList(router(baseRoutes({ '/api/muse-search/answer?': json(detail({ keys: ['static', 'ねこ'], segments: [{ text: '前置き ', hit: false }, { text: 'Static', hit: true }, { text: ' と ', hit: false }, { text: 'ねこ', hit: true }, { text: '\n二行目', hit: false }] })) })));
    link()!.click();
    await flush();
    const dialog = answerDialog()!;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect([...dialog.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['Static', 'ねこ']);
    expect(dialog.querySelector('.muse-answer-text')!.textContent).toBe('前置き Static と ねこ\n二行目');
    expect(dialog.textContent).toContain('static, ねこ');
    expect(dialog.querySelector('.muse-answer-title')!.textContent).toContain('answ…cdef');
    expect(keysOverlay()).not.toBeNull();
  });
  it('重なり順は、いま画面にある固定位置の要素より上(getNextZ)。🗒️のモーダルより上に出る', async () => {
    const html = getMuseSearchPage();
    const style = document.createElement('style');
    style.textContent = html.slice(html.indexOf('<style id="muse-search-style">') + 30, html.indexOf('</style>', html.indexOf('<style id="muse-search-style">')));
    document.head.appendChild(style);
    try {
      await openList(router(baseRoutes({ '/api/muse-search/answer?': json(detail()) })));
      link()!.click();
      await flush();
      expect(Number(keysOverlay()!.style.zIndex)).toBeGreaterThanOrEqual(800);
      expect(Number(answerOverlay()!.style.zIndex)).toBe(Number(keysOverlay()!.style.zIndex) + 100);
    } finally { style.remove(); }
  });
  it('サーバーから来た文字列は、HTMLとして解釈せず文字のまま出す(強調の中も)', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    await openList(router(baseRoutes({ '/api/muse-search/answer?': json(detail({ keys: [evil], segments: [{ text: evil, hit: true }, { text: evil, hit: false }] })) })));
    link()!.click();
    await flush();
    expect(answerDialog()!.querySelectorAll('img')).toHaveLength(0);
    expect(answerDialog()!.querySelector('mark')!.textContent).toBe(evil);
  });
  it('切り詰めたときは、その旨を出す', async () => {
    await openList(router(baseRoutes({ '/api/muse-search/answer?': json(detail({ truncated: true })) })));
    link()!.click();
    await flush();
    expect(answerDialog()!.textContent).toContain('長いため');
  });
  it('読み込み中の表示を出し、失敗は理由つきで出す(空の回答に見せない)', async () => {
    let release!: (res: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    await openList(router(baseRoutes({ '/api/muse-search/answer?': () => pending })));
    link()!.click();
    expect(answerDialog()!.textContent).toContain('読み込んでいます');
    release(new Response(JSON.stringify({ errorCode: 'http_error', detail: 'upstream 404' }), { status: 502 }));
    await flush();
    expect(answerDialog()!.textContent).toMatch(/502.*upstream 404/);
    expect(answerDialog()!.querySelectorAll('mark')).toHaveLength(0);
  });
  it('404(記録に無い)・ネットワークの失敗も、理由つきで出す', async () => {
    await openList(router(baseRoutes({ '/api/muse-search/answer?': json({ error: 'この回答IDは検索の記録にありません' }, 404) })));
    link()!.click();
    await flush();
    expect(answerDialog()!.textContent).toMatch(/404.*検索の記録にありません/);
    document.body.innerHTML = '';
    await openList(router(baseRoutes({ '/api/muse-search/answer?': () => { throw new Error('network down'); } })));
    link()!.click();
    await flush();
    expect(answerDialog()!.textContent).toContain('network down');
  });
  it('Escは最上位のモーダル(回答)だけを閉じ、🗒️のモーダルは残す。リンクへフォーカスが戻る。もう一度Escで🗒️のモーダルが閉じる', async () => {
    await openList(router(baseRoutes({ '/api/muse-search/answer?': json(detail()) })));
    link()!.focus();
    link()!.click();
    await flush();
    press('Escape');
    expect(answerOverlay()).toBeNull();
    expect(keysOverlay()).not.toBeNull();
    expect(document.activeElement).toBe(link());
    press('Escape');
    expect(keysOverlay()).toBeNull();
  });
  it('✕と外側のクリックで、回答のモーダルだけを閉じる。Tabは回答のモーダルの外へ出ない', async () => {
    await openList(router(baseRoutes({ '/api/muse-search/answer?': json(detail()) })));
    link()!.click();
    await flush();
    const close = answerDialog()!.querySelector<HTMLButtonElement>('button[data-action="close"]')!;
    expect(document.activeElement).toBe(close);
    press('Tab');
    expect(document.activeElement).toBe(close);
    close.click();
    expect(answerOverlay()).toBeNull();
    expect(keysOverlay()).not.toBeNull();
    link()!.click();
    await flush();
    answerOverlay()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(answerOverlay()).toBeNull();
    expect(keysOverlay()).not.toBeNull();
  });
  it('開いている間に同じリンクをもう一度押しても重ねない。閉じたあとの遅れた応答は、画面を出さない', async () => {
    let release!: (res: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    await openList(router(baseRoutes({ '/api/muse-search/answer?': () => pending })));
    link()!.click();
    link()!.click();
    expect(document.querySelectorAll('[data-overlay="muse-answer"]')).toHaveLength(1);
    press('Escape');
    release(new Response(JSON.stringify(detail())));
    await flush();
    expect(answerOverlay()).toBeNull();
    expect(document.querySelectorAll('mark')).toHaveLength(0);
  });
  it('CSS: 強調と回答のモーダルは、固定色を使わず変数を使う。回答のモーダルは固定位置', () => {
    const html = getMuseSearchPage();
    const start = html.indexOf('<style id="muse-search-style">');
    const style = html.slice(start, html.indexOf('</style>', start));
    expect(style).toMatch(/\.muse-answer-overlay \{ position: fixed; inset: 0;/);
    expect(style).toMatch(/\.muse-answer-text mark \{[^}]*var\(--/);
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// 📅ボタン(2026-11-19、ユーザー指定。撤回と言い直しあり): 検索キーのモーダルの🗒️の右。押すと、最上位のレイヤーに、スレッドを問わず日付順に回答を並べて出す。
// 検索キーのモーダルの表示・開いた直後のフォーカス(✕)は変えない。
describe('📅ボタン(最上位レイヤーに、スレッドを問わず日付順の回答)', () => {
  const answer = (over: Record<string, unknown> = {}) => ({ answerId: 'a1', occurrences: 2, searchKeys: ['static'], preview: '前…静的…後', createdAt: 1763535000, ...over });
  const chats = () => ({ chats: [
    { chatId: 'c-A', threadId: 't1', totalOccurrences: 9, answers: [answer({ answerId: 'answer-A-old-0001', createdAt: 1000, occurrences: 4 }), answer({ answerId: 'answer-A-new-0002', createdAt: 4000, occurrences: 5 })] },
    { chatId: 'c-B', threadId: null, totalOccurrences: 3, answers: [answer({ answerId: 'answer-B-mid-0003', createdAt: 3000, occurrences: 3 })] },
    { chatId: 'c-C', threadId: 't2', totalOccurrences: 1, answers: [answer({ answerId: 'answer-C-tie-0004', createdAt: 3000, occurrences: 1 })] },
  ] });
  const router = (routes: Record<string, () => Promise<Response> | Response>) => vi.fn(async (url: string) => {
    const handler = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))?.[1];
    if (!handler) throw new Error('想定外のURL: ' + url);
    return handler();
  }) as unknown as typeof fetch;
  const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const keysButton = () => document.querySelector<HTMLButtonElement>('button[data-action="keys"]')!;
  const keysOverlay = () => document.querySelector<HTMLElement>('[data-overlay="muse-keys"]');
  const recentOverlay = () => document.querySelector<HTMLElement>('[data-overlay="muse-recent"]');
  const answerOverlay = () => document.querySelector<HTMLElement>('[data-overlay="muse-answer"]');
  const recentButton = () => document.querySelector<HTMLButtonElement>('[data-overlay="muse-keys"] button[data-action="recent"]')!;
  const notes = () => document.querySelector<HTMLButtonElement>('[data-overlay="muse-keys"] button[data-action="answers"]')!;
  const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  const routes = (extra: Record<string, () => Promise<Response> | Response> = {}) => ({ '/api/muse-search/keys': json({ keys: [{ searchKey: 'alpha', aiChatCount: 1, treeViewCount: 1, searchCount: 1, firstSearchedAt: '2026-11-19T00:00:00Z', lastSearchedAt: '2026-11-19T00:00:00Z' }] }), '/api/muse-search/answers': json(chats()), ...extra });
  const open = async (fetchFn: typeof fetch) => { mount(fetchFn); keysButton().click(); await flush(); };
  const rows = () => [...document.querySelectorAll('[data-overlay="muse-recent"] .muse-recent-table tbody tr')];
  const withPageCss = async (run: () => Promise<void>) => {
    const html = getMuseSearchPage();
    const style = document.createElement('style');
    style.textContent = html.slice(html.indexOf('<style id="muse-search-style">') + 30, html.indexOf('</style>', html.indexOf('<style id="muse-search-style">')));
    document.head.appendChild(style);
    try { await run(); } finally { style.remove(); }
  };

  it('🗒️の右に📅がある(タイトル → 🗒️ → 📅 → ✕)。名前を持つ。検索キーのモーダルを開いたときだけある', async () => {
    mount(router({}));
    expect(document.querySelector('button[data-action="recent"]')).toBeNull();
    await open(router(routes()));
    expect(notes().nextElementSibling).toBe(recentButton());
    expect(recentButton().nextElementSibling!.getAttribute('data-action')).toBe('close');
    expect(recentButton().textContent).toContain('📅');
    expect(recentButton().getAttribute('aria-label')).toBeTruthy();
  });
  it('開いた直後は、検索キーの一覧のまま(タイトルも同じ)。フォーカスは✕のまま。📅を押すまで、回答の一覧は読まない', async () => {
    const fetchFn = router(routes());
    await open(fetchFn);
    expect(document.querySelector('#muse-keys-title')!.textContent).toContain('検索キー');
    expect(document.querySelector('.muse-keys-table')).not.toBeNull();
    expect(document.activeElement).toBe(document.querySelector('[data-overlay="muse-keys"] button[data-action="close"]'));
    expect(recentOverlay()).toBeNull();
    expect(callUrls(fetchFn)).toEqual(['/api/muse-search/keys']);
  });
  it('押すと、最上位のレイヤーに、チャットもスレッドも問わず、回答を日付の新しい順に1つの表で出す。同時刻は回答ID順。検索キーのモーダルは下に残る', async () => {
    const fetchFn = router(routes());
    await open(fetchFn);
    recentButton().click();
    await flush();
    expect(callUrls(fetchFn)).toEqual(['/api/muse-search/keys', '/api/muse-search/answers']);
    const dialog = recentOverlay()!.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.querySelector('.muse-recent-title')!.textContent).toContain('新しい順');
    expect(keysOverlay()).not.toBeNull();
    expect(keysOverlay()!.querySelector('.muse-keys-table')).not.toBeNull();
    expect(recentOverlay()!.querySelectorAll('.muse-answers-thread')).toHaveLength(0);
    expect([...recentOverlay()!.querySelectorAll('.muse-recent-table thead th')].map((th) => th.textContent)).toEqual(['回答日時(日本時間)', '回答ID', 'チャットID', '出現回数', '検索キー', '一致箇所の前後']);
    expect(rows().map((tr) => [...tr.children].map((td) => td.textContent))).toEqual([
      [script.formatMuseSearchTime(4000), 'answ…0002', 'c-A', '5', 'static', '前…静的…後'],
      [script.formatMuseSearchTime(3000), 'answ…0003', 'c-B', '3', 'static', '前…静的…後'],
      [script.formatMuseSearchTime(3000), 'answ…0004', 'c-C', '1', 'static', '前…静的…後'],
      [script.formatMuseSearchTime(1000), 'answ…0001', 'c-A', '4', 'static', '前…静的…後'],
    ]);
    expect(document.activeElement).toBe(dialog.querySelector('button[data-action="close"]'));
  });
  it('重なり順は、検索キーのモーダルより上(getNextZ)', async () => {
    await withPageCss(async () => {
      await open(router(routes()));
      recentButton().click();
      await flush();
      expect(Number(recentOverlay()!.style.zIndex)).toBe(Number(keysOverlay()!.style.zIndex) + 100);
    });
  });
  it('回答IDはリンク。押すと回答のモーダルが、📅のレイヤーのさらに上に開く', async () => {
    await withPageCss(async () => {
      await open(router(routes({ '/api/muse-search/answer?': json({ answerId: 'answer-A-new-0002', chatId: 'c-A', createdAt: 4000, keys: ['static'], truncated: false, segments: [{ text: '本文', hit: false }] }) })));
      recentButton().click();
      await flush();
      const links = recentOverlay()!.querySelectorAll<HTMLAnchorElement>('a[data-answer-id]');
      expect(links).toHaveLength(4);
      expect(links[0].getAttribute('data-answer-id')).toBe('answer-A-new-0002');
      links[0].click();
      await flush();
      expect(answerOverlay()).not.toBeNull();
      expect(Number(answerOverlay()!.style.zIndex)).toBe(Number(recentOverlay()!.style.zIndex) + 100);
    });
  });
  it('Escは、いちばん上のレイヤーだけを閉じる(回答 → 📅 → 検索キーの順)。閉じたあと、開いたボタンへフォーカスが戻る', async () => {
    await open(router(routes({ '/api/muse-search/answer?': json({ answerId: 'x', chatId: 'c', createdAt: 1, keys: ['k'], truncated: false, segments: [{ text: 't', hit: false }] }) })));
    recentButton().focus();
    recentButton().click();
    await flush();
    const link = recentOverlay()!.querySelector<HTMLAnchorElement>('a[data-answer-id]')!;
    link.focus();
    link.click();
    await flush();
    press('Escape');
    expect(answerOverlay()).toBeNull();
    expect(recentOverlay()).not.toBeNull();
    expect(document.activeElement).toBe(link);
    press('Escape');
    expect(recentOverlay()).toBeNull();
    expect(keysOverlay()).not.toBeNull();
    expect(document.activeElement).toBe(recentButton());
    press('Escape');
    expect(keysOverlay()).toBeNull();
  });
  it('✕と外側のクリックで、📅のレイヤーだけを閉じる。Tabは📅のレイヤーの外へ出ない', async () => {
    await open(router(routes()));
    recentButton().click();
    await flush();
    const close = recentOverlay()!.querySelector<HTMLButtonElement>('button[data-action="close"]')!;
    press('Tab');
    expect(document.activeElement).toBe(recentOverlay()!.querySelector('a[data-answer-id]'));
    close.click();
    expect(recentOverlay()).toBeNull();
    expect(keysOverlay()).not.toBeNull();
    recentButton().click();
    await flush();
    recentOverlay()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(recentOverlay()).toBeNull();
    expect(keysOverlay()).not.toBeNull();
  });
  it('🗒️は今までどおり、検索キーの一覧とチャットごとの一覧を切り替える(📅の影響を受けない)', async () => {
    await open(router(routes()));
    notes().click();
    await flush();
    expect(document.querySelector('#muse-keys-title')!.textContent).toContain('チャットごと');
    notes().click();
    await flush();
    expect(document.querySelector('#muse-keys-title')!.textContent).toContain('検索キー');
    expect(notes().getAttribute('aria-pressed')).toBe('false');
  });
  it('開いている間に📅をもう一度押しても重ねない。閉じたあとの遅れた応答は、画面を出さない', async () => {
    let release!: (res: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    await open(router(routes({ '/api/muse-search/answers': () => pending })));
    recentButton().click();
    recentButton().click();
    expect(document.querySelectorAll('[data-overlay="muse-recent"]')).toHaveLength(1);
    expect(recentOverlay()!.textContent).toContain('読み込んでいます');
    press('Escape');
    release(new Response(JSON.stringify(chats())));
    await flush();
    expect(recentOverlay()).toBeNull();
    expect(document.querySelector('.muse-recent-table')).toBeNull();
  });
  it('記録が無ければ空の案内、読めなければ理由つきのエラー(空の一覧に見せない)', async () => {
    await open(router(routes({ '/api/muse-search/answers': json({ chats: [] }) })));
    recentButton().click();
    await flush();
    expect(recentOverlay()!.textContent).toContain('まだ');
    document.body.innerHTML = '';
    await open(router(routes({ '/api/muse-search/answers': json({ error: 'x', detail: 'd1 down' }, 503) })));
    recentButton().click();
    await flush();
    expect(recentOverlay()!.textContent).toMatch(/503.*d1 down/);
    expect(rows()).toHaveLength(0);
  });
  it('サーバーから来た文字列は、HTMLとして解釈せず文字のまま出す', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    await open(router(routes({ '/api/muse-search/answers': json({ chats: [{ chatId: evil, threadId: null, totalOccurrences: 1, answers: [answer({ answerId: evil, searchKeys: [evil], preview: evil })] }] }) })));
    recentButton().click();
    await flush();
    expect(recentOverlay()!.querySelectorAll('img')).toHaveLength(0);
    expect(recentOverlay()!.querySelector('.muse-recent-table')!.textContent).toContain(evil);
  });
  it('CSS: 📅のレイヤーは固定位置で、固定色を使わない', () => {
    const html = getMuseSearchPage();
    const start = html.indexOf('<style id="muse-search-style">');
    const style = html.slice(start, html.indexOf('</style>', start));
    expect(style).toMatch(/\.muse-recent-overlay \{ position: fixed; inset: 0;/);
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// 初期画面のスレッド一覧(2026-11-19、ユーザー指定): 各スレッドへの最終書き込みの日時が新しいほうから順に、スレッドタイトルのリンクだけを並べる。
// リンクを押すと、そのスレッドへの最終書き込みを、リンクの下に、段落に分けて表示する。
describe('初期画面のスレッド一覧', () => {
  const thread = (over: Record<string, unknown> = {}) => ({ threadId: 't1', title: 'スレッド1の話題', lastPostAt: 1763535000, ...over });
  const lastPost = (over: Record<string, unknown> = {}) => ({ threadId: 't1', chatId: 'c-A2', role: 'assistant', createdAt: 1763538600, truncated: false, paragraphs: [[{ text: '一段落目\n二行目', hit: false }], [{ text: '二段落目', hit: false }]], ...over });
  const router = (routes: Record<string, () => Promise<Response> | Response>) => vi.fn(async (url: string) => {
    const handler = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))?.[1];
    if (!handler) throw new Error('想定外のURL: ' + url);
    return handler();
  }) as unknown as typeof fetch;
  const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const calls = (fetchFn: typeof fetch) => (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
  const section = () => document.querySelector<HTMLElement>('[data-field="threads"]')!;
  const links = () => [...section().querySelectorAll<HTMLAnchorElement>('a[data-thread-id]')];
  const panelOf = (link: Element) => link.parentElement!.querySelector<HTMLElement>('.muse-thread-last');
  // routerは、先に書いた接頭語から照合する。個別の指定(extra)を先に置き、同じ接頭語の既定は、extraで置き換える。
  const threadsRoutes = (extra: Record<string, () => Promise<Response> | Response> = {}) => {
    const base: Record<string, () => Promise<Response> | Response> = {
      '/api/muse-search/threads': json({ threads: [thread({ threadId: 't2', title: '新しいスレッド', lastPostAt: 200 }), thread({ threadId: 't1', title: '古いスレッド', lastPostAt: 100 }), thread({ threadId: 't3', title: '一番古い', lastPostAt: 50 })] }),
      '/api/muse-search/thread?': json(lastPost()),
    };
    return Object.fromEntries([...Object.entries(extra), ...Object.entries(base).filter(([k]) => !(k in extra))]);
  };

  it('読み込み時に一覧を取り、スレッドタイトルのリンクだけを、APIの順(最終書き込みの新しい順)に並べる。リンクには日時などの文字を足さない', async () => {
    const fetchFn = router(threadsRoutes());
    mount(fetchFn);
    await flush();
    expect(calls(fetchFn)).toEqual(['/api/muse-search/threads']);
    expect(links().map((a) => a.textContent)).toEqual(['新しいスレッド', '古いスレッド', '一番古い']);
    expect([...section().querySelectorAll('li')].map((li) => li.textContent)).toEqual(['新しいスレッド', '古いスレッド', '一番古い']);
    expect(links()[0].getAttribute('data-thread-id')).toBe('t2');
    expect(links()[0].getAttribute('href')).toBeTruthy();
    expect(links()[0].title).toContain(script.formatMuseSearchTime(200));
    expect(links()[0].getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelectorAll('.muse-thread-last')).toHaveLength(0);
  });
  it('押すと /api/muse-search/thread をスレッドIDをエンコードして読み、リンクの下に、最終書き込みを段落ごとの <p> で出す(段落の中の改行は残す)。ページ遷移はしない', async () => {
    const fetchFn = router(threadsRoutes());
    mount(fetchFn);
    await flush();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    links()[1].dispatchEvent(event);
    await flush();
    expect(event.defaultPrevented).toBe(true);
    expect(calls(fetchFn).at(-1)).toBe('/api/muse-search/thread?threadId=t1');
    const panel = panelOf(links()[1])!;
    expect(panel).not.toBeNull();
    expect(links()[1].nextElementSibling).toBe(panel);
    expect([...panel.querySelectorAll('p.muse-thread-paragraph')].map((p) => p.textContent)).toEqual(['一段落目\n二行目', '二段落目']);
    expect(panel.querySelector('.muse-thread-meta')!.textContent).toContain(script.formatMuseSearchTime(1763538600));
    expect(panel.querySelector('.muse-thread-meta')!.textContent).toContain('回答');
    expect(panel.querySelector('.muse-thread-meta')!.textContent).toContain('c-A2');
    expect(links()[1].getAttribute('aria-expanded')).toBe('true');
    expect(panelOf(links()[0])).toBeNull();
  });
  it('もう一度押すと閉じ、また押すと開く。開き直しでは再び取りにいかない(取れた本文を覚えている)', async () => {
    const fetchFn = router(threadsRoutes());
    mount(fetchFn);
    await flush();
    links()[0].click();
    await flush();
    links()[0].click();
    expect(panelOf(links()[0])!.hidden).toBe(true);
    expect(links()[0].getAttribute('aria-expanded')).toBe('false');
    links()[0].click();
    expect(panelOf(links()[0])!.hidden).toBe(false);
    expect(links()[0].getAttribute('aria-expanded')).toBe('true');
    expect(calls(fetchFn).filter((u) => u.startsWith('/api/muse-search/thread?'))).toHaveLength(1);
  });
  it('複数のスレッドを、それぞれ開ける(ほかのスレッドを閉じない)。質問(user)の最終書き込みは「質問」と出す', async () => {
    mount(router(threadsRoutes({ '/api/muse-search/thread?threadId=t2': json(lastPost({ threadId: 't2', role: 'user', paragraphs: [[{ text: '質問の本文', hit: false }]] })), '/api/muse-search/thread?threadId=t1': json(lastPost()) })));
    await flush();
    links()[0].click();
    await flush();
    links()[1].click();
    await flush();
    expect(panelOf(links()[0])!.hidden).toBe(false);
    expect(panelOf(links()[1])!.hidden).toBe(false);
    expect(panelOf(links()[0])!.querySelector('.muse-thread-meta')!.textContent).toContain('質問');
  });
  it('読み込み中の表示を出し、失敗は理由つきで出す(空の本文に見せない)。失敗したあとは、押し直すと取り直す', async () => {
    let attempt = 0;
    let release!: (res: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    const fetchFn = router(threadsRoutes({ '/api/muse-search/thread?': () => (++attempt === 1 ? pending : json(lastPost())()) }));
    mount(fetchFn);
    await flush();
    links()[0].click();
    expect(panelOf(links()[0])!.textContent).toContain('読み込んでいます');
    release(new Response(JSON.stringify({ errorCode: 'http_error', detail: 'upstream 404' }), { status: 502 }));
    await flush();
    expect(panelOf(links()[0])!.textContent).toMatch(/502.*upstream 404/);
    expect(panelOf(links()[0])!.querySelectorAll('p.muse-thread-paragraph')).toHaveLength(0);
    links()[0].click();
    links()[0].click();
    await flush();
    expect(attempt).toBe(2);
    expect(panelOf(links()[0])!.querySelectorAll('p.muse-thread-paragraph').length).toBeGreaterThan(0);
  });
  it('切り詰めたときは、その旨を出す', async () => {
    mount(router(threadsRoutes({ '/api/muse-search/thread?': json(lastPost({ truncated: true })) })));
    await flush();
    links()[0].click();
    await flush();
    expect(panelOf(links()[0])!.textContent).toContain('長いため');
  });
  // 各回答(最終書き込み)に、閲覧ユーザーが持つキーワードを強調する(2026-11-19、ユーザー指定)。強調の区間はサーバーで計算済み。画面は <mark> で描く。
  it('最終書き込みの各段落で、強調の区間(hit: true)を <mark> にする。段落の文字は、つなぐと変わらない(改行も残る)', async () => {
    mount(router(threadsRoutes({ '/api/muse-search/thread?': json(lastPost({ paragraphs: [
      [{ text: 'Workers の', hit: false }, { text: 'Static', hit: true }, { text: ' を配信\n二行目', hit: false }],
      [{ text: '二段落目の', hit: false }, { text: 'static', hit: true }, { text: ' と ', hit: false }, { text: 'ASSETS', hit: true }],
    ] })) })));
    await flush();
    links()[0].click();
    await flush();
    const paragraphs = [...panelOf(links()[0])!.querySelectorAll('p.muse-thread-paragraph')];
    expect(paragraphs.map((p) => p.textContent)).toEqual(['Workers のStatic を配信\n二行目', '二段落目のstatic と ASSETS']);
    expect(paragraphs.map((p) => [...p.querySelectorAll('mark')].map((m) => m.textContent))).toEqual([['Static'], ['static', 'ASSETS']]);
  });
  it('強調が無い段落には、<mark> を付けない', async () => {
    mount(router(threadsRoutes()));
    await flush();
    links()[0].click();
    await flush();
    expect(panelOf(links()[0])!.querySelectorAll('mark')).toHaveLength(0);
  });
  it('強調の中の文字も、HTMLとして解釈せず文字のまま出す', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    mount(router(threadsRoutes({ '/api/muse-search/thread?': json(lastPost({ paragraphs: [[{ text: evil, hit: true }]] })) })));
    await flush();
    links()[0].click();
    await flush();
    expect(panelOf(links()[0])!.querySelectorAll('img')).toHaveLength(0);
    expect(panelOf(links()[0])!.querySelector('mark')!.textContent).toBe(evil);
  });
  it('強調できなかったとき(highlightError)は、本文は出したまま、その理由を、強調なしであることが分かる形で出す。無ければ、何も出さない', async () => {
    mount(router(threadsRoutes({ '/api/muse-search/thread?': json(lastPost({ highlightError: 'd1 down' })) })));
    await flush();
    links()[0].click();
    await flush();
    const panel = panelOf(links()[0])!;
    expect(panel.querySelectorAll('p.muse-thread-paragraph').length).toBeGreaterThan(0);
    expect(panel.querySelector('.muse-thread-highlight-error')!.textContent).toContain('強調');
    expect(panel.querySelector('.muse-thread-highlight-error')!.textContent).toContain('d1 down');
    document.body.innerHTML = '';
    mount(router(threadsRoutes()));
    await flush();
    links()[0].click();
    await flush();
    expect(panelOf(links()[0])!.querySelector('.muse-thread-highlight-error')).toBeNull();
  });
  it('CSS: 強調(mark)は、検索結果・回答の強調と同じ配色(変数)。固定色なし', () => {
    const html = getMuseSearchPage();
    const start = html.indexOf('<style id="muse-search-style">');
    const style = html.slice(start, html.indexOf('</style>', start));
    expect(style).toMatch(/\.muse-thread-paragraph mark \{[^}]*var\(--warning-color\)/);
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it('サーバーから来た文字列(タイトル・本文)は、HTMLとして解釈せず文字のまま出す', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    mount(router(threadsRoutes({ '/api/muse-search/threads': json({ threads: [thread({ title: evil })] }), '/api/muse-search/thread?': json(lastPost({ paragraphs: [[{ text: evil, hit: false }]] })) })));
    await flush();
    links()[0].click();
    await flush();
    expect(section().querySelectorAll('img')).toHaveLength(0);
    expect(links()[0].textContent).toBe(evil);
    expect(panelOf(links()[0])!.querySelector('p.muse-thread-paragraph')!.textContent).toBe(evil);
  });
  it('スレッドが1つも無いときは案内を出す。一覧を取れなかったときは、理由つきのエラー(例外にしない・空の一覧に見せない)', async () => {
    mount(router(threadsRoutes({ '/api/muse-search/threads': json({ threads: [] }) })));
    await flush();
    expect(section().textContent).toContain('スレッドがまだありません');
    document.body.innerHTML = '';
    mount(router(threadsRoutes({ '/api/muse-search/threads': json({ errorCode: 'http_error', detail: 'upstream 401' }, 502) })));
    await flush();
    expect(section().textContent).toMatch(/502.*upstream 401/);
    expect(links()).toHaveLength(0);
    document.body.innerHTML = '';
    mount(router(threadsRoutes({ '/api/muse-search/threads': json({ unexpected: true }) })));
    await flush();
    expect(section().textContent).toContain('読み込めませんでした');
    document.body.innerHTML = '';
    mount(router(threadsRoutes({ '/api/muse-search/threads': () => { throw new Error('network down'); } })));
    await flush();
    expect(section().textContent).toContain('network down');
  });
  it('検索を始めると、初期画面のスレッド一覧は隠れる。検索の結果は今までどおり出る。一覧を取り直さない', async () => {
    const fetchFn = router(threadsRoutes({ '/api/muse-search?': json({ count: 0, posts: [] }) }));
    const page = mount(fetchFn);
    await flush();
    expect(section().hidden).toBe(false);
    page.submit('静的');
    await flush();
    expect(section().hidden).toBe(true);
    expect(page.status()).toContain('見つかりませんでした');
    expect(calls(fetchFn).filter((u) => u === '/api/muse-search/threads')).toHaveLength(1);
  });
  it('空の検索文では、検索はしないが、入力を促すメッセージは「検索結果」のタブにあるので、そのタブへ移る(2026-11-19、タブの追加による仕様変更。以前は、一覧のまま)', async () => {
    const fetchFn = router(threadsRoutes());
    const page = mount(fetchFn);
    await flush();
    page.submit('   ');
    await flush();
    expect(section().hidden).toBe(true);
    expect(page.status()).toContain('検索する文字を入力');
    expect(calls(fetchFn).filter((u) => u.startsWith('/api/muse-search?'))).toEqual([]);
  });
  // 「全開/全閉」トグルボタンと検索窓(2026-11-19、ユーザー指定): 表示中のスレッド一覧に検索をかけられるようにする。
  // 検索窓は、表示中のスレッドのタイトルを絞り込む(ブラウザ側だけ。サーバーは呼ばない)。全開/全閉は、表示中のスレッドの最終書き込みを、まとめて開く/閉じる。
  describe('全開/全閉と、スレッドの絞り込み', () => {
    const filter = () => section().querySelector<HTMLInputElement>('input[data-field="thread-filter"]')!;
    const toggleAll = () => section().querySelector<HTMLButtonElement>('button[data-action="toggle-all"]')!;
    const items = () => [...section().querySelectorAll<HTMLElement>('li.muse-thread-item')];
    const visibleTitles = () => items().filter((li) => !li.hidden).map((li) => li.querySelector('a')!.textContent);
    const type = (value: string) => { filter().value = value; filter().dispatchEvent(new Event('input', { bubbles: true })); };
    const threadUrls = (fetchFn: typeof fetch) => calls(fetchFn).filter((u) => u.startsWith('/api/muse-search/thread?'));
    const threeThreads = { threads: [
      thread({ threadId: 't1', title: 'Workers の静的アセット' }),
      thread({ threadId: 't2', title: 'Tailscale DERP の調査' }),
      thread({ threadId: 't3', title: 'ワーカーのデプロイ' }),
    ] };
    const open3 = async (extra: Record<string, () => Promise<Response> | Response> = {}) => {
      const fetchFn = router(threadsRoutes({ '/api/muse-search/threads': json(threeThreads), ...extra }));
      mount(fetchFn);
      await flush();
      return fetchFn;
    };

    it('一覧を取れたあとに、検索窓と「全開」ボタンが出る。スレッドが無いとき・一覧を取れなかったときは出さない', async () => {
      await open3();
      expect(filter()).not.toBeNull();
      expect(filter().type).toBe('search');
      expect(filter().getAttribute('aria-label')).toBeTruthy();
      expect(toggleAll().type).toBe('button');
      expect(toggleAll().textContent).toBe('全開');
      document.body.innerHTML = '';
      mount(router(threadsRoutes({ '/api/muse-search/threads': json({ threads: [] }) })));
      await flush();
      expect(section().querySelector('input[data-field="thread-filter"]')).toBeNull();
      expect(section().querySelector('button[data-action="toggle-all"]')).toBeNull();
      document.body.innerHTML = '';
      mount(router(threadsRoutes({ '/api/muse-search/threads': json({ error: 'x' }, 502) })));
      await flush();
      expect(section().querySelector('input[data-field="thread-filter"]')).toBeNull();
    });
    it('検索窓に入れると、タイトルに含まれるスレッドだけが残る。大文字小文字は区別しない。前後の空白は無視する。空にすると全部に戻る。サーバーは呼ばない', async () => {
      const fetchFn = await open3();
      const before = calls(fetchFn).length;
      type('tailscale');
      expect(visibleTitles()).toEqual(['Tailscale DERP の調査']);
      type('  の静的  ');
      expect(visibleTitles()).toEqual(['Workers の静的アセット']);
      type('ワーカー');
      expect(visibleTitles()).toEqual(['ワーカーのデプロイ']);
      type('   ');
      expect(visibleTitles()).toEqual(['Workers の静的アセット', 'Tailscale DERP の調査', 'ワーカーのデプロイ']);
      type('');
      expect(visibleTitles()).toHaveLength(3);
      expect(calls(fetchFn).length).toBe(before);
    });
    it('1件も一致しないときは、その旨の案内を出す(空の画面にしない)。一致が戻れば消える。並びは変わらない', async () => {
      await open3();
      const empty = () => section().querySelector<HTMLElement>('.muse-thread-nomatch')!;
      expect(empty().hidden).toBe(true);
      type('存在しない言葉');
      expect(visibleTitles()).toEqual([]);
      expect(empty().hidden).toBe(false);
      expect(empty().textContent).toContain('一致するスレッドはありません');
      type('の');
      expect(empty().hidden).toBe(true);
      expect(items().map((li) => li.querySelector('a')!.textContent)).toEqual(['Workers の静的アセット', 'Tailscale DERP の調査', 'ワーカーのデプロイ']);
    });
    it('「全開」を押すと、表示中のスレッドの最終書き込みを、すべて開く(それぞれ取って、リンクの下に出す)。ボタンは「全閉」になる', async () => {
      const fetchFn = await open3();
      toggleAll().click();
      await flush();
      expect(threadUrls(fetchFn).sort()).toEqual(['/api/muse-search/thread?threadId=t1', '/api/muse-search/thread?threadId=t2', '/api/muse-search/thread?threadId=t3']);
      for (const a of links()) {
        expect(a.getAttribute('aria-expanded')).toBe('true');
        expect(panelOf(a)!.hidden).toBe(false);
        expect(panelOf(a)!.querySelectorAll('p.muse-thread-paragraph').length).toBeGreaterThan(0);
      }
      expect(toggleAll().textContent).toBe('全閉');
    });
    it('「全閉」を押すと、表示中のスレッドをすべて閉じる。ボタンは「全開」に戻る。また「全開」を押しても、取った本文は取り直さない', async () => {
      const fetchFn = await open3();
      toggleAll().click();
      await flush();
      toggleAll().click();
      for (const a of links()) {
        expect(a.getAttribute('aria-expanded')).toBe('false');
        expect(panelOf(a)!.hidden).toBe(true);
      }
      expect(toggleAll().textContent).toBe('全開');
      toggleAll().click();
      await flush();
      expect(threadUrls(fetchFn)).toHaveLength(3);
      expect(links().every((a) => a.getAttribute('aria-expanded') === 'true')).toBe(true);
    });
    it('全開/全閉は、絞り込みで表示中のスレッドだけに効く(隠れているスレッドは、取りにも、開閉にも行かない)', async () => {
      const fetchFn = await open3();
      type('tailscale');
      toggleAll().click();
      await flush();
      expect(threadUrls(fetchFn)).toEqual(['/api/muse-search/thread?threadId=t2']);
      expect(links().map((a) => a.getAttribute('aria-expanded'))).toEqual(['false', 'true', 'false']);
      type('');
      expect(toggleAll().textContent).toBe('全開');
      toggleAll().click();
      await flush();
      expect(threadUrls(fetchFn).sort()).toEqual(['/api/muse-search/thread?threadId=t1', '/api/muse-search/thread?threadId=t2', '/api/muse-search/thread?threadId=t3']);
    });
    it('ボタンの文字は、表示中のスレッドの開閉に合わせて変わる(1つずつ開いて全部開けば「全閉」、1つ閉じれば「全開」)。絞り込みを変えても追従する', async () => {
      await open3();
      for (const a of links()) { a.click(); await flush(); }
      expect(toggleAll().textContent).toBe('全閉');
      links()[0].click();
      expect(toggleAll().textContent).toBe('全開');
      links()[0].click();
      expect(toggleAll().textContent).toBe('全閉');
      type('tailscale');
      expect(toggleAll().textContent).toBe('全閉');
      document.body.innerHTML = '';
      await open3();
      links()[0].click();
      await flush();
      type('静的');
      expect(toggleAll().textContent).toBe('全閉');
      type('');
      expect(toggleAll().textContent).toBe('全開');
    });
    it('一致が1件も無いとき、ボタンを押しても何も取りにいかない(「全開」のまま)', async () => {
      const fetchFn = await open3();
      type('存在しない言葉');
      toggleAll().click();
      await flush();
      expect(threadUrls(fetchFn)).toEqual([]);
      expect(toggleAll().textContent).toBe('全開');
    });
    it('全開は、同時に取りにいく数を4つまでに抑える(多数のスレッドでも、一度に何十本も送らない)。最後にはすべて開く', async () => {
      let inflight = 0;
      let peak = 0;
      const many = { threads: Array.from({ length: 12 }, (_, i) => thread({ threadId: 'm' + i, title: 'スレッド' + i })) };
      const fetchFn = router({
        '/api/muse-search/threads': json(many),
        '/api/muse-search/thread?': async () => {
          inflight += 1; peak = Math.max(peak, inflight);
          await new Promise((resolve) => setTimeout(resolve, 5));
          inflight -= 1;
          return new Response(JSON.stringify(lastPost()), { status: 200, headers: { 'Content-Type': 'application/json' } });
        },
      });
      mount(fetchFn);
      await flush();
      toggleAll().click();
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(peak).toBeLessThanOrEqual(4);
      expect(peak).toBeGreaterThan(1);
      expect(threadUrls(fetchFn)).toHaveLength(12);
      expect(links().every((a) => panelOf(a)!.querySelectorAll('p.muse-thread-paragraph').length > 0)).toBe(true);
    });
    it('検索(上の検索窓)を始めると、この検索窓・ボタンも、一覧と一緒に隠れる', async () => {
      const page = mount(router(threadsRoutes({ '/api/muse-search/threads': json(threeThreads), '/api/muse-search?': json({ count: 0, posts: [] }) })));
      await flush();
      page.submit('静的');
      await flush();
      expect(section().hidden).toBe(true);
      expect(filter().closest('[data-field="threads"]')).toBe(section());
    });
    it('CSS: 検索窓とボタンは、固定色を使わず変数を使う', () => {
      const html = getMuseSearchPage();
      const start = html.indexOf('<style id="muse-search-style">');
      const style = html.slice(start, html.indexOf('</style>', start));
      expect(style).toMatch(/\.muse-thread-tools \{[^}]*display: flex/);
      expect(style).toMatch(/\.muse-thread-filter \{[^}]*var\(--/);
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
  });

  it('CSS: 一覧と本文は、固定色を使わず変数を使う。リンクに下線を付けない', () => {
    const html = getMuseSearchPage();
    const start = html.indexOf('<style id="muse-search-style">');
    const style = html.slice(start, html.indexOf('</style>', start));
    expect(style).toMatch(/\.muse-thread-link \{[^}]*text-decoration: none/);
    expect(style).toMatch(/\.muse-thread-paragraph \{[^}]*white-space: pre-wrap/);
    expect(style).toMatch(/\.muse-thread-last \{[^}]*var\(--/);
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// スマホ幅の縦並びの設定(2026-11-19、ユーザー指定): 設定で選べるようにし、初期値はOFF(今までの表のまま)。
describe('スマホ幅の縦並びの設定(切り替えスイッチ)', () => {
  const KEY = 'museSearchStackedTables';
  const reply = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
  const toggle = () => document.querySelector<HTMLInputElement>('input[data-setting="stacked"]')!;
  const stackedOn = () => document.documentElement.classList.contains('muse-stacked');
  const reset = () => { try { window.localStorage.clear(); } catch { /* 無ければ、何もしない */ } document.documentElement.classList.remove('muse-stacked'); };
  beforeEach(reset);
  afterEach(() => { reset(); vi.restoreAllMocks(); });

  it('ページにスイッチがある(名前を持つ)。初期値はOFF: 保存が無ければ、チェックなし・縦並びのクラスなし', () => {
    mount(reply({ threads: [] }));
    expect(toggle()).not.toBeNull();
    expect(toggle().type).toBe('checkbox');
    expect(toggle().closest('label')!.textContent).toContain('スマホ幅');
    expect(toggle().checked).toBe(false);
    expect(stackedOn()).toBe(false);
  });
  it('ONにすると、縦並びのクラスが付き、この端末のブラウザに保存する。OFFに戻すと、クラスが外れ、保存も消える', () => {
    mount(reply({ threads: [] }));
    toggle().checked = true;
    toggle().dispatchEvent(new Event('change', { bubbles: true }));
    expect(stackedOn()).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe('1');
    toggle().checked = false;
    toggle().dispatchEvent(new Event('change', { bubbles: true }));
    expect(stackedOn()).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
  it('保存してあれば、ページを開いたときから、ONの状態(チェックあり・クラスあり)。保存の値が「1」以外なら、OFFのまま', () => {
    window.localStorage.setItem(KEY, '1');
    mount(reply({ threads: [] }));
    expect(toggle().checked).toBe(true);
    expect(stackedOn()).toBe(true);
    reset();
    window.localStorage.setItem(KEY, 'on');
    mount(reply({ threads: [] }));
    expect(toggle().checked).toBe(false);
    expect(stackedOn()).toBe(false);
  });
  it('ブラウザの保存が使えなくても(例外になっても)、ページは動き、スイッチはその場で効く。初期値はOFF', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => mount(reply({ threads: [] }))).not.toThrow();
    expect(toggle().checked).toBe(false);
    toggle().checked = true;
    expect(() => toggle().dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
    expect(stackedOn()).toBe(true);
  });
  it('スイッチはモーダルの外(ページ)にあり、🔑のモーダルを開いても消えない。検索すると隠れる一覧(スレッド)には含めない', async () => {
    mount(reply({ threads: [] }));
    expect(toggle().closest('[data-field="threads"]')).toBeNull();
    expect(toggle().closest('[role="dialog"]')).toBeNull();
  });
});

// 👤ボタン(2026-11-19、ユーザー指定): ログインユーザーのハンドルネームを設定する。一文字入力するごとに、登録済みのハンドルネームと照合し、
// 一致が無ければ登録ボタンが押せる。登録ボタンを押すと、登録が完了する。
describe('👤ハンドルネームの設定', () => {
  type Handler = { get?: () => Response | Promise<Response>; check?: (name: string) => Response | Promise<Response>; post?: (body: { name: string }) => Response | Promise<Response> };
  const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  /** 👤の通信(GET handle・GET handle/check・POST handle)をメソッドごとに答える。それ以外(スレッド一覧)は空で答える。 */
  const makeFetch = (h: Handler) => vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url.startsWith('/api/muse-search/handle/check')) return h.check!(decodeURIComponent(url.split('name=')[1] ?? ''));
    if (url === '/api/muse-search/handle' && method === 'GET') return h.get!();
    if (url === '/api/muse-search/handle' && method === 'POST') return h.post!(JSON.parse(String(init?.body)));
    if (url === '/api/muse-search/threads') return jsonRes({ threads: [] });
    throw new Error('想定外の通信: ' + method + ' ' + url);
  }) as unknown as typeof fetch;
  const statusText = (a: string) => ({ available: '使えます', taken: 'そのハンドルネームは、すでに使われています', same: '今のハンドルネームと同じです', empty: '名前を入力してください', too_long: '20文字までです', invalid_chars: '使えない文字(改行・タブなどの制御文字)が含まれています' } as Record<string, string>)[a];
  const base = (over: Handler = {}): Handler => ({
    get: () => jsonRes({ userName: 'nekoserver', handle: null }),
    check: () => jsonRes({ available: true, status: 'available' }),
    post: (body) => jsonRes({ handle: { userName: 'nekoserver', handleName: body.name, updatedAt: '2026-11-19T10:00:00.000Z' } }),
    ...over,
  });
  const handleButton = () => document.querySelector<HTMLButtonElement>('button[data-action="handle"]')!;
  const overlay = () => document.querySelector<HTMLElement>('[data-overlay="muse-handle"]');
  const input = () => overlay()!.querySelector<HTMLInputElement>('input[data-field="handle-input"]')!;
  const register = () => overlay()!.querySelector<HTMLButtonElement>('button[data-action="handle-register"]')!;
  const status = () => overlay()!.querySelector('[data-field="handle-status"]')!.textContent;
  const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  const type = async (value: string) => { input().value = value; input().dispatchEvent(new Event('input', { bubbles: true })); await flush(); };
  const callsTo = (fetchFn: typeof fetch, prefix: string) => (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).startsWith(prefix));
  const open = async (h: Handler = base()) => {
    const fetchFn = makeFetch(h);
    mount(fetchFn);
    await flush();
    handleButton().click();
    await flush();
    return fetchFn;
  };

  it('検索欄の🔑の右に👤がある(名前と説明を持つ)。ページを開いただけでは、モーダルは出ない', () => {
    mount(makeFetch(base()));
    expect(handleButton().textContent).toContain('👤');
    expect(handleButton().type).toBe('button');
    expect(handleButton().getAttribute('aria-label')).toBeTruthy();
    expect(document.querySelector('button[data-action="keys"]')!.nextElementSibling).toBe(handleButton());
    expect(overlay()).toBeNull();
  });
  it('押すと、最上位のモーダルが開き、ユーザー名(ログインユーザー)と、いまのハンドルネーム(無ければ「未設定」)を出す。入力欄にフォーカス。登録ボタンは押せない', async () => {
    const fetchFn = await open();
    const dialog = overlay()!.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(callsTo(fetchFn, '/api/muse-search/handle')[0][0]).toBe('/api/muse-search/handle');
    expect(dialog.querySelector('.muse-handle-user')!.textContent).toContain('nekoserver');
    expect(dialog.querySelector('.muse-handle-current')!.textContent).toContain('未設定');
    expect(document.activeElement).toBe(input());
    expect(register().disabled).toBe(true);
  });
  it('登録済みなら、そのハンドルネームを出す', async () => {
    await open(base({ get: () => jsonRes({ userName: 'nekoserver', handle: { handleName: 'ねこさん', userName: 'nekoserver', updatedAt: '2026-11-19T01:00:00.000Z' } }) }));
    expect(overlay()!.querySelector('.muse-handle-current')!.textContent).toContain('ねこさん');
  });
  it('一文字入力するごとに、登録済みのハンドルネームと照合する(入力のたびに1回。入力した文字をエンコードして送る)', async () => {
    const seen: string[] = [];
    const fetchFn = await open(base({ check: (name) => { seen.push(name); return jsonRes({ available: true, status: 'available' }); } }));
    await type('N');
    await type('Ne');
    await type('Nek');
    await type('Nek 猫');
    expect(seen).toEqual(['N', 'Ne', 'Nek', 'Nek 猫']);
    expect(callsTo(fetchFn, '/api/muse-search/handle/check').map((c) => c[0])).toEqual(['N', 'Ne', 'Nek', 'Nek 猫'].map((v) => '/api/muse-search/handle/check?name=' + encodeURIComponent(v)));
  });
  it('一致が無ければ(available)、「使えます」と出て、登録ボタンが押せる。一致すれば(taken・same)、理由を出して、押せない', async () => {
    const answers: Record<string, unknown> = { free: { available: true, status: 'available' }, used: { available: false, status: 'taken' }, mine: { available: false, status: 'same' } };
    await open(base({ check: (name) => jsonRes(answers[name]) }));
    await type('free');
    expect(status()).toBe('使えます');
    expect(register().disabled).toBe(false);
    await type('used');
    expect(status()).toBe(statusText('taken'));
    expect(register().disabled).toBe(true);
    await type('mine');
    expect(status()).toBe(statusText('same'));
    expect(register().disabled).toBe(true);
    await type('free');
    expect(register().disabled).toBe(false);
  });
  it('検査に通らない名前(too_long・invalid_chars)は、理由を出して、押せない。空にすると、照合せず、押せない', async () => {
    const fetchFn = await open(base({ check: (name) => jsonRes({ available: false, status: name === 'long' ? 'too_long' : 'invalid_chars' }) }));
    await type('long');
    expect(status()).toBe(statusText('too_long'));
    expect(register().disabled).toBe(true);
    await type('ctrl');
    expect(status()).toBe(statusText('invalid_chars'));
    const before = callsTo(fetchFn, '/api/muse-search/handle/check').length;
    await type('');
    expect(status()).toBe(statusText('empty'));
    expect(register().disabled).toBe(true);
    await type('   ');
    expect(register().disabled).toBe(true);
    expect(callsTo(fetchFn, '/api/muse-search/handle/check').length).toBe(before);
  });
  it('照合の応答を待つ間は、登録ボタンを押せない。遅れて届いた古い応答は、いまの入力の判定を上書きしない', async () => {
    let releaseOld!: (r: Response) => void;
    const old = new Promise<Response>((resolve) => { releaseOld = resolve; });
    await open(base({ check: (name) => (name === 'ab' ? old : jsonRes({ available: false, status: 'taken' })) }));
    input().value = 'ab';
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(register().disabled).toBe(true);
    expect(status()).toContain('照合');
    await type('abc');
    expect(status()).toBe(statusText('taken'));
    releaseOld(jsonRes({ available: true, status: 'available' }));
    await flush();
    expect(status()).toBe(statusText('taken'));
    expect(register().disabled).toBe(true);
  });
  it('登録ボタンを押すと、入力した名前をJSONでPOSTして、登録が完了する(完了の表示。いまのハンドルネームが更新される。ボタンは押せなくなる)', async () => {
    const fetchFn = await open();
    await type('ねこさん');
    register().click();
    await flush();
    const [url, init] = callsTo(fetchFn, '/api/muse-search/handle').find((c) => (c[1] as RequestInit | undefined)?.method === 'POST')! as [string, RequestInit];
    expect(url).toBe('/api/muse-search/handle');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ name: 'ねこさん' });
    expect(status()).toContain('登録しました');
    expect(overlay()!.querySelector('.muse-handle-current')!.textContent).toContain('ねこさん');
    expect(register().disabled).toBe(true);
  });
  it('登録中は、ボタンを押し直しても、二重に送らない', async () => {
    let release!: (r: Response) => void;
    const slow = new Promise<Response>((resolve) => { release = resolve; });
    const fetchFn = await open(base({ post: () => slow }));
    await type('ねこ');
    register().click();
    register().click();
    expect(callsTo(fetchFn, '/api/muse-search/handle').filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toHaveLength(1);
    expect(register().disabled).toBe(true);
    release(jsonRes({ handle: { userName: 'nekoserver', handleName: 'ねこ', updatedAt: 't' } }));
    await flush();
    expect(status()).toContain('登録しました');
  });
  it('登録のとき、他のユーザーが先に取っていた(409)なら、理由を出して、押せない。サーバーの失敗(503)・通信の失敗は、理由を出して、押し直せる(登録した扱いにしない)', async () => {
    await open(base({ post: () => jsonRes({ status: 'taken', error: 'そのハンドルネームは、すでに使われています' }, 409) }));
    await type('ねこ');
    register().click();
    await flush();
    expect(status()).toBe('そのハンドルネームは、すでに使われています');
    expect(register().disabled).toBe(true);
    expect(overlay()!.querySelector('.muse-handle-current')!.textContent).toContain('未設定');
    document.body.innerHTML = '';
    await open(base({ post: () => jsonRes({ error: 'x', detail: 'd1 down' }, 503) }));
    await type('ねこ');
    register().click();
    await flush();
    expect(status()).toMatch(/503.*d1 down/);
    expect(register().disabled).toBe(false);
    expect(overlay()!.querySelector('.muse-handle-current')!.textContent).toContain('未設定');
    document.body.innerHTML = '';
    await open(base({ post: () => { throw new Error('network down'); } }));
    await type('ねこ');
    register().click();
    await flush();
    expect(status()).toContain('network down');
    expect(register().disabled).toBe(false);
  });
  it('ユーザー名・ハンドルネームの読み込みに失敗したときは、理由を出し、入力欄と登録ボタンを使えなくする(「未設定」に見せない)。照合の失敗は、「使えます」にせず、理由を出して、押せない', async () => {
    await open(base({ get: () => jsonRes({ error: 'x', detail: 'd1 down' }, 503) }));
    expect(status()).toMatch(/503.*d1 down/);
    expect(input().disabled).toBe(true);
    expect(register().disabled).toBe(true);
    expect(overlay()!.querySelector('.muse-handle-current')!.textContent).not.toContain('未設定');
    document.body.innerHTML = '';
    await open(base({ check: () => jsonRes({ available: false, error: 'x', detail: 'd1 down' }, 503) }));
    await type('ねこ');
    expect(status()).toMatch(/503.*d1 down/);
    expect(register().disabled).toBe(true);
  });
  it('✕・Esc・外側のクリックで閉じ、👤へフォーカスが戻る。開いている間に👤を押し直しても重ねない。閉じたあとの遅れた応答は、画面を出さない', async () => {
    let release!: (r: Response) => void;
    const slow = new Promise<Response>((resolve) => { release = resolve; });
    await open(base({ get: () => slow }));
    handleButton().click();
    expect(document.querySelectorAll('[data-overlay="muse-handle"]')).toHaveLength(1);
    expect(overlay()!.textContent).toContain('読み込んでいます');
    press('Escape');
    expect(overlay()).toBeNull();
    expect(document.activeElement).toBe(handleButton());
    release(jsonRes({ userName: 'nekoserver', handle: null }));
    await flush();
    expect(overlay()).toBeNull();
    handleButton().click();
    await flush();
    overlay()!.querySelector<HTMLButtonElement>('button[data-action="close"]')!.click();
    expect(overlay()).toBeNull();
    handleButton().click();
    await flush();
    overlay()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay()).toBeNull();
  });
  it('Tabは、モーダルの外へ出ず、入力欄・登録ボタン・✕の間を行き来する(Shift+Tabは逆向き)', async () => {
    await open();
    await type('ねこ');
    const close = overlay()!.querySelector<HTMLButtonElement>('button[data-action="close"]')!;
    const tab = (shiftKey = false) => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(input());
    tab();
    expect(document.activeElement).toBe(register());
    tab();
    expect(document.activeElement).toBe(close);
    tab();
    expect(document.activeElement).toBe(input());
    tab(true);
    expect(document.activeElement).toBe(close);
  });
  it('重なり順は、いま画面にある固定位置の要素より上(getNextZ)', async () => {
    const html = getMuseSearchPage();
    const style = document.createElement('style');
    style.textContent = html.slice(html.indexOf('<style id="muse-search-style">') + 30, html.indexOf('</style>', html.indexOf('<style id="muse-search-style">')));
    document.head.appendChild(style);
    try {
      mount(makeFetch(base()));
      const other = document.createElement('div');
      other.style.cssText = 'position:fixed;inset:0;z-index:5000';
      document.body.appendChild(other);
      handleButton().click();
      await flush();
      expect(Number(overlay()!.style.zIndex)).toBe(5100);
    } finally { style.remove(); }
  });
  it('サーバーから来た文字列(ユーザー名・ハンドルネーム・理由)は、HTMLとして解釈せず、文字のまま出す', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    await open(base({ get: () => jsonRes({ userName: evil, handle: { handleName: evil, userName: evil, updatedAt: 't' } }), check: () => jsonRes({ available: false, status: 'taken' }) }));
    expect(overlay()!.querySelectorAll('img')).toHaveLength(0);
    expect(overlay()!.querySelector('.muse-handle-user')!.textContent).toContain(evil);
    expect(overlay()!.querySelector('.muse-handle-current')!.textContent).toContain(evil);
  });
  it('ページが fetch に渡す関数は、メソッド・本文を渡せる(POSTできる)。CSS: 固定位置・固定色なし', () => {
    const html = getMuseSearchPage();
    expect(html).toMatch(/initMuseSearchPage\(document, function \(url, init\)/);
    const start = html.indexOf('<style id="muse-search-style">');
    const style = html.slice(start, html.indexOf('</style>', start));
    expect(style).toMatch(/\.muse-handle-overlay \{ position: fixed; inset: 0;/);
    expect(style).toMatch(/\.muse-handle-input \{[^}]*var\(--/);
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// 水平タブ(2026-11-19、ユーザー指定): 「質問と回答の両方を探します…」の行の先頭(すぐ上)に、「スレッド一覧」「検索結果」のタブ。
// 読み込み時は「スレッド一覧」が選ばれ、検索の結果を出すときは「検索結果」へ移る。タブを切り替えると、内容が切り替わる。
// 「スレッド一覧」が選ばれるたびに、一覧を取り直す。
describe('水平タブ(スレッド一覧・検索結果)', () => {
  const thread = (over: Record<string, unknown> = {}) => ({ threadId: 't1', title: 'スレッド1', lastPostAt: 1763535000, ...over });
  const router = (routes: Record<string, () => Promise<Response> | Response>) => vi.fn(async (url: string) => {
    const handler = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))?.[1];
    if (!handler) throw new Error('想定外のURL: ' + url);
    return handler();
  }) as unknown as typeof fetch;
  const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const baseRoutes = (extra: Record<string, () => Promise<Response> | Response> = {}) => ({ '/api/muse-search?': json({ count: 1, posts: [{ postId: 'a:user', chatId: 'c-00001', role: 'user', createdAt: 100, threadMark: false, snippet: { before: '前', match: '静的', after: '後' } }] }), '/api/muse-search/threads': json({ threads: [thread()] }), ...extra });
  const tab = (name: 'threads' | 'results') => document.querySelector<HTMLButtonElement>(`[role="tab"][data-tab="${name}"]`)!;
  const panel = (name: 'threads' | 'results') => document.querySelector<HTMLElement>(`[role="tabpanel"][data-panel="${name}"]`)!;
  const threadCalls = (fetchFn: typeof fetch) => (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[0] === '/api/muse-search/threads').length;
  const selected = () => (['threads', 'results'] as const).filter((n) => tab(n).getAttribute('aria-selected') === 'true');
  const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

  it('「質問と回答の両方を探します…」の行の先頭(すぐ上)に、水平のタブ(スレッド一覧・検索結果)がある', async () => {
    mount(router(baseRoutes()));
    await flush();
    const tablist = document.querySelector<HTMLElement>('[role="tablist"]')!;
    expect(tablist).not.toBeNull();
    expect([...tablist.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['スレッド一覧', '検索結果']);
    const note = document.querySelector('.muse-search-note')!;
    expect(tablist.nextElementSibling).toBe(note);
    expect(tablist.getAttribute('aria-label')).toBeTruthy();
  });
  it('読み込み時は、「スレッド一覧」が選ばれている(選択・内容の表示・矢印キーの移動先が、そのタブ)。「検索結果」の内容は隠れている。タブと内容は、結びついている', async () => {
    mount(router(baseRoutes()));
    await flush();
    expect(selected()).toEqual(['threads']);
    expect(tab('threads').tabIndex).toBe(0);
    expect(tab('results').tabIndex).toBe(-1);
    expect(panel('threads').hidden).toBe(false);
    expect(panel('results').hidden).toBe(true);
    for (const n of ['threads', 'results'] as const) {
      expect(tab(n).getAttribute('aria-controls')).toBe(panel(n).id);
      expect(panel(n).getAttribute('aria-labelledby')).toBe(tab(n).id);
    }
  });
  it('検索すると、「検索結果」へ選択が移り、検索の結果が見える。「スレッド一覧」は隠れる(検索を始めた時点で移る)', async () => {
    let release!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    const page = mount(router(baseRoutes({ '/api/muse-search?': () => pending })));
    await flush();
    page.submit('静的');
    expect(selected()).toEqual(['results']);
    expect(panel('threads').hidden).toBe(true);
    expect(panel('results').hidden).toBe(false);
    expect(page.status()).toContain('検索しています');
    release(new Response(JSON.stringify({ count: 1, posts: [{ postId: 'a:user', chatId: 'c-00001', role: 'user', createdAt: 100, threadMark: false, snippet: { before: '前', match: '静的', after: '後' } }] }), { status: 200 }));
    await flush();
    expect(page.items()).toHaveLength(1);
    expect(tab('results').tabIndex).toBe(0);
    expect(tab('threads').tabIndex).toBe(-1);
  });
  it('検索に失敗したときも、エラーの表示がある「検索結果」へ移る', async () => {
    const page = mount(router(baseRoutes({ '/api/muse-search?': json({ detail: 'upstream 401' }, 502) })));
    await flush();
    page.submit('静的');
    await flush();
    expect(selected()).toEqual(['results']);
    expect(page.status()).toMatch(/502.*upstream 401/);
  });
  it('タブを押すと、内容が切り替わる。「検索結果」は、前の検索の結果をそのまま見せる(取り直さない)', async () => {
    const fetchFn = router(baseRoutes());
    const page = mount(fetchFn);
    await flush();
    page.submit('静的');
    await flush();
    tab('threads').click();
    await flush();
    expect(selected()).toEqual(['threads']);
    expect(panel('threads').hidden).toBe(false);
    expect(panel('results').hidden).toBe(true);
    tab('results').click();
    expect(selected()).toEqual(['results']);
    expect(panel('results').hidden).toBe(false);
    expect(page.items()).toHaveLength(1);
    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).startsWith('/api/muse-search?'))).toHaveLength(1);
  });
  it('「スレッド一覧」が選ばれるたびに、一覧を取り直す(読み込み時の1回 + 選び直すたび)。「検索結果」を選んでも取り直さない', async () => {
    const fetchFn = router(baseRoutes());
    mount(fetchFn);
    await flush();
    expect(threadCalls(fetchFn)).toBe(1);
    tab('results').click();
    expect(threadCalls(fetchFn)).toBe(1);
    tab('threads').click();
    await flush();
    expect(threadCalls(fetchFn)).toBe(2);
    tab('results').click();
    tab('threads').click();
    await flush();
    expect(threadCalls(fetchFn)).toBe(3);
  });
  it('取り直すと、一覧は作り直される(絞り込みの入力や、開いていたスレッドは、元に戻る)。最新の一覧が出る', async () => {
    let titles = ['古いタイトル'];
    mount(router(baseRoutes({ '/api/muse-search/threads': () => new Response(JSON.stringify({ threads: titles.map((t, i) => thread({ threadId: 't' + i, title: t })) })), '/api/muse-search/thread?': json({ threadId: 't0', chatId: 'c', role: 'assistant', createdAt: 1, truncated: false, paragraphs: [[{ text: '本文', hit: false }]] }) })));
    await flush();
    document.querySelector<HTMLAnchorElement>('a[data-thread-id]')!.click();
    await flush();
    expect(document.querySelectorAll('.muse-thread-last')).toHaveLength(1);
    titles = ['新しいタイトル', '古いタイトル'];
    tab('results').click();
    tab('threads').click();
    await flush();
    expect([...document.querySelectorAll('a[data-thread-id]')].map((a) => a.textContent)).toEqual(['新しいタイトル', '古いタイトル']);
    expect(document.querySelectorAll('.muse-thread-last')).toHaveLength(0);
  });
  it('取り直しの応答が前後しても、いちばん新しい取り直しの結果だけを出す(古い応答は、画面を上書きしない)', async () => {
    let call = 0;
    let releaseOld!: (r: Response) => void;
    const old = new Promise<Response>((resolve) => { releaseOld = resolve; });
    mount(router(baseRoutes({ '/api/muse-search/threads': () => (++call === 2 ? old : new Response(JSON.stringify({ threads: [thread({ title: call === 1 ? '1回目' : '3回目' })] }))) })));
    await flush();
    tab('results').click();
    tab('threads').click();
    tab('results').click();
    tab('threads').click();
    await flush();
    expect([...document.querySelectorAll('a[data-thread-id]')].map((a) => a.textContent)).toEqual(['3回目']);
    releaseOld(new Response(JSON.stringify({ threads: [thread({ title: '2回目(古い応答)' })] })));
    await flush();
    expect([...document.querySelectorAll('a[data-thread-id]')].map((a) => a.textContent)).toEqual(['3回目']);
  });
  it('キーボード: → ← でタブを移り(その場で選ぶ)、Home・End で先頭・末尾へ。「スレッド一覧」へ移るたびに取り直す。フォーカスも、そのタブへ移る', async () => {
    const fetchFn = router(baseRoutes());
    mount(fetchFn);
    await flush();
    tab('threads').focus();
    key(tab('threads'), 'ArrowRight');
    expect(selected()).toEqual(['results']);
    expect(document.activeElement).toBe(tab('results'));
    key(tab('results'), 'ArrowRight');
    expect(selected()).toEqual(['threads']);
    await flush();
    expect(threadCalls(fetchFn)).toBe(2);
    key(tab('threads'), 'ArrowLeft');
    expect(selected()).toEqual(['results']);
    key(tab('results'), 'Home');
    expect(selected()).toEqual(['threads']);
    await flush();
    expect(threadCalls(fetchFn)).toBe(3);
    key(tab('threads'), 'End');
    expect(selected()).toEqual(['results']);
    expect(document.activeElement).toBe(tab('results'));
  });
  it('「検索結果」のタブが選ばれている間、上の検索窓(会話の検索)・🔑・👤・縦並びの設定は、そのまま使える(タブの外にある)', async () => {
    mount(router(baseRoutes()));
    await flush();
    for (const selector of ['form[role="search"]', 'button[data-action="keys"]', 'button[data-action="handle"]', 'input[data-setting="stacked"]']) {
      expect(document.querySelector(selector)!.closest('[role="tabpanel"]')).toBeNull();
    }
  });
  it('CSS: タブは、固定色を使わず変数を使う。選ばれているタブは見分けられる', () => {
    const html = getMuseSearchPage();
    const start = html.indexOf('<style id="muse-search-style">');
    const style = html.slice(start, html.indexOf('</style>', start));
    expect(style).toMatch(/\.muse-tabs \{[^}]*display: flex/);
    expect(style).toMatch(/\.muse-tab\[aria-selected="true"\] \{[^}]*var\(--/);
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

// スレッド検索(スレッド一覧のタイトルの絞り込み)の記録(2026-11-20、ユーザー指定): 検索したキー・ヒット件数・スレッドIDを POST /api/muse-search/thread-search へ送る。
// 入力のたびには送らない(入力が止まって 800ms 後、または Enter ですぐ)。空の検索は記録しない。件数はサーバーがスレッドIDから数えるので、送るのはキーとスレッドIDだけ。
describe('スレッド検索の記録', () => {
  const thread = (id: string, title: string) => ({ threadId: id, title, lastPostAt: 100 });
  const threeThreads = { threads: [thread('t1', 'Workers の静的アセット'), thread('t2', 'Tailscale DERP の調査'), thread('t3', 'ワーカーのデプロイ')] };
  const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const section = () => document.querySelector<HTMLElement>('[data-field="threads"]')!;
  const filter = () => section().querySelector<HTMLInputElement>('input[data-field="thread-filter"]')!;
  const type = (value: string) => { filter().value = value; filter().dispatchEvent(new Event('input', { bubbles: true })); };
  const note = () => section().querySelector<HTMLElement>('.muse-thread-search-log-error');
  const logs = (fetchFn: typeof fetch) => (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls
    .filter((c) => (c[0] as string) === '/api/muse-search/thread-search')
    .map((c) => ({ init: c[1] as RequestInit, body: JSON.parse((c[1] as RequestInit).body as string) }));
  const open = async (record: () => Promise<Response> | Response = json({ recorded: true, hitCount: 0 })) => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url === '/api/muse-search/threads') return json(threeThreads)();
      if (url === '/api/muse-search/thread-search') return record();
      throw new Error('想定外のURL: ' + url);
    }) as unknown as typeof fetch;
    mount(fetchFn);
    await flush();
    vi.useFakeTimers();
    return fetchFn;
  };
  afterEach(() => { vi.useRealTimers(); });

  it('入力が止まって 800ms 後に、キー(前後の空白を除く)と、表示中のスレッドのIDだけを、JSONでPOSTする。件数は送らない', async () => {
    const fetchFn = await open();
    type('  ワーカー ');
    await vi.advanceTimersByTimeAsync(799);
    expect(logs(fetchFn)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(logs(fetchFn)).toHaveLength(1);
    expect(logs(fetchFn)[0].init.method).toBe('POST');
    expect((logs(fetchFn)[0].init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(logs(fetchFn)[0].body).toEqual({ key: 'ワーカー', threadIds: ['t3'] });
  });
  it('入力が続く間は送らない(タイマーを延ばす)。最後の入力のキーだけを送る', async () => {
    const fetchFn = await open();
    type('t');
    await vi.advanceTimersByTimeAsync(500);
    type('ta');
    await vi.advanceTimersByTimeAsync(500);
    expect(logs(fetchFn)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(300);
    expect(logs(fetchFn).map((l) => l.body)).toEqual([{ key: 'ta', threadIds: ['t2'] }]);
  });
  it('ヒットが0件でも記録する(スレッドIDは空の配列)', async () => {
    const fetchFn = await open();
    type('存在しない語');
    await vi.advanceTimersByTimeAsync(800);
    expect(logs(fetchFn).map((l) => l.body)).toEqual([{ key: '存在しない語', threadIds: [] }]);
  });
  it('Enterを押すと、待たずにすぐ送る。そのあとのタイマーでは、重ねて送らない', async () => {
    const fetchFn = await open();
    type('tailscale');
    filter().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);
    expect(logs(fetchFn)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(logs(fetchFn)).toHaveLength(1);
  });
  it('空の検索(消した・空白だけ)は記録しない。待っている送信も取りやめる', async () => {
    const fetchFn = await open();
    type('ワーカー');
    type('   ');
    await vi.advanceTimersByTimeAsync(2000);
    expect(logs(fetchFn)).toHaveLength(0);
  });
  it('直前に記録したのと同じキーは、続けて記録しない(別のキーを挟めば、また記録する)', async () => {
    const fetchFn = await open();
    type('ta');
    await vi.advanceTimersByTimeAsync(800);
    type('ta ');
    await vi.advanceTimersByTimeAsync(800);
    expect(logs(fetchFn)).toHaveLength(1);
    type('wo');
    await vi.advanceTimersByTimeAsync(800);
    type('ta');
    await vi.advanceTimersByTimeAsync(800);
    expect(logs(fetchFn).map((l) => l.body.key)).toEqual(['ta', 'wo', 'ta']);
  });
  it('記録に失敗したら(503・通信の失敗)、絞り込みはそのまま、記録できなかったことと理由を出す。成功したら注記を消す', async () => {
    let fail = true;
    const fetchFn = await open(() => (fail ? json({ recorded: false, errorCode: 'db_error', detail: 'd1 down' }, 503)() : json({ recorded: true, hitCount: 1 })()));
    type('ta');
    await vi.advanceTimersByTimeAsync(800);
    expect(note()!.textContent).toContain('スレッド検索を記録できませんでした');
    expect(note()!.textContent).toContain('d1 down');
    expect(note()!.hidden).toBe(false);
    expect([...section().querySelectorAll<HTMLElement>('li.muse-thread-item')].filter((li) => !li.hidden)).toHaveLength(1);
    fail = false;
    type('wo');
    await vi.advanceTimersByTimeAsync(800);
    expect(note()!.hidden).toBe(true);
    expect(note()!.textContent).toBe('');
    expect(logs(fetchFn)).toHaveLength(2);
  });
  it('通信そのものが失敗しても、理由つきの注記を出す(握りつぶさない)', async () => {
    await open(() => { throw new Error('network down'); });
    type('ta');
    await vi.advanceTimersByTimeAsync(800);
    expect(note()!.textContent).toContain('network down');
  });
});

// 🔑モーダルの行の左スワイプ削除(2026-11-20、ユーザー指定): AIチャットの左サイドパネルと同じ、左スワイプで削除エリアが出て、タップするとそのキーを削除し、画面からも消える。
// 削除は DELETE /api/muse-search/key?key=。成功(deleted: true)を確かめてから消す。失敗は、行を残して理由を出す。
describe('🔑モーダルの左スワイプ削除', () => {
  const key = (name: string, over: Record<string, unknown> = {}) => ({ searchKey: name, aiChatCount: 7, treeViewCount: 3, searchCount: 2, firstSearchedAt: '2026-11-19T01:00:00.000Z', lastSearchedAt: '2026-11-19T03:00:00.000Z', ...over });
  const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const rows = () => [...document.querySelectorAll<HTMLElement>('[role="dialog"] tbody tr')];
  const names = () => rows().map((tr) => tr.querySelector('td')!.textContent);
  const area = () => document.querySelector<HTMLButtonElement>('button[data-action="delete-key"]')!;
  const note = () => document.querySelector<HTMLElement>('.muse-keys-delete-error');
  const touch = (target: Element, type: string, x: number, y = 0) => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, type === 'touchend' ? { changedTouches: [{ clientX: x, clientY: y }] } : { touches: [{ clientX: x, clientY: y }] });
    target.dispatchEvent(event);
  };
  const swipe = (target: Element, from: number, to: number, dy = 0) => { touch(target, 'touchstart', from, 0); touch(target, 'touchmove', to, dy); touch(target, 'touchend', to, dy); };
  const open = async (keys: string[], del: () => Promise<Response> | Response = json({ deleted: true, keyRows: 1, answerRows: 0 })) => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/muse-search/keys') return json({ keys: keys.map((k) => key(k)) })();
      if (url.startsWith('/api/muse-search/key?') && init?.method === 'DELETE') return del();
      throw new Error('想定外のURL: ' + url);
    }) as unknown as typeof fetch;
    mount(fetchFn);
    document.querySelector<HTMLButtonElement>('button[data-action="keys"]')!.click();
    await flush();
    return fetchFn;
  };
  const deletes = (fetchFn: typeof fetch) => (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'DELETE').map((c) => c[0] as string);

  it('左に50px以上スワイプすると、その行の削除エリアが出る(行は左へ動く)。初期は出ていない', async () => {
    await open(['alpha', 'beta']);
    expect(area().hidden).toBe(true);
    swipe(rows()[0], 200, 120);
    expect(rows()[0].classList.contains('swipe-open')).toBe(true);
    expect(rows()[0].style.getPropertyValue('--swipe-x')).toBe('-72px');
    expect(area().hidden).toBe(false);
    expect(area().textContent).toBe('削除');
    expect(area().getAttribute('aria-label')).toContain('alpha');
  });
  it('50px未満の動き・縦の動きが大きいとき(スクロール)・右向きは、開かない', async () => {
    await open(['alpha']);
    swipe(rows()[0], 200, 170);
    expect(rows()[0].classList.contains('swipe-open')).toBe(false);
    swipe(rows()[0], 200, 120, 200);
    expect(rows()[0].classList.contains('swipe-open')).toBe(false);
    swipe(rows()[0], 100, 220);
    expect(rows()[0].classList.contains('swipe-open')).toBe(false);
    expect(area().hidden).toBe(true);
  });
  it('開いた行を右へスワイプする・行をタップすると閉じる(削除エリアも隠れる)', async () => {
    await open(['alpha']);
    swipe(rows()[0], 200, 120);
    swipe(rows()[0], 100, 200);
    expect(rows()[0].classList.contains('swipe-open')).toBe(false);
    expect(area().hidden).toBe(true);
    swipe(rows()[0], 200, 120);
    rows()[0].click();
    expect(rows()[0].classList.contains('swipe-open')).toBe(false);
  });
  it('別の行を開くと、先に開いていた行は閉じる(開くのは1行だけ)。削除エリアは、いま開いている行のキーを指す', async () => {
    const fetchFn = await open(['alpha', 'beta']);
    swipe(rows()[0], 200, 120);
    swipe(rows()[1], 200, 120);
    expect(rows().map((tr) => tr.classList.contains('swipe-open'))).toEqual([false, true]);
    expect(area().getAttribute('aria-label')).toContain('beta');
    area().click();
    await flush();
    expect(deletes(fetchFn)).toEqual(['/api/muse-search/key?key=beta']);
  });
  it('削除エリアをタップすると、そのキーをDELETEで削除し、成功を確かめてから、画面の行を消す。ほかの行は残り、一覧は取り直さない', async () => {
    const fetchFn = await open(['alpha', 'beta', 'gamma']);
    swipe(rows()[1], 200, 120);
    area().click();
    await flush();
    expect(deletes(fetchFn)).toEqual(['/api/muse-search/key?key=beta']);
    expect(names()).toEqual(['alpha', 'gamma']);
    expect(area().hidden).toBe(true);
    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[0] === '/api/muse-search/keys')).toHaveLength(1);
  });
  it('削除したキーは、並べ替えで表を作り直しても戻らない。キーの文字はURLエンコードして送る', async () => {
    const fetchFn = await open(['a b&c', 'zeta']);
    swipe(rows()[0], 200, 120);
    area().click();
    await flush();
    expect(deletes(fetchFn)).toEqual(['/api/muse-search/key?key=' + encodeURIComponent('a b&c')]);
    document.querySelector<HTMLButtonElement>('button[data-sort-key="searchKey"]')!.click();
    expect(names()).toEqual(['zeta']);
  });
  it('最後の1件を削除すると、「まだ検索キーが記録されていません。」を出す', async () => {
    await open(['alpha']);
    swipe(rows()[0], 200, 120);
    area().click();
    await flush();
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('まだ検索キーが記録されていません。');
    expect(rows()).toHaveLength(0);
  });
  it('削除に失敗したら(503・通信の失敗・deleted が true でない200)、行は残し、理由を出す。成功の表示にしない。削除エリアは開いたまま、押し直せる', async () => {
    const fetchFn = await open(['alpha'], json({ deleted: false, errorCode: 'db_error', detail: 'd1 down' }, 503));
    swipe(rows()[0], 200, 120);
    area().click();
    await flush();
    expect(names()).toEqual(['alpha']);
    expect(note()!.textContent).toMatch(/503.*d1 down/);
    expect(area().hidden).toBe(false);
    expect(area().disabled).toBe(false);
    expect(deletes(fetchFn)).toHaveLength(1);
    document.body.innerHTML = '';
    await open(['alpha'], () => { throw new Error('network down'); });
    swipe(rows()[0], 200, 120);
    area().click();
    await flush();
    expect(names()).toEqual(['alpha']);
    expect(note()!.textContent).toContain('network down');
    document.body.innerHTML = '';
    await open(['alpha'], json({ ok: true }));
    swipe(rows()[0], 200, 120);
    area().click();
    await flush();
    expect(names()).toEqual(['alpha']);
    expect(note()!.textContent).toContain('削除できませんでした');
  });
  it('送信中は削除エリアを無効にし、続けて押しても1回しか送らない。成功したら、前の失敗の注記を消す', async () => {
    let release!: (res: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    const fetchFn = await open(['alpha', 'beta'], () => pending);
    swipe(rows()[0], 200, 120);
    area().click();
    expect(area().disabled).toBe(true);
    area().click();
    release(new Response(JSON.stringify({ deleted: true, keyRows: 1, answerRows: 0 }), { status: 200 }));
    await flush();
    expect(deletes(fetchFn)).toHaveLength(1);
    expect(names()).toEqual(['beta']);
    expect(note()).toBeNull();
  });
  it('マウスのドラッグ(PC)でも、左へ50px以上動かすと開く', async () => {
    await open(['alpha']);
    rows()[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 200 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 120 }));
    expect(rows()[0].classList.contains('swipe-open')).toBe(true);
    expect(area().hidden).toBe(false);
  });
  it('並べ替え・🗒️への切り替えのあとは、開いた行を閉じる(削除エリアが残らない)', async () => {
    await open(['alpha', 'beta']);
    swipe(rows()[0], 200, 120);
    document.querySelector<HTMLButtonElement>('button[data-sort-key="searchKey"]')!.click();
    expect(area().hidden).toBe(true);
    expect(rows().some((tr) => tr.classList.contains('swipe-open'))).toBe(false);
  });
  it('CSS: 削除エリアは危険色の変数(固定色なし)・開いた行は左へ動く・行の動きは変数 --swipe-x', () => {
    const html = getMuseSearchPage();
    const start = html.indexOf('<style id="muse-search-style">');
    const style = html.slice(start, html.indexOf('</style>', start));
    expect(style).toMatch(/\.muse-keys-delete-area \{[^}]*position: fixed[^}]*background: var\(--danger-color\)/);
    expect(style).toMatch(/\.muse-keys-table tbody td \{[^}]*transform: translateX\(var\(--swipe-x, 0px\)\)/);
    // 実機で見つかった不具合: 開いた行のキー名の列まで左へ押し出されて、どのキーを削除するのか見えなかった。開いた行・ドラッグ中の行では、キー名の列を左端に留め、ほかのセルがその下へ滑る。
    expect(style).toMatch(/\.muse-keys-table tbody tr\.swipe-open td:first-child, \.muse-keys-table tbody tr\.swiping td:first-child \{[^}]*position: sticky; left: 0; z-index: 1; transform: none/);
    // 実機で見つかった不具合: 幅の広い表では、横スワイプが表の横スクロールに奪われ、開いた直後に閉じた。行のセルは縦スクロールだけをブラウザに任せる(touch-action は table-row には効かないので、td に付ける)。
    expect(style).toMatch(/\.muse-keys-table tbody td \{[^}]*touch-action: pan-y/);
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
