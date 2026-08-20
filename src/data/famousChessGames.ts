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
  {
    id: 'evergreen-1852',
    title: 'エバーグリーンゲーム(Evergreen Game)',
    players: 'Adolf Anderssen vs Jean Dufresne',
    year: '1852',
    event: 'Berlin(非公式の親善対局)',
    note: '19手目Rad1!と21手目Qxd7!!のクイーン捨て駒が有名な一局。24手目Bxe7#(残ったビショップ1枚のみでの詰み)で終局(不朽の名局と並ぶアンデルセンの代表作)。',
    moveText:
      '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 ' +
      '7. O-O d3 8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 ' +
      '13. Qa4 Bb6 14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 ' +
      '18. exf6 Rg8 19. Rad1 Qxf3 20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 ' +
      '23. Bd7+ Kf8 24. Bxe7#',
  },
];
