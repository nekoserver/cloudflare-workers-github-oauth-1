import { describe, it, expect, vi } from 'vitest';
import {
  fetchPrDiff,
  generateAiSummary,
  buildSlackMessage,
  type AiBinding,
} from './aiSummary';

// ---- fetchPrDiff ----

describe('fetchPrDiff', () => {
  it('正常にdiffを取得し、8000文字で切り詰める', async () => {
    const longDiff = 'a'.repeat(10000);
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(longDiff, { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchPrDiff({
      diffUrl: 'https://api.github.com/repos/owner/repo/pulls/1.diff',
      githubToken: 'ghp_test123',
    });

    expect(result.diffLength).toBe(10000);
    expect(result.trimmedDiff.length).toBe(8000);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/pulls/1.diff',
      {
        headers: {
          Authorization: 'Bearer ghp_test123',
          Accept: 'application/vnd.github.v3.diff',
          'User-Agent': 'cloudflare-workers-github-oauth-1',
        },
      }
    );

    vi.unstubAllGlobals();
  });

  it('8000文字以下のdiffはそのまま返す', async () => {
    const shortDiff = 'diff --git a/file.ts\n+added line';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(shortDiff, { status: 200 })
    ));

    const result = await fetchPrDiff({
      diffUrl: 'https://api.github.com/repos/owner/repo/pulls/1.diff',
      githubToken: 'ghp_test123',
    });

    expect(result.diffLength).toBe(shortDiff.length);
    expect(result.trimmedDiff).toBe(shortDiff);

    vi.unstubAllGlobals();
  });

  it('HTTPエラー時にエラーをthrowする', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('Not Found', { status: 404, statusText: 'Not Found' })
    ));

    await expect(fetchPrDiff({
      diffUrl: 'https://api.github.com/repos/owner/repo/pulls/1.diff',
      githubToken: 'ghp_test123',
    })).rejects.toThrow('Diff fetch failed: 404 Not Found');

    vi.unstubAllGlobals();
  });

  it('ネットワークエラー時にエラーをthrowする', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await expect(fetchPrDiff({
      diffUrl: 'https://api.github.com/repos/owner/repo/pulls/1.diff',
      githubToken: 'ghp_test123',
    })).rejects.toThrow('Network error');

    vi.unstubAllGlobals();
  });
});

// ---- generateAiSummary ----

describe('generateAiSummary', () => {
  const baseParams = {
    model: '@cf/meta/llama-3.1-8b-instruct-fp8',
    title: 'Add login feature',
    description: 'Implements GitHub OAuth login',
    trimmedDiff: '',
  };

  function makeAi(response: unknown): AiBinding {
    return { run: vi.fn().mockResolvedValue(response) };
  }

  it('正常なレスポンスからsummaryを返す', async () => {
    const ai = makeAi({ response: '概要: ログイン機能を追加' });
    const result = await generateAiSummary({ ...baseParams, ai });

    expect(result).toBe('概要: ログイン機能を追加');
  });

  it('diffありの場合、プロンプトに差分が含まれる', async () => {
    const ai = makeAi({ response: '要約テスト' });
    await generateAiSummary({
      ...baseParams,
      ai,
      trimmedDiff: 'diff --git a/file.ts',
    });

    const call = (ai.run as ReturnType<typeof vi.fn>).mock.calls[0];
    const userContent = call[1].messages[1].content as string;
    expect(userContent).toContain('差分:\ndiff --git a/file.ts');
  });

  it('diffなしの場合、プロンプトに差分が含まれない', async () => {
    const ai = makeAi({ response: '要約テスト' });
    await generateAiSummary({ ...baseParams, ai, trimmedDiff: '' });

    const call = (ai.run as ReturnType<typeof vi.fn>).mock.calls[0];
    const userContent = call[1].messages[1].content as string;
    expect(userContent).not.toContain('差分:');
    expect(userContent).toContain('PRタイトル:\nAdd login feature');
    expect(userContent).toContain('説明:\nImplements GitHub OAuth login');
  });

  it('responseがnullの場合、AI_EMPTY_RESPONSEを返す', async () => {
    const ai = makeAi({ response: null });
    const result = await generateAiSummary({ ...baseParams, ai });

    expect(result).toMatch(/^\[AI_EMPTY_RESPONSE\]/);
    expect(result).toContain('response=null');
  });

  it('responseが空文字の場合、AI_EMPTY_RESPONSEを返す', async () => {
    const ai = makeAi({ response: '' });
    const result = await generateAiSummary({ ...baseParams, ai });

    expect(result).toMatch(/^\[AI_EMPTY_RESPONSE\]/);
  });

  it('responseフィールドがないオブジェクトの場合、AI_UNEXPECTED_FORMATを返す', async () => {
    const ai = makeAi({ result: 'something' });
    const result = await generateAiSummary({ ...baseParams, ai });

    expect(result).toMatch(/^\[AI_UNEXPECTED_FORMAT\]/);
    expect(result).toContain('"result":"something"');
  });

  it('nullが返された場合、AI_UNEXPECTED_FORMATを返す', async () => {
    const ai = makeAi(null);
    const result = await generateAiSummary({ ...baseParams, ai });

    expect(result).toMatch(/^\[AI_UNEXPECTED_FORMAT\]/);
  });

  it('文字列が返された場合、AI_UNEXPECTED_FORMATを返す', async () => {
    const ai = makeAi('plain string response');
    const result = await generateAiSummary({ ...baseParams, ai });

    expect(result).toMatch(/^\[AI_UNEXPECTED_FORMAT\]/);
  });

  it('ai.runがthrowした場合、そのままthrowする', async () => {
    const ai: AiBinding = {
      run: vi.fn().mockRejectedValue(new Error('Model not found')),
    };

    await expect(
      generateAiSummary({ ...baseParams, ai })
    ).rejects.toThrow('Model not found');
  });
});

// ---- buildSlackMessage ----

describe('buildSlackMessage', () => {
  const baseParams = {
    prAction: 'opened',
    prNumber: 42,
    title: 'Fix bug',
    repoFullName: 'owner/repo',
    author: 'testuser',
    prUrl: 'https://github.com/owner/repo/pull/42',
    summary: '概要: バグ修正',
    dailySeq: 3,
    requestId: 'abc-123',
  };

  it('openedの場合「作成」と表示される', () => {
    const msg = buildSlackMessage(baseParams);
    expect(msg).toContain('*PR 作成:* #42 Fix bug');
  });

  it('synchronizeの場合「更新」と表示される', () => {
    const msg = buildSlackMessage({ ...baseParams, prAction: 'synchronize' });
    expect(msg).toContain('*PR 更新:* #42 Fix bug');
  });

  it('summaryがある場合、AI要約セクションが含まれる', () => {
    const msg = buildSlackMessage(baseParams);
    expect(msg).toContain('*AI要約:*');
    expect(msg).toContain('概要: バグ修正');
  });

  it('summaryが空文字の場合、AI要約セクションが含まれない', () => {
    const msg = buildSlackMessage({ ...baseParams, summary: '' });
    expect(msg).not.toContain('*AI要約:*');
  });

  it('[AI_ERROR]で始まるsummaryの場合、AI要約セクションが含まれない', () => {
    const msg = buildSlackMessage({
      ...baseParams,
      summary: '[AI_ERROR] Model not found',
    });
    expect(msg).not.toContain('*AI要約:*');
    expect(msg).not.toContain('[AI_ERROR]');
  });

  it('[AI_UNEXPECTED_FORMAT]で始まるsummaryの場合、AI要約セクションが含まれない', () => {
    const msg = buildSlackMessage({
      ...baseParams,
      summary: '[AI_UNEXPECTED_FORMAT] type=string',
    });
    expect(msg).not.toContain('*AI要約:*');
  });

  it('[AI_EMPTY_RESPONSE]で始まるsummaryの場合、AI要約セクションが含まれない', () => {
    const msg = buildSlackMessage({
      ...baseParams,
      summary: '[AI_EMPTY_RESPONSE] keys=response',
    });
    expect(msg).not.toContain('*AI要約:*');
  });

  it('リポジトリ名・作成者・URL・フッターが含まれる', () => {
    const msg = buildSlackMessage(baseParams);
    expect(msg).toContain('リポジトリ: owner/repo');
    expect(msg).toContain('作成者: testuser');
    expect(msg).toContain('https://github.com/owner/repo/pull/42');
    expect(msg).toContain('_AI問い合わせ #3 (本日) | ID: abc-123_');
  });
});
