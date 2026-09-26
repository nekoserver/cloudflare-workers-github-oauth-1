import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

const coreBlock = (() => {
  const idx = src.indexOf('async function handleResendWebhookCore');
  const end = src.indexOf('\n}\n', idx) + 3;
  return src.slice(idx, end);
})();

const sourceRouteBlock = (() => {
  const idx = src.indexOf("app.post('/webhook/resend/:sourceId'");
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
})();

const plainRouteBlock = (() => {
  const idx = src.indexOf("app.post('/webhook/resend',");
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
})();

describe('handleResendWebhookCore', () => {
  it('sourceIdがnullの場合はログ用ラベルとして"default"を使う', () => {
    expect(coreBlock).toContain("const logSourceLabel = sourceId ?? 'default';");
  });

  it('resend_webhook_logへの記録にはlogSourceLabelではなく生のsourceIdをbindする（NULL許容カラムのため）', () => {
    expect(coreBlock).toMatch(/INSERT OR IGNORE INTO resend_webhook_log[\s\S]*?\.bind\(\s*sourceId,/);
  });

  it('DBが利用できない場合は例外を投げずにエラーログのみ出す', () => {
    expect(coreBlock).toContain('const db = c.env.DB;');
    expect(coreBlock).toMatch(/if \(!db\) \{\s*logger\.error\('Database is not available for resend_webhook_log insert'/);
  });

  it('重複・JSON不正・プロキシ失敗をwebhook_logへ失敗として記録する', () => {
    expect(coreBlock).toMatch(/Duplicate Resend webhook detected[\s\S]*?logWebhookEvent\([\s\S]*?'rejected'[\s\S]*?'Duplicate webhook'/);
    expect(coreBlock).toMatch(/Unable to parse Resend webhook payload[\s\S]*?logWebhookEvent\([\s\S]*?'rejected'[\s\S]*?`Invalid webhook payload:/);
    expect(coreBlock).toMatch(/if \(proxyFailed && eventType !== 'email\.delivered'\)[\s\S]*?logWebhookEvent\([\s\S]*?'error'[\s\S]*?'Failed to notify proxy target'/);
  });

  it('成功ログは下流通知の結果が確定してから記録する', () => {
    const successLogIndex = coreBlock.lastIndexOf('logWebhookEvent(');
    expect(successLogIndex).toBeGreaterThan(coreBlock.indexOf('const svixId'));
    expect(coreBlock.slice(successLogIndex)).toContain("'ok'");
    expect(coreBlock.slice(successLogIndex)).toContain('proxyResult: proxyResultText');
  });
});

describe("POST /webhook/resend/:sourceId", () => {
  it('DB上のresend_webhook_sourcesからsourceを検索し、見つからなければ404を返す', () => {
    expect(sourceRouteBlock).toContain('FROM resend_webhook_sources WHERE id = ?');
    expect(sourceRouteBlock).toMatch(/if \(!sourceRow\) \{[\s\S]*?return c\.json\(\{ error: 'Unknown webhook source' \}, 404\);/);
  });

  it('不明なsourceとsecret未設定をwebhook_logへ記録する', () => {
    expect(sourceRouteBlock).toMatch(/Unknown Resend webhook source[\s\S]*?logWebhookEvent\([\s\S]*?'rejected'[\s\S]*?'Unknown webhook source'/);
    expect(sourceRouteBlock).toMatch(/Resend webhook secret is not configured[\s\S]*?logWebhookEvent\([\s\S]*?'error'[\s\S]*?'Webhook secret is not configured'/);
  });

  it('ソース固有のwebhook_secretが無ければRESEND_WEBHOOK_SECRETにフォールバックする', () => {
    expect(sourceRouteBlock).toContain('sourceRow.webhook_secret ?? c.env.RESEND_WEBHOOK_SECRET');
  });

  it('handleResendWebhookCoreにsourceIdと解決済みsecretを渡す', () => {
    expect(sourceRouteBlock).toContain('return handleResendWebhookCore(c, sourceId, webhookSecret);');
  });
});

describe('POST /webhook/resend', () => {
  it('RESEND_WEBHOOK_SECRETが未設定なら500を返す（sourceテーブルには依存しない）', () => {
    expect(plainRouteBlock).toContain('const webhookSecret = c.env.RESEND_WEBHOOK_SECRET;');
    expect(plainRouteBlock).toMatch(/if \(!webhookSecret\) \{[\s\S]*?return c\.json\(\{ error: 'Webhook endpoint is not available' \}, 500\);/);
  });

  it('secret未設定をwebhook_logへ記録する', () => {
    expect(plainRouteBlock).toContain("logWebhookEvent(c.env.DB, 'resend:default', null, 'error', null, 'Webhook secret is not configured', {");
  });

  it('handleResendWebhookCoreにsourceId=nullを渡す（sourceId省略の単一アカウント運用）', () => {
    expect(plainRouteBlock).toContain('return handleResendWebhookCore(c, null, webhookSecret);');
  });

  it('resend_webhook_sourcesテーブルへは問い合わせない', () => {
    expect(plainRouteBlock).not.toContain('resend_webhook_sources');
  });
});
