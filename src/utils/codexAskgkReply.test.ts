import { describe, it, expect } from 'vitest';
import { parseCodexAskgkReply } from './codexAskgkReply';

// 対象: parseCodexAskgkReply(/neko askgk codex_prompt="..."の応答整形)。
//
// 故障シナリオ:
//   (1) workdir〜reasoningのバナーを除去できない(ノイズがそのまま画面に出る)
//   (2) session idを取り逃す、またはDBに渡す値を誤る
//   (3) session id行を除去した結果、本文側まで一緒に消えてしまう
//   (4) バナー・session idが無い(通常の自由記述質問の)応答を誤って加工してしまう

describe('parseCodexAskgkReply', () => {
  it('workdir〜reasoningのバナーとsession id行を除去し、本文とsession idを分離する', () => {
    const reply = [
      'workdir: /home/user/repo',
      'model: gpt-5-codex',
      'provider: openai',
      'approval: never',
      'sandbox: workspace-write',
      'reasoning effort: high',
      'reasoning summaries: auto',
      '--------',
      'session id: 9f86d081-884c-4d30-9c8f-example',
      '--------',
      'これが本文です。',
      '2行目もあります。',
    ].join('\n');

    const result = parseCodexAskgkReply(reply);
    expect(result).toEqual({
      answer: 'これが本文です。\n2行目もあります。',
      sessionId: '9f86d081-884c-4d30-9c8f-example',
    });
  });

  it('区切り線が無い場合でも同様に処理できる', () => {
    const reply = [
      'workdir: /home/user/repo',
      'model: gpt-5-codex',
      'reasoning effort: high',
      'session id: abc123',
      '本文のみ',
    ].join('\n');

    const result = parseCodexAskgkReply(reply);
    expect(result).toEqual({ answer: '本文のみ', sessionId: 'abc123' });
  });

  it('workdir行が無ければバナー除去はせず、session idだけ抽出する', () => {
    const reply = ['session id: xyz', '本文'].join('\n');
    const result = parseCodexAskgkReply(reply);
    expect(result).toEqual({ answer: '本文', sessionId: 'xyz' });
  });

  it('session id行が無ければsessionIdはnullのまま、本文はそのまま', () => {
    const reply = 'ただの回答文です。';
    const result = parseCodexAskgkReply(reply);
    expect(result).toEqual({ answer: 'ただの回答文です。', sessionId: null });
  });

  it('バナーもsession idも無い通常の応答は変化させない', () => {
    const reply = '1行目\n2行目\n\n3行目';
    const result = parseCodexAskgkReply(reply);
    expect(result).toEqual({ answer: '1行目\n2行目\n\n3行目', sessionId: null });
  });

  it('reasoningを含む行が複数あってもバナー全体を1ブロックとして除去する', () => {
    const reply = [
      'workdir: /x',
      'reasoning effort: high',
      'reasoning summaries: auto',
      'session id: s1',
      '本文',
    ].join('\n');
    const result = parseCodexAskgkReply(reply);
    expect(result.answer).toBe('本文');
    expect(result.sessionId).toBe('s1');
  });
});
