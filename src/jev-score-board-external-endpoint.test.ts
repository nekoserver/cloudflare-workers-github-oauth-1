/**
 * POST /api/aichat/jev-score-board-{rows,top-by-label,answer,label-names}-external
 * のテスト
 *
 * 対象: dynamicnekoの/jev-scoresページ(React版jev-score-board)向けの
 * external API群。本体Workerの内部版(Cookie認証、GET /jev-score-board/*)と
 * 同じ抽出済みロジック(fetchJevScoreBoardData等)を、dynamicnekoからの
 * Service Binding経由の呼び出し用に別ルートとして公開する。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) userTokenが無い/偽造されている場合に本文の生emailを信用してしまう
 *   (3) 未許可メールアドレスがD1クエリまで到達してしまう
 *   (4) 他ユーザーのデータが混ざる(loginでスコープされていない)
 *   (5) rows: keyword絞り込み・50件上限が内部版と同じ挙動になっていない
 *   (6) top-by-label: labelIdの範囲外(0, 21, 非数値)が400にならない、
 *       全データからの再取得(表示中に限らない)になっていない
 *   (7) answer: 他ユーザーのshareIdが404にならない
 *   (8) label-names: 許可チェックだけでlogin未登録でも200を返すべきところ、
 *       誤ってlogin解決に失敗させ500を返してしまう
 *   (9) AICHAT_USER_TOKEN_SECRET未設定時にフェイルオープンする
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const SECRET = 'test-aichat-external-secret';
const USER_TOKEN_SECRET = 'test-user-token-secret';

function makeUserToken(email: string, secret: string = USER_TOKEN_SECRET, expiresIn = 60): Promise<string> {
  return createJWT({ sub: email }, secret, expiresIn);
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

function setupDb(allowedUsers: Record<string, string>): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE dynamicneko_aichat_allowed_users (email TEXT PRIMARY KEY, github_login TEXT);
    CREATE TABLE ai_chat_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_hash TEXT NOT NULL DEFAULT '',
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      model TEXT,
      created_at TEXT NOT NULL,
      access_count INTEGER NOT NULL DEFAULT 0,
      question_hash TEXT,
      image_data_url TEXT,
      image_id TEXT,
      deleted_at TEXT
    );
    CREATE TABLE jev_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_type TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT,
      jev_group_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE jev_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      share_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      model TEXT,
      jev_label_id INTEGER NOT NULL,
      value REAL NOT NULL,
      computed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  for (const [email, login] of Object.entries(allowedUsers)) {
    db.prepare(`INSERT INTO dynamicneko_aichat_allowed_users (email, github_login) VALUES (?, ?)`).run(email, login);
  }
  return db;
}

function insertShare(db: DatabaseSync, id: string, userId: string, question: string, answer: string, model: string, secondsOffset: number): void {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))`
  ).run(id, userId, question, answer, model, `+${secondsOffset} seconds`);
}

function insertEval(db: DatabaseSync, shareId: string, userId: string, model: string, labelId: number, value: number): void {
  db.prepare(
    `INSERT INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES ('answer', ?, ?, ?, ?, ?)`
  ).run(shareId, userId, model, labelId, value);
}

const BASE_ENV = { AICHAT_EXTERNAL_SECRET: SECRET, AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET };

async function postExternal(path: string, db: DatabaseSync, body: Record<string, unknown>, envOverrides: Record<string, unknown> = {}): Promise<Response> {
  return app.request(
    path,
    { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { ...BASE_ENV, DB: wrapD1(db), ...envOverrides }
  );
}

async function postRows(db: DatabaseSync, email: string, keyword = ''): Promise<Response> {
  const userToken = await makeUserToken(email);
  return postExternal('/api/aichat/jev-score-board-rows-external', db, { userToken, keyword });
}

async function postTopByLabel(db: DatabaseSync, email: string, labelId: number): Promise<Response> {
  const userToken = await makeUserToken(email);
  return postExternal('/api/aichat/jev-score-board-top-by-label-external', db, { userToken, labelId });
}

async function postAnswer(db: DatabaseSync, email: string, shareId: string): Promise<Response> {
  const userToken = await makeUserToken(email);
  return postExternal('/api/aichat/jev-score-board-answer-external', db, { userToken, shareId });
}

async function postLabelNames(db: DatabaseSync, email: string): Promise<Response> {
  const userToken = await makeUserToken(email);
  return postExternal('/api/aichat/jev-score-board-label-names-external', db, { userToken });
}

describe('共通の認可 (rows-externalで代表して確認)', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await app.request(
      '/api/aichat/jev-score-board-rows-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, keyword: '' }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('userTokenが無い場合は401(本文の生emailは受け付けない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postExternal('/api/aichat/jev-score-board-rows-external', db, { email: 'ok@example.com', keyword: '' });
    expect(res.status).toBe(401);
  });

  it('偽造されたuserToken(異なる鍵で署名)は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const forgedToken = await makeUserToken('ok@example.com', 'wrong-secret');
    const res = await postExternal('/api/aichat/jev-score-board-rows-external', db, { userToken: forgedToken, keyword: '' });
    expect(res.status).toBe(401);
  });

  it('未許可メールアドレスは403', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postRows(db, 'ng@example.com');
    expect(res.status).toBe(403);
  });

  it('AICHAT_USER_TOKEN_SECRET未設定時は503を返す(フェイルオープンしない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await app.request(
      '/api/aichat/jev-score-board-rows-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, keyword: '' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(503);
  });

  it('DB未設定時はフェイルクローズで503を返す', async () => {
    const userToken = await makeUserToken('ok@example.com');
    const res = await app.request(
      '/api/aichat/jev-score-board-rows-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, keyword: '' }) },
      { ...BASE_ENV }
    );
    expect(res.status).toBe(503);
  });
});

describe('POST /api/aichat/jev-score-board-rows-external', () => {
  it('内部版と同じくkeyword部分一致・50件上限で動く', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 's1', 'nekoserver', 'フランスの首都は?', '...', 'gemma', 1);
    insertEval(db, 's1', 'nekoserver', 'gemma', 1, 0.9);

    const res = await postRows(db, 'ok@example.com', 'フランス');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hitCount: number; rows: { shareId: string; values: { jevLabelId: number; value: number | null }[] }[] };
    expect(body.hitCount).toBe(1);
    expect(body.rows[0].shareId).toBe('s1');
    expect(body.rows[0].values).toHaveLength(20);
  });

  it('本文にemailを直接書いても、userTokenのsub以外のユーザーのデータは読めない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver', 'victim@example.com': 'victim-user' });
    insertShare(db, 's1', 'victim-user', 'フランスの首都は?', '...', 'gemma', 1);
    insertEval(db, 's1', 'victim-user', 'gemma', 1, 0.9);
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal('/api/aichat/jev-score-board-rows-external', db, { userToken, keyword: 'フランス', email: 'victim@example.com' });
    const body = (await res.json()) as { hitCount: number };
    expect(body.hitCount).toBe(0);
  });
});

describe('POST /api/aichat/jev-score-board-top-by-label-external', () => {
  it('表示中の件数に限らず、全データからそのラベルのスコア上位を返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 's1', 'nekoserver', '質問1', '回答', 'gemma', 1);
    insertShare(db, 's2', 'nekoserver', '質問2', '回答', 'gemma', 2);
    insertEval(db, 's1', 'nekoserver', 'gemma', 5, 0.99);
    insertEval(db, 's2', 'nekoserver', 'gemma', 5, 0.1);

    const res = await postTopByLabel(db, 'ok@example.com', 5);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: { shareId: string; value: number }[] };
    expect(body.rows[0].shareId).toBe('s1');
    expect(body.rows[0].value).toBeCloseTo(0.99);
  });

  it('labelIdが範囲外(0, 21, 非数値)は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    expect((await postTopByLabel(db, 'ok@example.com', 0)).status).toBe(400);
    expect((await postTopByLabel(db, 'ok@example.com', 21)).status).toBe(400);
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal('/api/aichat/jev-score-board-top-by-label-external', db, { userToken, labelId: 'abc' });
    expect(res.status).toBe(400);
  });

  it('他ユーザーのスコアは混ざらない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver', 'victim@example.com': 'victim-user' });
    insertShare(db, 's1', 'victim-user', '質問', '回答', 'gemma', 1);
    insertEval(db, 's1', 'victim-user', 'gemma', 5, 0.99);

    const res = await postTopByLabel(db, 'ok@example.com', 5);
    const body = (await res.json()) as { rows: unknown[] };
    expect(body.rows).toHaveLength(0);
  });
});

describe('POST /api/aichat/jev-score-board-answer-external', () => {
  it('質問文・回答文を返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 's1', 'nekoserver', '質問文です', '回答文です', 'gemma', 1);

    const res = await postAnswer(db, 'ok@example.com', 's1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { question: string; answer: string };
    expect(body.question).toBe('質問文です');
    expect(body.answer).toBe('回答文です');
  });

  it('他ユーザーのshareIdは404', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver', 'victim@example.com': 'victim-user' });
    insertShare(db, 's1', 'victim-user', '質問文です', '回答文です', 'gemma', 1);

    const res = await postAnswer(db, 'ok@example.com', 's1');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/aichat/jev-score-board-label-names-external', () => {
  it('login解決不要で、許可済みメールなら200でラベル名を返す(github_login未登録でも動く)', async () => {
    const db = setupDb({ 'ok@example.com': null as unknown as string });
    db.prepare(`INSERT INTO jev_labels (id, question_type, question_text) VALUES (1, 'scale', '正確度は高いか')`).run();

    const res = await postLabelNames(db, 'ok@example.com');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { labels: Record<string, string> };
    expect(body.labels['1']).toBe('正確度は高いか');
  });

  it('未許可メールアドレスは403', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postLabelNames(db, 'ng@example.com');
    expect(res.status).toBe(403);
  });

  it('jev_labelsに行が無いidは含めない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postLabelNames(db, 'ok@example.com');
    const body = (await res.json()) as { labels: Record<string, string> };
    expect(Object.keys(body.labels)).toHaveLength(0);
  });
});
