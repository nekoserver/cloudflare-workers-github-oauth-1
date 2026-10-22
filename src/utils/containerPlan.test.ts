import { describe, expect, it } from 'vitest';
import { calculateContainerPlan } from './containerPlan';
const pkg = (id: string, sizeMiB: number | null, seconds: number | null, dependencies: string[] = []) => ({ id, sizeMiB, seconds, dependencies });
describe('コンテナ構成の見積もり', () => {
  it('共有依存を一度だけ加算する', () => {
    const r = calculateContainerPlan({ baseMiB: 100, baseSeconds: 10, limitMiB: 200, limitSeconds: 50, selected: ['a', 'b'], packages: [pkg('a', 20, 5, ['shared']), pkg('b', 30, 6, ['shared']), pkg('shared', 10, 4)] });
    expect(r.imageMiB).toBe(160); expect(r.buildSeconds).toBe(25); expect(r.included).toHaveLength(3);
  });
  it('不明な計測値をゼロとみなして上限内と判定しない', () => {
    const r = calculateContainerPlan({ baseMiB: 100, baseSeconds: null, limitMiB: 200, limitSeconds: 50, selected: ['a'], packages: [pkg('a', null, 5)] });
    expect(r.imageMiB).toBeNull(); expect(r.buildSeconds).toBeNull(); expect(r.sizeStatus).toBe('unknown');
  });
  it('超過と循環・欠落依存を検出する', () => {
    expect(calculateContainerPlan({ baseMiB: 100, baseSeconds: 10, limitMiB: 90, limitSeconds: 5, selected: [], packages: [] }).sizeStatus).toBe('over');
    expect(() => calculateContainerPlan({ baseMiB: 0, baseSeconds: 0, limitMiB: null, limitSeconds: null, selected: ['a'], packages: [pkg('a', 1, 1, ['a'])] })).toThrow();
    expect(() => calculateContainerPlan({ baseMiB: -1, baseSeconds: 0, limitMiB: null, limitSeconds: null, selected: [], packages: [] })).toThrow();
    expect(() => calculateContainerPlan({ baseMiB: 0, baseSeconds: 0, limitMiB: null, limitSeconds: null, selected: ['missing'], packages: [] })).toThrow();
  });
});
