import { describe, expect, it, vi } from 'vitest';
import { getAiChatPage } from './views/aichat';
import { getThemeCSS } from './utils/theme';

function setup(dark: boolean) {
  const html = getAiChatPage({ username: 'test', aiChatModel: 'codex' });
  const start = html.indexOf('    function wrapCanvasText(');
  const end = html.indexOf('    function doDateLoad', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const css = getThemeCSS();
  const palette = Object.fromEntries(Array.from(
    (dark ? css.slice(css.indexOf('[data-theme="dark"]')) : css.slice(0, css.indexOf('[data-theme="dark"]')))
      .matchAll(/(--[\w-]+):\s*([^;]+);/g), match => [match[1], match[2].trim()],
  ));
  const paints: Array<{ text?: string; fill: string; stroke?: string }> = [];
  const ctx = {
    fillStyle: '', strokeStyle: '',
    measureText: (text: string) => ({ width: text.length * 8 }),
    setTransform() {},
    fillRect() { paints.push({ fill: this.fillStyle }); },
    strokeRect() { paints.push({ fill: this.fillStyle, stroke: this.strokeStyle }); },
    fillText(text: string) { paints.push({ text, fill: this.fillStyle }); },
  };
  const redraw = vi.fn();
  let notify = () => {};
  let open = true;
  const observe = vi.fn();
  class Observer {
    constructor(callback: () => void) { notify = callback; }
    observe = observe;
  }
  const run = new Function('canvasSearchCtx', 'canvasSearchCanvas', 'window', 'getComputedStyle',
    'MutationObserver', 'document', 'canvasSearchModal', 'canvasSearchInput', 'renderCanvasSearch',
    'CANVAS_SEARCH_W', 'CANVAS_SEARCH_PAD', 'CANVAS_SEARCH_LINE_H',
    html.slice(start, end) + '\nreturn drawCanvasSearch;');
  const draw = run(ctx, { style: {} }, { devicePixelRatio: 1 },
    () => ({ getPropertyValue: (key: string) => palette[key] }), Observer,
    { documentElement: {} }, { classList: { contains: () => open } }, { value: '質問' }, redraw, 720, 16, 20);
  return { draw, paints, palette, redraw, notify: () => notify(), close: () => { open = false; }, observe };
}

describe('質問・回答キャンバスのテーマ', () => {
  it.each([false, true])('テーマに合わせて背景・本文・強調文字・空の表示を描画する: dark=%s', dark => {
    const { draw, paints, palette } = setup(dark);
    draw([{ question: '質問', answer: '回答' }], '質問');
    expect(paints.some(p => p.fill === palette['--bg-secondary'])).toBe(true);
    expect(paints.some(p => p.fill === palette['--card-bg'])).toBe(true);
    expect(paints.some(p => p.stroke === palette['--border-color'])).toBe(true);
    expect(paints.find(p => p.text === '質問')?.fill).toBe(palette['--text-primary']);
    expect(paints.find(p => p.text === '回答: 回答')?.fill).toBe(palette['--text-secondary']);
    expect(paints.find(p => p.text === 'キーワード: 質問')?.fill).toBe(palette['--accent-color']);
    draw([], '');
    expect(paints.find(p => p.text === '一致する質問・回答がありません')?.fill).toBe(palette['--text-muted']);
  });

  it('テーマ変更時は開いているモーダルを現在のフィルターで再描画する', () => {
    const state = setup(true);
    expect(state.observe.mock.calls[0][1]).toEqual({ attributes: true, attributeFilter: ['data-theme'] });
    state.notify();
    expect(state.redraw).toHaveBeenCalledWith('質問');
    state.close();
    state.notify();
    expect(state.redraw).toHaveBeenCalledTimes(1);
  });
});
