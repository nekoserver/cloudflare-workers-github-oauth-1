import { describe, expect, it } from 'vitest';
import { replaceCountdownEvent } from './utils/countdown';
import app from './index';
import { createJWT } from './utils/jwt';
import { readFileSync } from 'node:fs';

const JWT_SECRET = 'test-secret-at-least-32-characters-long';

function mockDb() {
  const calls: Array<{ sql: string; args: unknown[] }> = [];
  return {
    calls,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            run: async () => { calls.push({ sql, args }); },
            first: async () => null,
          };
        },
      };
    },
  };
}

describe('次回ログイン用セッション期間とカウントダウンのポリシー', () => {
  it('同じシステムラベルの予定を削除してから実期限を1件登録する', async () => {
    const db = mockDb();
    const result = await replaceCountdownEvent(db, {
      userId: 'octocat', label: 'セッション有効期限', targetAt: '2026-09-17T00:00:00.000Z',
    });

    expect(result).toEqual({ ok: true, registered: true });
    expect(db.calls).toHaveLength(2);
    expect(db.calls[0].sql).toContain('DELETE FROM countdown_events');
    expect(db.calls[0].args).toEqual(['octocat', 'セッション有効期限']);
    expect(db.calls[1].sql).toContain('INSERT INTO countdown_events');
    expect(db.calls[1].args.slice(0, 3)).toEqual(['octocat', 'セッション有効期限', '2026-09-17T00:00:00.000Z']);
  });

  it('設定保存では現在のauth_tokenを更新せず次回ログイン適用と返す', async () => {
    const token = await createJWT({ sub: 'octocat', name: 'Octocat' }, JWT_SECRET, 3600);
    const db = mockDb();
    const res = await app.request('/api/settings/session-duration', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionDuration: '3h' }),
    }, { JWT_SECRET, DB: db as never });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ sessionDuration: '3h', appliesAt: 'next_login', currentSessionUnchanged: true });
    const cookies = res.headers.getSetCookie();
    expect(cookies.some(cookie => cookie.startsWith('auth_token='))).toBe(false);
    expect(cookies.some(cookie => cookie.startsWith('user_session_duration=3h'))).toBe(true);
  });

  it('OAuthと公開鍵の両ログイン確定経路で期限予定を同期する', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const oauth = source.slice(source.indexOf('async function finalizeGithubLogin'), source.indexOf('async function flagPublicKeySecurityEvent'));
    const passkey = source.slice(source.indexOf('async function finalizePasskeyLogin'), source.indexOf('// D1データベースのユーザー設定を更新'));
    expect(oauth).toContain('syncLoginSessionCountdown(');
    expect(oauth).toContain('params.githubLogin');
    expect(passkey).toContain('syncLoginSessionCountdown(');
    expect(passkey).toContain('params.userId');
  });
});
