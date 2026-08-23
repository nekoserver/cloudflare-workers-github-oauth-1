// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';
import { extractFunctionSource } from './utils/extractFunctionSource';

const user = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: {},
};

function loadShouldIgnoreHistorySwipeKey() {
  const html = getAiChatPage(user);
  const source = extractFunctionSource(html, 'shouldIgnoreHistorySwipeKey');
  expect(source).toBeTruthy();
  return new Function(`${source}\nreturn shouldIgnoreHistorySwipeKey;`)() as (event: {
    isComposing?: boolean;
    target?: Element | null;
  }) => boolean;
}

describe('分類モーダルの新規中分類カテゴリ入力', () => {
  it('テキスト入力欄のキー操作を履歴スワイプ処理から除外する', () => {
    const shouldIgnore = loadShouldIgnoreHistorySwipeKey();
    const wrapper = document.createElement('div');
    const input = document.createElement('input');
    wrapper.appendChild(input);

    expect(shouldIgnore({ target: input })).toBe(true);
  });

  it('IME変換中のキー操作を履歴スワイプ処理から除外する', () => {
    const shouldIgnore = loadShouldIgnoreHistorySwipeKey();

    expect(shouldIgnore({ isComposing: true, target: document.body })).toBe(true);
  });

  it('入力要素以外のキー操作では従来の履歴スワイプを妨げない', () => {
    const shouldIgnore = loadShouldIgnoreHistorySwipeKey();
    const button = document.createElement('button');

    expect(shouldIgnore({ target: button })).toBe(false);
  });
});
