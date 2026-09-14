/**
 * POST /api/cursor-agent/query-external のテスト
 *
 * 対象: dynamicnekoの新規「CursorOps」ページ(cursor cacheモジュール)がService
 * Binding経由で呼ぶ外部API。/neko csearch と同じ queryCursorAgentHistoryWithSearch
 * を使ってCursor VMキャッシュ(cursor_agent_launch_log/cursor_agent_answer_cache)を
 * 検索する。Bearer secret(AICHAT_EXTERNAL_SECRET)で認証した上、さらにD1の
 * dynamicneko_aichat_allowed_usersに登録されたメールアドレスかどうかを判定する
 * (AIに聞くウィジェットと同じ許可リストを共有する)。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1検索まで到達してしまう
 *   (3) keyword未指定・空文字でも検索が実行されてしまう
 *   (4) loginが渡らずuser_idスコープが特定できない(他ユーザーの履歴が漏れる)
 *   (5) D1未設定時にフェイルオープンする
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';

const SECRET = 'test-aichat-external-secret';

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
        bind(...innerArgs: unknown[]) {
          return makeChain(innerArgs);
        },
      });
      return makeChain([]);
    },
  };
}

function setupDb(allowedEmails: string[]): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE dynamicneko_aichat_allowed_users (email TEXT PRIMARY KEY);
    CREATE TABLE cursor_agent_launch_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      repo_full_name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      agent_id TEXT,
      agent_name TEXT,
      agent_url TEXT,
      cursor_response TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE cursor_agent_status_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      launch_id INTEGER NOT NULL REFERENCES cursor_agent_launch_log(id),
      agent_status TEXT,
      run_status TEXT,
      report_text TEXT,
      raw_response TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE cursor_agent_answer_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      launch_id INTEGER NOT NULL UNIQUE REFERENCES cursor_agent_launch_log(id),
      answer_text TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  for (const email of allowedEmails) {
    db.prepare(`INSERT INTO dynamicneko_aichat_allowed_users (email) VALUES (?)`).run(email);
  }
  return db;
}

const ALLOWED_REPO = 'nekoserver/cloudflare-workers-github-oauth-1';

function insertLaunch(db: DatabaseSync, userId: string, prompt: string, answerText: string | null): number {
  db.prepare(
    `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, cursor_response) VALUES (?, ?, ?, ?)`
  ).run(userId, ALLOWED_REPO, prompt, '{}');
  const launchId = Number((db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id);
  if (answerText !== null) {
    db.prepare(`INSERT INTO cursor_agent_status_log (launch_id, report_text, raw_response) VALUES (?, ?, ?)`).run(launchId, answerText, '{}');
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(launchId, answerText);
  }
  return launchId;
}

describe('POST /api/cursor-agent/query-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb(['ok@example.com']);
    const res = await app.request(
      '/api/cursor-agent/query-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', login: 'nekoserver', keyword: 'foo' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('未許可メールアドレスは403で拒否され、D1検索は実行されない', async () => {
    const db = setupDb(['ok@example.com']);
    insertLaunch(db, 'nekoserver', 'デプロイ手順を教えて', 'デプロイはwranglerで行います');
    const res = await app.request(
      '/api/cursor-agent/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ng@example.com', login: 'nekoserver', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('許可');
  });

  it('keywordが空の場合は400', async () => {
    const db = setupDb(['ok@example.com']);
    const res = await app.request(
      '/api/cursor-agent/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', login: 'nekoserver', keyword: '  ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(400);
  });

  it('loginが無い場合は400', async () => {
    const db = setupDb(['ok@example.com']);
    const res = await app.request(
      '/api/cursor-agent/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(400);
  });

  it('許可済みメールアドレスは自分(login一致)のキャッシュ済み回答だけを検索して返す', async () => {
    const db = setupDb(['ok@example.com']);
    insertLaunch(db, 'nekoserver', 'デプロイ手順を教えて', 'デプロイはwranglerで行います');
    insertLaunch(db, 'other-user', 'デプロイ方法は?', '他人の回答は見えないはず');
    const res = await app.request(
      '/api/cursor-agent/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', login: 'nekoserver', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { rows: Array<{ question: string; id: number; createdAtJst: string; answer: string | null }> };
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].question).toBe('デプロイ手順を教えて');
    expect(body.rows[0].answer).toBe('デプロイはwranglerで行います');
  });

  it('回答キャッシュ(cursor_agent_answer_cache)と状態ログのreport_textが異なる場合、AIチャットの/neko csearchモーダルと同じくキャッシュ側を優先して返す', async () => {
    const db = setupDb(['ok@example.com']);
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, cursor_response) VALUES (?, ?, ?, ?)`
    ).run('nekoserver', ALLOWED_REPO, 'デプロイ手順を教えて', '{}');
    const launchId = Number((db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id);
    db.prepare(`INSERT INTO cursor_agent_status_log (launch_id, report_text, raw_response) VALUES (?, ?, ?)`).run(
      launchId, '(自動検出の短い要約)', '{}'
    );
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(
      launchId, '会話APIから取得した回答全文です'
    );
    const res = await app.request(
      '/api/cursor-agent/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', login: 'nekoserver', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { rows: Array<{ answer: string | null }> };
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].answer).toBe('会話APIから取得した回答全文です');
  });

  it('ヒットしないキーワードは空配列を返す(握りつぶさずsearchErrorはnull)', async () => {
    const db = setupDb(['ok@example.com']);
    insertLaunch(db, 'nekoserver', 'デプロイ手順を教えて', 'デプロイはwranglerで行います');
    const res = await app.request(
      '/api/cursor-agent/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', login: 'nekoserver', keyword: '存在しないキーワード' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { rows: unknown[]; searchError?: string | null };
    expect(body.rows).toHaveLength(0);
  });

  it('DB未設定時はフェイルクローズで503を返す', async () => {
    const res = await app.request(
      '/api/cursor-agent/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', login: 'nekoserver', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET }
    );
    expect(res.status).toBe(503);
  });
});
