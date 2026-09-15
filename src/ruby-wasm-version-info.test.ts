import { describe, it, expect } from 'vitest';
import { getRubyWasmVersionInfo, parseRubyWasmVersionInfo, RUBY_WASM_BINARY_URL } from './views/rubyWasm';

// 対象: src/views/rubyWasm.ts の parseRubyWasmVersionInfo()/getRubyWasmVersionInfo()。
// `/neko rubyver` スラッシュコマンド(src/utils/aichatSlashCommand.ts)が表示する
// Ruby/WASMのバージョン情報の元データになる純粋関数。
//
// 故障シナリオ:
//   (1) RUBY_WASM_BINARY_URLの書式が将来変わり、正規表現がマッチしなくなる
//       (getRubyWasmVersionInfo()がその場合に例外を投げず、undefinedや空文字列を
//       静かに返すと、スラッシュコマンドの表示が「取得できました」という体で
//       空欄になり気づかれにくい)
//   (2) パッケージバージョンにハイフンや複数のドットが含まれる場合に
//       正規表現が誤って途中で区切ってしまう
//   (3) 4系バイナリURLを3.4のまま誤認する

describe('parseRubyWasmVersionInfo', () => {
  it('4.0のURL形式からビルドライン 4.0 とパッケージバージョンを取り出す', () => {
    const info = parseRubyWasmVersionInfo(
      'https://cdn.jsdelivr.net/npm/@ruby/4.0-wasm-wasi@2.10.1/dist/ruby+stdlib.wasm'
    );
    expect(info).toEqual({ rubyBuildLine: '4.0', wasmWasiPackageVersion: '2.10.1' });
  });

  it('3.4のURL形式も引き続きパースできる(過去スニペットの記録用)', () => {
    const info = parseRubyWasmVersionInfo(
      'https://cdn.jsdelivr.net/npm/@ruby/3.4-wasm-wasi@2.10.1/dist/ruby+stdlib.wasm'
    );
    expect(info).toEqual({ rubyBuildLine: '3.4', wasmWasiPackageVersion: '2.10.1' });
  });

  it('形式が想定と異なるURLはnullを返す(適当な値をでっち上げない)', () => {
    expect(parseRubyWasmVersionInfo('https://example.com/not-a-ruby-wasm-url.wasm')).toBeNull();
  });

  it('空文字列もnullを返す', () => {
    expect(parseRubyWasmVersionInfo('')).toBeNull();
  });

  it('プレリリース版のようなバージョン文字列(ドット3個)でも正しく取り出せる', () => {
    const info = parseRubyWasmVersionInfo(
      'https://cdn.jsdelivr.net/npm/@ruby/3.5-wasm-wasi@3.0.0-beta.1/dist/ruby+stdlib.wasm'
    );
    expect(info).toEqual({ rubyBuildLine: '3.5', wasmWasiPackageVersion: '3.0.0-beta.1' });
  });
});

describe('getRubyWasmVersionInfo', () => {
  it('/ruby-wasmページが実際に読み込む固定URLから、パースエラー無く値を返す', () => {
    const info = getRubyWasmVersionInfo();
    expect(info.rubyBuildLine).toMatch(/^\d+\.\d+$/);
    expect(info.wasmWasiPackageVersion.length).toBeGreaterThan(0);
  });

  it('読み込むビルドラインは 4.0 で、3.4 のまま残さない', () => {
    const info = getRubyWasmVersionInfo();
    expect(info.rubyBuildLine).toBe('4.0');
    expect(info.wasmWasiPackageVersion).toBe('2.10.1');
    expect(RUBY_WASM_BINARY_URL).toContain('@ruby/4.0-wasm-wasi@2.10.1');
    expect(RUBY_WASM_BINARY_URL).not.toContain('@ruby/3.4-wasm-wasi');
  });
});

describe('RUBY_WASM_BINARY_URL のCDN実体', () => {
  it('jsDelivr の 4.0 バイナリが 2xx で存在し、サイズが本体相当である', async () => {
    const res = await fetch(RUBY_WASM_BINARY_URL, { method: 'HEAD' });
    expect(res.ok).toBe(true);
    const len = Number(res.headers.get('content-length') || '0');
    expect(len).toBeGreaterThan(5_000_000);
  }, 20000);
});
