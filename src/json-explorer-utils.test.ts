import { describe, it, expect } from 'vitest';
import { parseJsonSafe, formatJsonPath, getValueAtPath, getSelectedKeyLabel } from './utils/jsonExplorer';

// 対象: /json-explorer ページ(JSONの展開/折り畳みツリー表示・要素抽出)が使う
// src/utils/jsonExplorer.ts の純粋関数群。ツリーのDOM描画自体はブラウザ限定の
// 処理のためvitestでは検証せず(CLAUDE.mdルール15)、パース・パス整形・
// パスからの値取得だけを切り出してテストする。
//
// 故障シナリオ:
//   (1) 不正なJSONを渡した際に例外を投げて呼び出し元(ページ全体)を落とす
//   (2) パス整形が配列添字とオブジェクトキーを混同する(例: [0]がキーになる等)
//   (3) 存在しないパスをたどった際にクラッシュする、またはundefined以外の
//       誤った値を返してしまう

describe('parseJsonSafe', () => {
  it('正しいJSONはok:trueで値を返す', () => {
    const result = parseJsonSafe('{"a":1,"b":[1,2,3]}');
    expect(result).toEqual({ ok: true, value: { a: 1, b: [1, 2, 3] } });
  });

  it('不正なJSONは例外を投げずok:falseとエラーメッセージを返す', () => {
    const result = parseJsonSafe('{not valid json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('空文字列もok:falseになる(クラッシュしない)', () => {
    const result = parseJsonSafe('');
    expect(result.ok).toBe(false);
  });
});

describe('formatJsonPath', () => {
  it('空配列はrootのみを返す', () => {
    expect(formatJsonPath([])).toBe('root');
  });

  it('オブジェクトキーはドット表記、配列添字は角括弧表記になる', () => {
    expect(formatJsonPath(['a', 0, 'b'])).toBe('root.a[0].b');
  });

  it('配列添字が連続する場合も角括弧が連結される', () => {
    expect(formatJsonPath([0, 1])).toBe('root[0][1]');
  });
});

describe('getValueAtPath', () => {
  const sample = { a: { b: [10, 20, { c: 'hello' }] } };

  it('ネストしたオブジェクト・配列を正しくたどれる', () => {
    expect(getValueAtPath(sample, ['a', 'b', 0])).toBe(10);
    expect(getValueAtPath(sample, ['a', 'b', 2, 'c'])).toBe('hello');
  });

  it('存在しないキーをたどった場合はundefinedを返す(クラッシュしない)', () => {
    expect(getValueAtPath(sample, ['a', 'x', 'y'])).toBeUndefined();
  });

  it('nullやプリミティブに対してさらにたどろうとしてもクラッシュせずundefinedを返す', () => {
    expect(getValueAtPath({ a: null }, ['a', 'b'])).toBeUndefined();
    expect(getValueAtPath({ a: 1 }, ['a', 'b'])).toBeUndefined();
  });

  it('空のパスを渡すとルート自体を返す', () => {
    expect(getValueAtPath(sample, [])).toBe(sample);
  });
});

describe('getSelectedKeyLabel', () => {
  it('空配列(ルート選択)の場合は"root"を返す', () => {
    expect(getSelectedKeyLabel([])).toBe('root');
  });

  it('末尾がオブジェクトキーの場合はそのままのキー名を返す', () => {
    expect(getSelectedKeyLabel(['a', 'b'])).toBe('b');
  });

  it('末尾が配列添字の場合は"[数字]"形式を返す', () => {
    expect(getSelectedKeyLabel(['a', 0])).toBe('[0]');
  });
});
