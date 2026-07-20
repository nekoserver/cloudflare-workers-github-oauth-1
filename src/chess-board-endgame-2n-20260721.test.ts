// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getChessTsumePage } from './views/chessBoard';
import {
  CHESS_ENDGAME_2N_ID,
  CHESS_ENDGAME_2N_INITIAL,
  CHESS_ENDGAME_2N_MOVE_TEXT,
} from './data/chessEndgame2n';

// 対象: /chess-tsume-17te ページの対局選択に追加する
// 「2ナイト+2パスポーンの14手詰め終盤(エンジン最善ライン)」プリセット。
// カスタム開始局面(FEN相当のposition map)+標準SAN棋譜で、昇格(=Q)を2回含む。
// 故障シナリオ:
//   (1) applySanMoveが返すmoveオブジェクトにpromoteが含まれず、parseGameTextの
//       解析時は昇格が適用されるのに、loadGame→buildPositionsでの再生時に
//       ポーンのまま盤上を動く(昇格消失バグ。既存の名局データには昇格が無いため
//       これまで顕在化していなかった)
//   (2) 対局選択でこのプリセットを選んでも開始局面がSTANDARD_STARTのままになり、
//       「読み込んで再生」ボタンで解析エラーになる
//   (3) 同色クイーンが2枚(e2/f1)ある状態でのQf8+/Qh5#の曖昧さ解決を誤る
describe('applySanMove: 昇格情報の保持(バグ修正の回帰テスト)', () => {
  function loadEngine(html: string) {
    const start = html.indexOf('var TSUME_INITIAL');
    const end = html.indexOf('\nvar state = {', start);
    if (start === -1 || end === -1) throw new Error('engine block が生成HTMLから見つからない');
    const src = html.slice(start, end);
    const fn = new Function(
      `${src}\nreturn { ENDGAME_2N: typeof ENDGAME_2N !== 'undefined' ? ENDGAME_2N : null, applySanMove: applySanMove, parseGameText: parseGameText, buildPositions: buildPositions };`
    );
    return fn();
  }

  it('applySanMoveは昇格手(d1=Q)でmove.promoteに昇格後の駒コードを返す', () => {
    const html = getChessTsumePage();
    const { applySanMove } = loadEngine(html);
    const result = applySanMove({ d2: 'bP' }, 'd1=Q', 'b');
    expect(result.next).toEqual({ d1: 'bQ' });
    expect(result.move.promote).toBe('bQ');
  });

  it('parseGameTextで解析した昇格手をbuildPositionsで再生しても昇格が再現される(round-trip)', () => {
    const html = getChessTsumePage();
    const { parseGameText, buildPositions } = loadEngine(html);
    const initial = { e7: 'wP' };
    const parsed = parseGameText('1. e8=Q', initial);
    expect(parsed.moves[0].promote).toBe('wQ');
    const replayed = buildPositions(initial, parsed.moves);
    expect(replayed[1]).toEqual({ e8: 'wQ' });
  });

  it('ENDGAME_2Nの棋譜全28手が解析でき、最終手がQh5#(mate)になる', () => {
    const html = getChessTsumePage();
    const { ENDGAME_2N, parseGameText } = loadEngine(html);
    expect(ENDGAME_2N).not.toBeNull();
    const parsed = parseGameText(ENDGAME_2N.moveText, ENDGAME_2N.initial);
    expect(parsed.moves).toHaveLength(28);
    const last = parsed.moves[parsed.moves.length - 1];
    expect(last.san).toBe('Qh5#');
    expect(last.mate).toBe(true);
    expect(last.from).toBe('e2');
  });

  it('ENDGAME_2Nをmoves再生(buildPositions)した最終局面が詰み図と完全一致する(昇格2回込み)', () => {
    const html = getChessTsumePage();
    const { ENDGAME_2N, parseGameText, buildPositions } = loadEngine(html);
    const parsed = parseGameText(ENDGAME_2N.moveText, ENDGAME_2N.initial);
    const replayed = buildPositions(ENDGAME_2N.initial, parsed.moves);
    expect(replayed[replayed.length - 1]).toEqual({
      h7: 'wK', a3: 'wP',
      e1: 'bK', f8: 'bQ', h5: 'bQ', a7: 'bP',
    });
  });

  it('8...d1=Q直後(16手目)の局面でd1が黒クイーンになりd2が空になる', () => {
    const html = getChessTsumePage();
    const { ENDGAME_2N, parseGameText, buildPositions } = loadEngine(html);
    const parsed = parseGameText(ENDGAME_2N.moveText, ENDGAME_2N.initial);
    const replayed = buildPositions(ENDGAME_2N.initial, parsed.moves);
    expect(replayed[16].d1).toBe('bQ');
    expect(replayed[16].d2).toBeUndefined();
  });
});

describe('/chess-tsume-17te ページ: 終盤プリセットのUI組み込み', () => {
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

  it('ENDGAME_2Nのデータ(初期配置・棋譜)がスクリプトに埋め込まれている', () => {
    expect(html).toContain('var ENDGAME_2N = ');
    expect(html).toContain(CHESS_ENDGAME_2N_ID);
    expect(html).toContain('Qh5#');
  });

  it('対局選択のドロップダウンにプリセットの選択肢が追加されている', () => {
    const idx = html.indexOf('function populateKifuSelect');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 700);
    expect(block).toContain('ENDGAME_2N.id');
    expect(block).toContain('ENDGAME_2N.title');
  });

  it('プリセット選択時に棋譜欄へ差し替えて自動再生する分岐がある', () => {
    const idx = html.indexOf('function onKifuSelectChange');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 1200);
    expect(block).toContain('val === ENDGAME_2N.id');
    expect(block).toContain('ENDGAME_2N.moveText');
  });

  it('「読み込んで再生」がプリセット選択中はENDGAME_2N.initialを開始局面に使う', () => {
    const idx = html.indexOf('function loadFromKifuInput');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('ENDGAME_2N.initial');
  });

  it('データの初期配置は白4駒・黒6駒で両キングを含む', () => {
    const entries = Object.entries(CHESS_ENDGAME_2N_INITIAL);
    expect(entries).toHaveLength(10);
    expect(entries.filter(([, p]) => p.startsWith('w'))).toHaveLength(4);
    expect(entries.filter(([, p]) => p.startsWith('b'))).toHaveLength(6);
    expect(Object.values(CHESS_ENDGAME_2N_INITIAL)).toContain('wK');
    expect(Object.values(CHESS_ENDGAME_2N_INITIAL)).toContain('bK');
  });

  it('棋譜テキストは14手(28半手)で昇格2回・王手3回・詰み1回を含む', () => {
    expect(CHESS_ENDGAME_2N_MOVE_TEXT.match(/=Q/g)).toHaveLength(2);
    expect(CHESS_ENDGAME_2N_MOVE_TEXT.match(/\+/g)).toHaveLength(3);
    expect(CHESS_ENDGAME_2N_MOVE_TEXT.match(/#/g)).toHaveLength(1);
    expect(CHESS_ENDGAME_2N_MOVE_TEXT).toContain('14. Kh7 Qh5#');
  });
});
