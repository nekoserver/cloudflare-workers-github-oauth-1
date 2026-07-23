// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getChessTsumePage } from './views/chessBoard';

// 対象: /chess-tsume-17te ページの盤面ビューア。
// 「各局面の停止図で、その手番の候補手や取れる駒の枠を点滅破線で囲うオプション」
// という依頼を受け、4種類のトグルボタンを追加した:
//   - 動く駒(mover): 次に指される駒のマスをハイライト
//   - 移動先(moves): その駒が移動できる空きマスを点滅破線で囲う
//   - 取れる駒(captures): その駒が取れる相手の駒を点滅破線で囲う
//   - 狙われている駒(hanging): 盤面全体で、手番側がこの一手で取れる相手の駒
//     すべて(次に指す駒に限らない)を点滅破線で囲う
// 故障シナリオ:
//   (1) スライド駒(B/R/Q)の候補手が、経路上の駒を無視してすり抜けてしまう
//   (2) 味方駒がいるマスを移動先/捕獲先として誤って含めてしまう
//   (3) ポーンの2マス前進を初期段以外からも許可してしまう/斜め捕獲を敵駒が
//       無いマスでも許可してしまう(ポーンは前進と捕獲で規則が非対称)
//   (4) 最終局面(次の手が無い)でcomputeHighlightsが例外を投げる
//   (5) 「狙われている駒」が次に指す駒1枚分の候補にとどまり、手番側の
//       他の駒による捕獲可能マスを見落とす
//   (6) renderBoardへhighlightsを渡さない既存呼び出し(引数1個)が壊れる
//       (後方互換性)
//   (7) ハイライト用のCSSクラス・アニメーション(点滅)が生成HTMLに存在しない
function extractEngineBlock(html: string): string {
  const start = html.indexOf('var TSUME_INITIAL');
  const end = html.indexOf('\nvar state = {', start);
  if (start === -1 || end === -1) throw new Error('engine block が生成HTMLから見つからない');
  return html.slice(start, end);
}

function loadEngine(html: string) {
  const src = extractEngineBlock(html);
  const fn = new Function(
    `${src}\nreturn { pieceTargets: pieceTargets, computeHighlights: computeHighlights, renderBoard: renderBoard };`
  );
  return fn();
}

describe('pieceTargets(純粋関数): 駒種ごとの移動先/捕獲先の列挙', () => {
  it('スライド駒(ルーク)は経路上の駒でブロックされ、味方駒のマスは含まない/敵駒のマスは捕獲として含む', () => {
    const html = getChessTsumePage();
    const { pieceTargets } = loadEngine(html);
    const position = { a1: 'wR', a4: 'wP', c1: 'bN' };
    const result = pieceTargets(position, 'a1');
    expect(result.moves.sort()).toEqual(['a2', 'a3', 'b1'].sort());
    expect(result.captures).toEqual(['c1']);
  });

  it('ナイトはジャンプ先の味方駒マスを除外し、敵駒のマスは捕獲として返す', () => {
    const html = getChessTsumePage();
    const { pieceTargets } = loadEngine(html);
    const position = { d4: 'wN', b3: 'wP', f5: 'bP' };
    const result = pieceTargets(position, 'd4');
    expect(result.moves).not.toContain('b3');
    expect(result.captures).toContain('f5');
  });

  it('ポーンは初期段からのみ2マス前進でき、前進先が塞がっていれば1マスも進めない', () => {
    const html = getChessTsumePage();
    const { pieceTargets } = loadEngine(html);
    const fromStart = pieceTargets({ e2: 'wP' }, 'e2');
    expect(fromStart.moves.sort()).toEqual(['e3', 'e4'].sort());

    const notFromStart = pieceTargets({ e3: 'wP' }, 'e3');
    expect(notFromStart.moves).toEqual(['e4']);

    const blocked = pieceTargets({ e2: 'wP', e3: 'bP' }, 'e2');
    expect(blocked.moves).toEqual([]);
  });

  it('ポーンは斜めに敵駒がある時だけ捕獲でき、駒が無ければ移動もできない(直進のみで斜め前進は不可)', () => {
    const html = getChessTsumePage();
    const { pieceTargets } = loadEngine(html);
    const result = pieceTargets({ e4: 'wP', d5: 'bP', f5: 'wP' }, 'e4');
    expect(result.captures).toEqual(['d5']);
    expect(result.moves).not.toContain('f5');
    expect(result.moves).not.toContain('d5');
  });

  it('駒が存在しないマスを指定するとmoves/captures共に空配列を返す(例外を投げない)', () => {
    const html = getChessTsumePage();
    const { pieceTargets } = loadEngine(html);
    expect(pieceTargets({}, 'e4')).toEqual({ moves: [], captures: [] });
  });
});

describe('computeHighlights(純粋関数): 可視化オプションからハイライトマスを組み立てる', () => {
  const position = { d5: 'wR', a4: 'wN', a3: 'wP', h2: 'wK', a7: 'bP', f7: 'bP', e4: 'bN', d3: 'bN', d2: 'bP', e2: 'bK' };
  const moves = [{ from: 'd5', to: 'd3', san: 'Rxd3' }, { from: 'e2', to: 'd3', san: 'Kxd3' }];

  it('全オプションOFFなら空のハイライトを返す', () => {
    const html = getChessTsumePage();
    const { computeHighlights } = loadEngine(html);
    const result = computeHighlights(position, moves, 0, { mover: false, moves: false, captures: false, hanging: false });
    expect(result).toEqual({});
  });

  it('mover ONで次に動く駒(moves[ply].from)のマスだけがハイライトされる', () => {
    const html = getChessTsumePage();
    const { computeHighlights } = loadEngine(html);
    const result = computeHighlights(position, moves, 0, { mover: true, moves: false, captures: false, hanging: false });
    expect(Object.keys(result)).toEqual(['d5']);
    expect(result.d5).toEqual(['mover']);
  });

  it('moves ONで次に動く駒(Rd5)の移動可能マスがhighlightされ、捕獲先(d3)は含まない', () => {
    const html = getChessTsumePage();
    const { computeHighlights } = loadEngine(html);
    const result = computeHighlights(position, moves, 0, { mover: false, moves: true, captures: false, hanging: false });
    expect(result.d3).toBeUndefined();
    expect(Object.keys(result).length).toBeGreaterThan(0);
    Object.values(result).forEach((kinds) => expect(kinds).toEqual(['move']));
  });

  it('captures ONで次に動く駒(Rd5)の捕獲先(d3のナイト)だけがcaptureとしてハイライトされる', () => {
    const html = getChessTsumePage();
    const { computeHighlights } = loadEngine(html);
    const result = computeHighlights(position, moves, 0, { mover: false, moves: false, captures: true, hanging: false });
    expect(result.d3).toEqual(['capture']);
    expect(Object.keys(result)).toEqual(['d3']);
  });

  it('hanging ONで白番のとき、d5ルーク以外の白駒(a4ナイト等)が取れる黒駒も含めて盤面全体を対象にする', () => {
    const html = getChessTsumePage();
    const { computeHighlights } = loadEngine(html);
    const result = computeHighlights(position, moves, 0, { mover: false, moves: false, captures: false, hanging: true });
    // d5のルークが取れるd3のナイトに加え、a4のナイトが取れる駒があれば含まれる
    expect(result.d3).toEqual(['hanging']);
  });

  it('1マスに複数種のハイライトが重なる場合は配列にすべて含める(重複は追加しない)', () => {
    const html = getChessTsumePage();
    const { computeHighlights } = loadEngine(html);
    const result = computeHighlights(position, moves, 0, { mover: false, moves: false, captures: true, hanging: true });
    expect(result.d3.sort()).toEqual(['capture', 'hanging'].sort());
    expect(result.d3.length).toBe(2);
  });

  it('最終局面(moves[ply]が存在しない)でも例外を投げず、mover/moves/capturesは何も追加しない', () => {
    const html = getChessTsumePage();
    const { computeHighlights } = loadEngine(html);
    expect(() => computeHighlights(position, moves, moves.length, { mover: true, moves: true, captures: true, hanging: false })).not.toThrow();
    const result = computeHighlights(position, moves, moves.length, { mover: true, moves: true, captures: true, hanging: false });
    expect(result).toEqual({});
  });

  it('最終局面でもhangingは手番側の駒の捕獲可能マスを引き続き計算する', () => {
    const html = getChessTsumePage();
    const { computeHighlights } = loadEngine(html);
    // ply=2は白番(0-indexedで偶数)。d5ルークは既に動いた後の局面を想定していないため
    // 単純にposition自体で白から見える捕獲先が計算されることだけを確認する
    const result = computeHighlights(position, moves, 2, { mover: false, moves: false, captures: false, hanging: true });
    expect(result.d3).toEqual(['hanging']);
  });
});

describe('renderBoard: ハイライトの描画と後方互換性', () => {
  it('highlights引数を省略しても従来どおり描画できる(後方互換性)', () => {
    const html = getChessTsumePage();
    const { renderBoard } = loadEngine(html);
    expect(() => renderBoard({ e4: 'wK' })).not.toThrow();
    const out = renderBoard({ e4: 'wK' });
    expect(out).not.toContain('sq-hl');
  });

  it('highlightsで指定したマスにsq-hl要素が描画され、種類ごとにクラスが分かれる', () => {
    const html = getChessTsumePage();
    const { renderBoard } = loadEngine(html);
    document.body.innerHTML = '<div id="board"></div>';
    document.getElementById('board')!.innerHTML = renderBoard({ e4: 'wK' }, { d3: ['capture'], e2: ['move', 'hanging'] });

    const d3 = document.querySelector('[data-square="d3"] .sq-hl-capture');
    expect(d3).not.toBeNull();

    const e2Hls = document.querySelectorAll('[data-square="e2"] .sq-hl');
    expect(e2Hls.length).toBe(2);
    expect(document.querySelector('[data-square="e2"] .sq-hl-move')).not.toBeNull();
    expect(document.querySelector('[data-square="e2"] .sq-hl-hanging')).not.toBeNull();
  });
});

describe('/chess-tsume-17te ページ: 可視化オプションUIの組み込み', () => {
  const html = getChessTsumePage();

  it('script タグ内のJSに構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('4種類の可視化トグルボタン(動く駒/移動先/取れる駒/狙われている駒)が存在する', () => {
    ['viz-mover', 'viz-moves', 'viz-captures', 'viz-hanging'].forEach((id) => {
      expect(html).toContain('id="' + id + '"');
    });
  });

  it('可視化ボタンのクリックハンドラがstate.vizを反転させ、activeクラスを同期し、再描画する', () => {
    const idx = html.indexOf("querySelectorAll('.viz-btn')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 300);
    expect(block).toContain('state.viz[key] = !state.viz[key]');
    expect(block).toContain("classList.toggle('active', state.viz[key])");
    expect(block).toContain('render()');
  });

  it('renderがcomputeHighlightsの結果をrenderBoardへ渡している', () => {
    const idx = html.indexOf('function render()');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 700);
    expect(block).toContain('computeHighlights(state.positions[state.ply], state.moves, state.ply, state.viz)');
    expect(block).toContain('renderBoard(state.positions[state.ply], highlights, markMap)');
  });

  it('点滅アニメーション(sq-hl-blink)のCSSキーフレームが定義されている', () => {
    const styleBlock = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    expect(styleBlock).toContain('@keyframes sq-hl-blink');
    expect(styleBlock).toContain('.sq-hl-mover');
    expect(styleBlock).toContain('.sq-hl-move');
    expect(styleBlock).toContain('.sq-hl-capture');
    expect(styleBlock).toContain('.sq-hl-hanging');
  });

  it('4種類のトグルボタンは既定でOFF(activeクラス無し)', () => {
    ['viz-mover', 'viz-moves', 'viz-captures', 'viz-hanging'].forEach((id) => {
      const idx = html.indexOf('id="' + id + '"');
      const tagStart = html.lastIndexOf('<button', idx);
      const tag = html.slice(tagStart, idx + 40);
      expect(tag).not.toContain('active');
    });
  });
});
