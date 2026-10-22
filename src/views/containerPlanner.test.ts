import { describe, it, expect } from 'vitest';
import { getContainerPlannerPage } from './containerPlanner';
import { readFileSync } from 'node:fs';
describe('コンテナ構成プランナー', () => {
  it('実測履歴を表示し、処理名のHTMLをエスケープする', () => {
    const html=getContainerPlannerPage([{snapshotKey:'key',buildUuid:'build',createdOn:null,status:'success',logComplete:false,collectedAt:'now',steps:[{id:1,label:'<script>bad</script>',state:'done',seconds:12},{id:2,label:'cached',state:'cached',seconds:null}]}]);
    expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');
    expect(html).toContain('12.00 秒'); expect(html).toContain('途中（未取得部分あり）');
    for(const [,script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) expect(()=>new Function(script)).not.toThrow();
  });
  it('管理者認証と有効なセッションを要求するルートを登録する', () => {
    const source = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
    const route = source.slice(source.indexOf("app.get('/cf-containers/planner'"), source.indexOf("app.get('/cf-containers',"));
    expect(route).toContain('authMiddleware, cfDashboardAdminMiddleware');
    expect(route).toContain('if (!userSession)');
    expect(route).toContain('getContainerPlannerPage(await loadBuildTimings(c.env.DB))');
  });
  it('生成されたブラウザ側の計算関数が動作する', () => {
    const script = getContainerPlannerPage().match(/const calculate = ([\s\S]*?);\nconst keys/)![1];
    const calculate = new Function('return (' + script + ')')();
    const result = calculate({ baseMiB: 100, baseSeconds: 20, limitMiB: 200, limitSeconds: 60, selected: ['a'], packages: [{id:'a',sizeMiB:30,seconds:5,dependencies:[]}] });
    expect(result.imageMiB).toBe(130);
    expect(result.buildSeconds).toBe(25);
  });
  it('ブラウザ用計算・保存・読み込みのスクリプトが構文上有効', () => {
    const html = getContainerPlannerPage();
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, script] of scripts) expect(() => new Function(script)).not.toThrow();
    expect(html).toContain('TypeScript'); expect(html).toContain('Vitest');
  });
});
