import { describe, expect, it } from 'vitest';
import {
  applyBrushStroke,
  computeTurnIntervalMs,
  createInitialState,
  isCaughtWhileWatching,
  scoreForBrush,
  startGame,
  tickBrushJjaemu,
} from './brushJjaemuLogic';

describe('computeTurnIntervalMs', () => {
  it('スコアが上がるほど振り返り間隔が短くなる', () => {
    expect(computeTurnIntervalMs(0)).toBeGreaterThan(computeTurnIntervalMs(20));
    expect(computeTurnIntervalMs(100)).toBeGreaterThanOrEqual(550);
  });
});

describe('isCaughtWhileWatching', () => {
  it('振り返り中にブラシ中なら捕まる', () => {
    expect(isCaughtWhileWatching('watching', true)).toBe(true);
  });

  it('振り返り中でもブラシしていなければ安全', () => {
    expect(isCaughtWhileWatching('watching', false)).toBe(false);
  });

  it('背中向きならブラシ中でも安全', () => {
    expect(isCaughtWhileWatching('away', true)).toBe(false);
  });
});

describe('scoreForBrush', () => {
  it('背中向きのときだけ1点', () => {
    expect(scoreForBrush('away')).toBe(1);
    expect(scoreForBrush('watching')).toBe(0);
  });
});

describe('applyBrushStroke', () => {
  it('背中向きでブラシするとスコアが増える', () => {
    const s = startGame(createInitialState());
    const next = applyBrushStroke(s, true);
    expect(next.score).toBe(1);
    expect(next.scored).toBe(true);
    expect(next.caught).toBe(false);
  });

  it('振り返り中にブラシすると dead になる', () => {
    const s = { ...startGame(createInitialState()), catFacing: 'watching' as const };
    const dead = applyBrushStroke(s, true);
    expect(dead.phase).toBe('dead');
    expect(dead.caught).toBe(true);
  });
});

describe('tickBrushJjaemu', () => {
  it('開始後 playing になる', () => {
    const playing = startGame(createInitialState());
    expect(playing.phase).toBe('playing');
    expect(playing.catFacing).toBe('away');
  });

  it('タイマー経過で猫が振り返る', () => {
    let s = startGame(createInitialState());
    s = { ...s, msUntilTurn: 10 };
    const turned = tickBrushJjaemu(s, 20);
    expect(turned.catFacing).toBe('watching');
    expect(turned.msWatchingLeft).toBeGreaterThan(0);
  });

  it('凝視時間後に背中を向ける', () => {
    let s = startGame(createInitialState());
    s = { ...s, catFacing: 'watching', msWatchingLeft: 5 };
    const back = tickBrushJjaemu(s, 10);
    expect(back.catFacing).toBe('away');
  });
});
