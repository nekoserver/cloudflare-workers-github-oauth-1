import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { aichatTabTitle, aichatFaviconHref } from './views/aichat';

describe('AI チャットのタブのタイトル(コンテナ稼働中なら🟢、停止中なら⚫️)', () => {
  it('稼働中は行末に🟢、停止中は⚫️、管理者以外(null)は何も付けない', () => {
    expect(aichatTabTitle(true)).toBe('💬チャット 🟢');
    expect(aichatTabTitle(false)).toBe('💬チャット ⚫️');
    expect(aichatTabTitle(null)).toBe('💬チャット');
  });
  it('ページのtitleに実際に入る', () => {
    const src = readFileSync('src/views/aichat.ts', 'utf8');
    expect(src).toContain('<title>${aichatTabTitle(user.containerRunning === undefined ? null : user.containerRunning)}</title>');
  });
  it('ハンドラは状態を読むだけで、停止中のコンテナを起こさない(getState)', () => {
    const idx = readFileSync('src/index.ts', 'utf8');
    expect(idx).toContain('async function getAichatContainerRunning(');
    expect(idx).toContain('getAichatContainerRunning(c.env, isCfDashboardAdmin(');
    expect(idx).toContain('if (!isAdmin) return null;');
    const fn = idx.slice(idx.indexOf('async function getAichatContainerRunning('), idx.indexOf('async function getAichatContainerRunning(') + 600);
    expect(fn).toContain('getState');
    expect(fn).not.toMatch(/\.start\(|\.fetch\(|startAndWait/);
  });
});

describe('AI チャットのファビコン(コンテナ稼働中は緑、停止中は灰色の四角)', () => {
  it('稼働中は緑、停止中・不明は灰色', () => {
    expect(aichatFaviconHref(true)).toContain('%2322c55e');
    expect(aichatFaviconHref(false)).toContain('%239ca3af');
    expect(aichatFaviconHref(null)).toContain('%239ca3af');
  });
});
