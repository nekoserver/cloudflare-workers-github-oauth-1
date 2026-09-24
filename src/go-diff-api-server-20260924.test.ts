/**
 * POST /api/diff (go-diff-wasmのサーバー実行、src/utils/goDiffWasmServer.ts) の統合テスト。
 *
 * 対象: go-diff-wasm(Rust製ではなくGo標準のwasm_exec.jsで動く)をCloudflare
 * Workers上でサーバー実行するエンドポイント。ブラウザページ(/go-diff-wasm)と
 * 違い、`go.run(instance)`が返すPromiseを待たずにグローバル関数(goDiffText)を
 * 呼び出す必要があるため(main()がselect{}で無限ブロックするため)、
 * main_js.go側の`__goDiffWasmReady`合図を使ったハンドシェイクが正しく
 * 機能することを実際にWASMを実行して検証する(モックではなく実バイナリ)。
 *
 * 故障シナリオ:
 *   (1) go.run()をawaitしてしまい、リクエストが永久にハングする
 *   (2) __goDiffWasmReadyのハンドシェイクが機能せず、goDiffTextがまだ
 *       登録されていないタイミングで呼び出してエラーになる
 *   (3) go-diffモジュールが/wasm-modulesページで無効化されているのに実行されてしまう
 *   (4) a・bが未指定/文字列でない場合にエラーを返さず握りつぶす
 *   (5) APIキー(nkapi_...)経由の外部呼び出しがセッションCookieと同様に動作しない
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// VitestのWASM静的import解析(Vite/Rolldownの`.wasm`ESM統合)は、バイナリの
// import section に宣言された名前空間("gojs" = Goのsyscall/js ABI)を
// 実npmパッケージとして自動解決・自動instantiateしようとし、
// go-diff-wasm/gron-wasmのような「呼び出し元が独自のimportObjectを渡す
// 前提」のGo/js-wasmバイナリでは`LinkError`になる(Cannot find package 'gojs'、
// またはfunction import requires a callable)。Cloudflare Workers本番ビルド
// (Wrangler/esbuild)はこの自動解決を行わず`.wasm`を素のWebAssembly.Module
// として渡すため実運用では問題にならないが、テストではこの自動統合を
// 迂回する必要がある。`src/utils/goDiffWasmServer.ts`が読み込む`.wasm`
// importだけをNode標準の`WebAssembly.compile`へ差し替える
// (ロジック自体はモックせず、実バイナリをNodeネイティブAPIでコンパイルする)。
vi.mock('../public/wasm/go-diff.wasm', async () => {
  const bytes = readFileSync(resolve(__dirname, '../public/wasm/go-diff.wasm'));
  const wasmModule = await WebAssembly.compile(bytes);
  return { default: wasmModule };
});

import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(wasmConfigRows: Record<string, unknown>[] = [], apiKeyRow: Record<string, unknown> | null = null) {
  return {
    prepare: (sql: string) => ({
      bind: () => ({
        first: () => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          if (sql.includes('wasm_module_startup_config')) {
            return Promise.resolve(wasmConfigRows[0] ?? null);
          }
          if (sql.includes('FROM api_keys')) {
            return Promise.resolve(apiKeyRow);
          }
          return Promise.resolve(null);
        },
        all: () => Promise.resolve({ results: [] }),
        run: () => Promise.resolve({ success: true }),
      }),
    }),
  };
}

describe('POST /api/diff: go-diff-wasmのサーバー配線', () => {
  it('index.ts の /api/diff が aichatAuthMiddleware・goDiffWasmServer をdynamic importで使う', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');
    expect(src).toContain("app.post('/api/diff', aichatAuthMiddleware, async (c) => {");
    const idx = src.indexOf("app.post('/api/diff'");
    const fn = src.slice(idx, idx + 2000);
    expect(fn).toContain("await import('./utils/goDiffWasmServer')");
  });

  it('セッションCookie(JWT)で認証し、実際にWASMを実行して差分Markdownを返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/diff',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: 'line one\nline two\n', b: 'line one\nline two (edited)\n' }),
      },
      { JWT_SECRET, DB: createMockDb() }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { markdown?: string };
    expect(body.markdown).toContain('1行追加, 1行削除');
    expect(body.markdown).toContain('- line two');
    expect(body.markdown).toContain('+ line two (edited)');
  });

  it('APIキー(nkapi_...)でも外部から呼び出せる', async () => {
    const apiKeyRow = { id: 'key-1', user_id: 'ext-user', label: 'test', expires_at: null, revoked_at: null };
    const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as ExecutionContext;
    const res = await app.request(
      '/api/diff',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer nkapi_test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: 'a\n', b: 'b\n' }),
      },
      { JWT_SECRET, DB: createMockDb([], apiKeyRow) },
      executionCtx
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { markdown?: string };
    expect(body.markdown).toContain('1行追加, 1行削除');
  });

  it('同一リクエストの2回目の呼び出しでも正しく動作する(ハンドシェイクが1回だけ初期化される)', async () => {
    const authHeader = await makeAuthHeader();
    for (const [a, b] of [
      ['x\n', 'y\n'],
      ['p\nq\n', 'p\nq\nr\n'],
    ]) {
      const res = await app.request(
        '/api/diff',
        {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ a, b }),
        },
        { JWT_SECRET, DB: createMockDb() }
      );
      expect(res.status).toBe(200);
    }
  });

  it('未認証の場合は401を返す', async () => {
    const res = await app.request(
      '/api/diff',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'a', b: 'b' }) },
      { JWT_SECRET, DB: createMockDb() }
    );
    expect(res.status).toBe(401);
  });

  it('a・bが未指定の場合は400を返す(握りつぶさない)', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/diff',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: 'only-a' }),
      },
      { JWT_SECRET, DB: createMockDb() }
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('a・bはどちらも文字列で指定してください');
  });

  it('go-diffモジュールが無効化されている場合、実行せず503を返す', async () => {
    const authHeader = await makeAuthHeader();
    const disabledRow = { module_id: 'go-diff', enabled: 0, updated_at: '2026-09-24 00:00:00', updated_by: 'admin' };
    const res = await app.request(
      '/api/diff',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: 'a\n', b: 'b\n' }),
      },
      { JWT_SECRET, DB: createMockDb([disabledRow]) }
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('go-diffモジュールは現在無効化されています');
  });
});
