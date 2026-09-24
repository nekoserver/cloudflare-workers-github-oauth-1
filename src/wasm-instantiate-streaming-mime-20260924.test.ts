import { describe, it, expect } from 'vitest';
import { getGronWasmPage } from './views/gronWasm';
import { getJsonStructuralDiffPage } from './views/jsonStructuralDiff';
import { getGoDiffWasmPage } from './views/goDiffWasm';
import { getSqlcWasmPage } from './views/sqlcWasm';
import { getGhAttachPage } from './views/ghAttach';
import { getD1QueryCatalogPage } from './views/d1QueryCatalog';

/**
 * 対象: Go製WASMモジュール(gron-wasm/go-diff-wasm/sqlc-wasm/gh-attach-wasm)を
 * ブラウザ側で読み込む各ページ。
 *
 * 故障シナリオ: WebAssembly.instantiateStreaming()は応答のContent-Typeが
 * 厳密に application/wasm でないと「Unexpected response MIME type. Expected
 * 'application/wasm'」で失敗する。デプロイ環境によっては public/wasm/*.wasm
 * の配信MIMEがこれに一致しないことがあり、WASM読み込み自体が失敗していた
 * (2026-09-24、/gron-wasm でユーザー報告により発覚)。ruby-wasmローダー
 * (src/utils/rubyWasmLoader.ts)と同じ方針で、MIMEに依存しない
 * arrayBuffer経由のWebAssembly.compile→instantiateへ全ページ統一した。
 * このテストは再発防止のため、各ページのscript内にinstantiateStreamingが
 * 残っていないことを検証する(ruby-wasm-loader.test.tsのcompileStreaming
 * チェックと同じ方針)。
 */
describe('Go製WASMページはinstantiateStreamingに依存しない', () => {
  it('/gron-wasm', () => {
    const html = getGronWasmPage('tester');
    expect(html).not.toContain('instantiateStreaming');
    expect(html).toContain('WebAssembly.compile(');
  });

  it('/json-structural-diff(gron-wasm・go-diff-wasm両方を読み込む共通loadGoWasm)', () => {
    const html = getJsonStructuralDiffPage('tester');
    expect(html).not.toContain('instantiateStreaming');
    expect(html).toContain('WebAssembly.compile(');
  });

  it('/go-diff-wasm', () => {
    const html = getGoDiffWasmPage('tester');
    expect(html).not.toContain('instantiateStreaming');
    expect(html).toContain('WebAssembly.compile(');
  });

  it('/sqlc-wasm', () => {
    const html = getSqlcWasmPage('tester');
    expect(html).not.toContain('instantiateStreaming');
    expect(html).toContain('WebAssembly.compile(');
  });

  it('/gh-attach', () => {
    const html = getGhAttachPage('tester');
    expect(html).not.toContain('instantiateStreaming');
    expect(html).toContain('WebAssembly.compile(');
  });

  it('/d1-query-catalog(sqlc-wasmを読み込む)', () => {
    const html = getD1QueryCatalogPage('tester', []);
    expect(html).not.toContain('instantiateStreaming');
    expect(html).toContain('WebAssembly.compile(');
  });
});
