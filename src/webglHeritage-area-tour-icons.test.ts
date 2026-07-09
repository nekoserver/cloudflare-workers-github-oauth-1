import { getWebGLHeritagePage } from './views/webglHeritage';

describe('世界遺産エリア巡回サイドパネルのアイコン・データ状態表示', () => {
  const html = getWebGLHeritagePage('tester');

  it('巡回先リストの先頭アイコンは地球儀マーカーと同じ世界遺産種別アイコンを使う', () => {
    expect(html).toContain('function areaTourItemIcon(kind, item)');
    expect(html).toContain('itemIcon: function(d) { return d.e; }');
    expect(html).toContain("areaTourItemIcon(kind, item) + '</span>");
  });

  it('世界遺産名の行末に見どころ・空港・鉄道アクセスのキャッシュ状態アイコンを追加する', () => {
    expect(html).toContain('function getHeritageAreaTourStatusIcons(d)');
    expect(html).toContain("heritageMitokoroGemmaShareId[d.n]) icons += ' 👀'");
    expect(html).toContain("heritageMitokoroLlamaShareId[d.n]) icons += ' 👁️'");
    expect(html).toContain("answered['最寄り空港']) icons += ' 🛬'");
    expect(html).toContain("answered['鉄道でのアクセス']) icons += ' 🚉'");
    expect(html).toContain("d.f + ' ' + d.n + getHeritageAreaTourStatusIcons(d)");
  });

  it('DB内の最寄り空港・鉄道アクセス回答を一括取得して巡回パネルを再描画する', () => {
    expect(html).toContain("fetch('/api/aichat/check-heritage-questions-batch'");
    expect(html).toContain('heritageQuestionAnswered[name] = d.answered[name]');
    expect(html).toContain('refreshAreaTourSideIfHeritage();');
  });
});
