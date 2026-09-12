/**
 * Brush Jjaemu 系ミニゲームの純粋ロジック。
 * 猫が振り返る前にブラシ、振り返った瞬間にブラシ中なら即ゲームオーバー。
 */

export type CatFacing = 'away' | 'watching';

export type GamePhase = 'idle' | 'playing' | 'dead';

export type BrushJjaemuState = {
  score: number;
  highScore: number;
  phase: GamePhase;
  catFacing: CatFacing;
  msUntilTurn: number;
  msWatchingLeft: number;
};

export type BrushActionResult = BrushJjaemuState & {
  caught: boolean;
  scored: boolean;
};

const MIN_TURN_MS = 550;
const BASE_TURN_MS = 2600;
export const WATCH_MS = 850;

export function computeTurnIntervalMs(score: number): number {
  return Math.max(MIN_TURN_MS, BASE_TURN_MS - score * 38);
}

export function createInitialState(highScore = 0): BrushJjaemuState {
  return {
    score: 0,
    highScore,
    phase: 'idle',
    catFacing: 'away',
    msUntilTurn: computeTurnIntervalMs(0),
    msWatchingLeft: 0,
  };
}

export function startGame(state: BrushJjaemuState): BrushJjaemuState {
  return {
    ...createInitialState(state.highScore),
    phase: 'playing',
  };
}

/** 振り返り中にブラシしていたら捕まり */
export function isCaughtWhileWatching(catFacing: CatFacing, brushing: boolean): boolean {
  return catFacing === 'watching' && brushing;
}

/** 背中向きのブラシ1ストローク分のスコア */
export function scoreForBrush(catFacing: CatFacing): number {
  return catFacing === 'away' ? 1 : 0;
}

export function applyBrushStroke(
  state: BrushJjaemuState,
  brushing: boolean,
): BrushActionResult {
  if (state.phase !== 'playing' || !brushing) {
    return { ...state, caught: false, scored: false };
  }

  if (isCaughtWhileWatching(state.catFacing, brushing)) {
    const highScore = Math.max(state.highScore, state.score);
    return {
      ...state,
      phase: 'dead',
      highScore,
      caught: true,
      scored: false,
    };
  }

  const add = scoreForBrush(state.catFacing);
  if (add > 0) {
    return {
      ...state,
      score: state.score + add,
      caught: false,
      scored: true,
    };
  }

  return { ...state, caught: false, scored: false };
}

export function tickBrushJjaemu(state: BrushJjaemuState, dtMs: number): BrushJjaemuState {
  if (state.phase !== 'playing') return state;

  if (state.catFacing === 'watching') {
    const msWatchingLeft = state.msWatchingLeft - dtMs;
    if (msWatchingLeft <= 0) {
      return {
        ...state,
        catFacing: 'away',
        msUntilTurn: computeTurnIntervalMs(state.score),
        msWatchingLeft: 0,
      };
    }
    return { ...state, msWatchingLeft };
  }

  const msUntilTurn = state.msUntilTurn - dtMs;
  if (msUntilTurn <= 0) {
    return {
      ...state,
      catFacing: 'watching',
      msUntilTurn: 0,
      msWatchingLeft: WATCH_MS,
    };
  }

  return { ...state, msUntilTurn };
}
