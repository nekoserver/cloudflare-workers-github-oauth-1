import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 根本原因:
//   src/index.ts は単体テスト用に約40個のトップレベル named export
//   (定数・純粋関数・型) を持つ。Cloudflare WorkersのESモジュール形式は
//   default 以外の named export を「名前付きエントリポイント」として
//   workerd が検証するため、関数/クラスでない named export
//   (例: export const D1_MAX_BOUND_PARAMS = 90) が1つでも存在すると
//   実際の Workers ランタイム起動時に
//   "Incorrect type for map entry '...': the provided value is not of
//   type 'function or ExportedHandler'" で起動不能になる
//   （wrangler dev で実機再現済み）。
// 対策:
//   wrangler.toml の main を src/index.ts から src/worker-entry.ts
//   （default のみを re-export する薄いファサードファイル）に向け直す
//   ことで、workerd から見えるエントリモジュールの named export を
//   default のみに絞る。index.ts 側のテスト用 export 自体は変更不要。
// 2026-10-16 追記（Cloudflare Containers導入）:
//   Durable Objectのclass_nameバインディング(DemoContainer)には、
//   workerdから見えるこのエントリモジュール自身がそのクラスをexportして
//   いる必要があり、`export { DemoContainer } from './containers/demoContainer'`
//   を追加した。クラスはJS上typeof === 'function'の値であり、workerdの
//   「function or ExportedHandler」検証を満たすため、上記の根本原因
//   (関数/クラスでない値のnamed export)には当たらない。そのため下の
//   named-export検証は「クラスのre-export(`export { X } from ...`、
//   `export class`)」だけを例外的に許可し、根本原因そのものだった
//   const/let/var・型のみのinterface/type/enumは引き続き禁止する。
describe('Workerエントリポイントがworkerdの起動時named-export検証を回避する構成になっている', () => {
  it('wrangler.toml の main が src/worker-entry.ts を指している(src/index.ts直指定に戻されていない)', () => {
    const toml = readFileSync('wrangler.toml', 'utf8');
    expect(toml).toMatch(/^main\s*=\s*"src\/worker-entry\.ts"/m);
  });

  it('src/worker-entry.ts は default export と、クラスのre-export(Durable Object用)以外の named export を持たない', () => {
    const src = readFileSync('src/worker-entry.ts', 'utf8');
    // 根本原因そのものだった「値・型のnamed export」(const/let/var・
    // interface/type/enum)は引き続き禁止する。functionも(現時点では
    // 不要なため)禁止のまま。クラスのre-export(`export { X } from`)と
    // `export class`だけを許可する。
    const forbiddenNamedExportRe = /^export\s+(?!default\b)(const|function|let|var|interface|type|enum)\b/gm;
    expect(src.match(forbiddenNamedExportRe)).toBeNull();
    expect(src).toContain('export default {');
  });

  it('src/worker-entry.ts がexportするのはDurable Object(DemoContainer・AichatJob)のre-exportだけである(他の値を混ぜて許可を広げすぎていない)', () => {
    const src = readFileSync('src/worker-entry.ts', 'utf8');
    const reExportRe = /^export\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"]/gm;
    const matches = [...src.matchAll(reExportRe)].map((m) => m[1].trim());
    expect(matches).toEqual(['DemoContainer', 'AichatJob']);
  });

  it('src/index.ts は default export(Honoアプリ本体)を持つ', () => {
    const src = readFileSync('src/index.ts', 'utf8');
    expect(src).toContain('export default app;');
  });
});
