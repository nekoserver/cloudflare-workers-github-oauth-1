import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getHarnessLogPage } from './views/harnessLog';

// 対象: 新規ページ /harness-log（src/views/harnessLog.ts の getHarnessLogPage、
// src/index.ts のルートハンドラ）。harness_hook_log テーブル（PostToolUseフックの
// 発火ログ、結果フラグ付き）を一覧表示するための管理者向け閲覧ページ。
//
// 故障シナリオ:
//   (1) harness_hook_log テーブルが未作成のままアクセスされ、素の500エラーになる
//       (D1コンソールでSQLを未実行のユーザーが最初にこのページを踏む可能性が高い)
//   (2) detail/file_path/session_id にHTML特殊文字が含まれる場合にエスケープ漏れでXSSになる
//   (3) result フィルタの選択状態がページ再読み込み後に失われる
//   (4) ok/ng/error 以外の未知のresult値が来た場合に表示が崩れる

describe('getHarnessLogPage: テーブル未作成時', () => {
  it('tableMissing=true の場合、migrationファイルの案内を表示し行は描画しない', () => {
    const html = getHarnessLogPage({ rows: [], counts: { ok: 0, ng: 0, error: 0 }, selectedResult: 'all', tableMissing: true });
    expect(html).toContain('harness_hook_log テーブルがまだ存在しません');
    expect(html).toContain('0083_create_harness_hook_log.sql');
    expect(html).not.toContain('<table>');
  });
});

describe('getHarnessLogPage: 空データ', () => {
  it('tableMissing=false かつ rows=[] の場合は「該当するログがありません」を表示する', () => {
    const html = getHarnessLogPage({ rows: [], counts: { ok: 0, ng: 0, error: 0 }, selectedResult: 'ng', tableMissing: false });
    expect(html).toContain('該当するログがありません');
    expect(html).not.toContain('<table>');
  });
});

describe('getHarnessLogPage: 行の描画とバッジ', () => {
  const baseRow = {
    id: 1,
    hook_event: 'PostToolUse',
    check_name: 'migration_table_registry_check',
    tool_name: 'Write',
    file_path: 'migrations/0099_create_foo.sql',
    result: 'ng',
    detail: 'foo: TABLE_COLUMN_KEYS 未登録',
    session_id: 'sess-abc',
    created_at: '2026-07-28T20:19:06.297Z',
  };

  it('ok/ng/error それぞれに対応するバッジクラスを描画する', () => {
    const html = getHarnessLogPage({
      rows: [
        { ...baseRow, id: 1, result: 'ok' },
        { ...baseRow, id: 2, result: 'ng' },
        { ...baseRow, id: 3, result: 'error' },
      ],
      counts: { ok: 1, ng: 1, error: 1 },
      selectedResult: 'all',
      tableMissing: false,
    });
    expect(html).toContain('badge-ok">OK<');
    expect(html).toContain('badge-ng">NG<');
    expect(html).toContain('badge-error">ERROR<');
  });

  it('tool_name/file_path/session_idがnullの場合は "—" で表示する', () => {
    const html = getHarnessLogPage({
      rows: [{ ...baseRow, tool_name: null, file_path: null, session_id: null }],
      counts: { ok: 0, ng: 1, error: 0 },
      selectedResult: 'all',
      tableMissing: false,
    });
    const rowMatches = html.match(/—/g) ?? [];
    expect(rowMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('timestampの秒までを表示し、Tを空白に変換する', () => {
    const html = getHarnessLogPage({
      rows: [baseRow],
      counts: { ok: 0, ng: 1, error: 0 },
      selectedResult: 'all',
      tableMissing: false,
    });
    expect(html).toContain('2026-07-28 20:19:06');
    expect(html).not.toContain('2026-07-28T20:19:06');
  });

  it('detail/file_path/session_idにHTML特殊文字が含まれてもエスケープする(XSS対策)', () => {
    const html = getHarnessLogPage({
      rows: [{
        ...baseRow,
        file_path: 'migrations/<script>alert(1)</script>.sql',
        detail: '<img src=x onerror=alert(1)>',
        session_id: '"><script>evil()</script>',
      }],
      counts: { ok: 0, ng: 1, error: 0 },
      selectedResult: 'all',
      tableMissing: false,
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('未知のresult値でも例外を投げず、フォールバックのbadge-noneで表示する', () => {
    const html = getHarnessLogPage({
      rows: [{ ...baseRow, result: 'unknown-value' }],
      counts: { ok: 0, ng: 0, error: 0 },
      selectedResult: 'all',
      tableMissing: false,
    });
    expect(html).toContain('badge-none');
    expect(html).toContain('unknown-value');
  });
});

describe('getHarnessLogPage: 結果フィルタの選択状態', () => {
  it('selectedResultに応じて対応するoptionにselectedが付く', () => {
    const html = getHarnessLogPage({ rows: [], counts: { ok: 2, ng: 3, error: 1 }, selectedResult: 'ng', tableMissing: false });
    expect(html).toContain('value="ng" selected');
    expect(html).not.toContain('value="all" selected');
    expect(html).not.toContain('value="ok" selected');
    expect(html).not.toContain('value="error" selected');
  });

  it('各optionのラベルにcountsの件数が反映される', () => {
    const html = getHarnessLogPage({ rows: [], counts: { ok: 2, ng: 3, error: 1 }, selectedResult: 'all', tableMissing: false });
    expect(html).toContain('OK (2)');
    expect(html).toContain('NG (3)');
    expect(html).toContain('ERROR (1)');
    expect(html).toContain('すべて (6)');
  });
});

describe('/harness-log ルートの配線', () => {
  const indexTsSrc = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');

  it("app.get('/harness-log', authMiddleware, ...) が登録されている(未認証アクセスを防ぐ)", () => {
    expect(indexTsSrc).toContain("app.get('/harness-log', authMiddleware, async (c) => {");
  });

  it('DB未設定時に500を返すガードがある', () => {
    const idx = indexTsSrc.indexOf("app.get('/harness-log'");
    const block = indexTsSrc.slice(idx, idx + 600);
    expect(block).toContain('if (!db)');
  });

  it('テーブル未作成時(catch節)にtableMissing:trueで200を返す(500エラーにしない)', () => {
    const idx = indexTsSrc.indexOf("app.get('/harness-log'");
    const endIdx = indexTsSrc.indexOf("\napp.get('/uuid'", idx);
    const block = indexTsSrc.slice(idx, endIdx);
    expect(block).toContain('tableMissing: true');
    expect(block).toMatch(/status:\s*200/);
  });

  it('ナビメニュー(welcome.ts)に /harness-log へのリンクがある', () => {
    const welcomeSrc = fs.readFileSync(path.resolve(__dirname, 'views', 'welcome.ts'), 'utf-8');
    expect(welcomeSrc).toContain('href="/harness-log"');
  });
});

describe('POST /internal/harness-hook-log: HARNESS_HOOK_SECRETが未設定の間は認証なしで受け付ける', () => {
  const indexTsSrc = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');

  function getRouteBlock(): string {
    const idx = indexTsSrc.indexOf("app.post('/internal/harness-hook-log'");
    expect(idx).toBeGreaterThan(-1);
    const endIdx = indexTsSrc.indexOf("\napp.get('/harness-log'", idx);
    expect(endIdx).toBeGreaterThan(idx);
    return indexTsSrc.slice(idx, endIdx);
  }

  it('secretが設定されている場合のみBearer認証チェックを行う(未設定なら認証をスキップする)', () => {
    const block = getRouteBlock();
    expect(block).toMatch(/if \(secret\) \{/);
    expect(block).toContain("return c.json({ error: 'Unauthorized' }, 401);");
  });

  it('DB未設定時は503を返すガードがある', () => {
    const block = getRouteBlock();
    expect(block).toContain("if (!c.env.DB) return c.json({ error: 'DB未設定です' }, 503);");
  });

  it('hookEvent/checkName/resultが空の場合は400を返す', () => {
    const block = getRouteBlock();
    expect(block).toContain('hookEvent/checkName/result は必須です');
  });
});
