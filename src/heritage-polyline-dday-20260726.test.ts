import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';
import { getWebGLHeritagePage } from './views/webglHeritage';

// 対象: HeritageItem の任意フィールド pts（帯状・線状シリアル資産の折れ線）と、
//       /webgl-heritage ページでの折れ線描画。
//
// 背景: 「1944年ノルマンディーDデイ上陸作戦の海岸」は約80kmの海岸線に並ぶ
// 5つの上陸海岸からなる帯状資産で、点1つでは実体を表せない。活断層ページ
// (src/data/faults.ts の FaultLine.pts) と同じ考え方で pts を持たせ、
// 地球儀上に折れ線として描くようにした。世界遺産ページの地球儀は国境を
// 等距円筒図法のマスクキャンバスへ描いてテクスチャ合成する方式なので、
// 折れ線も同じキャンバスへ stroke して実現している。
//
// 故障シナリオ:
//   (1) pts を追加したことで既存の点表示資産が壊れる（pts 未設定が異常扱いになる）
//   (2) 折れ線の順序が west→east でなく線が交差する
//   (3) 国を選択していない初期状態でマスクが描かれず折れ線が出ない
//   (4) 国境ハイライトの描画で折れ線が消える（クリア順序の誤り）
//   (5) template literal 内のエスケープ崩れで <script> が構文エラーになる

describe('HeritageItem.pts — 帯状シリアル資産の折れ線データ', () => {
  const dday = HERITAGE_LIST.find((h) => h.n.includes('Dデイ'))!;

  it('Dデイ上陸作戦の海岸が5地点の折れ線を持つ', () => {
    expect(dday.pts).toBeDefined();
    expect(dday.pts).toHaveLength(5);
  });

  it('折れ線は西端ユタから東端ソードへ経度が単調増加する（線が交差しない）', () => {
    const lons = dday.pts!.map((p) => p[1]);
    for (let i = 1; i < lons.length; i++) {
      expect(lons[i]).toBeGreaterThan(lons[i - 1]);
    }
    // 西端ユタ 約-1.22、東端ソード 約-0.26
    expect(lons[0]).toBeCloseTo(-1.23, 1);
    expect(lons[lons.length - 1]).toBeCloseTo(-0.26, 1);
  });

  it('全地点がノルマンディー沿岸の範囲に収まっている', () => {
    for (const [lat, lon] of dday.pts!) {
      expect(lat).toBeGreaterThan(49.2);
      expect(lat).toBeLessThan(49.5);
      expect(lon).toBeGreaterThan(-1.3);
      expect(lon).toBeLessThan(-0.2);
    }
  });

  it('代表点(lat/lon)は折れ線の経度範囲の内側にある', () => {
    const lons = dday.pts!.map((p) => p[1]);
    expect(dday.lon).toBeGreaterThan(Math.min(...lons));
    expect(dday.lon).toBeLessThan(Math.max(...lons));
  });

  it('pts の全長が約80kmになる（UNESCO記載の帯の長さと整合）', () => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const hav = (la1: number, lo1: number, la2: number, lo2: number) => {
      const dLat = toRad(la2 - la1);
      const dLon = toRad(lo2 - lo1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLon / 2) ** 2;
      return 2 * 6371 * Math.asin(Math.sqrt(a));
    };
    let total = 0;
    for (let i = 1; i < dday.pts!.length; i++) {
      const [la1, lo1] = dday.pts![i - 1];
      const [la2, lo2] = dday.pts![i];
      total += hav(la1, lo1, la2, lo2);
    }
    expect(total).toBeGreaterThan(60);
    expect(total).toBeLessThan(100);
  });

  it('pts は任意フィールドで、大多数の資産は従来どおり点のみで壊れない', () => {
    const withPts = HERITAGE_LIST.filter((h) => h.pts);
    const withoutPts = HERITAGE_LIST.filter((h) => !h.pts);
    expect(withPts.length).toBeGreaterThanOrEqual(1);
    expect(withoutPts.length).toBeGreaterThan(800);
    // pts を持つ資産も lat/lon を必ず持つ（代表点は従来と同じ役割）
    for (const h of withPts) {
      expect(typeof h.lat).toBe('number');
      expect(typeof h.lon).toBe('number');
    }
  });
});

describe('/webgl-heritage ページ — 折れ線の描画', () => {
  const html = getWebGLHeritagePage('tester');

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('pts を持つ資産だけを抽出して折れ線対象にする', () => {
    expect(html).toContain('HERITAGE_POLYLINES = HERITAGE.filter(function(h) { return h.pts && h.pts.length >= 2; });');
  });

  it('国境と同じ等距円筒図法キャンバスへ折れ線をstrokeする', () => {
    expect(html).toContain('function drawHeritagePolylines(W, H)');
    expect(html).toContain('equirectXY(pt[1] + rep * 360, pt[0], W, H)');
    expect(html).toContain('maskCtx.stroke();');
    // 構成資産の位置を示す結節点
    expect(html).toContain('maskCtx.arc(xy[0], xy[1], 1.1, 0, Math.PI * 2);');
  });

  it('国境マスクのクリア後に折れ線を描くため、国境ハイライトの有無に関わらず残る', () => {
    const idx = html.indexOf('function drawCountryBorderMask(cc, mode)');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 2000);
    const clearIdx = block.indexOf('maskCtx.clearRect(0, 0, W, H);');
    const polyIdx = block.indexOf('drawHeritagePolylines(W, H);');
    const uploadIdx = block.indexOf('gl.activeTexture(gl.TEXTURE1);');
    expect(clearIdx).toBeGreaterThan(-1);
    expect(polyIdx).toBeGreaterThan(clearIdx);
    // テクスチャ転送より前に描く
    expect(polyIdx).toBeLessThan(uploadIdx);
  });

  it('起動時に一度マスクを描くので初期状態でも折れ線が見える', () => {
    // COUNTRY_BORDERS のJSONが両者の間に挟まって巨大なため、固定幅の窓では届かない。
    // 折れ線対象の抽出より後に初期描画の呼び出しがあることを位置関係で検証する。
    const filterIdx = html.indexOf('HERITAGE_POLYLINES = HERITAGE.filter');
    const initIdx = html.indexOf('drawCountryBorderMask(null, borderMode);', filterIdx);
    expect(filterIdx).toBeGreaterThan(-1);
    expect(initIdx).toBeGreaterThan(filterIdx);
    // 初期描画はイベントハンドラ内ではなくトップレベルに置かれている
    const line = html.slice(html.lastIndexOf('\n', initIdx) + 1, initIdx + 40);
    expect(line.trim().startsWith('drawCountryBorderMask(null, borderMode);')).toBe(true);
  });

  it('ツールチップに構成地点数と全長を表示する', () => {
    expect(html).toContain('function heritagePolylineTotalKm(pts)');
    expect(html).toContain('function heritagePolylineInfoHtml(d)');
    expect(html).toContain('地点を結ぶ帯状資産');
    expect(html).toContain('+ heritagePolylineInfoHtml(d) +');
  });

  it('pts を持たない資産ではツールチップに帯情報を出さない（空文字を返す）', () => {
    const idx = html.indexOf('function heritagePolylineInfoHtml(d)');
    const block = html.slice(idx, idx + 300);
    expect(block).toContain("if (!d.pts || d.pts.length < 2) return '';");
  });
});

// 文字列一致だけでは「実際に正しい位置へ描かれるか」を保証できないため、
// 生成HTMLから実装そのものを取り出し、描画呼び出しを記録する偽の2Dコンテキストで
// 実行して、等距円筒図法上のピクセル位置を実測で検証する。
describe('/webgl-heritage ページ — 折れ線が正しい位置へ描かれる（実装を抽出して実行）', () => {
  const html = getWebGLHeritagePage('tester');
  const dday = HERITAGE_LIST.find((h) => h.n.includes('Dデイ'))!;

  function extractFn(name: string, endMarker: string): string {
    const start = html.indexOf('function ' + name);
    expect(start, name + ' が生成HTMLに存在しない').toBeGreaterThan(-1);
    const end = html.indexOf(endMarker, start);
    expect(end, name + ' の終端が見つからない').toBeGreaterThan(start);
    return html.slice(start, end + endMarker.length);
  }

  function runDraw(items: Array<{ pts?: [number, number][] }>, W: number, H: number) {
    const calls: Array<{ op: string; args: number[] }> = [];
    const ctx = {
      beginPath: () => calls.push({ op: 'beginPath', args: [] }),
      moveTo: (x: number, y: number) => calls.push({ op: 'moveTo', args: [x, y] }),
      lineTo: (x: number, y: number) => calls.push({ op: 'lineTo', args: [x, y] }),
      stroke: () => calls.push({ op: 'stroke', args: [] }),
      fill: () => calls.push({ op: 'fill', args: [] }),
      arc: (x: number, y: number, r: number) => calls.push({ op: 'arc', args: [x, y, r] }),
      set lineWidth(_v: number) {},
      set strokeStyle(_v: string) {},
      set fillStyle(_v: string) {},
    };
    const src =
      extractFn('equirectXY', '}') + '\n' +
      extractFn('drawHeritagePolylines', '\n  }') + '\n' +
      'return drawHeritagePolylines;';
    const factory = new Function('maskCtx', 'HERITAGE_POLYLINES', src);
    factory(ctx, items)(W, H);
    return calls;
  }

  it('5地点が moveTo/lineTo で1本の折れ線として結ばれる', () => {
    const calls = runDraw([dday as { pts?: [number, number][] }], 3600, 1800);
    // rep = -1, 0, +1 の3周分（経度の折り返し対策）描かれる
    const strokes = calls.filter((c) => c.op === 'stroke');
    expect(strokes).toHaveLength(3);
    const moveTos = calls.filter((c) => c.op === 'moveTo');
    const lineTos = calls.filter((c) => c.op === 'lineTo');
    expect(moveTos).toHaveLength(3);
    expect(lineTos).toHaveLength(3 * 4); // 5地点 → 1 moveTo + 4 lineTo
  });

  it('rep=0 の折れ線が Dデイ各地点の等距円筒座標に一致する', () => {
    const W = 3600, H = 1800;
    const calls = runDraw([dday as { pts?: [number, number][] }], W, H);
    const expected = dday.pts!.map(([lat, lon]) => [
      (lon + 180) / 360 * W,
      (90 - lat) / 180 * H,
    ]);
    // rep=-1 → rep=0 → rep=+1 の順。2周目(index 1)が rep=0。
    const starts = calls.map((c, i) => ({ c, i })).filter((x) => x.c.op === 'moveTo');
    const rep0Start = starts[1].i;
    const seq = [calls[rep0Start], ...calls.slice(rep0Start + 1, rep0Start + 5)];
    seq.forEach((call, k) => {
      expect(call.args[0]).toBeCloseTo(expected[k][0], 3);
      expect(call.args[1]).toBeCloseTo(expected[k][1], 3);
    });
  });

  it('各地点に結節点(arc)が打たれる', () => {
    const calls = runDraw([dday as { pts?: [number, number][] }], 3600, 1800);
    const arcs = calls.filter((c) => c.op === 'arc');
    expect(arcs).toHaveLength(3 * 5); // 3周 × 5地点
  });

  it('pts を持つ資産が無ければ一切描画しない', () => {
    const calls = runDraw([], 3600, 1800);
    expect(calls).toHaveLength(0);
  });

  it('経度は西→東で単調増加するため折れ線が逆走しない', () => {
    const W = 3600, H = 1800;
    const calls = runDraw([dday as { pts?: [number, number][] }], W, H);
    const starts = calls.map((c, i) => ({ c, i })).filter((x) => x.c.op === 'moveTo');
    const rep0Start = starts[1].i;
    const xs = [calls[rep0Start], ...calls.slice(rep0Start + 1, rep0Start + 5)].map((c) => c.args[0]);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });
});

describe('/webgl-heritage ページ — 近接リスト検索の大文字小文字', () => {
  const html = getWebGLHeritagePage('tester');

  it('比較対象も小文字化して大文字ASCIIを含む名称を検索できる', () => {
    expect(html).toContain('function matchesSearch(d)');
    expect(html).toContain("d.n.toLowerCase().indexOf(q) >= 0");
    expect(html).toContain("d.c.toLowerCase().indexOf(q) >= 0");
    expect(html).toContain("d.t.toLowerCase().indexOf(q) >= 0");
  });

  it('抽出した matchesSearch が大文字を含む名称に一致する（旧実装では0件だった）', () => {
    const start = html.indexOf('function matchesSearch(d)');
    expect(start).toBeGreaterThan(-1);
    const end = html.indexOf('\n    }', start);
    const src = html.slice(start, end + 6);
    const make = (query: string) =>
      new Function('q', src + '\nreturn matchesSearch;')(query.toLowerCase());

    const dday = { n: '1944年ノルマンディーDデイ上陸作戦の海岸', c: 'フランス', t: '文化遺産' };
    const wPark = { n: 'W・アルリ・パンジャリ複合自然公園群', c: 'ニジェール', t: '自然遺産' };
    const other = { n: '姫路城', c: '日本', t: '文化遺産' };

    expect(make('Dデイ')(dday)).toBe(true);
    expect(make('dデイ')(dday)).toBe(true);
    expect(make('W・アルリ')(wPark)).toBe(true);
    expect(make('w・アルリ')(wPark)).toBe(true);
    // 無関係な資産には一致しない
    expect(make('Dデイ')(other)).toBe(false);
    // 空クエリは全件表示
    expect(make('')(other)).toBe(true);
  });
});
