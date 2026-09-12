import { describe, expect, it } from 'vitest';
import { MAHJONG_DISCARD_PROBLEMS } from './data/mahjongDiscardProblems';
import { flyBrainChooseDiscard } from './flyBrainMahjongLogic';
import { parseHandTokens, recommendDiscard } from './mahjongDiscardLogic';
import { calcShanten } from './mahjongShanten';

describe('parseHandTokens', () => {
  it('123m 11p を展開できる', () => {
    const c = parseHandTokens('123m 11p');
    expect(c[0]).toBe(1);
    expect(c[1]).toBe(1);
    expect(c[2]).toBe(1);
    expect(c[9]).toBe(2);
  });
});

describe('calcShanten', () => {
  it('テンパイ形は向聴0', () => {
    const c = parseHandTokens('123m 456m 789m 11p 34p');
    expect(calcShanten(c)).toBe(0);
  });

  it('和了形14枚は向聴0以下', () => {
    const c = parseHandTokens('123456789m 111p 22p');
    expect(calcShanten(c)).toBeLessThanOrEqual(0);
  });
});

describe('recommendDiscard', () => {
  it('孤立7sを切る', () => {
    const r = recommendDiscard('123m 456m 789m 11p 34p 7s');
    expect(r.best.tileLabel).toBe('7s');
    expect(r.best.shanten).toBe(0);
  });

  for (const p of MAHJONG_DISCARD_PROBLEMS) {
    it(`${p.id}: ${p.title}`, () => {
      const r = recommendDiscard(p.hand);
      expect(r.best.tileLabel).toBe(p.expectedDiscard);
    });
  }
});

describe('flyBrainChooseDiscard', () => {
  for (const p of MAHJONG_DISCARD_PROBLEMS) {
    it(`ハエの脳も ${p.id} で ${p.expectedDiscard} を選ぶ`, () => {
      const r = recommendDiscard(p.hand);
      const fly = flyBrainChooseDiscard(r.candidates);
      expect(fly.chosen.tileLabel).toBe(p.expectedDiscard);
    });
  }
});
