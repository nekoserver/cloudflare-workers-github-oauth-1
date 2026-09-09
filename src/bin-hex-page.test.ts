import { describe, it, expect } from 'vitest';
import { getBinHexPage } from './views/binHex';
import { extractFunctionSource } from './utils/extractFunctionSource';

// 対象: 新規ページ /bin-hex（src/views/binHex.ts の getBinHexPage）。
// 2進数と16進数の相互変換を行うクライアントサイド完結のツールページ。
// JSのNumberは53bitを超えると精度が落ちるため、BigIntを使って任意長の
// 2進数/16進数を正確に変換する。
//
// 故障シナリオ:
//   (1) 大きな値(Number.MAX_SAFE_INTEGERを超える)でNumberベースの変換をすると
//       精度が落ちて誤った結果になる
//   (2) 0/1以外の文字を含む2進数、0-9・A-F以外の文字を含む16進数を渡した際に
//       エラーが握りつぶされず、ユーザーに分かる形でエラーメッセージが表示される
//   (3) 複数値をまとめて変換する際、区切り文字の扱いを誤って結果がずれる
//   (4) HTML特殊文字を含むusernameがエスケープされずXSSになる

describe('getBinHexPage: HTML構造', () => {
  const html = getBinHexPage('tester');

  it('2進数用・16進数用のテキストエリアが存在する', () => {
    expect(html).toContain('id="binText"');
    expect(html).toContain('id="hexText"');
  });

  it('16進数変換・2進数変換・入れ替え・クリアボタンが存在する', () => {
    expect(html).toContain('id="btnToHex"');
    expect(html).toContain('id="btnToBin"');
    expect(html).toContain('id="btnSwap"');
    expect(html).toContain('id="btnClear"');
  });

  it('文字(UTF-8)用のテキストエリアと変換ボタンが存在する', () => {
    expect(html).toContain('id="utfText"');
    expect(html).toContain('id="btnUtfToHex"');
    expect(html).toContain('id="btnHexToUtf"');
    expect(html).toContain('id="btnSwapUtf"');
  });

  it('2進数⇔文字(UTF-8)の直接変換ボタンが存在する(16進数を経由せず1クリックで変換できる)', () => {
    expect(html).toContain('id="btnBinToUtf"');
    expect(html).toContain('id="btnUtfToBin"');
  });

  it('usernameのHTML特殊文字をエスケープする(XSS対策)', () => {
    const xssHtml = getBinHexPage('<script>alert(1)</script>');
    expect(xssHtml).not.toContain('<script>alert(1)</script>');
    expect(xssHtml).toContain('&lt;script&gt;');
  });

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });
});

describe('getBinHexPage: binToHex/hexToBin のロジック', () => {
  const html = getBinHexPage('tester');

  function loadFn(name: string, opts: { upperCase?: boolean; withPrefix?: boolean } = {}) {
    const src = extractFunctionSource(html, name);
    expect(src, name + ' が生成HTMLから見つからない').toBeTruthy();
    // binToHex/hexToBinはsplitTokens/stripPrefixに依存するため、それらも含めて渡す
    const splitTokensSrc = extractFunctionSource(html, 'splitTokens');
    const stripPrefixSrc = extractFunctionSource(html, 'stripPrefix');
    const fn = new Function(
      'upperCase', 'withPrefix',
      `${splitTokensSrc}\n${stripPrefixSrc}\n${src}\nreturn ${name};`
    );
    return fn(
      { checked: opts.upperCase ?? true },
      { checked: opts.withPrefix ?? false },
    );
  }

  it('小さな2進数を16進数に正しく変換する', () => {
    const binToHex = loadFn('binToHex');
    expect(binToHex('1010')).toBe('A');
    expect(binToHex('11111111')).toBe('FF');
  });

  it('大きな2進数(53bitを超える)でも精度落ちせず正しく変換する(BigInt使用)', () => {
    const binToHex = loadFn('binToHex');
    // 2^60 = 1152921504606846976 (Numberでは丸め誤差が出る領域)
    const bin = (1n << 60n).toString(2);
    expect(binToHex(bin)).toBe((1n << 60n).toString(16).toUpperCase());
  });

  it('16進数を2進数に正しく変換する', () => {
    const hexToBin = loadFn('hexToBin');
    expect(hexToBin('FF')).toBe('11111111');
    expect(hexToBin('a')).toBe('1010');
  });

  it('大文字小文字オプションがOFFの場合、小文字の16進数を返す', () => {
    const binToHex = loadFn('binToHex', { upperCase: false });
    expect(binToHex('11111111')).toBe('ff');
  });

  it('プレフィックス付与オプションがONの場合、0x/0bを付ける', () => {
    const binToHex = loadFn('binToHex', { withPrefix: true });
    expect(binToHex('1010')).toBe('0xA');
    const hexToBin = loadFn('hexToBin', { withPrefix: true });
    expect(hexToBin('A')).toBe('0b1010');
  });

  it('複数値(空白・改行区切り)をまとめて変換できる', () => {
    const binToHex = loadFn('binToHex');
    expect(binToHex('1010 1111')).toBe('A\nF');
  });

  it('0x/0bプレフィックス付きの入力も受け付ける', () => {
    const binToHex = loadFn('binToHex');
    expect(binToHex('0b1010')).toBe('A');
    const hexToBin = loadFn('hexToBin');
    expect(hexToBin('0xFF')).toBe('11111111');
  });

  it('0と1以外を含む2進数を渡すと例外を投げる(呼び出し元でエラー表示できる)', () => {
    const binToHex = loadFn('binToHex');
    expect(() => binToHex('1012')).toThrow();
  });

  it('0-9,A-F以外を含む16進数を渡すと例外を投げる', () => {
    const hexToBin = loadFn('hexToBin');
    expect(() => hexToBin('ZZ')).toThrow();
  });

  it('空文字を渡すと例外を投げる', () => {
    const binToHex = loadFn('binToHex');
    expect(() => binToHex('   ')).toThrow();
  });
});

describe('getBinHexPage: utfToHex/hexToUtf のロジック(文字⇔UTF-8バイト列の16進数)', () => {
  const html = getBinHexPage('tester');

  function loadFn(name: string, opts: { upperCase?: boolean; withPrefix?: boolean } = {}) {
    const src = extractFunctionSource(html, name);
    expect(src, name + ' が生成HTMLから見つからない').toBeTruthy();
    const fn = new Function(
      'upperCase', 'withPrefix', 'TextEncoder', 'TextDecoder',
      `${src}\nreturn ${name};`
    );
    return fn(
      { checked: opts.upperCase ?? true },
      { checked: opts.withPrefix ?? false },
      globalThis.TextEncoder,
      globalThis.TextDecoder,
    );
  }

  it('ASCII文字列をUTF-8バイト列の16進数に変換する', () => {
    const utfToHex = loadFn('utfToHex');
    expect(utfToHex('AB')).toBe('41 42');
  });

  it('日本語(マルチバイトUTF-8)を往復変換できる(hexToUtf(utfToHex(x)) === x)', () => {
    const utfToHex = loadFn('utfToHex');
    const hexToUtf = loadFn('hexToUtf');
    const original = 'こんにちは、世界！🎉';
    const hex = utfToHex(original);
    expect(hexToUtf(hex)).toBe(original);
  });

  it('16進数をUTF-8の文字列にデコードする(区切りなし・プレフィックス付きも許容)', () => {
    const hexToUtf = loadFn('hexToUtf');
    expect(hexToUtf('4142')).toBe('AB');
    expect(hexToUtf('0x41 0x42')).toBe('AB');
  });

  it('大文字小文字オプションがOFFの場合、小文字の16進数を返す', () => {
    const utfToHex = loadFn('utfToHex', { upperCase: false });
    expect(utfToHex('Z')).toBe('5a');
  });

  it('プレフィックス付与オプションがONの場合、バイトごとに0xを付ける', () => {
    const utfToHex = loadFn('utfToHex', { withPrefix: true });
    expect(utfToHex('AB')).toBe('0x41 0x42');
  });

  it('空文字を渡すと例外を投げる', () => {
    const utfToHex = loadFn('utfToHex');
    expect(() => utfToHex('')).toThrow();
    const hexToUtf = loadFn('hexToUtf');
    expect(() => hexToUtf('   ')).toThrow();
  });

  it('16進数の桁数が奇数の場合は例外を投げる(UTF-8の1バイトは2桁)', () => {
    const hexToUtf = loadFn('hexToUtf');
    expect(() => hexToUtf('414')).toThrow();
  });

  it('不正な16進数文字を渡すと例外を投げる', () => {
    const hexToUtf = loadFn('hexToUtf');
    expect(() => hexToUtf('ZZ')).toThrow();
  });
});

describe('getBinHexPage: binToUtf/utfToBin のロジック(16進数を経由しない直接変換)', () => {
  const html = getBinHexPage('tester');

  function loadFn(name: string, opts: { upperCase?: boolean; withPrefix?: boolean } = {}) {
    // binToUtf/utfToBinは内部でbinToHex/hexToBin/utfToHex/hexToUtfを呼ぶため、
    // それらも合わせて渡す
    const deps = ['splitTokens', 'stripPrefix', 'binToHex', 'hexToBin', 'utfToHex', 'hexToUtf', name]
      .filter((n, i, arr) => arr.indexOf(n) === i)
      .map((n) => extractFunctionSource(html, n));
    deps.forEach((src, i) => expect(src, name + 'の依存関数が生成HTMLから見つからない').toBeTruthy());
    const fn = new Function(
      'upperCase', 'withPrefix', 'TextEncoder', 'TextDecoder',
      `${deps.join('\n')}\nreturn ${name};`
    );
    return fn(
      { checked: opts.upperCase ?? true },
      { checked: opts.withPrefix ?? false },
      globalThis.TextEncoder,
      globalThis.TextDecoder,
    );
  }

  it('2進数から直接UTF-8文字列に変換できる(16進数を経由する手動操作が不要)', () => {
    const binToUtf = loadFn('binToUtf');
    // 'A' = 0x41 = 0b01000001, 'B' = 0x42 = 0b01000010
    expect(binToUtf('01000001 01000010')).toBe('AB');
  });

  it('日本語(マルチバイトUTF-8)も2進数から直接変換できる', () => {
    const utfToHex = loadFn('utfToHex'); // eslint-disable-line
    const binToUtf = loadFn('binToUtf');
    const utfToBin = loadFn('utfToBin');
    const original = 'こんにちは🎉';
    const bin = utfToBin(original);
    expect(binToUtf(bin)).toBe(original);
  });

  it('文字列から直接2進数に変換できる(先頭ゼロは付かない、既存のhexToBinと同じ挙動)', () => {
    const utfToBin = loadFn('utfToBin');
    expect(utfToBin('A')).toBe('1000001');
  });

  it('不正な2進数を渡すと例外を投げる', () => {
    const binToUtf = loadFn('binToUtf');
    expect(() => binToUtf('0102')).toThrow();
  });

  it('空文字を渡すと例外を投げる', () => {
    const utfToBin = loadFn('utfToBin');
    expect(() => utfToBin('')).toThrow();
  });
});

describe('getBinHexPage: ルート配線', () => {
  it("app.get('/bin-hex', authMiddleware, ...) が index.ts に登録されている", () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');
    expect(src).toContain("app.get('/bin-hex', authMiddleware, async (c) => {");
  });
});
