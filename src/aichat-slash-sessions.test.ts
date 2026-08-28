import { describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { formatAichatSlashCommandHelp, formatUserSessionLogins, interpretAichatSlashCommand } from './utils/aichatSlashCommand';

const rows = [
  { user_id: 'new-user', last_login_at: '2026-08-27T10:00:00Z', current_login_at: '2026-08-28T10:00:00Z' },
  { user_id: 'first-login', last_login_at: null, current_login_at: '2026-08-26T10:00:00Z' },
];

describe('/neko sessions', () => {
  it('セッションのログイン時刻をMarkdownテーブルで表示する', async () => {
    const fetchUserSessionLogins = vi.fn().mockResolvedValue(rows);
    const result = await interpretAichatSlashCommand('/neko sessions', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      fetchUserSessionLogins,
    });

    expect(result).toEqual({ handled: true, response: formatUserSessionLogins(rows) });
    expect(result.handled && result.response).toContain('| first-login | — | 2026-08-26T10:00:00Z |');
    expect(fetchUserSessionLogins).toHaveBeenCalledOnce();
  });

  it('ヘルプにコマンドを掲載する', () => {
    expect(formatAichatSlashCommandHelp()).toContain('| /neko sessions |');
  });
});

describe('POST /api/aichat sessionsコマンド', () => {
  it('指定されたSQLを実行して新しい順の結果を返す', async () => {
    const sqlStatements: string[] = [];
    const db = {
      prepare: (sql: string) => {
        sqlStatements.push(sql);
        return {
          bind: () => ({ first: () => Promise.resolve({ revoked_at: null }) }),
          all: () => Promise.resolve({ results: rows }),
        };
      },
    };
    const token = await createJWT({ sub: 'admin-user', name: 'Admin' }, 'test-secret');
    const response = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '/neko sessions' }),
    }, { JWT_SECRET: 'test-secret', DB: db });
    const body = await response.json() as { response: string; usedModel: string };

    expect(response.status).toBe(200);
    expect(body.usedModel).toBe('local/neko');
    expect(body.response).toBe(formatUserSessionLogins(rows));
    expect(sqlStatements).toContain(
      'SELECT user_id, last_login_at, current_login_at FROM user_sessions ORDER BY current_login_at DESC;'
    );
  });
});
