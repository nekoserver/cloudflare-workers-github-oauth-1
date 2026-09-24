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

  it('is registered as a Rust module', () => {
    expect(findWasmModule('sqlx')).toMatchObject({
      sourceDir: 'wasm/sqlx-wasm',
      sourceFile: 'wasm/sqlx-wasm/src/lib.rs',
    });
  });
});
