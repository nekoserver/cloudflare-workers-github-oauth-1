import { describe, expect, it } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

// 対象: 世界遺産ページのエリアタブ内、保存済みエリア一覧(renderSavedAreaMenu)。
// AIチャットの左サイドパネルの質問削除と同じスワイプUX(右にスワイプ→
// 赤い削除ボタンが現れる→タップでDBと画面から消える)をエリア番号にも適用する。
describe('世界遺産ページ 保存済みエリアのスワイプ削除', () => {
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

  it('各エリア行をswipe-wrapで包み、赤い削除ボタン(saved-area-delete-btn)を持つ', () => {
    expect(html).toContain('saved-area-row-wrap');
    expect(html).toContain('saved-area-delete-btn');
    expect(html).toContain('background:#e53e3e');
  });

  it('スワイプで初めて削除ボタンが見える(opacity:0がデフォルトでswipe-openで1になる)', () => {
    expect(html).toContain('.saved-area-delete-btn { position:absolute; right:0; top:0; bottom:0; width:72px; background:#e53e3e; color:#fff; border:none; font-size:12px; font-weight:700; cursor:pointer; z-index:0; display:flex; align-items:center; justify-content:center; opacity:0; }');
    expect(html).toContain('.saved-area-row-wrap.swipe-open .saved-area-delete-btn { opacity:1; }');
  });

  it('タッチ/マウスのドラッグでスワイプ判定するaddSavedAreaSwipeBehaviorが定義され、行ごとに呼ばれる', () => {
    expect(html).toContain('function addSavedAreaSwipeBehavior(wrap, inner)');
    expect(html).toContain("wrap.addEventListener('touchstart'");
    expect(html).toContain("wrap.addEventListener('touchmove'");
    expect(html).toContain("wrap.addEventListener('touchend'");
    expect(html).toContain('addSavedAreaSwipeBehavior(wrap, row);');
  });

  it('削除ボタンをタップするとDELETE /api/heritage-area-boxes/:areaSeqを呼び、成功後に画面からも消える', () => {
    expect(html).toContain('function deleteSavedArea(areaSeq, wrap)');
    expect(html).toContain("fetch('/api/heritage-area-boxes/' + encodeURIComponent(areaSeq), { method: 'DELETE'");
    expect(html).toContain('savedAreasCache = savedAreasCache.filter(function(a) { return Number(a.areaSeq) !== Number(areaSeq); });');
    expect(html).toContain('renderSavedAreaMenu(savedAreasCache);');
  });

  it('削除ボタンのclickはstopPropagationし、行選択(focusSavedArea)を誤発火させない', () => {
    const idx = html.indexOf("delBtn.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 200);
    expect(block).toContain('e.stopPropagation();');
    expect(block).toContain('deleteSavedArea(seq, wrap);');
  });
});
