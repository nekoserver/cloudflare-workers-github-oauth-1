import { describe, expect, it } from 'vitest';
import { getMLBSpherePage } from './mlbSphere';

// 対象: /mlb ページの先発投手モーダル(#todayPitchersModal)内、各試合行の
// 左側の時刻表示(.tpm-time)。試合開始前は開始時刻(ET/JST)を表示するが、
// 試合開始後はPT/ETを取り除き、JSTの行頭に緑色の「試合中」バッジを
// 表示する。終了後('Final')は最終スコアに切り替える。
// また、モーダルを開いたまま試合が進行した場合、30秒ごとのライブ
// ポーリングでモーダル内の表示も自動更新される。
//
// 故障シナリオ:
//   (1) 試合開始後もモーダルには常に開始時刻だけが表示され続ける
//   (2) LIVE中にもPT/ETが残る、またはJSTが消える
//   (3) 終了後も試合中表示のまま、または開始時刻表示のままになる
//   (4) モーダルを開いたまま試合が進行しても、ポーリングでモーダル内の
//       表示が更新されない(一覧側だけ更新されモーダルが取り残される)
//   (5) ポーリングが常にモーダルを再描画してしまい、モーダルを閉じている
//       ときにも無駄な描画が走る(閉じているかの判定漏れ)

describe('/mlb ページ: 試合開始後の先発投手モーダル時刻表示', () => {
  const html = getMLBSpherePage('tester');
  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

  it('pitcherModalTimeOrScoreHtml()はLive状態のとき「試合中」バッジとJSTだけを返す', () => {
    const idx = scriptSrc.indexOf('function pitcherModalTimeOrScoreHtml');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = scriptSrc.slice(idx, idx + 900);
    expect(fnBody).toContain('isGameInProgress(g)');
    expect(fnBody).toContain('tpm-live');
    expect(fnBody).toContain('in-progress-badge');
    expect(fnBody).toContain('&#35430;&#21512;&#20013;');
    expect(fnBody).toContain("fmtTime(g.gameDate,'Asia/Tokyo','JST')");
    const liveBranch = fnBody.slice(fnBody.indexOf('if(isInProgress)'), fnBody.indexOf("if(state==='Final')"));
    expect(liveBranch).not.toContain("'ET'");
    expect(liveBranch).not.toContain("'PT'");
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

  it('APIがPreviewのままでもポーリングを止めず、試合開始後の状態を取得できる', () => {
    const idx = scriptSrc.indexOf('function startLivePolling');
    const fnBody = scriptSrc.slice(idx, idx + 2300);
    const fetchIdx = fnBody.indexOf("fetch('/api/mlb-schedule?date='+dateStr)");
    expect(fetchIdx).toBeGreaterThan(-1);
    expect(fnBody.slice(0, fetchIdx)).not.toContain('if(!hasLive)');
    expect(fnBody).toContain("abstractGameState)!=='Final'");
  });

  it('「試合中」バッジは緑色のバッジとしてスタイルされている', () => {
    expect(html).toContain('.in-progress-badge {');
    expect(html).toContain('color:#3fb950');
    expect(html).toContain('.tpm-live {');
    expect(html).toContain('.tpm-final {');
  });

  it('左サイドパネルも試合開始後は「試合中」バッジとJSTだけを表示する', () => {
    const idx = scriptSrc.indexOf('function buildGameList');
    const fnBody = scriptSrc.slice(idx, idx + 4200);
    const liveBranch = fnBody.slice(fnBody.indexOf('if(isLiveNow)'), fnBody.indexOf('else if(isFinal)'));
    expect(liveBranch).toContain('in-progress-badge');
    expect(liveBranch).toContain('&#35430;&#21512;&#20013;');
    expect(liveBranch).toContain("fmtTime(g.gameDate,'Asia/Tokyo','JST')");
    expect(liveBranch).not.toContain("'ET'");
    expect(liveBranch).not.toContain("'PT'");
  });
});
