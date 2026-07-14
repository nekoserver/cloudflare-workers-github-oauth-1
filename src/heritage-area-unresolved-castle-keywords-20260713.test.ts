import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { isCastleNameKeywordPattern } from './index';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

// 対象: heritage-areaページのキーワード表示処理(/api/heritage-area/travel-categories/:id/keywords)。
// 「^(全角カタカナ1文字以上)城$」の形(海外の城の日本語表記に多いパターン、例:
// 「ノイシュヴァンシュタイン城」)に一致するキーワードは、findHeritageAreaPointで
// 国旗・座標が判明しない場合、従来のunresolved_airport_keywordsではなく
// 専用のunresolved_castle_keywordsテーブルに記録する(空港名テーブルへ城の名前が
// 混入するのを防ぐため、パターンに一致するキーワードはunresolved_airport_keywords
// への記録対象から除外する)。
describe('heritage-areaページ: 国旗・座標不明な「(カタカナ)城」キーワードの記録', () => {
  it('isCastleNameKeywordPatternは「(全角カタカナ1文字以上)城」の完全一致にのみtrueを返す', () => {
    expect(isCastleNameKeywordPattern('ノイシュヴァンシュタイン城')).toBe(true);
    expect(isCastleNameKeywordPattern('エディンバラ城')).toBe(true);
    expect(isCastleNameKeywordPattern('プラハ城')).toBe(true);
    expect(isCastleNameKeywordPattern('リヴァプール城')).toBe(true);
  });

  it('漢字の城(姫路城等)・ひらがな・城が無い・カタカナが0文字の文字列はfalseを返す', () => {
    expect(isCastleNameKeywordPattern('姫路城')).toBe(false);
    expect(isCastleNameKeywordPattern('城')).toBe(false);
    expect(isCastleNameKeywordPattern('しろ城')).toBe(false);
    expect(isCastleNameKeywordPattern('エディンバラ')).toBe(false);
    expect(isCastleNameKeywordPattern('エディンバラ城跡')).toBe(false);
    expect(isCastleNameKeywordPattern('空港')).toBe(false);
  });

  it('unresolved_castle_keywords テーブル作成SQLがマイグレーション0081として登録されている', () => {
    expect(src).toContain("'0081': `CREATE TABLE IF NOT EXISTS unresolved_castle_keywords");
    const idx = src.indexOf("'0081':");
    const block = src.slice(idx, idx + 400);
    expect(block).toContain('castle_name TEXT NOT NULL');
    expect(block).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_unresolved_castle_keywords_unique ON unresolved_castle_keywords(castle_name)');
  });

  it('STATUS_TABLE_DEFINITIONS に unresolved_castle_keywords が登録されている', () => {
    const idx = src.indexOf('const STATUS_TABLE_DEFINITIONS');
    const endIdx = src.indexOf('];', idx);
    const block = src.slice(idx, endIdx);
    expect(block).toContain("name: 'unresolved_castle_keywords'");
    expect(block).toContain("migration: '0081'");
  });

  it('TABLE_COLUMN_KEYS に unresolved_castle_keywords の PK/UK が登録されている', () => {
    expect(src).toContain('unresolved_castle_keywords: { id: \'pk\', castle_name: \'uk\' }');
  });

  it('TABLE_GROUP_MAP に unresolved_castle_keywords が system グループで登録されている', () => {
    expect(src).toContain("unresolved_castle_keywords: 'system'");
  });

  it('recordUnresolvedCastleKeywords関数がINSERT OR IGNOREでcastle_nameを書き込む', () => {
    expect(src).toContain('async function recordUnresolvedCastleKeywords');
    const idx = src.indexOf('async function recordUnresolvedCastleKeywords');
    const block = src.slice(idx, idx + 500);
    expect(block).toContain('INSERT OR IGNORE INTO unresolved_castle_keywords (castle_name) VALUES (?)');
    expect(block).toContain('try {');
    expect(block).toContain('catch');
  });

  it('/api/heritage-area/travel-categories/:id/keywords ハンドラが城パターンのキーワードを判定しwaitUntilで記録する', () => {
    const idx = src.indexOf("app.get('/api/heritage-area/travel-categories/:id/keywords'");
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 1900);
    expect(block).toContain('isCastleNameKeywordPattern(row.keyword)');
    expect(block).toContain('recordUnresolvedCastleKeywords');
    expect(block).toContain('waitUntil');
  });

  it('城パターンに一致するキーワードはunresolved_airport_keywordsへの記録対象からは除外される(else ifで分岐)', () => {
    const idx = src.indexOf("app.get('/api/heritage-area/travel-categories/:id/keywords'");
    const block = src.slice(idx, idx + 1900);
    expect(block).toMatch(/if\s*\(isCastleNameKeywordPattern\(row\.keyword\)\)\s*\{[^}]*unresolvedCastleNames\.push[^}]*\}\s*else if\s*\(!isGenericAirportCategoryKeyword\(row\.keyword\)\)/);
  });
});
