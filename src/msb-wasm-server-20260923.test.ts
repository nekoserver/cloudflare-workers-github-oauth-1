/**
 * `/neko msb --help` (microsandboxのCLI `msb` のヘルプ一覧, Rust/WASM) の統合テスト。
 *
 * 対象: AIチャットの `/neko msb --help` サブコマンド。msb本体はKVM/libkrun等の
 * OS仮想化に依存しWASMでは実行できないため、公式READMEのコマンド一覧に
 * 基づく静的なヘルプ出力(msb-wasm)のみをdynamic import経由で呼び出す。
 *
 * 故障シナリオ:
 *   (1) /neko msbがsha256/ls等と同様のdynamic import配線を欠き、index.tsの
 *       静的importになって.wasmインポートがVite/vitest環境でWebAssembly.Module
 *       を返さず、既存の全テストが壊れる
 *   (2) msbモジュールが/wasm-modulesページで無効化されているのに実行されてしまう
 */
import { describe, it, expect } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(wasmConfigRows: Record<string, unknown>[] = []) {
  return {
    prepare: (sql: string) => ({
      bind: () => ({
        first: () => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          if (sql.includes('wasm_module_startup_config')) {
            return Promise.resolve(wasmConfigRows[0] ?? null);
          }
          return Promise.resolve(null);
        },
        all: () => Promise.resolve({ results: [] }),
        run: () => Promise.resolve({ success: true }),
      }),
    }),
  };
}

describe('POST /api/aichat: /neko msb --help サーバー配線', () => {
  it('index.ts の /api/aichat が msbHelpViaWasm を渡す（dynamic importで読み込む）', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.post('/api/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 12200);
    expect(fn).toContain('msbHelpViaWasm:');
    expect(fn).toContain("await import('./utils/msbWasmServer')");
  });

  it('msbモジュールが無効化されている場合、/neko msb --helpはエラーメッセージを返し実行しない', async () => {
    const authHeader = await makeAuthHeader();
    const disabledRow = { module_id: 'msb', enabled: 0, updated_at: '2026-09-23 00:00:00', updated_by: 'admin' };
    const res = await app.request(
      '/api/aichat',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '/neko msb --help' }),
      },
      { JWT_SECRET, DB: createMockDb([disabledRow]) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response?: string };
    expect(body.response).toContain('msbモジュールは現在無効化されています');
  });
});
