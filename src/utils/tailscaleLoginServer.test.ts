import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateTailscaleLoginServer } from './tailscaleLoginServer';
import { ALLOWED_SECRET_NAMES } from './cfWorkerSecretApi';

describe('validateTailscaleLoginServer', () => {
  it('https の URL を受け付け、末尾のスラッシュを落として返す', () => {
    const r = validateTailscaleLoginServer('https://headscale.example.com/');
    expect(r).toEqual({ ok: true, value: 'https://headscale.example.com' });
  });

  it('ポートやパスを含む https の URL も受け付ける', () => {
    const r = validateTailscaleLoginServer('https://hs.example.com:8443/base');
    expect(r.ok).toBe(true);
  });

  it('空の値は未設定扱いにせず、理由付きで拒否する', () => {
    const r = validateTailscaleLoginServer('   ');
    expect(r).toMatchObject({ ok: false, errorCode: 'EMPTY' });
  });

  it('http は拒否する(認証キーを平文で送らないため)', () => {
    const r = validateTailscaleLoginServer('http://headscale.example.com');
    expect(r).toMatchObject({ ok: false, errorCode: 'NOT_HTTPS' });
  });

  it('URL として読めない値は拒否する', () => {
    const r = validateTailscaleLoginServer('not a url');
    expect(r).toMatchObject({ ok: false, errorCode: 'INVALID_URL' });
  });

  it('認証情報(user:pass@)を含む URL は拒否する', () => {
    const r = validateTailscaleLoginServer('https://user:pass@headscale.example.com');
    expect(r).toMatchObject({ ok: false, errorCode: 'HAS_CREDENTIALS' });
  });
});

describe('TAILSCALE_LOGIN_SERVER の書き換え許可', () => {
  it('ALLOWED_SECRET_NAMES に含まれる(管理画面から保存・再起動で反映できる)', () => {
    expect(ALLOWED_SECRET_NAMES).toContain('TAILSCALE_LOGIN_SERVER');
  });

  it('管理画面の対象選択に TAILSCALE_LOGIN_SERVER がある', () => {
    const s = readFileSync('src/views/cfContainers.ts', 'utf-8');
    expect(s).toMatch(/<option value="TAILSCALE_LOGIN_SERVER"/);
  });

  it('secrets API は保存前に TAILSCALE_LOGIN_SERVER の値を検証する', () => {
    const s = readFileSync('src/index.ts', 'utf-8');
    expect(s).toMatch(/validateTailscaleLoginServer\(value\)/);
  });
});
