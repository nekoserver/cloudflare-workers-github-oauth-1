import { CHESS_QXG7_SAC_INITIAL, CHESS_QXG7_SAC_MOVE_TEXT } from './chessQxg7Sac';

// 「別棋譜」: Qxg7+のクイーン捨て駒(chessQxg7Sac.ts)と同じ局面・同じ4手だが、
// 16...Kh6直後(17手目を検討する局面)に、エンジンの最善候補である2つの
// ナイトの移動先(e3・f6、いずれも評価0.00で互角)を緑色のマス+🙄マークで
// 注釈表示するプリセット。実際に指す手は1つしか選べないため、両方を
// 「候補」として静的に示すのみで棋譜そのものには含めない(Ne3とNf6を
// 両方とも指すことはできないため)。
export type ChessSquareMark = { square: string; emoji: string };

export const CHESS_QXG7_CANDIDATES_ID = 'qxg7-sac-line-candidates';
export const CHESS_QXG7_CANDIDATES_TITLE = 'Qxg7+の結末: 17手目の候補(Ne3/Nf6、ともに互角)';
export const CHESS_QXG7_CANDIDATES_NOTE =
  '16...Kh6直後、白の最善候補は17.Ne3と17.Nf6のどちらも評価0.00(互角)。' +
  '緑のマス+🙄は「これが精一杯」というエンジンの淡々とした結論を表す。' +
  '駒割はクイーン対ビショップ+ナイトで白-3点、勝勢という期待とは裏腹に' +
  '単なる立て直ししか無いことを示している。';
export const CHESS_QXG7_CANDIDATES_INITIAL = CHESS_QXG7_SAC_INITIAL;
export const CHESS_QXG7_CANDIDATES_MOVE_TEXT = CHESS_QXG7_SAC_MOVE_TEXT;
export const CHESS_QXG7_CANDIDATES_MARKS: ChessSquareMark[] = [
  { square: 'e3', emoji: '🙄' },
  { square: 'f6', emoji: '🙄' },
];
