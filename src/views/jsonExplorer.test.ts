// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getJsonExplorerPage } from './jsonExplorer';
import { extractFunctionSource } from '../utils/extractFunctionSource';

// 対象: /json-explorer ページ(src/views/jsonExplorer.ts の getJsonExplorerPage)。
// JSONを展開/折り畳み可能なツリーとして表示し、ノードクリックで任意の要素を
// 抽出できるクライアントサイド完結のツールページ。
//
// 故障シナリオ:
//   (1) usernameがエスケープされずXSSになる
//   (2) script タグに構文エラーがあり、ページ全体が白紙になる
//   (3) 入力・出力・ボタン等の必須要素が欠落し、クライアント側スクリプトが
//       nullアクセスで例外になる
//   (4) パス整形(formatPath)がオブジェクトキーと配列添字を混同する
//   (5) プリミティブ値の描画(renderPrimitive)がHTMLエスケープを忘れXSSになる

function loadFn(html: string, name: string) {
  const src = extractFunctionSource(html, name);
  expect(src, name + ' が生成HTMLから見つからない').toBeTruthy();
  const fn = new Function(`${src}\nreturn ${name};`);
  return fn();
}

describe('getJsonExplorerPage: HTML構造', () => {
  const html = getJsonExplorerPage('tester');

  it('入力・解析ボタン・全展開/折り畳みボタン・ツリー表示領域が存在する', () => {
    expect(html).toContain('id="jsonInput"');
    expect(html).toContain('id="btnParse"');
    expect(html).toContain('id="btnExpandAll"');
    expect(html).toContain('id="btnCollapseAll"');
    expect(html).toContain('id="btnClear"');
    expect(html).toContain('id="jsonTree"');
  });

  it('抽出結果表示(キー・パス・値のコピー)の要素が存在する', () => {
    expect(html).toContain('id="pathBox"');
    expect(html).toContain('id="selectedKey"');
    expect(html).toContain('id="selectedPath"');
    expect(html).toContain('id="btnCopyKey"');
    expect(html).toContain('id="btnCopyPath"');
    expect(html).toContain('id="btnCopyValue"');
    expect(html).toContain('id="extractOutput"');
  });

  it('usernameのHTML特殊文字をエスケープする(XSS対策)', () => {
    const xssHtml = getJsonExplorerPage('<script>alert(1)</script>');
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

describe('getJsonExplorerPage: formatPath(パス整形ロジック)', () => {
  const html = getJsonExplorerPage('tester');

  it('空配列はrootのみを返す', () => {
    const formatPath = loadFn(html, 'formatPath');
    expect(formatPath([])).toBe('root');
  });

  it('オブジェクトキーはドット表記、配列添字は角括弧表記になる', () => {
    const formatPath = loadFn(html, 'formatPath');
    expect(formatPath(['a', 0, 'b'])).toBe('root.a[0].b');
  });
});

describe('getJsonExplorerPage: getSelectedKeyLabel(選択したキーだけの切り出し)', () => {
  const html = getJsonExplorerPage('tester');

  it('ルート選択(空配列)の場合は"root"を返す', () => {
    const getSelectedKeyLabel = loadFn(html, 'getSelectedKeyLabel');
    expect(getSelectedKeyLabel([])).toBe('root');
  });

  it('末尾がオブジェクトキーの場合はキー名だけを返す(フルパスではない)', () => {
    const getSelectedKeyLabel = loadFn(html, 'getSelectedKeyLabel');
    expect(getSelectedKeyLabel(['a', 'b'])).toBe('b');
  });

  it('末尾が配列添字の場合は"[数字]"形式を返す', () => {
    const getSelectedKeyLabel = loadFn(html, 'getSelectedKeyLabel');
    expect(getSelectedKeyLabel(['a', 0])).toBe('[0]');
  });
});

describe('getJsonExplorerPage: renderPrimitive(プリミティブ値の描画)', () => {
  const html = getJsonExplorerPage('tester');

  function loadRenderPrimitive() {
    const renderPrimitiveSrc = extractFunctionSource(html, 'renderPrimitive');
    const escValSrc = extractFunctionSource(html, 'escVal');
    expect(renderPrimitiveSrc, 'renderPrimitive が生成HTMLから見つからない').toBeTruthy();
    expect(escValSrc, 'escVal が生成HTMLから見つからない').toBeTruthy();
    const fn = new Function(`${escValSrc}\n${renderPrimitiveSrc}\nreturn renderPrimitive;`);
    return fn();
  }

  it('文字列値に含まれるHTML特殊文字をエスケープする(XSS対策)', () => {
    const renderPrimitive = loadRenderPrimitive();
    const out = renderPrimitive('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  it('null/真偽値/数値/文字列をそれぞれ正しい種別のspanで描画する', () => {
    const renderPrimitive = loadRenderPrimitive();
    expect(renderPrimitive(null)).toContain('jx-kw');
    expect(renderPrimitive(true)).toContain('jx-kw');
    expect(renderPrimitive(42)).toContain('jx-num');
    expect(renderPrimitive('hi')).toContain('jx-str');
  });
});

describe('getJsonExplorerPage: ルート配線', () => {
  it("app.get('/json-explorer', authMiddleware, ...) が index.ts に登録されている", () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'index.ts'), 'utf-8');
    expect(src).toContain("app.get('/json-explorer', authMiddleware, async (c) => {");
  });
});
