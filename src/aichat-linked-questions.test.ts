import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const FULL_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const COLORS = {
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5',
  '@cf/google/gemma-4-26b-a4b-it': '#16a34a',
};

function buildPage(): string {
  return getAiChatPage({
    name: 'テストユーザー',
    username: 'testuser',
    aiChatModel: FULL_MODEL,
    modelColors: COLORS,
  });
}

describe('サブクエリを持つ質問一覧: モデルカラー表示', () => {
  it('renderLinkedQuestions 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function renderLinkedQuestions');
  });

  it('renderLinkedQuestions が MODEL_COLORS を参照している', () => {
    const html = buildPage();
    expect(html).toContain('MODEL_COLORS[item.model]');
  });

  it('質問セルにモデルカラーの border-left を設定するコードを含む', () => {
    const html = buildPage();
    expect(html).toContain('borderLeftColor');
  });

  it('linkedQuestionsAllItems 変数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('linkedQuestionsAllItems');
  });

  it('linkedQuestionsFilter 変数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('linkedQuestionsFilter');
  });
});

describe('サブクエリを持つ質問一覧: モデルフィルター', () => {
  it('openLinkedQuestionsFilter 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function openLinkedQuestionsFilter');
  });

  it('フィルターモーダルに「すべて」オプションが含まれる', () => {
    const html = buildPage();
    expect(html).toContain("'all'");
    expect(html).toContain('すべて');
  });

  it('フィルター選択後に renderLinkedQuestions を再描画するコードを含む', () => {
    const html = buildPage();
    expect(html).toContain('renderLinkedQuestions(linkedQuestionsAllItems)');
  });

  it('質問 th クリックで openLinkedQuestionsFilter を呼び出すコードを含む', () => {
    const html = buildPage();
    expect(html).toContain('openLinkedQuestionsFilter');
  });

  it('フィルター状態を openLinkedQuestions 開示時に all にリセットするコードを含む', () => {
    const html = buildPage();
    expect(html).toContain("linkedQuestionsFilter = 'all'");
  });

  it('shortModelName をフィルターモーダルのラベルに使用している', () => {
    const html = buildPage();
    const idx = html.indexOf('function openLinkedQuestionsFilter');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('shortModelName');
  });
});
