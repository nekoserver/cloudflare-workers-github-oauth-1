// /muse-search のスレッド検索(スレッド一覧のタイトルの絞り込み)の記録(D1 muse_thread_search_log、マイグレーション0199、2026-11-20、ユーザー指定)。
// 仮説: 検索キー・ヒット件数・スレッドIDを1行追記する。件数はスレッドIDの数から作り、呼び出し元の値を信じない。
//   空のキー・長すぎるキー・不正なスレッドIDは、記録せず理由を返す。D1の障害・未設定も理由つきで返し、成功扱いにしない。
import { describe, expect, it } from 'vitest';
import { createD1, createMuseSearchKeysSqlite } from './museSearchKeys.testdb';
import { recordThreadSearch } from './museThreadSearchLog';

const rows = (sqlite: ReturnType<typeof createMuseSearchKeysSqlite>) => sqlite.prepare('SELECT user_id, search_key, hit_count, thread_ids FROM muse_thread_search_log ORDER BY id').all();

describe('recordThreadSearch', () => {
  it('キー(小文字にそろえる)・ヒット件数・スレッドIDを、そのユーザーの行として追記する。件数はスレッドIDの数', async () => {
    const sqlite = createMuseSearchKeysSqlite();
    const result = await recordThreadSearch(createD1(sqlite), { userId: 'u', key: '  Foo ', threadIds: ['t1', 't2'] });
    expect(result).toEqual({ ok: true, value: { hitCount: 2 } });
    expect(rows(sqlite)).toEqual([{ user_id: 'u', search_key: 'foo', hit_count: 2, thread_ids: '["t1","t2"]' }]);
  });
  it('ヒットが0件でも記録する(件数0・スレッドIDは空の配列)。同じキーを何度でも追記する', async () => {
    const sqlite = createMuseSearchKeysSqlite();
    const db = createD1(sqlite);
    await recordThreadSearch(db, { userId: 'u', key: 'x', threadIds: [] });
    await recordThreadSearch(db, { userId: 'u', key: 'x', threadIds: [] });
    expect(rows(sqlite)).toEqual([{ user_id: 'u', search_key: 'x', hit_count: 0, thread_ids: '[]' }, { user_id: 'u', search_key: 'x', hit_count: 0, thread_ids: '[]' }]);
  });
  it('重複するスレッドIDは1つにする(件数もそれに合わせる)', async () => {
    const sqlite = createMuseSearchKeysSqlite();
    const result = await recordThreadSearch(createD1(sqlite), { userId: 'u', key: 'x', threadIds: ['t1', 't1', 't2'] });
    expect(result).toEqual({ ok: true, value: { hitCount: 2 } });
  });
  it('空・空白だけ・501文字のキーは invalid_key。記録しない', async () => {
    const sqlite = createMuseSearchKeysSqlite();
    const db = createD1(sqlite);
    for (const key of ['', '   ', 'a'.repeat(501)]) {
      expect(await recordThreadSearch(db, { userId: 'u', key, threadIds: [] })).toMatchObject({ ok: false, errorCode: 'invalid_key' });
    }
    expect(rows(sqlite)).toEqual([]);
  });
  it('空のスレッドID・文字でないID・2001件を超える配列は invalid_thread_ids。記録しない', async () => {
    const sqlite = createMuseSearchKeysSqlite();
    const db = createD1(sqlite);
    for (const threadIds of [[''], ['  '], [1 as unknown as string], Array.from({ length: 2001 }, (_, i) => 't' + i)]) {
      expect(await recordThreadSearch(db, { userId: 'u', key: 'x', threadIds })).toMatchObject({ ok: false, errorCode: 'invalid_thread_ids' });
    }
    expect(rows(sqlite)).toEqual([]);
  });
  it('D1の障害は db_error、D1が無いときは db_missing(どちらも理由つき。成功にしない)', async () => {
    const sqlite = createMuseSearchKeysSqlite();
    expect(await recordThreadSearch(createD1(sqlite, { failOn: /INSERT INTO muse_thread_search_log/ }), { userId: 'u', key: 'x', threadIds: [] })).toMatchObject({ ok: false, errorCode: 'db_error', detail: expect.stringContaining('d1 down') });
    expect(await recordThreadSearch(undefined, { userId: 'u', key: 'x', threadIds: [] })).toMatchObject({ ok: false, errorCode: 'db_missing' });
  });
});
