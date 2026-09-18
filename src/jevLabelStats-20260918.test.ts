import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';
import { getJevLabelStatsPage } from './views/jevLabelStats';

/**
 * 対象: GET /jev-label-stats(📋 Jev評価項目一覧ページ)。
 * 「どのパターン(入力内容)のときにいくつの質問項目でJevに問い合わせて
 * いるか」を把握するためのページ。
 *
 * 故障シナリオ:
 *   (1) 未認証は401
 *   (2) jev_label_groupsが0件(まだ登録されていない)場合も、例外にならず
 *       「登録されていません」と分かる表示になる(黙って空白にしない)
 *   (3) グループ別件数が正しく合計され、合計行(tfoot)に反映される
 *   (4) 国名キーワード評価(jev_country_keyword_labels)の件数は
 *       jev_labelsの合計とは別枠で表示される(混ざらない)
 *   (5) 埋め込み<script>に構文エラーがない
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
    CREATE TABLE jev_label_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
    CREATE TABLE jev_labels (id INTEGER PRIMARY KEY AUTOINCREMENT, question_type TEXT, question_text TEXT, options_json TEXT, jev_group_id INTEGER);
    CREATE TABLE jev_country_keyword_labels (id INTEGER PRIMARY KEY AUTOINCREMENT, question_text TEXT);
  `);
  return db;
}

async function getPage(db: DatabaseSync) {
  return app.request('/jev-label-stats', { headers: { Authorization: await authHeader() } }, { JWT_SECRET, DB: wrapD1(db) });
}

describe('GET /jev-label-stats', () => {
  it('未認証は401', async () => {
    const db = setupDb();
    const res = await app.request('/jev-label-stats', {}, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(401);
  });

  it('グループが0件のときは「登録されていません」と表示する(例外にならない)', async () => {
    const db = setupDb();
    const res = await getPage(db);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('グループが登録されていません');
  });

  it('グループ別件数が正しく集計され、合計行に反映される', async () => {
    const db = setupDb();
    db.exec(`
      INSERT INTO jev_label_groups (id, name) VALUES (1, '事実の正確さ'), (2, '論理・整合性');
      INSERT INTO jev_labels (jev_group_id, question_type, question_text) VALUES
        (1, 'score', 'q1'), (1, 'score', 'q2'), (1, 'score', 'q3'),
        (2, 'score', 'q4'), (2, 'score', 'q5');
    `);
    const res = await getPage(db);
    const html = await res.text();
    expect(html).toContain('事実の正確さ');
    expect(html).toContain('論理・整合性');
    // 各グループの件数(3件・2件)と合計(5件)がすべて出る
    const tbodyIdx = html.indexOf('<tbody>');
    const tfootIdx = html.indexOf('<tfoot>');
    expect(html.slice(tbodyIdx, tfootIdx)).toContain('<td class="num">3</td>');
    expect(html.slice(tbodyIdx, tfootIdx)).toContain('<td class="num">2</td>');
    expect(html.slice(tfootIdx)).toContain('<td class="num">5</td>');
  });

  it('件数0のグループ(LEFT JOINで質問項目が無い)も0件として表示される(欠落しない)', async () => {
    const db = setupDb();
    db.exec(`INSERT INTO jev_label_groups (id, name) VALUES (1, '応答姿勢・手続き');`);
    const res = await getPage(db);
    const html = await res.text();
    expect(html).toContain('応答姿勢・手続き');
    const tbodyIdx = html.indexOf('<tbody>');
    const tfootIdx = html.indexOf('<tfoot>');
    expect(html.slice(tbodyIdx, tfootIdx)).toContain('<td class="num">0</td>');
  });

  it('国名キーワード評価の件数は、jev_labelsの合計とは別枠で表示される', async () => {
    const db = setupDb();
    db.exec(`
      INSERT INTO jev_label_groups (id, name) VALUES (1, '事実の正確さ');
      INSERT INTO jev_labels (jev_group_id, question_type, question_text) VALUES (1, 'score', 'q1');
      INSERT INTO jev_country_keyword_labels (question_text) VALUES ('a'), ('b'), ('c');
    `);
    const res = await getPage(db);
    const html = await res.text();
    expect(html).toContain('国名キーワードの評価');
    const statTileIdx = html.indexOf('stat-tile');
    expect(html.slice(statTileIdx, statTileIdx + 300)).toContain('3');
  });

  it('script タグ内の JS に構文エラーがない', () => {
    const html = getJevLabelStatsPage(
      { name: 'Test', username: 'test-user' },
      { groups: [{ groupName: 'g1', labelCount: 1 }], totalAnswerLabels: 1, keywordLabelCount: 0 },
    );
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });
});
