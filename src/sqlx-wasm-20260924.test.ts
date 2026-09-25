import { describe, expect, it } from 'vitest';
import { getSqlxWasmPage } from './views/sqlxWasm';
import { findWasmModule } from './data/wasmModuleRegistry';

describe('SQLx Rust/WASM page', () => {
  it('loads the wasm-bindgen module and invokes the SQLx export', () => {
    const html = getSqlxWasmPage('tester');
    expect(html).toContain("import('/wasm/sqlx.js')");
    expect(html).toContain("wasm.default('/wasm/sqlx_bg.wasm')");
    expect(html).toContain('wasm.sqlx_build_insert');
    expect(html).toContain('sqlx::QueryBuilder');
  });

  it('escapes the user name', () => {
    expect(getSqlxWasmPage('<script>alert(1)</script>')).not.toContain('<script>alert(1)</script>');
  });

  it('documents the input options in a table', () => {
    const html = getSqlxWasmPage('tester');
    expect(html).toContain('<h2 id="options-heading">入力オプション</h2>');
    expect(html).toContain('<th scope="col">オプション</th>');
    expect(html).toContain('<code>table</code>');
    expect(html).toContain('<code>columns</code>');
    expect(html).toContain('<code>rows</code>');
    expect(html).toContain('各行の値の数を <code>columns</code> の要素数と一致');
  });

  it('places the input options table below the conversion button', () => {
    const html = getSqlxWasmPage('tester');
    expect(html.indexOf('<button id="build"')).toBeLessThan(
      html.indexOf('<section class="options"'),
    );
  });

  it('is registered as a Rust module', () => {
    expect(findWasmModule('sqlx')).toMatchObject({
      sourceDir: 'wasm/sqlx-wasm',
      sourceFile: 'wasm/sqlx-wasm/src/lib.rs',
    });
  });
});
