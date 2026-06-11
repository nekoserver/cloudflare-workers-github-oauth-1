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

  // ---- maxLines パラメータ ----

  it('デフォルト（maxLines=10000）では 300行関数を全行抽出する', () => {
    const lines = ['export function huge() {'];
    for (let i = 0; i < 300; i++) lines.push(`  const x${i} = ${i};`);
    lines.push('}');
    const src = lines.join('\n');
    const result = extractFunctionSource(src, 'huge');
    expect(result).not.toBeNull();
    const lineCount = (result ?? '').split('\n').length;
    expect(lineCount).toBe(302); // 宣言行 + 300行 + 閉じ括弧
  });

  it('maxLines=5 で指定行数で打ち切る', () => {
    const lines = ['export function huge() {'];
    for (let i = 0; i < 300; i++) lines.push(`  const x${i} = ${i};`);
    lines.push('}');
    const src = lines.join('\n');
    const result = extractFunctionSource(src, 'huge', 5);
    expect(result).not.toBeNull();
    const lineCount = (result ?? '').split('\n').length;
    expect(lineCount).toBeLessThanOrEqual(5);
  });

  it('maxLines=null（上限なし）で全行抽出する', () => {
    const lines = ['export function huge() {'];
    for (let i = 0; i < 500; i++) lines.push(`  const x${i} = ${i};`);
    lines.push('}');
    const src = lines.join('\n');
    const result = extractFunctionSource(src, 'huge', null);
    expect(result).not.toBeNull();
    const lineCount = (result ?? '').split('\n').length;
    expect(lineCount).toBe(502); // 全行
  });

  it('旧デフォルト 200行制限はもはや適用されない（300行関数が 201行以上返る）', () => {
    const lines = ['export function huge() {'];
    for (let i = 0; i < 300; i++) lines.push(`  const x${i} = ${i};`);
    lines.push('}');
    const src = lines.join('\n');
    const result = extractFunctionSource(src, 'huge');
    expect((result ?? '').split('\n').length).toBeGreaterThan(201);
  });
});
