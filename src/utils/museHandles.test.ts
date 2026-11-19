// /muse-search の👤ボタン(2026-11-19、ユーザー指定): ログインユーザーのハンドルネームを、本体のD1(muse_user_handles、0197)に登録する。
// 登録のとき、すでに登録済みのハンドルネームと照合し(一文字入力するごとに)、一致が無ければ登録できる。
// 仮説:
//   1. 一致の判定は、大文字小文字・全角半角(NFKC)を無視した完全一致。前後の空白は無視する。保存する名前は、入力のまま(前後の空白だけ除く)。
//   2. 使えるのは、1〜20文字(コードポイント)で、制御文字を含まない名前。それ以外は、理由つきで断る。
//   3. 他のユーザーが登録済みの名前は「使えない」。自分の今の名前と同じなら「同じ」(変更にならないので登録しない)。自分の名前は、別の名前に変えられる(1人1つ、上書き)。
//   4. 登録は、照合と書き込みの間に他のユーザーが同じ名前を登録しても、二重にならない(D1のUNIQUEで防ぎ、「使えない」で返す)。何も書かずに失敗したことが分かる。
//   5. 例外にしない(型で結果を返す)。D1の失敗は、理由つきで返し、「使える」「登録した」に見せない。
//   6. ユーザー名(ログインユーザー)を一緒に記録する。
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createD1, createMuseSearchKeysSqlite } from './museSearchKeys.testdb';
import { MUSE_HANDLE_MAX_LENGTH, checkHandleAvailability, getHandle, normalizeHandleKey, registerHandle, validateHandleName } from './museHandles';

function setup(options: Parameters<typeof createD1>[1] = {}) {
  const sqlite = createMuseSearchKeysSqlite();
  const db = createD1(sqlite, options);
  const rows = () => (sqlite.prepare('SELECT * FROM muse_user_handles ORDER BY user_id').all() as Record<string, unknown>[]).map((r) => ({ ...r }));
  return { sqlite, db, rows };
}

describe('マイグレーション 0197', () => {
  const sql = readFileSync('migrations/0197_create_muse_user_handles.sql', 'utf8');
  it('SQLにコメントを入れない。D1のコンソールへ、1文のまま貼れる。2回流しても落ちない', () => {
    expect(sql).not.toContain('--');
    expect(sql.trim().split(';').filter((x) => x.trim()).length).toBe(1);
    expect(() => setup().sqlite.exec(sql)).not.toThrow();
  });
  it('handle_key は重複できない(D1の制約)。空の名前・長すぎる名前は入らない', () => {
    const { sqlite } = setup();
    const insert = (id: string, name: string, key: string) => sqlite.prepare("INSERT INTO muse_user_handles (user_id, user_name, handle_name, handle_key, created_at, updated_at) VALUES (?, ?, ?, ?, 't', 't')").run(id, id, name, key);
    insert('u1', 'ねこ', 'ねこ');
    expect(() => insert('u2', 'ネコ', 'ねこ')).toThrow(/UNIQUE/i);
    expect(() => insert('u3', '  ', 'x')).toThrow();
    expect(() => insert('u4', 'x'.repeat(41), 'y')).toThrow();
    expect(() => insert('u5', 'ok', '')).toThrow();
  });
});

describe('normalizeHandleKey / validateHandleName', () => {
  it('前後の空白を除き、全角半角(NFKC)と大文字小文字をそろえる', () => {
    expect(normalizeHandleKey('  Neko  ')).toBe('neko');
    expect(normalizeHandleKey('ＮＥＫＯ')).toBe('neko');
    expect(normalizeHandleKey('ｶﾅ')).toBe(normalizeHandleKey('カナ'));
    expect(normalizeHandleKey('ねこ ちゃん')).toBe('ねこ ちゃん');
  });
  it('使える名前は、前後の空白だけ除いて、入力のまま(大文字小文字を残す)返す。上限は20文字(コードポイント)', () => {
    expect(validateHandleName('  Neko さん ')).toEqual({ ok: true, name: 'Neko さん' });
    expect(validateHandleName('あ'.repeat(MUSE_HANDLE_MAX_LENGTH))).toMatchObject({ ok: true });
    expect(validateHandleName('😀'.repeat(MUSE_HANDLE_MAX_LENGTH))).toMatchObject({ ok: true });
    expect(MUSE_HANDLE_MAX_LENGTH).toBe(20);
  });
  it('空・空白だけ・21文字以上・制御文字を含む名前は、理由つきで断る', () => {
    for (const raw of ['', '   ', '　　']) expect(validateHandleName(raw)).toEqual({ ok: false, errorCode: 'empty' });
    expect(validateHandleName('あ'.repeat(21))).toEqual({ ok: false, errorCode: 'too_long' });
    expect(validateHandleName('😀'.repeat(21))).toEqual({ ok: false, errorCode: 'too_long' });
    for (const raw of ['a\nb', 'a\u0000b', 'a\tb', 'a\u007fb']) expect(validateHandleName(raw)).toEqual({ ok: false, errorCode: 'invalid_chars' });
  });
});

describe('getHandle / checkHandleAvailability', () => {
  it('登録が無ければ null', async () => {
    expect(await getHandle(setup().db, 'u1')).toBeNull();
  });
  it('他のユーザーの名前と、大文字小文字・全角半角を無視して一致すれば「使えない」。一致が無ければ「使える」。誰の名前かは返さない', async () => {
    const { db } = setup();
    expect(await registerHandle(db, { userId: 'u2', userName: 'other', name: 'Neko' })).toMatchObject({ ok: true });
    for (const typed of ['Neko', 'neko', 'ＮＥＫＯ', ' neko ']) expect(await checkHandleAvailability(db, 'u1', typed)).toEqual({ ok: true, status: 'taken' });
    for (const typed of ['Nek', 'Nekos', 'ねこ']) expect(await checkHandleAvailability(db, 'u1', typed)).toEqual({ ok: true, status: 'available' });
  });
  it('自分の今の名前と同じなら「同じ」(変更にならない)。別の名前なら「使える」', async () => {
    const { db } = setup();
    await registerHandle(db, { userId: 'u1', userName: 'me', name: 'Neko' });
    expect(await checkHandleAvailability(db, 'u1', 'ＮＥＫＯ')).toEqual({ ok: true, status: 'same' });
    expect(await checkHandleAvailability(db, 'u1', 'Neko2')).toEqual({ ok: true, status: 'available' });
  });
  it('検査に通らない名前は、D1を見ずに、理由つきで返す。D1の失敗は、「使える」にせず、理由つきで返す', async () => {
    const { db } = setup();
    expect(await checkHandleAvailability(db, 'u1', '')).toEqual({ ok: false, errorCode: 'empty' });
    expect(await checkHandleAvailability(db, 'u1', 'あ'.repeat(21))).toEqual({ ok: false, errorCode: 'too_long' });
    const broken = setup({ failOn: /FROM muse_user_handles/ });
    const result = await checkHandleAvailability(broken.db, 'u1', 'neko');
    expect(result).toMatchObject({ ok: false, errorCode: 'db_error' });
    expect((result as { detail: string }).detail).toContain('d1 down');
    expect(await checkHandleAvailability(undefined, 'u1', 'neko')).toMatchObject({ ok: false, errorCode: 'db_missing' });
  });
});

describe('registerHandle', () => {
  it('登録する。ユーザー名(ログインユーザー)・入力のままの名前・正規化したキー・日時を記録する', async () => {
    const { db, rows } = setup();
    const result = await registerHandle(db, { userId: 'u1', userName: 'nekoserver', name: '  Neko さん ', now: '2026-11-19T10:00:00.000Z' });
    expect(result).toEqual({ ok: true, handle: { userId: 'u1', userName: 'nekoserver', handleName: 'Neko さん', updatedAt: '2026-11-19T10:00:00.000Z' } });
    expect(rows()).toEqual([{ user_id: 'u1', user_name: 'nekoserver', handle_name: 'Neko さん', handle_key: 'neko さん', created_at: '2026-11-19T10:00:00.000Z', updated_at: '2026-11-19T10:00:00.000Z' }]);
    expect(await getHandle(db, 'u1')).toMatchObject({ handleName: 'Neko さん', userName: 'nekoserver' });
  });
  it('自分の名前は、あとから別の名前に変えられる(1人1つ。作成日時は変えず、更新日時とユーザー名は更新する)', async () => {
    const { db, rows } = setup();
    await registerHandle(db, { userId: 'u1', userName: 'old', name: 'First', now: '2026-11-19T10:00:00.000Z' });
    const result = await registerHandle(db, { userId: 'u1', userName: 'new', name: 'Second', now: '2026-11-19T11:00:00.000Z' });
    expect(result).toMatchObject({ ok: true, handle: { handleName: 'Second' } });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ user_name: 'new', handle_name: 'Second', handle_key: 'second', created_at: '2026-11-19T10:00:00.000Z', updated_at: '2026-11-19T11:00:00.000Z' });
  });
  it('他のユーザーが登録済みの名前(大文字小文字・全角半角の違いだけでも)は、何も書かずに「使えない」で断る。元の登録は変わらない', async () => {
    const { db, rows } = setup();
    await registerHandle(db, { userId: 'u2', userName: 'other', name: 'Neko' });
    const before = rows();
    expect(await registerHandle(db, { userId: 'u1', userName: 'me', name: 'ＮＥＫＯ' })).toEqual({ ok: false, errorCode: 'taken' });
    expect(rows()).toEqual(before);
  });
  it('自分の今の名前と同じ名前(大文字小文字の違いだけも)は、書き換えずに「同じ」で断る', async () => {
    const { db, rows } = setup();
    await registerHandle(db, { userId: 'u1', userName: 'me', name: 'Neko', now: '2026-11-19T10:00:00.000Z' });
    const before = rows();
    expect(await registerHandle(db, { userId: 'u1', userName: 'me', name: 'neko', now: '2026-11-19T12:00:00.000Z' })).toEqual({ ok: false, errorCode: 'same' });
    expect(rows()).toEqual(before);
  });
  it('照合のあとに、他のユーザーが同じ名前を登録していても(競合)、D1のUNIQUEで二重にならず、「使えない」で返す', async () => {
    const { sqlite, db, rows } = setup({ intercept: (sql) => (sql.includes('FROM muse_user_handles WHERE handle_key') ? null : undefined) });
    sqlite.prepare("INSERT INTO muse_user_handles (user_id, user_name, handle_name, handle_key, created_at, updated_at) VALUES ('u2', 'other', 'Neko', 'neko', 't', 't')").run();
    expect(await registerHandle(db, { userId: 'u1', userName: 'me', name: 'neko' })).toEqual({ ok: false, errorCode: 'taken' });
    expect(rows().map((r) => r.user_id)).toEqual(['u2']);
  });
  it('検査に通らない名前は、書かずに理由つきで断る。D1が未設定・書き込みの失敗は、「登録した」にせず理由つきで返す。例外にしない', async () => {
    const { db, rows } = setup();
    expect(await registerHandle(db, { userId: 'u1', userName: 'me', name: '' })).toEqual({ ok: false, errorCode: 'empty' });
    expect(await registerHandle(db, { userId: 'u1', userName: 'me', name: 'a\nb' })).toEqual({ ok: false, errorCode: 'invalid_chars' });
    expect(await registerHandle(db, { userId: 'u1', userName: '  ', name: 'ok' })).toMatchObject({ ok: false, errorCode: 'user_name_missing' });
    expect(rows()).toEqual([]);
    expect(await registerHandle(undefined, { userId: 'u1', userName: 'me', name: 'ok' })).toMatchObject({ ok: false, errorCode: 'db_missing' });
    const failing = setup({ failOn: /INSERT INTO muse_user_handles/ });
    const result = await registerHandle(failing.db, { userId: 'u1', userName: 'me', name: 'ok' });
    expect(result).toMatchObject({ ok: false, errorCode: 'db_error' });
    expect((result as { detail: string }).detail).toContain('d1 down');
    expect(failing.rows()).toEqual([]);
  });
});
