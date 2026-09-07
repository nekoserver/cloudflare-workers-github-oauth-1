import { describe, expect, it } from 'vitest';
import { getMLBSpherePage } from './mlbSphere';

// 対象: /mlb ページの左サイドパネル、アクセス当日の「(◯試合)」見出し行末の
// ⏰アイコンと、タップ時に開く最上位モーダル(#todayPitchersModal)。
// モーダルには当日の試合を開始時刻の早い順に、対戦カードとその両脇に
// 両チームの先発投手名を表示する。
//
// 故障シナリオ:
//   (1) ⏰アイコンが常時表示され、当日以外の日付でも出てしまう
//   (2) タップしてもモーダルが開かない/イベントが結びついていない
//   (3) モーダル内の試合が開始時刻順に並んでいない
//   (4) 先発投手名が対戦カードの片側にしか表示されない、または取得されない
//   (5) 新しいオーバーレイのz-indexが固定値で埋め込まれている(将来の多重モーダルで裏に隠れる)

describe('/mlb ページ: 当日の試合一覧ヘッダーの先発投手モーダル', () => {
  const html = getMLBSpherePage('tester');
  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

  it('本日の見出し行にのみ⏰アイコン(todayGamesClockBtn)を付与するロジックがある', () => {
    expect(scriptSrc).toContain('isTodayHdr');
    expect(scriptSrc).toContain('todayGamesClockBtn');
    expect(scriptSrc).toContain("dateStr===toDateStr(new Date())");
  });

  it('⏰アイコンのクリックでshowTodayPitchersModalが呼ばれる', () => {
    const idx = scriptSrc.indexOf("getElementById('todayGamesClockBtn')");
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 300);
    expect(fnBody).toContain("addEventListener('click'");
    expect(fnBody).toContain('showTodayPitchersModal(games)');
  });

  it('renderTodayPitchersBody内で試合をgameDate昇順にソートしている', () => {
    const idx = scriptSrc.indexOf('function renderTodayPitchersBody');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 900);
    expect(fnBody).toContain('.slice().sort');
    expect(fnBody).toContain('a.gameDate<b.gameDate');
  });

  it('モーダル内の各行は「先発投手 / 対戦カード / 先発投手」の順で構築される', () => {
    const idx = scriptSrc.indexOf('function renderTodayPitchersBody');
    const fnBody = scriptSrc.slice(idx, idx + 1200);
    const awayIdx = fnBody.indexOf('tpm-pitcher">\'+awayP');
    const cardIdx = fnBody.indexOf('tpm-card">\'+abbrBadge(g.awayTeamId');
    const homeIdx = fnBody.indexOf('tpm-pitcher">\'+homeP');
    expect(awayIdx).toBeGreaterThan(-1);
    expect(cardIdx).toBeGreaterThan(awayIdx);
    expect(homeIdx).toBeGreaterThan(cardIdx);
  });

  it('parseGamesがhome/awayの先発投手名をhomePitcher/awayPitcherとして抽出する', () => {
    const idx = scriptSrc.indexOf('function parseGames');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 1200);
    expect(fnBody).toContain('g.teams.home.probablePitcher');
    expect(fnBody).toContain('g.teams.away.probablePitcher');
    expect(fnBody).toContain('homePitcher:');
    expect(fnBody).toContain('awayPitcher:');
  });

  it('新しいオーバーレイ/モーダルのz-indexはgetNextZ()で動的に算出し、固定値を埋め込んでいない', () => {
    const idx = scriptSrc.indexOf('function showTodayPitchersModal');
    const fnBody = scriptSrc.slice(idx, idx + 1200);
    expect(fnBody).toContain('getNextZ()');
    expect(fnBody).not.toMatch(/zIndex\s*=\s*['"]?\d/);
  });

  it('先発投手が未発表の場合は「未定」でフォールバックし、空文字にならない', () => {
    const idx = scriptSrc.indexOf('function renderTodayPitchersBody');
    const fnBody = scriptSrc.slice(idx, idx + 900);
    expect(fnBody).toContain("g.awayPitcher||'未定'");
    expect(fnBody).toContain("g.homePitcher||'未定'");
  });
});
