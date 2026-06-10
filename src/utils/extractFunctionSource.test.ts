import { describe, it, expect } from 'vitest';
import { extractFunctionSource } from './extractFunctionSource';

const sample = `
import { foo } from './foo';

export function add(a: number, b: number): number {
  return a + b;
}

export async function fetchData(url: string): Promise<string> {
  const res = await fetch(url);
  return res.text();
}

export const multiply = (a: number, b: number): number => {
  return a * b;
};

export const greet = async (name: string): Promise<string> => {
  return \`Hello, \${name}\`;
};

function internal(x: number) {
  return x * 2;
}

export const arrow = (x: number) => x + 1;

export function nested(): void {
  const inner = () => {
    return { a: 1 };
  };
  inner();
}
`.trim();

describe('extractFunctionSource', () => {
  it('export function を抽出できる', () => {
    const result = extractFunctionSource(sample, 'add');
    expect(result).not.toBeNull();
    expect(result).toContain('function add');
    expect(result).toContain('return a + b');
    expect(result).toMatch(/\}$/);
  });

  it('export async function を抽出できる', () => {
    const result = extractFunctionSource(sample, 'fetchData');
    expect(result).not.toBeNull();
    expect(result).toContain('async function fetchData');
    expect(result).toContain('return res.text()');
  });

  it('export const アロー関数（ブロック本体）を抽出できる', () => {
    const result = extractFunctionSource(sample, 'multiply');
    expect(result).not.toBeNull();
    expect(result).toContain('const multiply');
    expect(result).toContain('return a * b');
  });

  it('export const async アロー関数を抽出できる', () => {
    const result = extractFunctionSource(sample, 'greet');
    expect(result).not.toBeNull();
    expect(result).toContain('const greet');
  });

  it('非export の内部関数を抽出できる', () => {
    const result = extractFunctionSource(sample, 'internal');
    expect(result).not.toBeNull();
    expect(result).toContain('function internal');
    expect(result).toContain('return x * 2');
  });

  it('ネストしたブロックがある関数を正しく抽出できる', () => {
    const result = extractFunctionSource(sample, 'nested');
    expect(result).not.toBeNull();
    expect(result).toContain('function nested');
    expect(result).toContain('inner()');
    // 閉じ括弧が揃っていること（外側の } で終わる）
    const braceOpen = (result ?? '').split('{').length - 1;
    const braceClose = (result ?? '').split('}').length - 1;
    expect(braceOpen).toBe(braceClose);
  });

  it('存在しない関数名は null を返す', () => {
    expect(extractFunctionSource(sample, 'nonexistent')).toBeNull();
  });

  it('空文字ソースは null を返す', () => {
    expect(extractFunctionSource('', 'add')).toBeNull();
  });

  it('先頭一致しない名前（addExtra）は誤抽出しない', () => {
    const src = `
export function addExtra(x: number) { return x; }
export function add(a: number, b: number) { return a + b; }
`.trim();
    const result = extractFunctionSource(src, 'add');
    expect(result).not.toBeNull();
    expect(result).toContain('function add(');
    expect(result).not.toContain('addExtra');
  });

  it('200行を超える関数は 200行で打ち切る', () => {
    const lines = ['export function huge() {'];
    for (let i = 0; i < 300; i++) lines.push(`  const x${i} = ${i};`);
    lines.push('}');
    const src = lines.join('\n');
    const result = extractFunctionSource(src, 'huge');
    expect(result).not.toBeNull();
    const lineCount = (result ?? '').split('\n').length;
    expect(lineCount).toBeLessThanOrEqual(201);
  });
});
