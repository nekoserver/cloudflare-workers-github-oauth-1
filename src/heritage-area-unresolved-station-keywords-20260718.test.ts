import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { findHeritageAreaPoint, isStationNameKeywordPattern } from './index';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

// 対象: heritage-areaページのキーワード表示処理(/api/heritage-area/travel-categories/:id/keywords)。
// 「^(任意の文字列)駅$」の形(具体的な駅名。漢字表記(例:「姫路駅」)・全角カタカナ表記
// (海外駅の日本語表記に多いパターン、例:「サンタルチア駅」)の双方を含む)に一致する
// キーワードは、findHeritageAreaPointがRAIL_LINESから座標・国旗を引けた場合はボタン先頭に
// 国旗を表示し、引けなかった場合は従来のunresolved_airport_keywordsではなく専用の
// unresolved_station_keywordsテーブルに記録する(空港名テーブルへ駅名が混入するのを防ぐため、
// パターンに一致するキーワードはunresolved_airport_keywordsへの記録対象から除外する)。
// 「最寄り駅」はisGenericAirportCategoryKeywordが判定する汎用カテゴリラベルのため、
// 駅名候補としては扱わない(どちらのテーブルにも記録しない)。
describe('findHeritageAreaPoint — 鉄道駅(RAIL_LINES)の座標・国旗フォールバック', () => {
  it('RAIL_LINESに実在する駅名(日本国内、東海道新幹線)は座標・国旗を引ける', () => {
    const point = findHeritageAreaPoint('東京駅');
    expect(point).not.toBeNull();
    expect(point!.flag).toBe('🇯🇵');
    expect(point!.country).toBe('日本');
    expect(point!.lat).toBeCloseTo(35.681, 1);
  });

  it('駅ごとに国旗が個別指定されているケース(ユーロスターの英仏区間)はその駅の国旗を優先する', () => {
    const london = findHeritageAreaPoint('ロンドン・セントパンクラス駅');
    expect(london).not.toBeNull();
    expect(london!.flag).toBe('🇬🇧');
    expect(london!.country).toBe('イギリス');

    const paris = findHeritageAreaPoint('パリ北駅');
    expect(paris).not.toBeNull();
    expect(paris!.flag).toBe('🇫🇷');
    expect(paris!.country).toBe('フランス');
  });

  it('世界遺産・空港・鉄道駅のいずれにも存在しないキーワードは従来どおりnullを返す', () => {
    expect(findHeritageAreaPoint('存在しない駅名12345駅')).toBeNull();
  });
});

describe('isStationNameKeywordPattern — 駅名キーワードの判定', () => {
  it('漢字・カタカナいずれの「(文字列)駅」もtrueを返す', () => {
    expect(isStationNameKeywordPattern('姫路駅')).toBe(true);
    expect(isStationNameKeywordPattern('東京駅')).toBe(true);
    expect(isStationNameKeywordPattern('サンタルチア駅')).toBe(true);
    expect(isStationNameKeywordPattern('パリ・リヨン駅')).toBe(true);
  });

  it('汎用カテゴリラベル「最寄り駅」はfalseを返す(駅名候補として扱わない)', () => {
    expect(isStationNameKeywordPattern('最寄り駅')).toBe(false);
  });

  it('「駅」で終わらない文字列や空文字はfalseを返す', () => {
    expect(isStationNameKeywordPattern('姫路城')).toBe(false);
    expect(isStationNameKeywordPattern('駅前広場')).toBe(false);
    expect(isStationNameKeywordPattern('')).toBe(false);
  });
});

describe('heritage-areaページ: 国旗・座標不明な駅名キーワードの記録', () => {
  it('unresolved_station_keywords テーブル作成SQLがマイグレーション0082として登録されている', () => {
    expect(src).toContain("'0082': `CREATE TABLE IF NOT EXISTS unresolved_station_keywords");
    const idx = src.indexOf("'0082':");
    const block = src.slice(idx, idx + 400);
    expect(block).toContain('station_name TEXT NOT NULL');
    expect(block).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_unresolved_station_keywords_unique ON unresolved_station_keywords(station_name)');
  });

  it('STATUS_TABLE_DEFINITIONS に unresolved_station_keywords が登録されている', () => {
    const idx = src.indexOf('const STATUS_TABLE_DEFINITIONS');
    const endIdx = src.indexOf('];', idx);
    const block = src.slice(idx, endIdx);
    expect(block).toContain("name: 'unresolved_station_keywords'");
    expect(block).toContain("migration: '0082'");
  });

  it('TABLE_COLUMN_KEYS に unresolved_station_keywords の PK/UK が登録されている', () => {
    expect(src).toContain('unresolved_station_keywords: { id: \'pk\', station_name: \'uk\' }');
  });

  it('TABLE_GROUP_MAP に unresolved_station_keywords が system グループで登録されている', () => {
    expect(src).toContain("unresolved_station_keywords: 'system'");
  });

  it('recordUnresolvedStationKeywords関数がINSERT OR IGNOREでstation_nameを書き込む', () => {
    expect(src).toContain('async function recordUnresolvedStationKeywords');
    const idx = src.indexOf('async function recordUnresolvedStationKeywords');
    const block = src.slice(idx, idx + 500);
    expect(block).toContain('INSERT OR IGNORE INTO unresolved_station_keywords (station_name) VALUES (?)');
    expect(block).toContain('try {');
    expect(block).toContain('catch');
  });

  it('/api/heritage-area/travel-categories/:id/keywords ハンドラが駅名パターンのキーワードを判定しwaitUntilで記録する', () => {
    const idx = src.indexOf("app.get('/api/heritage-area/travel-categories/:id/keywords'");
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 2100);
    expect(block).toContain('isStationNameKeywordPattern(row.keyword)');
    expect(block).toContain('recordUnresolvedStationKeywords');
    expect(block).toContain('waitUntil');
  });

  it('駅名パターンに一致するキーワードは城パターンの次に判定され、unresolved_airport_keywordsへの記録対象からは除外される(else ifで分岐)', () => {
    const idx = src.indexOf("app.get('/api/heritage-area/travel-categories/:id/keywords'");
    const block = src.slice(idx, idx + 2100);
    expect(block).toMatch(/if\s*\(isCastleNameKeywordPattern\(row\.keyword\)\)\s*\{[^}]*unresolvedCastleNames\.push[^}]*\}\s*else if\s*\(isStationNameKeywordPattern\(row\.keyword\)\)\s*\{[^}]*unresolvedStationNames\.push[^}]*\}\s*else if\s*\(!isGenericAirportCategoryKeyword\(row\.keyword\)\)/);
  });
});
