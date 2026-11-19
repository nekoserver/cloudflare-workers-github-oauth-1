// @vitest-environment jsdom
// /muse-search のページ(2026-11-19)。上流から来た文字列は textContent でしか表示しない(innerHTML を使わない)。
import { describe, expect, it, vi } from 'vitest';
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
  it('CSS: 狭い幅(560px以下)では、表を縦並び(項目名: 値)にして、横にはみ出させない。固定色は使わない', () => {
    const html = getMuseSearchPage();
    const start = html.indexOf('<style id="muse-search-style">');
    const style = html.slice(start, html.indexOf('</style>', start));
    const media = style.slice(style.indexOf('@media (max-width: 560px)'));
    expect(style).toContain('@media (max-width: 560px)');
    expect(media).toMatch(/\.muse-keys-list tr, \.muse-keys-list td \{ display: block;/);
    expect(media).toMatch(/\.muse-keys-list td\[data-label\]::before \{[^}]*content: attr\(data-label\)/);
    expect(media).toMatch(/\.muse-keys-list thead tr \{[^}]*display: flex; flex-wrap: wrap/);
    expect(media).not.toMatch(/\.muse-keys-list thead \{[^}]*position: absolute/);
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it('押すと /api/muse-search/keys を読み、モーダルに、AIチャットでの出現回数の順(APIの順)に並べて出す', async () => {
    const fetchFn = router({ '/api/muse-search/keys': json({ keys: [key({ searchKey: 'alpha', aiChatCount: 30, treeViewCount: 4, searchCount: 5 }), key({ searchKey: 'beta', aiChatCount: 2, treeViewCount: 90, searchCount: 1 })] }) });
    mount(fetchFn);
    keysButton().click();
    await flush();
    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('/api/muse-search/keys');
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
      const items = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button')].map((el) => el.getAttribute('data-sort-key') ?? el.getAttribute('data-action'));
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
    const items = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button, [role="dialog"] a[href]')];
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
    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual(['/api/muse-search/keys']);
  });
  it('押すと、最上位のレイヤーに、チャットもスレッドも問わず、回答を日付の新しい順に1つの表で出す。同時刻は回答ID順。検索キーのモーダルは下に残る', async () => {
    const fetchFn = router(routes());
    await open(fetchFn);
    recentButton().click();
    await flush();
    expect((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual(['/api/muse-search/keys', '/api/muse-search/answers']);
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
