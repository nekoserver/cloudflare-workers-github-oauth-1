import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getCfContainersPage } from './cfContainers';
import { APACHE_MODULE_INFO, APACHE_DEBIAN_DEFAULT_ENABLED } from '../utils/apacheModuleInfo';

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
  if (cookie) dom.window.document.cookie = cookie + '; Path=/cf-containers';
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

  it('▶で押すと▼になり全行を開き、🔐でない無効な行はグレーアウトする', () => {
    const { toggle, row, visible } = setup();
    toggle().click();
    expect(toggle().textContent).toBe('▼');
    expect(visible()).toEqual(['ssl_module', 'headers_module', 'proxy_module']);
    expect(row('headers_module').classList.contains('module-unlocked')).toBe(true);
  });

  // ユーザー指定(2026-11-14): 有効なモジュールの行はグレーアウトさせず、標準でロック状態にする。
  it('有効なモジュールはCookieが無くても🔐で始まり、グレーアウトしない', () => {
    const { row } = setup();
    expect(row('ssl_module').querySelector('button.module-lock')!.textContent).toBe('🔐');
    expect(row('ssl_module').classList.contains('module-unlocked')).toBe(false);
    expect(row('headers_module').querySelector('input[type="checkbox"]')).toBeTruthy();
  });

  it('有効なモジュールの🔐を外すとCookieに「-名前」で残り、描き直しても外れたまま。グレーにはしない', () => {
    const { dom, doc, row } = setup();
    (row('ssl_module').querySelector('button.module-lock') as HTMLButtonElement).click();
    expect(doc.cookie).toContain('-ssl_module');
    expect(row('ssl_module').classList.contains('module-unlocked')).toBe(false);
    (dom.window as any).cfcApacheModules.render(DATA);
    expect(row('ssl_module').querySelector('input[type="checkbox"]')).toBeTruthy();
    const box = row('ssl_module').querySelector('input[type="checkbox"]') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new doc.defaultView!.Event('change'));
    expect(row('ssl_module').querySelector('button.module-lock')).toBeTruthy();
    expect(doc.cookie).not.toContain('-ssl_module');
  });

  // ユーザー指定(2026-11-14): グレーアウトした行のモジュール名は通常の文字色(ダークテーマで白)にして見やすくする。
  it('グレーアウトは行の残りだけに掛け、モジュール名は通常の文字色のままにする', () => {
    const html = getCfContainersPage();
    expect(html).toContain('.module-unlocked td:not(:first-child) { opacity: 0.45; }');
    expect(html).toContain('.module-unlocked .module-name { color: var(--text); font-weight: 600; }');
    expect(html).not.toContain('.module-unlocked { opacity: 0.45; }');
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
    expect(visible()).toEqual(['ssl_module', 'proxy_module']);
    toggle().click();
    expect(toggle().textContent).toBe('▶');
    expect(visible()).toEqual([]);
  });

  it('Cookieのロックを読み戻し、無効なモジュールの🔐を押すと解除してCookieからも消す', () => {
    const { doc, row } = setup('cfc_apache_module_locks=headers_module,proxy_module');
    const lock = row('headers_module').querySelector('button.module-lock') as HTMLButtonElement;
    expect(lock).toBeTruthy();
    lock.click();
    expect(row('headers_module').querySelector('button.module-lock')).toBeNull();
    expect((row('headers_module').querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
    expect(doc.cookie).toContain('cfc_apache_module_locks=proxy_module');
    expect(doc.cookie).not.toContain('headers_module');
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
    expect(row('headers_module').querySelector('button.module-lock')).toBeNull();
    expect(row('headers_module').querySelector('input[type="checkbox"]')).toBeTruthy();
  });

  // ユーザー指定(2026-11-14): モジュール名を押すと、最上位のモーダルに役割・初期設定・今の状態を色文字で出す。
  it('モジュール名を押すと最上位のモーダルに役割・初期設定・今の状態を色付きで出し、✕とEscで閉じる', () => {
    const { doc, row } = setup();
    const other = doc.createElement('div');
    other.style.position = 'fixed';
    other.style.zIndex = '5000';
    doc.body.appendChild(other);
    (row('ssl_module').querySelector('.module-name') as HTMLButtonElement).click();
    const modal = doc.getElementById('apache-module-modal') as HTMLElement;
    expect(modal.hidden).toBe(false);
    expect(Number(modal.style.zIndex)).toBeGreaterThan(5000);
    expect(modal.textContent).toContain('ssl_module');
    expect(modal.textContent).toContain(APACHE_MODULE_INFO.ssl);
    expect(modal.textContent).toContain('Debianの既定では無効');
    expect(modal.textContent).toContain('a2enmod ssl');
    const state = modal.querySelector('[data-field="module-state"]') as HTMLElement;
    expect(state.textContent).toBe('有効');
    expect(state.className).toContain('module-active');
    (modal.querySelector('[data-action="close-module-modal"]') as HTMLButtonElement).click();
    expect(modal.hidden).toBe(true);
    (row('headers_module').querySelector('.module-name') as HTMLButtonElement).click();
    const state2 = modal.querySelector('[data-field="module-state"]') as HTMLElement;
    expect(state2.textContent).toBe('無効');
    expect(state2.className).toContain('module-off');
    expect(modal.textContent).toContain('Debianの既定では無効');
    doc.dispatchEvent(new doc.defaultView!.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(modal.hidden).toBe(true);
  });

  it('Debianの既定で有効なモジュールは初期設定に「既定で有効」と出し、説明の無いモジュールは未登録と出す', () => {
    const { dom, doc } = setup();
    (dom.window as any).cfcApacheModules.render({ apacheVersion: '2.4.70', items: [{ name: 'dir', installed: true, enabled: true }, { name: 'made_up_module', installed: false, enabled: false }] });
    (doc.querySelector('tr[data-module="dir"] .module-name') as HTMLButtonElement).click();
    const modal = doc.getElementById('apache-module-modal') as HTMLElement;
    expect(modal.textContent).toContain('Debianの既定で有効');
    (doc.querySelector('tr[data-module="made_up_module"] .module-name') as HTMLButtonElement).click();
    expect(modal.textContent).toContain('役割の説明は未登録');
    expect(modal.querySelector('[data-field="module-state"]')!.textContent).toBe('未導入');
  });

  // ユーザー指定(2026-11-14): Apacheのソースのドキュメントを静的アセットに置き、モーダルからiframeで表示する。
  it('ドキュメントのあるモジュールは「公式ドキュメントを見る」でさらに上のiframeのモーダルを開き、日本語版があれば日本語版を出す', () => {
    const { dom, doc } = setup();
    (dom.window as any).cfcApacheModules.render({ apacheVersion: '2.4.71', items: [{ name: 'ssl', installed: true, enabled: true }, { name: 'headers', installed: true, enabled: true }, { name: 'mpm_event', installed: true, enabled: true }] });
    (doc.querySelector('tr[data-module="ssl"] .module-name') as HTMLButtonElement).click();
    const info = doc.getElementById('apache-module-modal') as HTMLElement;
    (info.querySelector('[data-action="open-module-doc"]') as HTMLButtonElement).click();
    const docModal = doc.getElementById('apache-doc-modal') as HTMLElement;
    expect(docModal.hidden).toBe(false);
    expect(Number(docModal.style.zIndex)).toBeGreaterThan(Number(info.style.zIndex));
    expect(docModal.querySelector('iframe')!.getAttribute('src')).toBe('/apache-docs/2.4.71/mod/mod_ssl.en.html');
    (docModal.querySelector('[data-action="close-doc-modal"]') as HTMLButtonElement).click();
    expect(docModal.hidden).toBe(true);
    expect(docModal.querySelector('iframe')!.getAttribute('src')).toBe('about:blank');
    (doc.querySelector('tr[data-module="headers"] .module-name') as HTMLButtonElement).click();
    (info.querySelector('[data-action="open-module-doc"]') as HTMLButtonElement).click();
    expect(docModal.querySelector('iframe')!.getAttribute('src')).toBe('/apache-docs/2.4.71/mod/mod_headers.ja.html');
    (doc.querySelector('tr[data-module="mpm_event"] .module-name') as HTMLButtonElement).click();
    (info.querySelector('[data-action="open-module-doc"]') as HTMLButtonElement).click();
    expect(docModal.querySelector('iframe')!.getAttribute('src')).toBe('/apache-docs/2.4.71/mod/event.en.html');
  });

  it('ドキュメントの無いモジュールはボタンを出さず、無いことを書く', () => {
    const { dom, doc } = setup();
    (dom.window as any).cfcApacheModules.render({ apacheVersion: '2.4.71', items: [{ name: 'made_up_module', installed: false, enabled: false }] });
    (doc.querySelector('tr[data-module="made_up_module"] .module-name') as HTMLButtonElement).click();
    const info = doc.getElementById('apache-module-modal') as HTMLElement;
    expect(info.querySelector('[data-action="open-module-doc"]')).toBeNull();
    expect(info.textContent).toContain('公式ドキュメントは同梱していません');
  });

  it('一覧が取れないときは表を隠し、理由を表示する', () => {
    const { dom, doc } = setup();
    (dom.window as any).cfcApacheModules.render({ error: 'apache2ctl failed' });
    expect((doc.getElementById('apache-modules-table') as HTMLTableElement).hidden).toBe(true);
    expect(doc.getElementById('apache-modules-error')!.textContent).toContain('apache2ctl failed');
  });
});

// 2026-11-14にこのコンテナ(Apache 2.4、Debian系)で実測した /usr/lib/apache2/modules の125個と、
// /etc/apache2/mods-enabled のうちDebianのapache2パッケージが既定で有効にする19個。
const INSTALLED_20261114 = 'access_compat actions alias allowmethods asis auth_basic auth_digest auth_form authn_anon authn_core authn_dbd authn_dbm authn_file authn_socache authnz_fcgi authnz_ldap authz_core authz_dbd authz_dbm authz_groupfile authz_host authz_owner authz_user autoindex brotli bucketeer buffer cache cache_disk cache_socache case_filter case_filter_in cern_meta cgi cgid charset_lite data dav dav_fs dav_lock dbd deflate dialup dir dumpio echo env example_hooks example_ipc expires ext_filter file_cache filter headers heartbeat heartmonitor http2 ident imagemap include info isapi lbmethod_bybusyness lbmethod_byrequests lbmethod_bytraffic lbmethod_heartbeat ldap log_debug log_forensic lua macro md mime mime_magic mpm_event mpm_prefork mpm_worker negotiation optional_fn_export optional_fn_import optional_hook_export optional_hook_import proxy proxy_ajp proxy_balancer proxy_connect proxy_express proxy_fcgi proxy_fdpass proxy_ftp proxy_hcheck proxy_html proxy_http proxy_http2 proxy_scgi proxy_uwsgi proxy_wstunnel ratelimit reflector remoteip reqtimeout request rewrite sed session session_cookie session_crypto session_dbd setenvif slotmem_plain slotmem_shm socache_dbm socache_memcache socache_redis socache_shmcb speling ssl status substitute suexec unique_id userdir usertrack vhost_alias xml2enc'.split(' ');

describe('Apacheモジュールの説明', () => {
  it('実測した125個すべてに役割の説明がある', () => {
    expect(INSTALLED_20261114).toHaveLength(125);
    expect(INSTALLED_20261114.filter((name) => !APACHE_MODULE_INFO[name])).toEqual([]);
  });
  it('Debianの既定で有効な19個を持つ', () => {
    expect([...APACHE_DEBIAN_DEFAULT_ENABLED].sort()).toEqual(['access_compat', 'alias', 'auth_basic', 'authn_core', 'authn_file', 'authz_core', 'authz_host', 'authz_user', 'autoindex', 'deflate', 'dir', 'env', 'filter', 'mime', 'mpm_event', 'negotiation', 'reqtimeout', 'setenvif', 'status']);
  });
  it('説明はページのscriptへそのまま埋め込めるよう、引用符・バックスラッシュ・山括弧を含まない', () => {
    for (const [name, text] of Object.entries(APACHE_MODULE_INFO)) {
      expect(/["'`\\<>]/.test(text), name).toBe(false);
    }
  });
});
