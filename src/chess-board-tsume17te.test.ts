// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getChessTsumePage } from './views/chessBoard';
import { CHESS_TSUME_17TE_INITIAL, CHESS_TSUME_17TE_MOVES } from './data/chessTsume17te';
import { FAMOUS_CHESS_GAMES } from './data/famousChessGames';

// 対象: /chess-tsume-17te ページの汎用チェス盤面ビューア。
//   (1) 局面(position map)に指し手を適用するapplyPly/movePiece(キャスリング・プロモーション対応)
//   (2) 標準的な代数記法(SAN)を解釈し局面から指し手を一意に特定するapplySanMove/parseGameText
//   (3) 局面・棋譜一覧をDOM(8x8グリッド)へ描画するrenderBoard/renderMoveList
//   (4) ply(手数)を前後にナビゲートするUI(戻る/進む/再生/逆再生/棋譜クリック)
//   (5) 棋譜入力欄(クリア/読み込んで再生/対局選択)から任意の棋譜を読み込んで自動再生するUI
// 故障シナリオ:
//   (1) applyPlyが元のpositionオブジェクトを破壊的に変更する(参照共有バグ)
//   (2) SAN解析で移動元マスを誤って特定する(同種駒が複数ある場合の曖昧さ解決ミス)
//   (3) スライド駒(B/R/Q)の経路上に別の駒があるのに素通りしてしまう(利き判定の穴)
//   (4) キャスリングでルークの移動が伴わない/King以外の駒で判定してしまう
//   (5) ポーンの2マス前進を、初期段以外からでも許可してしまう
//   (6) !・!!・?・?!等の棋譜注釈記号を剥がせず解析エラーになる
//   (7) 棋譜入力欄で不正な棋譜を読み込んだ際、エラー表示されず盤面が壊れる/白紙になる
//   (8) 対局選択のドロップダウンで別の対局に切り替えても前の再生タイマーが動き続ける(二重再生)
//   (9) 「進む」を最終手より先、「戻る」を初手より前に押しても例外になる/範囲外に行く
//   (10) 再生/逆再生のタイマーが停止操作後も動き続ける

function extractEngineBlock(html: string): string {
  const start = html.indexOf('var TSUME_INITIAL');
  const end = html.indexOf('\nvar state = {', start);
  if (start === -1 || end === -1) throw new Error('engine block が生成HTMLから見つからない');
  return html.slice(start, end);
}

function loadEngine(html: string) {
  const src = extractEngineBlock(html);
  const fn = new Function(
    `${src}\nreturn { TSUME_INITIAL: TSUME_INITIAL, TSUME_MOVES: TSUME_MOVES, FAMOUS_GAMES: FAMOUS_GAMES, ` +
      'STANDARD_START: STANDARD_START, squareCoords: squareCoords, pieceGlyph: pieceGlyph, movePiece: movePiece, ' +
      'applyPly: applyPly, buildPositions: buildPositions, canReach: canReach, findKing: findKing, ' +
      'findPawnOrigin: findPawnOrigin, findPieceOrigin: findPieceOrigin, applySanMove: applySanMove, ' +
      'parseGameText: parseGameText, movesToText: movesToText, renderBoard: renderBoard, ' +
      'renderMoveList: renderMoveList, stripAnnotation: stripAnnotation };'
  );
  return fn();
}

describe('applyPly / buildPositions(純粋関数)', () => {
  it('applyPlyは移動元の駒を消し、移動先に駒を置く(元のpositionは変更しない)', () => {
    const html = getChessTsumePage();
    const { applyPly } = loadEngine(html);
    const before = { g1: 'wK', e8: 'bK' };
    const after = applyPly(before, { from: 'g1', to: 'g2' });

    expect(after).toEqual({ g2: 'wK', e8: 'bK' });
    expect(before).toEqual({ g1: 'wK', e8: 'bK' });
  });

  it('applyPlyは移動先に敵駒があれば取る(上書きする)', () => {
    const html = getChessTsumePage();
    const { applyPly } = loadEngine(html);
    const before = { a8: 'wR', d8: 'bK' };
    const after = applyPly(before, { from: 'a8', to: 'd8' });
    expect(after).toEqual({ d8: 'wR' });
  });

  it('applyPlyはrookFrom/rookToがあれば(キャスリング)ルークも同時に動かす', () => {
    const html = getChessTsumePage();
    const { applyPly } = loadEngine(html);
    const before = { e1: 'wK', h1: 'wR' };
    const after = applyPly(before, { from: 'e1', to: 'g1', rookFrom: 'h1', rookTo: 'f1' });
    expect(after).toEqual({ g1: 'wK', f1: 'wR' });
  });

  it('applyPlyはpromoteがあれば駒種を変えて配置する', () => {
    const html = getChessTsumePage();
    const { applyPly } = loadEngine(html);
    const before = { e7: 'wP' };
    const after = applyPly(before, { from: 'e7', to: 'e8', promote: 'wQ' });
    expect(after).toEqual({ e8: 'wQ' });
  });

  it('buildPositionsは指し手数+1個のスナップショットを作り、各手を独立に保持する', () => {
    const html = getChessTsumePage();
    const { buildPositions } = loadEngine(html);
    const positions = buildPositions(CHESS_TSUME_17TE_INITIAL, CHESS_TSUME_17TE_MOVES);

    expect(positions.length).toBe(CHESS_TSUME_17TE_MOVES.length + 1);
    expect(positions[0]).toEqual(CHESS_TSUME_17TE_INITIAL);
    expect(positions[1]).toEqual({ g2: 'wK', e8: 'bK', a6: 'wR', h5: 'wR' });
  });

  it('17手詰めの最終局面(詰み)は白Kg2・白Ra2・白Rh1・黒Kd1になる', () => {
    const html = getChessTsumePage();
    const { buildPositions } = loadEngine(html);
    const positions = buildPositions(CHESS_TSUME_17TE_INITIAL, CHESS_TSUME_17TE_MOVES);
    const final = positions[positions.length - 1];

    expect(final).toEqual({ g2: 'wK', a2: 'wR', h1: 'wR', d1: 'bK' });
  });
});

describe('squareCoords', () => {
  it('マス目表記(例: a1, h8)をfile/rank(0始まり)に変換する', () => {
    const html = getChessTsumePage();
    const { squareCoords } = loadEngine(html);
    expect(squareCoords('a1')).toEqual({ file: 0, rank: 0 });
    expect(squareCoords('h8')).toEqual({ file: 7, rank: 7 });
    expect(squareCoords('e4')).toEqual({ file: 4, rank: 3 });
  });
});

describe('stripAnnotation', () => {
  it('末尾の!・?・!!・?!・!?等の棋譜注釈記号を取り除く(+/#は残す)', () => {
    const html = getChessTsumePage();
    const { stripAnnotation } = loadEngine(html);
    expect(stripAnnotation('Nxb5!')).toBe('Nxb5');
    expect(stripAnnotation('Qb8+!!')).toBe('Qb8+');
    expect(stripAnnotation('Rxd7!')).toBe('Rxd7');
    expect(stripAnnotation('e4?!')).toBe('e4');
    expect(stripAnnotation('Rd8#')).toBe('Rd8#');
  });
});

describe('applySanMove: 標準的な代数記法(SAN)の解釈', () => {
  it('ポーンの1マス前進を解釈する', () => {
    const html = getChessTsumePage();
    const { applySanMove, STANDARD_START } = loadEngine(html);
    const { move } = applySanMove(STANDARD_START, 'e3', 'w');
    expect(move).toMatchObject({ from: 'e2', to: 'e3' });
  });

  it('ポーンの2マス前進(初期段のみ)を解釈する', () => {
    const html = getChessTsumePage();
    const { applySanMove, STANDARD_START } = loadEngine(html);
    const { move } = applySanMove(STANDARD_START, 'e4', 'w');
    expect(move).toMatchObject({ from: 'e2', to: 'e4' });
  });

  it('ポーンが初期段以外から2マス前進しようとするとエラーになる', () => {
    const html = getChessTsumePage();
    const { applySanMove, STANDARD_START, applyPly } = loadEngine(html);
    // e2-e3の後、e3のポーンがe5へ2マス飛ぼうとするのは不正
    const afterE3 = applyPly(STANDARD_START, { from: 'e2', to: 'e3' });
    expect(() => applySanMove(afterE3, 'e5', 'w')).toThrow();
  });

  it('ポーンの捕獲(dxe5)は指定した起点ファイルから斜めに解決する', () => {
    const html = getChessTsumePage();
    const { applySanMove, STANDARD_START, applyPly } = loadEngine(html);
    let pos = applyPly(STANDARD_START, { from: 'e2', to: 'e4' });
    pos = applyPly(pos, { from: 'd7', to: 'd5' });
    const { move } = applySanMove(pos, 'exd5', 'w');
    expect(move).toMatchObject({ from: 'e4', to: 'd5' });
  });

  it('ナイトの移動先が一意なら曖昧さ解決なしで解釈する', () => {
    const html = getChessTsumePage();
    const { applySanMove, STANDARD_START } = loadEngine(html);
    const { move } = applySanMove(STANDARD_START, 'Nf3', 'w');
    expect(move).toMatchObject({ from: 'g1', to: 'f3' });
  });

  it('同種駒が複数ある場合、ファイル指定(Nbd7)で曖昧さを解決する', () => {
    const html = getChessTsumePage();
    const { applySanMove } = loadEngine(html);
    // b8とf6両方のナイトがd7へ到達可能な局面を作る
    const pos = { b8: 'bN', f6: 'bN', e8: 'bK', e1: 'wK' };
    const { move } = applySanMove(pos, 'Nbd7', 'b');
    expect(move).toMatchObject({ from: 'b8', to: 'd7' });
  });

  it('ビショップ・ルークの利きは経路上の駒に遮られる(素通りしない)', () => {
    const html = getChessTsumePage();
    const { applySanMove } = loadEngine(html);
    // a1のルークとa8の間、a4に自駒があるのでa8へは届かない
    const pos = { a1: 'wR', a4: 'wP', a8: 'bK', e1: 'wK' };
    expect(() => applySanMove(pos, 'Ra8', 'w')).toThrow();
  });

  it('キャスリング(O-O)は白番でe1King->g1・h1Rook->f1に移動する', () => {
    const html = getChessTsumePage();
    const { applySanMove } = loadEngine(html);
    const pos = { e1: 'wK', h1: 'wR', e8: 'bK' };
    const { move, next } = applySanMove(pos, 'O-O', 'w');
    expect(move).toMatchObject({ from: 'e1', to: 'g1', rookFrom: 'h1', rookTo: 'f1' });
    expect(next).toEqual({ g1: 'wK', f1: 'wR', e8: 'bK' });
  });

  it('キャスリング(O-O-O)は黒番でe8King->c8・a8Rook->d8に移動する', () => {
    const html = getChessTsumePage();
    const { applySanMove } = loadEngine(html);
    const pos = { e8: 'bK', a8: 'bR', e1: 'wK' };
    const { move, next } = applySanMove(pos, 'O-O-O', 'b');
    expect(move).toMatchObject({ from: 'e8', to: 'c8', rookFrom: 'a8', rookTo: 'd8' });
    expect(next).toEqual({ c8: 'bK', d8: 'bR', e1: 'wK' });
  });

  it('+は王手、#は詰みとして記録する', () => {
    const html = getChessTsumePage();
    const { applySanMove } = loadEngine(html);
    const pos = { a6: 'wR', d8: 'bK', g1: 'wK' };
    const r1 = applySanMove(pos, 'Ra8+', 'w');
    expect(r1.move.check).toBe(true);
    expect(r1.move.mate).toBe(false);
    const r2 = applySanMove(pos, 'Ra8#', 'w');
    expect(r2.move.mate).toBe(true);
  });

  it('解析できない棋譜トークンは明確なエラーメッセージを投げる', () => {
    const html = getChessTsumePage();
    const { applySanMove, STANDARD_START } = loadEngine(html);
    expect(() => applySanMove(STANDARD_START, 'Zz9', 'w')).toThrow(/解析できない手/);
  });
});

describe('parseGameText: 棋譜テキスト全体の解析', () => {
  it('手数付き棋譜テキストを解析し、白黒交互のmoves配列とスナップショット列を作る', () => {
    const html = getChessTsumePage();
    const { parseGameText, STANDARD_START } = loadEngine(html);
    const { moves, positions } = parseGameText('1. e4 e5 2. Nf3 Nc6', STANDARD_START);
    expect(moves.length).toBe(4);
    expect(moves.map((m: any) => m.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(positions.length).toBe(5);
  });

  it('注釈記号(!・!!)付きのオペラゲームを解析し、白17手・黒16手(合計33半手)で最終手が詰み(#)になる', () => {
    const html = getChessTsumePage();
    const { parseGameText, STANDARD_START } = loadEngine(html);
    const opera = FAMOUS_CHESS_GAMES.find((g) => g.id === 'opera-1858')!;
    const { moves, positions } = parseGameText(opera.moveText, STANDARD_START);

    expect(moves.length).toBe(33);
    expect(moves[moves.length - 1].mate).toBe(true);
    expect(positions.length).toBe(34);
    // 詰みの最終局面: 白のルークがd8に到達している
    const final = positions[positions.length - 1];
    expect(final.d8).toBe('wR');
  });

  it('不朽の名局(Immortal Game)を解析し、白23手・黒22手(合計45半手)で最終手Be7#が詰みになる', () => {
    const html = getChessTsumePage();
    const { parseGameText, STANDARD_START } = loadEngine(html);
    const immortal = FAMOUS_CHESS_GAMES.find((g) => g.id === 'immortal-1851')!;
    const { moves, positions } = parseGameText(immortal.moveText, STANDARD_START);

    expect(moves.length).toBe(45);
    expect(moves[moves.length - 1].san).toBe('Be7#');
    expect(moves[moves.length - 1].mate).toBe(true);
    // 詰みの最終局面: 白ビショップがe7、黒キングはd8、白ナイトがd5とg7に残る
    const final = positions[positions.length - 1];
    expect(final.e7).toBe('wB');
    expect(final.d8).toBe('bK');
    expect(final.d5).toBe('wN');
    expect(final.g7).toBe('wN');
    // クイーン・両ルークを捧げた側(白)にはクイーンもルークも残っていない
    const whitePieces = Object.values(final).filter((p) => (p as string).startsWith('w'));
    expect(whitePieces).not.toContain('wQ');
    expect(whitePieces).not.toContain('wR');
  });

  it('空文字列や指し手が無い入力はエラーになる', () => {
    const html = getChessTsumePage();
    const { parseGameText, STANDARD_START } = loadEngine(html);
    expect(() => parseGameText('', STANDARD_START)).toThrow();
    expect(() => parseGameText('   ', STANDARD_START)).toThrow();
  });

  it('不正な手が含まれる場合、何手目のどのトークンかを含むエラーになる', () => {
    const html = getChessTsumePage();
    const { parseGameText, STANDARD_START } = loadEngine(html);
    expect(() => parseGameText('1. e4 e5 2. Zz9 Nc6', STANDARD_START)).toThrow(/3手目/);
  });
});

describe('全ての登録済み名局(FAMOUS_CHESS_GAMES)が例外なく解析できる', () => {
  it.each(FAMOUS_CHESS_GAMES.map((g) => [g.id, g] as const))('%s', (_id, game) => {
    const html = getChessTsumePage();
    const { parseGameText, STANDARD_START } = loadEngine(html);
    const { moves } = parseGameText(game.moveText, STANDARD_START);
    expect(moves.length).toBeGreaterThan(0);
  });
});

describe('renderBoard', () => {
  it('64マス全てを描画し、初期局面の駒(K1個・K1個・R2個)を正しいマスに配置する', () => {
    const html = getChessTsumePage();
    const { renderBoard } = loadEngine(html);
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
  });

  it('駒が無いマスにはsq-pieceを描画しない', () => {
    const html = getChessTsumePage();
    const { renderBoard } = loadEngine(html);
    document.body.innerHTML = '<div id="board"></div>';
    document.getElementById('board')!.innerHTML = renderBoard(CHESS_TSUME_17TE_INITIAL);

    const a1 = document.querySelector('[data-square="a1"]');
    expect(a1?.querySelector('.sq-piece')).toBeNull();
  });
});

describe('renderMoveList', () => {
  it('2手ずつ番号を振り、指定したplyのボタンにactiveクラスを付ける', () => {
    const html = getChessTsumePage();
    const { renderMoveList } = loadEngine(html);
    document.body.innerHTML = '<div id="ml"></div>';
    document.getElementById('ml')!.innerHTML = renderMoveList(CHESS_TSUME_17TE_MOVES, 3);

    const rows = document.querySelectorAll('.mv-row');
    expect(rows.length).toBe(9);

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
    const { renderMoveList } = loadEngine(html);
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

    vi.advanceTimersByTime(1500 * 17);
    expect(document.getElementById('ply-indicator')!.textContent).toBe('17 / 17');
    expect(document.getElementById('btn-play')!.classList.contains('active')).toBe(false);

    const plyBefore = document.getElementById('ply-indicator')!.textContent;
    vi.advanceTimersByTime(1500 * 3);
    expect(document.getElementById('ply-indicator')!.textContent).toBe(plyBefore);
  });

  it('再生中に「戻る」を押すと再生が止まる', () => {
    vi.useFakeTimers();
    loadIntoDom();
    (document.getElementById('btn-play') as HTMLButtonElement).click();
    vi.advanceTimersByTime(1500 * 2);
    (document.getElementById('btn-prev') as HTMLButtonElement).click();
    expect(document.getElementById('btn-play')!.classList.contains('active')).toBe(false);

    const plyAfterStop = document.getElementById('ply-indicator')!.textContent;
    vi.advanceTimersByTime(1500 * 5);
    expect(document.getElementById('ply-indicator')!.textContent).toBe(plyAfterStop);
  });

  it('「逆再生」はply=0で自動停止する', () => {
    vi.useFakeTimers();
    loadIntoDom();
    (document.getElementById('btn-last') as HTMLButtonElement).click();
    (document.getElementById('btn-play-rev') as HTMLButtonElement).click();
    expect(document.getElementById('btn-play-rev')!.classList.contains('active')).toBe(true);

    vi.advanceTimersByTime(1500 * 17);
    expect(document.getElementById('ply-indicator')!.textContent).toBe('0 / 17');
    expect(document.getElementById('btn-play-rev')!.classList.contains('active')).toBe(false);
  });
});

describe('/chess-tsume-17te ページ: 棋譜入力欄(クリア/読み込んで再生/対局選択)', () => {
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

  it('初期表示で棋譜入力欄に17手詰めの棋譜がプリセットされている', () => {
    loadIntoDom();
    const textarea = document.getElementById('kifu-input') as HTMLTextAreaElement;
    expect(textarea.value).toContain('Kg1-g2');
    expect(textarea.value).toContain('Rh3-h1#');
  });

  it('対局選択に17手詰め・登録済み名局・カスタムの選択肢がある', () => {
    loadIntoDom();
    const select = document.getElementById('kifu-select') as unknown as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('tsume-17te');
    expect(values).toContain('custom');
    FAMOUS_CHESS_GAMES.forEach((g) => expect(values).toContain(g.id));
  });

  it('「クリア」ボタンで棋譜入力欄が空になる', () => {
    loadIntoDom();
    (document.getElementById('btn-kifu-clear') as HTMLButtonElement).click();
    expect((document.getElementById('kifu-input') as HTMLTextAreaElement).value).toBe('');
  });

  it('対局選択でオペラゲームを選ぶと棋譜欄が差し替わり、自動再生が始まる', () => {
    vi.useFakeTimers();
    loadIntoDom();
    const select = document.getElementById('kifu-select') as unknown as HTMLSelectElement;
    select.value = 'opera-1858';
    select.dispatchEvent(new Event('change'));

    const textarea = document.getElementById('kifu-input') as HTMLTextAreaElement;
    expect(textarea.value).toContain('Rd8#');
    expect(document.getElementById('ply-indicator')!.textContent).toBe('0 / 33');
    expect(document.getElementById('btn-play')!.classList.contains('active')).toBe(true);

    vi.advanceTimersByTime(1500 * 2);
    expect(document.getElementById('ply-indicator')!.textContent).toBe('2 / 33');

    vi.advanceTimersByTime(1500 * 40);
    expect(document.getElementById('ply-indicator')!.textContent).toBe('33 / 33');
    expect(document.getElementById('status')!.textContent).toContain('詰み');
  });

  it('対局選択を切り替えると前の対局の再生タイマーは二重に動かない', () => {
    vi.useFakeTimers();
    loadIntoDom();
    const select = document.getElementById('kifu-select') as unknown as HTMLSelectElement;
    select.value = 'opera-1858';
    select.dispatchEvent(new Event('change'));
    vi.advanceTimersByTime(1500 * 3);

    select.value = 'tsume-17te';
    select.dispatchEvent(new Event('change'));
    const plyAfterSwitch = document.getElementById('ply-indicator')!.textContent;

    vi.advanceTimersByTime(1500);
    // 切り替え後も再生が始まる(17手詰めの自動再生)ため1手進むのは正常、
    // ここでは「2つのタイマーが同時に動いて2手以上進む」異常が起きないことを確認する
    const afterOneTick = document.getElementById('ply-indicator')!.textContent;
    const before = parseInt(plyAfterSwitch!.split(' / ')[0], 10);
    const after = parseInt(afterOneTick!.split(' / ')[0], 10);
    expect(after - before).toBeLessThanOrEqual(1);
  });

  it('「読み込んで再生」で自作の棋譜(標準初期配置)を読み込み、自動再生する', () => {
    vi.useFakeTimers();
    loadIntoDom();
    const select = document.getElementById('kifu-select') as unknown as HTMLSelectElement;
    select.value = 'custom';
    select.dispatchEvent(new Event('change'));

    const textarea = document.getElementById('kifu-input') as HTMLTextAreaElement;
    textarea.value = '1. e4 e5 2. Nf3 Nc6 3. Bb5';
    (document.getElementById('btn-kifu-load') as HTMLButtonElement).click();

    expect(document.getElementById('kifu-error')!.textContent).toBe('');
    expect(document.getElementById('ply-indicator')!.textContent).toBe('0 / 5');
    expect(document.getElementById('btn-play')!.classList.contains('active')).toBe(true);

    vi.advanceTimersByTime(1500 * 5);
    expect(document.getElementById('ply-indicator')!.textContent).toBe('5 / 5');
  });

  it('不正な棋譜を読み込むとエラーメッセージが表示され、盤面は変化しない', () => {
    loadIntoDom();
    (document.getElementById('btn-next') as HTMLButtonElement).click(); // ply=1にしておく
    (document.getElementById('kifu-select') as unknown as HTMLSelectElement).value = 'custom'; // 標準初期配置で解析させる
    const textarea = document.getElementById('kifu-input') as HTMLTextAreaElement;
    textarea.value = '1. e4 Zz9';
    (document.getElementById('btn-kifu-load') as HTMLButtonElement).click();

    expect(document.getElementById('kifu-error')!.textContent).toContain('2手目');
    expect(document.getElementById('ply-indicator')!.textContent).toBe('1 / 17');
  });

  it('読み込み成功後は直前のエラーメッセージが消える', () => {
    loadIntoDom();
    (document.getElementById('kifu-select') as unknown as HTMLSelectElement).value = 'custom';
    const textarea = document.getElementById('kifu-input') as HTMLTextAreaElement;
    textarea.value = '1. e4 Zz9';
    (document.getElementById('btn-kifu-load') as HTMLButtonElement).click();
    expect(document.getElementById('kifu-error')!.textContent).not.toBe('');

    textarea.value = '1. e4 e5';
    (document.getElementById('btn-kifu-load') as HTMLButtonElement).click();
    expect(document.getElementById('kifu-error')!.textContent).toBe('');
  });
});

describe('getChessTsumePage: ページ構造とルート登録', () => {
  it('必要なDOM要素(盤面・棋譜・操作ボタン・棋譜入力欄)を含む', () => {
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
    expect(html).toContain('id="kifu-select"');
    expect(html).toContain('id="kifu-input"');
    expect(html).toContain('id="btn-kifu-clear"');
    expect(html).toContain('id="btn-kifu-load"');
    expect(html).toContain('id="kifu-error"');
  });

  it('/chess-tsume-17te ルートが登録されている', async () => {
    const src = await import('fs/promises').then((fs) => fs.readFile('./src/index.ts', 'utf-8'));
    expect(src).toContain("app.get('/chess-tsume-17te', authMiddleware");
    expect(src).toContain("import { getChessTsumePage } from './views/chessBoard';");
  });
});
