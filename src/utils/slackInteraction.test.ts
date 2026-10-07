import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSlackInteraction, SLACK_AI_REPLY_CALLBACK_ID, type InteractionDeps } from './slackInteraction';
import { DEFAULT_AI_MODEL } from './aiSummary';

vi.mock('./slack', () => ({
  openSlackModal: vi.fn(),
  respondToInteraction: vi.fn(),
}));

import { openSlackModal, respondToInteraction } from './slack';

const mockedOpenModal = vi.mocked(openSlackModal);
const mockedRespondToInteraction = vi.mocked(respondToInteraction);

const SIGNING_SECRET = 'test-secret';
const SLACK_TOKEN = 'xoxb-test-token';

const sampleRow = {
  request_id: 'req-001',
  daily_seq: 1,
  event_date: '2026-03-24',
  repo_full_name: 'owner/repo',
  pr_number: 42,
  pr_action: 'opened',
  pr_url: 'https://github.com/owner/repo/pull/42',
  model: DEFAULT_AI_MODEL,
  summary: '概要: テスト',
  diff_length: 500,
  created_at: '2026-03-24T10:00:00Z',
};

function buildPayload(overrides: Record<string, any> = {}): string {
  const payload = {
    type: 'block_actions',
    user: { id: 'U123' },
    trigger_id: 'trigger-123',
    response_url: 'https://hooks.slack.com/actions/T00/B00/xxx',
    actions: [
      {
        action_id: 'view_ai_summary_detail',
        value: 'req-001',
      },
    ],
    ...overrides,
  };
  return `payload=${encodeURIComponent(JSON.stringify(payload))}`;
}

function makeDeps(overrides: Partial<InteractionDeps> = {}): InteractionDeps {
  return {
    signingSecret: SIGNING_SECRET,
    slackToken: SLACK_TOKEN,
    rawBody: buildPayload(),
    timestamp: '1711300000',
    signature: 'v0=abc',
    dbQuery: vi.fn().mockResolvedValue(sampleRow),
    logStep: vi.fn().mockResolvedValue(undefined),
    verifySignature: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

describe('handleSlackInteraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedOpenModal.mockResolvedValue({ ok: true, status: 200 });
    mockedRespondToInteraction.mockResolvedValue({ ok: true, status: 200 });
  });

  it('正常系: openSlackModalに正しいtrigger_idと有効なモーダルviewが渡される', async () => {
    const deps = makeDeps();
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toEqual([
      'received', 'body_read', 'sig_ok', 'parsed', 'action_matched', 'db_hit', 'modal_ok',
    ]);

    expect(mockedOpenModal).toHaveBeenCalledTimes(1);
    const call = mockedOpenModal.mock.calls[0][0];
    expect(call.token).toBe(SLACK_TOKEN);
    expect(call.triggerId).toBe('trigger-123');

    const view = call.view;
    expect(view.type).toBe('modal');
    expect(view.title.type).toBe('plain_text');
    expect(view.title.text.length).toBeLessThanOrEqual(24);
    expect(view.blocks.length).toBeGreaterThan(0);

    const allBlockText = JSON.stringify(view.blocks);
    expect(allBlockText).toContain('owner/repo');
    expect(allBlockText).toContain('#42');
    expect(allBlockText).toContain('概要: テスト');
  });

  it('正常系: dbQueryにペイロードのrequestIdが渡される', async () => {
    const deps = makeDeps();
    await handleSlackInteraction(deps);

    expect(deps.dbQuery).toHaveBeenCalledWith('req-001');
  });

  it('正常系: verifySignatureに正しい引数が渡される', async () => {
    const deps = makeDeps();
    await handleSlackInteraction(deps);

    expect(deps.verifySignature).toHaveBeenCalledWith(
      deps.rawBody, '1711300000', 'v0=abc', SIGNING_SECRET,
    );
  });

  it('SLACK_SIGNING_SECRET未設定の場合、errorステップで終了する', async () => {
    const deps = makeDeps({ signingSecret: undefined });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('error');
    expect(mockedOpenModal).not.toHaveBeenCalled();
  });

  it('署名検証失敗の場合、401を返しsig_failステップで終了する', async () => {
    const deps = makeDeps({
      verifySignature: vi.fn().mockResolvedValue({ success: false, reason: 'Signature mismatch' }),
    });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(401);
    expect(result.steps).toContain('sig_fail');
    expect(mockedOpenModal).not.toHaveBeenCalled();
  });

  it('payloadフィールドが無い場合、errorステップで終了する', async () => {
    const deps = makeDeps({ rawBody: 'no-payload-here=true' });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('error');
  });

  it('payloadのJSONパースに失敗した場合、errorステップで終了する', async () => {
    const deps = makeDeps({ rawBody: 'payload=not-valid-json' });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('error');
  });

  it('block_actions以外のtypeの場合、skipステップで終了する', async () => {
    const deps = makeDeps({ rawBody: buildPayload({ type: 'view_submission' }) });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('skip');
  });

  it('action_idが一致しない場合、skipステップで終了する', async () => {
    const deps = makeDeps({
      rawBody: buildPayload({ actions: [{ action_id: 'other_action', value: 'x' }] }),
    });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('skip');
  });

  it('trigger_idが無い場合、errorステップで終了する', async () => {
    const deps = makeDeps({
      rawBody: buildPayload({ trigger_id: undefined }),
    });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('error');
  });

  it('SOT未設定の場合、errorステップで終了する', async () => {
    const deps = makeDeps({ slackToken: undefined });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('error');
    expect(mockedOpenModal).not.toHaveBeenCalled();
  });

  it('DBにデータが無い場合、response_urlに「見つかりません」メッセージを送る', async () => {
    const deps = makeDeps({ dbQuery: vi.fn().mockResolvedValue(null) });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('db_miss');
    expect(mockedOpenModal).not.toHaveBeenCalled();
    expect(mockedRespondToInteraction).toHaveBeenCalledTimes(1);
    const call = mockedRespondToInteraction.mock.calls[0][0];
    expect(call.responseUrl).toBe('https://hooks.slack.com/actions/T00/B00/xxx');
    expect(call.text).toContain('req-001');
  });

  it('モーダル表示失敗時、response_urlにフォールバックとしてPR情報・要約を含むメッセージを送る', async () => {
    mockedOpenModal.mockResolvedValue({ ok: false, status: 500, error: 'internal_error' });
    const deps = makeDeps();
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('modal_fail');
    expect(result.steps).toContain('fallback');
    expect(mockedRespondToInteraction).toHaveBeenCalledTimes(1);
    const call = mockedRespondToInteraction.mock.calls[0][0];
    expect(call.responseUrl).toBe('https://hooks.slack.com/actions/T00/B00/xxx');
    expect(call.text).toContain('PR #42');
    expect(call.text).toContain('概要: テスト');
    expect(call.blocks).toBeDefined();
    expect(call.blocks!.length).toBeGreaterThan(0);
  });

  it('モーダル表示失敗かつresponse_url無しの場合、フォールバックを送らない', async () => {
    mockedOpenModal.mockResolvedValue({ ok: false, status: 500, error: 'internal_error' });
    const deps = makeDeps({
      rawBody: buildPayload({ response_url: undefined }),
    });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('modal_fail');
    expect(result.steps).not.toContain('fallback');
    expect(mockedRespondToInteraction).not.toHaveBeenCalled();
  });

  it('DB例外発生時、exceptionステップで終了し200を返す', async () => {
    const deps = makeDeps({
      dbQuery: vi.fn().mockRejectedValue(new Error('D1 connection failed')),
    });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('exception');
  });

  it('open_ai_summary_html アクションはskipされる（URL型ボタンで直接遷移するため）', async () => {
    const deps = makeDeps({
      rawBody: buildPayload({
        actions: [{ action_id: 'open_ai_summary_html', value: 'req-001' }],
      }),
    });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('skip');
    expect(mockedOpenModal).not.toHaveBeenCalled();
  });

  // ---- message_action (メッセージショートカット) によるAI応答依頼 ----

  function buildMessageActionPayload(overrides: Record<string, any> = {}): string {
    const payload = {
      type: 'message_action',
      callback_id: SLACK_AI_REPLY_CALLBACK_ID,
      team: { id: 'T123' },
      channel: { id: 'C999' },
      message: { text: '<@U_ADMIN> 今日の天気は？', ts: '1700000000.000100' },
      ...overrides,
    };
    return `payload=${encodeURIComponent(JSON.stringify(payload))}`;
  }

  it('message_actionでcallback_idが一致する場合、aiReplyTaskを返す（実処理は呼び出し元でwaitUntilする）', async () => {
    const deps = makeDeps({ rawBody: buildMessageActionPayload() });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.aiReplyTask).toEqual({
      text: '<@U_ADMIN> 今日の天気は？',
      channel: 'C999',
      threadTs: '1700000000.000100',
      teamId: 'T123',
    });
    expect(mockedOpenModal).not.toHaveBeenCalled();
  });

  it('message_actionでメッセージが既にスレッド内の場合、thread_tsを優先する（親スレッドに返信）', async () => {
    const deps = makeDeps({
      rawBody: buildMessageActionPayload({
        message: { text: 'hi', ts: '1700000000.000200', thread_ts: '1700000000.000100' },
      }),
    });
    const result = await handleSlackInteraction(deps);

    expect(result.aiReplyTask?.threadTs).toBe('1700000000.000100');
  });

  it('message_actionでcallback_idが一致しない場合はskipし、aiReplyTaskを返さない', async () => {
    const deps = makeDeps({
      rawBody: buildMessageActionPayload({ callback_id: 'other_shortcut' }),
    });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('skip');
    expect(result.aiReplyTask).toBeUndefined();
  });

  it('message_actionでmessage/channelが欠落している場合はerrorステップで終了し、aiReplyTaskを返さない', async () => {
    const deps = makeDeps({
      rawBody: buildMessageActionPayload({ channel: undefined }),
    });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('error');
    expect(result.aiReplyTask).toBeUndefined();
  });

  it('message_actionも署名検証に失敗すれば401を返す', async () => {
    const deps = makeDeps({
      rawBody: buildMessageActionPayload(),
      verifySignature: vi.fn().mockResolvedValue({ success: false, reason: 'bad sig' }),
    });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(401);
    expect(result.aiReplyTask).toBeUndefined();
  });

  // ---- Slack API制約テスト: openSlackModalに渡されるviewの構造検証 ----

  it('制約: openSlackModalに渡されるviewのtitleが24文字以下', async () => {
    const deps = makeDeps();
    await handleSlackInteraction(deps);

    const call = mockedOpenModal.mock.calls[0][0];
    expect(call.view.title.text.length).toBeLessThanOrEqual(24);
  });

  it('制約: モーダル内にactionsブロックが存在しない（url付きボタンはモーダルで動作しない）', async () => {
    const deps = makeDeps();
    await handleSlackInteraction(deps);

    const call = mockedOpenModal.mock.calls[0][0];
    const actionsBlock = call.view.blocks.find((b: any) => b.type === 'actions');
    expect(actionsBlock, 'モーダル内にactionsブロックがある').toBeUndefined();
  });

  it('制約: HTMLで表示がmrkdwnリンクとしてcontextブロック内に存在する', async () => {
    const deps = makeDeps();
    await handleSlackInteraction(deps);

    const call = mockedOpenModal.mock.calls[0][0];
    const allText = JSON.stringify(call.view.blocks);
    expect(allText).toContain('/ai-summary/req-001');
    expect(allText).toContain('HTMLで表示');
    expect(allText).not.toContain('#eyJ');
  });

  it('制約: モーダルfallback時もtextに要約情報が含まれる（握りつぶし防止）', async () => {
    mockedOpenModal.mockResolvedValue({ ok: false, status: 500, error: 'internal_error' });
    const deps = makeDeps();
    await handleSlackInteraction(deps);

    const call = mockedRespondToInteraction.mock.calls[0][0];
    expect(call.text.length, 'フォールバックtextが空').toBeGreaterThan(0);
    expect(call.text).toContain('概要: テスト');
  });
});

 describe('tsubuyaki interactive sample', () => {
  it.each(['understood', 'thanks'])('署名検証後に%sの応答をバックグラウンド送信用に返す', async (value) => {
    const deps = makeDeps({ slackToken: undefined, rawBody: buildPayload({ actions: [{
      action_id: 'tsubuyaki_sample_reaction_' + value, value,
    }] }) });
    const result = await handleSlackInteraction(deps);
    expect(result.status).toBe(200);
    expect(result.sampleResponse?.responseUrl).toBe('https://hooks.slack.com/actions/T00/B00/xxx');
    expect(result.sampleResponse?.responseType).toBe('in_channel');
    expect(result.sampleResponse?.text).toContain('<@U123>');
    expect(result.sampleResponse?.text).toContain(value === 'thanks' ? 'ありがとう' : '確認しました');
    expect(deps.dbQuery).not.toHaveBeenCalled();
  });
  it('署名不正なクリックには応答を送信しない', async () => {
    const result = await handleSlackInteraction(makeDeps({
      rawBody: buildPayload({ actions: [{ action_id: 'tsubuyaki_sample_reaction_thanks', value: 'thanks' }] }),
      verifySignature: vi.fn().mockResolvedValue({ success: false }),
    }));
    expect(result.status).toBe(401);
    expect(result.sampleResponse).toBeUndefined();
  });
  it.each([undefined, 'http://hooks.slack.com/actions/x', 'https://example.com/actions/x', 'https://hooks.slack.com.evil.test/actions/x'])('無効な応答URL %s には送信しない', async (response_url) => {
    const result = await handleSlackInteraction(makeDeps({ rawBody: buildPayload({ response_url,
      actions: [{ action_id: 'tsubuyaki_sample_reaction_thanks', value: 'thanks' }],
    }) }));
    expect(result.sampleResponse).toBeUndefined();
  });
  it('不明な選択値にはサンプル応答を返さない', async () => {
    const result = await handleSlackInteraction(makeDeps({ rawBody: buildPayload({
      actions: [{ action_id: 'tsubuyaki_sample_reaction_thanks', value: 'unknown' }],
    }) }));
    expect(result.sampleResponse).toBeUndefined();
  });
});

it('通知の操作ユーザーが欠落している場合は送信しない', async () => {
  const result = await handleSlackInteraction(makeDeps({ rawBody: buildPayload({ user: undefined,
    actions: [{ action_id: 'tsubuyaki_sample_reaction_thanks', value: 'thanks' }],
  }) }));
  expect(result.sampleResponse).toBeUndefined();
});
