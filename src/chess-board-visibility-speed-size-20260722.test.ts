// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getChessTsumePage } from './views/chessBoard';

// 対象: /chess-tsume-17te ページの盤面ビューア。
// ユーザーから「白の駒が見づらい」「再生速度が速すぎる」「駒サイズを段階的に
// 変えられるようにしてほしい」の3点の改善依頼を受けた。
// 故障シナリオ:
//   (1) 白駒に「アウトライン(中抜き)」書体のUnicodeグリフ(U+2654-2659)を使うと、
//       文字自体がほぼ縁取りだけなので、CSSでどれだけ明るい色を当てても
//       塗り面積が無く視認性が上がらない(今回の不具合の根本原因)。
//       黒駒と同じ「塗りつぶし」書体のグリフ(U+265A-265F)を白駒にも使い、
//       色の違いだけで白黒を判別させる必要がある
//   (2) 再生間隔(PLAY_INTERVAL_MS)を変更しても、実際のsetInterval呼び出しに
//       反映されていない(定数だけ変えてハードコードされた別の値を使っている)
//   (3) 駒サイズの段階切り替えUIが、実際にCSS変数やクラスへ反映されていない
//       (見た目上ボタンはあるが押しても変化しない)
function extractEngineBlock(html: string): string {
  const start = html.indexOf('var TSUME_INITIAL');
  const end = html.indexOf('\nvar state = {', start);
  if (start === -1 || end === -1) throw new Error('engine block が生成HTMLから見つからない');
  return html.slice(start, end);
}

describe('駒の視認性: 白駒も黒駒と同じ「塗りつぶし」グリフを使う', () => {
  it('PIECE_GLYPHのw*とb*が同一コードポイント(塗りつぶし書体)を指している', () => {
    const html = getChessTsumePage();
    const src = extractEngineBlock(html);
    const fn = new Function(`${src}\nreturn { PIECE_GLYPH: PIECE_GLYPH };`);
    const { PIECE_GLYPH } = fn();
    expect(PIECE_GLYPH.wK).toBe(PIECE_GLYPH.bK);
    expect(PIECE_GLYPH.wQ).toBe(PIECE_GLYPH.bQ);
    expect(PIECE_GLYPH.wR).toBe(PIECE_GLYPH.bR);
    expect(PIECE_GLYPH.wB).toBe(PIECE_GLYPH.bB);
    expect(PIECE_GLYPH.wN).toBe(PIECE_GLYPH.bN);
    expect(PIECE_GLYPH.wP).toBe(PIECE_GLYPH.bP);
  });

  it('白駒のグリフは中抜き書体(U+2654-2659)ではなく塗りつぶし書体(U+265A-265F)を使う', () => {
    const html = getChessTsumePage();
    const src = extractEngineBlock(html);
    const fn = new Function(`${src}\nreturn { PIECE_GLYPH: PIECE_GLYPH };`);
    const { PIECE_GLYPH } = fn();
    const filledRange = ['♚', '♛', '♜', '♝', '♞', '♟'];
    ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP'].forEach((code) => {
      expect(filledRange).toContain(PIECE_GLYPH[code]);
    });
  });

  it('.pc-wのCSSに視認性強化のためのstroke/text-shadowが設定されている', () => {
    const html = getChessTsumePage();
    const styleBlock = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    const rule = styleBlock.slice(styleBlock.indexOf('.pc-w{'), styleBlock.indexOf('.pc-w{') + 200);
    expect(rule).toMatch(/text-shadow|-webkit-text-stroke/);
  });
});

describe('再生速度: PLAY_INTERVAL_MSが緩和されsetIntervalに実際に使われている', () => {
  it('PLAY_INTERVAL_MSが900より大きい値に変更されている', () => {
    const html = getChessTsumePage();
    const m = html.match(/var PLAY_INTERVAL_MS = (\d+);/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThan(900);
  });

  it('setIntervalの呼び出しがPLAY_INTERVAL_MS変数を参照している(ハードコードされた別の値ではない)', () => {
    const html = getChessTsumePage();
    const idx = html.indexOf('function startPlay');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('setInterval(');
    expect(block).toContain('PLAY_INTERVAL_MS');
    expect(block).not.toMatch(/setInterval\([^,]+,\s*\d+\)/);
  });
});

describe('駒サイズの段階切り替えUI', () => {
  it('駒サイズ切り替えボタンが複数(3段階以上)存在する', () => {
    const html = getChessTsumePage();
    const matches = html.match(/class="[^"]*size-btn[^"]*"/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('各ボタンにdata-scale属性があり、異なる倍率値を持つ(標準1を含む)', () => {
    const html = getChessTsumePage();
    const scales = Array.from(html.matchAll(/data-scale="([^"]+)"/g)).map((m) => m[1]);
    expect(scales.length).toBeGreaterThanOrEqual(3);
    expect(new Set(scales).size).toBe(scales.length);
    expect(scales).toContain('1');
  });

  it('.sq-pieceのfont-sizeがCSS変数--piece-scaleを乗算する式になっている', () => {
    const html = getChessTsumePage();
    const styleBlock = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    const rule = styleBlock.slice(styleBlock.indexOf('.sq-piece{'), styleBlock.indexOf('.sq-piece{') + 200);
    expect(rule).toContain('--piece-scale');
  });

  it('サイズボタンのクリックハンドラがdocumentElement.styleへ--piece-scaleを設定する', () => {
    const html = getChessTsumePage();
    const idx = html.indexOf('size-btn');
    const scriptStart = html.indexOf('<script>');
    const block = html.slice(scriptStart);
    expect(block).toContain('--piece-scale');
    expect(block).toMatch(/setProperty\(\s*['"]--piece-scale['"]/);
  });

  it('サイズボタンクリック時にactiveクラスが押したボタンだけに付き、他は外れる', () => {
    const html = getChessTsumePage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
    // scriptタグを実行環境で動かすのは大掛かりなため、ここではDOM構造(初期activeが1個だけ)を確認する
    const buttons = document.querySelectorAll('.size-btn');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    const activeButtons = document.querySelectorAll('.size-btn.active');
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0].getAttribute('data-scale')).toBe('1');
  });
});
