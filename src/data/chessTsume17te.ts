export type ChessSquare = string;
export type ChessPosition = Record<ChessSquare, string>;
export type ChessMove = {
  from: ChessSquare;
  to: ChessSquare;
  san: string;
  check?: boolean;
  mate?: boolean;
  promote?: string;
  rookFrom?: ChessSquare;
  rookTo?: ChessSquare;
};

export const CHESS_TSUME_17TE_TITLE = 'チェス版17手詰め(K+2R対裸玉のはしご詰め)';

export const CHESS_TSUME_17TE_INITIAL: ChessPosition = {
  g1: 'wK', e8: 'bK', a6: 'wR', h5: 'wR',
};

export const CHESS_TSUME_17TE_MOVES: ChessMove[] = [
  { from: 'g1', to: 'g2', san: 'Kg1-g2' },
  { from: 'e8', to: 'd8', san: 'Ke8-d8' },
  { from: 'a6', to: 'a8', san: 'Ra6-a8+', check: true },
  { from: 'd8', to: 'd7', san: 'Kd8-d7' },
  { from: 'h5', to: 'h7', san: 'Rh5-h7+', check: true },
  { from: 'd7', to: 'd6', san: 'Kd7-d6' },
  { from: 'a8', to: 'a6', san: 'Ra8-a6+', check: true },
  { from: 'd6', to: 'd5', san: 'Kd6-d5' },
  { from: 'h7', to: 'h5', san: 'Rh7-h5+', check: true },
  { from: 'd5', to: 'd4', san: 'Kd5-d4' },
  { from: 'a6', to: 'a4', san: 'Ra6-a4+', check: true },
  { from: 'd4', to: 'd3', san: 'Kd4-d3' },
  { from: 'h5', to: 'h3', san: 'Rh5-h3+', check: true },
  { from: 'd3', to: 'd2', san: 'Kd3-d2' },
  { from: 'a4', to: 'a2', san: 'Ra4-a2+', check: true },
  { from: 'd2', to: 'd1', san: 'Kd2-d1' },
  { from: 'h3', to: 'h1', san: 'Rh3-h1#', check: true, mate: true },
];
