import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

function extractRouteBlock(startNeedle: string): string {
  const idx = src.indexOf(startNeedle);
  if (idx === -1) throw new Error(`route not found: ${startNeedle}`);
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
}

const pageRouteBlock = extractRouteBlock("app.get('/query-pattern-analysis'");
const seedRouteBlock = extractRouteBlock("app.post('/api/query-pattern-analysis/seed'");

describe('GET /query-pattern-analysis', () => {
  it('認証必須(authMiddleware)である', () => {
    expect(pageRouteBlock).toContain("app.get('/query-pattern-analysis', authMiddleware,");
  });

  it('DB未設定時は503を返す', () => {
    expect(pageRouteBlock).toContain('if (!db) return c.text(');
  });

  it('STATUS_MIGRATION_SQLからテーブル定義を、STATUS_TABLE_DEFINITIONSから説明文を組み立てる', () => {
    expect(pageRouteBlock).toContain('extractTableSchemasFromSql(Object.values(STATUS_MIGRATION_SQL).join');
    expect(pageRouteBlock).toContain('STATUS_TABLE_DEFINITIONS.map((d) => [d.name, d.description])');
  });

  it('jev_table_pattern_scores未作成(テーブル無し)を異常終了させず空データ扱いにする', () => {
    expect(pageRouteBlock).toContain('isMissingTableError(message)');
    expect(pageRouteBlock).toContain('if (!isMissingTableError(message)) throw err;');
  });

  it('getQueryPatternAnalysisPageへ描画を委譲する', () => {
    expect(pageRouteBlock).toContain('c.html(getQueryPatternAnalysisPage(');
  });
});

describe('POST /api/query-pattern-analysis/seed', () => {
  it('認証必須(authMiddleware)である', () => {
    expect(seedRouteBlock).toContain("app.post('/api/query-pattern-analysis/seed', authMiddleware,");
  });

  it('JEV_API_KEY未設定時は503を返す', () => {
    expect(seedRouteBlock).toMatch(/if \(!c\.env\.JEV_API_KEY\) return c\.json\(\{ error: 'JEV_API_KEYが未設定です' \}, 503\);/);
  });

  it('tableName未指定は400を返す', () => {
    expect(seedRouteBlock).toContain("return c.json({ error: 'tableNameを指定してください' }, 400);");
  });

  it('未知のテーブル名は404を返す', () => {
    expect(seedRouteBlock).toMatch(/if \(!schema\) return c\.json\(\{ error: `テーブル \$\{tableName\} の定義が見つかりません` \}, 404\);/);
  });

  it('Jev API失敗時は502を返す', () => {
    expect(seedRouteBlock).toContain("`Jev APIへの問い合わせに失敗しました: ${result.detail}`");
    expect(seedRouteBlock).toContain(', 502);');
  });

  it('jev_table_pattern_scoresへON CONFLICTでUPSERTする', () => {
    expect(seedRouteBlock).toContain('INSERT INTO jev_table_pattern_scores');
    expect(seedRouteBlock).toContain('ON CONFLICT(table_name, judgment_code) DO UPDATE SET score = excluded.score');
  });

  it('成功時はスコア一覧をJSONで返す', () => {
    expect(seedRouteBlock).toContain('return c.json({ ok: true, scores });');
  });
});
