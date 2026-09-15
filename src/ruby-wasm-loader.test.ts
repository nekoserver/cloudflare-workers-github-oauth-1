import { describe, it, expect } from 'vitest';
import {
  assertRubyBuildLine,
  compileRubyWasmFromResponse,
  concatUint8Chunks,
  formatRubyWasmDownloadStatus,
  getRubyWasmLoaderScript,
  getRubyWasmPreloadTags,
  rubyWasmBinaryCacheName,
} from './utils/rubyWasmLoader';
import { getRubyWasmPage, RUBY_WASM_BINARY_URL, RUBY_WASM_JS_URL } from './views/rubyWasm';
import { getKimiCodeMarkdownDetailPage } from './views/kimiCodeMarkdown';

// 対象: src/utils/rubyWasmLoader.ts と、それを埋め込む /ruby-wasm・
// /kimi-code/markdown/:id の読み込み経路。
// 4.0 の ruby+stdlib.wasm は非圧縮で約32MBあり、WebAssembly.compileStreaming
// が iOS Safari でハング・MIME/gzip 不一致で失敗する。進捗も出さないと
// 「読み込めない」ように見える。
//
// 故障シナリオ:
//   (1) compileStreaming だけに頼ると巨大バイナリで読み込みが失敗/ハングする
//   (2) Content-Length が圧縮サイズで、受信バイト(展開後)と食い違い進捗が100%を超える
//   (3) HTTP エラーなのに空の Module を返して成功扱いにする
//   (4) /ruby-wasm だけ直して kimi-code 側が compileStreaming のまま残る
//   (5) インラインスクリプトに \' 等が混ざり HTML 内 JS が構文エラーになる

const EMPTY_WASM = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

describe('formatRubyWasmDownloadStatus', () => {
  it('総量が分かっていて受信が総量以下ならパーセントを付ける', () => {
    expect(formatRubyWasmDownloadStatus(1048576, 10485760)).toBe(
      'WASMバイナリを読み込み中… 1.0 / 10.0 MB (10%)'
    );
  });

  it('総量が不明、または受信が総量を超える(圧縮Content-Length)ときは受信量だけ出す', () => {
    expect(formatRubyWasmDownloadStatus(1048576, 0)).toBe('WASMバイナリを読み込み中… 1.0 MB');
    expect(formatRubyWasmDownloadStatus(20_000_000, 9_000_000)).toBe(
      'WASMバイナリを読み込み中… 19.1 MB'
    );
  });
});

describe('concatUint8Chunks', () => {
  it('複数チャンクを1つの ArrayBuffer に結合する', () => {
    const buf = concatUint8Chunks([new Uint8Array([0, 1]), new Uint8Array([2, 3, 4])]);
    expect(Array.from(new Uint8Array(buf))).toEqual([0, 1, 2, 3, 4]);
  });

  it('空配列は空のバッファを返す(nullを返さない)', () => {
    expect(new Uint8Array(concatUint8Chunks([])).byteLength).toBe(0);
  });
});

describe('assertRubyBuildLine', () => {
  it('4.0.0 はビルドライン 4.0 として受け入れる', () => {
    expect(() => assertRubyBuildLine('4.0.0', '4.0')).not.toThrow();
  });

  it('3.4.1 を 4.0 期待のまま成功扱いにしない', () => {
    expect(() => assertRubyBuildLine('3.4.1', '4.0')).toThrow(/3\.4\.1/);
    expect(() => assertRubyBuildLine('3.4.1', '4.0')).toThrow(/4\.0/);
  });

  it('空文字は成功にしない(バージョン取得失敗を握りつぶさない)', () => {
    expect(() => assertRubyBuildLine('', '4.0')).toThrow(/空/);
  });
});
describe('rubyWasmBinaryCacheName', () => {
  it('ビルドラインとパッケージバージョンでキャッシュ名を分ける(4.0と3.4が衝突しない)', () => {
    expect(rubyWasmBinaryCacheName('4.0', '2.10.1')).toBe('ruby-wasm-binary-4.0-2.10.1');
    expect(rubyWasmBinaryCacheName('3.4', '2.10.1')).toBe('ruby-wasm-binary-3.4-2.10.1');
    expect(rubyWasmBinaryCacheName('4.0', '2.10.1')).not.toBe(rubyWasmBinaryCacheName('3.4', '2.10.1'));
  });
});

describe('getRubyWasmPreloadTags', () => {
  it('バイナリは fetch preload、グルーは modulepreload で HTML パース直後から取り始める', () => {
    const tags = getRubyWasmPreloadTags(
      'https://esm.sh/@ruby/wasm-wasi@2.10.1/dist/esm/browser.js',
      'https://cdn.jsdelivr.net/npm/@ruby/4.0-wasm-wasi@2.10.1/dist/ruby+stdlib.wasm'
    );
    expect(tags).toContain('rel="preload"');
    expect(tags).toContain('as="fetch"');
    expect(tags).toContain('crossorigin="anonymous"');
    expect(tags).toContain('rel="modulepreload"');
    expect(tags).toContain('https://cdn.jsdelivr.net/npm/@ruby/4.0-wasm-wasi@2.10.1/dist/ruby+stdlib.wasm');
    expect(tags).toContain('https://esm.sh/@ruby/wasm-wasi@2.10.1/dist/esm/browser.js');
  });
});

describe('compileRubyWasmFromResponse', () => {
  it('HTTPエラーなら Module を返さず例外にする', async () => {
    const res = new Response('not found', { status: 404, statusText: 'Not Found' });
    await expect(compileRubyWasmFromResponse(res)).rejects.toThrow(/HTTP 404/);
  });

  it('compileStreaming を呼び出さず arrayBuffer から compile する', async () => {
    const original = WebAssembly.compileStreaming;
    let streamingCalled = false;
    (WebAssembly as unknown as { compileStreaming: typeof WebAssembly.compileStreaming }).compileStreaming =
      (async () => {
        streamingCalled = true;
        throw new Error('compileStreaming は使わない');
      }) as typeof WebAssembly.compileStreaming;
    try {
      const res = new Response(EMPTY_WASM, { headers: { 'Content-Type': 'text/plain' } });
      const mod = await compileRubyWasmFromResponse(res);
      expect(streamingCalled).toBe(false);
      expect(mod).toBeInstanceOf(WebAssembly.Module);
    } finally {
      (WebAssembly as unknown as { compileStreaming: typeof WebAssembly.compileStreaming }).compileStreaming =
        original;
    }
  });
});

describe('getRubyWasmLoaderScript', () => {
  it('compileStreaming を含まず、arrayBuffer 相当の compile と進捗表示を持つ', () => {
    const script = getRubyWasmLoaderScript();
    expect(script).not.toContain('compileStreaming');
    expect(script).toContain('WebAssembly.compile(');
    expect(script).toContain('function loadRubyWasmVm(');
    expect(script).toContain('function formatRubyWasmDownloadStatus(');
    expect(script).toContain('caches.open');
    expect(script).toContain('eval(\'RUBY_VERSION\')');
    expect(script).toContain('expectedBuildLine');
    expect(script).toContain('Promise.all');
    expect(script).toContain("credentials: 'omit'");
    expect(script).not.toMatch(/return import\(jsUrl\)\.then\(function\(mod\) \{[\s\S]*fetchRubyWasmBytes/);
  });

  it('インラインJSを eval でき、進捗フォーマットがTS版と同じ結果になる', () => {
    const script = getRubyWasmLoaderScript().replace(/import\(/g, 'Promise.resolve(');
    expect(() => new Function(script + '\nreturn true;')).not.toThrow();
    const format = new Function(
      script + '\nreturn formatRubyWasmDownloadStatus(1048576, 10485760);'
    ) as () => string;
    expect(format()).toBe(formatRubyWasmDownloadStatus(1048576, 10485760));
  });
});

describe('/ruby-wasm ページの読み込み経路', () => {
  it('共通ローダーを使い、compileStreaming に依存しない', () => {
    const html = getRubyWasmPage('tester');
    expect(html).toContain('function loadRubyWasmVm(');
    expect(html).not.toContain('compileStreaming');
    expect(html).toContain(RUBY_WASM_JS_URL);
    expect(html).toContain(RUBY_WASM_BINARY_URL);
    expect(html).toContain('ruby-wasm-binary-4.0-2.10.1');
    expect(html).toContain("expectedBuildLine: '4.0'");
    expect(html).toContain('rel="preload"');
    expect(html).toContain('as="fetch"');
    expect(html).toContain('rel="modulepreload"');
    expect(html).toContain('puts RUBY_VERSION');
    expect(html).not.toContain('@ruby/3.4-wasm-wasi');
  });
});

describe('/kimi-code/markdown 詳細の読み込み経路', () => {
  it('同じローダーを使い、compileStreaming に依存しない', () => {
    const html = getKimiCodeMarkdownDetailPage('tester', 't', 'p', '```ruby\nputs 1\n```');
    expect(html).toContain('function loadRubyWasmVm(');
    expect(html).not.toContain('compileStreaming');
    expect(html).toContain(RUBY_WASM_JS_URL);
    expect(html).toContain(RUBY_WASM_BINARY_URL);
    expect(html).toContain("expectedBuildLine: '4.0'");
    expect(html).toContain('rel="preload"');
  });

  it('実行可能なRubyブロックが無いページでは32MBバイナリをpreloadしない', () => {
    const html = getKimiCodeMarkdownDetailPage('tester', 't', 'p', '```ts\nconst x = 1;\n```');
    expect(html).not.toContain('rel="preload"');
    expect(html).not.toContain('rel="modulepreload"');
  });
});
