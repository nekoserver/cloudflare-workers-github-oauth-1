/**
 * GET/POST /api/wasm-modules と GET /wasm-modules の統合テスト
 *
 * 対象: /wasm-modulesページのAPI(一覧取得・ON/OFF保存)と、
 * /neko 256がsha256モジュールの無効化設定を尊重してブロックされること。
 *
 * 故障シナリオ:
 *   (1) POSTで未知のmoduleIdを渡してもD1に書き込めてしまう(想定外の
 *       レジストリ外エントリが増える)
 *   (2) enabledがboolean以外でも通ってしまう
 *   (3) sha256モジュールを無効化しても/neko 256がそのまま実行できてしまう
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(wasmConfigRows: Record<string, unknown>[] = []) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          if (sql.includes('wasm_module_startup_config')) {
            return Promise.resolve(wasmConfigRows[0] ?? null);
          }
          return Promise.resolve(null);
        }),
        all: vi.fn().mockResolvedValue({ results: wasmConfigRows }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    })),
  };
}

describe('GET /api/wasm-modules', () => {
  it('D1に行が無い場合、レジストリ全モジュールをenabled: trueで返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/wasm-modules',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb([]) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { modules: { id: string; enabled: boolean }[] };
    const sha256 = body.modules.find((m) => m.id === 'sha256');
    expect(sha256?.enabled).toBe(true);
  });
});

describe('POST /api/wasm-modules', () => {
  it('未知のmoduleIdは400で拒否される', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/wasm-modules',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: 'unknown-module', enabled: false }),
      },
      { JWT_SECRET, DB: createMockDb([]) }
    );
    expect(res.status).toBe(400);
  });

  it('enabledがboolean以外だと400で拒否される', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/wasm-modules',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: 'sha256', enabled: 'yes' }),
      },
      { JWT_SECRET, DB: createMockDb([]) }
    );
    expect(res.status).toBe(400);
  });

  it('既知のmoduleIdとboolean型のenabledなら200で保存できる', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/wasm-modules',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: 'sha256', enabled: false }),
      },
      { JWT_SECRET, DB: createMockDb([]) }
    );
    expect(res.status).toBe(200);
  });
});

describe('GET /wasm-modules', () => {
  it('ページが200で返る', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/wasm-modules',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb([]) }
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('WASMモジュール一覧');
  });
});

describe('POST /api/aichat: /neko 256はsha256モジュールの無効化設定を尊重する', () => {
  it('sha256モジュールが無効化されている場合、/neko 256はエラーメッセージを返し実行しない', async () => {
    const authHeader = await makeAuthHeader();
    const disabledRow = { module_id: 'sha256', enabled: 0, updated_at: '2026-08-18 00:00:00', updated_by: 'admin' };
    const res = await app.request(
      '/api/aichat',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '/neko 256 hello' }),
      },
      { JWT_SECRET, DB: createMockDb([disabledRow]) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { response: string };
    expect(body.response).toContain('❌');
    expect(body.response).toContain('/neko 256');
  });
});
