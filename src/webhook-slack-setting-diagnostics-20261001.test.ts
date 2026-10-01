import { describe, expect, it, vi } from 'vitest';
import {
  buildWebhookSettingChecks,
  extractRepositoryFromWebhookLogPayload,
  fetchCfAuthSettingChecks,
  toWebhookLogDisplayRows,
} from './utils/webhookSlackSettingDiagnostics';

// 対象: /wh-setting_github-to-slack ページ(新規)が使う診断ロジック。
// GitHub webhook → 通知先切替(NOTIFY_TARGET)→ Slack or cf-auth という設定が
// 揃っているかを、secretの値そのものは外部に出さず真偽値だけで可視化する。
//
// 故障シナリオ:
//   (1) notifyDispatch.tsのisNotifyConfigured()とロジックが食い違い、
//       ページ上の判定と実際の送信可否が一致しなくなる
//   (2) webhook_log.payloadが不正なJSON・repositoryフィールド無しの場合に
//       例外を投げ、ページ全体が落ちる
//   (3) NOTIFY_TARGETが'worker'以外の任意の文字列のとき'slack'扱いされず、
//       型として扱えない値になる

describe('buildWebhookSettingChecks', () => {
  it('NOTIFY_TARGET=workerのとき、workerUrlの有無だけでisNotifyConfiguredを判定する(slack設定は無視)', () => {
    const checks = buildWebhookSettingChecks({
      GITHUB_WEBHOOK_SECRET: 's',
      NOTIFY_TARGET: 'worker',
      NOTIFY_WORKER_URL: 'https://example.com/ingest',
      NOTIFY_WORKER_SECRET: 'secret',
    });
    expect(checks.notifyTarget).toBe('worker');
    expect(checks.isNotifyConfigured).toBe(true);
  });

  it('NOTIFY_TARGET=workerでもNOTIFY_WORKER_URL未設定ならisNotifyConfigured=false', () => {
    const checks = buildWebhookSettingChecks({ NOTIFY_TARGET: 'worker' });
    expect(checks.isNotifyConfigured).toBe(false);
    expect(checks.notifyWorkerUrlSet).toBe(false);
  });

  it('NOTIFY_TARGET未設定は既定でslack扱いになる', () => {
    const checks = buildWebhookSettingChecks({});
    expect(checks.notifyTarget).toBe('slack');
  });

  it('NOTIFY_TARGET=slackでslackToken/slackChannelが両方揃っていればisNotifyConfigured=true', () => {
    const checks = buildWebhookSettingChecks({
      NOTIFY_TARGET: 'slack',
      SLACK_OAUTH_TOKEN: 'xoxb-test',
      SLACK_CHANNEL_ID: 'C123',
    });
    expect(checks.isNotifyConfigured).toBe(true);
  });

  it('NOTIFY_TARGET=slackでslackTokenだけ設定されていてもisNotifyConfigured=false(片方欠けると不成立)', () => {
    const checks = buildWebhookSettingChecks({
      NOTIFY_TARGET: 'slack',
      SLACK_OAUTH_TOKEN: 'xoxb-test',
    });
    expect(checks.isNotifyConfigured).toBe(false);
  });

  it('secretの値そのものはどのフィールドにも含まれない(真偽値のみ)', () => {
    const checks = buildWebhookSettingChecks({
      GITHUB_WEBHOOK_SECRET: 'super-secret-value',
      NOTIFY_WORKER_SECRET: 'another-secret',
      SLACK_OAUTH_TOKEN: 'xoxb-leak-check',
    });
    const serialized = JSON.stringify(checks);
    expect(serialized).not.toContain('super-secret-value');
    expect(serialized).not.toContain('another-secret');
    expect(serialized).not.toContain('xoxb-leak-check');
  });
});

describe('extractRepositoryFromWebhookLogPayload', () => {
  it('repositoryフィールドを含むJSONから文字列を取り出す', () => {
    expect(extractRepositoryFromWebhookLogPayload('{"action":"opened","repository":"nekoserver/rails-root"}')).toBe(
      'nekoserver/rails-root'
    );
  });

  it('repositoryがnullのJSONはnullを返す', () => {
    expect(extractRepositoryFromWebhookLogPayload('{"action":"created","repository":null}')).toBeNull();
  });

  it('不正なJSON文字列は例外を投げずnullを返す', () => {
    expect(extractRepositoryFromWebhookLogPayload('not-json{{{')).toBeNull();
  });

  it('payloadがnullの場合もnullを返す', () => {
    expect(extractRepositoryFromWebhookLogPayload(null)).toBeNull();
  });

  it('repositoryが文字列以外の型の場合はnullを返す(型不整合を無視)', () => {
    expect(extractRepositoryFromWebhookLogPayload('{"repository":123}')).toBeNull();
  });
});

describe('toWebhookLogDisplayRows', () => {
  it('webhook_logの生の行を表示用の行に変換する', () => {
    const rows = toWebhookLogDisplayRows([
      {
        event_type: 'push',
        status: 'ok',
        payload: '{"action":"unknown","repository":"nekoserver/rails-root"}',
        error: null,
        received_at: '2026-10-01T00:30:00.000Z',
      },
    ]);
    expect(rows).toEqual([
      {
        eventType: 'push',
        status: 'ok',
        repository: 'nekoserver/rails-root',
        receivedAt: '2026-10-01T00:30:00.000Z',
        error: null,
      },
    ]);
  });

  it('空配列は空配列を返す', () => {
    expect(toWebhookLogDisplayRows([])).toEqual([]);
  });
});

describe('fetchCfAuthSettingChecks', () => {
  it('CF_AUTH Service Bindingが無ければbinding_missingを返す(例外にしない)', async () => {
    const result = await fetchCfAuthSettingChecks(undefined, 'secret');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('binding_missing');
  });

  it('NOTIFY_WORKER_SECRETが無ければsecret_missingを返す(fetchしない)', async () => {
    const fetchFn = vi.fn();
    const result = await fetchCfAuthSettingChecks({ fetch: fetchFn }, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('secret_missing');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('cf-auth側の/settings-checkをBearer認証付きで呼び、真偽値をそのまま返す', async () => {
    const checks = {
      ingestSecretSet: true,
      webhookSecretSet: true,
      googleClientIdSet: true,
      googleClientSecretSet: true,
      githubClientIdSet: true,
      githubClientSecretSet: true,
      cookieSecretIsDefault: false,
    };
    let receivedAuth: string | null = null;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      receivedAuth = (init?.headers as Record<string, string>)?.Authorization ?? null;
      return new Response(JSON.stringify(checks), { status: 200 });
    });
    const result = await fetchCfAuthSettingChecks({ fetch: fetchFn }, 'shared-secret');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.checks).toEqual(checks);
    expect(receivedAuth).toBe('Bearer shared-secret');
  });

  it('cf-auth側が401等を返したらhttp_errorを返す(secretの食い違いを検出できる)', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));
    const result = await fetchCfAuthSettingChecks({ fetch: fetchFn }, 'wrong-secret');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('http_error');
  });

  it('レスポンス形式が不正ならinvalid_responseを返す(例外にしない)', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ unexpected: true }), { status: 200 }));
    const result = await fetchCfAuthSettingChecks({ fetch: fetchFn }, 'secret');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('invalid_response');
  });

  it('fetch自体が例外を投げてもhttp_errorとして返す(例外を外へ伝播させない)', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network down');
    });
    const result = await fetchCfAuthSettingChecks({ fetch: fetchFn }, 'secret');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('http_error');
  });
});
