import { describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { interpretAichatSlashCommand } from './utils/aichatSlashCommand';
import { generateUuid } from './utils/uuid';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('/neko uuidgen4・uuidgen7', () => {
  it.each([
    ['uuidgen4', 'v4', '11111111-1111-4111-8111-111111111111'],
    ['uuidgen7', 'v7', '22222222-2222-7222-8222-222222222222'],
  ] as const)('%s は内部UUID生成APIの結果を1件だけ返す', async (command, version, uuid) => {
    const generate = vi.fn().mockResolvedValue(uuid);
    const result = await interpretAichatSlashCommand(`/neko ${command}`, new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      generateUuid: generate,
    });
    expect(result).toEqual({ handled: true, response: uuid });
    expect(generate).toHaveBeenCalledWith(version);
  });

  it('生成APIが失敗した場合はエラーを画面に返す', async () => {
    const result = await interpretAichatSlashCommand('/neko uuidgen4', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      generateUuid: async () => { throw new Error('保存失敗'); },
    });
    expect(result).toEqual({ handled: true, response: '❌ /neko uuidgen4 の実行中にエラーが発生しました: 保存失敗' });
  });
});

describe('UUID生成', () => {
  it('v4・v7のversion/variantビットとv7の時刻部分が正しい', () => {
    expect(generateUuid('v4')).toMatch(UUID_V4_RE);
    const now = 1_787_097_600_123;
    const v7 = generateUuid('v7', now);
    expect(v7).toMatch(UUID_V7_RE);
    expect(BigInt(`0x${v7.replace(/-/g, '').slice(0, 12)}`)).toBe(BigInt(now));
  });
});

describe('POST /api/aichat UUIDコマンド', () => {
  it.each([
    ['/neko uuidgen4', 'v4', UUID_V4_RE],
    ['/neko uuidgen7', 'v7', UUID_V7_RE],
  ] as const)('%s はUUIDを返し、既存uuid_historyへユーザー単位で保存する', async (message, version, pattern) => {
    const writes: unknown[][] = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => ({
          first: () => Promise.resolve(sql.includes('user_sessions') ? { revoked_at: null } : null),
          all: () => Promise.resolve({ results: [] }),
          run: () => { if (sql.includes('INSERT INTO uuid_history')) writes.push(values); return Promise.resolve({ success: true }); },
        }),
      }),
    };
    const token = await createJWT({ sub: 'uuid-user', name: 'UUID User' }, 'test-secret');
    const response = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }, { JWT_SECRET: 'test-secret', DB: db });
    const body = await response.json() as { response: string; usedModel: string };

    expect(response.status).toBe(200);
    expect(body.response).toMatch(pattern);
    expect(body.usedModel).toBe('local/neko');
    expect(writes).toEqual([['uuid-user', body.response, version]]);
  });
});
