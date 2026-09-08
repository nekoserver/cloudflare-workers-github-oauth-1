import { describe, expect, it } from 'vitest';
import { getMLBSpherePage } from './mlbSphere';

// 対象: /mlb ページの先発投手モーダル(#todayPitchersModal)内、各試合行の
// 左側の時刻表示(.tpm-time)。試合開始前は開始時刻(ET/JST)を表示するが、
// 試合開始後(status.abstractGameState==='Live')は現時点の最新スコアと
// イニングを、終了後('Final')は最終スコアを表示するように切り替える。
// また、モーダルを開いたまま試合が進行した場合、30秒ごとのライブ
// ポーリングでモーダル内の表示も自動更新される。
//
// 故障シナリオ:
//   (1) 試合開始後もモーダルには常に開始時刻だけが表示され続ける
//   (2) LIVE中にスコアが取得できていても表示に反映されない
//   (3) 終了後もLIVE表示のまま、または開始時刻表示のままになる
//   (4) モーダルを開いたまま試合が進行しても、ポーリングでモーダル内の
//       表示が更新されない(一覧側だけ更新されモーダルが取り残される)
//   (5) ポーリングが常にモーダルを再描画してしまい、モーダルを閉じている
//       ときにも無駄な描画が走る(閉じているかの判定漏れ)

describe('/mlb ページ: 先発投手モーダルの開始時刻からライブスコアへの切り替え', () => {
  const html = getMLBSpherePage('tester');
  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

  it('pitcherModalTimeOrScoreHtml()はLive状態のときLIVEスコア(イニング付き)を返す', () => {
    const idx = scriptSrc.indexOf('function pitcherModalTimeOrScoreHtml');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 700);
    expect(fnBody).toContain("state==='Live'");
    expect(fnBody).toContain('tpm-live');
    expect(fnBody).toContain("g.awayScore+'-'+g.homeScore");
    expect(fnBody).toContain("(innTxt?' '+innTxt:'')");
  });

  it('pitcherModalTimeOrScoreHtml()はFinal状態のとき最終スコアを返す', () => {
    const idx = scriptSrc.indexOf('function pitcherModalTimeOrScoreHtml');
    const fnBody = scriptSrc.slice(idx, idx + 700);
    expect(fnBody).toContain("state==='Final'");
    expect(fnBody).toContain('tpm-final');
  });

  it('pitcherModalTimeOrScoreHtml()はLive/Final以外(試合開始前)のとき開始時刻(ET/JST)を返す', () => {
    const idx = scriptSrc.indexOf('function pitcherModalTimeOrScoreHtml');
    const fnBody = scriptSrc.slice(idx, idx + 900);
    expect(fnBody).toContain("fmtTime(g.gameDate,'America/New_York','ET')+' / '+fmtTime(g.gameDate,'Asia/Tokyo','JST')");
  });

  it('renderTodayPitchersBody()は各行のtpm-timeにpitcherModalTimeOrScoreHtml()の結果を使う', () => {
    const idx = scriptSrc.indexOf('function renderTodayPitchersBody');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 2000);
    expect(fnBody).toContain('var timeStr=pitcherModalTimeOrScoreHtml(g);');
    expect(fnBody).toContain("'<div class=\"tpm-time\">'+timeStr+'</div>'");
  });

  it('ライブポーリング成功時、先発投手モーダルが開いている場合のみrenderTodayPitchersBody()を呼び直す', () => {
    const idx = scriptSrc.indexOf('function startLivePolling');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 2000);
    expect(fnBody).toContain("getElementById('todayPitchersModal')");
    expect(fnBody).toContain("pitchersModalEl.classList.contains('open')");
    expect(fnBody).toContain('renderTodayPitchersBody()');
  });

  it('tpm-live・tpm-finalはCSSで色分けされている', () => {
    expect(html).toContain('.tpm-live {');
    expect(html).toContain('.tpm-final {');
  });
});
