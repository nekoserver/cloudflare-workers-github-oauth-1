import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import app, { getOrComputeAnswerKeywordEmbedding, STATUS_MIGRATION_SQL } from './index';
import { createJWT } from './utils/jwt';
import { getAiChatPage } from './views/aichat';

const migration = readFileSync(new URL('../migrations/0167_create_aichat_keyword_registry.sql', import.meta.url), 'utf8');
const openDbs: DatabaseSync[] = [];
afterEach(() => { openDbs.splice(0).forEach(db => db.close()); });

function setupDb(migrate = true) {
  const db = new DatabaseSync(':memory:');
  openDbs.push(db);
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE ai_chat_shares (id TEXT PRIMARY KEY, user_id TEXT, model TEXT, created_at TEXT, deleted_at TEXT, source TEXT);
    CREATE TABLE aichat_answer_keyword_vectors (
      share_id TEXT, user_id TEXT, keyword TEXT, model TEXT, dim INTEGER, vector BLOB, computed_at TEXT,
      UNIQUE(user_id, share_id, keyword, model)
    );
    CREATE TABLE aichat_search_log (user_id TEXT, keyword TEXT, first_searched_at TEXT);
    CREATE TABLE aichat_keyword_embeddings (user_id TEXT, keyword TEXT, created_at TEXT);
    CREATE TABLE aichat_keyword_category_map (user_id TEXT, keyword TEXT, created_at TEXT);
    CREATE TABLE aichat_search_history (user_id TEXT, keyword TEXT, searched_at TEXT, deleted_at TEXT);
    CREATE TABLE user_sessions (user_id TEXT PRIMARY KEY, revoked_at TEXT, last_activity_at TEXT);
    INSERT INTO ai_chat_shares VALUES ('s1', 'u1', 'answer-model', '2026-10-07T00:00:00Z', NULL, 'textbox');
    INSERT INTO ai_chat_shares VALUES ('s2', 'u1', 'another-model', '2026-10-07T00:00:00Z', NULL, 'textbox');
  `);
  if (migrate) db.exec(migration);
  return db;
}

function insertKeyword(db: DatabaseSync, keyword: string, share = 's1', model = 'plamo', user = 'u1', at = '2026-10-07T12:00:00Z') {
  db.prepare(`INSERT INTO aichat_answer_keyword_vectors VALUES (?, ?, ?, ?, 2, X'00000000', ?)
    ON CONFLICT(user_id, share_id, keyword, model) DO UPDATE SET computed_at=excluded.computed_at`)
    .run(share, user, keyword, model, at);
}

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const statement = db.prepare(sql);
      const chain = (args: unknown[]) => ({
        bind: (...values: unknown[]) => chain(values.map(v => v instanceof ArrayBuffer ? new Uint8Array(v) : v)),
        async first() {
          const row = statement.get(...args as never[]) as Record<string, unknown> | undefined;
          if (row?.vector instanceof Uint8Array) row.vector = row.vector.buffer.slice(row.vector.byteOffset, row.vector.byteOffset + row.vector.byteLength);
          return row ?? null;
        },
        async all() { return { results: statement.all(...args as never[]) }; },
        async run() { return { success: true, meta: { changes: statement.run(...args as never[]).changes } }; },
      });
      return chain([]);
    },
  };
}

describe('キーワード初出台帳', () => {
  it('回答ベクトルの保存成功時だけ記録し、再抽出・別回答・別モデルでも初出を保つ', async () => {
    const db = setupDb();
    const ai = { run: vi.fn().mockResolvedValue({ data: [[1, 2]] }) };
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '東京駅');
    const first = db.prepare('SELECT * FROM aichat_keyword_registry').get();
    expect(first).toMatchObject({ user_id: 'u1', keyword: '東京駅', first_share_id: 's1', first_source: 'answer_extraction' });
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '東京駅');
    insertKeyword(db, '東京駅', 's2', 'bge');
    expect(db.prepare('SELECT * FROM aichat_keyword_registry').all()).toEqual([first]);
    ai.run.mockRejectedValue(new Error('embedding failed'));
    await expect(getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '失敗語')).rejects.toThrow();
    expect(db.prepare('SELECT COUNT(*) AS count FROM aichat_keyword_registry').get()).toEqual({ count: 1 });
    db.exec("DELETE FROM ai_chat_shares WHERE id='s1'");
    expect(db.prepare('SELECT first_share_id, first_added_at FROM aichat_keyword_registry').get()).toMatchObject({ first_share_id: null, first_added_at: first!.first_added_at });
  });

  it('ユーザー間を分離し、先に検索・埋め込み・分類で登録した語は新規切り出しに数えない', () => {
    const db = setupDb();
    for (const [table, source] of [['aichat_search_log', 'search'], ['aichat_keyword_embeddings', 'embedding'], ['aichat_keyword_category_map', 'classification']]) {
      db.prepare(`INSERT INTO ${table} VALUES ('u1', ?, '2026-10-01 12:00:00')`).run(source);
      insertKeyword(db, source);
      expect(db.prepare('SELECT first_source FROM aichat_keyword_registry WHERE keyword=?').get(source)).toEqual({ first_source: source });
    }
    insertKeyword(db, '共有語');
    insertKeyword(db, '共有語', 'other', 'plamo', 'u2');
    expect(db.prepare("SELECT user_id, first_share_id FROM aichat_keyword_registry WHERE keyword='共有語' ORDER BY user_id").all()).toEqual([
      { user_id: 'u1', first_share_id: 's1' }, { user_id: 'u2', first_share_id: null },
    ]);
  });

  it('既存語は最古の確認日時でlegacyとして取り込み、再適用・再抽出で増やさない', () => {
    const db = setupDb(false);
    db.exec(`INSERT INTO aichat_search_log VALUES ('u1', '既存語', '2026-09-01 00:00:00');
      INSERT INTO aichat_keyword_embeddings VALUES ('u1', '既存語', '2026-09-02T00:00:00Z');
      INSERT INTO aichat_keyword_category_map VALUES ('u1', '分類のみ', '2026-09-03T00:00:00Z');`);
    insertKeyword(db, '既存語');
    db.exec(migration);
    const rows = db.prepare('SELECT * FROM aichat_keyword_registry ORDER BY keyword').all();
    expect(rows).toContainEqual({ user_id: 'u1', keyword: '既存語', first_added_at: '2026-09-01T00:00:00.000Z', first_share_id: null, first_source: 'legacy' });
    db.exec(migration);
    insertKeyword(db, '既存語', 's2');
    expect(db.prepare('SELECT * FROM aichat_keyword_registry ORDER BY keyword').all()).toEqual(rows);
  });

  it('保存トランザクションが失敗した場合は初出記録もロールバックする', () => {
    const db = setupDb();
    db.exec('BEGIN');
    insertKeyword(db, 'ロールバック語');
    db.exec('ROLLBACK');
    expect(db.prepare('SELECT COUNT(*) AS count FROM aichat_keyword_registry').get()).toEqual({ count: 0 });
    expect(STATUS_MIGRATION_SQL['0167']).toBe(migration);
  });

  it('日次APIは初回追加月・ユーザーを絞り、検索していない日も返す', async () => {
    const db = setupDb();
    insertKeyword(db, '語1', 's1', 'plamo', 'u1', '2026-10-08T12:00:00Z');
    insertKeyword(db, '語2', 's1', 'plamo', 'u1', '2026-10-08T12:00:00Z');
    insertKeyword(db, '別ユーザー', 'none', 'plamo', 'u2');
    insertKeyword(db, '先月', 's1', 'plamo', 'u1', '2026-09-30T23:59:59Z');
    insertKeyword(db, '先月', 's2');
    const token = await createJWT({ sub: 'u1' }, 'secret');
    const response = await app.request('/api/aichat/daily-stats?month=2026-10', {
      headers: { Authorization: `Bearer ${token}` },
    }, { DB: wrapD1(db), JWT_SECRET: 'secret' });
    expect(response.status).toBe(200);
    const data = await response.json() as { days: Array<{ date: string; new_kw_count: number; kw_count: number }> };
    expect(data.days.find(day => day.date === '2026-10-08')).toMatchObject({ new_kw_count: 2, kw_count: 0 });
    expect(data.days.reduce((sum, day) => sum + day.new_kw_count, 0)).toBe(2);
  });

  it('日次モーダルに新規追加の月合計・日別件数と0件を表示する', () => {
    const html = getAiChatPage({ username: 'u1', aiChatModel: 'test-model', modelColors: {} });
    const start = html.indexOf('function buildNewKeywordStatsHtml');
    const end = html.indexOf('function renderDailyStatsChart', start);
    const render = new Function('escHtml', html.slice(start, end) + '; return buildNewKeywordStatsHtml;')((value: string) => value);
    const dom = new JSDOM(render([{ date: '2026-10-08', new_kw_count: 2 }, { date: '2026-10-09', new_kw_count: 1 }]));
    expect(dom.window.document.querySelector('section')?.textContent).toContain('新規切り出しキーワード数: 3語');
    expect(dom.window.document.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(render([])).toContain('この月の新規切り出しは0語です');
    dom.window.close();
  });
});
