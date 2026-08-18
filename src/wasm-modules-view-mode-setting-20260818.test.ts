import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { resolveWasmModulesViewMode, WASM_MODULES_VIEW_MODE_COOKIE } from './index';
import { createJWT } from './utils/jwt';
import { getWasmModulesPage } from './views/wasmModules';

// 対象: /wasm-modulesページの表示モード(パネル/リスト)設定のCookie解決ロジックと
// 保存API(/api/settings/wasm-modules-view-mode)、およびGET /wasm-modulesが
// Cookieに応じた初期モードでページを描画すること。デフォルトはリスト表示。
//
// 故障シナリオ:
//   (1) Cookie未設定時にデフォルトがパネル表示になってしまう(要件はリスト表示がデフォルト)
//   (2) 'panel'以外の不正な値でもパネル表示扱いになる
//   (3) 保存APIが不正なmode値(list/panel以外)を受け付けてしまう
//   (4) GET /wasm-modulesがCookieの値を無視して常に同じ初期モードを返す

describe('resolveWasmModulesViewMode: 表示モードのCookie解決', () => {
  it('Cookie未設定時はデフォルトでリスト表示', () => {
    expect(resolveWasmModulesViewMode(undefined)).toBe('list');
  });

  it(WASM_MODULES_VIEW_MODE_COOKIE + '=panel の場合はパネル表示', () => {
    expect(resolveWasmModulesViewMode(WASM_MODULES_VIEW_MODE_COOKIE + '=panel')).toBe('panel');
  });

  it(WASM_MODULES_VIEW_MODE_COOKIE + '=list の場合はリスト表示', () => {
    expect(resolveWasmModulesViewMode(WASM_MODULES_VIEW_MODE_COOKIE + '=list')).toBe('list');
  });

  it('不正な値(panel/list以外の文字列)が入っていてもデフォルトのリスト表示のまま', () => {
    expect(resolveWasmModulesViewMode(WASM_MODULES_VIEW_MODE_COOKIE + '=xyz')).toBe('list');
  });
});

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

describe('POST /api/settings/wasm-modules-view-mode', () => {
  it('mode=panel/listは200でCookieを保存する(Secure属性を含む)', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/settings/wasm-modules-view-mode',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'panel' }),
      },
      { JWT_SECRET }
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain(WASM_MODULES_VIEW_MODE_COOKIE + '=panel');
    expect(setCookie).toContain('Secure');
  });

  it('不正なmode値は400で拒否される(握りつぶさない)', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/settings/wasm-modules-view-mode',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'grid' }),
      },
      { JWT_SECRET }
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /wasm-modules: Cookieに応じた初期モードでページを描画する', () => {
  it('Cookie未設定時はリストモードのボタンがactiveになる', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/wasm-modules',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET }
    );
    const html = await res.text();
    const idx = html.indexOf('id="modeListBtn"');
    const start = html.lastIndexOf('<button', idx);
    const end = html.indexOf('>', idx);
    expect(html.slice(start, end + 1)).toContain('active');
  });

  it(WASM_MODULES_VIEW_MODE_COOKIE + '=panel Cookieがある場合はパネルモードのボタンがactiveになる', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/wasm-modules',
      { headers: { Authorization: authHeader, Cookie: WASM_MODULES_VIEW_MODE_COOKIE + '=panel' } },
      { JWT_SECRET }
    );
    const html = await res.text();
    const idx = html.indexOf('id="modePanelBtn"');
    const start = html.lastIndexOf('<button', idx);
    const end = html.indexOf('>', idx);
    expect(html.slice(start, end + 1)).toContain('active');
  });
});

describe('getWasmModulesPage: 第2引数省略時のデフォルト', () => {
  it('第2引数を省略した場合はresolveWasmModulesViewModeのデフォルトと同じリストモードになる', () => {
    const html = getWasmModulesPage('tester');
    const idx = html.indexOf('id="modeListBtn"');
    const start = html.lastIndexOf('<button', idx);
    const end = html.indexOf('>', idx);
    expect(html.slice(start, end + 1)).toContain('active');
  });
});
