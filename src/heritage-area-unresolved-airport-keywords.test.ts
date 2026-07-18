import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { isGenericAirportCategoryKeyword } from './index';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

// 対象: heritage-areaページのキーワード表示処理(/api/heritage-area/travel-categories/:id/keywords)。
// 各キーワードが「^空港$」「^国内空港$」「^最寄り駅$」「^国際空港$」「^スイス国際空港協会$」の
// ような汎用ラベル・実在しない組織名では なく、かつ findHeritageAreaPoint で国旗・座標が
// 判明しない場合、その空港名を unresolved_airport_keywords テーブルに記録し、将来
// AIRPORT_LISTへ追加する調査対象を洗い出せるようにする。「スイス国際空港協会」は実際の
// 空港名ではないと確認済みのため、記録対象からは除外しつつ、空港カテゴリのキーワード一覧
// 自体からは除外しない(isGenericAirportCategoryKeywordはunresolved_airport_keywords記録の
// 要否判定にのみ使われ、キーワード一覧の表示には影響しない)。
describe('heritage-areaページ: 国旗・座標不明な空港名キーワードの記録', () => {
  it('isGenericAirportCategoryKeywordは5つの汎用ラベル・非空港名にのみ完全一致でtrueを返す', () => {
    expect(isGenericAirportCategoryKeyword('空港')).toBe(true);
    expect(isGenericAirportCategoryKeyword('国内空港')).toBe(true);
    expect(isGenericAirportCategoryKeyword('最寄り駅')).toBe(true);
    expect(isGenericAirportCategoryKeyword('国際空港')).toBe(true);
    expect(isGenericAirportCategoryKeyword('スイス国際空港協会')).toBe(true);
  });

  it('特定の空港名や部分一致するだけの文字列はfalseを返す(完全一致のみ対象)', () => {
    expect(isGenericAirportCategoryKeyword('成田国際空港')).toBe(false);
    expect(isGenericAirportCategoryKeyword('空港近く')).toBe(false);
    expect(isGenericAirportCategoryKeyword('謎の空港ABC')).toBe(false);
    expect(isGenericAirportCategoryKeyword('姫路城')).toBe(false);
    expect(isGenericAirportCategoryKeyword('スイス国際空港協会について')).toBe(false);
  });

  it('unresolved_airport_keywords テーブル作成SQLがマイグレーション0080として登録されている', () => {
    expect(src).toContain("'0080': `CREATE TABLE IF NOT EXISTS unresolved_airport_keywords");
    const idx = src.indexOf("'0080':");
    const block = src.slice(idx, idx + 400);
    expect(block).toContain('airport_name TEXT NOT NULL');
    expect(block).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_unresolved_airport_keywords_unique ON unresolved_airport_keywords(airport_name)');
  });

  it('STATUS_TABLE_DEFINITIONS に unresolved_airport_keywords が登録されている', () => {
    const idx = src.indexOf('const STATUS_TABLE_DEFINITIONS');
    const endIdx = src.indexOf('];', idx);
    const block = src.slice(idx, endIdx);
    expect(block).toContain("name: 'unresolved_airport_keywords'");
    expect(block).toContain("migration: '0080'");
  });

  it('TABLE_COLUMN_KEYS に unresolved_airport_keywords の PK/UK が登録されている', () => {
    expect(src).toContain('unresolved_airport_keywords: { id: \'pk\', airport_name: \'uk\' }');
  });

  it('TABLE_GROUP_MAP に unresolved_airport_keywords が system グループで登録されている', () => {
    expect(src).toContain("unresolved_airport_keywords: 'system'");
  });

  it('recordUnresolvedAirportKeywords関数がINSERT OR IGNOREでairport_nameを書き込む', () => {
    expect(src).toContain('async function recordUnresolvedAirportKeywords');
    const idx = src.indexOf('async function recordUnresolvedAirportKeywords');
    const block = src.slice(idx, idx + 500);
    expect(block).toContain('INSERT OR IGNORE INTO unresolved_airport_keywords (airport_name) VALUES (?)');
    expect(block).toContain('try {');
    expect(block).toContain('catch');
  });

  it('/api/heritage-area/travel-categories/:id/keywords ハンドラが各キーワードを判定しwaitUntilで記録する', () => {
    const idx = src.indexOf("app.get('/api/heritage-area/travel-categories/:id/keywords'");
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 2100);
    expect(block).toContain('isGenericAirportCategoryKeyword(row.keyword)');
    expect(block).toContain('recordUnresolvedAirportKeywords');
    expect(block).toContain('waitUntil');
  });
});
