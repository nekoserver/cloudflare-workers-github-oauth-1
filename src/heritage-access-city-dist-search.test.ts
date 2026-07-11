import { describe, it, expect } from 'vitest';
import { getHeritageAccessPage } from './views/heritageAccess';

// 対象: 世界遺産アクセスランキングページの「距離上限」行の行末に設置する検索窓。
// 世界遺産名または「緯度,経度」を入力すると、最上位レイヤーのモーダルに
// その地点から半径500km以内の都市を距離の近い順で表示する。
// モーダルのヘッダには該当都市数を「(都市数)」で書き添える。
describe('heritage-accessページ: 距離上限行の都市検索窓', () => {
  const html = getHeritageAccessPage('tester');

  it('script タグ内のJSに構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('距離上限行の行末に右寄せ(margin-left:auto)の検索窓を設置する', () => {
    const idx = html.indexOf("id=\"city-dist-search\"");
    expect(idx).toBeGreaterThan(-1);
    const after = html.slice(idx, idx + 200);
    expect(after).toContain('margin-left:auto');
    // 距離上限行(.controls)の閉じタグより前、つまり同じ行の中にあること
    const controlsCloseIdx = html.indexOf('</div>', idx);
    const controlsOpenIdx = html.indexOf('<div class="controls">');
    expect(controlsOpenIdx).toBeGreaterThan(-1);
    expect(controlsOpenIdx).toBeLessThan(idx);
    expect(controlsCloseIdx).toBeGreaterThan(idx);
  });

  it('最上位レイヤーのモーダル(getNextZでz-indexを動的算出)として開く', () => {
    expect(html).toContain('id="city-dist-overlay"');
    const idx = html.indexOf("cityDistSearchInput.addEventListener('keydown'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 600);
    expect(block).toContain('cityDistOverlay.style.zIndex = String(getNextZ());');
  });

  it('モーダルのヘッダに該当都市数を「(都市数)」の書式で表示する', () => {
    expect(html).toContain("cityDistTitle.textContent = '📍 ' + point.label + ' から半径500km以内の都市 (' + cities.length + ')';");
  });

  it('半径500kmで/api/heritage-access/nearby-citiesを呼び、距離の近い順(サーバー側でソート済み)にそのまま描画する', () => {
    const idx = html.indexOf('function renderCityDistResult');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 1400);
    expect(block).toContain("fetch('/api/heritage-access/nearby-cities?lat=' + encodeURIComponent(point.lat) + '&lon=' + encodeURIComponent(point.lon))");
    expect(block).toContain('cities.forEach(function(c)');
    expect(block).not.toContain('.sort(');
  });

  it('coordinateパース(parseCityDistCoord)は正規表現を使わずindexOfで実装している(template literal内のregexは\\d等のバックスラッシュが剥がれ壊れるため)', () => {
    const idx = html.indexOf('function parseCityDistCoord');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('\n}', idx);
    const block = html.slice(idx, endIdx);
    expect(block).toContain("trimmed.indexOf(',')");
    expect(block).not.toMatch(/\/\^/); // 正規表現リテラルの開始(/^)を含まない
  });

  it('実際に生成されたparseCityDistCoordを実行して座標入力("34.84, 134.69")を正しく解析する(壊れたregexが\\dをdに変えるバグの回帰テスト)', () => {
    const idx = html.indexOf('function parseCityDistCoord');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('\n}', idx) + 2;
    const fnSrc = html.slice(idx, endIdx);
    // eslint-disable-next-line no-new-func
    const parseCityDistCoord = new Function('return (' + fnSrc + ')')() as (trimmed: string) => { lat: number; lon: number } | null;
    const result = parseCityDistCoord('34.84, 134.69');
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(34.84, 2);
    expect(result!.lon).toBeCloseTo(134.69, 2);
  });

  it('世界遺産名(姫路城)からHERITAGE_ALLを引いて座標を解決するresolveCityDistPointが定義されている', () => {
    expect(html).toContain('function resolveCityDistPoint(query)');
    const idx = html.indexOf('function resolveCityDistPoint');
    const block = html.slice(idx, idx + 500);
    expect(block).toContain('normalizeCityDistQuery(h.n) === normalized');
  });
});
