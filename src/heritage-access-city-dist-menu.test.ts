import { describe, it, expect } from 'vitest';
import { getHeritageAccessPage } from './views/heritageAccess';

// 対象: 世界遺産アクセスランキングページの「距離上限」行末の世界遺産検索窓
// (#city-dist-search)。雑にインクリメントサーチ(入力ごとに部分一致)しても
// 候補がドロップダウンで挙がり、タップすると検索窓にその世界遺産名がセットされる。
// セットされた状態(=世界遺産名が確定した状態)になると検索窓の右側に
// 「🌆🔍」ボタンが現れ、押すと「🌆 周辺都市を見る」(既存の半径500km都市検索)と
// 「🌍 地球儀で見る」(/webgl-heritage?heritage=名前 へのリンク)の
// 2項目のドロップダウンメニューが開く。
describe('heritage-accessページ: 世界遺産検索窓のインクリメントサーチと🌆🔍メニュー', () => {
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

  it('検索窓の近くに候補ドロップダウン用要素とメニューボタン・メニュー用要素が存在する', () => {
    expect(html).toContain('id="city-dist-search"');
    expect(html).toContain('id="city-dist-menu-btn"');
    expect(html).toContain('id="city-dist-candidates"');
    expect(html).toContain('id="city-dist-menu"');
    // メニューボタンは既定で非表示(世界遺産名が確定するまで隠す)
    const btnIdx = html.indexOf('id="city-dist-menu-btn"');
    const btnTagEnd = html.indexOf('>', btnIdx);
    const btnTag = html.slice(Math.max(0, btnIdx - 200), btnTagEnd);
    expect(btnTag).toContain('display:none');
  });

  it('input イベントで候補一覧(renderCityDistCandidates)を再描画し、メニューボタンの表示可否(updateCityDistMenuBtn)も更新する', () => {
    expect(html).toContain('function renderCityDistCandidates()');
    expect(html).toContain('function updateCityDistMenuBtn()');
    const idx = html.indexOf("cityDistSearchInput.addEventListener('input'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 200);
    expect(block).toContain('renderCityDistCandidates()');
    expect(block).toContain('updateCityDistMenuBtn()');
  });

  it('renderCityDistCandidatesはHERITAGE_ALLを部分一致(indexOf)でフィルタし候補行をクリックすると検索窓にセットする', () => {
    const idx = html.indexOf('function renderCityDistCandidates()');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 1200);
    expect(block).toContain('normalizeCityDistQuery(h.n).indexOf(normalized) !== -1');
    expect(block).toContain('cityDistSearchInput.value = row.getAttribute(\'data-name\')');
    expect(block).toContain('updateCityDistMenuBtn()');
  });

  it('updateCityDistMenuBtnはHERITAGE_ALLと完全一致した場合のみメニューボタンを表示する', () => {
    const idx = html.indexOf('function updateCityDistMenuBtn()');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 700);
    expect(block).toContain("normalizeCityDistQuery(h.n) === normalized");
    expect(block).toMatch(/cityDistMenuBtn\.style\.display = '';/);
    expect(block).toContain("cityDistMenuBtn.style.display = 'none'");
  });

  it('メニューボタン押下で「🌆 周辺都市を見る」と「🌍 地球儀で見る」の2項目のドロップダウンメニューを開く', () => {
    const idx = html.indexOf("cityDistMenuBtn.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('🌆 周辺都市を見る');
    expect(block).toContain('🌍 地球儀で見る');
    expect(block).toContain("/webgl-heritage?heritage=' + encodeURIComponent(name)");
  });

  it('「🌆 周辺都市を見る」クリックで既存のresolveCityDistPoint→renderCityDistResultを呼ぶ(getNextZでz-index動的算出)', () => {
    const idx = html.indexOf("cityDistMenuBtn.addEventListener('click'");
    const block = html.slice(idx, idx + 1300);
    expect(block).toContain('resolveCityDistPoint(name)');
    expect(block).toContain('renderCityDistResult(point)');
    expect(block).toContain('cityDistOverlay.style.zIndex = String(getNextZ());');
  });

  it('候補・メニューは検索窓/ボタン以外をクリックすると閉じる', () => {
    expect(html).toContain('function closeCityDistCandidates()');
    expect(html).toContain('function closeCityDistMenu()');
    const idx = html.lastIndexOf("document.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('closeCityDistCandidates()');
    expect(block).toContain('closeCityDistMenu()');
  });

  it('実際に生成されたnormalizeCityDistQueryと候補フィルタ相当のロジックを実行し部分一致で世界遺産名を絞り込める(姫路城)', () => {
    const idx = html.indexOf('function normalizeCityDistQuery');
    const endIdx = html.indexOf('\n}', idx) + 2;
    const fnSrc = html.slice(idx, endIdx);
    // eslint-disable-next-line no-new-func
    const normalizeCityDistQuery = new Function('return (' + fnSrc + ')')() as (v: string) => string;
    const heritageAllMatch = html.match(/var HERITAGE_ALL = (\[.*?\]);/);
    expect(heritageAllMatch).not.toBeNull();
    const heritageAll = JSON.parse(heritageAllMatch![1]) as { n: string }[];
    const normalized = normalizeCityDistQuery('姫路');
    const matches = heritageAll.filter((h) => normalizeCityDistQuery(h.n).indexOf(normalized) !== -1);
    expect(matches.some((h) => h.n === '姫路城')).toBe(true);
  });
});
