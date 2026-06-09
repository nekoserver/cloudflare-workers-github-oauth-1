import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('サブクエリを持つ質問一覧: ソートトグルボタン', () => {
  it('linkedQuestionsSortToggle ボタンが存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="linkedQuestionsSortToggle"');
  });

  it('ボタンが linkedQuestionsOverlay ヘッダ内にある', () => {
    const html = buildPage();
    const idx = html.indexOf('id="linkedQuestionsOverlay"');
    expect(idx).toBeGreaterThan(-1);
    const section = html.slice(idx, idx + 600);
    expect(section).toContain('linkedQuestionsSortToggle');
  });

  it('linkedQuestionsSortOrder 変数が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('linkedQuestionsSortOrder');
  });

  it('renderLinkedQuestions がソート順を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderLinkedQuestions');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('linkedQuestionsSortOrder');
  });

  it('renderLinkedQuestions が share_id で降順ソートする', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderLinkedQuestions');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('share_id');
  });

  it('トグルボタンクリックで renderLinkedQuestions が再呼び出しされる', () => {
    const html = buildPage();
    const idx = html.indexOf("linkedQuestionsSortToggle.addEventListener");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('renderLinkedQuestions');
  });

  it('openLinkedQuestions がソート順をデフォルトにリセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function openLinkedQuestions(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('linkedQuestionsSortOrder');
  });
});
