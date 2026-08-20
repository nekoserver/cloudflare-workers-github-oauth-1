import { describe, it, expect } from 'vitest';
import {
  zeroPad4,
  buildHeritageMasterRows,
  buildHeritageMasterInsertStatements,
  escapeSqlString,
  type HeritageSeedSourceItem,
} from './heritage-master-seed';
import { HERITAGE_LIST } from '../data/heritageList';

describe('zeroPad4', () => {
  it('4桁ゼロパディングする', () => {
    expect(zeroPad4(1)).toBe('0001');
    expect(zeroPad4(42)).toBe('0042');
    expect(zeroPad4(911)).toBe('0911');
  });

  it('5桁以上はそのまま(将来911件を超えても壊れないことの確認)', () => {
    expect(zeroPad4(12345)).toBe('12345');
  });
});

describe('escapeSqlString', () => {
  it('シングルクオートを二重化する', () => {
    expect(escapeSqlString("O'Brien")).toBe("O''Brien");
  });

  it('シングルクオートを含まない文字列はそのまま', () => {
    expect(escapeSqlString('万里の長城')).toBe('万里の長城');
  });
});

describe('buildHeritageMasterRows', () => {
  const fixture: HeritageSeedSourceItem[] = [
    { e: '🏛️', f: '🇨🇳', n: '万里の長城', c: '中国', t: '文化遺産', y: 1987, lat: 40.4, lon: 116.6 },
    { e: '🌿', f: '🇮🇳', n: 'サンプル自然遺産', c: 'インド', t: '自然遺産', y: '----', lat: 1.1, lon: 2.2 },
    { e: '🏰', f: '🇯🇵', n: 'サンプル複合遺産', c: '日本', t: '複合遺産', y: 2000, lat: 3.3, lon: 4.4 },
  ];

  it('IDを0001から順番に、宣言順のまま連番で振る', () => {
    const rows = buildHeritageMasterRows(fixture);
    expect(rows.map((r) => r.id)).toEqual(['0001', '0002', '0003']);
  });

  it('未登録(----)はregistered_year=0に変換する', () => {
    const rows = buildHeritageMasterRows(fixture);
    expect(rows[0].registered_year).toBe(1987);
    expect(rows[1].registered_year).toBe(0);
    expect(rows[2].registered_year).toBe(2000);
  });

  it('分類用アイコンはheritageList.tsのeフィールド(遺産種別ごとの個別アイコン)を使う', () => {
    const rows = buildHeritageMasterRows(fixture);
    expect(rows[0].classification_icon).toBe('🏛️');
    expect(rows[1].classification_icon).toBe('🌿');
    expect(rows[2].classification_icon).toBe('🏰');
  });

  it('自由アイコンはwebglHeritage.tsの世界遺産カテゴリ共通アイコン(🏛️)を使う', () => {
    const rows = buildHeritageMasterRows(fixture);
    for (const row of rows) {
      expect(row.free_icon).toBe('🏛️');
    }
  });

  it('国旗・国名・遺産名・座標・種別を正しくマッピングする', () => {
    const rows = buildHeritageMasterRows(fixture);
    expect(rows[0]).toMatchObject({
      flag: '🇨🇳',
      country_name: '中国',
      heritage_name: '万里の長城',
      lat: 40.4,
      lon: 116.6,
      category: '文化遺産',
    });
  });
});

describe('buildHeritageMasterInsertStatements', () => {
  const fixture: HeritageSeedSourceItem[] = [
    { e: '🏛️', f: '🇨🇳', n: "O'Brien's Site", c: '中国', t: '文化遺産', y: 1987, lat: 40.4, lon: 116.6 },
    { e: '🌿', f: '🇮🇳', n: 'サンプル自然遺産', c: 'インド', t: '自然遺産', y: '----', lat: 1.1, lon: 2.2 },
  ];

  it('チャンクサイズごとにINSERT文を分割する', () => {
    const rows = buildHeritageMasterRows(fixture);
    const statements = buildHeritageMasterInsertStatements(rows, 1);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('INSERT INTO heritage_master');
    expect(statements[0].trim().endsWith(';')).toBe(true);
  });

  it('シングルクオートを含む値を正しくエスケープする', () => {
    const rows = buildHeritageMasterRows(fixture);
    const statements = buildHeritageMasterInsertStatements(rows, 10);
    expect(statements[0]).toContain("O''Brien''s Site");
  });

  it('delete_mark/moved_to/deleted_atはNULLで出力する', () => {
    const rows = buildHeritageMasterRows(fixture);
    const statements = buildHeritageMasterInsertStatements(rows, 10);
    expect(statements[0]).toMatch(/NULL, NULL, 'heritageList\.ts'/);
  });

  it('SQLコメント(--)を一切含まない', () => {
    const rows = buildHeritageMasterRows(fixture);
    const statements = buildHeritageMasterInsertStatements(rows, 10);
    for (const stmt of statements) {
      expect(stmt).not.toContain('--');
    }
  });
});

describe('HERITAGE_LIST とシード生成の整合性(ドリフト検知)', () => {
  it('HERITAGE_LISTの件数とシード行数が一致する', () => {
    const rows = buildHeritageMasterRows(HERITAGE_LIST);
    expect(rows).toHaveLength(HERITAGE_LIST.length);
  });

  it('最大IDがHERITAGE_LIST件数を4桁ゼロパディングした値と一致する', () => {
    const rows = buildHeritageMasterRows(HERITAGE_LIST);
    const maxId = rows[rows.length - 1].id;
    expect(maxId).toBe(zeroPad4(HERITAGE_LIST.length));
  });

  it('HERITAGE_LISTの全項目にシングルクオート・バックスラッシュが含まれない(エスケープ前提の検証)', () => {
    for (const item of HERITAGE_LIST) {
      for (const value of [item.n, item.c, item.t, item.f]) {
        expect(value.includes("'")).toBe(false);
        expect(value.includes('\\')).toBe(false);
      }
    }
  });

  it('分類用アイコン・自由アイコンはHERITAGE_LISTの全項目でNOT NULL相当(空文字ではない)', () => {
    const rows = buildHeritageMasterRows(HERITAGE_LIST);
    for (const row of rows) {
      expect(row.classification_icon.length).toBeGreaterThan(0);
      expect(row.free_icon.length).toBeGreaterThan(0);
    }
  });
});
