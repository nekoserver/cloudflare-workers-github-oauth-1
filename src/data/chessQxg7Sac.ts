import type { ChessPosition } from './chessTsume17te';

// 「15.Qxg7+ Kxg7 16.Nxd5+ Kh6」のクイーン捨て駒。実際の10+0(ブリッツ)の対局で
// ユーザーが検討したものの指さなかった手順。当初「白勝勢」という前提で
// 検証依頼を受けたが、Stockfish 10(深さ27〜28・60秒/局面)で解析した結果、
// 16...Kh6直後の局面はほぼ互角(0.00)であり、詰みも発見できなかった
// (白の最善は17.Ne3で単に立て直すのみ)。クイーン(9点)とビショップ+ナイト
// (6点)の交換で駒割は白が-3点だが、黒のクイーン+ルーク2枚が手つかずで
// 残っているため、王様がh6まで露出しても即座の寄せには至らない。
// 各手のCheckers(王手情報)をエンジンで裏取り済み: 15.Qxg7+はg7から、
// 16.Nxd5+はb2のビショップからの「空き王手」であることを確認している。
export const CHESS_QXG7_SAC_ID = 'qxg7-sac-line';
export const CHESS_QXG7_SAC_TITLE = 'Qxg7+のクイーン捨て駒(検証: 互角、勝勢ではない)';
export const CHESS_QXG7_SAC_NOTE =
  '15.Qxg7+ Kxg7 16.Nxd5+(b2のビショップからの空き王手)Kh6。Stockfish検証では' +
  'この局面は0.00(互角)で、白の最善は17.Ne3の立て直しのみ。クイーンとビショップ+' +
  'ナイトの交換で駒割は白-3点、黒のQ+R+Rが健在のため寄せには至らない。' +
  '「勝ちそう」に見えるのはh6まで露出した黒玉を人間が10分切れ負けで正確に' +
  '受け切るのが難しいという実戦的な意味であり、エンジン的な必勝ではない。';
export const CHESS_QXG7_SAC_INITIAL: ChessPosition = {
  a8: 'bR', d8: 'bQ', f8: 'bR', g8: 'bK',
  a7: 'bP', f7: 'bP', g7: 'bB', h7: 'bP',
  b6: 'bP', e6: 'bP', g6: 'bP',
  d5: 'bN',
  d4: 'wQ',
  b3: 'wP', c3: 'wN', g3: 'wP',
  a2: 'wP', b2: 'wB', e2: 'wP', f2: 'wP', g2: 'wK', h2: 'wP',
  a1: 'wR', d1: 'wR',
};
export const CHESS_QXG7_SAC_MOVE_TEXT = '15. Qxg7+ Kxg7 16. Nxd5+ Kh6';
