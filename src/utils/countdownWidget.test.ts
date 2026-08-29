import { describe, it, expect } from 'vitest';
import { getCountdownWidgetCSS, getCountdownWidgetHTML, getCountdownWidgetScript } from './countdownWidget';

describe('getCountdownWidgetCSS', () => {
  it('#countdownWidgetのスタイル定義を含む', () => {
    expect(getCountdownWidgetCSS()).toContain('#countdownWidget');
    expect(getCountdownWidgetCSS()).toContain('.visible');
  });
});

describe('getCountdownWidgetHTML', () => {
  it('ウィジェットのマークアップ(id=countdownWidget/widgetLabel/widgetClock)を含む', () => {
    const html = getCountdownWidgetHTML();
    expect(html).toContain('id="countdownWidget"');
    expect(html).toContain('id="widgetLabel"');
    expect(html).toContain('id="widgetClock"');
  });
});

describe('getCountdownWidgetScript', () => {
  it('/api/countdown/nextを呼び出すコードを含む', () => {
    expect(getCountdownWidgetScript()).toContain("fetch('/api/countdown/next')");
  });

  it('スクリプトとして構文エラーが無い', () => {
    expect(() => new Function(getCountdownWidgetScript())).not.toThrow();
  });

  it('要素が存在しないページに埋め込んでも例外を投げずに何もしない(早期return)', () => {
    // @vitest-environment jsdom 前提: このファイル単体ではjsdomを使わないため
    // 文字列としてのガード節の存在だけを確認する
    expect(getCountdownWidgetScript()).toContain('if (!widget || !widgetLabel || !widgetClock) return;');
  });
});
