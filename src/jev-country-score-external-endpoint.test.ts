/**
 * POST /api/aichat/jev-country-score-external のテスト
 *
 * 対象: AI分類のキーワードがカタカナの国名(例:「フランス」)だった場合に、
 * jev-score-externalとは別のテーブル(jev_country_keyword_labels/
 * jev_country_keyword_evaluations)を使ってJevに評価させる専用エントリ
 * ポイント。src/utils/jevCountryKeyword.ts(matchKatakanaCountryName・
 * parseCountryKeywordLabelRows)を土台にしている。
 *
 * 故障シナリオ(jev-score-externalと共通のものに加え):
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1検索まで到達してしまう
 *   (3) リクエスト本文のloginをそのままuser_idとして信用してしまう
 *   (4) 既に評価済みのラベルもJevへ再送してしまう(重複課金・重複行)
 *   (5) 全ラベル評価済みなのにJevへ問い合わせてしまう
 *   (6) Jev API呼び出し失敗時にエラーが記録されず、空の成功扱いになってしまう
 *   (7) JEV_API_KEY未設定時にフェイルオープンする
 *   (8) カタカナの国名一覧に無いキーワード(通常の質問文や食品名等)が
 *       素通りしてjev_country_keyword_evaluationsに書き込まれてしまう
 *       (このエンドポイントは国名専用であることを保証する必要がある)
 *   (9) keywordの前後の空白や既存の表記ゆれで別の行として保存されてしまう
 *       (matchKatakanaCountryNameで正規化した国名をkeywordとして保存する)
 *  (10) jev_evaluations(share_id用)に紛れ込んで書き込まれてしまう
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const SECRET = 'test-aichat-external-secret';
const JEV_KEY = 'test-jev-key';
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

function setupDb(allowedUsers: Record<string, string>): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE dynamicneko_aichat_allowed_users (email TEXT PRIMARY KEY, github_login TEXT);
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
    CREATE TABLE jev_country_keyword_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE jev_country_keyword_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      user_id TEXT NOT NULL,
      jev_country_keyword_label_id INTEGER NOT NULL,
      value REAL NOT NULL,
      computed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  for (const [email, login] of Object.entries(allowedUsers)) {
    db.prepare(`INSERT INTO dynamicneko_aichat_allowed_users (email, github_login) VALUES (?, ?)`).run(email, login);
  }
  return db;
}

function insertCountryLabels(db: DatabaseSync, labels: { id: number; text: string; optionsJson?: string | null }[]): void {
  for (const label of labels) {
    db.prepare(`INSERT INTO jev_country_keyword_labels (id, question_text, options_json) VALUES (?, ?, ?)`).run(
      label.id,
      label.text,
      label.optionsJson === undefined ? JSON.stringify(['悪い状態', '良い状態']) : label.optionsJson
    );
  }
}

function insertCountryEvaluation(db: DatabaseSync, args: { keyword: string; userId: string; labelId: number; value: number }): void {
  db.prepare(
    `INSERT INTO jev_country_keyword_evaluations (keyword, user_id, jev_country_keyword_label_id, value) VALUES (?, ?, ?, ?)`
  ).run(args.keyword, args.userId, args.labelId, args.value);
}

const BASE_ENV = { AICHAT_EXTERNAL_SECRET: SECRET, AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET, JEV_API_KEY: JEV_KEY };

async function postJevCountryScore(db: DatabaseSync, body: Record<string, unknown>, envOverrides: Record<string, unknown> = {}): Promise<Response> {
  return app.request(
    '/api/aichat/jev-country-score-external',
    { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { ...BASE_ENV, DB: wrapD1(db), ...envOverrides }
  );
}

describe('POST /api/aichat/jev-country-score-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await app.request(
      '/api/aichat/jev-country-score-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, keyword: 'フランス' }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('userTokenが無い場合は401(本文の生emailは受け付けない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postJevCountryScore(db, { email: 'ok@example.com', keyword: 'フランス' });
    expect(res.status).toBe(401);
  });

  it('偽造されたuserToken(別鍵署名)は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const forgedToken = await makeUserToken('ok@example.com', 'wrong-secret');
    const res = await postJevCountryScore(db, { userToken: forgedToken, keyword: 'フランス' });
    expect(res.status).toBe(401);
  });

  it('AICHAT_USER_TOKEN_SECRET未設定時は503を返す(フェイルオープンしない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await app.request(
      '/api/aichat/jev-country-score-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, keyword: 'フランス' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, JEV_API_KEY: JEV_KEY, DB: wrapD1(db) }
    );
    expect(res.status).toBe(503);
  });

  it('JEV_API_KEY未設定時は503を返す(フェイルオープンしない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await app.request(
      '/api/aichat/jev-country-score-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, keyword: 'フランス' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(503);
  });

  it('未許可メールアドレスは403で拒否される', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ng@example.com');
    const res = await postJevCountryScore(db, { userToken, keyword: 'フランス' });
    expect(res.status).toBe(403);
  });

  it('keywordが空の場合は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await postJevCountryScore(db, { userToken, keyword: '  ' });
    expect(res.status).toBe(400);
  });

  it('カタカナの既知国名一覧に無いキーワード(通常の質問文)は400で拒否される(国名専用エンドポイント)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await postJevCountryScore(db, { userToken, keyword: 'フランスのおすすめ観光地はどこですか' });
    expect(res.status).toBe(400);
  });

  it('カタカナだが国名一覧に無い語(食品名等)も400で拒否される', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await postJevCountryScore(db, { userToken, keyword: 'パスタ' });
    expect(res.status).toBe(400);
  });

  it('漢字の国名(韓国等、カタカナではない)も400で拒否される', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await postJevCountryScore(db, { userToken, keyword: '韓国' });
    expect(res.status).toBe(400);
  });

  it('全ラベル評価済みならJevを呼ばずキャッシュ済みの結果だけを返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCountryLabels(db, [{ id: 1, text: 'ラベル1' }, { id: 2, text: 'ラベル2' }]);
    insertCountryEvaluation(db, { keyword: 'フランス', userId: 'nekoserver', labelId: 1, value: 0.9 });
    insertCountryEvaluation(db, { keyword: 'フランス', userId: 'nekoserver', labelId: 2, value: 0.1 });

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      const userToken = await makeUserToken('ok@example.com');
      const res = await postJevCountryScore(db, { userToken, keyword: 'フランス' });
      expect(res.status).toBe(200);
      const bodyJson = (await res.json()) as { keyword: string; scores: Array<{ labelId: number; value: number }>; cachedCount: number; newlyEvaluatedCount: number };
      expect(bodyJson.keyword).toBe('フランス');
      expect(bodyJson.cachedCount).toBe(2);
      expect(bodyJson.newlyEvaluatedCount).toBe(0);
      expect(bodyJson.scores).toHaveLength(2);
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('未評価ラベルだけをJevへ送り、結果をjev_country_keyword_evaluationsに保存して評価済み+新規をまとめて返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCountryLabels(db, [{ id: 1, text: 'ラベル1' }, { id: 2, text: 'ラベル2' }]);
    insertCountryEvaluation(db, { keyword: 'フランス', userId: 'nekoserver', labelId: 1, value: 0.9 });

    let requestedState: string | null = null;
    let requestedQuestions: unknown = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body));
      requestedState = parsed.state;
      requestedQuestions = parsed.questions;
      return new Response(JSON.stringify({ answers: { '2': 0.42 } }), { status: 200 });
    }) as typeof fetch;
    try {
      const userToken = await makeUserToken('ok@example.com');
      const res = await postJevCountryScore(db, { userToken, keyword: 'フランス' });
      expect(res.status).toBe(200);
      const bodyJson = (await res.json()) as { scores: Array<{ labelId: number; value: number }>; cachedCount: number; newlyEvaluatedCount: number };
      expect(bodyJson.cachedCount).toBe(1);
      expect(bodyJson.newlyEvaluatedCount).toBe(1);
      expect(bodyJson.scores.sort((a, b) => a.labelId - b.labelId)).toEqual([
        { labelId: 1, value: 0.9 },
        { labelId: 2, value: 0.42 },
      ]);
      expect(requestedState).toBe('フランス');
      expect(Object.keys(requestedQuestions as Record<string, unknown>).length).toBe(1);

      const saved = db
        .prepare('SELECT jev_country_keyword_label_id, value FROM jev_country_keyword_evaluations WHERE keyword = ? AND jev_country_keyword_label_id = 2')
        .get('フランス') as { jev_country_keyword_label_id: number; value: number };
      expect(saved.value).toBeCloseTo(0.42);

      // jev_evaluations(share_id用のテーブル)には何も書かれない。
      const crossTableCount = db.prepare('SELECT COUNT(*) as c FROM jev_evaluations').get() as { c: number };
      expect(crossTableCount.c).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('keywordの前後に空白があっても正規化された国名で保存・照合される', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCountryLabels(db, [{ id: 1, text: 'ラベル1' }]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ answers: { '1': 0.7 } }), { status: 200 })) as typeof fetch;
    try {
      const userToken = await makeUserToken('ok@example.com');
      const res = await postJevCountryScore(db, { userToken, keyword: '  フランス  ' });
      expect(res.status).toBe(200);
      const bodyJson = (await res.json()) as { keyword: string };
      expect(bodyJson.keyword).toBe('フランス');

      const saved = db.prepare('SELECT keyword FROM jev_country_keyword_evaluations').get() as { keyword: string };
      expect(saved.keyword).toBe('フランス');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Jev API呼び出し失敗時は502エラーを返しjev_country_keyword_evaluationsに何も保存しない(握りつぶさない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCountryLabels(db, [{ id: 1, text: 'ラベル1' }]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('internal error', { status: 500 })) as typeof fetch;
    try {
      const userToken = await makeUserToken('ok@example.com');
      const res = await postJevCountryScore(db, { userToken, keyword: 'フランス' });
      expect(res.status).toBe(502);
      const bodyJson = (await res.json()) as { error: string };
      expect(bodyJson.error).not.toBe('');
      const count = db.prepare('SELECT COUNT(*) as c FROM jev_country_keyword_evaluations').get() as { c: number };
      expect(count.c).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('jev_country_keyword_labels.options_jsonがcriteria(2要素配列)として不正な場合は500で失敗し、Jevへは送らない(黙って進めない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCountryLabels(db, [{ id: 1, text: 'ラベル1', optionsJson: 'not a criteria array' }]);

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      const userToken = await makeUserToken('ok@example.com');
      const res = await postJevCountryScore(db, { userToken, keyword: 'フランス' });
      expect(res.status).toBe(500);
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('jev_country_keyword_labelsが1件も登録されていない場合は500', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await postJevCountryScore(db, { userToken, keyword: 'フランス' });
    expect(res.status).toBe(500);
  });

  it('DB未設定時はフェイルクローズで503を返す', async () => {
    const userToken = await makeUserToken('ok@example.com');
    const res = await app.request(
      '/api/aichat/jev-country-score-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, keyword: 'フランス' }) },
      { ...BASE_ENV }
    );
    expect(res.status).toBe(503);
  });
});
