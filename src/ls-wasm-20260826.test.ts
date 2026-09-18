/**
 * `/neko ls` (GNU coreutilsのlsコマンドを模した書式整形, Rust/WASM) の統合テスト。
 *
 * 対象: AIチャットの `/neko ls [-l] [-a]` サブコマンド。lsコマンドの出力書式
 * (短形式は1行1名前、-l長形式、-a全件表示)だけをRust/WASM(wasm/ls-wasm)で
 * 再実装したもので、Workersには実ファイルシステムが無いため、一覧対象は
 * WASM_MODULE_REGISTRY自体(このリポジトリのWASMモジュールカタログ)を
 * 仮想ディレクトリとして扱う。
 *
 * 故障シナリオ:
 *   (1) /neko lsがsha256/factor/digと同様のdynamic import配線を欠き、
 *       index.tsの静的importになって.wasmインポートがVite/vitest環境で
 *       WebAssembly.Moduleを返さず、既存の全テストが壊れる
 *   (2) lsモジュールが/wasm-modulesページで無効化されているのに実行されてしまう
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

describe('POST /api/aichat: /neko ls サーバー配線', () => {
  it('index.ts の /api/aichat が lsViaWasm を渡す（dynamic importで読み込む）', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.post('/api/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 11400);
    expect(fn).toContain('lsViaWasm:');
    expect(fn).toContain("await import('./utils/lsWasmServer')");
  });

  it('lsモジュールが無効化されている場合、/neko lsはエラーメッセージを返し実行しない', async () => {
    const authHeader = await makeAuthHeader();
    const disabledRow = { module_id: 'ls', enabled: 0, updated_at: '2026-08-26 00:00:00', updated_by: 'admin' };
    const res = await app.request(
      '/api/aichat',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '/neko ls' }),
      },
      { JWT_SECRET, DB: createMockDb([disabledRow]) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response?: string };
    expect(body.response).toContain('lsモジュールは現在無効化されています');
  });
});
