import { describe, it, expect, vi } from 'vitest';
import {
  fetchPrDiff,
  generateAiSummary,
  buildSlackMessage,
  buildSummaryModal,
  buildSummaryFallbackBlocks,
  classifySummaryResult,
  runSummaryPipeline,
  resolveAiModel,
  extractDesignDiff,
  sanitizeBoxDrawing,
  WORKER_BASE_URL,
  DEFAULT_AI_MODEL,
  type AiBinding,
  type SummaryDiagnosis,
  type SummaryModalRow,
  type SlackModalView,
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

  it('designSpecが指定された場合、プロンプトに初期設計チェックリストが含まれる', async () => {
    const ai = makeAi({ response: '要約テスト' });
    await generateAiSummary({
      ...baseParams,
      ai,
      designSpec: '1. OAuth認証\n2. Slack通知\n3. Resend webhook',
    });

    const call = (ai.run as ReturnType<typeof vi.fn>).mock.calls[0];
    const userContent = call[1].messages[1].content as string;
    expect(userContent).toContain('初期設計');
    expect(userContent).toContain('OAuth認証');
  });

  it('designSpecが未指定の場合、プロンプトに初期設計チェックリストが含まれない', async () => {
    const ai = makeAi({ response: '要約テスト' });
    await generateAiSummary({ ...baseParams, ai });

    const call = (ai.run as ReturnType<typeof vi.fn>).mock.calls[0];
    const userContent = call[1].messages[1].content as string;
    expect(userContent).not.toContain('初期設計');
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

  it('text と blocks の両方を返す', () => {
    const result = buildSlackMessage(baseParams);
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('blocks');
    expect(Array.isArray(result.blocks)).toBe(true);
  });

  it('text（フォールバック）にPR情報が含まれる', () => {
    const { text } = buildSlackMessage(baseParams);
    expect(text).toContain('PR 作成');
    expect(text).toContain('#42 Fix bug');
  });

  it('openedの場合「作成」と表示される', () => {
    const { text, blocks } = buildSlackMessage(baseParams);
    expect(text).toContain('PR 作成');
    const headerBlock = blocks.find((b: any) => b.type === 'section' && b.text?.text?.includes('PR 作成'));
    expect(headerBlock).toBeTruthy();
  });

  it('synchronizeの場合「更新」と表示される', () => {
    const { text } = buildSlackMessage({ ...baseParams, prAction: 'synchronize' });
    expect(text).toContain('PR 更新');
  });

  it('summaryがある場合、blocks にAI要約セクションが含まれる', () => {
    const { blocks } = buildSlackMessage(baseParams);
    const summaryBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('AI要約')
    );
    expect(summaryBlock).toBeTruthy();
  });

  it('summaryがコードブロックで囲まれる', () => {
    const { blocks } = buildSlackMessage(baseParams);
    const summaryBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('AI要約')
    ) as any;
    expect(summaryBlock?.text?.text).toContain('```');
    expect(summaryBlock?.text?.text).toContain('概要: バグ修正');
  });

  it('複数行のsummaryもコードブロック内に収まる', () => {
    const { blocks } = buildSlackMessage({ ...baseParams, summary: '概要: テスト\n変更点: 修正' });
    const summaryBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('AI要約')
    ) as any;
    const text = summaryBlock?.text?.text;
    expect(text).toContain('```');
    expect(text).toContain('概要: テスト\n変更点: 修正');
    // ブロッククォート(>)ではなくコードブロックであること
    expect(text).not.toContain('> 概要');
  });

  it('summaryが空文字の場合、AI要約セクションが含まれない', () => {
    const { blocks } = buildSlackMessage({ ...baseParams, summary: '' });
    const summaryBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('AI要約')
    );
    expect(summaryBlock).toBeUndefined();
  });

  it('[AI_ERROR]で始まるsummaryの場合、エラー通知セクションが表示される', () => {
    const { blocks, text } = buildSlackMessage({
      ...baseParams,
      summary: '[AI_ERROR] 5007: No such model llama-3.2-11b-vision-instruct or task',
    });
    const errorBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('AI要約エラー')
    ) as any;
    expect(errorBlock).toBeTruthy();
    expect(errorBlock.text.text).toContain('No such model');
    expect(text).toContain('AI要約エラー');
  });

  it('[AI_NO_BINDING]の場合もエラー通知セクションが表示される', () => {
    const { blocks } = buildSlackMessage({
      ...baseParams,
      summary: '[AI_NO_BINDING] Workers AI binding is not available',
    });
    const errorBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('AI要約エラー')
    ) as any;
    expect(errorBlock).toBeTruthy();
    expect(errorBlock.text.text).toContain('binding is not available');
  });

  it('[AI_*]エラーの場合、正常なAI要約セクションは含まれない', () => {
    const { blocks } = buildSlackMessage({
      ...baseParams,
      summary: '[AI_ERROR] Model not found',
    });
    const summaryBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('*AI要約:*')
    );
    expect(summaryBlock).toBeUndefined();
  });

  it('summaryがある場合、actionsブロックに「詳細を見る」ボタンが含まれる', () => {
    const { blocks } = buildSlackMessage(baseParams);
    const actionsBlock = blocks.find((b: any) => b.type === 'actions') as any;
    expect(actionsBlock).toBeTruthy();
    const btn = actionsBlock?.elements?.find((e: any) => e.action_id === 'view_ai_summary_detail');
    expect(btn?.type).toBe('button');
    expect(btn?.value).toBe('abc-123');
  });

  it('summaryが無い場合はactionsブロックが含まれない', () => {
    const { blocks } = buildSlackMessage({ ...baseParams, summary: '' });
    const actionsBlock = blocks.find((b: any) => b.type === 'actions');
    expect(actionsBlock).toBeUndefined();
  });

  it('[AI_*]エラーの場合、「詳細を見る」actionsブロックが含まれない', () => {
    const { blocks } = buildSlackMessage({ ...baseParams, summary: '[AI_ERROR] fail' });
    const actionsBlock = blocks.find((b: any) =>
      b.type === 'actions' && b.elements?.some((e: any) => e.action_id === 'view_ai_summary_detail')
    );
    expect(actionsBlock).toBeUndefined();
  });

  it('context ブロックにフッター情報が含まれる', () => {
    const { blocks } = buildSlackMessage(baseParams);
    const contextBlock = blocks.find((b: any) => b.type === 'context') as any;
    expect(contextBlock).toBeTruthy();
    const text = contextBlock?.elements?.[0]?.text;
    expect(text).toContain('AI問い合わせ #3');
    expect(text).toContain('abc-123');
  });

  it('designDiffが指定された場合、初期設計との差異セクションが表示される', () => {
    const { blocks } = buildSlackMessage({
      ...baseParams,
      designDiff: '達成: 3/5件\n- OAuth認証: 達成\n- Slack通知: 達成\n- Resend webhook: 達成\n- リポジトリ管理: 未着手\n- ダッシュボード: 未着手',
    });
    const designBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('初期設計との差異')
    );
    expect(designBlock).toBeTruthy();
  });

  it('designDiffがコードブロック内に収まる', () => {
    const { blocks } = buildSlackMessage({
      ...baseParams,
      designDiff: '達成: 3/5件',
    });
    const designBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('初期設計との差異')
    ) as any;
    expect(designBlock?.text?.text).toContain('```');
    expect(designBlock?.text?.text).toContain('達成: 3/5件');
  });

  it('designDiffが未指定の場合、初期設計との差異セクションが含まれない', () => {
    const { blocks } = buildSlackMessage(baseParams);
    const designBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('初期設計との差異')
    );
    expect(designBlock).toBeUndefined();
  });

  it('designDiffが空文字の場合、初期設計との差異セクションが含まれない', () => {
    const { blocks } = buildSlackMessage({ ...baseParams, designDiff: '' });
    const designBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('初期設計との差異')
    );
    expect(designBlock).toBeUndefined();
  });

  it('designDiffのtext（フォールバック）にも初期設計情報が含まれる', () => {
    const { text } = buildSlackMessage({
      ...baseParams,
      designDiff: '達成: 3/5件',
    });
    expect(text).toContain('初期設計との差異');
    expect(text).toContain('達成: 3/5件');
  });

  it('blocks内にURLリンク（<https://...>）が含まれない', () => {
    const { blocks } = buildSlackMessage(baseParams);
    const allText = JSON.stringify(blocks);
    expect(allText).not.toContain('<https://');
  });

  it('designDiffに罫線文字が含まれていても除去される', () => {
    const { blocks } = buildSlackMessage({
      ...baseParams,
      designDiff: '├── OAuth認証: 達成\n│   └── JWT: 達成\n└── Slack通知: 進行中',
    });
    const designBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('初期設計との差異')
    ) as any;
    const text = designBlock?.text?.text ?? '';
    expect(text).not.toMatch(/[│├└─┌┐┘┤┬┴┼]/);
    expect(text).toContain('OAuth認証: 達成');
    expect(text).toContain('Slack通知: 進行中');
  });

  it('designDiffのtextフォールバックでも罫線文字が除去される', () => {
    const { text } = buildSlackMessage({
      ...baseParams,
      designDiff: '├── OAuth認証: 達成\n└── Slack通知: 進行中',
    });
    expect(text).not.toMatch(/[│├└─┌┐┘┤┬┴┼]/);
    expect(text).toContain('OAuth認証: 達成');
  });

  it('summary本文に罫線文字が含まれていても除去される', () => {
    const { blocks } = buildSlackMessage({
      ...baseParams,
      summary: '├── 概要: 修正\n│   └── 詳細: テスト\n└── 影響: なし',
    });
    const summaryBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('AI要約')
    ) as any;
    const text = summaryBlock?.text?.text ?? '';
    expect(text).not.toMatch(/[│├└─┌┐┘┤┬┴┼]/);
    expect(text).toContain('概要: 修正');
    expect(text).toContain('影響: なし');
  });

  it('summaryのtextフォールバックでも罫線文字が除去される', () => {
    const { text } = buildSlackMessage({
      ...baseParams,
      summary: '├── 概要: 修正\n└── 影響: なし',
    });
    expect(text).not.toMatch(/[│├└─┌┐┘┤┬┴┼]/);
    expect(text).toContain('概要: 修正');
  });
});

// ---- sanitizeBoxDrawing ----

describe('sanitizeBoxDrawing', () => {
  it('罫線文字を除去する', () => {
    expect(sanitizeBoxDrawing('├── 項目A')).toBe('- 項目A');
    expect(sanitizeBoxDrawing('└── 項目B')).toBe('- 項目B');
    expect(sanitizeBoxDrawing('│   テスト')).toBe('  テスト');
  });

  it('複数行の罫線を除去する', () => {
    const input = '├── 項目A\n│   ├── サブ項目\n│   └── サブ項目2\n└── 項目B';
    const result = sanitizeBoxDrawing(input);
    expect(result).not.toMatch(/[│├└─┌┐┘┤┬┴┼]/);
    expect(result).toContain('- 項目A');
    expect(result).toContain('- 項目B');
  });

  it('罫線がない場合はそのまま返す', () => {
    const input = '- 項目A\n- 項目B';
    expect(sanitizeBoxDrawing(input)).toBe(input);
  });

  it('空文字を受け取ったらそのまま返す', () => {
    expect(sanitizeBoxDrawing('')).toBe('');
  });
});

// ---- buildSummaryModal ----

describe('buildSummaryModal', () => {
  const baseRow = {
    request_id: 'abc-123',
    daily_seq: 3,
    event_date: '2026-03-24',
    repo_full_name: 'owner/repo',
    pr_number: 42,
    pr_action: 'opened',
    pr_url: 'https://github.com/owner/repo/pull/42',
    model: '@cf/meta/llama-3.1-8b-instruct-fp8',
    summary: '## 概要\nバグを修正しました\n## 主な変更点\n認証ロジックの修正\n## 影響範囲\n全認証フロー',
    diff_length: 1234,
    created_at: '2026-03-24T10:00:00Z',
  };

  it('type が modal である', () => {
    const modal = buildSummaryModal(baseRow);
    expect(modal.type).toBe('modal');
  });

  it('title が「要約を表示」である', () => {
    const modal = buildSummaryModal(baseRow);
    expect(modal.title.text).toBe('要約を表示');
  });

  it('メタ情報がcontextブロックでラベル付き表示される', () => {
    const modal = buildSummaryModal(baseRow);
    const contexts = modal.blocks.filter((b: any) => b.type === 'context');
    const allContextText = JSON.stringify(contexts);
    expect(allContextText).toContain('リポジトリ :');
    expect(allContextText).toContain('owner/repo');
    expect(allContextText).toContain('PR番号 :');
    expect(allContextText).toContain('#42');
    expect(allContextText).toContain('モデル@cf :');
    expect(allContextText).toContain('diff :');
    expect(allContextText).toContain('要約回 :');
    expect(allContextText).toContain('llama-3.1-8b');
    expect(allContextText).toContain('1234');
    expect(allContextText).toContain('#3');
  });

  it('PR URLがリンクとして含まれる', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('<https://github.com/owner/repo/pull/42|#42>');
  });

  it('blocks に要約テキストが含まれる', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('バグを修正しました');
    expect(allText).toContain('認証ロジックの修正');
  });

  it('summary が null の場合「要約なし」と表示する', () => {
    const modal = buildSummaryModal({ ...baseRow, summary: null });
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('要約なし');
  });

  it('メタ情報にevent_dateが含まれる', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('2026-03-24');
  });

  it('dividerブロックが含まれる', () => {
    const modal = buildSummaryModal(baseRow);
    const divider = modal.blocks.find((b: any) => b.type === 'divider');
    expect(divider).toBeTruthy();
  });

  it('「HTMLで表示」がcontextブロック内のmrkdwnリンクとして存在する', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('HTMLで表示');
    expect(allText).toContain('/ai-summary/abc-123');
    const actionsBlock = modal.blocks.find((b: any) => b.type === 'actions');
    expect(actionsBlock).toBeUndefined();
  });

  it('要約テキストの罫線文字がsanitizeされている', () => {
    const rowWithBoxChars = {
      ...baseRow,
      summary: '## 概要\n├── 項目A\n│   └── サブ項目\n└── 項目B',
    };
    const modal = buildSummaryModal(rowWithBoxChars);
    const allText = JSON.stringify(modal.blocks);
    expect(allText).not.toMatch(/[│├└─┌┐┘┤┬┴┼]/);
    expect(allText).toContain('項目A');
    expect(allText).toContain('項目B');
  });

  it('closeボタンのテキストが「閉じる」である', () => {
    const modal = buildSummaryModal(baseRow);
    expect(modal.close).toEqual({ type: 'plain_text', text: '閉じる' });
  });

  // ---- summary null + diff_length 0 のハンドリング ----

  it('summary null かつ diff_length 0 のとき、diff取得失敗の説明が表示される', () => {
    const modal = buildSummaryModal({ ...baseRow, summary: null, diff_length: 0 });
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('差分を取得できなかった');
  });

  it('summary null かつ diff_length 0 のとき、要約なしの文言が表示される', () => {
    const modal = buildSummaryModal({ ...baseRow, summary: null, diff_length: 0 });
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('要約なし');
  });

  it('summary null かつ diff_length が正の値のとき、diff取得失敗の説明は表示されない', () => {
    const modal = buildSummaryModal({ ...baseRow, summary: null, diff_length: 500 });
    const allText = JSON.stringify(modal.blocks);
    expect(allText).not.toContain('差分を取得できなかった');
    expect(allText).toContain('要約なし');
  });
});


// ---- extractDesignDiff ----

describe('extractDesignDiff', () => {
  it('「初期設計との差異」セクションがある場合、summaryとdesignDiffに分離される', () => {
    const raw = '## 概要\nバグ修正\n## 主な変更点\n認証修正\n## 初期設計との差異\n達成: 3/5件';
    const result = extractDesignDiff(raw);
    expect(result.summary).toContain('バグ修正');
    expect(result.summary).not.toContain('達成: 3/5件');
    expect(result.designDiff).toContain('達成: 3/5件');
  });

  it('「初期設計との差異」セクションがない場合、summaryはそのまま、designDiffは空', () => {
    const raw = '## 概要\nバグ修正\n## 主な変更点\n認証修正';
    const result = extractDesignDiff(raw);
    expect(result.summary).toBe(raw);
    expect(result.designDiff).toBe('');
  });

  it('- 初期設計との差異 の形式でもマッチする', () => {
    const raw = '概要: テスト\n- 初期設計との差異\n5/10件達成';
    const result = extractDesignDiff(raw);
    expect(result.designDiff).toContain('5/10件達成');
  });

  it('空文字のsummaryはそのまま返す', () => {
    const result = extractDesignDiff('');
    expect(result.summary).toBe('');
    expect(result.designDiff).toBe('');
  });
});

// ---- classifySummaryResult ----

describe('classifySummaryResult', () => {
  it('正常な要約はrating=good、hasSummary=trueを返し、commentに要約そのものが入る', () => {
    const summary = '## 概要\nログイン機能を追加\n## 主な変更点\nOAuthフロー実装\n## 影響範囲\n認証モジュール';
    const result = classifySummaryResult(summary);
    expect(result.rating).toBe('good');
    expect(result.hasSummary).toBe(true);
    expect(result.comment).toBe(summary);
  });

  it('短い要約でもcommentは要約そのもの', () => {
    const result = classifySummaryResult('OK');
    expect(result.rating).toBe('good');
    expect(result.hasSummary).toBe(true);
    expect(result.comment).toBe('OK');
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

// ==================================================================
// Slack Block Kit 制約テスト — 過去のリグレッションを二度と起こさないための不変条件
// ==================================================================
// 背景:
//   1. モーダル内のボタンに url プロパティを追加 → views.open が無言で失敗しモーダルが壊れた
//   2. リンクURLを base64 ハッシュフラグメントに変更 → 巨大で醜いURLになりページも壊れた
//   3. [AI_*] エラーを hasSummary=false として扱い要約セクション丸ごと非表示 → エラーが握りつぶされた

describe('Slack Block Kit 制約: buildSummaryModal', () => {
  const baseRow: SummaryModalRow = {
    request_id: 'constraint-test-001',
    daily_seq: 5,
    event_date: '2026-03-27',
    repo_full_name: 'owner/repo',
    pr_number: 99,
    pr_action: 'opened',
    pr_url: 'https://github.com/owner/repo/pull/99',
    model: '@cf/meta/llama-3.1-8b-instruct-fp8',
    summary: '概要: テスト用要約\n変更点: なし\n影響: なし',
    diff_length: 2000,
    created_at: '2026-03-27T12:00:00Z',
  };

  function allBlocksFlat(modal: SlackModalView): Record<string, unknown>[] {
    return modal.blocks;
  }

  // ---- 制約1: モーダル内にactionsブロック（URLボタン）が存在しない ----
  // Slackモーダルではurl付きボタンが正常に動作しないため、mrkdwnリンクを使う。

  it('制約: モーダル内にactionsブロックが存在しない', () => {
    const modal = buildSummaryModal(baseRow);
    const actionsBlock = allBlocksFlat(modal).find((b) => b.type === 'actions');
    expect(actionsBlock, 'モーダル内にactionsブロックがある').toBeUndefined();
  });

  it('制約: HTMLで表示リンクが /ai-summary/{request_id} を指すmrkdwnリンクである', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain(`/ai-summary/${baseRow.request_id}|HTMLで表示`);
  });

  // ---- 制約2: URLにbase64ハッシュフラグメントが含まれない ----

  it('制約: HTMLで表示URLにハッシュフラグメント(#)が含まれない', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    const urlMatch = allText.match(/\/ai-summary\/[^"\\|>]+/);
    expect(urlMatch).toBeTruthy();
    expect(urlMatch![0]).not.toContain('#');
  });

  it('制約: HTMLで表示URLの長さが200文字以下である', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    const urlMatch = allText.match(/https:\/\/[^"\\]+\/ai-summary\/[^"\\]+/);
    expect(urlMatch).toBeTruthy();
    expect(urlMatch![0].length, 'URLが長すぎる（base64埋め込み等の兆候）').toBeLessThanOrEqual(200);
  });

  // ---- 制約3: モーダルのtitleは24文字以下 (Slack API制限) ----

  it('制約: モーダルtitleが24文字以下', () => {
    const modal = buildSummaryModal(baseRow);
    expect(modal.title.text.length).toBeLessThanOrEqual(24);
  });

  // ---- 制約4: モーダルのblocks内sectionテキストが3000文字以下 (Slack API制限) ----

  it('制約: 各sectionブロックのtextが3000文字以下', () => {
    const longSummary = 'A'.repeat(2500);
    const modal = buildSummaryModal({ ...baseRow, summary: longSummary });
    for (const block of allBlocksFlat(modal)) {
      if (block.type === 'section') {
        const textObj = block.text as { text: string };
        expect(textObj.text.length, 'Slack section text は3000文字が上限').toBeLessThanOrEqual(3000);
      }
    }
  });

  // ---- 制約5: 全ブロックのtypeが有効なSlack Block Kit型である ----

  it('制約: 全ブロックのtypeがSlack Block Kitで有効な型である', () => {
    const validTypes = ['section', 'divider', 'context', 'actions', 'image', 'header', 'input', 'file'];
    const modal = buildSummaryModal(baseRow);
    for (const block of allBlocksFlat(modal)) {
      expect(validTypes, `不正なblock type: ${block.type}`).toContain(block.type);
    }
  });

  // ---- 制約6: contextブロックのelementsは10個以下 (Slack API制限) ----

  it('制約: contextブロックのelements数が10以下', () => {
    const modal = buildSummaryModal(baseRow);
    for (const block of allBlocksFlat(modal)) {
      if (block.type === 'context') {
        const elements = block.elements as unknown[];
        expect(elements.length, 'Slack context block は elements 最大10個').toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('Slack Block Kit 制約: buildSlackMessage', () => {
  const baseParams = {
    prAction: 'opened',
    prNumber: 42,
    title: 'Fix bug',
    repoFullName: 'owner/repo',
    author: 'testuser',
    prUrl: 'https://github.com/owner/repo/pull/42',
    summary: '概要: バグ修正\n変更点: 認証修正\n影響: 全体',
    dailySeq: 3,
    requestId: 'msg-constraint-001',
  };

  // ---- 制約: [AI_*]エラー時にエラー情報が表示されること (握りつぶし防止) ----

  const aiErrorCases = [
    { label: 'AI_ERROR (モデル不在)', summary: '[AI_ERROR] 5007: No such model llama-3.2-11b-vision-instruct or task' },
    { label: 'AI_NO_BINDING', summary: '[AI_NO_BINDING] Workers AI binding is not available' },
    { label: 'AI_EMPTY_RESPONSE', summary: '[AI_EMPTY_RESPONSE] keys=response response=null' },
    { label: 'AI_UNEXPECTED_FORMAT', summary: '[AI_UNEXPECTED_FORMAT] type=string value="hello"' },
  ];

  for (const { label, summary } of aiErrorCases) {
    it(`制約: ${label} がSlack通知で可視化される（blocksにエラー情報が含まれる）`, () => {
      const result = buildSlackMessage({ ...baseParams, summary });
      const allBlockText = JSON.stringify(result.blocks);
      // エラーが存在する以上、blocks内にエラーに関する情報が必ず表示されること
      expect(allBlockText, `${label} がblocksから消えている＝握りつぶし`).toContain('AI要約エラー');
    });

    it(`制約: ${label} がtextフォールバックでも可視化される`, () => {
      const result = buildSlackMessage({ ...baseParams, summary });
      expect(result.text, `${label} がtextから消えている`).toContain('AI要約エラー');
    });

    it(`制約: ${label} のとき正常要約セクション(*AI要約:*)が表示されない`, () => {
      const result = buildSlackMessage({ ...baseParams, summary });
      const summaryBlock = result.blocks.find((b: any) =>
        b.type === 'section' && (b.text as any)?.text?.includes('*AI要約:*')
      );
      expect(summaryBlock, `${label} なのに正常要約セクションが表示されている`).toBeUndefined();
    });
  }

  // ---- 制約: 正常要約時にactionsブロックの「詳細を見る」ボタンが存在する ----

  it('制約: 正常要約時に「詳細を見る」ボタンがactions内に存在する', () => {
    const result = buildSlackMessage(baseParams);
    const actionsBlock = result.blocks.find((b: any) => b.type === 'actions') as any;
    expect(actionsBlock, '正常要約なのにactionsブロックがない').toBeTruthy();
    const btn = actionsBlock.elements.find((e: any) => e.action_id === 'view_ai_summary_detail');
    expect(btn, '「詳細を見る」ボタンがない').toBeTruthy();
    expect(btn.type).toBe('button');
    // メッセージ内ボタンにはurlプロパティは不要（action_idでインタラクション処理する）
    expect(btn.value).toBe(baseParams.requestId);
  });

  // ---- 制約: 正常要約がコードブロックで囲まれている ----

  it('制約: 正常要約がコードブロック(```)で囲まれ、罫線文字を含まない', () => {
    const summaryWithBox = '├── 概要: 修正\n│   └── 詳細\n└── 影響: なし';
    const result = buildSlackMessage({ ...baseParams, summary: summaryWithBox });
    const summaryBlock = result.blocks.find((b: any) =>
      b.type === 'section' && (b.text as any)?.text?.includes('AI要約')
    ) as any;
    expect(summaryBlock).toBeTruthy();
    const text = summaryBlock.text.text as string;
    expect(text).toContain('```');
    expect(text).not.toMatch(/[│├└─┌┐┘┤┬┴┼]/);
  });

  // ---- 制約: 全ブロックのtypeが有効である ----

  it('制約: 全ブロックのtypeがSlack Block Kitで有効な型である', () => {
    const validTypes = ['section', 'divider', 'context', 'actions', 'image', 'header', 'input', 'file'];
    const result = buildSlackMessage(baseParams);
    for (const block of result.blocks) {
      expect(validTypes, `不正なblock type: ${block.type}`).toContain(block.type);
    }
  });
});

describe('Slack Block Kit 制約: buildSummaryFallbackBlocks', () => {
  const baseRow: SummaryModalRow = {
    request_id: 'fallback-test-001',
    daily_seq: 1,
    event_date: '2026-03-27',
    repo_full_name: 'owner/repo',
    pr_number: 10,
    pr_action: 'opened',
    pr_url: 'https://github.com/owner/repo/pull/10',
    model: '@cf/meta/llama-3.1-8b-instruct-fp8',
    summary: '概要: フォールバックテスト',
    diff_length: 100,
    created_at: '2026-03-27T12:00:00Z',
  };

  it('制約: textとblocksの両方が返される', () => {
    const result = buildSummaryFallbackBlocks(baseRow);
    expect(result.text).toBeTruthy();
    expect(result.blocks).toBeTruthy();
    expect(result.blocks.length).toBeGreaterThan(0);
  });

  it('制約: summary null + diff 0 のとき差分取得失敗の説明が表示される', () => {
    const result = buildSummaryFallbackBlocks({ ...baseRow, summary: null, diff_length: 0 });
    expect(result.text).toContain('差分を取得できなかった');
  });

  it('制約: summaryがnullでもtextが空にならない（握りつぶし防止）', () => {
    const result = buildSummaryFallbackBlocks({ ...baseRow, summary: null });
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.text).toContain('要約なし');
  });
});
