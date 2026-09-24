/**
 * /go-diff-wasm ページの差分表示色分け(diff-add/diff-del/diff-ctx)のテスト。
 *
 * 対象: go-diff-wasmの出力(`+ `=追加, `- `=削除, `  `=変更なしの接頭辞付き行)を
 * 行ごとに色分けして表示するクライアント側ロジック(renderDiffOutput)。
 *
 * 故障シナリオ:
 *   (1) 追加/削除/変更なしの行が同じ色になり、変更点が見分けられない
 *   (2) HTMLへ差し込む際にエスケープを忘れ、diffの内容にXSSペイロードが
 *       含まれるとスクリプトが実行されてしまう(a・bはユーザー入力)
 *   (3) サマリ行やコードフェンス行(接頭辞なし)まで誤って色分けされてしまう
 */
import { describe, it, expect } from 'vitest';
import { getGoDiffWasmPage } from './views/goDiffWasm';

function extractRenderDiffOutput(html: string): (out: string) => string {
  const scriptMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  expect(scriptMatch).not.toBeNull();
  const script = scriptMatch![1];
  // DOM要素へのアクセスを含む周辺コードは実行できないため、
  // escapeForHtml・renderDiffOutputの関数定義部分だけを抜き出して評価する。
  const escapeMatch = script.match(/function escapeForHtml\(s\) \{[\s\S]*?\n\s{4}\}/);
  const renderMatch = script.match(/function renderDiffOutput\(out\) \{[\s\S]*?\n\s{4}\}/);
  expect(escapeMatch).not.toBeNull();
  expect(renderMatch).not.toBeNull();
  const fn = new Function(
    `${escapeMatch![0]}\n${renderMatch![0]}\nreturn renderDiffOutput;`
  ) as () => (out: string) => string;
  return fn();
}

describe('/go-diff-wasm: 差分表示の色分け', () => {
  it('追加行はdiff-add、削除行はdiff-del、変更なし行はdiff-ctxになる', () => {
    const html = getGoDiffWasmPage('tester');
    const scriptMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();
    const script = scriptMatch![1];
    expect(script).toContain("cls = 'diff-add'");
    expect(script).toContain("cls = 'diff-del'");
    expect(script).toContain("cls = 'diff-ctx'");
    expect(script).toContain("cls = 'diff-meta'");
    expect(script).toContain('resultValue.innerHTML = renderDiffOutput(out)');
  });

  it('CSSにdiff-add(緑系)・diff-del(赤系)の色定義がある', () => {
    const html = getGoDiffWasmPage('tester');
    expect(html).toContain('.diff-line.diff-add');
    expect(html).toContain('.diff-line.diff-del');
    expect(html).toContain('#dcfce7');
    expect(html).toContain('#fee2e2');
  });

  it('renderDiffOutputが接頭辞ごとに正しいクラスへ振り分ける(実際に評価)', () => {
    const html = getGoDiffWasmPage('tester');
    const renderDiffOutput = extractRenderDiffOutput(html);
    const out = renderDiffOutput('1行追加, 1行削除\n\n```diff\n  a\n- b\n+ c\n```');
    expect(out).toContain('class="diff-line diff-meta">1行追加, 1行削除<');
    expect(out).toContain('class="diff-line diff-ctx">  a<');
    expect(out).toContain('class="diff-line diff-del">- b<');
    expect(out).toContain('class="diff-line diff-add">+ c<');
  });

  it('renderDiffOutputはHTMLをエスケープする(XSS対策)', () => {
    const html = getGoDiffWasmPage('tester');
    const renderDiffOutput = extractRenderDiffOutput(html);
    const out = renderDiffOutput('+ <script>alert(1)</script>');
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).toContain('&lt;script&gt;');
  });
});
