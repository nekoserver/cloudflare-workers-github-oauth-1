import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

/**
 * 対象: GET /keyword-stats(🔑 コミット要約キーワード統計ページ)。
 * ai_summary_keywordsの総数・リポジトリ別分布・頻出キーワードランキングを
 * ざっくり把握するためのページ。
 *
 * 故障シナリオ:
 *   (1) 未認証は401
 *   (2) ai_summary_keywordsが0件でも例外にならず「まだありません」表示になる
 *   (3) リポジトリ別件数が正しく集計され、多い順に並ぶ
 *   (4) 頻出キーワードが出現回数順に並ぶ
 *   (5) ai_summary_filesが0件でも例外にならず「まだありません」表示になる
 *   (6) 処理済みファイル総数・リポジトリ別ファイル件数が正しく集計される
 *   (7) ファイルタイプ別のキーワード分布が正しく集計される(同じ要約内の
 *       キーワード×ファイルの組み合わせを数える)
 */
const JWT_SECRET = 'test-secret';

async function authHeader(sub = 'test-user') {
  return `Bearer ${await createJWT({ sub, name: 'Test' }, JWT_SECRET)}`;
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
    CREATE TABLE user_sessions (
      user_id TEXT PRIMARY KEY,
      last_activity_at TEXT,
      revoked_at TEXT,
      idle_timeout_seconds INTEGER
    );
    CREATE TABLE ai_summary_log (id INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT, repo_full_name TEXT);
    CREATE TABLE ai_summary_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary_log_id INTEGER NOT NULL,
      keyword TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE ai_summary_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary_log_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_ext TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

async function getPage(db: DatabaseSync) {
  return app.request('/keyword-stats', { headers: { Authorization: await authHeader() } }, { JWT_SECRET, DB: wrapD1(db) });
}

describe('GET /keyword-stats', () => {
  it('未認証は401', async () => {
    const db = setupDb();
    const res = await app.request('/keyword-stats', {}, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(401);
  });

  it('キーワードが0件でも例外にならず「まだありません」と表示する', async () => {
    const db = setupDb();
    const res = await getPage(db);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('キーワードはまだありません');
    expect(html).toContain('>0<');
  });

  it('ai_summary_filesが0件でも例外にならず「まだありません」と表示する', async () => {
    const db = setupDb();
    const res = await getPage(db);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('処理済みファイルはまだありません');
    expect(html).toContain('ファイルタイプ別の分布はまだありません');
    expect(html).toContain('処理済みファイル総数');
  });

  it('処理済みファイル総数・リポジトリ別のファイル件数が正しく集計される', async () => {
    const db = setupDb();
    db.exec(`
      INSERT INTO ai_summary_log (id, request_id, repo_full_name) VALUES
        (1, 'r1', 'nekoserver/rails-root'),
        (2, 'r2', 'nekoserver/dynamicneko');
      INSERT INTO ai_summary_files (summary_log_id, file_path, file_ext) VALUES
        (1, 'app/models/user.rb', 'rb'),
        (2, 'src/index.ts', 'ts'),
        (2, 'src/style.css', 'css');
    `);
    const res = await getPage(db);
    expect(res.status).toBe(200);
    const html = await res.text();
    // 処理済みファイル総数は3件
    expect(html).toContain('>3<');
    const dynamicnekoIdx = html.indexOf('nekoserver/dynamicneko');
    const railsRootIdx = html.indexOf('nekoserver/rails-root');
    expect(dynamicnekoIdx).toBeGreaterThan(-1);
    expect(railsRootIdx).toBeGreaterThan(-1);
    expect(dynamicnekoIdx).toBeLessThan(railsRootIdx);
  });

  it('ファイルタイプ別のキーワード分布が、同じ要約内のキーワード×ファイルの組み合わせで集計される', async () => {
    const db = setupDb();
    db.exec(`
      INSERT INTO ai_summary_log (id, request_id, repo_full_name) VALUES (1, 'r1', 'nekoserver/rails-root');
      INSERT INTO ai_summary_keywords (summary_log_id, keyword) VALUES
        (1, 'キャッシュ'),
        (1, '認証トークン');
      INSERT INTO ai_summary_files (summary_log_id, file_path, file_ext) VALUES
        (1, 'src/a.ts', 'ts'),
        (1, 'src/b.ts', 'ts'),
        (1, 'style.css', 'css');
    `);
    const res = await getPage(db);
    expect(res.status).toBe(200);
    const html = await res.text();
    // ts: キーワード2件 x ファイル2件 = 4件、css: キーワード2件 x ファイル1件 = 2件
    const tsIdx = html.indexOf('.ts');
    const cssIdx = html.indexOf('.css');
    expect(tsIdx).toBeGreaterThan(-1);
    expect(cssIdx).toBeGreaterThan(-1);
    expect(tsIdx).toBeLessThan(cssIdx);
    expect(html).toContain('>4<');
    expect(html).toContain('>2<');
  });

  it('キーワードが一切抽出されなかった拡張子(.md/.erb/.css等)も、ファイルとして処理済みなら表に出る(2026-10-11、ユーザー指摘の再発防止)', async () => {
    const db = setupDb();
    // まだキーワードが一件も抽出されていない要約(どんな理由であれ、
    // ai_summary_keywordsに行が無い状態)を模す。以前はai_summary_keywordsとの
    // JOINのみで集計していたため、このケースの拡張子が表に一切現れなかった。
    db.exec(`
      INSERT INTO ai_summary_log (id, request_id, repo_full_name) VALUES (1, 'r1', 'nekoserver/rails-root');
      INSERT INTO ai_summary_files (summary_log_id, file_path, file_ext) VALUES
        (1, 'README.md', 'md'),
        (1, 'app/views/users/show.html.erb', 'erb'),
        (1, 'app/assets/style.css', 'css');
    `);
    const res = await getPage(db);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('.md');
    expect(html).toContain('.erb');
    expect(html).toContain('.css');
    expect(html).not.toContain('ファイルタイプ別の分布はまだありません');
  });

  it('リポジトリ別の集計が件数の多い順に並ぶ', async () => {
    const db = setupDb();
    db.exec(`
      INSERT INTO ai_summary_log (id, request_id, repo_full_name) VALUES
        (1, 'r1', 'nekoserver/rails-root'),
        (2, 'r2', 'nekoserver/dynamicneko'),
        (3, 'r3', 'nekoserver/dynamicneko');
      INSERT INTO ai_summary_keywords (summary_log_id, keyword) VALUES
        (1, 'ログイン機能'),
        (2, 'キャッシュ'),
        (2, '認証トークン'),
        (3, 'キャッシュ');
    `);
    const res = await getPage(db);
    expect(res.status).toBe(200);
    const html = await res.text();
    const dynamicnekoIdx = html.indexOf('nekoserver/dynamicneko');
    const railsRootIdx = html.indexOf('nekoserver/rails-root');
    expect(dynamicnekoIdx).toBeGreaterThan(-1);
    expect(railsRootIdx).toBeGreaterThan(-1);
    expect(dynamicnekoIdx).toBeLessThan(railsRootIdx);
  });

  it('頻出キーワードが出現回数順に並ぶ', async () => {
    const db = setupDb();
    db.exec(`
      INSERT INTO ai_summary_log (id, request_id, repo_full_name) VALUES (1, 'r1', 'nekoserver/rails-root');
      INSERT INTO ai_summary_keywords (summary_log_id, keyword) VALUES
        (1, 'キャッシュ'),
        (1, 'キャッシュ'),
        (1, 'キャッシュ'),
        (1, '認証トークン'),
        (1, '認証トークン');
    `);
    const res = await getPage(db);
    expect(res.status).toBe(200);
    const html = await res.text();
    const cacheIdx = html.indexOf('キャッシュ');
    const authIdx = html.indexOf('認証トークン');
    expect(cacheIdx).toBeGreaterThan(-1);
    expect(authIdx).toBeGreaterThan(-1);
    expect(cacheIdx).toBeLessThan(authIdx);
  });
});
