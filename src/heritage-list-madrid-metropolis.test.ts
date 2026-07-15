import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — マドリード（メトロポリス・ビル）', () => {
  it('マドリード（メトロポリス・ビル）が未登録年の文化遺産候補として存在する', () => {
    const site = HERITAGE_LIST.find((s) => s.n === 'マドリード（メトロポリス・ビル）');
    expect(site).toBeTruthy();
    expect(site!.c).toBe('スペイン');
    expect(site!.t).toBe('文化遺産');
    expect(site!.y).toBe('----');
  });

  it('座標がマドリード中心部のメトロポリス・ビル付近を指す', () => {
    const site = HERITAGE_LIST.find((s) => s.n === 'マドリード（メトロポリス・ビル）');
    expect(site).toBeTruthy();
    expect(site!.lat).toBeCloseTo(40.418854, 6);
    expect(site!.lon).toBeCloseTo(-3.697263, 6);
  });
});
