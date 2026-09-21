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
 *   (6) テーブル選択パネルのトグルボタン・単一選択バッジが正しく描画されず、
 *       テーブル名を帯(見出しバー)にまとめた出力にならない
 *   (7) テーブルバッジを切り替えても以前の選択・フィルタ状態が解除されない
 *   (8) 帯同士の余白が過剰(margin-bottom: 20px)で、閉じた状態でも一覧性が悪い
 *   (9) 帯に件数(data-count)が無い、または並び替えボタンが無くソートできない
 *   (10) 「コマンド」と「SQL」の間に「最終コミット日時」列が無い、または
 *        YMD HMS形式で表示されない
 *   (11) SQLセルをタップしても詳細ダイアログが開けず、SQL全文やカタログ情報を確認できない
 *   (12) SQL詳細用WASMがページ初期表示から読み込まれる、または行ごとに再初期化される
 *   (13) SQL全文を未エスケープで埋め込みXSSが起きる、またはWASM実行用CSPが不足する
 *   (14) 詳細ダイアログが既存モーダルの背面に入り、キーボードで開閉・復帰できない
 *   (15) 一覧では色分けされるSQLが、詳細ダイアログではプレーンテキストに戻る
 *   (16) テーブル帯を開いても、バインド値なしで実行できるSQLと入力が必要なSQLを
 *        行の枠色とテキストで判別できない
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

function createMockDb(rows: Record<string, unknown>[] = [], prefValue: string | null = null) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          if (sql.includes('user_preferences')) {
            return Promise.resolve(prefValue !== null ? { pref_value: prefValue } : null);
          }
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
    expect(html).toContain('クエリーマネージャ');
  });

  it('最上部の帯は最小の44px高でスクロール時も固定表示される', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toMatch(/\.navbar\s*\{[^}]*position:\s*sticky;\s*top:\s*0;\s*z-index:\s*200;/s);
    expect(html).toMatch(/\.navbar\s*\{[^}]*padding:\s*0 20px;[^}]*height:\s*44px;/s);
    expect(html).toMatch(/\.user-icon\s*\{[^}]*width:\s*32px;\s*height:\s*32px;/s);
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
        last_commit_hash: null, last_commit_at: null,
      },
    ]);
    expect(html).not.toContain('<b>Evil</b>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('SQL詳細モーダル用の全文にもシンタックスハイライトを適用する', () => {
    const html = getD1QueryCatalogPage('tester', [
      {
        query_name: 'HighlightedQuery',
        command: 'many',
        command_confirmed: 1,
        table_name: 'users',
        source_file: 'src/index.ts',
        source_line: 1,
        sql_text: "SELECT id FROM users WHERE name = 'Alice' AND score >= 10 -- active only",
        migration_file: null,
        last_commit_hash: null,
        last_commit_at: null,
      },
    ]);
    const highlightedSql = html.match(/<span class="query-detail-sql-highlighted" hidden>([\s\S]*?)<\/span><\/td>/);
    expect(highlightedSql).not.toBeNull();
    expect(highlightedSql![1]).toContain('<span class="sql-token sql-keyword">SELECT</span>');
    expect(highlightedSql![1]).toContain('<span class="sql-token sql-string">&#39;Alice&#39;</span>');
    expect(highlightedSql![1]).toContain('<span class="sql-token sql-number">10</span>');
    expect(highlightedSql![1]).toContain('<span class="sql-token sql-comment">-- active only</span>');
    expect(html).toContain("document.getElementById('sqlDetailSql').innerHTML = highlightedSql ? highlightedSql.innerHTML : '';");
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

  it('全件検査と実行メソッド確認済み件数を混同せずに表示する', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'one', command_confirmed: 1, table_name: 't', source_file: 'src/index.ts', source_line: 1, sql_text: 'SELECT 1', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'B', command: 'exec', command_confirmed: 0, table_name: 't', source_file: 'src/index.ts', source_line: 2, sql_text: 'DELETE FROM t', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);
    expect(html).toContain('カタログ全2件');
    expect(html).toContain('実行メソッド確認済み1件');
    expect(html).toContain('SQL動詞からの推定1件');
    expect(html).not.toContain('コマンド種別確定済み1件(sqlcパーサーで検証済み)');
  });

  it('推定分を含むカタログ全件をsqlcアノテーションパーサーで一括検査できる', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'one', command_confirmed: 1, table_name: 't', source_file: 'src/index.ts', source_line: 1, sql_text: 'SELECT 1', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'B', command: 'exec', command_confirmed: 0, table_name: 't', source_file: 'src/index.ts', source_line: 2, sql_text: 'DELETE FROM t', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);

    expect(html).toContain('id="verifyAllAnnotationsButton"');
    expect(html).toContain('全2件のアノテーションを検査');
    expect(html).toContain('id="catalogVerificationStatus"');
    expect(html).toContain("document.querySelectorAll('#tableBands tbody tr')");
    expect(html).toContain("globalThis.sqlcParseQueryAnnotations(input)");
    expect(html).toContain("'全' + catalogRows.length + '件のアノテーション形式を検査しました");
    expect(html).toContain('SQL構文・スキーマ・実行結果の検証ではありません');
  });

  it('登録位置・クエリ名の重複を修正必須として検出し、修正プランを表示する', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'DuplicateName', command: 'many', command_confirmed: 1, table_name: 'users', source_file: 'src/index.ts', source_line: 10, sql_text: 'SELECT id FROM users', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'duplicatename', command: 'many', command_confirmed: 1, table_name: 'users', source_file: 'src/index.ts', source_line: 10, sql_text: 'SELECT name FROM users', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);

    expect(html).toContain('重複登録監査');
    expect(html).toContain('修正必須 2グループ / 要確認 0グループ');
    expect(html).toContain('登録位置の重複');
    expect(html).toContain('クエリ名の重複');
    expect(html).toContain('修正プラン');
    expect(html).toContain('migration 0154');
  });

  it('空白と大文字小文字だけが異なる同一SQLは、自動削除せず要確認候補にする', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'FindUserA', command: 'one', command_confirmed: 1, table_name: 'users', source_file: 'src/a.ts', source_line: 1, sql_text: 'SELECT id FROM users WHERE id = ?', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'FindUserB', command: 'one', command_confirmed: 1, table_name: 'users', source_file: 'src/b.ts', source_line: 2, sql_text: ' select ID   from USERS where ID = ? ', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);

    expect(html).toContain('修正必須 0グループ / 要確認 1グループ');
    expect(html).toContain('同一SQL（要確認）');
    expect(html).toContain('意図的な再利用は維持する');
    expect(html).toContain('id="duplicateAuditToggle"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('id="duplicateAuditContent" hidden');
    expect(html).toContain("duplicateAuditContent.hidden = expanded;");
  });

  it('修正必須の重複がある場合は監査内容を初期表示する', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'DuplicateName', command: 'many', command_confirmed: 1, table_name: 'users', source_file: 'src/index.ts', source_line: 10, sql_text: 'SELECT id FROM users', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'duplicatename', command: 'many', command_confirmed: 1, table_name: 'users', source_file: 'src/index.ts', source_line: 10, sql_text: 'SELECT name FROM users', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);

    expect(html).toContain('id="duplicateAuditToggle"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('id="duplicateAuditContent">');
    expect(html).not.toContain('id="duplicateAuditContent" hidden');
  });

  it('重複がない場合は重複登録監査を表示しない', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'many', command_confirmed: 1, table_name: 'users', source_file: 'src/a.ts', source_line: 1, sql_text: 'SELECT id FROM users', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'B', command: 'exec', command_confirmed: 1, table_name: 'users', source_file: 'src/b.ts', source_line: 2, sql_text: 'UPDATE users SET name = ?', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);

    expect(html).not.toContain('重複登録監査');
    expect(html).not.toContain('<section class="duplicate-audit"');
    expect(html).not.toContain('修正プラン');
  });

  it('発行SQL種別の複数選択セレクトボックスが、出現回数の多い順で表示される', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 't1', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO t1 VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'B', command: 'exec', command_confirmed: 1, table_name: 't2', source_file: 'src/index.ts', source_line: 2, sql_text: 'INSERT INTO t2 VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'C', command: 'one', command_confirmed: 1, table_name: 't1', source_file: 'src/index.ts', source_line: 3, sql_text: 'SELECT * FROM t1', migration_file: null, last_commit_hash: null, last_commit_at: null },
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
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 1, sql_text: 'UPDATE foo SET x = 1', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);
    expect(html).toContain('data-verb="UPDATE"');
  });

  it('テーブル名不明でも発行SQL種別(PRAGMA等)は判定できる', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 0, table_name: null, source_file: 'src/index.ts', source_line: 1, sql_text: 'PRAGMA table_info(${tableName})', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);
    expect(html).toContain('data-verb="PRAGMA"');
  });

  it('テーブル選択パネルのトグルボタンとバッジ一覧が、出現回数の多い順で描画される', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 't1', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO t1 VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'B', command: 'exec', command_confirmed: 1, table_name: 't1', source_file: 'src/index.ts', source_line: 2, sql_text: 'INSERT INTO t1 VALUES (2)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'C', command: 'one', command_confirmed: 1, table_name: 't2', source_file: 'src/index.ts', source_line: 3, sql_text: 'SELECT * FROM t2', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);
    expect(html).toContain('id="tablePanelToggle"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('<span>テーブルで絞り込み</span>');
    const panelMatch = html.match(/<div class="table-badge-list">([\s\S]*?)<\/div>/);
    expect(panelMatch).not.toBeNull();
    const panelText = panelMatch![1];
    const t1Idx = panelText.indexOf('data-table="t1"');
    const t2Idx = panelText.indexOf('data-table="t2"');
    expect(t1Idx).toBeGreaterThan(-1);
    expect(t2Idx).toBeGreaterThan(-1);
    expect(t1Idx).toBeLessThan(t2Idx);
    expect(panelText).toContain('<span class="table-badge-count">2</span>');
    expect(panelText).toContain('<span class="table-badge-name">t1</span>');
    expect(panelText).not.toContain('type="checkbox"');
  });

  it('パネルはhidden属性で初期状態は閉じている', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toContain('<div class="filter-panel" id="tablePanel" hidden>');
  });

  it('出力がテーブル名ごとの帯(見出しバー)+ミニ表にまとめられ、行に単独のテーブル列が無い', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO foo VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'B', command: 'one', command_confirmed: 1, table_name: 'bar', source_file: 'src/index.ts', source_line: 2, sql_text: 'SELECT 1 FROM bar', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);
    expect(html).toContain('<section class="table-band" data-table="foo" data-count="1">');
    expect(html).toContain('<section class="table-band" data-table="bar" data-count="1">');
    expect(html).toContain('<span class="band-name">foo</span>');
    expect(html).toContain('<span class="band-count">1件</span>');
    // 帯に集約したため、行内に個別の「テーブル」列(th)は無い
    expect(html).not.toContain('<th>テーブル</th>');
  });

  it('帯はテーブル名の昇順で並ぶ', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'zzz_table', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO zzz_table VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'B', command: 'one', command_confirmed: 1, table_name: 'aaa_table', source_file: 'src/index.ts', source_line: 2, sql_text: 'SELECT 1 FROM aaa_table', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);
    const aaaIdx = html.indexOf('<section class="table-band" data-table="aaa_table"');
    const zzzIdx = html.indexOf('<section class="table-band" data-table="zzz_table"');
    expect(aaaIdx).toBeGreaterThan(-1);
    expect(zzzIdx).toBeGreaterThan(-1);
    expect(aaaIdx).toBeLessThan(zzzIdx);
  });

  it('各テーブル帯はページ読み込み時すべて閉じている(aria-expanded=false・table-wrapがhidden)', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO foo VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'B', command: 'one', command_confirmed: 1, table_name: 'bar', source_file: 'src/index.ts', source_line: 2, sql_text: 'SELECT 1 FROM bar', migration_file: null, last_commit_hash: null, last_commit_at: null },
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
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO foo VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);
    expect(html).toContain('<button type="button" class="band-header" aria-expanded="false">');
    expect(html).toContain('<span class="band-toggle-arrow">▾</span>');
  });

  it('テーブルバッジは単一選択で、新しく押すたび以前の選択を解除し、再タップなら選択自体を解除する', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO foo VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'B', command: 'one', command_confirmed: 1, table_name: 'bar', source_file: 'src/index.ts', source_line: 2, sql_text: 'SELECT 1 FROM bar', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);
    expect(html).toContain("tableBadges.forEach(function(other) { other.setAttribute('aria-pressed', 'false'); });");
    expect(html).toContain("badge.setAttribute('aria-pressed', wasPressed ? 'false' : 'true');");
    expect(html).toContain('applyFilters();');
    expect(html).toContain("var selectedBadge = tableBadges.find(function(badge) { return badge.getAttribute('aria-pressed') === 'true'; });");
    expect(html).toContain("var tableMatches = (selectedTable === null || selectedTable === table);");
    expect(html).not.toContain('tableFilterAll');
  });

  it('並び替えトグルの左に「すべて解除」を置き、選択バッジと画面下の絞り込みを解除する', () => {
    const html = getD1QueryCatalogPage('tester', []);
    const clearIdx = html.indexOf('id="tableFilterClear"');
    const toggleIdx = html.indexOf('id="tableBadgeSortToggle"');
    expect(clearIdx).toBeGreaterThan(-1);
    expect(toggleIdx).toBeGreaterThan(clearIdx);
    expect(html).toContain("tableBadges.forEach(function(badge) { badge.setAttribute('aria-pressed', 'false'); });");
    expect(html.slice(html.indexOf("document.getElementById('tableFilterClear')"))).toContain('applyFilters();');
  });

  it('テーブルバッジの余白と文字を小さくし、件数・カラム数に分類色由来の文字色を使う', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toMatch(/\.table-filter-badge\s*\{[^}]*padding:\s*1px;[^}]*font-size:\s*11px;/);
    expect(html).toMatch(/\.table-badge-count\s*\{[^}]*padding:\s*1px;[^}]*color:\s*var\(--badge-foreground\)/);
    expect(html).toMatch(/\.table-badge-name\s*\{[^}]*padding:\s*1px;/);
    expect(html).toMatch(/\.table-column-count\s*\{[^}]*padding:\s*1px 4px;[^}]*color:\s*var\(--badge-foreground\);[^}]*font:\s*8px/);
  });

  it('選択パネルはトグル直下で横幅いっぱいになり、バッジを左詰めで折り返す', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toMatch(/\.filter-panel\s*\{[^}]*width:\s*100%/);
    expect(html).toMatch(/\.table-badge-list\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap[^}]*justify-content:\s*flex-start/);
    expect(html).toMatch(/\.table-badge-list\s*\{[^}]*row-gap:\s*1px/);
  });

  it('帯同士の余白(margin-bottom)が最小化されている(20pxのような広い余白の回帰防止)', () => {
    const html = getD1QueryCatalogPage('tester', []);
    const rule = html.match(/\.table-band\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toMatch(/margin-bottom:\s*[12]px/);
  });

  it('各帯にdata-count属性(クエリ件数)が付与され、件数順で並び替えるボタンがある', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO foo VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'B', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 2, sql_text: 'INSERT INTO foo VALUES (2)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'C', command: 'one', command_confirmed: 1, table_name: 'bar', source_file: 'src/index.ts', source_line: 3, sql_text: 'SELECT 1 FROM bar', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);
    expect(html).toContain('data-table="foo" data-count="2"');
    expect(html).toContain('data-table="bar" data-count="1"');
    expect(html).toContain('data-sort="name"');
    expect(html).toContain('data-sort="count"');
    // 既定(initialSort未指定時)は件数の多い順
    expect(html).toMatch(/class="sort-btn" data-sort="count" aria-pressed="true"/);
    // 件数の多い順が既定のため、bar(1件)よりfoo(2件)が先に描画される
    const fooIdx = html.indexOf('data-table="foo"');
    const barIdx = html.indexOf('data-table="bar"');
    expect(fooIdx).toBeGreaterThan(-1);
    expect(barIdx).toBeGreaterThan(-1);
    expect(fooIdx).toBeLessThan(barIdx);
  });

  it('帯の行頭(band-nameより前)に件数(band-count)が表示される', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO foo VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);
    const countIdx = html.indexOf('<span class="band-count">1件</span>');
    const nameIdx = html.indexOf('<span class="band-name">foo</span>');
    expect(countIdx).toBeGreaterThan(-1);
    expect(nameIdx).toBeGreaterThan(-1);
    expect(countIdx).toBeLessThan(nameIdx);
  });

  it('バインド値なしを注意色、入力必要を安全色の中抜き枠で示し、行の背景色は変えない', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'ListItems', command: 'many', command_confirmed: 1, table_name: 'items', source_file: 'src/index.ts', source_line: 1, sql_text: 'SELECT * FROM items', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'FindItem', command: 'one', command_confirmed: 1, table_name: 'items', source_file: 'src/index.ts', source_line: 2, sql_text: "SELECT * FROM items WHERE id = ? AND note = '?'", migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);

    expect(html).toContain('<span class="binding-summary-no">入力不要 1</span>');
    expect(html).toContain('<span class="binding-summary-required">入力必要 1</span>');
    expect(html).toContain('<tr class="query-no-bindings" data-verb="SELECT" data-binding-count="0">');
    expect(html).toContain('<tr class="query-with-bindings" data-verb="SELECT" data-binding-count="2">');
    expect(html).toContain('このSQLにはバインド値がなく、そのまま実行できます');
    expect(html).toContain('このSQLの実行には2個のバインド値が必要です');
    expect(html).not.toMatch(/tbody tr\.query-no-bindings td\s*\{[^}]*background:/);
    expect(html).not.toMatch(/tbody tr\.query-no-bindings td:first-child\s*\{[^}]*box-shadow:/);
    expect(html).not.toMatch(/tbody tr\.query-with-bindings td\s*\{[^}]*background:/);
    expect(html).not.toMatch(/tbody tr\.query-with-bindings td:first-child\s*\{[^}]*box-shadow:/);
    expect(html).toMatch(/\.binding-summary-no\s*\{[^}]*border-color: #d97706;/);
    expect(html).toMatch(/\.binding-summary-required\s*\{[^}]*border-color: #16a34a;/);
    expect(html).toMatch(/\.query-no-bindings \.binding-status\s*\{[^}]*border-color: #d97706;/);
    expect(html).toMatch(/\.query-with-bindings \.binding-status\s*\{[^}]*border-color: #16a34a;/);
    expect(html).toMatch(/\.binding-summary-no\s*\{[^}]*background: transparent;/);
    expect(html).toMatch(/\.binding-summary-required\s*\{[^}]*background: transparent;/);
    expect(html).toMatch(/\.query-no-bindings \.binding-status\s*\{[^}]*background: transparent;/);
    expect(html).toMatch(/\.query-with-bindings \.binding-status\s*\{[^}]*background: transparent;/);
  });

  it('SQL本文に ? も $ も無い場合だけバインド値なしに分類する', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'WineNames', command: 'many', command_confirmed: 1, table_name: 'wine_embeddings', source_file: 'src/index.ts', source_line: 1, sql_text: 'SELECT wine_name FROM wine_embeddings', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'WineByName', command: 'one', command_confirmed: 1, table_name: 'wine_embeddings', source_file: 'src/index.ts', source_line: 2, sql_text: 'SELECT wine_name FROM wine_embeddings WHERE wine_name = $wine_name', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);

    expect(html).toContain('<span class="binding-summary-no">入力不要 1</span>');
    expect(html).toContain('<span class="binding-summary-required">入力必要 1</span>');
    expect(html).toContain('<tr class="query-no-bindings" data-verb="SELECT" data-binding-count="0">');
    expect(html).toContain('<tr class="query-with-bindings" data-verb="SELECT" data-binding-count="1">');
  });

  it('文字列・コメント中であってもSQL本文に ? があれば入力必要に分類する', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'QuestionText', command: 'many', command_confirmed: 1, table_name: 'messages', source_file: 'src/index.ts', source_line: 3, sql_text: "SELECT '?' AS mark FROM messages -- ? is documentation", migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);

    expect(html).toContain('<span class="binding-summary-no">入力不要 0</span>');
    expect(html).toContain('<span class="binding-summary-required">入力必要 1</span>');
    expect(html).toContain('data-binding-count="2"');
    expect(html).not.toContain('data-binding-count="0"');
  });

  it('「コマンド」と「SQL」の間に「最終コミット日時」列がありYMD HMS形式で表示される', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO foo VALUES (1)', migration_file: null, last_commit_hash: 'abcdef1234567890', last_commit_at: '2026-05-31 00:36:59' },
    ]);
    const headerMatch = html.match(/<th>コマンド<\/th>\s*<th>([^<]+)<\/th>\s*<th>SQL<\/th>/);
    expect(headerMatch).not.toBeNull();
    expect(headerMatch![1]).toBe('最終コミット日時');
    expect(html).toContain('<td class="commit-at-cell"><code>2026-05-31 00:36:59</code></td>');
    // 位置関係: コマンドセルの直後・SQLセルの直前に日時セルが来る
    const commandCellIdx = html.indexOf(':exec');
    const commitAtIdx = html.indexOf('class="commit-at-cell"');
    const sqlCellIdx = html.indexOf('class="sql-cell"', commitAtIdx);
    expect(commandCellIdx).toBeLessThan(commitAtIdx);
    expect(commitAtIdx).toBeLessThan(sqlCellIdx);
  });

  it('最終コミット日時が無い場合は「(なし)」と表示される', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO foo VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ]);
    expect(html).toContain('<td class="commit-at-cell"><code>(なし)</code></td>');
  });

  it('SQLセルは詳細ダイアログを開くbuttonで、SQL全文を安全な非表示要素に保持する', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'GetA', command: 'one', command_confirmed: 1, table_name: 'foo', source_file: 'src/index.ts', source_line: 12, sql_text: "SELECT '<script>alert(1)</script>'\nFROM foo", migration_file: '0001.sql', last_commit_hash: null, last_commit_at: null },
    ]);
    expect(html).toContain('class="sql-detail-button"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-controls="sqlDetailDialog"');
    expect(html).toContain('class="query-detail-sql" hidden');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('FROM foo</span>');
    expect(html).not.toContain("SELECT '<script>alert(1)</script>'");
  });

  it('最上位SQL詳細dialogにカタログ情報・WASM状態・コピー操作がある', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toContain('<dialog id="sqlDetailDialog"');
    expect(html).toContain('id="sqlDetailTitle"');
    expect(html).toContain('id="sqlDetailWasmStatus"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('id="sqlDetailResult"');
    expect(html).toContain('id="copySqlButton"');
    expect(html).toContain('id="copySqlcButton"');
    expect(html).toContain('id="closeSqlDetailButton"');
    expect(html).toContain('DBへの問い合わせ、スキーマ照合、完全なsqlc構文解析は行いません。');
  });

  it('SQL全文コードブロック右側のRunボタンから登録済みSQLを実行できる', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toContain('class="sql-detail-code-wrap"');
    expect(html).toContain('id="runSqlButton"');
    expect(html).toContain('Run▶︎');
    expect(html).toContain("fetch('/api/d1-query-catalog/run'");
    expect(html).toContain("runSqlButton.addEventListener('click', runCurrentSql)");
    expect(html).toContain('id="sqlRunResult"');
    expect(html).toContain('id="sqlBindingsInput"');
    expect(html).toContain('JSON.stringify({ queryName: queryName, bindings: bindings })');
  });

  it('詳細モーダルからSQLite(D1)検査を明示的に実行できる', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toContain('id="parseD1SqlButton"');
    expect(html).toContain('sqlc parse --dialect SQLite(D1) ▶');
    expect(html).toContain("parseD1SqlButton.addEventListener('click', runD1Parse)");
    expect(html).toContain('実行する検査を選択してください。');
    expect(html).not.toContain("openSqlDetail(button) {\n      await ensureSqlcWasm()");
  });

  it('詳細モーダル内でPostgreSQL向けクエリ候補と方言差を調べられる', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toContain('id="comparePostgresButton"');
    expect(html).toContain('id="postgresSql"');
    expect(html).toContain('id="postgresDifferences"');
    expect(html).toContain('function postgresCandidate(sql)');
    expect(html).toContain("replacement = '$' + parameterIndex");
    expect(html).toContain('function renderPostgresSql(sql, ranges)');
    expect(html).toContain("target.className = 'sql-dialect-difference'");
    expect(html).toContain("tokenNode.className = 'sql-token sql-' + type");
    expect(html).toContain('D1クエリから変換された箇所、またはPostgreSQLとの方言差がある箇所です。');
    expect(html).toContain('renderPostgresSql(candidate.sql, addDialectRanges(candidate.sql, candidate.ranges))');
    expect(html).toContain('INSERT OR IGNORE / REPLACE はPostgreSQLでそのまま使えません。');
    expect(html).toContain('group_concatはPostgreSQLでは通常string_aggへ置き換えます。');
    expect(html).toContain('PostgreSQLとの差分候補を表示しました');
  });

  it('SQL詳細はsqlc WASMを遅延ロードし、初期化Promiseを再利用する', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toContain("import('/wasm/sqlc-wasm_exec.js')");
    expect(html).toContain("fetch('/wasm/sqlc.wasm')");
    expect(html).toContain('var sqlcWasmPromise = null');
    expect(html).toContain('function ensureSqlcWasm()');
    expect(html).toContain('sqlcParseQueryAnnotations(sqlcInput)');
  });

  it('SQL詳細dialogを開く前にgetNextZを適用し、静的モーダル一覧へ登録する', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toContain('function getNextZ()');
    expect(html).toContain('sqlDetailDialog: 1000');
    expect(html).toContain('sqlDetailDialog.style.zIndex = String(getNextZ())');
    expect(html).toContain('sqlDetailDialog.showModal()');
  });

  it('initialSort未指定時は既定で件数の多い順(count)が選択状態になる', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toMatch(/data-sort="count" aria-pressed="true"/);
    expect(html).toMatch(/data-sort="name" aria-pressed="false"/);
  });

  it('initialSort="name"を渡すとテーブル名順が選択状態になり、帯もテーブル名の昇順で描画される', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'zzz', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO zzz VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'B', command: 'exec', command_confirmed: 1, table_name: 'zzz', source_file: 'src/index.ts', source_line: 2, sql_text: 'INSERT INTO zzz VALUES (2)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'C', command: 'one', command_confirmed: 1, table_name: 'aaa', source_file: 'src/index.ts', source_line: 3, sql_text: 'SELECT 1 FROM aaa', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ], 'name');
    expect(html).toMatch(/data-sort="name" aria-pressed="true"/);
    const aaaIdx = html.indexOf('<section class="table-band" data-table="aaa"');
    const zzzIdx = html.indexOf('<section class="table-band" data-table="zzz"');
    expect(aaaIdx).toBeGreaterThan(-1);
    expect(zzzIdx).toBeGreaterThan(-1);
    expect(aaaIdx).toBeLessThan(zzzIdx);
  });

  it('initialSort="count"(既定)では件数の多いテーブルが先に描画される', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'exec', command_confirmed: 1, table_name: 'aaa_small', source_file: 'src/index.ts', source_line: 1, sql_text: 'INSERT INTO aaa_small VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'B', command: 'exec', command_confirmed: 1, table_name: 'zzz_big', source_file: 'src/index.ts', source_line: 2, sql_text: 'INSERT INTO zzz_big VALUES (1)', migration_file: null, last_commit_hash: null, last_commit_at: null },
      { query_name: 'C', command: 'one', command_confirmed: 1, table_name: 'zzz_big', source_file: 'src/index.ts', source_line: 3, sql_text: 'SELECT 1 FROM zzz_big', migration_file: null, last_commit_hash: null, last_commit_at: null },
    ], 'count');
    const smallIdx = html.indexOf('<section class="table-band" data-table="aaa_small"');
    const bigIdx = html.indexOf('<section class="table-band" data-table="zzz_big"');
    expect(smallIdx).toBeGreaterThan(-1);
    expect(bigIdx).toBeGreaterThan(-1);
    // アルファベット順ならaaa_smallが先だが、件数順(zzz_bigが2件)ではzzz_bigが先
    expect(bigIdx).toBeLessThan(smallIdx);
  });

  it('並び替え選択はPOST /api/preferences/d1_query_catalog_sortへfetchで保存する(Cookie/localStorageは使わない)', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).toContain("fetch('/api/preferences/d1_query_catalog_sort'");
    expect(html).not.toContain('d1_query_catalog_sort=');
    expect(html).not.toContain('localStorage.setItem');
    expect(html).not.toContain('localStorage.getItem');
  });
});

describe('POST /api/d1-query-catalog/run', () => {
  it('クライアントのSQLではなくカタログから取得したSQLを実行して結果を返す', async () => {
    const authHeader = await makeAuthHeader();
    const all = vi.fn().mockResolvedValue({ results: [{ value: 1 }], success: true });
    const first = vi.fn().mockResolvedValue({ sql_text: 'SELECT 1 AS value', command: 'one' });
    const db = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnValue({ first, all: vi.fn(), run: vi.fn() }),
        first: vi.fn().mockImplementation(() => sql.includes('user_sessions') ? Promise.resolve({ revoked_at: null }) : Promise.resolve(null)),
        all: sql === 'SELECT 1 AS value' ? all : vi.fn(),
        run: vi.fn(),
      })),
    };
    const res = await app.request('/api/d1-query-catalog/run', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryName: 'SelectOne', sql: 'DROP TABLE users' }),
    }, { JWT_SECRET, DB: db });
    expect(res.status).toBe(200);
    expect(db.prepare).toHaveBeenCalledWith('SELECT 1 AS value');
    expect(all).toHaveBeenCalledOnce();
    expect(await res.json()).toEqual({ ok: true, result: { results: [{ value: 1 }], success: true } });
  });

  it('カタログに存在しないクエリは実行しない', async () => {
    const authHeader = await makeAuthHeader();
    const db = createMockDb();
    const res = await app.request('/api/d1-query-catalog/run', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryName: 'Missing' }),
    }, { JWT_SECRET, DB: db });
    expect(res.status).toBe(404);
  });

  it('カタログSQLのプレースホルダーへリクエストの値をバインドして実行する', async () => {
    const authHeader = await makeAuthHeader();
    const all = vi.fn().mockResolvedValue({ results: [{ id: 7 }], success: true });
    const executionBind = vi.fn().mockReturnValue({ all });
    const catalogFirst = vi.fn().mockResolvedValue({
      sql_text: 'SELECT id FROM items WHERE user_id = ? AND score >= ?',
      command: 'many',
    });
    const db = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('user_sessions')) {
          return { bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue({ revoked_at: null }) }) };
        }
        if (sql.includes('FROM d1_query_catalog')) {
          return { bind: vi.fn().mockReturnValue({ first: catalogFirst }) };
        }
        return { bind: executionBind, all, run: vi.fn() };
      }),
    };
    const res = await app.request('/api/d1-query-catalog/run', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryName: 'ItemsByScore', bindings: ['user-1', 80] }),
    }, { JWT_SECRET, DB: db });
    expect(res.status).toBe(200);
    expect(executionBind).toHaveBeenCalledWith('user-1', 80);
    expect(all).toHaveBeenCalledOnce();
  });

  it('必要なバインド値が不足するとD1実行前に必要数を返す', async () => {
    const authHeader = await makeAuthHeader();
    const catalogFirst = vi.fn().mockResolvedValue({ sql_text: 'SELECT * FROM items WHERE user_id = ?', command: 'many' });
    const db = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('user_sessions')) {
          return { bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue({ revoked_at: null }) }) };
        }
        return { bind: vi.fn().mockReturnValue({ first: catalogFirst }) };
      }),
    };
    const res = await app.request('/api/d1-query-catalog/run', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryName: 'Items', bindings: [] }),
    }, { JWT_SECRET, DB: db });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'このSQLには1個のバインド値が必要です（受信: 0個）。', bindingCount: 1 });
  });
});

describe('GET /d1-query-catalog: 並び替え設定(user_preferences)の反映', () => {
  it('ページ限定CSPでWASM実行を許可する', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/d1-query-catalog',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb() }
    );
    expect(res.headers.get('Content-Security-Policy')).toContain("'wasm-unsafe-eval'");
  });

  it('user_preferencesにname設定があればテーブル名順が初期選択される', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/d1-query-catalog',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb([], 'name') }
    );
    const html = await res.text();
    expect(html).toMatch(/data-sort="name" aria-pressed="true"/);
  });

  it('user_preferencesに設定が無くCookieも無い場合は件数の多い順(count)が既定で初期選択される', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/d1-query-catalog',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb() }
    );
    const html = await res.text();
    expect(html).toMatch(/data-sort="count" aria-pressed="true"/);
  });

  it('user_preferencesに設定が無いが旧d1_query_catalog_sort Cookieが残っている場合、移行互換でその値を初期選択に使う', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/d1-query-catalog',
      { headers: { Authorization: authHeader, Cookie: 'd1_query_catalog_sort=name' } },
      { JWT_SECRET, DB: createMockDb() }
    );
    const html = await res.text();
    expect(html).toMatch(/data-sort="name" aria-pressed="true"/);
  });

  it('旧Cookieの値が不正な場合は無視され、件数の多い順(count)にフォールバックする', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/d1-query-catalog',
      { headers: { Authorization: authHeader, Cookie: 'd1_query_catalog_sort=bogus' } },
      { JWT_SECRET, DB: createMockDb() }
    );
    const html = await res.text();
    expect(html).toMatch(/data-sort="count" aria-pressed="true"/);
  });
});
