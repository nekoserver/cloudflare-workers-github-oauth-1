import { describe, it, expect, vi } from 'vitest';
import {
  fetchPrDiff,
  generateAiSummary,
  buildSlackMessage,
  buildSummaryModal,
  classifySummaryResult,
  runSummaryPipeline,
  resolveAiModel,
  extractDesignDiff,
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

  it('[AI_ERROR]で始まるsummaryの場合、AI要約セクションが含まれない', () => {
    const { blocks } = buildSlackMessage({
      ...baseParams,
      summary: '[AI_ERROR] Model not found',
    });
    const summaryBlock = blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('AI要約')
    );
    expect(summaryBlock).toBeUndefined();
  });

  it('「詳細を見る」ボタンが actions ブロックに含まれる', () => {
    const { blocks } = buildSlackMessage(baseParams);
    const actionsBlock = blocks.find((b: any) => b.type === 'actions') as any;
    expect(actionsBlock).toBeTruthy();
    const button = actionsBlock?.elements?.[0];
    expect(button?.type).toBe('button');
    expect(button?.action_id).toBe('view_ai_summary_detail');
    expect(button?.value).toBe('abc-123');
  });

  it('summaryが無い場合はボタンが含まれない', () => {
    const { blocks } = buildSlackMessage({ ...baseParams, summary: '' });
    const actionsBlock = blocks.find((b: any) => b.type === 'actions');
    expect(actionsBlock).toBeUndefined();
  });

  it('[AI_*]エラーの場合もボタンが含まれない', () => {
    const { blocks } = buildSlackMessage({ ...baseParams, summary: '[AI_ERROR] fail' });
    const actionsBlock = blocks.find((b: any) => b.type === 'actions');
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

  it('URLリンク（<https://...>）が blocks に含まれない', () => {
    const { blocks } = buildSlackMessage(baseParams);
    const allText = JSON.stringify(blocks);
    expect(allText).not.toContain('<https://');
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

  it('blocks にリポジトリ・PR番号が fields テーブルとして含まれる', () => {
    const modal = buildSummaryModal(baseRow);
    const fieldsBlock = modal.blocks.find((b: any) => b.type === 'section' && b.fields) as any;
    expect(fieldsBlock).toBeTruthy();
    const fieldsText = JSON.stringify(fieldsBlock.fields);
    expect(fieldsText).toContain('owner/repo');
    expect(fieldsText).toContain('#42');
  });

  it('PR URLがリンクとして含まれる', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('<https://github.com/owner/repo/pull/42|PR #42>');
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

  it('モデル・diff長・日時が含まれる', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('llama-3.1-8b');
    expect(allText).toContain('1234');
    expect(allText).toContain('2026-03-24T10:00:00Z');
  });

  it('要約セクションに「AI要約」ヘッダーがある', () => {
    const modal = buildSummaryModal(baseRow);
    const summaryBlock = modal.blocks.find((b: any) =>
      b.type === 'section' && b.text?.text?.includes('AI要約')
    );
    expect(summaryBlock).toBeTruthy();
  });

  // ---- テーブルリレーション一覧 ----

  it('「一覧」セクションが存在する', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('テーブル関連');
  });

  it('ai_summary_log テーブル名が含まれる', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('ai_summary_log');
  });

  it('ai_summary_reviews テーブル名が含まれる', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('ai_summary_reviews');
  });

  it('リレーションの矢印が含まれる', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('->');
  });

  it('request_id がリレーションキーとして表示される', () => {
    const modal = buildSummaryModal(baseRow);
    const allText = JSON.stringify(modal.blocks);
    expect(allText).toContain('request_id');
  });

  it('一覧セクションはAI要約セクションの後に表示される', () => {
    const modal = buildSummaryModal(baseRow);
    const summaryIdx = modal.blocks.findIndex((b: any) =>
      b.type === 'section' && b.text?.text?.includes('AI要約')
    );
    const relationIdx = modal.blocks.findIndex((b: any) =>
      b.type === 'section' && b.text?.text?.includes('テーブル関連')
    );
    expect(summaryIdx).toBeGreaterThanOrEqual(0);
    expect(relationIdx).toBeGreaterThan(summaryIdx);
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
