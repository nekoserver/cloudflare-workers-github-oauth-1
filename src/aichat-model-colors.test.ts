import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const COLORS: Record<string, string> = {
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5',
  '@cf/meta/llama-3.1-8b-instruct-fp8': '#0ea5e9',
  '@cf/google/gemma-4-26b-a4b-it': '#16a34a',
};

function buildPage(modelColors?: Record<string, string>): string {
  return getAiChatPage({
    name: 'テストユーザー',
    username: 'testuser',
    aiChatModel: MODEL,
    modelColors,
  });
}

describe('モデルカラー: ページへの埋め込み', () => {
  it('MODEL_COLORS 定数が HTML に埋め込まれる', () => {
    const html = buildPage(COLORS);
    expect(html).toContain('var MODEL_COLORS =');
  });

  it('指定した色が JSON として埋め込まれる', () => {
    const html = buildPage(COLORS);
    expect(html).toContain('#4f46e5');
    expect(html).toContain('#0ea5e9');
    expect(html).toContain('#16a34a');
  });

  it('modelColors を渡さない場合は空オブジェクト {} が埋め込まれる', () => {
    const html = buildPage(undefined);
    expect(html).toContain('var MODEL_COLORS = {}');
  });
});

describe('モデルカラー: ナビバードット', () => {
  it('model-color-dot CSS クラスが HTML に含まれる', () => {
    const html = buildPage(COLORS);
    expect(html).toContain('.model-color-dot');
  });

  it('modelColorDot 要素が HTML に含まれる', () => {
    const html = buildPage(COLORS);
    expect(html).toContain('id="modelColorDot"');
  });

  it('applyModelColor 関数が HTML に含まれる', () => {
    const html = buildPage(COLORS);
    expect(html).toContain('function applyModelColor');
  });

  it('applyModelColor が MODEL_COLORS を参照している', () => {
    const html = buildPage(COLORS);
    expect(html).toContain('MODEL_COLORS[model]');
  });

  it('modelSelect change 時に applyModelColor を呼び出している', () => {
    const html = buildPage(COLORS);
    expect(html).toContain('applyModelColor(lastModel)');
  });
});

describe('モデルカラー: サイドバー縦線', () => {
  it('sidebar-result-item に border-left スタイルが CSS で設定されている', () => {
    const html = buildPage(COLORS);
    expect(html).toContain('border-left: 3px solid transparent');
  });

  it('renderSidebarResults で MODEL_COLORS を参照している', () => {
    const html = buildPage(COLORS);
    expect(html).toContain('MODEL_COLORS[r.model]');
  });

  it('renderSidebarResults で borderLeftColor を設定している', () => {
    const html = buildPage(COLORS);
    expect(html).toContain('borderLeftColor = modelColor');
  });
});
