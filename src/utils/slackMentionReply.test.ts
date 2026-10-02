import { describe, it, expect, vi } from 'vitest';
import { handleSlackAppMention, stripBotMentions, formatSlackAiReplyText, type SlackMentionReplyDeps } from './slackMentionReply';

describe('formatSlackAiReplyText', () => {
  it('AI応答成功時はMarkdownをSlackのmrkdwnに変換して返す', () => {
    expect(formatSlackAiReplyText({ ok: true, text: '**重要**な情報です' })).toBe('*重要*な情報です');
  });

  it('応答本文に含まれるフェンスコードブロックはそのまま保持される', () => {
    const formatted = formatSlackAiReplyText({ ok: true, text: '説明\n```js\nconsole.log(1)\n```' });
    expect(formatted).toContain('```js\nconsole.log(1)\n```');
  });

  it('AI応答失敗時は変換せず、絵文字付きのエラーメッセージのまま返す', () => {
    expect(formatSlackAiReplyText({ ok: false, error: 'timeout' })).toBe('❌ AI応答の取得に失敗しました: timeout');
  });
});

describe('stripBotMentions', () => {
  it('先頭のメンショントークンを取り除く', () => {
    expect(stripBotMentions('<@U12345> こんにちは')).toBe('こんにちは');
  });

  it('複数のメンショントークンをすべて取り除く', () => {
    expect(stripBotMentions('<@U12345> <@U67890> テスト')).toBe('テスト');
  });

  it('メンションが無い場合はそのまま返す（トリムのみ）', () => {
    expect(stripBotMentions('  こんにちは  ')).toBe('こんにちは');
  });

  it('メンションのみで本文が無い場合は空文字を返す', () => {
    expect(stripBotMentions('<@U12345>')).toBe('');
  });
});

describe('handleSlackAppMention', () => {
  const baseDeps = (): SlackMentionReplyDeps => ({
    text: '<@U12345> 今日の天気は？',
    channel: 'C999',
    threadTs: '1700000000.000100',
    slackToken: 'xoxb-test',
    configuredModel: undefined,
    aiRun: vi.fn().mockResolvedValue({ response: '晴れです' }),
    postMessage: vi.fn().mockResolvedValue({ ok: true }),
  });

  it('SOTが未設定の場合は投稿せずエラーを返す', async () => {
    const deps = baseDeps();
    deps.slackToken = undefined;
    const result = await handleSlackAppMention(deps);
    expect(result).toEqual({ posted: false, error: 'SOT is not configured' });
    expect(deps.postMessage).not.toHaveBeenCalled();
  });

  it('メンションを除去した本文が空の場合はAIを呼ばず案内メッセージを返信する', async () => {
    const deps = baseDeps();
    deps.text = '<@U12345>';
    const result = await handleSlackAppMention(deps);
    expect(result).toEqual({ posted: true });
    expect(deps.aiRun).not.toHaveBeenCalled();
    expect(deps.postMessage).toHaveBeenCalledWith({
      token: 'xoxb-test',
      channel: 'C999',
      text: expect.stringContaining('質問内容が空です'),
      thread_ts: '1700000000.000100',
    });
  });

  it('成功時はAIの応答テキストをmrkdwnに変換して同じスレッドに返信する', async () => {
    const deps = baseDeps();
    const result = await handleSlackAppMention(deps);
    expect(result).toEqual({ posted: true });
    expect(deps.postMessage).toHaveBeenCalledWith({
      token: 'xoxb-test',
      channel: 'C999',
      text: '晴れです',
      thread_ts: '1700000000.000100',
    });
  });

  it('AI応答取得に失敗した場合もエラー内容を含めてSlackへ返信する（握りつぶさない）', async () => {
    const deps = baseDeps();
    deps.aiRun = vi.fn().mockRejectedValue(new Error('AI unavailable'));
    const result = await handleSlackAppMention(deps);
    expect(result).toEqual({ posted: true });
    const [[postedArgs]] = vi.mocked(deps.postMessage).mock.calls;
    expect(postedArgs.text).toContain('AI応答の取得に失敗しました');
    expect(postedArgs.text).toContain('AI unavailable');
    expect(postedArgs.text.length).toBeGreaterThan(0);
  });

  it('Slackへの投稿自体が失敗した場合はposted:falseとエラー内容を返す', async () => {
    const deps = baseDeps();
    deps.postMessage = vi.fn().mockResolvedValue({ ok: false, error: 'channel_not_found' });
    const result = await handleSlackAppMention(deps);
    expect(result).toEqual({ posted: false, error: 'channel_not_found' });
  });

  it('AI応答・投稿ともに成功した場合、saveShareへ質問・回答・モデル・usageを渡す(AIチャットページから参照できるようにするため)', async () => {
    const deps = baseDeps();
    deps.aiRun = vi.fn().mockResolvedValue({ response: '晴れです', usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 } });
    const saveShare = vi.fn().mockResolvedValue(undefined);
    deps.saveShare = saveShare;
    const result = await handleSlackAppMention(deps);
    expect(result).toEqual({ posted: true });
    expect(saveShare).toHaveBeenCalledWith({
      question: '今日の天気は？',
      answer: '晴れです',
      model: '@cf/google/gemma-4-26b-a4b-it',
      usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
    });
  });

  it('AI応答取得に失敗した場合はsaveShareを呼ばない(保存する回答が無いため)', async () => {
    const deps = baseDeps();
    deps.aiRun = vi.fn().mockRejectedValue(new Error('AI unavailable'));
    const saveShare = vi.fn().mockResolvedValue(undefined);
    deps.saveShare = saveShare;
    await handleSlackAppMention(deps);
    expect(saveShare).not.toHaveBeenCalled();
  });

  it('saveShareが例外を投げてもSlackへの返信結果には影響しない(付随機能のため握りつぶす)', async () => {
    const deps = baseDeps();
    deps.saveShare = vi.fn().mockRejectedValue(new Error('DB down'));
    const result = await handleSlackAppMention(deps);
    expect(result).toEqual({ posted: true });
  });

  it('saveShareを渡さなくても従来通り動作する(任意のフックのため)', async () => {
    const deps = baseDeps();
    expect(deps.saveShare).toBeUndefined();
    const result = await handleSlackAppMention(deps);
    expect(result).toEqual({ posted: true });
  });
});
