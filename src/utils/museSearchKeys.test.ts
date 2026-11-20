// /muse-search の検索キーの記録(D1 muse_search_key_log、2026-11-19、ユーザー指定)。
// 検索キーを、AIチャットの応答ログ(ai_chat_shares.answer)での出現回数・tree-viewの会話ログでの出現回数・検索日時とともに記録し、
// 🔑ボタンのモーダルが、AIチャットでの出現回数の多い順に一覧する。
// 仮説:
//   1. 出現回数は「件数」ではなく「回数」。質問の本文は数えず、応答(answer)だけを、このユーザーの、論理削除されていない行から数える。
//   2. 記録は追記だけ。同じキーを何度検索しても行は増え、一覧はキーごとに最新の値・検索回数・最初と最後の検索日時を返す(集計は読むときに作る)。
//   3. 並びは、AIチャットでの出現回数の降順。同じなら、tree-viewでの出現回数の降順(未取得=NULLは最後)、最後に検索した新しい順、キー。
//   4. 制約に反する値(空のキー・501文字・負の数・小数)は、何も残さずに拒否する。
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createD1, createMuseSearchKeysSqlite } from './museSearchKeys.testdb';
import { countAiChatOccurrences, listMuseSearchKeys, listViewerKeywords, recordMuseSearchKey } from './museSearchKeys';

function setup() {
  const sqlite = createMuseSearchKeysSqlite();
  const db = createD1(sqlite);
  let n = 0;
  const share = (userId: string, answer: string, extra: { question?: string; deletedAt?: string | null } = {}) => {
    n += 1;
    sqlite.prepare('INSERT INTO ai_chat_shares (id, user_id, user_hash, question, answer, model, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('s' + n, userId, 'h', extra.question ?? 'q', answer, 'llama-4', extra.deletedAt ?? null);
  };
  const logRows = () => (sqlite.prepare('SELECT * FROM muse_search_key_log ORDER BY id').all() as Record<string, unknown>[]).map((r) => ({ ...r }));
  return { sqlite, db, share, logRows };
}

describe('マイグレーション 0195', () => {
  const sql = readFileSync('migrations/0195_create_muse_search_key_log.sql', 'utf8');
  it('SQLにコメントを入れない(D1のコンソールへそのまま貼れる)', () => expect(sql).not.toContain('--'));
  it('2回流しても落ちない', () => {
    const { sqlite } = setup();
    expect(() => sqlite.exec(sql)).not.toThrow();
  });
});

describe('countAiChatOccurrences(AIチャットの応答ログでの出現回数)', () => {
  it('応答の本文に現れた回数の合計を数える(件数ではなく回数。大文字小文字は区別しない)', async () => {
    const { db, share } = setup();
    share('u1', 'Static Assets と static assets');
    share('u1', 'STATIC');
    share('u1', '関係ない回答');
    expect(await countAiChatOccurrences(db, 'u1', 'static')).toBe(3);
  });
  it('質問の本文は数えない(応答だけ)', async () => {
    const { db, share } = setup();
    share('u1', '回答', { question: 'static static static' });
    expect(await countAiChatOccurrences(db, 'u1', 'static')).toBe(0);
  });
  it('他のユーザーの行と、論理削除された行は数えない', async () => {
    const { db, share } = setup();
    share('u1', 'static');
    share('u2', 'static static');
    share('u1', 'static static static', { deletedAt: '2026-11-01T00:00:00Z' });
    expect(await countAiChatOccurrences(db, 'u1', 'static')).toBe(1);
    expect(await countAiChatOccurrences(db, 'u2', 'static')).toBe(2);
  });
  it('重ならない一致を数える。%と_は記号として扱う', async () => {
    const { db, share } = setup();
    share('u1', 'aaaa');
    share('u1', 'x%y');
    share('u1', 'abc');
    expect(await countAiChatOccurrences(db, 'u1', 'aa')).toBe(2);
    expect(await countAiChatOccurrences(db, 'u1', '%')).toBe(1);
    expect(await countAiChatOccurrences(db, 'u1', '_')).toBe(0);
  });
  it('空・空白だけ・一致なしは0で、SQLを実行しない(空を全件一致にしない)', async () => {
    const { db, share } = setup();
    share('u1', 'static');
    expect(await countAiChatOccurrences(db, 'u1', '')).toBe(0);
    expect(await countAiChatOccurrences(db, 'u1', '   ')).toBe(0);
    expect(await countAiChatOccurrences(db, 'u1', '存在しない')).toBe(0);
  });
});

describe('recordMuseSearchKey', () => {
  it('キーの前後の空白を除いて小文字にそろえ、2つの出現回数と検索日時を記録する', async () => {
    const { db, logRows } = setup();
    await recordMuseSearchKey(db, { userId: 'u1', key: '  Static Assets ', aiChatCount: 7, treeViewCount: 3, searchedAt: '2026-11-19T10:00:00.000Z' });
    expect(logRows()).toEqual([{ id: 1, user_id: 'u1', search_key: 'static assets', ai_chat_count: 7, tree_view_count: 3, searched_at: '2026-11-19T10:00:00.000Z' }]);
  });
  it('tree-viewでの出現回数が取れなかったとき(null)は、0にせずNULLで残す', async () => {
    const { db, logRows } = setup();
    await recordMuseSearchKey(db, { userId: 'u1', key: 'k', aiChatCount: 0, treeViewCount: null });
    expect(logRows()[0].tree_view_count).toBeNull();
  });
  it('検索日時を省くと、いまの時刻(ISO形式)を入れる', async () => {
    const { db, logRows } = setup();
    await recordMuseSearchKey(db, { userId: 'u1', key: 'k', aiChatCount: 1, treeViewCount: 1 });
    expect(String(logRows()[0].searched_at)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
  it('制約に反する値は、何も残さずに拒否する', async () => {
    const { db, logRows } = setup();
    const base = { userId: 'u1', key: 'k', aiChatCount: 1, treeViewCount: 1 };
    for (const bad of [{ key: '' }, { key: '   ' }, { key: 'a'.repeat(501) }, { aiChatCount: -1 }, { aiChatCount: 1.5 }, { treeViewCount: -1 }, { treeViewCount: 0.5 }]) {
      await expect(recordMuseSearchKey(db, { ...base, ...bad })).rejects.toThrow();
    }
    expect(logRows()).toEqual([]);
  });
});

describe('listMuseSearchKeys(🔑モーダルの一覧)', () => {
  const rec = (db: D1Database, key: string, ai: number, tv: number | null, at: string, userId = 'u1') =>
    recordMuseSearchKey(db, { userId, key, aiChatCount: ai, treeViewCount: tv, searchedAt: at });

  it('キーごとに、最新の値・検索回数・最初と最後の検索日時を返す(追記された行から、読むときに集計する)', async () => {
    const { db, logRows } = setup();
    await rec(db, 'k', 1, 2, '2026-11-19T01:00:00.000Z');
    await rec(db, 'K', 5, 4, '2026-11-19T02:00:00.000Z');
    await rec(db, ' k ', 3, 9, '2026-11-19T03:00:00.000Z');
    expect(await listMuseSearchKeys(db, 'u1')).toEqual([{
      searchKey: 'k', aiChatCount: 3, treeViewCount: 9, searchCount: 3,
      firstSearchedAt: '2026-11-19T01:00:00.000Z', lastSearchedAt: '2026-11-19T03:00:00.000Z',
    }]);
    expect(logRows()).toHaveLength(3);
  });
  it('AIチャットでの出現回数の降順。同じなら tree-view の降順(NULLは最後)、さらに同じなら新しく検索した順', async () => {
    const { db } = setup();
    await rec(db, 'a', 10, 1, '2026-11-19T01:00:00.000Z');
    await rec(db, 'b', 10, 5, '2026-11-19T01:00:00.000Z');
    await rec(db, 'c', 20, null, '2026-11-19T01:00:00.000Z');
    await rec(db, 'd', 0, 100, '2026-11-19T01:00:00.000Z');
    await rec(db, 'e', 10, null, '2026-11-19T01:00:00.000Z');
    await rec(db, 'f', 10, 1, '2026-11-19T09:00:00.000Z');
    expect((await listMuseSearchKeys(db, 'u1')).map((k) => k.searchKey)).toEqual(['c', 'b', 'f', 'a', 'e', 'd']);
  });
  it('tree-viewでの出現回数が未取得(NULL)のキーは、nullのまま返す(0にしない)', async () => {
    const { db } = setup();
    await rec(db, 'k', 1, null, '2026-11-19T01:00:00.000Z');
    expect((await listMuseSearchKeys(db, 'u1'))[0].treeViewCount).toBeNull();
  });
  it('他のユーザーのキーは返さない。件数の上限を守る', async () => {
    const { db } = setup();
    await rec(db, 'mine', 1, 1, '2026-11-19T01:00:00.000Z');
    await rec(db, 'theirs', 9, 9, '2026-11-19T01:00:00.000Z', 'u2');
    for (let i = 0; i < 5; i++) await rec(db, 'key' + i, i, i, '2026-11-19T01:00:00.000Z');
    expect((await listMuseSearchKeys(db, 'u1')).map((k) => k.searchKey)).not.toContain('theirs');
    expect(await listMuseSearchKeys(db, 'u1', 3)).toHaveLength(3);
    expect(await listMuseSearchKeys(db, 'nobody')).toEqual([]);
  });
});

// スレッド一覧の回答に、閲覧ユーザーが持つキーワードを強調する(2026-11-19、ユーザー指定)。
// 「そのユーザーが持つキーワード」は、そのユーザーの検索キーの記録(muse_search_key_log)のキー。他のユーザーのキーは使わない。
describe('listViewerKeywords(強調に使う、閲覧ユーザーのキーワード)', () => {
  const record = (db: D1Database, userId: string, key: string, at: string) => recordMuseSearchKey(db, { userId, key, aiChatCount: 1, treeViewCount: null, searchedAt: at });
  it('そのユーザーのキーだけを、重複なく、最後に検索した新しい順に返す。他のユーザーのキーは入れない', async () => {
    const { db } = setup();
    await record(db, 'u1', 'alpha', '2026-11-19T01:00:00Z');
    await record(db, 'u1', 'beta', '2026-11-19T02:00:00Z');
    await record(db, 'u1', 'alpha', '2026-11-19T03:00:00Z');
    await record(db, 'u2', 'secret', '2026-11-19T04:00:00Z');
    await record(db, 'u2', 'beta', '2026-11-19T05:00:00Z');
    expect(await listViewerKeywords(db, 'u1')).toEqual(['alpha', 'beta']);
    expect(await listViewerKeywords(db, 'u2')).toEqual(['beta', 'secret']);
    expect(await listViewerKeywords(db, 'nobody')).toEqual([]);
  });
  it('上限を超えない(新しいキーを優先して残す)。0以下・小数・大きすぎる上限は、範囲に丸める', async () => {
    const { db } = setup();
    for (let i = 0; i < 5; i++) await record(db, 'u1', 'k' + i, `2026-11-19T0${i}:00:00Z`);
    expect(await listViewerKeywords(db, 'u1', 2)).toEqual(['k4', 'k3']);
    expect(await listViewerKeywords(db, 'u1', 0)).toEqual(['k4']);
    expect(await listViewerKeywords(db, 'u1', 1.9)).toEqual(['k4']);
    expect((await listViewerKeywords(db, 'u1', 100000)).length).toBe(5);
  });
  it('読めなかったときは、空にせず例外にする(呼び出し側が、理由つきで扱う)', async () => {
    const sqlite = createMuseSearchKeysSqlite();
    const db = createD1(sqlite, { failOn: /FROM muse_search_key_log/ });
    await expect(listViewerKeywords(db, 'u1')).rejects.toThrow('d1 down');
  });
});
