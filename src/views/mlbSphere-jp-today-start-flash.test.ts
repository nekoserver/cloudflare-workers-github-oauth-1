import { describe, expect, it } from 'vitest';
import { getMLBSpherePage } from './mlbSphere';

describe('/mlb 日本人タブ: 本日登板予定の投手枠を点滅', () => {
  const html = getMLBSpherePage('tester');
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

  it('次回登板日が今日の投手行だけを対象として識別する', () => {
    expect(script).toContain("next.date===toDateStr(new Date())");
    expect(script).toContain("isPitcherScheduledToday(p.id)?' jp-starts-today':''");
    expect(script).toContain('class="jp-pitcher-row');
  });

  it('日本人タブを開くたびに3秒後の点滅を予約する', () => {
    const switchTab = script.slice(script.indexOf('function switchTab'), script.indexOf('var mlbLocked'));
    expect(switchTab).toContain("if(tab==='games')");
    expect(switchTab).toContain('scheduleJPTodayStartFlash()');
    expect(script).toContain('},3000);');
  });

  it('黄色のアニメーションを3回実行し、動きを減らす設定にも対応する', () => {
    expect(html).toContain('@keyframes jp-today-start-flash');
    expect(html).toContain('background:rgba(255,215,0,.72)');
    expect(html).toContain('animation:jp-today-start-flash .6s ease-in-out 3');
    expect(html).toContain('@media(prefers-reduced-motion:reduce)');
  });
});
