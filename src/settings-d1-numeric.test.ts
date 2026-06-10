import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const src = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf-8');

// ===========================================================
// recentCommitsCount と toastDuration を D1 に保存し
// 別デバイス・別ブラウザでも設定が引き継がれるようにする
// ===========================================================

describe('マイグレーション: user_sessions に数値設定カラムを追加', () => {
  it('0052 マイグレーションが存在する', () => {
    expect(src).toContain("'0052':");
  });

  it('0052 が recent_commits_count カラムを追加する', () => {
    const idx = src.indexOf("'0052':");
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 400);
    expect(snippet).toContain('recent_commits_count');
  });

  it('0052 が toast_duration カラムを追加する', () => {
    const idx = src.indexOf("'0052':");
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 400);
    expect(snippet).toContain('toast_duration');
  });
});

describe('getUserSession: 数値設定カラムを返す', () => {
  it('getUserSession が recent_commits_count を SELECT する', () => {
    const idx = src.indexOf('function getUserSession');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 800);
    expect(fn).toContain('recent_commits_count');
  });

  it('getUserSession が toast_duration を SELECT する', () => {
    const idx = src.indexOf('function getUserSession');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 800);
    expect(fn).toContain('toast_duration');
  });

  it('getUserSession の戻り値型に recentCommitsCount が含まれる', () => {
    const idx = src.indexOf('function getUserSession');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 500);
    expect(fn).toContain('recentCommitsCount');
  });

  it('getUserSession の戻り値型に toastDuration が含まれる', () => {
    const idx = src.indexOf('function getUserSession');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 500);
    expect(fn).toContain('toastDuration');
  });
});

describe('updateUserSettings: 数値設定フィールドを受け付ける', () => {
  it("updateUserSettings の field 型に 'recent_commits_count' が含まれる", () => {
    const idx = src.indexOf('function updateUserSettings');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 300);
    expect(fn).toContain('recent_commits_count');
  });

  it("updateUserSettings の field 型に 'toast_duration' が含まれる", () => {
    const idx = src.indexOf('function updateUserSettings');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 300);
    expect(fn).toContain('toast_duration');
  });
});

describe('/settings ハンドラ: D1優先でrecentCommitsCount/toastDurationを解決', () => {
  it('/settings で userSession?.recentCommitsCount を参照する', () => {
    const idx = src.indexOf("app.get('/settings'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 6000);
    expect(handler).toContain('userSession?.recentCommitsCount');
  });

  it('/settings で userSession?.toastDuration を参照する', () => {
    const idx = src.indexOf("app.get('/settings'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 6000);
    expect(handler).toContain('userSession?.toastDuration');
  });

  it('/settings で recentCommitsCount を D1 優先・Cookie フォールバックで解決している', () => {
    const idx = src.indexOf("app.get('/settings'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 6000);
    expect(handler).toMatch(/userSession\?\.recentCommitsCount\s*\?\?/);
  });

  it('/settings で toastDuration を D1 優先・Cookie フォールバックで解決している', () => {
    const idx = src.indexOf("app.get('/settings'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 6000);
    expect(handler).toMatch(/userSession\?\.toastDuration\s*\?\?/);
  });
});

describe('/api/settings/recent-commits-count: D1にも書き込む', () => {
  it('recent-commits-count エンドポイントが updateUserSettings を呼ぶ', () => {
    const idx = src.indexOf("app.post('/api/settings/recent-commits-count'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 800);
    expect(handler).toContain('updateUserSettings');
  });

  it('recent-commits-count エンドポイントが authMiddleware を使う', () => {
    const idx = src.indexOf("app.post('/api/settings/recent-commits-count'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 200);
    expect(handler).toContain('authMiddleware');
  });
});

describe('/api/settings/toast-duration: D1にも書き込む', () => {
  it('toast-duration エンドポイントが updateUserSettings を呼ぶ', () => {
    const idx = src.indexOf("app.post('/api/settings/toast-duration'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 800);
    expect(handler).toContain('updateUserSettings');
  });

  it('toast-duration エンドポイントが authMiddleware を使う', () => {
    const idx = src.indexOf("app.post('/api/settings/toast-duration'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 200);
    expect(handler).toContain('authMiddleware');
  });
});
