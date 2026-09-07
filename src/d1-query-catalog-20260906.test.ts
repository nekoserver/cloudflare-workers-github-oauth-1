/**
 * GET /d1-query-catalog ページのテスト
 *
 * 対象: src/index.ts の db.prepare() 呼び出しから合成したsqlc風クエリ
 * カタログをD1(d1_query_catalog)から読み出して一覧表示するページ。
 *
 * 故障シナリオ:
 *   (1) DB未設定・クエリ失敗時にページ全体がエラーにならず空一覧で表示される
 *   (2) ユーザー名によるXSS
 *   (3) SQL本文・クエリ名にHTML特殊文字が含まれてもエスケープされる
 *   (4) `td`に明示的な文字色が無く、ダークモードで黒文字が暗背景に重なり読めなくなる
 *       (CLAUDE.CSS.mdルール: 色は必ずCSS変数を使う。実機で発見・修正した回帰)
 *   (5) SQLセルに`word-break: break-word`を残したまま列が縮むと、長い識別子が
 *       1〜3文字ずつ縦に折り返されて実質読めなくなる(テーブルレイアウトが列を
 *       極端に狭めた場合の挙動)。横スクロールに倒すことで回避する
 *   (6) テーブル選択パネルの開閉ボタン・チェックボックスが正しく描画されず、
 *       テーブル名を帯(見出しバー)にまとめた出力にならない
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getD1QueryCatalogPage } from './views/d1QueryCatalog';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(rows: Record<string, unknown>[] = []) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          return Promise.resolve(null);
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
      first: vi.fn().mockImplementation(() => {
        if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
        return Promise.resolve(null);
      }),
      all: vi.fn().mockImplementation(() => {
        if (sql.includes('d1_query_catalog')) return Promise.resolve({ results: rows });
        return Promise.resolve({ results: [] });
      }),
      run: vi.fn().mockResolvedValue({ success: true }),
    })),
  };
}

describe('GET /d1-query-catalog', () => {
  it('ページが200で返り、タイトルが含まれる', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/d1-query-catalog',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb() }
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('D1クエリカタログ');
  });

  it('DBクエリが失敗しても500にならず空一覧で表示される', async () => {
    const authHeader = await makeAuthHeader();
    const failingDb = {
      prepare: vi.fn().mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ revoked_at: null }),
          all: vi.fn().mockRejectedValue(new Error('db error')),
        }),
        first: vi.fn().mockResolvedValue({ revoked_at: null }),
        all: vi.fn().mockRejectedValue(new Error('db error')),
      })),
    };
    const res = await app.request(
      '/d1-query-catalog',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: failingDb }
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('データがありません');
  });

  it('ユーザー名はエスケープされる', () => {
    const html = getD1QueryCatalogPage('<script>alert(1)</script>', []);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('クエリ名・SQL本文のHTML特殊文字がエスケープされる', () => {
    const html = getD1QueryCatalogPage('tester', [
      {
        query_name: '<b>Evil</b>',
        command: 'exec',
        command_confirmed: 1,
        table_name: 'foo',
        source_file: 'src/index.ts',
        source_line: 1,
        sql_text: "SELECT '<img src=x onerror=alert(1)>' FROM foo",
        migration_file: null,
        last_commit_hash: null,
      },
    ]);
    expect(html).not.toContain('<b>Evil</b>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('tdに明示的な文字色(var(--text-primary))が設定されている(ダークモードで黒文字が読めなくなる回帰の防止)', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toMatch(/td\s*\{[^}]*color:\s*var\(--text-primary\)/);
  });

  it('SQLセルにword-break: break-wordが残っていない(縦一文字折り返しの回帰の防止)', () => {
    const html = getD1QueryCatalogPage('tester', []);
    const sqlCellRule = html.match(/\.sql-cell\s*\{[^}]*\}/);
    expect(sqlCellRule).not.toBeNull();
    expect(sqlCellRule![0]).not.toContain('word-break');
    expect(sqlCellRule![0]).toContain('white-space: nowrap');
  });

  it('コマンド確定件数がサマリに表示される', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'one', command_confirmed: 1, table_name: 't', source_file: 'src/index.ts', source_line: 1, sql_text: 'SELECT 1', migration_file: null, last_commit_hash: null },
      { query_name: 'B', command: 'exec', command_confirmed: 0, table_name: 't', source_file: 'src/index.ts', source_line: 2, sql_text: 'DELETE FROM t', migration_file: null, last_commit_hash: null },
    ]);
    expect(html).toContain('2件中、コマンド種別確定済み1件');
  });

  it('発行SQL種別の複数選択セレクトボックスが、出現回数の多い順で表示される', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 't1', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO t1 VALUES (1)', migration_file: null, last_commit_hash: null },
      { query_name: 'B', command: 'exec', command_confirmed: 1, table_name: 't2', source_file: 'src/index.ts', source_line: 2, sql_text: 'INSERT INTO t2 VALUES (1)', migration_file: null, last_commit_hash: null },
      { query_name: 'C', command: 'one', command_confirmed: 1, table_name: 't1', source_file: 'src/index.ts', source_line: 3, sql_text: 'SELECT * FROM t1', migration_file: null, last_commit_hash: null },
    ]);
    const selectMatch = html.match(/<select id="verbFilter"[^>]*>([\s\S]*?)<\/select>/);
    expect(selectMatch).not.toBeNull();
    const optionsText = selectMatch![1];
    const insertIdx = optionsText.indexOf('INSERT (2)');
    const selectIdx = optionsText.indexOf('SELECT (1)');
    expect(insertIdx).toBeGreaterThan(-1);
    expect(selectIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeLessThan(selectIdx);
  });

  it('multiple属性が指定されており複数選択できる', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toMatch(/<select id="verbFilter"[^>]*\bmultiple\b/);
  });

  it('各行にdata-verb属性が付与され、テーブル名を決め打ちせずSQL種別で横断検索できる', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 1, sql_text: 'UPDATE foo SET x = 1', migration_file: null, last_commit_hash: null },
    ]);
    expect(html).toContain('data-verb="UPDATE"');
  });

  it('テーブル名不明でも発行SQL種別(PRAGMA等)は判定できる', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 0, table_name: null, source_file: 'src/index.ts', source_line: 1, sql_text: 'PRAGMA table_info(${tableName})', migration_file: null, last_commit_hash: null },
    ]);
    expect(html).toContain('data-verb="PRAGMA"');
  });

  it('テーブル選択パネルの開閉ボタンとチェックボックス一覧が、出現回数の多い順で描画される', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 't1', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO t1 VALUES (1)', migration_file: null, last_commit_hash: null },
      { query_name: 'B', command: 'exec', command_confirmed: 1, table_name: 't1', source_file: 'src/index.ts', source_line: 2, sql_text: 'INSERT INTO t1 VALUES (2)', migration_file: null, last_commit_hash: null },
      { query_name: 'C', command: 'one', command_confirmed: 1, table_name: 't2', source_file: 'src/index.ts', source_line: 3, sql_text: 'SELECT * FROM t2', migration_file: null, last_commit_hash: null },
    ]);
    expect(html).toContain('id="tablePanelToggle"');
    expect(html).toContain('aria-expanded="false"');
    const panelMatch = html.match(/<div class="filter-panel" id="tablePanel" hidden>([\s\S]*?)<\/div>/);
    expect(panelMatch).not.toBeNull();
    const panelText = panelMatch![1];
    const t1Idx = panelText.indexOf('value="t1"');
    const t2Idx = panelText.indexOf('value="t2"');
    expect(t1Idx).toBeGreaterThan(-1);
    expect(t2Idx).toBeGreaterThan(-1);
    expect(t1Idx).toBeLessThan(t2Idx);
    expect(panelText).toContain('(2)');
    expect(panelText).toContain('(1)');
  });

  it('パネルはhidden属性で初期状態は閉じている', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toContain('<div class="filter-panel" id="tablePanel" hidden>');
  });

  it('出力がテーブル名ごとの帯(見出しバー)+ミニ表にまとめられ、行に単独のテーブル列が無い', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO foo VALUES (1)', migration_file: null, last_commit_hash: null },
      { query_name: 'B', command: 'one', command_confirmed: 1, table_name: 'bar', source_file: 'src/index.ts', source_line: 2, sql_text: 'SELECT 1 FROM bar', migration_file: null, last_commit_hash: null },
    ]);
    expect(html).toContain('<section class="table-band" data-table="foo">');
    expect(html).toContain('<section class="table-band" data-table="bar">');
    expect(html).toContain('<span class="band-name">foo</span>');
    expect(html).toContain('<span class="band-count">1件</span>');
    // 帯に集約したため、行内に個別の「テーブル」列(th)は無い
    expect(html).not.toContain('<th>テーブル</th>');
  });

  it('帯はテーブル名の昇順で並ぶ', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'zzz_table', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO zzz_table VALUES (1)', migration_file: null, last_commit_hash: null },
      { query_name: 'B', command: 'one', command_confirmed: 1, table_name: 'aaa_table', source_file: 'src/index.ts', source_line: 2, sql_text: 'SELECT 1 FROM aaa_table', migration_file: null, last_commit_hash: null },
    ]);
    const aaaIdx = html.indexOf('data-table="aaa_table"');
    const zzzIdx = html.indexOf('data-table="zzz_table"');
    expect(aaaIdx).toBeGreaterThan(-1);
    expect(zzzIdx).toBeGreaterThan(-1);
    expect(aaaIdx).toBeLessThan(zzzIdx);
  });

  it('各テーブル帯はページ読み込み時すべて閉じている(aria-expanded=false・table-wrapがhidden)', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO foo VALUES (1)', migration_file: null, last_commit_hash: null },
      { query_name: 'B', command: 'one', command_confirmed: 1, table_name: 'bar', source_file: 'src/index.ts', source_line: 2, sql_text: 'SELECT 1 FROM bar', migration_file: null, last_commit_hash: null },
    ]);
    const bandMatches = [...html.matchAll(/<section class="table-band"[^>]*>[\s\S]*?<button type="button" class="band-header" aria-expanded="(\w+)">[\s\S]*?<div class="table-wrap"( hidden)?>/g)];
    expect(bandMatches.length).toBe(2);
    for (const m of bandMatches) {
      expect(m[1]).toBe('false');
      expect(m[2]).toBe(' hidden');
    }
  });

  it('帯の見出しはクリック可能なbutton要素で、開閉用の矢印アイコンを持つ', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO foo VALUES (1)', migration_file: null, last_commit_hash: null },
    ]);
    expect(html).toContain('<button type="button" class="band-header" aria-expanded="false">');
    expect(html).toContain('<span class="band-toggle-arrow">▾</span>');
  });
});
