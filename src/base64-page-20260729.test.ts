import { describe, it, expect } from 'vitest';
import { getBase64Page } from './views/base64';
import { extractFunctionSource } from './utils/extractFunctionSource';

// 対象: 新規ページ /base64（src/views/base64.ts の getBase64Page）。
// テキストとBase64の相互変換を行うクライアントサイド完結のツールページ
// (UTF-8対応、URLセーフBase64にも対応)。
//
// 故障シナリオ:
//   (1) btoa/atobはLatin1しか扱えないため、そのまま使うと日本語等の非ASCII文字が
//       文字化けする(TextEncoder/TextDecoderを経由せずに実装してしまう)
//   (2) URLセーフBase64(-_、パディング無し)からの復号でパディング補完を忘れ、
//       atobが例外を投げる
//   (3) 不正なBase64文字列を渡した際にエラーが握りつぶされず、ユーザーに
//       分かる形でエラーメッセージが表示される
//   (4) HTML特殊文字を含むusernameがエスケープされずXSSになる

describe('getBase64Page: HTML構造', () => {
  const html = getBase64Page('tester');

  it('入力用テキストエリアとBase64用テキストエリアが存在する', () => {
    expect(html).toContain('id="plainText"');
    expect(html).toContain('id="b64Text"');
  });

  it('エンコード・デコード・入れ替え・クリアボタンが存在する', () => {
    expect(html).toContain('id="btnEncode"');
    expect(html).toContain('id="btnDecode"');
    expect(html).toContain('id="btnSwap"');
    expect(html).toContain('id="btnClear"');
  });

  it('URLセーフのチェックボックスが存在する', () => {
    expect(html).toContain('id="urlSafe"');
  });

  it('usernameのHTML特殊文字をエスケープする(XSS対策)', () => {
    const xssHtml = getBase64Page('<script>alert(1)</script>');
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

describe('getBase64Page: toBase64/fromBase64 のエンコード/デコードロジック', () => {
  const html = getBase64Page('tester');

  function loadFn(name: string, urlSafeChecked: boolean) {
    const src = extractFunctionSource(html, name);
    expect(src, name + ' が生成HTMLから見つからない').toBeTruthy();
    const fn = new Function(
      'btoa', 'atob', 'TextEncoder', 'TextDecoder', 'urlSafe',
      `${src}\nreturn ${name};`
    );
    return fn(
      globalThis.btoa,
      globalThis.atob,
      globalThis.TextEncoder,
      globalThis.TextDecoder,
      { checked: urlSafeChecked }
    );
  }

  it('ASCII文字列を正しくエンコードする', () => {
    const toBase64 = loadFn('toBase64', false);
    expect(toBase64('hello')).toBe('aGVsbG8=');
  });

  it('日本語(マルチバイトUTF-8)を正しくエンコード・デコードできる(往復一致)', () => {
    const toBase64 = loadFn('toBase64', false);
    const fromBase64 = loadFn('fromBase64', false);
    const original = 'こんにちは、世界！🎉';
    const encoded = toBase64(original);
    const decoded = fromBase64(encoded);
    expect(decoded).toBe(original);
  });

  it('URLセーフモードでは +/ の代わりに -_ を使い、パディングを付けない', () => {
    const toBase64 = loadFn('toBase64', true);
    // 'sure.' -> 標準Base64は 'c3VyZS4=', +/ を含む例として長めの文字列を使う
    const encoded = toBase64('subjects?_d>');
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('URLセーフでエンコードした文字列をURLセーフでデコードすると元に戻る(パディング補完の確認)', () => {
    const toBase64 = loadFn('toBase64', true);
    const fromBase64 = loadFn('fromBase64', true);
    const original = 'a'; // パディングが2つ必要になり、パディング補完ロジックの検証になる
    const encoded = toBase64(original);
    expect(encoded.length % 4).not.toBe(0);
    const decoded = fromBase64(encoded);
    expect(decoded).toBe(original);
  });

  it('不正なBase64文字列をデコードしようとすると例外を投げる(呼び出し元でエラー表示できる)', () => {
    const fromBase64 = loadFn('fromBase64', false);
    expect(() => fromBase64('!!!not valid base64!!!')).toThrow();
  });
});

describe('getBase64Page: ルート配線とナビリンク', () => {
  it("app.get('/base64', authMiddleware, ...) が index.ts に登録されている", () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');
    expect(src).toContain("app.get('/base64', authMiddleware, async (c) => {");
  });

  it('welcome.ts のナビメニューに /base64 へのリンクがある', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.resolve(__dirname, 'views', 'welcome.ts'), 'utf-8');
    expect(src).toContain('href="/base64"');
  });
});
