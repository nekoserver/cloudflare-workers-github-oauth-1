import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

describe('shared D1 registry remains owned by main', () => {
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
});
