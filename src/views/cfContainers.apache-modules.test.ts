import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getCfContainersPage } from './cfContainers';

// /cf-containers のApacheモジュール一覧(ユーザー指定 2026-11-14):
// - 「Apache(本体)」行の行頭のトグルで ▶(全部閉じる)→▼(全部開く)→▲(🔐の行だけ)→▶ と巡る
// - 各モジュール名の先頭にチェックボックス。ONで🔐ボタンに替わりロック、🔐を押すと解除
// - ▼では🔐でない行をグレーアウト、▲ではそれらを表から消す
// - 有効なモジュールは名前も緑(module-active)
// - ロックはCookie(cfc_apache_module_locks)に7日間保存する

const DATA = {
  apacheVersion: '2.4.70',
  items: [
    { name: 'ssl_module', installed: true, enabled: true },
    { name: 'headers_module', installed: true, enabled: false },
    { name: 'proxy_module', installed: true, enabled: true },
  ],
};

function setup(cookie?: string) {
  const html = getCfContainersPage();
  const markup = html.match(/<table class="health-table" id="apache-modules-table"[\s\S]*?<\/table>\s*<div id="apache-modules-error"[^>]*><\/div>/)?.[0];
  const script = html.match(/<script id="apache-modules-panel">([\s\S]*?)<\/script>/)?.[1];
  expect(markup).toBeTruthy();
  expect(script).toBeTruthy();
  const dom = new JSDOM('<!doctype html><body>' + markup + '</body>', { url: 'https://example.test/cf-containers', runScripts: 'outside-only' });
  if (cookie) dom.window.document.cookie = cookie;
  dom.window.eval(script!);
  (dom.window as any).cfcApacheModules.render(DATA);
  const doc = dom.window.document;
  const toggle = () => doc.getElementById('apache-modules-toggle') as HTMLButtonElement;
  const row = (name: string) => doc.querySelector(`tr[data-module="${name}"]`) as HTMLTableRowElement;
  const visible = () => [...doc.querySelectorAll<HTMLTableRowElement>('tr[data-module]')].filter((r) => !r.hidden).map((r) => r.getAttribute('data-module'));
  return { dom, doc, toggle, row, visible };
}

describe('Apacheモジュール一覧の開閉とロック', () => {
  it('先頭にApache(本体)行があり、初期状態は▶で全モジュール行が閉じている', () => {
    const { doc, toggle, visible } = setup();
    const main = doc.querySelector('#apache-modules-tbody tr') as HTMLTableRowElement;
    expect(main.textContent).toContain('Apache(本体)');
    expect(main.contains(toggle())).toBe(true);
    expect(toggle().textContent).toBe('▶');
    expect(visible()).toEqual([]);
  });

  it('▶で押すと▼になり全行を開き、🔐でない行はグレーアウトする', () => {
    const { toggle, row, visible } = setup();
    toggle().click();
    expect(toggle().textContent).toBe('▼');
    expect(visible()).toEqual(['ssl_module', 'headers_module', 'proxy_module']);
    expect(row('ssl_module').classList.contains('module-unlocked')).toBe(true);
  });

  it('有効なモジュールは名前も緑、無効なものは緑にしない', () => {
    const { row } = setup();
    expect(row('ssl_module').querySelector('.module-name')!.className).toContain('module-active');
    expect(row('headers_module').querySelector('.module-name')!.className).not.toContain('module-active');
  });

  it('チェックボックスをONにすると🔐ボタンに替わり、Cookieに7日間保存する', () => {
    const { doc, row } = setup();
    const writes: string[] = [];
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(doc), 'cookie')!;
    Object.defineProperty(doc, 'cookie', { configurable: true, get: () => desc.get!.call(doc), set: (v: string) => { writes.push(v); desc.set!.call(doc, v); } });
    const box = row('headers_module').querySelector('input[type="checkbox"]') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new doc.defaultView!.Event('change'));
    const lock = row('headers_module').querySelector('button.module-lock') as HTMLButtonElement;
    expect(lock.textContent).toBe('🔐');
    expect(row('headers_module').querySelector('input[type="checkbox"]')).toBeNull();
    expect(row('headers_module').classList.contains('module-unlocked')).toBe(false);
    expect(writes.at(-1)).toContain('cfc_apache_module_locks=headers_module');
    expect(writes.at(-1)).toContain('Max-Age=604800');
    expect(writes.at(-1)).toContain('Path=/cf-containers');
  });

  it('▼で押すと▲になり🔐の行だけ残し、▲で押すと▶になり全行を閉じる', () => {
    const { toggle, visible } = setup('cfc_apache_module_locks=proxy_module');
    toggle().click();
    toggle().click();
    expect(toggle().textContent).toBe('▲');
    expect(visible()).toEqual(['proxy_module']);
    toggle().click();
    expect(toggle().textContent).toBe('▶');
    expect(visible()).toEqual([]);
  });

  it('Cookieのロックを読み戻し、🔐を押すと解除してCookieからも消す', () => {
    const { doc, row } = setup('cfc_apache_module_locks=ssl_module,proxy_module');
    const lock = row('ssl_module').querySelector('button.module-lock') as HTMLButtonElement;
    expect(lock).toBeTruthy();
    lock.click();
    expect(row('ssl_module').querySelector('button.module-lock')).toBeNull();
    expect((row('ssl_module').querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
    expect(doc.cookie).toContain('cfc_apache_module_locks=proxy_module');
  });

  it('▲の間に🔐を解除した行はその場で表から消える', () => {
    const { toggle, row, visible } = setup('cfc_apache_module_locks=ssl_module,proxy_module');
    toggle().click();
    toggle().click();
    (row('ssl_module').querySelector('button.module-lock') as HTMLButtonElement).click();
    expect(visible()).toEqual(['proxy_module']);
  });

  it('壊れたCookieや一覧に無い名前はロック無しとして扱う', () => {
    const { row } = setup('cfc_apache_module_locks=%E0%A4%A,unknown_module');
    expect(row('ssl_module').querySelector('button.module-lock')).toBeNull();
    expect(row('ssl_module').querySelector('input[type="checkbox"]')).toBeTruthy();
  });

  it('一覧が取れないときは表を隠し、理由を表示する', () => {
    const { dom, doc } = setup();
    (dom.window as any).cfcApacheModules.render({ error: 'apache2ctl failed' });
    expect((doc.getElementById('apache-modules-table') as HTMLTableElement).hidden).toBe(true);
    expect(doc.getElementById('apache-modules-error')!.textContent).toContain('apache2ctl failed');
  });
});
