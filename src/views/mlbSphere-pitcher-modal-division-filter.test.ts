import { describe, expect, it } from 'vitest';
import { getMLBSpherePage } from './mlbSphere';

// 対象: /mlb ページの先発投手モーダル(#todayPitchersModal)左側に追加した
// リーグ・地区フィルターメニュー(#todayPitchersFilter)。
// 「すべて」「AL」(EAST/CENTRAL/WEST)「NL」(EAST/CENTRAL/WEST) のいずれかを
// タップすると、そのカテゴリに属するチームの試合だけをモーダル本文
// (#todayPitchersBody)に絞り込んで表示する。
//
// 故障シナリオ:
//   (1) フィルターメニューの座標がモーダル本文と重なってしまう(レイアウト崩れ)
//   (2) 「AL」/「NL」をタップしても地区(EAST/CENTRAL/WEST)まで含めて
//       絞り込まれない
//   (3) 地区(例: AL-WEST)をタップしても、その地区の5球団以外の試合が
//       混ざって表示される
//   (4) モーダルを再度開いたときに前回選択していたフィルターが残ってしまう
//   (5) フィルター項目の並び順が「すべて/AL/EAST/CENTRAL/WEST/NL/EAST/CENTRAL/WEST」
//       の指定順になっていない

describe('/mlb ページ: 先発投手モーダルのリーグ・地区フィルターメニュー', () => {
  const html = getMLBSpherePage('tester');
  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const bodyHtml = html.slice(html.indexOf('<body') , html.indexOf('<script>'));

  it('フィルターメニューは「すべて/AL/EAST/CENTRAL/WEST/NL/EAST/CENTRAL/WEST」の順でdata-filterを持つ', () => {
    const filterIdx = bodyHtml.indexOf('id="todayPitchersFilter"');
    expect(filterIdx).toBeGreaterThan(-1);
    const menuHtml = bodyHtml.slice(filterIdx, filterIdx + 900);
    const order = ['all', 'AL', 'AL-EAST', 'AL-CENTRAL', 'AL-WEST', 'NL', 'NL-EAST', 'NL-CENTRAL', 'NL-WEST'];
    let lastPos = -1;
    for (const f of order) {
      const pos = menuHtml.indexOf('data-filter="' + f + '"');
      expect(pos).toBeGreaterThan(lastPos);
      lastPos = pos;
    }
  });

  it('フィルターメニューはモーダル本文と横並び(.tpm-content内)に配置され、座標が重ならない', () => {
    const modalIdx = bodyHtml.indexOf('id="todayPitchersModal"');
    const modalHtml = bodyHtml.slice(modalIdx, modalIdx + 1200);
    const contentIdx = modalHtml.indexOf('tpm-content');
    const filterIdx = modalHtml.indexOf('todayPitchersFilter');
    const bodyIdx = modalHtml.indexOf('todayPitchersBody');
    expect(contentIdx).toBeGreaterThan(-1);
    expect(filterIdx).toBeGreaterThan(contentIdx);
    expect(bodyIdx).toBeGreaterThan(filterIdx);
    expect(html).toContain('.tpm-content { display:flex;');
    expect(html).toContain('.tpm-filter {');
  });

  it('pitcherFilterTeamIds()はAL/NLを地区3つ分のteamIdの合算として返す', () => {
    const idx = scriptSrc.indexOf('function pitcherFilterTeamIds');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 400);
    expect(fnBody).toContain("DIVISIONS[0].teams.concat(DIVISIONS[1].teams,DIVISIONS[2].teams)");
    expect(fnBody).toContain("DIVISIONS[3].teams.concat(DIVISIONS[4].teams,DIVISIONS[5].teams)");
  });

  it('renderTodayPitchersBody()はグレーアウト設定が\'hide\'のときのみ、away/homeどちらかがteamIdsに含まれる試合だけに絞り込む', () => {
    const idx = scriptSrc.indexOf('function renderTodayPitchersBody');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 700);
    expect(fnBody).toContain('teamIds&&!grayout');
    expect(fnBody).toContain('teamIds.indexOf(g.awayTeamId)>=0||teamIds.indexOf(g.homeId)>=0');
  });

  it('showTodayPitchersModal()はモーダルを開くたびにCookieに保存済みのフィルターを復元する', () => {
    const idx = scriptSrc.indexOf('function showTodayPitchersModal');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 500);
    expect(fnBody).toContain('todayPitcherFilter=loadSavedPitcherFilter()');
  });

  it('フィルター項目のクリックでtodayPitcherFilterを更新し、Cookieへ保存のうえrenderTodayPitchersBody()を呼ぶ', () => {
    const idx = scriptSrc.indexOf('pitcherFilterMenu.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 500);
    expect(fnBody).toContain('todayPitcherFilter=item.dataset.filter');
    expect(fnBody).toContain("setCookieValueClient('mlb_pitcher_filter',todayPitcherFilter)");
    expect(fnBody).toContain('renderTodayPitchersBody()');
  });
});
