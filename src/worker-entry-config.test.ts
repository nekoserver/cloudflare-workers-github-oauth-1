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
describe('Workerエントリポイントがworkerdの起動時named-export検証を回避する構成になっている', () => {
  it('wrangler.toml の main が src/worker-entry.ts を指している(src/index.ts直指定に戻されていない)', () => {
    const toml = readFileSync('wrangler.toml', 'utf8');
    expect(toml).toMatch(/^main\s*=\s*"src\/worker-entry\.ts"/m);
  });

  it('src/worker-entry.ts は default のみを re-export し、他の named export を持たない', () => {
    const src = readFileSync('src/worker-entry.ts', 'utf8').trim();
    expect(src).toBe(`export { default } from './index';`);
  });

  it('src/index.ts は default export(Honoアプリ本体)を持つ', () => {
    const src = readFileSync('src/index.ts', 'utf8');
    expect(src).toContain('export default app;');
  });
});
