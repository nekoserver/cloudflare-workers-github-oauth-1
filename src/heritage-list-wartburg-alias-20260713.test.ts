import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';
import { findHeritageAreaPoint } from './index';

// 対象: HERITAGE_LISTのドイツ「ワルトブルク城」。ユーザーが「ヴァルトブルク城」という
// (原語Wartburgの発音により忠実な)表記で検索したところ見つからなかったため、
// 既存の「ワルトブルク城」と同一座標・登録年のエイリアスとして「ヴァルトブルク城」を追加する。
describe('HERITAGE_LIST — ドイツ ワルトブルク城/ヴァルトブルク城(表記ゆれエイリアス)', () => {
  it('既存の「ワルトブルク城」は変更せず、座標(50.97,10.30)・登録年(1999)を維持する', () => {
    const site = HERITAGE_LIST.find((s) => s.n === 'ワルトブルク城');
    expect(site).toBeDefined();
    expect(site).toMatchObject({ f: '🇩🇪', c: 'ドイツ', y: 1999, lat: 50.97, lon: 10.30 });
  });

  it('「ヴァルトブルク城」が同一座標・登録年のエイリアスとして追加されている', () => {
    const site = HERITAGE_LIST.find((s) => s.n === 'ヴァルトブルク城');
    expect(site).toBeDefined();
    expect(site).toMatchObject({ f: '🇩🇪', c: 'ドイツ', y: 1999, lat: 50.97, lon: 10.30 });
  });

  it('findHeritageAreaPointは「ヴァルトブルク城」表記のまま完全一致で解決できる', () => {
    const point = findHeritageAreaPoint('ヴァルトブルク城');
    expect(point).not.toBeNull();
    expect(point!.flag).toBe('🇩🇪');
    expect(point!.lat).toBeCloseTo(50.97, 1);
    expect(point!.lon).toBeCloseTo(10.30, 1);
  });

  it('「ワルトブルク城」表記も引き続き解決できる(既存挙動に影響なし)', () => {
    const point = findHeritageAreaPoint('ワルトブルク城');
    expect(point).not.toBeNull();
    expect(point!.flag).toBe('🇩🇪');
  });
});
