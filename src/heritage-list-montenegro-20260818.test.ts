import { describe, it, expect } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';
import { COUNTRY_BORDERS } from './data/countryBorders';

// 対象: 世界遺産ページ(HERITAGE_LIST)のモンテネグロの項目。
// モンテネグロのUNESCO世界遺産は4件で、うち2件(ステチャク中世墓地群・
// ヴェネツィア共和国の防衛施設群)はボスニア・ヘルツェゴビナ/クロアチア/
// セルビア等との資産共有(トランスバウンダリー)資産として既存データに
// 登録済みだった。単独資産の「コトルの自然・文化-歴史地域」(1979年登録)と
// 「ドゥルミトル国立公園」(1980年登録)が欠落していたため追加した。
//
// 故障シナリオ:
//   (1) 既存の共有資産(ステチャク・ヴェネツィア防衛施設群)を重複追加してしまう
//   (2) 座標が実際の資産位置から大きくずれる(誤った国・地域を指す)
//   (3) 国旗絵文字が🇲🇪以外になる、または登録年が誤る

describe('世界遺産リスト: モンテネグロ', () => {
  const montenegroOwn = HERITAGE_LIST.filter((h) => h.f === '🇲🇪');
  const montenegroShared = HERITAGE_LIST.filter((h) => h.c.includes('モンテネグロ') && h.f !== '🇲🇪');

  it('モンテネグロ単独資産(コトル・ドゥルミトル)が2件追加されている', () => {
    expect(montenegroOwn).toHaveLength(2);
  });

  it('コトルの自然・文化-歴史地域が座標・登録年付きで追加されている', () => {
    const entry = montenegroOwn.find((h) => h.n.includes('コトル'));
    expect(entry).toBeDefined();
    expect(entry!.t).toBe('文化遺産');
    expect(entry!.y).toBe(1979);
    expect(entry!.lat).toBeCloseTo(42.42, 1);
    expect(entry!.lon).toBeCloseTo(18.77, 1);
  });

  it('ドゥルミトル国立公園が座標・登録年付きで追加されている', () => {
    const entry = montenegroOwn.find((h) => h.n.includes('ドゥルミトル'));
    expect(entry).toBeDefined();
    expect(entry!.t).toBe('自然遺産');
    expect(entry!.y).toBe(1980);
    expect(entry!.lat).toBeCloseTo(43.15, 1);
    expect(entry!.lon).toBeCloseTo(19.05, 1);
  });

  it('国旗絵文字はすべて🇲🇪で統一されている', () => {
    expect(montenegroOwn.every((h) => h.f === '🇲🇪')).toBe(true);
  });

  it('既存の共有資産(ステチャク中世墓地群・ヴェネツィア防衛施設群)は重複追加されず既存の2件のまま', () => {
    expect(montenegroShared).toHaveLength(2);
    expect(montenegroShared.some((h) => h.n.includes('ステチャク'))).toBe(true);
    expect(montenegroShared.some((h) => h.n.includes('ヴェネツィア共和国の防衛施設群'))).toBe(true);
  });

  it('COUNTRY_BORDERSにモンテネグロ(ME)の国境データが追加され、座標が有効範囲内にある', () => {
    const me = COUNTRY_BORDERS.find((c) => c.cc === 'ME');
    expect(me).toBeDefined();
    expect(me!.flag).toBe('🇲🇪');
    let latMin = 90, latMax = -90, lonMin = 180, lonMax = -180;
    me!.polygons.forEach((poly) => poly.forEach((ring) => ring.forEach(([lon, lat]) => {
      expect(Number.isFinite(lon)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
      latMin = Math.min(latMin, lat); latMax = Math.max(latMax, lat);
      lonMin = Math.min(lonMin, lon); lonMax = Math.max(lonMax, lon);
    })));
    // モンテネグロはアドリア海沿岸のバルカン半島南西部(概ね北緯42-43.3度、東経18.4-20.4度)に位置する
    expect(latMin).toBeGreaterThan(42);
    expect(latMax).toBeLessThan(43.5);
    expect(lonMin).toBeGreaterThan(18);
    expect(lonMax).toBeLessThan(20.5);
  });
});
