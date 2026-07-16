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
  {
    id: 'immortal-1851',
    title: '不朽の名局(Immortal Game)',
    players: 'Adolf Anderssen vs Lionel Kieseritzky',
    year: '1851',
    event: 'London(ロンドン国際トーナメント期間中の非公式対局)',
    note: 'アンデルセンがビショップ(11手目)・両ルーク(18手目〜)・クイーン(22手目)を全て捧げ、残ったマイナーピースだけで詰ました伝説の一局。23手・Be7#で詰み。',
    moveText:
      '1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 ' +
      '7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 ' +
      '13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 ' +
      '18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7#',
  },
];
