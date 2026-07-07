import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const view = readFileSync(new URL('./views/webglHeritage.ts', import.meta.url).pathname, 'utf-8');

describe('世界遺産ページ 都市情報モーダルの世界遺産名タップ', () => {
  it('city-fly-row のタップ位置をツールチップ表示に使い、地球儀中央へ固定表示しない', () => {
    const blockStart = view.indexOf("cityFlyBody.querySelectorAll('.city-fly-row[data-idx]')");
    expect(blockStart).toBeGreaterThan(-1);
    const block = view.slice(blockStart, view.indexOf('});\n    }).catch(function()', blockStart));

    expect(block).toContain('function(e)');
    expect(block).toContain('e.stopPropagation();');
    expect(block).toContain('showMarkerTooltip(parseInt(el.getAttribute(\'data-idx\')), e.clientX, e.clientY);');
    expect(block).not.toContain('showMarkerTooltip(parseInt(el.getAttribute(\'data-idx\')), 0, 0);');
  });
});
