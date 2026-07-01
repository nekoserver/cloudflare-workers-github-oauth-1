import { describe, it, expect, vi } from 'vitest';
import { buildCfAuthSlackMessage, logWebhookEvent } from './index';

describe('buildCfAuthSlackMessage', () => {
  const base = {
    event: 'login',
    user: 'octocat',
    action: 'success',
    tenantId: '',
    webhookLogId: null as number | null,
    payload: {} as Record<string, unknown>,
  };

  it('tenantId が空文字の場合はテナント行を含めない', () => {
    const text = buildCfAuthSlackMessage(base);
    expect(text).not.toContain('テナント:');
  });

  it('tenantId が指定されていればテナント行を含める', () => {
    const text = buildCfAuthSlackMessage({ ...base, tenantId: 'cloudflare-workers-github-oauth-1' });
    expect(text).toContain('テナント: cloudflare-workers-github-oauth-1');
  });

  it('webhookLogId が null の場合は記録ID行を含めない', () => {
    const text = buildCfAuthSlackMessage(base);
    expect(text).not.toContain('記録ID:');
  });

  it('webhookLogId が数値であれば記録ID行を含める', () => {
    const text = buildCfAuthSlackMessage({ ...base, webhookLogId: 42 });
    expect(text).toContain('記録ID: #42');
  });

  it('tenant_id は payload の残余フィールド一覧に二重表示しない', () => {
    const text = buildCfAuthSlackMessage({
      ...base,
      tenantId: 'tenant-a',
      payload: { tenant_id: 'tenant-a', ip: '203.0.113.1' },
    });
    const occurrences = text.split('tenant-a').length - 1;
    expect(occurrences).toBe(1);
    expect(text).toContain('ip: 203.0.113.1');
  });

  it('残余フィールドは最大5件まで表示する（既存挙動を維持）', () => {
    const payload: Record<string, unknown> = {};
    for (let i = 0; i < 8; i++) payload[`field${i}`] = i;
    const text = buildCfAuthSlackMessage({ ...base, payload });
    for (let i = 0; i < 5; i++) expect(text).toContain(`field${i}: ${i}`);
    for (let i = 5; i < 8; i++) expect(text).not.toContain(`field${i}: ${i}`);
  });
});

describe('logWebhookEvent の戻り値', () => {
  it('挿入に成功した場合は last_row_id を返す', async () => {
    const db = {
      prepare: () => ({
        bind: () => ({
          run: vi.fn().mockResolvedValue({ meta: { last_row_id: 123 } }),
        }),
      }),
    };
    const id = await logWebhookEvent(db as any, 'cf-auth', 'login', 'ok', { user: 'octocat' });
    expect(id).toBe(123);
  });

  it('db が未指定なら null を返す', async () => {
    const id = await logWebhookEvent(undefined, 'cf-auth', 'login', 'ok', null);
    expect(id).toBeNull();
  });

  it('挿入が失敗しても例外を投げず null を返す', async () => {
    const db = {
      prepare: () => ({
        bind: () => ({
          run: vi.fn().mockRejectedValue(new Error('no such table: webhook_log')),
        }),
      }),
    };
    const id = await logWebhookEvent(db as any, 'cf-auth', null, 'rejected', null, 'bad signature');
    expect(id).toBeNull();
  });
});
