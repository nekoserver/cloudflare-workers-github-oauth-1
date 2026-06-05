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

  it('renderLinkedQuestions が lk.models を参照している', () => {
    const html = buildPage();
    expect(html).toContain('lk.models');
  });

  it('リンク行にモデルカラードットを設定するコードを含む', () => {
    const html = buildPage();
    expect(html).toContain('MODEL_COLORS[m]');
  });

  it('質問セルには border-left カラーを設定しない（リンク行に移動）', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderLinkedQuestions(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).not.toContain('borderStyle = modelColor');
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

describe('サブクエリを持つ質問一覧: question_hash バッジ', () => {
  it('question_hash を参照するコードが HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('question_hash');
  });

  it('openQuestionHashModal 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function openQuestionHashModal');
  });

  it('openQuestionHashModal が z-index 1100 以上のオーバーレイを生成する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openQuestionHashModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toMatch(/z-index.*1[1-9]\d\d/);
  });

  it('shares-by-question-hash エンドポイントを呼び出すコードを含む', () => {
    const html = buildPage();
    expect(html).toContain('shares-by-question-hash');
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

  it('フィルターがリンクの models 配列を参照している', () => {
    const html = buildPage();
    const idx = html.indexOf('function openLinkedQuestionsFilter');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('lk.models');
  });

  it('フィルター状態を openLinkedQuestions 開示時に all にリセットするコードを含む', () => {
    const html = buildPage();
    expect(html).toContain("linkedQuestionsFilter = 'all'");
  });

  it('shortModelName をフィルターモーダルのラベルに使用している', () => {
    const html = buildPage();
    const idx = html.indexOf('function openLinkedQuestionsFilter(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('shortModelName');
  });

  it('renderLinkedQuestions のフィルターが lk.models で絞り込む', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderLinkedQuestions');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('lk.models');
  });
});
