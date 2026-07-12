import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

// 対象: 世界遺産ページの?heritage=<世界遺産名>クエリパラメータによる深リンク。
// heritage-accessページ(世界遺産アクセスランキング)の検索窓で世界遺産を選択した際に
// 現れる🌆🔍ドロップダウンメニューの「🌍 地球儀で見る」から遷移した際、
// 最大ズームでその世界遺産の座標へ即座に着地しツールチップを表示する。
describe('世界遺産ページ: ?heritage=クエリパラメータによる深リンク', () => {
  const html = getWebGLHeritagePage('tester');

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

  it("URLの heritage パラメータを読み取りHERITAGEから名前一致で世界遺産を特定する", () => {
    expect(html).toContain("sp.get('heritage')");
    const idx = html.indexOf("sp.get('heritage')");
    const block = html.slice(idx, idx + 400);
    expect(block).toMatch(/HERITAGE\[i\]\.n === heritageName/);
  });

  it('最大ズーム(下限の1.2)で即座にその座標へ着地する(アニメーション省略)', () => {
    const idx = html.indexOf("sp.get('heritage')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 500);
    expect(block).toContain('zoom = 1.2');
    expect(block).toContain('flyTo(hd.lat, hd.lon)');
    expect(block).toContain('rotYv = flyTarget.ry');
    expect(block).toContain('rotXv = flyTarget.rx');
    expect(block).toContain('flyTarget = null');
  });

  it('着地後にshowMarkerTooltipでツールチップを表示する', () => {
    const idx = html.indexOf("sp.get('heritage')");
    const block = html.slice(idx, idx + 500);
    expect(block).toMatch(/setTimeout\(function\(\) \{ showMarkerTooltip\(hIdx, 0, 0\); \}, \d+\)/);
  });

  it('該当する世界遺産が見つからない場合は何もしない(hIdxが-1のままreturn)', () => {
    const idx = html.indexOf("sp.get('heritage')");
    const block = html.slice(idx, idx + 300);
    expect(block).toMatch(/if \(hIdx === -1\) return;/);
  });
});
