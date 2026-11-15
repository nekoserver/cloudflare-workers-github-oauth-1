import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getCfContainersPage } from './cfContainers';
import { APACHE_MANUAL_BASE } from '../data/apacheManual';

// /cf-containers のApacheモジュール一覧(ユーザー指定 2026-11-15):
// - グレーアウト(🔐でない行)でも、緑色の表記(有効・導入済み)は薄くしない
// - グレーアウト中の行のモジュール名は、通常の文字色(ダークテーマでは白)で表示する
// - モジュール名をタップすると、最上位のモーダルにそのモジュールの説明と設定項目(ディレクティブ)を出す
// - 導入済みで有効なら、モーダルの中で緑色の「有効」を出す
// - 静的アセットに説明があればリンクを出し、押すとヘルプを最上位のiframeで表示する
//
// 故障シナリオ:
//   (1) 行全体のopacityで緑の表記まで薄くなる
//   (2) モジュール名がタップできない、またはモーダルが既存の要素の裏に出る
//   (3) 無効・未導入なのに緑の「有効」を出す
//   (4) 説明の無いモジュールでリンク切れのヘルプを出す
//   (5) 説明の読み込みに失敗するとモーダルが開かない
//   (6) iframeが分離されず、ヘルプのscriptがページと同じ権限で動く

const DATA = {
  apacheVersion: '2.4.71',
  items: [
    { name: 'ssl', installed: true, enabled: true },
    { name: 'headers', installed: true, enabled: false },
    { name: 'mpm_event', installed: true, enabled: true },
    { name: 'custom_thing', installed: true, enabled: true },
  ],
};

const INDEX = {
  apacheVersion: '2.4.71',
  modules: {
    ssl: {
      title: 'Apache Module mod_ssl', file: 'mod/mod_ssl.html', description: 'Strong cryptography using SSL', status: 'Extension',
      identifier: 'ssl_module', sourceFile: 'mod_ssl.c', compatibility: '',
      directives: [{ name: 'SSLEngine', anchor: 'sslengine', description: 'SSL Engine Operation Switch', syntax: 'SSLEngine on|off|optional', default: 'SSLEngine off', context: 'server config, virtual host' }],
    },
    headers: {
      title: 'Apache Module mod_headers', file: 'mod/mod_headers.html', description: 'Customization of HTTP request and response headers', status: 'Extension',
      identifier: 'headers_module', sourceFile: 'mod_headers.c', compatibility: '', directives: [],
    },
    mpm_event: {
      title: 'Apache MPM event', file: 'mod/event.html', description: 'A variant of the worker MPM', status: 'MPM',
      identifier: 'mpm_event_module', sourceFile: 'event.c', compatibility: '', directives: [],
    },
  },
};

function markupOf(html: string) {
  return html.match(/<table class="health-table" id="apache-modules-table"[\s\S]*?<!-- \/apache-module-modals -->/)?.[0];
}

async function setup(fetchImpl?: (url: string) => Promise<unknown>, cookie?: string) {
  const html = getCfContainersPage();
  const markup = markupOf(html);
  const script = html.match(/<script id="apache-modules-panel">([\s\S]*?)<\/script>/)?.[1];
  expect(markup).toBeTruthy();
  expect(script).toBeTruthy();
  const dom = new JSDOM('<!doctype html><body><div id="other" style="position:fixed;z-index:5000"></div>' + markup + '</body>', { url: 'https://example.test/cf-containers', runScripts: 'outside-only' });
  if (cookie) dom.window.document.cookie = cookie;
  const requested: string[] = [];
  (dom.window as any).fetch = async (url: string) => {
    requested.push(url);
    if (fetchImpl) return fetchImpl(url);
    return { ok: true, status: 200, json: async () => INDEX };
  };
  dom.window.eval(script!);
  (dom.window as any).cfcApacheModules.render(DATA);
  const doc = dom.window.document;
  const row = (name: string) => doc.querySelector(`tr[data-module="${name}"]`) as HTMLTableRowElement;
  const open = async (name: string) => {
    (row(name).querySelector('.module-name') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  };
  const modal = () => doc.getElementById('apache-module-modal') as HTMLDivElement;
  const help = () => doc.getElementById('apache-help-modal') as HTMLDivElement;
  return { dom, doc, html, row, open, modal, help, requested };
}

describe('グレーアウト中の表示', () => {
  it('行全体を薄くせず、緑の表記は薄くしない。モジュール名は通常の文字色にする', () => {
    const html = getCfContainersPage();
    expect(html).not.toMatch(/\.module-unlocked\s*\{\s*opacity/);
    expect(html).toMatch(/\.module-unlocked td:not\(\.module-active\):not\(\.module-first\)\s*\{\s*opacity:\s*0\.45/);
    expect(html).toMatch(/\.module-unlocked \.module-name\.module-inactive\s*\{[^}]*color:\s*var\(--text\)/);
  });

  it('モジュール名の列は薄くしない(.module-firstを付ける)', async () => {
    const { row } = await setup();
    expect(row('headers').cells[0].classList.contains('module-first')).toBe(true);
  });
});

describe('リンクの下線(ユーザー指定 2026-11-15)', () => {
  it('ページ内のリンクとモジュール名に下線を付けない(マウスを乗せたときも)', () => {
    const html = getCfContainersPage();
    const css = html.match(/<style>([\s\S]*?)<\/style>/)![1];
    expect(css).not.toMatch(/text-decoration:\s*underline/);
    expect(css).toMatch(/(^|\n)a, a:hover, a:focus-visible \{ text-decoration: none; \}/);
    expect(css).toMatch(/button\.module-name \{[^}]*text-decoration: none/);
  });
});

describe('「有効状態」のタップで切り替える絞り込み(ユーザー指定 2026-11-15)', () => {
  // 見出しの「有効状態」をタップするたびに、Apache(本体)行の有効状態のセルが
  // 「有効◯件(すべて)」→「有効のみ」(🔐の無い無効な行=グレーの行を消す)→「鍵のみ」(🔐の行だけ)→ と巡り、
  // モジュール行を絞り込む。▶▼▲の開閉の結果に、さらにこの絞り込みをかける。
  async function opened(cookie?: string) {
    const ctx = await setup(undefined, cookie);
    (ctx.doc.getElementById('apache-modules-toggle') as HTMLButtonElement).click();
    return ctx;
  }
  const visible = (doc: Document) => [...doc.querySelectorAll<HTMLTableRowElement>('tr[data-module]')].filter((r) => !r.hidden).map((r) => r.getAttribute('data-module'));
  const filterButton = (doc: Document) => doc.getElementById('apache-modules-filter') as HTMLButtonElement;
  const filterCell = (doc: Document) => doc.getElementById('apache-modules-filter-cell')!;

  it('見出しは「有効状態」のままで、押せるボタンになっている', async () => {
    const { doc, html } = await opened();
    expect(html).not.toContain('ロード状態</th>');
    expect(filterButton(doc).tagName).toBe('BUTTON');
    expect(filterButton(doc).textContent).toBe('有効状態');
    expect(doc.querySelector('#apache-modules-table thead')!.contains(filterButton(doc))).toBe(true);
  });

  it('初期状態は「有効◯件(すべて)」で、全行を出す', async () => {
    const { doc } = await opened();
    expect(filterCell(doc).textContent).toBe('有効 3件(すべて)');
    expect(visible(doc)).toEqual(['ssl', 'headers', 'mpm_event', 'custom_thing']);
  });

  it('1回押すと「有効のみ」になり、🔐の無い無効な行を消す(🔐の行は無効でも残す)', async () => {
    const { doc } = await opened('cfc_apache_module_locks=custom_thing');
    filterButton(doc).click();
    expect(filterCell(doc).textContent).toBe('有効のみ');
    expect(visible(doc)).toEqual(['ssl', 'mpm_event', 'custom_thing']);
    const locked = await opened('cfc_apache_module_locks=headers');
    filterButton(locked.doc).click();
    expect(visible(locked.doc)).toEqual(['ssl', 'headers', 'mpm_event', 'custom_thing']);
  });

  it('2回押すと「鍵のみ」になり🔐の行だけを出し、3回目で「すべて」に戻る', async () => {
    const { doc } = await opened('cfc_apache_module_locks=headers');
    filterButton(doc).click();
    filterButton(doc).click();
    expect(filterCell(doc).textContent).toBe('鍵のみ');
    expect(visible(doc)).toEqual(['headers']);
    filterButton(doc).click();
    expect(filterCell(doc).textContent).toBe('有効 3件(すべて)');
    expect(visible(doc)).toEqual(['ssl', 'headers', 'mpm_event', 'custom_thing']);
  });

  it('▶で閉じているときは、絞り込みを変えても行を出さない', async () => {
    const { doc } = await setup(undefined, 'cfc_apache_module_locks=headers');
    filterButton(doc).click();
    expect(visible(doc)).toEqual([]);
  });

  it('一覧を描き直しても(ヘルスチェックの更新)、絞り込みの状態を保つ', async () => {
    const { doc, dom } = await opened('cfc_apache_module_locks=headers');
    filterButton(doc).click();
    filterButton(doc).click();
    (dom.window as any).cfcApacheModules.render(DATA);
    expect(filterCell(doc).textContent).toBe('鍵のみ');
  });
});

describe('モジュール名のタップで開くモーダル', () => {
  it('モジュール名はボタンで、押すと既存の要素より上にモーダルを開き、説明と設定項目を出す', async () => {
    const { row, open, modal, doc, requested } = await setup();
    expect(row('ssl').querySelector('.module-name')!.tagName).toBe('BUTTON');
    await open('ssl');
    expect(modal().hidden).toBe(false);
    expect(Number(modal().style.zIndex)).toBeGreaterThan(5000);
    expect(doc.getElementById('apache-module-title')!.textContent).toBe('mod_ssl');
    const body = doc.getElementById('apache-module-body')!;
    expect(body.textContent).toContain('Strong cryptography using SSL');
    expect(body.textContent).toContain('SSLEngine');
    expect(body.textContent).toContain('SSLEngine on|off|optional');
    expect(body.textContent).toContain('server config, virtual host');
    expect(requested).toEqual([APACHE_MANUAL_BASE + '/modules.json']);
  });

  it('導入済みで有効なら、モーダルの中で緑色の「有効」を出す', async () => {
    const { open, doc } = await setup();
    await open('ssl');
    const state = doc.getElementById('apache-module-state')!;
    expect(state.textContent).toBe('有効');
    expect(state.classList.contains('module-active')).toBe(true);
  });

  it('無効なら緑の「有効」を出さない', async () => {
    const { open, doc } = await setup();
    await open('headers');
    const state = doc.getElementById('apache-module-state')!;
    expect(state.textContent).toBe('無効');
    expect(state.classList.contains('module-active')).toBe(false);
  });

  it('説明があればヘルプへのリンクを出し、押すとヘルプのモーダルをさらに上に開いてiframeで表示する', async () => {
    const { open, doc, modal, help } = await setup();
    await open('mpm_event');
    const link = doc.querySelector('#apache-module-body a.apache-help-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(APACHE_MANUAL_BASE + '/mod/event.html');
    link.click();
    expect(help().hidden).toBe(false);
    expect(Number(help().style.zIndex)).toBeGreaterThan(Number(modal().style.zIndex));
    const frame = doc.getElementById('apache-help-frame') as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toBe(APACHE_MANUAL_BASE + '/mod/event.html');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-popups allow-popups-to-escape-sandbox');
  });

  it('説明が無いモジュールはリンクを出さず、無いことを書く', async () => {
    const { open, doc } = await setup();
    await open('custom_thing');
    expect(doc.querySelector('#apache-module-body a.apache-help-link')).toBeNull();
    expect(doc.getElementById('apache-module-body')!.textContent).toContain('静的アセットにこのモジュールの説明がありません');
    expect(doc.getElementById('apache-module-state')!.textContent).toBe('有効');
  });

  it('説明の読み込みに失敗してもモーダルは開き、状態と失敗の理由を出す', async () => {
    const { open, doc, modal } = await setup(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    await open('ssl');
    expect(modal().hidden).toBe(false);
    expect(doc.getElementById('apache-module-state')!.textContent).toBe('有効');
    expect(doc.getElementById('apache-module-body')!.textContent).toContain('説明を読み込めませんでした(HTTP 404)');
  });

  it('閉じるボタン・Escapeは上のモーダルから順に閉じ、ヘルプを閉じるとiframeを空にする', async () => {
    const { open, doc, modal, help, dom } = await setup();
    await open('ssl');
    (doc.querySelector('#apache-module-body a.apache-help-link') as HTMLAnchorElement).click();
    doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(help().hidden).toBe(true);
    expect(modal().hidden).toBe(false);
    expect((doc.getElementById('apache-help-frame') as HTMLIFrameElement).getAttribute('src')).toBe('about:blank');
    (doc.getElementById('apache-module-close') as HTMLButtonElement).click();
    expect(modal().hidden).toBe(true);
  });
});
