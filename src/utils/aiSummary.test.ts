import { describe, it, expect, vi } from 'vitest';
import {
  fetchPrDiff,
  generateAiSummary,
  buildSlackMessage,
  classifySummaryResult,
  runSummaryPipeline,
  resolveAiModel,
  DEFAULT_AI_MODEL,
  type AiBinding,
  type SummaryDiagnosis,
} from './aiSummary';

// ---- resolveAiModel ----

describe('resolveAiModel', () => {
  it('環境変数が設定されていればそのモデル名を返す', () => {
    expect(resolveAiModel('@cf/google/gemma-3-12b-it')).toBe('@cf/google/gemma-3-12b-it');
  });

  it('環境変数がundefinedならデフォルトモデルを返す', () => {
    expect(resolveAiModel(undefined)).toBe(DEFAULT_AI_MODEL);
  });

  it('環境変数が空文字ならデフォルトモデルを返す', () => {
    expect(resolveAiModel('')).toBe(DEFAULT_AI_MODEL);
  });

  it('環境変数が空白のみならデフォルトモデルを返す', () => {
    expect(resolveAiModel('  ')).toBe(DEFAULT_AI_MODEL);
  });

  it('環境変数の前後空白はtrimされる', () => {
    expect(resolveAiModel('  @cf/meta/llama-3.3-70b-instruct-fp8-fast  ')).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
  });
});

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
    workerBaseUrl: 'https://cloudflare-workers-github-oauth-1.example.workers.dev',
  };

  it('openedの場合「作成」と表示される', () => {
    const msg = buildSlackMessage(baseParams);
    expect(msg).toContain('*PR 作成:* #42 Fix bug');
  });

  it('synchronizeの場合「更新」と表示される', () => {
    const msg = buildSlackMessage({ ...baseParams, prAction: 'synchronize' });
    expect(msg).toContain('*PR 更新:* #42 Fix bug');
  });

  it('summaryがある場合、AI要約がブロッククォートで囲まれる', () => {
    const msg = buildSlackMessage(baseParams);
    expect(msg).toContain('*AI要約:*');
    expect(msg).toContain('> 概要: バグ修正');
  });

  it('複数行のsummaryは各行がブロッククォートになる', () => {
    const msg = buildSlackMessage({ ...baseParams, summary: '概要: テスト\n変更点: 修正' });
    expect(msg).toContain('> 概要: テスト\n> 変更点: 修正');
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

  it('requestIdが詳細ページへのリンクになる', () => {
    const msg = buildSlackMessage(baseParams);
    expect(msg).toContain('<https://cloudflare-workers-github-oauth-1.example.workers.dev/api/ai-summary/abc-123|abc-123>');
  });

  it('workerBaseUrlが空の場合、リンクなしでIDのみ表示される', () => {
    const msg = buildSlackMessage({ ...baseParams, workerBaseUrl: '' });
    expect(msg).toContain('ID: abc-123');
    expect(msg).not.toContain('<https://');
  });

  it('リポジトリ名・作成者・URLが含まれる', () => {
    const msg = buildSlackMessage(baseParams);
    expect(msg).toContain('リポジトリ: owner/repo');
    expect(msg).toContain('作成者: testuser');
    expect(msg).toContain('https://github.com/owner/repo/pull/42');
  });
});

// ---- classifySummaryResult ----

describe('classifySummaryResult', () => {
  it('正常な要約はrating=good、hasSummary=trueを返し、文字数と抜粋を含む', () => {
    const summary = '## 概要\nログイン機能を追加\n## 主な変更点\nOAuthフロー実装\n## 影響範囲\n認証モジュール';
    const result = classifySummaryResult(summary);
    expect(result.rating).toBe('good');
    expect(result.hasSummary).toBe(true);
    expect(result.comment).toContain(`${summary.length}文字`);
    expect(result.comment).toContain('抜粋:');
    expect(result.comment).toContain('ログイン機能を追加');
  });

  it('正常な要約で概要・変更点・影響範囲セクションの有無を報告する', () => {
    const withAll = '## 概要\nテスト\n## 主な変更点\nテスト\n## 影響範囲\nテスト';
    const resultAll = classifySummaryResult(withAll);
    expect(resultAll.comment).toContain('概要');
    expect(resultAll.comment).toContain('変更点');
    expect(resultAll.comment).toContain('影響範囲');

    const withNone = 'これはただのテキストです。特にセクションはありません。';
    const resultNone = classifySummaryResult(withNone);
    expect(resultNone.rating).toBe('good');
    expect(resultNone.comment).toContain('セクション不足');
  });

  it('短すぎる要約はrating=good だがwarningを含む', () => {
    const result = classifySummaryResult('OK');
    expect(result.rating).toBe('good');
    expect(result.hasSummary).toBe(true);
    expect(result.comment).toContain('短い');
  });

  it('80文字超の要約は抜粋が省略記号で切られる', () => {
    const long = 'あ'.repeat(100);
    const result = classifySummaryResult(long);
    expect(result.comment).toContain('抜粋: ' + 'あ'.repeat(80) + '…');
  });

  it('空文字はrating=bad、hasSummary=falseを返す', () => {
    const result = classifySummaryResult('');
    expect(result.rating).toBe('bad');
    expect(result.hasSummary).toBe(false);
    expect(result.comment).toContain('空');
  });

  it('[AI_ERROR]はrating=bad、hasSummary=falseを返す', () => {
    const result = classifySummaryResult('[AI_ERROR] Model not found');
    expect(result.rating).toBe('bad');
    expect(result.hasSummary).toBe(false);
    expect(result.comment).toContain('AI_ERROR');
  });

  it('[AI_EMPTY_RESPONSE]はrating=bad、hasSummary=falseを返す', () => {
    const result = classifySummaryResult('[AI_EMPTY_RESPONSE] keys=response response=null');
    expect(result.rating).toBe('bad');
    expect(result.hasSummary).toBe(false);
    expect(result.comment).toContain('AI_EMPTY_RESPONSE');
  });

  it('[AI_UNEXPECTED_FORMAT]はrating=bad、hasSummary=falseを返す', () => {
    const result = classifySummaryResult('[AI_UNEXPECTED_FORMAT] type=string value="hello"');
    expect(result.rating).toBe('bad');
    expect(result.hasSummary).toBe(false);
    expect(result.comment).toContain('AI_UNEXPECTED_FORMAT');
  });

  it('AIバインディングなし（null summary）はrating=bad、hasSummary=falseを返す', () => {
    const result = classifySummaryResult(null);
    expect(result.rating).toBe('bad');
    expect(result.hasSummary).toBe(false);
    expect(result.comment).toContain('生成されなかった');
  });
});

// ---- runSummaryPipeline ----

describe('runSummaryPipeline', () => {
  const baseParams = {
    model: '@cf/meta/llama-3.1-8b-instruct-fp8',
    title: 'Add feature',
    description: 'New feature',
    trimmedDiff: '',
  };

  it('AIバインディングがnullの場合、AI_NO_BINDINGを返しsuccess=false', async () => {
    const result = await runSummaryPipeline({ ...baseParams, ai: null });
    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/^\[AI_NO_BINDING\]/);
  });

  it('AIバインディングがundefinedの場合、AI_NO_BINDINGを返しsuccess=false', async () => {
    const result = await runSummaryPipeline({ ...baseParams, ai: undefined });
    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/^\[AI_NO_BINDING\]/);
  });

  it('AI呼び出し成功時、summaryを返しsuccess=true', async () => {
    const ai: AiBinding = { run: vi.fn().mockResolvedValue({ response: '要約テスト' }) };
    const result = await runSummaryPipeline({ ...baseParams, ai });
    expect(result.success).toBe(true);
    expect(result.summary).toBe('要約テスト');
  });

  it('AI呼び出しが例外をthrowした場合、AI_ERRORを返しsuccess=false', async () => {
    const ai: AiBinding = { run: vi.fn().mockRejectedValue(new Error('Model overloaded')) };
    const result = await runSummaryPipeline({ ...baseParams, ai });
    expect(result.success).toBe(false);
    expect(result.summary).toBe('[AI_ERROR] Model overloaded');
  });

  it('AI呼び出しが例外をthrowした場合、エラーメッセージが握りつぶされない', async () => {
    const ai: AiBinding = { run: vi.fn().mockRejectedValue(new Error('InternalError: GPU timeout')) };
    const result = await runSummaryPipeline({ ...baseParams, ai });
    expect(result.summary).toContain('GPU timeout');
    expect(result.summary.length).toBeGreaterThan('[AI_ERROR] '.length);
  });

  it('AIがnullレスポンスを返した場合、AI_UNEXPECTED_FORMATを返しsuccess=false', async () => {
    const ai: AiBinding = { run: vi.fn().mockResolvedValue(null) };
    const result = await runSummaryPipeline({ ...baseParams, ai });
    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/^\[AI_UNEXPECTED_FORMAT\]/);
  });

  it('AIがresponse=nullを返した場合、AI_EMPTY_RESPONSEを返しsuccess=false', async () => {
    const ai: AiBinding = { run: vi.fn().mockResolvedValue({ response: null }) };
    const result = await runSummaryPipeline({ ...baseParams, ai });
    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/^\[AI_EMPTY_RESPONSE\]/);
  });

  it('AIがresponse=""を返した場合、AI_EMPTY_RESPONSEを返しsuccess=false', async () => {
    const ai: AiBinding = { run: vi.fn().mockResolvedValue({ response: '' }) };
    const result = await runSummaryPipeline({ ...baseParams, ai });
    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/^\[AI_EMPTY_RESPONSE\]/);
  });

  it('どのケースでもsummaryが空文字にならない（握りつぶし防止）', async () => {
    const cases: Array<{ label: string; ai: AiBinding | null }> = [
      { label: 'binding null', ai: null },
      { label: 'throw', ai: { run: vi.fn().mockRejectedValue(new Error('fail')) } },
      { label: 'null response', ai: { run: vi.fn().mockResolvedValue(null) } },
      { label: 'empty response', ai: { run: vi.fn().mockResolvedValue({ response: '' }) } },
      { label: 'null response field', ai: { run: vi.fn().mockResolvedValue({ response: null }) } },
      { label: 'no response field', ai: { run: vi.fn().mockResolvedValue({ result: 'x' }) } },
    ];

    for (const { label, ai } of cases) {
      const result = await runSummaryPipeline({ ...baseParams, ai });
      expect(result.summary, `"${label}" must not produce empty summary`).not.toBe('');
      expect(result.summary, `"${label}" must not produce null-like summary`).toBeTruthy();
      expect(result.success, `"${label}" must be success=false`).toBe(false);
    }
  });
});
