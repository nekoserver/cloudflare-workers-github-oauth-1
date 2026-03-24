import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSlackInteraction, type InteractionDeps } from './slackInteraction';

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
    mockedRespondToInteraction.mockResolvedValue({ ok: true, status: 200 });
  });

  it('正常系: 署名検証→ペイロード解析→DB取得→モーダル表示まで完走する', async () => {
    const deps = makeDeps();
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('sig_ok');
    expect(result.steps).toContain('parsed');
    expect(result.steps).toContain('action_matched');
    expect(result.steps).toContain('db_hit');
    expect(result.steps).toContain('modal_ok');
    expect(mockedOpenModal).toHaveBeenCalledTimes(1);
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

  it('DBにデータが無い場合、db_missステップでresponse_urlにメッセージを返す', async () => {
    const deps = makeDeps({ dbQuery: vi.fn().mockResolvedValue(null) });
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('db_miss');
    expect(mockedRespondToInteraction).toHaveBeenCalledTimes(1);
    expect(mockedOpenModal).not.toHaveBeenCalled();
  });

  it('モーダル表示失敗時、response_urlにフォールバックメッセージを送る', async () => {
    mockedOpenModal.mockResolvedValue({ ok: false, status: 500, error: 'internal_error' });
    const deps = makeDeps();
    const result = await handleSlackInteraction(deps);

    expect(result.status).toBe(200);
    expect(result.steps).toContain('modal_fail');
    expect(result.steps).toContain('fallback');
    expect(mockedRespondToInteraction).toHaveBeenCalledTimes(1);
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
});
