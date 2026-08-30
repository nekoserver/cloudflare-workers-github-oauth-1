import { describe, it, expect } from 'vitest';
import {
  clampCountdownWidgetPosition,
  getCountdownWidgetCSS,
  getCountdownWidgetHTML,
  getCountdownWidgetScript,
} from './countdownWidget';

describe('clampCountdownWidgetPosition', () => {
  it('ビューポート内に収まる位置はそのまま返す', () => {
    expect(clampCountdownWidgetPosition(100, 200, 220, 80, 1000, 800)).toEqual({ left: 100, top: 200 });
  });

  it('左・上にはみ出す場合は0にクランプする', () => {
    expect(clampCountdownWidgetPosition(-50, -30, 220, 80, 1000, 800)).toEqual({ left: 0, top: 0 });
  });

  it('右・下にはみ出す場合はウィジェットが画面内に収まる位置にクランプする', () => {
    expect(clampCountdownWidgetPosition(950, 780, 220, 80, 1000, 800)).toEqual({ left: 780, top: 720 });
  });

  it('ウィジェットがビューポートより大きい場合は0にクランプする(負のmaxを避ける)', () => {
    expect(clampCountdownWidgetPosition(-10, -10, 1200, 900, 1000, 800)).toEqual({ left: 0, top: 0 });
  });
});

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

  it('ドラッグ&ドロップ用のpointerイベント配線とlocalStorageへの位置保存を含む', () => {
    const script = getCountdownWidgetScript();
    expect(script).toContain("addEventListener('pointerdown'");
    expect(script).toContain("addEventListener('pointermove'");
    expect(script).toContain("addEventListener('pointerup'");
    expect(script).toContain('countdownWidgetPosition');
    expect(script).toContain('window.localStorage.setItem(POSITION_STORAGE_KEY');
    expect(script).toContain('window.localStorage.getItem(POSITION_STORAGE_KEY');
  });
});
