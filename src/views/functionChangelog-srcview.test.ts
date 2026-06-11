import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getFunctionChangelogPage } from './functionChangelog';

const src = fs.readFileSync(path.join(__dirname, 'functionChangelog.ts'), 'utf-8');

// レンダリング後の HTML（ブラウザに届く実際の JS を検証するため）
const rendered = getFunctionChangelogPage({
  rows: [],
  repos: [{ id: 1, full_name: 'owner/repo' }],
  selectedRepoId: 1,
  availableFiles: ['src/index.ts'],
  availableFunctions: [{ file_path: 'src/index.ts', function_name: 'fn', purpose: 'テスト' }],
  generatedAt: '2026-06-11 00:00:00',
  catalogRows: [],
  indexedFiles: ['src/index.ts'],
});

// ===========================================================
// 関数名クリック → ソースビューアモーダル テスト
// ===========================================================

describe('functionChangelog: fn-link クラス', () => {
  it('主テーブル col-func セルの code 要素に fn-link クラスが付いている', () => {
    expect(src).toMatch(/col-func[^>]*>.*?<code[^>]*class="fn-link"/s);
  });

  it('カタログテーブル行の code 要素に fn-link クラスが付いている', () => {
    // JS レンダリング部分（最後の出現箇所）で fn-link が含まれることを確認
    const catIdx = src.lastIndexOf('col-cat-func');
    const block = src.slice(catIdx, catIdx + 300);
    expect(block).toContain('fn-link');
  });

  it('fn-link に data-func と data-file 属性が含まれる（主テーブル）', () => {
    expect(src).toMatch(/fn-link[^>]*data-func=/);
    expect(src).toMatch(/fn-link[^>]*data-file=/);
  });
});

describe('functionChangelog: ソースビューアモーダル HTML', () => {
  it('srcViewOverlay が存在する', () => {
    expect(src).toMatch(/id=["']srcViewOverlay["']/);
  });

  it('srcViewModal が存在する', () => {
    expect(src).toMatch(/id=["']srcViewModal["']/);
  });

  it('srcViewClose ボタンが存在する', () => {
    expect(src).toMatch(/id=["']srcViewClose["']/);
  });

  it('srcViewBody が存在する', () => {
    expect(src).toMatch(/id=["']srcViewBody["']/);
  });
});

describe('functionChangelog: ソースビューア JS', () => {
  it('openSrcViewer 関数が存在する', () => {
    expect(src).toContain('function openSrcViewer');
  });

  it('highlightTs 関数が存在する', () => {
    expect(src).toContain('function highlightTs');
  });

  it('getNextZ 関数が存在する', () => {
    expect(src).toContain('function getNextZ');
  });

  it('srcViewOverlay を開く際に getNextZ() で z-index を設定する', () => {
    expect(src).toMatch(/srcViewOverlay[^;]{0,200}getNextZ\(\)/s);
  });

  it('srcViewOverlay の close ハンドラが存在する', () => {
    expect(src).toContain('srcViewClose');
  });

  it('tableBody に対するイベントデリゲーションが存在する', () => {
    expect(src).toMatch(/tableBodyEl[^}]{0,200}fn-link/s);
  });

  it('catalogBody に対するイベントデリゲーションが存在する', () => {
    expect(src).toMatch(/catalogBodyEl[^}]{0,200}fn-link/s);
  });
});

describe('functionChangelog: シンタックスハイライト CSS', () => {
  it('hl-comment クラスが light-dark で定義されている', () => {
    const idx = src.indexOf('.hl-comment');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 100);
    expect(block).toContain('light-dark(');
  });

  it('hl-string クラスが light-dark で定義されている', () => {
    const idx = src.indexOf('.hl-string');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 100);
    expect(block).toContain('light-dark(');
  });

  it('hl-kw クラスが存在する', () => {
    expect(src).toContain('.hl-kw');
  });

  it('hl-type クラスが存在する', () => {
    expect(src).toContain('.hl-type');
  });

  it('hl-num クラスが存在する', () => {
    expect(src).toContain('.hl-num');
  });
});

describe('functionChangelog: TOKEN_RE がブラウザで有効な正規表現としてコンパイルできる', () => {
  // バグ再発防止: TS テンプレートリテラル → ブラウザ文字列リテラルの2段階で
  // バックスラッシュが剥がれ "nothing to repeat" になる問題の検証

  function extractTokenRe(): { source: string; flags: string } {
    const m = rendered.match(/var TOKEN_RE = \/([^]+?)\/(g[a-z]*);/);
    expect(m).not.toBeNull();
    return { source: m![1], flags: m![2] };
  }

  it('レンダリング後の JS に TOKEN_RE の正規表現リテラルが存在する', () => {
    extractTokenRe();
  });

  it('抽出した正規表現がエラーなくコンパイルできる', () => {
    const { source, flags } = extractTokenRe();
    expect(() => new RegExp(source, flags)).not.toThrow();
  });

  it('コンパイルした正規表現がコメント・文字列・キーワード・数値を正しくトークン化する', () => {
    const { source, flags } = extractTokenRe();
    const re = new RegExp(source, flags);
    const code = "// comment\nconst x = 'str' + 42;";
    const groups: string[][] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      groups.push(m.slice(1).map(g => g ?? ''));
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    const flat = groups.flat().filter(Boolean);
    expect(flat).toContain('// comment');
    expect(flat).toContain('const');
    expect(flat).toContain("'str'");
    expect(flat).toContain('42');
  });

  it('レンダリング後の JS に壊れたパターン（[sS] や *?* ）が含まれない', () => {
    expect(rendered).not.toContain('[sS]*?');
    expect(rendered).not.toContain('*?*');
  });
});

describe('functionChangelog: getNextZ の staticZDefaults に両モーダルが登録されている', () => {
  it('staticZDefaults に historyOverlay が含まれる', () => {
    const idx = src.indexOf('staticZDefaults');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 300);
    expect(block).toContain('historyOverlay');
  });

  it('staticZDefaults に srcViewOverlay が含まれる', () => {
    const idx = src.indexOf('staticZDefaults');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 300);
    expect(block).toContain('srcViewOverlay');
  });
});
