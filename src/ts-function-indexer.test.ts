import { describe, it, expect } from 'vitest';
import { parseFunctions, findCallers } from './utils/parse-functions';

describe('parseFunctions: function キーワード', () => {
  it('export function を検出する', () => {
    const src = `export function myFunc(a: string): void {\n  console.log(a);\n}\n`;
    const result = parseFunctions(src);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('myFunc');
    expect(result[0].startLine).toBe(1);
    expect(result[0].endLine).toBe(3);
    expect(result[0].isExported).toBe(true);
    expect(result[0].isAsync).toBe(false);
  });

  it('export async function を検出する', () => {
    const src = `export async function fetchData(): Promise<void> {\n  await something();\n}\n`;
    const result = parseFunctions(src);
    expect(result[0].name).toBe('fetchData');
    expect(result[0].isAsync).toBe(true);
  });

  it('非 export function を検出する', () => {
    const src = `function helper(x: number): number {\n  return x * 2;\n}\n`;
    const result = parseFunctions(src);
    expect(result[0].name).toBe('helper');
    expect(result[0].isExported).toBe(false);
  });

  it('ジェネリクスつき function を検出する', () => {
    const src = `export function wrap<T>(val: T): T {\n  return val;\n}\n`;
    const result = parseFunctions(src);
    expect(result[0].name).toBe('wrap');
  });

  it('複数関数の開始行・終了行が正確', () => {
    const src = [
      'function foo() {',
      '  return 1;',
      '}',
      '',
      'function bar() {',
      '  return 2;',
      '}',
    ].join('\n');
    const result = parseFunctions(src);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('foo');
    expect(result[0].startLine).toBe(1);
    expect(result[0].endLine).toBe(3);
    expect(result[1].name).toBe('bar');
    expect(result[1].startLine).toBe(5);
    expect(result[1].endLine).toBe(7);
  });
});

describe('parseFunctions: const arrow 関数', () => {
  it('export const arrowFunc を検出する', () => {
    const src = `export const arrowFunc = (x: number): number => {\n  return x * 2;\n};\n`;
    const result = parseFunctions(src);
    expect(result[0].name).toBe('arrowFunc');
    expect(result[0].isExported).toBe(true);
  });

  it('export const asyncArrow を検出する', () => {
    const src = `export const asyncArrow = async (id: string) => {\n  return id;\n};\n`;
    const result = parseFunctions(src);
    expect(result[0].name).toBe('asyncArrow');
    expect(result[0].isAsync).toBe(true);
  });
});

describe('parseFunctions: 除外ケース', () => {
  it('インデントされた行（クラスメソッド等）を除外する', () => {
    const src = `class MyClass {\n  function notAFunc() {}\n  myMethod() { return 1; }\n}\n`;
    const result = parseFunctions(src);
    expect(result).toHaveLength(0);
  });

  it('空文字列はゼロ件を返す', () => {
    expect(parseFunctions('')).toHaveLength(0);
  });
});

describe('findCallers', () => {
  it('他ファイルからの呼び出しを検出する', () => {
    const files = new Map([
      ['src/a.ts', 'export function myFunc() {}'],
      ['src/b.ts', 'import { myFunc } from "./a";\nmyFunc();\n'],
    ]);
    const callers = findCallers('myFunc', files, 'src/a.ts');
    expect(callers).toHaveLength(1);
    expect(callers[0].callerFile).toBe('src/b.ts');
    expect(callers[0].callerLine).toBe(2);
  });

  it('自ファイルは除外する', () => {
    const files = new Map([
      ['src/a.ts', 'export function myFunc() { myFunc(); }'],
    ]);
    const callers = findCallers('myFunc', files, 'src/a.ts');
    expect(callers).toHaveLength(0);
  });

  it('複数ファイルの複数行を検出する', () => {
    const files = new Map([
      ['src/a.ts', 'export function foo() {}'],
      ['src/b.ts', 'foo();\nconst x = foo();\n'],
      ['src/c.ts', 'foo();\n'],
    ]);
    const callers = findCallers('foo', files, 'src/a.ts');
    expect(callers).toHaveLength(3);
  });
});
