import { describe, it, expect } from 'vitest';
import { getRubyWasmPage } from './views/rubyWasm';

// 対象: 新規ページ /ruby-wasm。公式のCRuby WASM(WASI)ビルド(@ruby/wasm-wasi,
// @ruby/3.4-wasm-wasi、jsDelivr CDN配信)をブラウザ側で読み込みRubyコードを
// 実行するデモページ。他のwasm/*-wasmクレートと違い、Rustで自前ビルドした
// バイナリではなく公式ビルド済みパッケージをCDN経由で使う
// (C言語コード生成を含むCRubyはこの環境ではwasm32-unknown-unknownへ
// 自前ビルドできないため。NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md 3節参照)。
//
// 故障シナリオ:
//   (1) WASMモジュール/バイナリのCDN URLが誤っており読み込みに失敗する
//   (2) 読み込み失敗時にエラー表示せず無言でボタンが押せないままになる
//   (3) ユーザー名がエスケープされずXSSにつながる
//   (4) script type="module" 以外で dynamic import を使ってしまい構文エラーになる
//   (5) Rubyコードの例外がユーザーに伝わらず、結果欄が空のまま握りつぶされる
//   (6) dist/esm/browser.jsをそのまま読み込むと、内部のbare specifier
//       (例: "@bjorn3/browser_wasi_shim")がブラウザの素のESM importでは
//       解決できず「does not resolve to a valid URL」で読み込みに失敗する
//       (2026-08-31に実機で発生・確認)。jsDelivrの"+esm"サフィックスは
//       任意のサブパスには効かず(実機で再発を確認)、esm.sh(bare specifier
//       を解決済みURLへ自動的に書き換えるCDN)への切り替えで解決した

describe('Ruby WASMページ', () => {
  it('script内で公式CRuby WASMモジュールを動的importしている', () => {
    const html = getRubyWasmPage('tester');
    expect(html).toContain("import('https://esm.sh/@ruby/wasm-wasi@2.10.1/dist/esm/browser.js')");
    expect(html).toContain('https://cdn.jsdelivr.net/npm/@ruby/3.4-wasm-wasi@2.10.1/dist/ruby+stdlib.wasm');
  });

  it('bare specifierを解決できるesm.sh経由でJSグルーコードを読み込む(jsDelivr直接importは使わない)', () => {
    const html = getRubyWasmPage('tester');
    expect(html).toMatch(/import\('https:\/\/esm\.sh\/@ruby\/wasm-wasi@[^']+'\)/);
    expect(html).not.toContain("import('https://cdn.jsdelivr.net/npm/@ruby/wasm-wasi");
  });

  it('script タグは type="module" である(dynamic importのため)', () => {
    const html = getRubyWasmPage('tester');
    expect(html).toContain('<script type="module">');
  });

  it('WASM読み込み成功時にステータス表示とボタン活性化を行う', () => {
    const html = getRubyWasmPage('tester');
    expect(html).toContain("wasmStatus.className = 'wasm-status ready'");
    expect(html).toContain('runBtn.disabled = false');
  });

  it('WASM読み込み失敗時にエラーメッセージを表示する(catchで握りつぶさない)', () => {
    const html = getRubyWasmPage('tester');
    expect(html).toContain('.catch(function(err)');
    expect(html).toContain("wasmStatus.className = 'wasm-status error'");
  });

  it('Rubyコード実行時の例外を結果欄に表示する(try/catchで握りつぶさない)', () => {
    const html = getRubyWasmPage('tester');
    expect(html).toContain('} catch (err) {');
    expect(html).toContain("resultValue.classList.add('error')");
  });

  it('ユーザー名はエスケープされる', () => {
    const html = getRubyWasmPage('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('script タグ内のJSに構文エラーがない', () => {
    const html = getRubyWasmPage('tester');
    const scriptRe = /<script type="module">([\s\S]*?)<\/script>/;
    const m = html.match(scriptRe);
    expect(m).not.toBeNull();
    expect(m![1]).toContain('import(');
    expect(() => new Function('return (async () => { ' + m![1].replace(/import\(/g, 'Promise.resolve(') + ' })')).not.toThrow();
  });
});
