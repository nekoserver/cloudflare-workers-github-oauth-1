// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getChessTsumePage } from './views/chessBoard';
import {
  CHESS_QXG7_CANDIDATES_ID,
  CHESS_QXG7_CANDIDATES_MARKS,
} from './data/chessQxg7Candidates';

// 対象: /chess-tsume-17te ページの対局選択に追加する「別棋譜」プリセット。
// Qxg7+のクイーン捨て駒(qxg7-sac-line)と同じ局面・同じ4手だが、16...Kh6
// 直後(次の一手を検討する局面)に、エンジンの最善候補である2つのナイトの
// 移動先(e3・f6、ともに評価0.00)を緑色のマス+🙄マークで注釈表示する。
// 故障シナリオ:
//   (1) マークが常時表示されてしまい、局面を戻す(棋譜の途中に移動する)と
//       まだ存在しないはずの17手目の候補が見えてしまう(marksは最終手数
//       (state.ply === state.moves.length)でのみ表示すべき)
//   (2) 別のプリセット/自作棋譜に切り替えてもmarksが残り続けてしまう
//       (state.marksのリセット漏れ)
//   (3) renderBoardにmarksを渡しても、highlights(緑の点滅枠)とsq-mark
//       (絵文字)のどちらか一方しか描画されない
function extractEngineBlock(html: string): string {
  const start = html.indexOf('var TSUME_INITIAL');
  const end = html.indexOf('\nvar state = {', start);
  if (start === -1 || end === -1) throw new Error('engine block が生成HTMLから見つからない');
  return html.slice(start, end);
}

function loadEngine(html: string) {
  const src = extractEngineBlock(html);
  const fn = new Function(
    `${src}\nreturn { QXG7_CANDIDATES: typeof QXG7_CANDIDATES !== 'undefined' ? QXG7_CANDIDATES : null, renderBoard: renderBoard, computeHighlights: computeHighlights };`
  );
  return fn();
}

describe('QXG7_CANDIDATES プリセットのデータ', () => {
  it('QXG7_CANDIDATESのデータ(marks含む)が生成HTMLに埋め込まれている', () => {
    const html = getChessTsumePage();
    const { QXG7_CANDIDATES } = loadEngine(html);
    expect(QXG7_CANDIDATES).not.toBeNull();
    expect(QXG7_CANDIDATES.id).toBe(CHESS_QXG7_CANDIDATES_ID);
    expect(QXG7_CANDIDATES.marks).toEqual(CHESS_QXG7_CANDIDATES_MARKS);
  });

  it('対局選択のドロップダウンに「別棋譜」の選択肢が追加されている', () => {
    const html = getChessTsumePage();
    const idx = html.indexOf('function populateKifuSelect');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 1200);
    expect(block).toContain('QXG7_CANDIDATES.id');
    expect(block).toContain('QXG7_CANDIDATES.title');
  });

  it('プリセット選択時に棋譜欄へ差し替えて自動再生する分岐がある', () => {
    const html = getChessTsumePage();
    const idx = html.indexOf('function onKifuSelectChange');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 2200);
    expect(block).toContain('val === QXG7_CANDIDATES.id');
    expect(block).toContain('QXG7_CANDIDATES.moveText');
  });

  it('「読み込んで再生」がプリセット選択中はQXG7_CANDIDATES.initialとmarksを使う', () => {
    const html = getChessTsumePage();
    const idx = html.indexOf('function loadFromKifuInput');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 1200);
    expect(block).toContain('QXG7_CANDIDATES.initial');
    expect(block).toContain('QXG7_CANDIDATES.marks');
  });
});

describe('renderBoard: marksを渡すと緑ハイライト+絵文字バッジの両方が描画される', () => {
  it('marks引数を省略しても従来どおり描画できる(後方互換性)', () => {
    const html = getChessTsumePage();
    const { renderBoard } = loadEngine(html);
    expect(() => renderBoard({ e4: 'wK' }, {})).not.toThrow();
    const out = renderBoard({ e4: 'wK' }, {});
    expect(out).not.toContain('sq-mark');
  });

  it('marksで指定したマスに絵文字バッジ(sq-mark)が描画される', () => {
    const html = getChessTsumePage();
    const { renderBoard } = loadEngine(html);
    document.body.innerHTML = '<div id="board"></div>';
    document.getElementById('board')!.innerHTML = renderBoard({}, {}, { e3: '🙄', f6: '🙄' });

    const e3Mark = document.querySelector('[data-square="e3"] .sq-mark');
    const f6Mark = document.querySelector('[data-square="f6"] .sq-mark');
    expect(e3Mark).not.toBeNull();
    expect(e3Mark!.textContent).toBe('🙄');
    expect(f6Mark).not.toBeNull();
    expect(f6Mark!.textContent).toBe('🙄');
  });

  it('.sq-hl-candidate(緑)のCSSクラスが定義されている', () => {
    const html = getChessTsumePage();
    const styleBlock = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    expect(styleBlock).toContain('.sq-hl-candidate');
    expect(styleBlock).toMatch(/\.sq-hl-candidate\{[^}]*#3fb950[^}]*\}/);
    expect(styleBlock).toContain('.sq-mark');
  });
});

describe('render(): marksは最終手数(次の一手を検討する局面)でのみ表示される', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  function bootPage(html: string) {
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    if (!scriptMatch) throw new Error('script block not found');
    // eslint-disable-next-line no-new-func
    new Function(scriptMatch[1])();
  }

  it('QXG7_CANDIDATESを選択し最後まで進めると、e3・f6にsq-markが表示される', () => {
    const html = getChessTsumePage();
    bootPage(html);
    const select = document.getElementById('kifu-select') as HTMLSelectElement;
    select.value = CHESS_QXG7_CANDIDATES_ID;
    select.dispatchEvent(new Event('change'));

    (document.getElementById('btn-last') as HTMLButtonElement).click();

    expect(document.querySelector('[data-square="e3"] .sq-mark')).not.toBeNull();
    expect(document.querySelector('[data-square="f6"] .sq-mark')).not.toBeNull();
  });

  it('同じプリセットでも最終手数より前(例: 1手目)ではまだmarksを表示しない', () => {
    const html = getChessTsumePage();
    bootPage(html);
    const select = document.getElementById('kifu-select') as HTMLSelectElement;
    select.value = CHESS_QXG7_CANDIDATES_ID;
    select.dispatchEvent(new Event('change'));

    (document.getElementById('btn-first') as HTMLButtonElement).click();
    (document.getElementById('btn-next') as HTMLButtonElement).click();

    expect(document.querySelector('[data-square="e3"] .sq-mark')).toBeNull();
    expect(document.querySelector('[data-square="f6"] .sq-mark')).toBeNull();
  });

  it('別のプリセット(17手詰め)に切り替えるとmarksが残らない', () => {
    const html = getChessTsumePage();
    bootPage(html);
    const select = document.getElementById('kifu-select') as HTMLSelectElement;
    select.value = CHESS_QXG7_CANDIDATES_ID;
    select.dispatchEvent(new Event('change'));
    (document.getElementById('btn-last') as HTMLButtonElement).click();
    expect(document.querySelector('.sq-mark')).not.toBeNull();

    select.value = 'tsume-17te';
    select.dispatchEvent(new Event('change'));
    (document.getElementById('btn-last') as HTMLButtonElement).click();
    expect(document.querySelector('.sq-mark')).toBeNull();
  });
});
