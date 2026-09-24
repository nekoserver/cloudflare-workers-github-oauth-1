/**
 * 対象: /call-graph ページ(src/views/callGraph.ts)の関数ノード色分け。
 *
 * これまでGROUP_META由来の6〜7色(index/view/util/middleware/script/other/
 * unresolved)だけで塗り分けていたが、views(601関数相当)やutil(488関数相当)
 * のような大きいグループでは数百件の関数が同じ色になり、粒度が粗すぎるという
 * 指摘を受けた。凡例・フィルタボタンとの対応(色相=グループ)は保ったまま、
 * ファイルパスのハッシュから明度(lightness)だけをずらし、同じグループ内でも
 * ファイルごとに濃淡が変わるfileShadeHsl()を追加した。
 *
 * 故障シナリオ:
 *   (1) <script>内に構文エラーを持ち込み、ページ全体が壊れる
 *      (テンプレートリテラル内へのエスケープ文字埋め込みミス、CLAUDE.mdルール29)
 *   (2) 同じファイルの関数同士で色がばらつく(決定的でない)
 *   (3) 異なるファイルが常に同じ濃淡になり、結局グループ単位の粗い色分けと
 *      変わらない
 */
import { describe, it, expect } from 'vitest';
import { getCallGraphPage } from './views/callGraph';
import type { CallGraphNode } from './utils/callGraphBuilder';

function extractScript(html: string): string {
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('scriptタグが見つからない');
  return m[1];
}

function makeNode(overrides: Partial<CallGraphNode>): CallGraphNode {
  return {
    id: 'x',
    label: 'x',
    file: 'src/views/foo.ts',
    group: 'view',
    desc: '',
    isExported: true,
    isAsync: false,
    startLine: 1,
    endLine: 10,
    callerCount: 0,
    unresolved: false,
    ...overrides,
  };
}

describe('/call-graph ページの<script>構文', () => {
  it('fileShadeHsl追加後もscriptが構文エラーなくパースできる', () => {
    const html = getCallGraphPage('tester', [], null, [], []);
    const script = extractScript(html);
    expect(() => new Function(script)).not.toThrow();
  });
});

describe('fileShadeHsl(色相=グループ、明度=ファイル単位の濃淡)', () => {
  function loadFileShadeHsl(html: string): (baseHex: string, filePath: string) => [number, number, number] {
    const script = extractScript(html);
    // ブラウザ専用API(canvas取得・window.innerWidth等)に依存する残りの部分は
    // 呼ばずに済むよう、関数定義だけを抽出して実行する。
    const start = script.indexOf('const fileShadeCache');
    const end = script.indexOf('function drawArrow');
    if (start === -1 || end === -1) throw new Error('fileShadeHsl関連の関数が見つからない');
    const snippet = script.slice(start, end) + '\nreturn fileShadeHsl;';
    const fn = new Function(snippet);
    return fn();
  }

  it('同じ(グループ色, ファイルパス)なら常に同じ色を返す(決定的)', () => {
    const html = getCallGraphPage('tester', [], null, [], []);
    const fileShadeHsl = loadFileShadeHsl(html);
    const a = fileShadeHsl('#e3b341', 'src/views/foo.ts');
    const b = fileShadeHsl('#e3b341', 'src/views/foo.ts');
    expect(a).toEqual(b);
  });

  it('同じグループ色でもファイルが違えば明度が変わる', () => {
    const html = getCallGraphPage('tester', [], null, [], []);
    const fileShadeHsl = loadFileShadeHsl(html);
    const a = fileShadeHsl('#e3b341', 'src/views/foo.ts');
    const b = fileShadeHsl('#e3b341', 'src/views/bar.ts');
    // 色相(h)・彩度(s)はグループ色から変わらない(凡例との対応を保つ)。
    expect(a[0]).toBe(b[0]);
    expect(a[1]).toBe(b[1]);
    // 明度(l)はファイルパスのハッシュ次第で変わる(全く同じになるのは
    // ハッシュ衝突時のみで、この2パスでは衝突しないことを確認する)。
    expect(a[2]).not.toBe(b[2]);
  });

  it('明度は可読性を保てる範囲(24〜80)に収まる', () => {
    const html = getCallGraphPage('tester', [], null, [], []);
    const fileShadeHsl = loadFileShadeHsl(html);
    const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'src/index.ts', 'src/utils/very/long/path/name.ts'];
    for (const f of files) {
      const [, , l] = fileShadeHsl('#8b949e', f);
      expect(l).toBeGreaterThanOrEqual(24);
      expect(l).toBeLessThanOrEqual(80);
    }
  });
});
