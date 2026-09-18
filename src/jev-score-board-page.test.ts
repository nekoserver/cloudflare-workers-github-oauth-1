/**
 * 対象: /jev-score-board ページと、そのJSON API
 * (/api/jev-score-board/rows, /api/jev-score-board/top-by-label,
 * /api/jev-score-board/answer, /api/jev-score-board/label-names)。
 *
 * 背景: /neko jスラッシュコマンドとは独立した専用ページとして、質問ID
 * (share)1件=1行・jev_label_id=1〜20(ループA)を横列に並べる一覧を提供する。
 * ラベル列(th)タップで表示中の50件に限らず全データから上位50件を再取得し、
 * 質問文タップで質問文+回答文をモーダル用に返す。ID欄は質問IDそのものでは
 * なくゼロ埋め3桁の通し番号を表示するだけで、モーダルを開くリンクにはならない。
 *
 * 故障シナリオ:
 *   (1) 未認証はすべて401
 *   (2) keyword未指定でも評価済みshareが最新順に最大50件返る(51件目は含まれない)
 *   (3) keyword指定でquestion/answer部分一致が効く、他ユーザーは混ざらない
 *   (4) 論理削除済みshareは全エンドポイントから除外される
 *   (5) top-by-labelが表示中の50件に含まれないshareでもスコアが高ければ
 *       上位に出てくる(「全データから再取得」であることの証明)
 *   (6) top-by-labelのlabelIdが範囲外(0, 21, 非数値)は400
 *   (7) answerエンドポイントは他ユーザーのshareIdでは404
 *   (8) 応答HTMLにXSSペイロードを含む質問文を入れてもエスケープされる
 *   (9) getThemeCSS()の戻り値(生のCSSテキスト)を<style>タグで囲まずに
 *       <head>直下へ埋め込んでしまい、CSS変数定義が生テキストとして
 *       画面に表示されてしまう(実際に発生した回帰)
 *   (10) モデル名カラムを廃止したのに、質問文の左にモデル色丸が出ない
 *        (aichat_model_colorsの色が一覧に反映されない)
 *   (11) top-by-labelモーダルにそのラベルの内容(jev_labels.question_text)が
 *        出ない、またはjev_labelsに行が無い場合に黙って空文字を返してしまう
 *   (12) ID欄が質問IDそのものを露出してしまう、またはID欄がモーダルを開く
 *        リンクのままになっている(質問文側のリンクに変更されていない)
 *   (13) label-namesがjev_labelsに行が無いidまで空文字で埋めて返してしまう、
 *        またはid=21以降(範囲外)まで含めてしまう
 *   (14) th表記切替トグルが検索ボタンの右に無い、またはテーマ切替ボタンが
 *        topbar右端に寄っていない(margin-left:autoが外れている)
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { JSDOM } from 'jsdom';
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
    CREATE TABLE jev_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_type TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT,
      jev_group_id INTEGER
    );
    CREATE TABLE aichat_model_colors (
      model_id TEXT PRIMARY KEY,
      color TEXT NOT NULL,
      label TEXT NOT NULL
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

async function getLabelNames(db: DatabaseSync, sub = 'test-user'): Promise<Response> {
  const authHeader = await makeAuthHeader(sub);
  return app.request('/api/jev-score-board/label-names', { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: wrapD1(db) });
}

describe('GET /jev-score-board, /api/jev-score-board/*: 未認証は401', () => {
  it('ページ・rows・top-by-label・answer・label-namesすべて未認証だと401', async () => {
    const db = setupDb();
    const noAuth = { JWT_SECRET, DB: wrapD1(db) };
    expect((await app.request('/jev-score-board', {}, noAuth)).status).toBe(401);
    expect((await app.request('/api/jev-score-board/rows?keyword=x', {}, noAuth)).status).toBe(401);
    expect((await app.request('/api/jev-score-board/top-by-label?labelId=1', {}, noAuth)).status).toBe(401);
    expect((await app.request('/api/jev-score-board/answer?shareId=s1', {}, noAuth)).status).toBe(401);
    expect((await app.request('/api/jev-score-board/label-names', {}, noAuth)).status).toBe(401);
  });
});

describe('GET /jev-score-board: keyword未指定時の初期表示', () => {
  it('評価済みshareを最新順に最大50件表示し、51件目は含めない', async () => {
    const db = setupDb();
    for (let i = 1; i <= 51; i++) {
      insertShare(db, `s${i}`, 'test-user', `質問その${i}`, '回答', 'gemma', i);
      insertEval(db, `s${i}`, 'test-user', 'gemma', 1, 0.5);
    }
    const res = await getPage(db);
    expect(res.status).toBe(200);
    const html = await res.text();
    // 最新(オフセット最大=s51)が含まれ、最も古い(s1)は上限からあふれて含まれない
    expect(html).toContain('data-share-id="s51"');
    expect(html).not.toContain('data-share-id="s1"');
    expect(html).toContain('先頭50件のみ表示。全51件');
  });

  it('ID欄には質問IDそのものではなく、ゼロ埋め3桁の通し番号を表示する', async () => {
    const db = setupDb();
    insertShare(db, 'some-long-hash-id', 'test-user', '質問その1', '回答', 'gemma', 1);
    insertEval(db, 'some-long-hash-id', 'test-user', 'gemma', 1, 0.5);

    const res = await getPage(db);
    const html = await res.text();
    expect(html).toContain('<th>No.</th>');
    expect(html).not.toContain('<th>質問ID</th>');
    expect(html).toContain('<td class="col-no">001</td>');
    // 質問ID(生の値)はリンクのdata属性には残るが、セル本文としては露出しない
    expect(html).not.toMatch(/<td class="col-no">[^<]*some-long-hash-id/);
  });

  it('モーダルを開くリンクは質問文側にある(ID欄はリンクにならない)', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'test-user', 'フランスの首都は?', '回答', 'gemma', 1);
    insertEval(db, 's1', 'test-user', 'gemma', 1, 0.5);

    const res = await getPage(db);
    const html = await res.text();
    expect(html).toContain('class="question-link" data-share-id="s1">フランスの首都は?</a>');
    expect(html).not.toContain('class="col-no"><a');
  });

  it('モデル名カラムは表示せず、代わりに質問文の左にaichat_model_colors由来の色丸を出す', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO aichat_model_colors (model_id, color, label) VALUES ('gemma', '#ff8800', 'gemma')`).run();
    insertShare(db, 's1', 'test-user', 'フランスの首都は?', '回答', 'gemma', 1);
    insertEval(db, 's1', 'test-user', 'gemma', 1, 0.9);

    const res = await getPage(db);
    const html = await res.text();
    expect(html).not.toContain('<th>モデル</th>');
    expect(html).toContain('class="model-dot"');
    expect(html).toContain('#ff8800');
  });

  it('色未登録のモデルは輪郭だけの丸になる(固定色を書かない)', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'test-user', 'フランスの首都は?', '回答', 'unknown-model', 1);
    insertEval(db, 's1', 'test-user', 'unknown-model', 1, 0.9);

    const res = await getPage(db);
    const html = await res.text();
    expect(html).toContain('border-color:var(--border-color)');
  });

  it('評価データが無ければ0件表示になる', async () => {
    const db = setupDb();
    const res = await getPage(db);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('0件');
  });

  it('モーダルの質問文・回答文はMarkdownとしてinnerHTMLで描画する(textContentでエスケープ表示しない)', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'test-user', '質問', '回答', 'gemma', 1);
    insertEval(db, 's1', 'test-user', 'gemma', 1, 0.9);

    const res = await getPage(db);
    const html = await res.text();
    expect(html).toContain('answerModalQuestion.innerHTML = parseMd(');
    expect(html).toContain('answerModalAnswer.innerHTML = parseMd(');
    expect(html).toContain('class="qa-body preview-area" id="answerModalQuestion"');
  });

  it('埋め込まれた<script>ブロックに構文エラーがない(CLAUDE.mdルール29: エスケープシーケンス事故の再発防止)', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'test-user', '質問', '回答', 'gemma', 1);
    insertEval(db, 's1', 'test-user', 'gemma', 1, 0.9);

    const res = await getPage(db);
    const html = await res.text();
    // ページには<head>のgetThemeInitScript()由来の<script>も別途あるため、
    // メインスクリプト(escHtmlの定義から始まる方)だけを取り出す
    const scriptStart = html.indexOf('function escHtml(s) {');
    expect(scriptStart).toBeGreaterThan(-1);
    const scriptEnd = html.indexOf('</script>', scriptStart);
    expect(scriptEnd).toBeGreaterThan(scriptStart);
    const scriptBody = html.slice(scriptStart, scriptEnd);
    // 実行はせず(document等のDOM APIが無いため)、構文としてパース可能かだけ確認する
    expect(() => new Function(scriptBody)).not.toThrow();
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
  it('表示中の50件に含まれないshareでも、そのラベルのスコアが高ければ上位に出てくる', async () => {
    const db = setupDb();
    // 最新50件(s2〜s51)に、あふれて表示されないs1が「ラベル5」だけ最高スコアを持つ
    for (let i = 1; i <= 51; i++) {
      insertShare(db, `s${i}`, 'test-user', `質問${i}`, '回答', 'gemma', i);
      insertEval(db, `s${i}`, 'test-user', 'gemma', 5, i === 1 ? 0.99 : 0.1);
    }
    // s1は最も古く(オフセット最小)、最新50件表示からは除外されるはず
    const boardRes = await getRows(db, '');
    const boardBody = (await boardRes.json()) as { rows: { shareId: string }[] };
    expect(boardBody.rows.map((r) => r.shareId)).not.toContain('s1');

    const topRes = await getTopByLabel(db, '5');
    expect(topRes.status).toBe(200);
    const topBody = (await topRes.json()) as { rows: { shareId: string; value: number }[] };
    expect(topBody.rows[0].shareId).toBe('s1');
    expect(topBody.rows[0].value).toBeCloseTo(0.99);
  });

  it('そのラベルの内容(jev_labels.question_text)をlabelTextとして返す', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO jev_labels (id, question_type, question_text) VALUES (5, 'scale', '回答の正確度は高いか')`).run();
    insertShare(db, 's1', 'test-user', '質問', '回答', 'gemma', 1);
    insertEval(db, 's1', 'test-user', 'gemma', 5, 0.9);

    const res = await getTopByLabel(db, '5');
    const body = (await res.json()) as { labelText: string | null };
    expect(body.labelText).toBe('回答の正確度は高いか');
  });

  it('jev_labelsに対応行が無いlabelIdはlabelText=nullを返す(黙って空文字にしない)', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'test-user', '質問', '回答', 'gemma', 1);
    insertEval(db, 's1', 'test-user', 'gemma', 5, 0.9);

    const res = await getTopByLabel(db, '5');
    const body = (await res.json()) as { labelText: string | null };
    expect(body.labelText).toBeNull();
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

describe('GET /api/jev-score-board/label-names', () => {
  it('jev_labels(id=1〜20)のquestion_textをid文字列キーのオブジェクトで返す', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO jev_labels (id, question_type, question_text) VALUES (1, 'scale', '正確度は高いか')`).run();
    db.prepare(`INSERT INTO jev_labels (id, question_type, question_text) VALUES (2, 'scale', '新しさは十分か')`).run();

    const res = await getLabelNames(db);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { labels: Record<string, string> };
    expect(body.labels['1']).toBe('正確度は高いか');
    expect(body.labels['2']).toBe('新しさは十分か');
  });

  it('jev_labelsに行が無いidはlabelsオブジェクトに含めない(黙って空文字にしない)', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO jev_labels (id, question_type, question_text) VALUES (1, 'scale', '正確度は高いか')`).run();

    const res = await getLabelNames(db);
    const body = (await res.json()) as { labels: Record<string, string> };
    expect(body.labels['1']).toBe('正確度は高いか');
    expect(Object.prototype.hasOwnProperty.call(body.labels, '2')).toBe(false);
  });

  it('id=21以降(範囲外)のjev_labelsは含めない', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO jev_labels (id, question_type, question_text) VALUES (21, 'scale', '範囲外ラベル')`).run();

    const res = await getLabelNames(db);
    const body = (await res.json()) as { labels: Record<string, string> };
    expect(Object.prototype.hasOwnProperty.call(body.labels, '21')).toBe(false);
  });
});

describe('GET /jev-score-board: th表記切替トグルとテーマボタンの配置', () => {
  it('検索ボタンの右に「現行/日本語」のトグルボタンが置かれている', async () => {
    const db = setupDb();
    const res = await getPage(db);
    const html = await res.text();
    const searchBtnIdx = html.indexOf('id="searchBtn"');
    const toggleIdx = html.indexOf('class="th-mode-toggle"');
    expect(searchBtnIdx).toBeGreaterThan(-1);
    expect(toggleIdx).toBeGreaterThan(searchBtnIdx);
    expect(html).toContain('id="thModeCurrent" class="th-mode-btn active">現行</button>');
    expect(html).toContain('id="thModeJapanese" class="th-mode-btn">日本語</button>');
  });

  it('テーマ切替ボタンをtopbarの右端に寄せるCSS(margin-left:auto)が設定されている', async () => {
    const db = setupDb();
    const res = await getPage(db);
    const html = await res.text();
    expect(html).toContain('#topbar .theme-toggle { width: 30px; height: 30px; margin-left: auto; }');
  });

  it('埋め込まれた<script>ブロック(th表記切替を含む)に構文エラーがない', async () => {
    const db = setupDb();
    const res = await getPage(db);
    const html = await res.text();
    const scriptStart = html.indexOf('function escHtml(s) {');
    const scriptEnd = html.indexOf('</script>', scriptStart);
    const scriptBody = html.slice(scriptStart, scriptEnd);
    expect(scriptBody).toContain("setThMode('japanese')");
    expect(scriptBody).toContain('/api/jev-score-board/label-names');
    expect(() => new Function(scriptBody)).not.toThrow();
  });
});

// 故障シナリオ(15): th表記切替の状態がCookieに保存されず、ページ再訪の
// たびに選択がリセットされてしまう(特にデフォルトが「現行」のままだと、
// 過去に「日本語」を選んだユーザーの意図に反する)。
// jsdomで埋め込み<script>を実際に実行し、Cookie未設定時は「日本語」が
// 初期状態になること・トグル操作でCookieへ書き込まれること・Cookieが
// 既にあればそれを初期状態として復元することを検証する。
describe('GET /jev-score-board: th表記切替のCookie永続化', () => {
  function extractMainScript(html: string): string {
    const start = html.indexOf('function escHtml(s) {');
    const end = html.indexOf('</script>', start);
    if (start === -1 || end === -1) throw new Error('メインスクリプトが見つかりません');
    return html.slice(start, end);
  }

  function setupHarness(html: string, initialCookie: string) {
    const script = extractMainScript(html);
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com/', pretendToBeVisual: true });
    const window: any = dom.window;
    window.fetch = () => Promise.resolve({ ok: true, json: async () => ({ labels: {} }) });
    if (initialCookie) window.document.cookie = initialCookie;
    window.eval(script);
    return { window, document: window.document };
  }

  it('Cookie未設定時はデフォルトで「日本語」が初期状態になる', async () => {
    const db = setupDb();
    const res = await getPage(db);
    const html = await res.text();
    const { document } = setupHarness(html, '');
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById('thModeJapanese').classList.contains('active')).toBe(true);
    expect(document.getElementById('thModeCurrent').classList.contains('active')).toBe(false);
  });

  it('「現行」に切り替えるとCookie(jev_score_board_th_mode=current)へ保存される', async () => {
    const db = setupDb();
    const res = await getPage(db);
    const html = await res.text();
    const { document } = setupHarness(html, '');
    await new Promise((r) => setTimeout(r, 0));

    document.getElementById('thModeCurrent').click();
    expect(document.cookie).toContain('jev_score_board_th_mode=current');
    expect(document.getElementById('thModeCurrent').classList.contains('active')).toBe(true);
    expect(document.getElementById('thModeJapanese').classList.contains('active')).toBe(false);
  });

  it('Cookieに保存済みの「現行」があれば、それを初期状態として復元する', async () => {
    const db = setupDb();
    const res = await getPage(db);
    const html = await res.text();
    const { document } = setupHarness(html, 'jev_score_board_th_mode=current');
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById('thModeCurrent').classList.contains('active')).toBe(true);
    expect(document.getElementById('thModeJapanese').classList.contains('active')).toBe(false);
  });
});
