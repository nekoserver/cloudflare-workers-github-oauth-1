import { describe, it, expect } from 'vitest';
import { buildQuery, type QuerySpec } from './queryBuilder';

// 対象: /query-builder ページの中核ロジック(buildQuery)。「どのテーブル・
// どのカラムに対してどう取り出すか」を選択式の QuerySpec から検証し、
// パラメータ化されたSQLへ変換する。
//
// 故障シナリオ:
//   (1) 許可されていないカラム名(PRAGMA由来の一覧に無い)が来る → 拒否する
//   (2) IN句が0件・上限超過 → 拒否する
//   (3) LIMITが0・負数・小数・上限超過 → 拒否する
//   (4) HAVINGの演算子・比較値の片方だけが来る → 拒否する
//   (5) カラム重複指定 → 拒否する
//   (6) 値側は必ず.bind()パラメータになり、SQL文字列へ埋め込まれない

const columns = ['id', 'user_id', 'status', 'created_at', 'count'];

function baseSpec(overrides: Partial<QuerySpec> = {}): QuerySpec {
  return {
    table: 'sample_table',
    mode: 'rows',
    columns: ['id', 'status'],
    filters: [],
    limit: 20,
    ...overrides,
  };
}

describe('buildQuery: rows モード', () => {
  it('カラム選択のみでSELECT文とLIMITパラメータを組み立てる', () => {
    const r = buildQuery(baseSpec(), columns);
    expect(r).toMatchObject({ ok: true, value: { sql: 'SELECT id, status FROM sample_table LIMIT ?', params: [20] } });
  });

  it('WHERE(eq/neq/like/in/is_null/is_not_null/between)を全てAND結合し、値はbindパラメータになる', () => {
    const r = buildQuery(
      baseSpec({
        filters: [
          { column: 'status', op: 'eq', value: 'ok' },
          { column: 'user_id', op: 'neq', value: 'x' },
          { column: 'status', op: 'like', value: 'err' },
          { column: 'user_id', op: 'in', values: ['a', 'b'] },
          { column: 'created_at', op: 'is_null' },
          { column: 'created_at', op: 'is_not_null' },
          { column: 'count', op: 'between', from: '1', to: '10' },
        ],
      }),
      columns
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sql).toBe(
      'SELECT id, status FROM sample_table WHERE status = ? AND user_id <> ? AND status LIKE ? AND user_id IN (?, ?) AND created_at IS NULL AND created_at IS NOT NULL AND count BETWEEN ? AND ? LIMIT ?'
    );
    expect(r.value.params).toEqual(['ok', 'x', '%err%', 'a', 'b', '1', '10', 20]);
  });

  it('ORDER BYを付けられる(方向も検証する)', () => {
    const r = buildQuery(baseSpec({ orderBy: { column: 'created_at', direction: 'desc' } }), columns);
    expect(r).toMatchObject({ ok: true, value: { sql: 'SELECT id, status FROM sample_table ORDER BY created_at DESC LIMIT ?' } });
  });

  it('許可リストに無いカラムはSELECT・WHERE・ORDER BYどこでも拒否する', () => {
    expect(buildQuery(baseSpec({ columns: ['secret_column'] }), columns)).toMatchObject({ ok: false, errorCode: 'BAD_COLUMNS' });
    expect(buildQuery(baseSpec({ filters: [{ column: 'secret_column', op: 'eq', value: 'x' }] }), columns)).toMatchObject({ ok: false, errorCode: 'BAD_FILTER' });
    expect(buildQuery(baseSpec({ orderBy: { column: 'secret_column', direction: 'asc' } }), columns)).toMatchObject({ ok: false, errorCode: 'BAD_ORDER_BY' });
  });

  it('SQL構文を混ぜ込もうとするカラム名は識別子として弾かれる(許可リストにも一致しないため二重に拒否)', () => {
    const r = buildQuery(baseSpec({ columns: ['id; DROP TABLE sample_table; --'] }), columns);
    expect(r).toMatchObject({ ok: false, errorCode: 'BAD_COLUMNS' });
  });

  it('カラムの重複指定を拒否する', () => {
    const r = buildQuery(baseSpec({ columns: ['id', 'id'] }), columns);
    expect(r).toMatchObject({ ok: false, errorCode: 'BAD_COLUMNS' });
  });

  it('カラム未選択を拒否する', () => {
    const r = buildQuery(baseSpec({ columns: [] }), columns);
    expect(r).toMatchObject({ ok: false, errorCode: 'BAD_COLUMNS' });
  });

  it.each([0, -1, 1.5, 201, Number.NaN])('LIMIT %s は BAD_LIMIT', (limit) => {
    expect(buildQuery(baseSpec({ limit: limit as number }), columns)).toMatchObject({ ok: false, errorCode: 'BAD_LIMIT' });
  });

  it('IN句が0件・51件超は BAD_FILTER', () => {
    expect(buildQuery(baseSpec({ filters: [{ column: 'user_id', op: 'in', values: [] }] }), columns)).toMatchObject({ ok: false, errorCode: 'BAD_FILTER' });
    const many = Array.from({ length: 51 }, (_, i) => String(i));
    expect(buildQuery(baseSpec({ filters: [{ column: 'user_id', op: 'in', values: many }] }), columns)).toMatchObject({ ok: false, errorCode: 'BAD_FILTER' });
  });
});

describe('buildQuery: aggregate モード', () => {
  function aggSpec(overrides: Partial<QuerySpec> = {}): QuerySpec {
    return { table: 'sample_table', mode: 'aggregate', columns: [], filters: [], groupByColumn: 'status', limit: 20, ...overrides };
  }

  it('GROUP BY + COUNT(*)を組み立てる', () => {
    const r = buildQuery(aggSpec(), columns);
    expect(r).toMatchObject({ ok: true, value: { sql: 'SELECT status, COUNT(*) AS cnt FROM sample_table GROUP BY status LIMIT ?', params: [20] } });
  });

  it('HAVING COUNT(*)を演算子つきで組み立てる', () => {
    const r = buildQuery(aggSpec({ havingCountOp: 'gte', havingCountValue: 3 }), columns);
    expect(r).toMatchObject({ ok: true, value: { sql: 'SELECT status, COUNT(*) AS cnt FROM sample_table GROUP BY status HAVING COUNT(*) >= ? LIMIT ?', params: [3, 20] } });
  });

  it('WHEREと組み合わせられる(WHEREが先、HAVINGが後)', () => {
    const r = buildQuery(aggSpec({ filters: [{ column: 'user_id', op: 'eq', value: 'octocat' }], havingCountOp: 'eq', havingCountValue: 1 }), columns);
    expect(r).toMatchObject({
      ok: true,
      value: { sql: 'SELECT status, COUNT(*) AS cnt FROM sample_table WHERE user_id = ? GROUP BY status HAVING COUNT(*) = ? LIMIT ?', params: ['octocat', 1, 20] },
    });
  });

  it('HAVING演算子と比較値の片方だけ指定は BAD_HAVING', () => {
    expect(buildQuery(aggSpec({ havingCountOp: 'gte' }), columns)).toMatchObject({ ok: false, errorCode: 'BAD_HAVING' });
    expect(buildQuery(aggSpec({ havingCountValue: 3 }), columns)).toMatchObject({ ok: false, errorCode: 'BAD_HAVING' });
  });

  it('GROUP BY対象が許可リストに無ければ BAD_GROUP_BY', () => {
    expect(buildQuery(aggSpec({ groupByColumn: 'secret_column' }), columns)).toMatchObject({ ok: false, errorCode: 'BAD_GROUP_BY' });
  });
});

describe('buildQuery: 共通の異常系', () => {
  it('allowedColumnsが空(PRAGMA取得失敗相当)は NO_COLUMNS', () => {
    expect(buildQuery(baseSpec(), [])).toMatchObject({ ok: false, errorCode: 'NO_COLUMNS' });
  });

  it('仕様がオブジェクトでなければ NOT_OBJECT', () => {
    expect(buildQuery(null as unknown as QuerySpec, columns)).toMatchObject({ ok: false, errorCode: 'NOT_OBJECT' });
  });

  it('失敗時は detail が空文字にならない(rule8: 記録の義務)', () => {
    const r = buildQuery(baseSpec({ columns: [] }), columns);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail.length).toBeGreaterThan(0);
  });
});
