import { describe, expect, it } from 'vitest';
import { addThreadHistoryToAiMessages, buildAiMessages } from './buildAiMessages';

describe('addThreadHistoryToAiMessages', () => {
  it('保存済みの質問と回答を新しい追加質問の前に時系列で挿入する', () => {
    expect(addThreadHistoryToAiMessages(buildAiMessages('それはなぜ？', 'a'), [
      { question: '最初の質問', answer: '最初の回答' },
      { question: '次の質問', answer: '次の回答' },
    ])).toEqual([
      { role: 'system', content: 'あなたは親切なアシスタントです。必ず日本語で回答してください。' },
      { role: 'user', content: '最初の質問' },
      { role: 'assistant', content: '最初の回答' },
      { role: 'user', content: '次の質問' },
      { role: 'assistant', content: '次の回答' },
      { role: 'user', content: 'それはなぜ？' },
    ]);
  });

  it('履歴上限を超える場合は最新の完了ターンを残す', () => {
    const messages = addThreadHistoryToAiMessages(buildAiMessages('now', 'c'), [
      { question: 'old question', answer: 'old answer' },
      { question: 'new', answer: 'reply' },
    ], 8);
    expect(messages).toEqual([
      { role: 'user', content: 'new' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'now' },
    ]);
  });
});
