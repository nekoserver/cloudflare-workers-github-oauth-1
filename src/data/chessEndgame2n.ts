import type { ChessPosition } from './chessTsume17te';

// R+N対2N+2Pの実戦型終盤局面(白番)からの、Stockfishによる双方最善応酬の
// 14手詰めライン。全28手を1手ずつエンジンに適用して合法性と詰みカウントの
// 単調減少(mate 18→16→…→1)を検証済み。エンジン最善ラインであり実戦の棋譜ではない。
export const CHESS_ENDGAME_2N_ID = 'endgame-2n-mate14';
export const CHESS_ENDGAME_2N_TITLE = '2ナイト+2パスポーンの14手詰め終盤(エンジン最善ライン)';
export const CHESS_ENDGAME_2N_NOTE =
  '白のRxd3!→Nb2+→Nd1ブロケードは正しい防御機構だが、黒は第2のパスポーン(f7)を走らせ、' +
  'Nf2+!で昇格マスの番人ナイトを強制排除。d1=Q・f1=Qと2枚のクイーンを作りQh5#まで。' +
  'Stockfish検証済みの最善応酬ライン(14手・実戦棋譜ではない)。';
export const CHESS_ENDGAME_2N_INITIAL: ChessPosition = {
  d5: 'wR', a4: 'wN', a3: 'wP', h2: 'wK',
  a7: 'bP', f7: 'bP', e4: 'bN', d3: 'bN', d2: 'bP', e2: 'bK',
};
export const CHESS_ENDGAME_2N_MOVE_TEXT =
  '1. Rxd3 Kxd3 2. Nb2+ Ke2 3. Kh3 f5 4. Kh4 f4 5. Nd1 f3 6. Kg4 Nf2+ ' +
  '7. Nxf2 Kxf2 8. Kf4 d1=Q 9. Kf5 Qe2 10. Kg6 Ke1 11. Kf7 f2 ' +
  '12. Kg8 f1=Q 13. Kh8 Qf8+ 14. Kh7 Qh5#';
