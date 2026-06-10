import { describe, it, expect } from 'vitest';
import { resolveSessionDuration } from './session';
import * as fs from 'fs';
import * as path from 'path';

// ===========================================================
// バグ: /settings ページがセッション有効期限を Cookie のみから
// 読んでいるため、ログアウトで user_session_duration Cookie が
// 削除されると D1 に保存済みの値（例: 3d）を無視して常に
// 「1時間 (デフォルト)」が選択表示される
// ===========================================================
describe('resolveSessionDuration: D1優先のセッション期間解決', () => {
  it('D1の値があればD1を優先する', () => {
    expect(resolveSessionDuration('3d', '1h')).toBe('3d');
  });

  it('D1の値がnullならCookieへフォールバックする', () => {
    expect(resolveSessionDuration(null, '1w')).toBe('1w');
  });

  it('D1の値がundefinedならCookieへフォールバックする', () => {
    expect(resolveSessionDuration(undefined, '8h')).toBe('8h');
  });

  it('双方欠落時は1hを返す', () => {
    expect(resolveSessionDuration(null, undefined)).toBe('1h');
    expect(resolveSessionDuration(undefined, null)).toBe('1h');
  });

  it('D1の値が不正値ならCookieへフォールバックする', () => {
    expect(resolveSessionDuration('2h', '3d')).toBe('3d');
  });

  it('Cookieの値も不正値なら1hを返す', () => {
    expect(resolveSessionDuration('bad', 'worse')).toBe('1h');
  });

  it('空文字は欠落として扱う', () => {
    expect(resolveSessionDuration('', '')).toBe('1h');
  });

  it('有効値6種をすべて受理する', () => {
    for (const v of ['1h', '3h', '8h', '1d', '3d', '1w']) {
      expect(resolveSessionDuration(v, null)).toBe(v);
    }
  });
});

describe('/settings ハンドラが resolveSessionDuration を使う', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf-8');

  it('/settings ハンドラ内で resolveSessionDuration を呼ぶ', () => {
    const idx = src.indexOf("app.get('/settings'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 5000);
    expect(handler).toContain('resolveSessionDuration(');
  });

  it('/settings ハンドラで userSession の sessionDuration を参照する', () => {
    const idx = src.indexOf("app.get('/settings'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 5000);
    expect(handler).toContain('userSession?.sessionDuration');
  });

  it('Cookie単独参照のフォールバック式（|| \'1h\'直書き）が /settings から消えている', () => {
    const idx = src.indexOf("app.get('/settings'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 5000);
    expect(handler).not.toMatch(/const sessionDuration = cookieVals\['user_session_duration'\] \|\| '1h';/);
  });
});
