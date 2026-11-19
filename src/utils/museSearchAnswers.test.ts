// /muse-search の🗒️ボタン(2026-11-19、ユーザー指定): 回答ごとの出現回数を本体のD1(muse_search_answer_log、0196)に記録し、
// スレッドごとに、出現回数の多い順に並べて一覧する。
// 仮説:
//   1. 検索のたびに、dynamicneko が返した回答ごとの出現回数を、キー・検索日時とともに追記する(0件なら何も書かず成功)。
//   2. 一覧は「全キー合算」。同じ回答は、キーごとに最後に検索したときの値だけを足す(同じキーを何度検索しても増えない)。
//   3. スレッド(スレッド化していなければ、そのチャット)ごとに合計の多い順、スレッドの中は回答ごとの回数の多い順。
//   4. 回答のスレッドは、その回答の最新の記録に従う(あとでスレッド化されたら、新しい方へ移る。回答が2つに割れない)。
//   5. 他のユーザーの記録は混ぜない。制約に反する値は、何も残さずに拒否する。失敗は理由つきで返し、空の一覧にしない。
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createD1, createMuseSearchKeysSqlite } from './museSearchKeys.testdb';
import { groupAnswersByThread, isMuseAnswerHit, listMuseAnswersByThread, recordSearchedAnswers, type MuseAnswerHit } from './museSearchAnswers';

const hit = (over: Partial<MuseAnswerHit> = {}): MuseAnswerHit => ({ answerId: 'a1', chatId: 'c1', threadId: 't1', occurrences: 2, preview: '前置き…静的…', createdAt: 100, ...over });
function setup(options: Parameters<typeof createD1>[1] = {}) {
  const sqlite = createMuseSearchKeysSqlite();
  const db = createD1(sqlite, options);
  const rows = () => (sqlite.prepare('SELECT * FROM muse_search_answer_log ORDER BY id').all() as Record<string, unknown>[]).map((r) => ({ ...r }));
  return { sqlite, db, rows };
}

describe('マイグレーション 0196', () => {
  const sql = readFileSync('migrations/0196_create_muse_search_answer_log.sql', 'utf8');
  it('SQLにコメントを入れない。2回流しても落ちない', () => {
    expect(sql).not.toContain('--');
    expect(() => setup().sqlite.exec(sql)).not.toThrow();
  });
});

describe('isMuseAnswerHit', () => {
  it('正しい形を受け付け、形が違うものを断る', () => {
    expect(isMuseAnswerHit(hit())).toBe(true);
    expect(isMuseAnswerHit(hit({ threadId: null }))).toBe(true);
    for (const bad of [null, 'x', hit({ occurrences: 0 }), hit({ occurrences: 1.5 }), { ...hit(), answerId: 1 }, { ...hit(), threadId: 5 }, { ...hit(), preview: undefined }, hit({ answerId: '' })]) {
      expect(isMuseAnswerHit(bad)).toBe(false);
    }
  });
});

describe('recordSearchedAnswers', () => {
  it('回答ごとに1行ずつ、キー(小文字)・検索日時とともに追記する', async () => {
    const { db, rows } = setup();
    const result = await recordSearchedAnswers(db, 'u1', ' Static ', [hit(), hit({ answerId: 'a2', chatId: 'c2', threadId: null, occurrences: 1 })], '2026-11-19T00:00:00.000Z');
    expect(result).toEqual({ answersLogged: true, answersCount: 2 });
    expect(rows().map((r) => [r.user_id, r.search_key, r.answer_id, r.chat_id, r.thread_id, r.occurrences, r.answer_created_at, r.searched_at])).toEqual([
      ['u1', 'static', 'a1', 'c1', 't1', 2, 100, '2026-11-19T00:00:00.000Z'],
      ['u1', 'static', 'a2', 'c2', null, 1, 100, '2026-11-19T00:00:00.000Z'],
    ]);
  });
  it('回答が0件なら、何も書かずに成功(0件)', async () => {
    const { db, rows } = setup();
    expect(await recordSearchedAnswers(db, 'u1', 'k', [])).toEqual({ answersLogged: true, answersCount: 0 });
    expect(rows()).toEqual([]);
  });
  it('上流が answers を返さなかった(古い版)ときは、成功に見せず理由を返す', async () => {
    const { db, rows } = setup();
    const result = await recordSearchedAnswers(db, 'u1', 'k', undefined);
    expect(result).toMatchObject({ answersLogged: false });
    expect((result as { answersLogError: string }).answersLogError).toContain('answers');
    expect(rows()).toEqual([]);
  });
  it('D1が未設定・書き込みの失敗は、例外にせず理由を返す。制約に反する値は、1行も残さない', async () => {
    expect(await recordSearchedAnswers(undefined, 'u1', 'k', [hit()])).toMatchObject({ answersLogged: false, answersLogError: expect.stringContaining('DB') });
    const failing = setup({ failOn: /INSERT INTO muse_search_answer_log/ });
    expect(await recordSearchedAnswers(failing.db, 'u1', 'k', [hit()])).toMatchObject({ answersLogged: false, answersLogError: expect.stringContaining('d1 down') });
    const { db, rows } = setup();
    const result = await recordSearchedAnswers(db, 'u1', 'k', [hit(), { ...hit({ answerId: 'a9' }), occurrences: 0 }]);
    expect(result).toMatchObject({ answersLogged: false });
    expect(rows()).toEqual([]);
  });
});

describe('groupAnswersByThread(全キー合算、スレッドごと)', () => {
  const row = (over: Record<string, unknown>) => ({ id: 1, search_key: 'k', answer_id: 'a1', chat_id: 'c1', thread_id: 't1', occurrences: 1, preview: 'p', answer_created_at: 100, ...over }) as never;
  it('同じ回答はキーを足し、スレッドは合計の多い順、スレッドの中は回数の多い順', () => {
    const groups = groupAnswersByThread([
      row({ id: 1, search_key: 'x', answer_id: 'a1', occurrences: 2 }),
      row({ id: 2, search_key: 'y', answer_id: 'a1', occurrences: 3 }),
      row({ id: 3, search_key: 'x', answer_id: 'a2', occurrences: 1 }),
      row({ id: 4, search_key: 'x', answer_id: 'b1', chat_id: 'c9', thread_id: 't2', occurrences: 9 }),
    ]);
    expect(groups.map((g) => [g.threadId, g.totalOccurrences, g.answers.map((a) => [a.answerId, a.occurrences, a.searchKeys])])).toEqual([
      ['t2', 9, [['b1', 9, ['x']]]],
      ['t1', 6, [['a1', 5, ['x', 'y']], ['a2', 1, ['x']]]],
    ]);
  });
  it('スレッド化していない回答は、チャットごとに1つのまとまり(threadId は null)', () => {
    const groups = groupAnswersByThread([
      row({ id: 1, answer_id: 'a1', chat_id: 'c1', thread_id: null, occurrences: 1 }),
      row({ id: 2, answer_id: 'a2', chat_id: 'c1', thread_id: null, occurrences: 2 }),
      row({ id: 3, answer_id: 'a3', chat_id: 'c2', thread_id: null, occurrences: 4 }),
    ]);
    expect(groups.map((g) => [g.threadId, g.chatId, g.totalOccurrences])).toEqual([[null, 'c2', 4], [null, 'c1', 3]]);
  });
  it('回答のスレッドは最新の記録に従う(2つに割れない)。同数のときは回答の新しい順', () => {
    const groups = groupAnswersByThread([
      row({ id: 1, search_key: 'x', answer_id: 'a1', thread_id: null, occurrences: 1 }),
      row({ id: 2, search_key: 'y', answer_id: 'a1', thread_id: 't1', occurrences: 1 }),
      row({ id: 3, search_key: 'x', answer_id: 'a2', thread_id: 't1', occurrences: 2, answer_created_at: 50 }),
      row({ id: 4, search_key: 'x', answer_id: 'a3', thread_id: 't1', occurrences: 2, answer_created_at: 300 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].answers.map((a) => a.answerId)).toEqual(['a3', 'a1', 'a2']);
    expect(groups[0].totalOccurrences).toBe(6);
  });
  it('記録が無ければ空', () => expect(groupAnswersByThread([])).toEqual([]));
});

describe('listMuseAnswersByThread(D1から)', () => {
  it('同じキーを何度検索しても増えず、最後の値だけを足す。他のユーザーは混ぜない', async () => {
    const { db } = setup();
    await recordSearchedAnswers(db, 'u1', 'k', [hit({ occurrences: 5 })], '2026-11-19T00:00:00Z');
    await recordSearchedAnswers(db, 'u1', 'k', [hit({ occurrences: 7 })], '2026-11-19T01:00:00Z');
    await recordSearchedAnswers(db, 'u1', 'other', [hit({ occurrences: 1 })], '2026-11-19T02:00:00Z');
    await recordSearchedAnswers(db, 'someone', 'k', [hit({ answerId: 'zz', occurrences: 99 })]);
    const groups = await listMuseAnswersByThread(db, 'u1');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ threadId: 't1', totalOccurrences: 8 });
    expect(groups[0].answers[0]).toMatchObject({ answerId: 'a1', occurrences: 8, searchKeys: ['k', 'other'], preview: '前置き…静的…' });
  });
  it('読めなかったときは空の一覧にせず、例外にする', async () => {
    const { db } = setup({ failOn: /FROM muse_search_answer_log/ });
    await expect(listMuseAnswersByThread(db, 'u1')).rejects.toThrow('d1 down');
  });
});
