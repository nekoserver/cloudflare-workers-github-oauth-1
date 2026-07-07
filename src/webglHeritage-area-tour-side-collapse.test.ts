import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

describe('世界遺産ページ エリア巡回サイドパネル折りたたみ', () => {
  const html = getWebGLHeritagePage('tester');

  it('巡回サイドパネルヘッダに折りたたみトグルボタンがある', () => {
    expect(html).toContain('id="area-tour-side-collapse"');
    expect(html).toContain('aria-label="巡回サイドパネルを折りたたむ"');
  });

  it('折りたたみ時は巡回サイドパネル本体が3行分に制限される', () => {
    expect(html).toContain('#area-tour-side.collapsed');
    expect(html).toContain('max-height:calc(35px * 3)');
    expect(html).toContain('#area-tour-side.collapsed .f1-side-item:nth-child(n+4)');
    expect(html).toContain("areaTourSide.classList.toggle('collapsed')");
  });

  it('折りたたみ時の4件目以降は3行内で疑似スクロールして点滅対象を表示する', () => {
    expect(html).toContain('function prepareAreaTourVisibleRows(idx)');
    expect(html).toContain('Math.max(0, idx - 2), 3');
    expect(html).toContain('areaTourSideBody.scrollTop = 0');
  });

  it('折りたたみ解除時は巡回リスト全件表示に戻す', () => {
    expect(html).toContain('renderAreaTourRows(areaTourSideKind, areaTourSideItems, 0);');
  });

  it('マーカーツールチップは最上位レイヤーに表示される', () => {
    const style = html.match(/#mk-tooltip \{[^}]+\}/)?.[0] || '';
    expect(style).toContain('z-index:10000');
  });
});
