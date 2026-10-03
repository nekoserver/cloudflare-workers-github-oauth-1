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

  describe('/neko askgk サブコマンド', () => {
    it('本文が"/neko askgk <質問文>"の場合はAIを呼ばずaskTunnelSignerへ渡し、結果をそのまま返信する', async () => {
      const deps = baseDeps();
      deps.text = '<@U12345> /neko askgk settings';
      deps.askTunnelSigner = vi.fn().mockResolvedValue('設定は正常です');
      const result = await handleSlackAppMention(deps);
      expect(result).toEqual({ posted: true });
      expect(deps.aiRun).not.toHaveBeenCalled();
      expect(deps.askTunnelSigner).toHaveBeenCalledWith('settings');
      const [[postedArgs]] = vi.mocked(deps.postMessage).mock.calls;
      expect(postedArgs.text).toContain('設定は正常です');
      expect(postedArgs.channel).toBe('C999');
      expect(postedArgs.thread_ts).toBe('1700000000.000100');
    });

    it('askTunnelSigner未設定の場合は「現在利用できません」と返信する(AIチャット側と同じ文言)', async () => {
      const deps = baseDeps();
      deps.text = '<@U12345> /neko askgk settings';
      const result = await handleSlackAppMention(deps);
      expect(result).toEqual({ posted: true });
      expect(deps.aiRun).not.toHaveBeenCalled();
      const [[postedArgs]] = vi.mocked(deps.postMessage).mock.calls;
      expect(postedArgs.text).toContain('現在利用できません');
    });

    it('askTunnelSignerが失敗した場合はエラー内容を含めて返信する(握りつぶさない)', async () => {
      const deps = baseDeps();
      deps.text = '<@U12345> /neko askgk settings';
      deps.askTunnelSigner = vi.fn().mockRejectedValue(new Error('rust-worker-sqlx-d1応答異常: HTTP 500'));
      const result = await handleSlackAppMention(deps);
      expect(result).toEqual({ posted: true });
      const [[postedArgs]] = vi.mocked(deps.postMessage).mock.calls;
      expect(postedArgs.text).toContain('rust-worker-sqlx-d1応答異常: HTTP 500');
    });

    it('引数なし("/neko askgk"のみ)の場合も空文字のままaskTunnelSignerへ渡しヘルプ応答を返信する(tunnel-signerファイルに渡すヘルプコマンドの1つ)', async () => {
      const deps = baseDeps();
      deps.text = '<@U12345> /neko askgk';
      deps.askTunnelSigner = vi.fn().mockResolvedValue('利用可能なコマンド一覧...');
      const result = await handleSlackAppMention(deps);
      expect(result).toEqual({ posted: true });
      expect(deps.askTunnelSigner).toHaveBeenCalledWith('');
      const [[postedArgs]] = vi.mocked(deps.postMessage).mock.calls;
      expect(postedArgs.text).not.toContain('質問文を指定してください');
      expect(postedArgs.text).toContain('利用可能なコマンド一覧...');
    });

    it('引数なしでもaskTunnelSigner未設定時は「現在利用できません」と返信する', async () => {
      const deps = baseDeps();
      deps.text = '<@U12345> /neko askgk';
      const result = await handleSlackAppMention(deps);
      expect(result).toEqual({ posted: true });
      const [[postedArgs]] = vi.mocked(deps.postMessage).mock.calls;
      expect(postedArgs.text).toContain('現在利用できません');
    });

    it('"/neko askgk help"はエイリアス変換せず"help"のままaskTunnelSignerへ渡す(tunnel-signerファイルに渡すヘルプコマンドのもう1つ)', async () => {
      const deps = baseDeps();
      deps.text = '<@U12345> /neko askgk help';
      deps.askTunnelSigner = vi.fn().mockResolvedValue('利用可能なコマンド一覧...');
      const result = await handleSlackAppMention(deps);
      expect(result).toEqual({ posted: true });
      expect(deps.askTunnelSigner).toHaveBeenCalledWith('help');
      const [[postedArgs]] = vi.mocked(deps.postMessage).mock.calls;
      expect(postedArgs.text).toContain('利用可能なコマンド一覧...');
    });

    it('askTunnelSignerが設定されていても askgk 以外の本文は従来通りAI応答になる(回帰)', async () => {
      const deps = baseDeps();
      deps.askTunnelSigner = vi.fn().mockResolvedValue('使われない');
      const result = await handleSlackAppMention(deps);
      expect(result).toEqual({ posted: true });
      expect(deps.askTunnelSigner).not.toHaveBeenCalled();
      expect(deps.aiRun).toHaveBeenCalled();
    });

    it('askgk結果はsaveShareへ渡さない(AIチャット側の/neko askgkもai_chat_sharesに保存しない仕様と揃える)', async () => {
      const deps = baseDeps();
      deps.text = '<@U12345> /neko askgk settings';
      deps.askTunnelSigner = vi.fn().mockResolvedValue('設定は正常です');
      const saveShare = vi.fn().mockResolvedValue(undefined);
      deps.saveShare = saveShare;
      await handleSlackAppMention(deps);
      expect(saveShare).not.toHaveBeenCalled();
    });
  });
});
