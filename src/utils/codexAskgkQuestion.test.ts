import { describe, expect, it } from 'vitest';
import { formatCodexAskgkQuestion, formatAskgkPromptQuestion } from './codexAskgkQuestion';

describe('formatCodexAskgkQuestion', () => {
  it.each(['"', '“'])('開始引用符%sのコマンド部分と最後の引用符だけを除く', (quote) => {
    const question = '◯  詳しく\n「引用」と"本文の引用"を説明してください';
    expect(formatCodexAskgkQuestion('/neko askgk codex_prompt=' + quote + question + '"')).toBe(question);
  });
  it('スマート引用符で閉じられた質問にも対応する', () => {
    expect(formatCodexAskgkQuestion('/neko askgk codex_prompt=“◯”')).toBe('◯');
  });
  it.each(['普通の質問"', '/neko askgk claude_prompt="◯"', '/neko askgk codex_prompt', '/neko askgk codex_prompt="閉じていない'])('対象外や未完の入力は保持する: %s', (message) => {
    expect(formatCodexAskgkQuestion(message)).toBe(message);
  });
});


describe('formatAskgkPromptQuestion', () => {
  it.each(['codex', 'claude'])('%sの質問本文を保持し、表示用関数も単独で動く', (model) => {
    const question = '◯  空白\n"引用"を説明';
    const formatInBrowser = new Function('return (' + formatAskgkPromptQuestion.toString() + ')')();
    for (const [open, close] of [['"', '"'], ['“', '”']]) {
      expect(formatInBrowser('/neko askgk ' + model + '_prompt=' + open + question + close)).toBe(question);
    }
    expect(formatInBrowser('/neko askgk ' + model + '_prompt="未完')).toBe('/neko askgk ' + model + '_prompt="未完');
  });
});
