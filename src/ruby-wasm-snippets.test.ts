import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app, { deriveRubySnippetTitle } from './index';
import { createJWT } from './utils/jwt';

// 対象: POST/GET /api/ruby-wasm/snippets, GET /api/ruby-wasm/snippets/:id。
// /kimi-codeページの「コードを保管」ボタンで、生成されたコードがRubyだった
// 場合にruby_wasm_snippetsへ保存し、/ruby-wasmページから一覧取得・読み込んで
// 実行できるようにする一連のAPI。
//
// 故障シナリオ:
//   (1) Rubyでないコード(TypeScript等)を誤って保存してしまう
//   (2) 他ユーザーが保存したスニペットのコード本文を取得できてしまう
//   (3) titleが指定されなかった場合に空文字のまま保存されて一覧が読みにくくなる
//   (4) DB未設定の環境で例外を投げてWorkerごと落ちる

const JWT_SECRET = 'test-secret';

async function makeAuthHeader(sub: string) {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      const makeChain = (args: unknown[]) => ({
        async first<T>(): Promise<T | null> {
          const row = stmt.get(...(args as never[]));
          return (row ?? null) as T | null;
        },
        async all<T>(): Promise<{ results?: T[] }> {
          const rows = stmt.all(...(args as never[])) as unknown[];
          return { results: rows as T[] };
        },
        async run(): Promise<{ meta: { changes: number } }> {
          const res = stmt.run(...(args as never[]));
          return { meta: { changes: Number(res.changes) } };
        },
        bind(...innerArgs: unknown[]) {
          return makeChain(innerArgs);
        },
      });
      return makeChain([]);
    },
  };
}

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE ruby_wasm_snippets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      code TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'kimi-code',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE user_sessions (
      user_id TEXT PRIMARY KEY,
      revoked_at TEXT,
      last_activity_at TEXT
    );
  `);
  // authMiddlewareはBearerトークン利用時、c.env.DBがあればuser_sessions.revoked_at
  // を必ず確認する(revoke済みセッションの再利用を防ぐため)。テストで使う
  // user1・other-userの行を用意しておかないと、テーブルは存在してもユーザーの
  // 行が無いだけで通過してしまう(revoked_atがNULLの行が無い=未登録ユーザーの
  // 場合、rowがnullなのでrevokedチェックはスキップされ通過する実装のため、
  // ここでの事前挿入は必須ではないが、実運用の状態を再現するため行っておく)。
  db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('user1');
  db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('other-user');
  return db;
}

const RUBY_CODE = [
  'def greet(name)',
  '  puts "Hello, #{name}!"',
  'end',
].join('\n');

const TS_CODE = [
  'export default {',
  '  fetch(request: Request): Response {',
  '    return new Response("hi");',
  '  },',
  '};',
].join('\n');

describe('deriveRubySnippetTitle', () => {
  it('コード先頭の空でない行を40文字まで切り詰めてtitleにする', () => {
    expect(deriveRubySnippetTitle('def greet(name)\n  puts name\nend')).toBe('def greet(name)');
  });

  it('先頭が空行の場合は最初の空でない行を使う', () => {
    expect(deriveRubySnippetTitle('\n\n  puts "hi"\n')).toBe('puts "hi"');
  });

  it('コードが空文字列の場合は既定のタイトルを返す', () => {
    expect(deriveRubySnippetTitle('')).toBe('無題のRubyコード');
  });
});

describe('POST /api/ruby-wasm/snippets', () => {
  it('Rubyコードと判定できれば保存し、idとtitleを返す', async () => {
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/ruby-wasm/snippets', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: RUBY_CODE }),
    }, { JWT_SECRET, DB: wrapD1(db) });

    expect(res.status).toBe(200);
    const data = await res.json() as { id: string; title: string };
    expect(typeof data.id).toBe('string');
    expect(data.title).toBe('def greet(name)');

    const row = db.prepare('SELECT user_id, code, source FROM ruby_wasm_snippets WHERE id = ?').get(data.id) as
      { user_id: string; code: string; source: string };
    expect(row.user_id).toBe('user1');
    expect(row.code).toBe(RUBY_CODE);
    expect(row.source).toBe('kimi-code');
  });

  it('タイトルを指定すればそれを使う', async () => {
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/ruby-wasm/snippets', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: RUBY_CODE, title: 'あいさつスクリプト' }),
    }, { JWT_SECRET, DB: wrapD1(db) });

    const data = await res.json() as { title: string };
    expect(data.title).toBe('あいさつスクリプト');
  });

  it('Rubyコードと判定できない場合は422を返し、保存しない(誤ったデータを書き込まない)', async () => {
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/ruby-wasm/snippets', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: TS_CODE }),
    }, { JWT_SECRET, DB: wrapD1(db) });

    expect(res.status).toBe(422);
    const data = await res.json() as { error: string };
    expect(data.error).toContain('Ruby');
    const count = (db.prepare('SELECT COUNT(*) as c FROM ruby_wasm_snippets').get() as { c: number }).c;
    expect(count).toBe(0);
  });

  it('codeが空の場合は400を返す', async () => {
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/ruby-wasm/snippets', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '   ' }),
    }, { JWT_SECRET, DB: wrapD1(db) });

    expect(res.status).toBe(400);
  });

  it('DB未設定の場合は503を返す', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/ruby-wasm/snippets', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: RUBY_CODE }),
    }, { JWT_SECRET });

    expect(res.status).toBe(503);
  });
});

describe('GET /api/ruby-wasm/snippets', () => {
  it('自分が保存したスニペットのみを新しい順で返す(コード本文は含めない)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ruby_wasm_snippets (id, user_id, title, code, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run('s1', 'user1', '1件目', RUBY_CODE, '2026-01-01 00:00:00');
    db.prepare(
      `INSERT INTO ruby_wasm_snippets (id, user_id, title, code, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run('s2', 'user1', '2件目', RUBY_CODE, '2026-01-02 00:00:00');
    db.prepare(
      `INSERT INTO ruby_wasm_snippets (id, user_id, title, code, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run('s3', 'other-user', '他人の分', RUBY_CODE, '2026-01-03 00:00:00');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/ruby-wasm/snippets', {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db) });

    expect(res.status).toBe(200);
    const data = await res.json() as { snippets: { id: string; title: string; code?: string }[] };
    expect(data.snippets.map((s) => s.id)).toEqual(['s2', 's1']);
    expect(data.snippets[0].code).toBeUndefined();
  });
});

describe('GET /api/ruby-wasm/snippets/:id', () => {
  it('自分のスニペットはコード本文込みで取得できる', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ruby_wasm_snippets (id, user_id, title, code) VALUES (?, ?, ?, ?)`
    ).run('s1', 'user1', 'あいさつ', RUBY_CODE);

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/ruby-wasm/snippets/s1', {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db) });

    expect(res.status).toBe(200);
    const data = await res.json() as { code: string };
    expect(data.code).toBe(RUBY_CODE);
  });

  it('他ユーザーのスニペットは404を返す(コード本文が漏れない)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ruby_wasm_snippets (id, user_id, title, code) VALUES (?, ?, ?, ?)`
    ).run('s1', 'other-user', 'あいさつ', RUBY_CODE);

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/ruby-wasm/snippets/s1', {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db) });

    expect(res.status).toBe(404);
  });
});
