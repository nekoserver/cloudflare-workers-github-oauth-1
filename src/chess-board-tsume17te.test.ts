// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getChessTsumePage } from './views/chessBoard';
import { CHESS_TSUME_17TE_INITIAL, CHESS_TSUME_17TE_MOVES } from './data/chessTsume17te';

// 対象: /chess-tsume-17te ページの汎用チェス盤面ビューア。
//   (1) 局面(position map)に指し手(from/to)を適用するapplyPly
//   (2) 初期局面から全手を適用したスナップショット列を作るbuildPositions
//   (3) 局面をSVGならぬDOM(8x8グリッド)へ描画するrenderBoard
//   (4) 棋譜一覧を描画するrenderMoveList
//   (5) ply(手数)を前後にナビゲートするUI(戻る/進む/再生/逆再生/棋譜クリック)
// 故障シナリオ:
//   (1) applyPlyが元のpositionオブジェクトを破壊的に変更してしまい、
//       スナップショット列が全て同じ局面を指してしまう(参照共有バグ)
//   (2) buildPositionsのスナップショット数が指し手数+1にならない
//   (3) renderBoardのランク/ファイル座標変換を誤り、駒が実際と違うマスに描画される
//   (4) 「進む」を最終手より先、「戻る」を初手より前に押しても例外になる/範囲外に行く
//   (5) 棋譜クリックで直接その局面へジャンプできない
//   (6) 再生/逆再生のタイマーが停止操作後も動き続ける

function extractFn(html: string, name: string, argsPattern: string): string {
  const re = new RegExp('function ' + name + '\\(' + argsPattern + '\\) \\{[\\s\\S]*?\\n\\}');
  const m = html.match(re);
  if (!m) throw new Error(name + ' が生成HTMLから見つからない');
  return m[0];
}

function loadPureFns(html: string) {
  const src = [
    extractFn(html, 'squareCoords', 'square'),
    extractFn(html, 'applyPly', 'position, move'),
    extractFn(html, 'buildPositions', 'initial, moves'),
    extractFn(html, 'pieceGlyph', 'code'),
    "var PIECE_GLYPH = {wK:'\\u2654',wQ:'\\u2655',wR:'\\u2656',wB:'\\u2657',wN:'\\u2658',wP:'\\u2659',bK:'\\u265A',bQ:'\\u265B',bR:'\\u265C',bB:'\\u265D',bN:'\\u265E',bP:'\\u265F'};",
    extractFn(html, 'renderBoard', 'position'),
    "var esc = function(s) { return String(s==null?'':s).replace(/[&<>\"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c];}); };",
    extractFn(html, 'renderMoveList', 'moves, currentPly'),
  ].join('\n');

  const fn = new Function(
    `${src}\nreturn { squareCoords: squareCoords, applyPly: applyPly, buildPositions: buildPositions, pieceGlyph: pieceGlyph, renderBoard: renderBoard, renderMoveList: renderMoveList };`
  );
  return fn();
}

describe('applyPly / buildPositions(純粋関数)', () => {
  it('applyPlyは移動元の駒を消し、移動先に駒を置く(元のpositionは変更しない)', () => {
    const html = getChessTsumePage();
    const { applyPly } = loadPureFns(html);
    const before = { g1: 'wK', e8: 'bK' };
    const after = applyPly(before, { from: 'g1', to: 'g2' });

    expect(after).toEqual({ g2: 'wK', e8: 'bK' });
    expect(before).toEqual({ g1: 'wK', e8: 'bK' });
  });

  it('applyPlyは移動先に敵駒があれば取る(上書きする)', () => {
    const html = getChessTsumePage();
    const { applyPly } = loadPureFns(html);
    const before = { a8: 'wR', d8: 'bK' };
    const after = applyPly(before, { from: 'a8', to: 'd8' });
    expect(after).toEqual({ d8: 'wR' });
  });

  it('buildPositionsは指し手数+1個のスナップショットを作り、各手を独立に保持する', () => {
    const html = getChessTsumePage();
    const { buildPositions } = loadPureFns(html);
    const positions = buildPositions(CHESS_TSUME_17TE_INITIAL, CHESS_TSUME_17TE_MOVES);

    expect(positions.length).toBe(CHESS_TSUME_17TE_MOVES.length + 1);
    expect(positions[0]).toEqual(CHESS_TSUME_17TE_INITIAL);
    expect(positions[1]).toEqual({ g2: 'wK', e8: 'bK', a6: 'wR', h5: 'wR' });
  });

  it('17手詰めの最終局面(詰み)は白Kg2・白Ra2・白Rh1・黒Kd1になる', () => {
    const html = getChessTsumePage();
    const { buildPositions } = loadPureFns(html);
    const positions = buildPositions(CHESS_TSUME_17TE_INITIAL, CHESS_TSUME_17TE_MOVES);
    const final = positions[positions.length - 1];

    expect(final).toEqual({ g2: 'wK', a2: 'wR', h1: 'wR', d1: 'bK' });
  });
});

describe('squareCoords', () => {
  it('マス目表記(例: a1, h8)をfile/rank(0始まり)に変換する', () => {
    const html = getChessTsumePage();
    const { squareCoords } = loadPureFns(html);
    expect(squareCoords('a1')).toEqual({ file: 0, rank: 0 });
    expect(squareCoords('h8')).toEqual({ file: 7, rank: 7 });
    expect(squareCoords('e4')).toEqual({ file: 4, rank: 3 });
  });
});

describe('renderBoard', () => {
  it('64マス全てを描画し、初期局面の駒(K1個・K1個・R2個)を正しいマスに配置する', () => {
    const html = getChessTsumePage();
    const { renderBoard } = loadPureFns(html);
    document.body.innerHTML = '<div id="board"></div>';
    document.getElementById('board')!.innerHTML = renderBoard(CHESS_TSUME_17TE_INITIAL);

    const squares = document.querySelectorAll('.sq');
    expect(squares.length).toBe(64);

    const pieces = document.querySelectorAll('.sq-piece');
    expect(pieces.length).toBe(4);

    const g1 = document.querySelector('[data-square="g1"] .sq-piece');
    expect(g1?.getAttribute('data-piece')).toBe('wK');
    expect(g1?.classList.contains('pc-w')).toBe(true);

    const e8 = document.querySelector('[data-square="e8"] .sq-piece');
    expect(e8?.getAttribute('data-piece')).toBe('bK');
    expect(e8?.classList.contains('pc-b')).toBe(true);

    const a6 = document.querySelector('[data-square="a6"] .sq-piece');
    expect(a6?.getAttribute('data-piece')).toBe('wR');

    const h5 = document.querySelector('[data-square="h5"] .sq-piece');
    expect(h5?.getAttribute('data-piece')).toBe('wR');
  });

  it('駒が無いマスにはsq-pieceを描画しない', () => {
    const html = getChessTsumePage();
    const { renderBoard } = loadPureFns(html);
    document.body.innerHTML = '<div id="board"></div>';
    document.getElementById('board')!.innerHTML = renderBoard(CHESS_TSUME_17TE_INITIAL);

    const a1 = document.querySelector('[data-square="a1"]');
    expect(a1?.querySelector('.sq-piece')).toBeNull();
  });
});

describe('renderMoveList', () => {
  it('2手ずつ番号を振り、指定したplyのボタンにactiveクラスを付ける', () => {
    const html = getChessTsumePage();
    const { renderMoveList } = loadPureFns(html);
    document.body.innerHTML = '<div id="ml"></div>';
    document.getElementById('ml')!.innerHTML = renderMoveList(CHESS_TSUME_17TE_MOVES, 3);

    const rows = document.querySelectorAll('.mv-row');
    expect(rows.length).toBe(9); // 17手 => 9組(最後は白のみ)

    const btns = document.querySelectorAll('.mv-btn');
    expect(btns.length).toBe(17);
    expect(btns[0].getAttribute('data-ply')).toBe('1');
    expect(btns[0].textContent).toBe('Kg1-g2');
    expect(btns[16].getAttribute('data-ply')).toBe('17');
    expect(btns[16].textContent).toBe('Rh3-h1#');

    const active = document.querySelector('.mv-btn.active');
    expect(active?.getAttribute('data-ply')).toBe('3');
  });

  it('最終手(17手目)は黒の応手が無いペアとして描画される', () => {
    const html = getChessTsumePage();
    const { renderMoveList } = loadPureFns(html);
    document.body.innerHTML = '<div id="ml"></div>';
    document.getElementById('ml')!.innerHTML = renderMoveList(CHESS_TSUME_17TE_MOVES, 17);

    const lastRow = document.querySelectorAll('.mv-row')[8];
    expect(lastRow.querySelectorAll('.mv-btn').length).toBe(1);
  });
});

describe('/chess-tsume-17te ページ: UI操作(戻る/進む/最初/最後/棋譜クリック/再生)', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); });

  function loadIntoDom(): void {
    const html = getChessTsumePage();
    const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
    const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
    if (!bodyMatch || !scriptMatch) throw new Error('body/scriptが見つからない');
    document.body.innerHTML = bodyMatch[1].replace(/<script>[\s\S]*?<\/script>/, '');
    const fn = new Function(scriptMatch[1]);
    fn();
  }

  it('初期表示はply=0で開始局面、「戻る」「最初」は無効化されている', () => {
    loadIntoDom();
    expect(document.getElementById('ply-indicator')!.textContent).toBe('0 / 17');
    expect((document.getElementById('btn-prev') as HTMLButtonElement).disabled).toBe(true);
    expect((document.getElementById('btn-first') as HTMLButtonElement).disabled).toBe(true);
    expect((document.getElementById('btn-next') as HTMLButtonElement).disabled).toBe(false);
  });

  it('「進む」を17回押すと詰みのply=17に到達し、「進む」「最後」が無効化される', () => {
    loadIntoDom();
    const next = document.getElementById('btn-next') as HTMLButtonElement;
    for (let i = 0; i < 17; i++) next.click();

    expect(document.getElementById('ply-indicator')!.textContent).toBe('17 / 17');
    expect(document.getElementById('status')!.textContent).toContain('詰み');
    expect(document.getElementById('status')!.classList.contains('is-mate')).toBe(true);
    expect(next.disabled).toBe(true);
  });

  it('「進む」を範囲外まで押しても17を超えない(境界チェック)', () => {
    loadIntoDom();
    const next = document.getElementById('btn-next') as HTMLButtonElement;
    for (let i = 0; i < 30; i++) next.click();
    expect(document.getElementById('ply-indicator')!.textContent).toBe('17 / 17');
  });

  it('「最後」→「戻る」で1手戻り、「戻る」を範囲外まで押しても0を下回らない', () => {
    loadIntoDom();
    (document.getElementById('btn-last') as HTMLButtonElement).click();
    (document.getElementById('btn-prev') as HTMLButtonElement).click();
    expect(document.getElementById('ply-indicator')!.textContent).toBe('16 / 17');

    for (let i = 0; i < 30; i++) (document.getElementById('btn-prev') as HTMLButtonElement).click();
    expect(document.getElementById('ply-indicator')!.textContent).toBe('0 / 17');
  });

  it('棋譜の手をクリックするとその局面へ直接ジャンプする', () => {
    loadIntoDom();
    const btn = document.querySelector('.mv-btn[data-ply="9"]') as HTMLButtonElement;
    btn.click();
    expect(document.getElementById('ply-indicator')!.textContent).toBe('9 / 17');
  });

  it('矢印キーで1手ずつ移動できる', () => {
    loadIntoDom();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(document.getElementById('ply-indicator')!.textContent).toBe('2 / 17');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(document.getElementById('ply-indicator')!.textContent).toBe('1 / 17');
  });

  it('「再生」を押すとタイマーで自動的に手が進み、最終手で自動停止する', () => {
    vi.useFakeTimers();
    loadIntoDom();
    (document.getElementById('btn-play') as HTMLButtonElement).click();
    expect(document.getElementById('btn-play')!.classList.contains('active')).toBe(true);

    vi.advanceTimersByTime(900 * 17);
    expect(document.getElementById('ply-indicator')!.textContent).toBe('17 / 17');
    expect(document.getElementById('btn-play')!.classList.contains('active')).toBe(false);

    const plyBefore = document.getElementById('ply-indicator')!.textContent;
    vi.advanceTimersByTime(900 * 3);
    expect(document.getElementById('ply-indicator')!.textContent).toBe(plyBefore);
  });

  it('再生中に「戻る」を押すと再生が止まる', () => {
    vi.useFakeTimers();
    loadIntoDom();
    (document.getElementById('btn-play') as HTMLButtonElement).click();
    vi.advanceTimersByTime(900 * 2);
    (document.getElementById('btn-prev') as HTMLButtonElement).click();
    expect(document.getElementById('btn-play')!.classList.contains('active')).toBe(false);

    const plyAfterStop = document.getElementById('ply-indicator')!.textContent;
    vi.advanceTimersByTime(900 * 5);
    expect(document.getElementById('ply-indicator')!.textContent).toBe(plyAfterStop);
  });

  it('「逆再生」はply=0で自動停止する', () => {
    vi.useFakeTimers();
    loadIntoDom();
    (document.getElementById('btn-last') as HTMLButtonElement).click();
    (document.getElementById('btn-play-rev') as HTMLButtonElement).click();
    expect(document.getElementById('btn-play-rev')!.classList.contains('active')).toBe(true);

    vi.advanceTimersByTime(900 * 17);
    expect(document.getElementById('ply-indicator')!.textContent).toBe('0 / 17');
    expect(document.getElementById('btn-play-rev')!.classList.contains('active')).toBe(false);
  });
});

describe('getChessTsumePage: ページ構造とルート登録', () => {
  it('必要なDOM要素(盤面・棋譜・操作ボタン)を含む', () => {
    const html = getChessTsumePage();
    expect(html).toContain('id="board"');
    expect(html).toContain('id="move-list"');
    expect(html).toContain('id="btn-first"');
    expect(html).toContain('id="btn-prev"');
    expect(html).toContain('id="btn-next"');
    expect(html).toContain('id="btn-last"');
    expect(html).toContain('id="btn-play"');
    expect(html).toContain('id="btn-play-rev"');
    expect(html).toContain('id="ply-indicator"');
  });

  it('/chess-tsume-17te ルートが登録されている', async () => {
    const src = await import('fs/promises').then((fs) => fs.readFile('./src/index.ts', 'utf-8'));
    expect(src).toContain("app.get('/chess-tsume-17te', authMiddleware");
    expect(src).toContain("import { getChessTsumePage } from './views/chessBoard';");
  });
});
