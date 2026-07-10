import { describe, it, expect } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('世界遺産リスト: アルジェリア', () => {
  const algeria = HERITAGE_LIST.filter(h => h.c === 'アルジェリア');

  it('アルジェリアの世界遺産は7件登録されている(UNESCO登録数と一致)', () => {
    expect(algeria.length).toBe(7);
  });

  it('ベニ・ハンマッドの城塞が座標付きで登録されている', () => {
    const entry = algeria.find(h => h.n.includes('ベニ・ハンマッド'));
    expect(entry).toBeDefined();
    expect(entry!.t).toBe('文化遺産');
    expect(entry!.y).toBe(1980);
    expect(entry!.lat).toBeCloseTo(35.82, 1);
    expect(entry!.lon).toBeCloseTo(4.79, 1);
  });

  it('アルジェのカスバが座標付きで登録されている', () => {
    const entry = algeria.find(h => h.n.includes('カスバ'));
    expect(entry).toBeDefined();
    expect(entry!.t).toBe('文化遺産');
    expect(entry!.y).toBe(1992);
    expect(entry!.lat).toBeCloseTo(36.78, 1);
    expect(entry!.lon).toBeCloseTo(3.06, 1);
  });

  it('ムザブの谷が座標付きで登録されている', () => {
    const entry = algeria.find(h => h.n.includes('ムザブ'));
    expect(entry).toBeDefined();
    expect(entry!.t).toBe('文化遺産');
    expect(entry!.y).toBe(1982);
    expect(entry!.lat).toBeCloseTo(32.49, 1);
    expect(entry!.lon).toBeCloseTo(3.67, 1);
  });

  it('ティムガッドが座標付きで登録されている', () => {
    const entry = algeria.find(h => h.n.includes('ティムガッド'));
    expect(entry).toBeDefined();
    expect(entry!.t).toBe('文化遺産');
    expect(entry!.y).toBe(1982);
    expect(entry!.lat).toBeCloseTo(35.48, 1);
    expect(entry!.lon).toBeCloseTo(6.47, 1);
  });

  it('タッシリ・ナジェールが複合遺産として座標付きで登録されている', () => {
    const entry = algeria.find(h => h.n.includes('タッシリ'));
    expect(entry).toBeDefined();
    expect(entry!.t).toBe('複合遺産');
    expect(entry!.y).toBe(1982);
    expect(entry!.lat).toBeCloseTo(25.67, 1);
    expect(entry!.lon).toBeCloseTo(9.0, 1);
  });

  it('既存のジェミラ考古学遺跡・ティパサ考古学遺跡は維持されている', () => {
    expect(algeria.some(h => h.n.includes('ジェミラ'))).toBe(true);
    expect(algeria.some(h => h.n.includes('ティパサ'))).toBe(true);
  });
});
