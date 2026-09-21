import { describe, expect, it } from 'vitest';
import { getD1BindingCount, validateD1BindingValues } from './d1QueryBindings';

describe('getD1BindingCount', () => {
  it('SQLの文字列・識別子・コメント内を除外してプレースホルダーを数える', () => {
    const sql = `SELECT ?, '?', "?", \`?\` FROM items
      WHERE id = ? AND note = 'it''s ?' /* ? */ -- ?
      AND owner_id = ?`;
    expect(getD1BindingCount(sql)).toBe(3);
  });

  it('?NNNを指定された番号までのバインド数として扱う', () => {
    expect(getD1BindingCount('SELECT ?2, ?, ?1')).toBe(3);
  });
});

describe('validateD1BindingValues', () => {
  it('必要数と一致するJSONプリミティブを受け入れる', () => {
    expect(validateD1BindingValues(['user-1', 10, null, true], 4)).toEqual({
      ok: true,
      values: ['user-1', 10, null, 1],
    });
  });

  it('不足・余分な値を具体的なエラーにする', () => {
    expect(validateD1BindingValues([], 2)).toEqual({
      ok: false,
      error: 'このSQLには2個のバインド値が必要です（受信: 0個）。',
    });
  });

  it('オブジェクトや配列をバインド値として拒否する', () => {
    expect(validateD1BindingValues([{}], 1)).toEqual({
      ok: false,
      error: 'バインド値1は文字列・数値・真偽値・nullのいずれかで指定してください。',
    });
  });
});
