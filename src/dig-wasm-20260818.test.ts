/**
 * `/neko dig` (dig(1)風DNS問い合わせ, Rust/WASM) の統合テスト。
 *
 * 対象: AIチャットの `/neko dig` サブコマンド。DNSワイヤーフォーマットの
 * 問い合わせパケット組み立て・応答パケット解析はRust/WASM(wasm/dig-wasm)で
 * 行い、実際のDNS問い合わせ自体はCloudflare DNS over HTTPSへのfetchで行う
 * (Workersからは生のUDP:53ソケットが使えないため)。
 *
 * 故障シナリオ:
 *   (1) /neko digがsha256/factorと同様のdynamic import配線を欠き、
 *       index.tsの静的importになって.wasmインポートがVite/vitest環境で
 *       WebAssembly.Moduleを返さず、既存の全テストが壊れる
 *   (2) digモジュールが/wasm-modulesページで無効化されているのに実行されてしまう
 *   (3) --help時にもDNS問い合わせを実行してしまう(ネットワークI/Oが不要な
 *       はずのヘルプ表示で外部通信が発生する)
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
  const prepareCalls: string[] = [];
  const db = {
    prepare: (sql: string) => {
      prepareCalls.push(sql);
      return {
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
      };
    },
  };
  return { db, prepareCalls };
}

describe('POST /api/aichat: /neko dig サーバー配線', () => {
  it('index.ts の /api/aichat が digLookup を渡す（dynamic importで読み込む）', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.post('/api/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 6200);
    expect(fn).toContain('digLookup:');
    expect(fn).toContain("await import('./utils/digWasmServer')");
  });

  it('digモジュールが無効化されている場合、/neko digはエラーメッセージを返し実行しない', async () => {
    const authHeader = await makeAuthHeader();
    const disabledRow = { module_id: 'dig', enabled: 0, updated_at: '2026-08-18 00:00:00', updated_by: 'admin' };
    const { db } = createMockDb([disabledRow]);
    const res = await app.request(
      '/api/aichat',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '/neko dig example.com' }),
      },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response?: string };
    expect(body.response).toContain('digモジュールは現在無効化されています');
  });

  it('/neko dig --help はwasm_module_startup_configへの問い合わせもfetchも行わずヘルプ文言を返す', async () => {
    const authHeader = await makeAuthHeader();
    const { db, prepareCalls } = createMockDb([]);
    const res = await app.request(
      '/api/aichat',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '/neko dig --help' }),
      },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response?: string };
    expect(body.response).toContain('/neko dig ヘルプ');
    expect(body.response).toContain('対応レコードタイプ');
    expect(prepareCalls.some((sql) => sql.includes('wasm_module_startup_config'))).toBe(false);
  });
});
