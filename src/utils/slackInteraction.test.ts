import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSlackInteraction, type InteractionDeps } from './slackInteraction';

vi.mock('./slack', () => ({
  openSlackModal: vi.fn(),
  updateSlackModal: vi.fn(),
  respondToInteraction: vi.fn(),
}));

import { openSlackModal, updateSlackModal, respondToInteraction } from './slack';

const mockedOpenModal = vi.mocked(openSlackModal);
const mockedUpdateModal = vi.mocked(updateSlackModal);
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
  model: '@cf/meta/llama-3.1-8b-instruct-fp8',
  summary: '概要: テスト',
  diff_length: 500,
  created_at: '2026-03-24T10:00:00Z',
};

function buildPayload(overrides: Record<string, any> = {}): string {
  const payload = {
    type: 'block_actions',
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
    mockedUpdateModal.mockResolvedValue({ ok: true, status: 200 });
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

  it('SLACK_OAUTH_TOKEN未設定の場合、errorステップで終了する', async () => {
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

  // ---- open_ai_summary_html アクション ----

  it('open_ai_summary_html: DB確認後にモーダルを更新してリンクを表示する', async () => {
    const deps = makeDeps({
      rawBody: buildPayload({
        actions: [{ action_id: 'open_ai_summary_html', value: 'req-001' }],
        view: { id: 'V123456' },
      }),
    });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('modal_updated');
    expect(mockedUpdateModal).toHaveBeenCalledTimes(1);
    const call = mockedUpdateModal.mock.calls[0][0];
    expect(call.viewId).toBe('V123456');
    expect(call.token).toBe(SLACK_TOKEN);
    const viewText = JSON.stringify(call.view.blocks);
    expect(viewText).toContain('/ai-summary/req-001');
    expect(viewText).toContain('HTMLで表示');
  });

  it('open_ai_summary_html: DBにデータがない場合、db_missで終了する', async () => {
    const deps = makeDeps({
      rawBody: buildPayload({
        actions: [{ action_id: 'open_ai_summary_html', value: 'req-001' }],
        view: { id: 'V123456' },
      }),
      dbQuery: vi.fn().mockResolvedValue(null),
    });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('db_miss');
    expect(mockedUpdateModal).not.toHaveBeenCalled();
  });

  it('open_ai_summary_html: viewIdがない場合、errorで終了する', async () => {
    const deps = makeDeps({
      rawBody: buildPayload({
        actions: [{ action_id: 'open_ai_summary_html', value: 'req-001' }],
        trigger_id: undefined,
      }),
    });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('error');
  });
});
