import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

// 対象: POST /api/kimi-code/markdown-snippets, GET /kimi-code/markdown,
// GET /kimi-code/markdown/:id。kimi-codeの生成結果を(言語を問わず)Markdown
// として保存し、後から閲覧できるようにする一連のルート。
// ruby_wasm_snippets(POST /api/ruby-wasm/snippets)と異なり、Rubyかどうかの
// 判定ゲートは無く常に保存できる。
//
// 故障シナリオ:
//   (1) Ruby以外のコードが保存できてしまわない、という誤った制限が
//       紛れ込んでいないか(このAPIは言語を問わず保存できるのが仕様)
//   (2) 他ユーザーが保存したMarkdownを閲覧できてしまう
//   (3) 一覧ページが自分のもの以外を表示してしまう
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
    CREATE TABLE kimi_code_markdown_snippets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      markdown TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE user_sessions (
      user_id TEXT PRIMARY KEY,
      revoked_at TEXT,
      last_activity_at TEXT
    );
  `);
  db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('user1');
  db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('other-user');
  return db;
}

const TS_CODE = 'export default { fetch() { return new Response("hi"); } };';
const RUBY_CODE = 'def greet\n  puts "hi"\nend';

describe('POST /api/kimi-code/markdown-snippets', () => {
  it('Ruby以外のコードでも(言語問わず)保存できる', async () => {
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/kimi-code/markdown-snippets', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: TS_CODE, prompt: 'Worker fetchハンドラを書いて' }),
    }, { JWT_SECRET, DB: wrapD1(db) });

    expect(res.status).toBe(200);
    const data = await res.json() as { id: string; title: string };
    expect(typeof data.id).toBe('string');

    const row = db.prepare('SELECT user_id, prompt, markdown FROM kimi_code_markdown_snippets WHERE id = ?').get(data.id) as
      { user_id: string; prompt: string; markdown: string };
    expect(row.user_id).toBe('user1');
    expect(row.prompt).toBe('Worker fetchハンドラを書いて');
    expect(row.markdown).toContain('```');
    expect(row.markdown).toContain(TS_CODE);
  });

  it('Rubyコードも保存でき、markdownは```rubyでラップされる', async () => {
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/kimi-code/markdown-snippets', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: RUBY_CODE }),
    }, { JWT_SECRET, DB: wrapD1(db) });

    const data = await res.json() as { id: string };
    const row = db.prepare('SELECT markdown FROM kimi_code_markdown_snippets WHERE id = ?').get(data.id) as { markdown: string };
    expect(row.markdown).toBe('```ruby\n' + RUBY_CODE + '\n```');
  });

  it('codeが空の場合は400を返す', async () => {
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/kimi-code/markdown-snippets', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '   ' }),
    }, { JWT_SECRET, DB: wrapD1(db) });

    expect(res.status).toBe(400);
  });

  it('DB未設定の場合は503を返す', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/kimi-code/markdown-snippets', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: TS_CODE }),
    }, { JWT_SECRET });

    expect(res.status).toBe(503);
  });
});

describe('GET /kimi-code/markdown', () => {
  it('自分が保存したMarkdownのみを一覧に表示する', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO kimi_code_markdown_snippets (id, user_id, title, prompt, markdown) VALUES (?, ?, ?, ?, ?)`
    ).run('m1', 'user1', '自分の分', 'p', '```\nx\n```');
    db.prepare(
      `INSERT INTO kimi_code_markdown_snippets (id, user_id, title, prompt, markdown) VALUES (?, ?, ?, ?, ?)`
    ).run('m2', 'other-user', '他人の分', 'p', '```\nx\n```');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/kimi-code/markdown', {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db) });

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('自分の分');
    expect(html).not.toContain('他人の分');
  });
});

describe('GET /kimi-code/markdown/:id', () => {
  it('自分のMarkdownは閲覧できる', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO kimi_code_markdown_snippets (id, user_id, title, prompt, markdown) VALUES (?, ?, ?, ?, ?)`
    ).run('m1', 'user1', 'あいさつ', 'p', '```ruby\n' + RUBY_CODE + '\n```');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/kimi-code/markdown/m1', {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db) });

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('あいさつ');
    expect(html).toContain('data-run-ruby-block="0"');
  });

  it('他ユーザーのMarkdownは404を返す', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO kimi_code_markdown_snippets (id, user_id, title, prompt, markdown) VALUES (?, ?, ?, ?, ?)`
    ).run('m1', 'other-user', 'あいさつ', 'p', '```\nx\n```');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/kimi-code/markdown/m1', {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db) });

    expect(res.status).toBe(404);
  });
});
