import { describe, expect, it } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';
import { COUNTRY_BORDERS } from './data/countryBorders';
import { HERITAGE_LIST } from './data/heritageList';
import { AIRPORT_LIST } from './data/airports';

// 対象: 世界遺産地球儀(/webgl-heritage)の「国別世界遺産」パネル(showCountryHeritagePanel)。
// 選択した国の国境線・塗りつぶしを地球儀テクスチャに重ねて表示する機能。
// 故障シナリオ:
//   (1) 日付変更線をまたぐ国(ロシア等)を経度でそのままcanvasに描画すると、
//       -180/180の境界で座標が不連続にジャンプし地球儀を横切る帯状のノイズになる
//   (2) COUNTRY_BORDERSに国境データが無い国(HERITAGE_LIST/AIRPORT_LISTには登場するが
//       低解像度データセットに含まれない小国)を選択した際に例外を投げる
//   (3) 緯度経度→テクスチャUV変換が、地球儀本体(latLonTo3D)のUV規約とズレて
//       国境線が実際の陸地と違う位置に表示される
function extractPureFunctions(html: string): string {
  const equirectMatch = html.match(/function equirectXY\(lon, lat, w, h\) \{[\s\S]*?\}/);
  const unwrapMatch = html.match(/function unwrapRingLons\(ring\) \{[\s\S]*?\n  \}/);
  if (!equirectMatch || !unwrapMatch) {
    throw new Error('必要な関数が生成HTMLから見つからない: equirectXY=' + !!equirectMatch + ' unwrapRingLons=' + !!unwrapMatch);
  }
  return equirectMatch[0] + '\n' + unwrapMatch[0];
}

function loadFns(html: string) {
  const src = extractPureFunctions(html);
  return new Function(`${src}\nreturn { equirectXY, unwrapRingLons };`)();
}

function flagToCc(flag: string): string | null {
  const chars = Array.from(flag);
  if (chars.length < 2) return null;
  const codes = chars.map((c) => c.codePointAt(0) ?? 0);
  if (codes[0] < 0x1f1e6 || codes[0] > 0x1f1ff || codes[1] < 0x1f1e6 || codes[1] > 0x1f1ff) return null;
  return String.fromCharCode(65 + (codes[0] - 0x1f1e6)) + String.fromCharCode(65 + (codes[1] - 0x1f1e6));
}

describe('世界遺産地球儀: 国境線・塗りつぶしのUV変換(equirectXY/unwrapRingLons)', () => {
  it('equirectXYはlatLonTo3Dと同じ正距円筒図法(グリニッジ子午線=中央、北極=上端)でUV変換する', () => {
    const html = getWebGLHeritagePage('tester');
    const { equirectXY } = loadFns(html);
    expect(equirectXY(0, 90, 1024, 512)).toEqual([512, 0]);
    expect(equirectXY(0, -90, 1024, 512)).toEqual([512, 512]);
    expect(equirectXY(0, 0, 1024, 512)).toEqual([512, 256]);
    expect(equirectXY(-180, 0, 1024, 512)).toEqual([0, 256]);
    expect(equirectXY(180, 0, 1024, 512)).toEqual([1024, 256]);
  });

  it('unwrapRingLonsは日付変更線をまたぐ経度列を連続値に変換する(ロシアのような±180境界)', () => {
    const html = getWebGLHeritagePage('tester');
    const { unwrapRingLons } = loadFns(html);
    const ring: [number, number][] = [[170, 60], [179, 61], [-179, 62], [-170, 63]];
    const lons = unwrapRingLons(ring);
    expect(lons[0]).toBe(170);
    expect(lons[1]).toBe(179);
    expect(lons[2]).toBeCloseTo(181, 5);
    expect(lons[3]).toBeCloseTo(190, 5);
    for (let i = 1; i < lons.length; i++) {
      expect(Math.abs(lons[i] - lons[i - 1])).toBeLessThan(180);
    }
  });

  it('日付変更線をまたがないリングは経度をそのまま返す(既存挙動に影響なし)', () => {
    const html = getWebGLHeritagePage('tester');
    const { unwrapRingLons } = loadFns(html);
    const ring: [number, number][] = [[10, 45], [12, 46], [11, 47]];
    expect(unwrapRingLons(ring)).toEqual([10, 12, 11]);
  });
});

describe('世界遺産地球儀: COUNTRY_BORDERSデータ整合性', () => {
  it('全ポリゴンの座標が有効な緯度経度範囲内でNaNを含まない', () => {
    COUNTRY_BORDERS.forEach((c) => {
      let pointCount = 0;
      c.polygons.forEach((poly) => poly.forEach((ring) => ring.forEach(([lon, lat]) => {
        pointCount++;
        expect(Number.isFinite(lon)).toBe(true);
        expect(Number.isFinite(lat)).toBe(true);
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);
        expect(lon).toBeGreaterThanOrEqual(-180);
        expect(lon).toBeLessThanOrEqual(180);
      })));
      expect(pointCount).toBeGreaterThan(0);
    });
  });

  it('国コード(cc)は重複せず、国旗(flag)はccから正しく生成した絵文字と一致する', () => {
    const seen = new Set<string>();
    COUNTRY_BORDERS.forEach((c) => {
      expect(seen.has(c.cc)).toBe(false);
      seen.add(c.cc);
      const expectedFlag = String.fromCodePoint(0x1f1e6 + (c.cc.charCodeAt(0) - 65))
        + String.fromCodePoint(0x1f1e6 + (c.cc.charCodeAt(1) - 65));
      expect(c.flag).toBe(expectedFlag);
    });
  });

  it('日本(JP)の境界データは実際の日本列島付近の緯度経度範囲を持つ', () => {
    const jp = COUNTRY_BORDERS.find((c) => c.cc === 'JP');
    expect(jp).toBeDefined();
    let latMin = 90, latMax = -90, lonMin = 180, lonMax = -180;
    jp!.polygons.forEach((poly) => poly.forEach((ring) => ring.forEach(([lon, lat]) => {
      latMin = Math.min(latMin, lat); latMax = Math.max(latMax, lat);
      lonMin = Math.min(lonMin, lon); lonMax = Math.max(lonMax, lon);
    })));
    expect(latMin).toBeGreaterThan(20);
    expect(latMax).toBeLessThan(50);
    expect(lonMin).toBeGreaterThan(120);
    expect(lonMax).toBeLessThan(150);
  });

  it('HERITAGE_LIST/AIRPORT_LISTに登場する国旗は全てCOUNTRY_BORDERSにデータが存在する' +
    '(低解像度データセットに無かった6件の小国・特別行政区🇦🇬🇧🇭🇭🇰🇲🇨🇲🇺🇸🇬は補完データセットから追加済み)', () => {
    const ccSet = new Set<string>();
    HERITAGE_LIST.forEach((h) => { const cc = flagToCc(h.f); if (cc) ccSet.add(cc); });
    AIRPORT_LIST.forEach((a) => { const cc = flagToCc(a.city.split(' ')[0]); if (cc) ccSet.add(cc); });
    const covered = new Set(COUNTRY_BORDERS.map((c) => c.cc));
    const missing = [...ccSet].filter((cc) => !covered.has(cc));
    expect(missing).toEqual([]);
    ['AG', 'BH', 'HK', 'MC', 'MU', 'SG'].forEach((cc) => { expect(covered.has(cc)).toBe(true); });
  });
});

describe('世界遺産地球儀: 国境ハイライトUIの組み込み', () => {
  it('国別パネルに境界線/線+塗り/塗りつぶしの切り替えボタンとuMaskシェーダー変数を含む', () => {
    const html = getWebGLHeritagePage('tester');
    expect(html).toContain('id="ch-border-toggle"');
    expect(html).toContain('data-border-mode="line"');
    expect(html).toContain('data-border-mode="both"');
    expect(html).toContain('data-border-mode="fill"');
    expect(html).toContain('uniform sampler2D uMask;');
    expect(html).toContain('function drawCountryBorderMask(');
    expect(html).toContain('function updateCountryBorderHighlight(');
  });

  it('国境線の太さは0.625px(旧2.5pxの1/4)', () => {
    const html = getWebGLHeritagePage('tester');
    expect(html).toContain('maskCtx.lineWidth = 0.625;');
    expect(html).not.toContain('maskCtx.lineWidth = 2.5;');
  });

  it('国別パネルを閉じると国境ハイライトをクリアする(clearCountryBorderHighlight)', () => {
    const html = getWebGLHeritagePage('tester');
    expect(html).toContain('function clearCountryBorderHighlight()');
    expect(html).toContain("document.getElementById('ch-close').addEventListener('click', function() { chOverlay.classList.remove('open'); clearCountryBorderHighlight(); });");
  });
});
