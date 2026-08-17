import { describe, it, expect } from 'vitest';
import { getSha256WasmPage } from './views/sha256Wasm';

// 対象: 新規ページ /sha256-wasm。RustでSHA-256を実装しwasm-bindgenで
// ビルドしたWASMモジュール(public/wasm/sha256.js + sha256_bg.wasm)を
// ブラウザ側で読み込んで実行するデモページ。
//
// 故障シナリオ:
//   (1) WASMモジュールのimportパスが誤っており読み込みに失敗する
//   (2) 読み込み失敗時にエラー表示せず無言でボタンが押せないままになる
//   (3) ユーザー名がエスケープされずXSSにつながる
//   (4) script type="module" 以外で dynamic import を使ってしまい構文エラーになる

describe('SHA-256 WASMページ', () => {
  it('script内でWASMモジュール(/wasm/sha256.js)を動的importしている', () => {
    const html = getSha256WasmPage('tester');
    expect(html).toContain("import('/wasm/sha256.js')");
    expect(html).toContain('sha256_bg.wasm');
  });

  it('script タグは type="module" である(dynamic importのため)', () => {
    const html = getSha256WasmPage('tester');
    expect(html).toContain('<script type="module">');
  });

  it('WASM読み込み成功時にステータス表示とボタン活性化を行う', () => {
    const html = getSha256WasmPage('tester');
    expect(html).toContain("wasmStatus.className = 'wasm-status ready'");
    expect(html).toContain('hashBtn.disabled = false');
  });

  it('WASM読み込み失敗時にエラーメッセージを表示する(catchで握りつぶさない)', () => {
    const html = getSha256WasmPage('tester');
    expect(html).toContain('.catch(function(err)');
    expect(html).toContain("wasmStatus.className = 'wasm-status error'");
  });

  it('ユーザー名はエスケープされる', () => {
    const html = getSha256WasmPage('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('script タグ内のJSに構文エラーがない', () => {
    const html = getSha256WasmPage('tester');
    const scriptRe = /<script type="module">([\s\S]*?)<\/script>/;
    const m = html.match(scriptRe);
    expect(m).not.toBeNull();
    // dynamic import はトップレベル関数評価では構文エラーになるためモジュールとしての構文健全性のみ簡易チェック
    expect(m![1]).toContain('import(');
    expect(() => new Function('return (async () => { ' + m![1].replace(/import\(/g, 'Promise.resolve(') + ' })')).not.toThrow();
  });
});
