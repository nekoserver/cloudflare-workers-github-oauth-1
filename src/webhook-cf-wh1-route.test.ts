import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

const routeBlock = (() => {
  const idx = src.indexOf("app.post('/webhook/cf-wh1'");
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
})();

describe("POST /webhook/cf-wh1", () => {
  it('存在する', () => {
    expect(routeBlock.length).toBeGreaterThan(0);
  });

  it('CF_WH1_WEBHOOK_SECRETが未設定なら500を返す', () => {
    expect(routeBlock).toContain('const webhookSecret = c.env.CF_WH1_WEBHOOK_SECRET;');
    expect(routeBlock).toMatch(/if \(!webhookSecret\) \{[\s\S]*?return c\.json\(\{ error: 'Webhook endpoint is not available' \}, 500\);/);
  });

  it('X-Hub-Signature-256ヘッダーをverifyGitHubWebhookSignatureで検証する', () => {
    expect(routeBlock).toContain("c.req.header('X-Hub-Signature-256')");
    expect(routeBlock).toContain('await verifyGitHubWebhookSignature(rawBody, signatureHeader, webhookSecret)');
  });

  it('検証失敗時は401を返しwebhook_logへrejectedとして記録する', () => {
    expect(routeBlock).toMatch(/if \(!verification\.success\) \{[\s\S]*?logWebhookEvent\(c\.env\.DB, 'cf-wh1', null, 'rejected', null, verification\.reason\)[\s\S]*?return c\.json\(\{ error: 'Unauthorized webhook' \}, 401\);/);
  });

  it('不正なJSONペイロードは400を返しwebhook_logへerrorとして記録する', () => {
    expect(routeBlock).toMatch(/catch \{[\s\S]*?logWebhookEvent\(c\.env\.DB, 'cf-wh1', null, 'error', null, 'Invalid JSON payload'\)[\s\S]*?return c\.json\(\{ error: 'Invalid webhook payload' \}, 400\);/);
  });

  it('検証成功時はwebhook_logへokとして記録し200でOKを返す', () => {
    expect(routeBlock).toContain("logWebhookEvent(c.env.DB, 'cf-wh1', event, 'ok', payload)");
    expect(routeBlock).toContain("return c.json({ result: 'OK' });");
  });
});
