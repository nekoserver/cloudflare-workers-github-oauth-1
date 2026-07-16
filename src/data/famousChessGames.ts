export type FamousChessGame = {
  id: string;
  title: string;
  players: string;
  year: string;
  event?: string;
  note?: string;
  moveText: string;
};

// 各棋譜は標準的な代数記法(SAN)で記述する。開始局面は通常のチェス初期配置。
// 出典: chessgames.com / Wikipedia の掲載内容とユーザー提示の棋譜を突き合わせて確認済み。
export const FAMOUS_CHESS_GAMES: FamousChessGame[] = [
  {
    id: 'opera-1858',
    title: 'オペラゲーム',
    players: 'Paul Morphy vs Duke Karl / Count Isouard',
    year: '1858',
    event: 'Paris, Salle Le Peletier(consultation game)',
    note: 'モルフィが単独で白を持ち、ブラウンシュヴァイク公とイズアール伯の相談チームを相手に指した最も有名な教育的名局。17手・Rd8#で詰み。',
    moveText:
      '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 ' +
      '7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 ' +
      '12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#',
  },
];
