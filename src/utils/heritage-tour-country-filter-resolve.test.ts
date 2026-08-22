import { describe, it, expect } from 'vitest';
import { resolveHeritageTourCountryFilterEnabled } from './session';
import * as fs from 'fs';
import * as path from 'path';

describe('resolveHeritageTourCountryFilterEnabled: D1優先の国別フィルタ設定解決', () => {
  it('D1の値が on ならtrueを返す', () => {
    expect(resolveHeritageTourCountryFilterEnabled('on', 'off')).toBe(true);
  });

  it('D1の値が off ならfalseを返す(Cookieより優先)', () => {
    expect(resolveHeritageTourCountryFilterEnabled('off', 'on')).toBe(false);
  });

  it('D1がnullならCookieへフォールバックする(off)', () => {
    expect(resolveHeritageTourCountryFilterEnabled(null, 'off')).toBe(false);
  });

  it('D1がundefinedならCookieへフォールバックする(on)', () => {
    expect(resolveHeritageTourCountryFilterEnabled(undefined, 'on')).toBe(true);
  });

  it('D1・Cookie双方欠落時はデフォルトtrue(する)を返す', () => {
    expect(resolveHeritageTourCountryFilterEnabled(null, null)).toBe(true);
    expect(resolveHeritageTourCountryFilterEnabled(undefined, undefined)).toBe(true);
  });

  it('D1が不正値ならCookieへフォールバックする', () => {
    expect(resolveHeritageTourCountryFilterEnabled('bogus', 'off')).toBe(false);
  });

  it('Cookieも不正値ならデフォルトtrueを返す', () => {
    expect(resolveHeritageTourCountryFilterEnabled('bogus', 'bogus')).toBe(true);
  });

  it('空文字は欠落として扱う', () => {
    expect(resolveHeritageTourCountryFilterEnabled('', '')).toBe(true);
  });
});

describe('/heritage-journey ハンドラが resolveHeritageTourCountryFilterEnabled を使う', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf-8');

  it("/heritage-journey ハンドラ内で resolveHeritageTourCountryFilterEnabled を呼ぶ", () => {
    const idx = src.indexOf("app.get('/heritage-journey'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 2000);
    expect(handler).toContain('resolveHeritageTourCountryFilterEnabled(');
  });
});
