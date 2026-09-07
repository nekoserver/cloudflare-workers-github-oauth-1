import { describe, expect, it } from 'vitest';
import { getMLBSpherePage } from './mlbSphere';

// 対象: /mlb ページの左サイドパネル(試合一覧の各カード)と先発投手モーダル内で
// 表示されるチーム名のアルファベット3文字(略称)。右サイドパネル(30球団
// ディビジョン一覧、.team-badge)で使っているチームカラー(MLB_STADIUMS[id].color)
// を背景色として塗りつぶす。
//
// 故障シナリオ:
//   (1) 左サイドパネルの試合カードで略称に色が付かない、または両チームとも
//       同じ色になってしまう(片方のteamIdを取り違える)
//   (2) 先発投手モーダルの対戦カードで略称に色が付かない
//   (3) 右サイドパネルで使っている色(MLB_STADIUMS[id].color)と異なる値を
//       ハードコードしてしまい、実際の球団色と乖離する

describe('/mlb ページ: 試合カード・先発投手モーダルのチーム略称に球団カラーを適用', () => {
  const html = getMLBSpherePage('tester');
  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

  it('abbrBadge()は右サイドパネル(.team-badge)と同じMLB_STADIUMS[id].colorを背景色に使う', () => {
    const idx = scriptSrc.indexOf('function abbrBadge');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 250);
    expect(fnBody).toContain('MLB_STADIUMS[teamId]');
    expect(fnBody).toContain("sd.color:'#333'");
    expect(fnBody).toContain('abbr-badge');
  });

  it('右サイドパネルの.team-badgeも同じMLB_STADIUMS[tid].colorを背景に使っている(色の出所が一致する)', () => {
    const idx = scriptSrc.indexOf('function buildSidePanel');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 700);
    expect(fnBody).toContain("background:'+sd.color");
  });

  it('左サイドパネルの試合カードはアウェイ・ホームそれぞれ別のteamIdでabbrBadgeを呼ぶ', () => {
    const idx = scriptSrc.indexOf('function buildGameList');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 3200);
    expect(fnBody).toContain('abbrBadge(g.awayTeamId,g.awayAbbr)');
    expect(fnBody).toContain('abbrBadge(g.homeId,sd?sd.abbr');
  });

  it('先発投手モーダルの対戦カードもアウェイ・ホームそれぞれ別のteamIdでabbrBadgeを呼ぶ', () => {
    const idx = scriptSrc.indexOf('function renderTodayPitchersBody');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 1200);
    expect(fnBody).toContain('abbrBadge(g.awayTeamId,g.awayAbbr)');
    expect(fnBody).toContain('abbrBadge(g.homeId,MLB_STADIUMS[g.homeId]');
  });
});
