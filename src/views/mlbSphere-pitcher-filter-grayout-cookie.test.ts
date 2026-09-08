import { describe, expect, it } from 'vitest';
import { getMLBSpherePage } from './mlbSphere';

// 対象: /mlb ページの先発投手モーダルで、リーグ/地区フィルターを選択したときの
// 表示モード(グレーアウト vs 非表示)と、選択中フィルターのCookie永続化。
// - 既定はグレーアウト(モーダルの縦幅を固定したまま対象外の試合を薄く表示)
// - Cookie(mlb_pitcher_filter_mode)に'hide'が保存されている場合のみ、
//   従来通り対象外の試合を一覧から取り除く(モーダルの高さが変わる)
// - 選択中のフィルター自体もCookie(mlb_pitcher_filter)に保存し、次にモーダルを
//   開いたときに復元する
// - 「すべて」選択時はグレーアウト処理そのものが発生しない(teamIdsがnullのため)
//
// 故障シナリオ:
//   (1) グレーアウト設定のCookieを読まず、常にどちらか一方の挙動になる
//   (2) デフォルト(Cookie未設定)がグレーアウトではなく非表示になっている
//   (3) 'hide'設定時にグレーアウト用のtpm-row-dimクラスが付いてしまい、
//       実際には行が消えていない
//   (4) フィルター選択をCookieに保存しない、または保存先のCookie名が
//       設定ページのトグルと食い違う
//   (5) 「すべて」選択時にも対象外行がグレーアウトされてしまう(teamIdsがnullなら
//       スキップされるべき)
//   (6) 保存されたCookie値が不正(改ざん・旧バージョン由来)な場合に
//       フィルターが壊れた状態のまま使われてしまう

describe('/mlb ページ: 先発投手モーダルのグレーアウト表示とフィルターのCookie保存', () => {
  const html = getMLBSpherePage('tester');
  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

  it('pitcherFilterGrayoutEnabled()はCookie未設定またはhide以外なら常にtrue(既定はグレーアウト)', () => {
    const idx = scriptSrc.indexOf('function pitcherFilterGrayoutEnabled');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 200);
    expect(fnBody).toContain("getCookieValueClient('mlb_pitcher_filter_mode')!=='hide'");
  });

  it('renderTodayPitchersBody()はgrayout有効時、行を除去せずtpm-row-dimクラスだけを付与する', () => {
    const idx = scriptSrc.indexOf('function renderTodayPitchersBody');
    const fnBody = scriptSrc.slice(idx, idx + 1600);
    expect(fnBody).toContain("var list=(teamIds&&!grayout)?todayPitcherGamesAll.filter(");
    expect(fnBody).toContain('tpm-row-dim');
    expect(fnBody).toContain('isDim=!!(grayout&&teamIds&&teamIds.indexOf(g.awayTeamId)<0&&teamIds.indexOf(g.homeId)<0)');
  });

  it("フィルターが'all'のときはteamIdsがnullになりisDimが常にfalseになる(グレーアウト対象なし)", () => {
    const idx = scriptSrc.indexOf('function pitcherFilterTeamIds');
    const fnBody = scriptSrc.slice(idx, idx + 120);
    expect(fnBody).toContain("if(filter==='all')return null;");
  });

  it('tpm-row-dimはCSSで薄く表示するスタイルが定義されている', () => {
    expect(html).toContain('.tpm-row-dim {');
  });

  it('loadSavedPitcherFilter()はCookie(mlb_pitcher_filter)から復元し、不正値・未設定はallにフォールバックする', () => {
    const idx = scriptSrc.indexOf('function loadSavedPitcherFilter');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 300);
    expect(fnBody).toContain("getCookieValueClient('mlb_pitcher_filter')");
    expect(fnBody).toContain("PITCHER_FILTER_VALUES.indexOf(v)>=0?v:'all'");
  });

  it('PITCHER_FILTER_VALUESは指定した9カテゴリを過不足なく含む', () => {
    expect(scriptSrc).toContain("var PITCHER_FILTER_VALUES=['all','AL','NL','AL-EAST','AL-CENTRAL','AL-WEST','NL-EAST','NL-CENTRAL','NL-WEST'];");
  });

  it('フィルター選択時にsetCookieValueClient経由でmlb_pitcher_filterへ保存する', () => {
    const idx = scriptSrc.indexOf('pitcherFilterMenu.addEventListener');
    const fnBody = scriptSrc.slice(idx, idx + 500);
    expect(fnBody).toContain("setCookieValueClient('mlb_pitcher_filter',todayPitcherFilter)");
  });

  it('setCookieValueClient()は書き込み時にSecure/SameSite=Laxを付与する(CLAUDE.mdルール25: セキュリティ属性を弱めない)', () => {
    const idx = scriptSrc.indexOf('function setCookieValueClient');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 250);
    expect(fnBody).toContain('Secure');
    expect(fnBody).toContain('SameSite=Lax');
  });
});
