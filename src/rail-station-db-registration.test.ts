import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

describe('D1テーブル定義・登録の整合性', () => {
  it('rail_station_cities / rail_station_fetched のマイグレーションSQLが定義されている', () => {
    expect(src).toContain('CREATE TABLE IF NOT EXISTS rail_station_cities');
    expect(src).toContain('CREATE TABLE IF NOT EXISTS rail_station_fetched');
  });

  it('STATUS_TABLE_DEFINITIONS に両テーブルが登録されている', () => {
    expect(src).toMatch(/name: 'rail_station_cities'/);
    expect(src).toMatch(/name: 'rail_station_fetched'/);
  });

  it('TABLE_COLUMN_KEYS に両テーブルのPK/FK/UK定義がある', () => {
    expect(src).toMatch(/rail_station_cities: \{ id: 'pk', station_name: 'idx', city_name: 'uk' \}/);
    expect(src).toMatch(/rail_station_fetched: \{ station_name: 'pk' \}/);
  });

  it('TABLE_GROUP_MAP に両テーブルが登録されている', () => {
    expect(src).toMatch(/rail_station_cities: 'system'/);
    expect(src).toMatch(/rail_station_fetched: 'system'/);
  });
});

