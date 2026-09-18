/**
 * 対象: /jev-score-board ページと、その3つのJSON API
 * (/api/jev-score-board/rows, /api/jev-score-board/top-by-label,
 * /api/jev-score-board/answer)。
 *
 * 背景: /neko jスラッシュコマンドとは独立した専用ページとして、質問ID
 * (share)1件=1行・jev_label_id=1〜20(ループA)を横列に並べる一覧を提供する。
 * ラベル列(th)タップで表示中の20件に限らず全データから上位20件を再取得し、
 * 質問IDタップで質問文+回答文をモーダル用に返す。
 *
 * 故障シナリオ:
 *   (1) 未認証はすべて401
 *   (2) keyword未指定でも評価済みshareが最新順に最大20件返る(21件目は含まれない)
 *   (3) keyword指定でquestion/answer部分一致が効く、他ユーザーは混ざらない
 *   (4) 論理削除済みshareは全エンドポイントから除外される
 *   (5) top-by-labelが表示中の20件に含まれないshareでもスコアが高ければ
 *       上位に出てくる(「全データから再取得」であることの証明)
 *   (6) top-by-labelのlabelIdが範囲外(0, 21, 非数値)は400
 *   (7) answerエンドポイントは他ユーザーのshareIdでは404
 *   (8) 応答HTMLにXSSペイロードを含む質問文を入れてもエスケープされる
 *   (9) getThemeCSS()の戻り値(生のCSSテキスト)を<style>タグで囲まずに
 *       <head>直下へ埋め込んでしまい、CSS変数定義が生テキストとして
 *       画面に表示されてしまう(実際に発生した回帰)
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader(sub = 'test-user') {
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
    CREATE TABLE user_sessions (
      user_id TEXT PRIMARY KEY,
      last_activity_at TEXT,
      revoked_at TEXT,
      idle_timeout_seconds INTEGER
    );
    CREATE TABLE ai_chat_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_hash TEXT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      model TEXT,
      created_at TEXT,
      access_count INTEGER DEFAULT 0,
      question_hash TEXT,
      image_id TEXT,
      image_data_url TEXT,
      deleted_at TEXT
    );
    CREATE TABLE jev_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      share_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      model TEXT,
      jev_label_id INTEGER NOT NULL,
      value REAL NOT NULL
    );
  `);
  db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('test-user', datetime('now'), NULL)`).run();
  return db;
}

function insertShare(db: DatabaseSync, id: string, userId: string, question: string, answer: string, model: string, secondsOffset: number, deleted = false) {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?), ?)`
  ).run(id, userId, question, answer, model, `+${secondsOffset} seconds`, deleted ? new Date().toISOString() : null);
}

function insertEval(db: DatabaseSync, shareId: string, userId: string, model: string, labelId: number, value: number, targetType = 'answer') {
  db.prepare(
    `INSERT INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(targetType, shareId, userId, model, labelId, value);
}

async function getPage(db: DatabaseSync, keyword?: string, sub = 'test-user'): Promise<Response> {
  const authHeader = await makeAuthHeader(sub);
  const url = '/jev-score-board' + (keyword !== undefined ? '?keyword=' + encodeURIComponent(keyword) : '');
  return app.request(url, { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: wrapD1(db) });
}

async function getRows(db: DatabaseSync, keyword: string, sub = 'test-user'): Promise<Response> {
  const authHeader = await makeAuthHeader(sub);
  return app.request(`/api/jev-score-board/rows?keyword=${encodeURIComponent(keyword)}`, { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: wrapD1(db) });
}

async function getTopByLabel(db: DatabaseSync, labelId: string, sub = 'test-user'): Promise<Response> {
  const authHeader = await makeAuthHeader(sub);
  return app.request(`/api/jev-score-board/top-by-label?labelId=${encodeURIComponent(labelId)}`, { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: wrapD1(db) });
}

async function getAnswer(db: DatabaseSync, shareId: string, sub = 'test-user'): Promise<Response> {
  const authHeader = await makeAuthHeader(sub);
  return app.request(`/api/jev-score-board/answer?shareId=${encodeURIComponent(shareId)}`, { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: wrapD1(db) });
}

describe('GET /jev-score-board, /api/jev-score-board/*: 未認証は401', () => {
  it('ページ・rows・top-by-label・answerすべて未認証だと401', async () => {
    const db = setupDb();
    const noAuth = { JWT_SECRET, DB: wrapD1(db) };
    expect((await app.request('/jev-score-board', {}, noAuth)).status).toBe(401);
    expect((await app.request('/api/jev-score-board/rows?keyword=x', {}, noAuth)).status).toBe(401);
    expect((await app.request('/api/jev-score-board/top-by-label?labelId=1', {}, noAuth)).status).toBe(401);
    expect((await app.request('/api/jev-score-board/answer?shareId=s1', {}, noAuth)).status).toBe(401);
  });
});

describe('GET /jev-score-board: keyword未指定時の初期表示', () => {
  it('評価済みshareを最新順に最大20件表示し、21件目は含めない', async () => {
    const db = setupDb();
    for (let i = 1; i <= 21; i++) {
      insertShare(db, `s${i}`, 'test-user', `質問その${i}`, '回答', 'gemma', i);
      insertEval(db, `s${i}`, 'test-user', 'gemma', 1, 0.5);
    }
    const res = await getPage(db);
    expect(res.status).toBe(200);
    const html = await res.text();
    // 最新(オフセット最大=s21)が含まれ、最も古い(s1)は上限からあふれて含まれない
    expect(html).toContain('s21');
    expect(html).not.toContain('data-share-id="s1"');
    expect(html).toContain('先頭20件のみ表示。全21件');
  });

  it('評価データが無ければ0件表示になる', async () => {
    const db = setupDb();
    const res = await getPage(db);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('0件');
  });

  it('getThemeCSSのCSS変数定義は<style>タグの中に入っており、生テキストとして<head>に露出しない', async () => {
    const db = setupDb();
    const res = await getPage(db);
    const html = await res.text();
    const styleOpenIdx = html.indexOf('<style>');
    const styleCloseIdx = html.indexOf('</style>');
    const bgPrimaryIdx = html.indexOf('--bg-primary');
    expect(styleOpenIdx).toBeGreaterThan(-1);
    expect(styleCloseIdx).toBeGreaterThan(styleOpenIdx);
    // CSS変数定義(--bg-primary等)は必ず<style>〜</style>の内側にあること
    expect(bgPrimaryIdx).toBeGreaterThan(styleOpenIdx);
    expect(bgPrimaryIdx).toBeLessThan(styleCloseIdx);
    // <head>直下に裸のCSSテキストが置かれていない(<style>より前に:rootが出てこない)
    const headCloseIdx = html.indexOf('</head>');
    const rootIdxBeforeStyle = html.slice(0, styleOpenIdx).indexOf(':root');
    expect(rootIdxBeforeStyle).toBe(-1);
    expect(headCloseIdx).toBeGreaterThan(styleCloseIdx);
  });
});

describe('GET /api/jev-score-board/rows: キーワード検索', () => {
  it('question/answerへの部分一致で絞り込み、L1〜L20のスコアも返す', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'test-user', 'フランスの首都は?', '...', 'gemma', 1);
    insertEval(db, 's1', 'test-user', 'gemma', 1, 0.9);

    const res = await getRows(db, 'フランス');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hitCount: number; rows: { shareId: string; values: { jevLabelId: number; value: number | null }[] }[] };
    expect(body.hitCount).toBe(1);
    expect(body.rows[0].shareId).toBe('s1');
    expect(body.rows[0].values).toHaveLength(20);
    expect(body.rows[0].values.find((v) => v.jevLabelId === 1)?.value).toBe(0.9);
    expect(body.rows[0].values.find((v) => v.jevLabelId === 2)?.value).toBeNull();
  });

  it('answer側にしかキーワードが無くてもヒットする', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'test-user', '首都はどこ?', '日本の首都は東京です', 'gemma', 1);
    insertEval(db, 's1', 'test-user', 'gemma', 1, 0.9);

    const res = await getRows(db, '東京');
    const body = (await res.json()) as { hitCount: number };
    expect(body.hitCount).toBe(1);
  });

  it('他ユーザーのデータは混ざらない', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('other-user', datetime('now'), NULL)`).run();
    insertShare(db, 's1', 'other-user', 'フランスの首都は?', '...', 'gemma', 1);
    insertEval(db, 's1', 'other-user', 'gemma', 1, 0.9);

    const res = await getRows(db, 'フランス', 'test-user');
    const body = (await res.json()) as { hitCount: number };
    expect(body.hitCount).toBe(0);
  });

  it('target_type=source_questionは対象外', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'test-user', 'フランスの首都は?', '...', 'gemma', 1);
    insertEval(db, 's1', 'test-user', 'gemma', 1, 0.9, 'source_question');

    const res = await getRows(db, 'フランス');
    const body = (await res.json()) as { hitCount: number };
    expect(body.hitCount).toBe(0);
  });

  it('論理削除済みshareは除外される', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'test-user', 'フランスの首都は?', '...', 'gemma', 1, true);
    insertEval(db, 's1', 'test-user', 'gemma', 1, 0.9);

    const res = await getRows(db, 'フランス');
    const body = (await res.json()) as { hitCount: number };
    expect(body.hitCount).toBe(0);
  });
});

describe('GET /api/jev-score-board/top-by-label', () => {
  it('表示中の20件に含まれないshareでも、そのラベルのスコアが高ければ上位に出てくる', async () => {
    const db = setupDb();
    // 最新20件(s2〜s21)に、あふれて表示されないs1が「ラベル5」だけ最高スコアを持つ
    for (let i = 1; i <= 21; i++) {
      insertShare(db, `s${i}`, 'test-user', `質問${i}`, '回答', 'gemma', i);
      insertEval(db, `s${i}`, 'test-user', 'gemma', 5, i === 1 ? 0.99 : 0.1);
    }
    // s1は最も古く(オフセット最小)、最新20件表示からは除外されるはず
    const boardRes = await getRows(db, '');
    const boardBody = (await boardRes.json()) as { rows: { shareId: string }[] };
    expect(boardBody.rows.map((r) => r.shareId)).not.toContain('s1');

    const topRes = await getTopByLabel(db, '5');
    expect(topRes.status).toBe(200);
    const topBody = (await topRes.json()) as { rows: { shareId: string; value: number }[] };
    expect(topBody.rows[0].shareId).toBe('s1');
    expect(topBody.rows[0].value).toBeCloseTo(0.99);
  });

  it('labelIdが範囲外(0, 21, 非数値)は400', async () => {
    const db = setupDb();
    expect((await getTopByLabel(db, '0')).status).toBe(400);
    expect((await getTopByLabel(db, '21')).status).toBe(400);
    expect((await getTopByLabel(db, 'abc')).status).toBe(400);
  });

  it('論理削除済みshareのスコアはランキングに含めない', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'test-user', '質問', '回答', 'gemma', 1, true);
    insertEval(db, 's1', 'test-user', 'gemma', 3, 0.99);

    const res = await getTopByLabel(db, '3');
    const body = (await res.json()) as { rows: unknown[] };
    expect(body.rows).toHaveLength(0);
  });
});

describe('GET /api/jev-score-board/answer', () => {
  it('質問文・回答文を返す', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'test-user', '質問文です', '回答文です', 'gemma', 1);

    const res = await getAnswer(db, 's1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { question: string; answer: string };
    expect(body.question).toBe('質問文です');
    expect(body.answer).toBe('回答文です');
  });

  it('他ユーザーのshareIdは404', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('other-user', datetime('now'), NULL)`).run();
    insertShare(db, 's1', 'other-user', '質問文です', '回答文です', 'gemma', 1);

    const res = await getAnswer(db, 's1', 'test-user');
    expect(res.status).toBe(404);
  });

  it('存在しないshareIdは404', async () => {
    const db = setupDb();
    const res = await getAnswer(db, 'nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('GET /jev-score-board: XSS対策', () => {
  it('質問文・回答文にスクリプトタグを含めてもエスケープされる', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'test-user', '<script>alert(1)</script>危険な質問', '回答', 'gemma', 1);
    insertEval(db, 's1', 'test-user', 'gemma', 1, 0.9);

    const res = await getPage(db);
    const html = await res.text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
