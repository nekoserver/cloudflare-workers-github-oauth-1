import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// 対象: 新規ページ /query-builder(GET)、/api/query-builder/columns(GET)、
// /api/query-builder/run(POST)。「どのテーブル・どのカラムに対してどう
// 取り出すか」を選択式で組み立てて実行するページのルート層。
// 実際のSQL組み立て・検証ロジックはsrc/utils/queryBuilder.test.tsで検証済み。
// ここではルート層が正しい許可リストと検証関数を使っているか、
// 異常系のステータスコードが揃っているかをテキスト抽出で検証する
// (query-pattern-analysis-route.test.tsと同じ手法)。

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

function extractRouteBlock(startNeedle: string): string {
  const idx = src.indexOf(startNeedle);
  if (idx === -1) throw new Error(`route not found: ${startNeedle}`);
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
}

const pageRouteBlock = extractRouteBlock("app.get('/query-builder'");
const columnsRouteBlock = extractRouteBlock("app.get('/api/query-builder/columns'");
const runRouteBlock = extractRouteBlock("app.post('/api/query-builder/run'");

describe('GET /query-builder', () => {
  it('認証必須(authMiddleware)である', () => {
    expect(pageRouteBlock).toContain("app.get('/query-builder', authMiddleware,");
  });

  it('STATUS_TABLE_DEFINITIONSからテーブル一覧(名前・説明のみ)を渡す(自由入力SQLは扱わない)', () => {
    expect(pageRouteBlock).toContain('STATUS_TABLE_DEFINITIONS.map((t) => ({ name: t.name, description: t.description }))');
    expect(pageRouteBlock).toContain('getQueryBuilderPage(tables)');
  });
});

describe('GET /api/query-builder/columns', () => {
  it('認証必須(authMiddleware)である', () => {
    expect(columnsRouteBlock).toContain("app.get('/api/query-builder/columns', authMiddleware,");
  });

  it('DB未設定時は503を返す', () => {
    expect(columnsRouteBlock).toContain("if (!db) return c.json({ error: 'DB未設定です' }, 503);");
  });

  it('STATUS_TABLE_DEFINITIONSに無いテーブル名は404を返す(許可リスト外を拒否)', () => {
    expect(columnsRouteBlock).toContain('STATUS_TABLE_DEFINITIONS.find((t) => t.name === tableName)');
    expect(columnsRouteBlock).toMatch(/if \(!known\) return c\.json\(\{ error: `テーブル \$\{tableName\} は許可されていません` \}, 404\);/);
  });

  it('PRAGMA table_infoでカラム一覧を取得し、0件は500(未作成の可能性)を返す', () => {
    expect(columnsRouteBlock).toContain('PRAGMA table_info(${tableName})');
    expect(columnsRouteBlock).toContain('columns.length === 0');
  });
});

describe('POST /api/query-builder/run', () => {
  it('認証必須(authMiddleware)である', () => {
    expect(runRouteBlock).toContain("app.post('/api/query-builder/run', authMiddleware,");
  });

  it('DB未設定時は503、壊れたJSONは400、table未指定は400を返す', () => {
    expect(runRouteBlock).toContain("if (!db) return c.json({ error: 'DB未設定です' }, 503);");
    expect(runRouteBlock).toContain("return c.json({ error: 'リクエストは有効なJSONで指定してください' }, 400);");
    expect(runRouteBlock).toContain("return c.json({ error: 'tableを指定してください' }, 400);");
  });

  it('STATUS_TABLE_DEFINITIONSに無いテーブル名は404を返す(許可リスト外を拒否)', () => {
    expect(runRouteBlock).toContain('STATUS_TABLE_DEFINITIONS.find((t) => t.name === spec.table)');
    expect(runRouteBlock).toMatch(/if \(!known\) return c\.json\(\{ error: `テーブル \$\{spec\.table\} は許可されていません` \}, 404\);/);
  });

  it('カラム許可リストをPRAGMA table_infoで都度取得してからbuildQueryへ渡す', () => {
    expect(runRouteBlock).toContain('PRAGMA table_info(${spec.table})');
    expect(runRouteBlock).toContain('buildQuery(spec, allowedColumns)');
  });

  it('buildQueryの失敗はerrorCode付きで400を返す(文字列prefix判定ではなく判別可能な結果型)', () => {
    expect(runRouteBlock).toContain('if (!built.ok) return c.json');
    expect(runRouteBlock).toContain('[${built.errorCode}] ${built.detail}');
  });

  it('値は必ず.bind(...built.value.params)で渡す(SQL文字列への直接埋め込みをしない)', () => {
    expect(runRouteBlock).toContain('.bind(...built.value.params)');
  });

  it('クエリ実行失敗時はSQLと共に500を返す(原因追跡できるようにする)', () => {
    expect(runRouteBlock).toContain('クエリ実行に失敗しました');
    expect(runRouteBlock).toContain('sql: built.value.sql');
  });
});
