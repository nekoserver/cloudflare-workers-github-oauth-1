import { describe, it, expect } from 'vitest';
import { getThreadTimelineCSS, renderThreadTimelineList } from './threadTimeline';

describe('getThreadTimelineCSS', () => {
  it('.thread-timelineの縦線(border-left)とネストしたulの丸(list-style:circle)を含む', () => {
    const css = getThreadTimelineCSS();
    expect(css).toContain('.thread-timeline');
    expect(css).toContain('border-left: 2px solid var(--border-color)');
    expect(css).toContain('.thread-timeline ul');
    expect(css).toContain('list-style: circle');
  });

  it('固定色ではなくCSS変数(テーマ対応)を使う', () => {
    const css = getThreadTimelineCSS();
    expect(css).toContain('var(--border-color)');
    expect(css).toContain('var(--text-secondary)');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

describe('renderThreadTimelineList', () => {
  it('各要素をliで囲みulでまとめる', () => {
    const html = renderThreadTimelineList(['<b>item1</b>', 'item2']);
    expect(html).toBe('<ul class="thread-timeline"><li><b>item1</b></li><li>item2</li></ul>');
  });

  it('空配列なら空文字列を返す(何も描画しない)', () => {
    expect(renderThreadTimelineList([])).toBe('');
  });

  it('1件だけでも正しくul/liで囲む', () => {
    expect(renderThreadTimelineList(['only'])).toBe('<ul class="thread-timeline"><li>only</li></ul>');
  });

  it('渡した文字列をエスケープや変換せずそのまま展開する(呼び出し元の責任)', () => {
    const html = renderThreadTimelineList(['<script>alert(1)</script>']);
    expect(html).toContain('<script>alert(1)</script>');
  });
});
