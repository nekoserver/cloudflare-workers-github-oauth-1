import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// 対象: Slack通知ON/OFFユーザーオプション(デフォルトOFF)の設定エンドポイント。
// POST /api/settings/slack-notify (ログインユーザー本人が変更する、認証必須)
// GET  /api/settings/slack-notify (cf-authアプリ等の外部サービスが現在値を参照する、
//      ログインCookieではなくCF_AUTH_WEBHOOK_SECRETの共有シークレットで認証)
describe('Slack通知ON/OFFユーザーオプション設定エンドポイント', () => {
  const src = readFileSync('src/index.ts', 'utf8');

  it('POSTは認証必須で登録されている', () => {
    expect(src).toContain("app.post('/api/settings/slack-notify', authMiddleware");
  });

  it('GETはCF_AUTH_WEBHOOK_SECRETの共有シークレットで認証する(外部サービス参照用)', () => {
    const idx = src.indexOf("app.get('/api/settings/slack-notify'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, src.indexOf('\n});', idx));
    expect(fn).toContain('c.env.CF_AUTH_WEBHOOK_SECRET');
    expect(fn).toContain("c.json({ error: 'Unauthorized' }, 401)");
    expect(fn).toContain('isSlackNotifyEnabled(c.env.DB)');
  });

  it('POSTはnotification_settingsをUPSERTする', () => {
    const idx = src.indexOf("app.post('/api/settings/slack-notify'");
    const fn = src.slice(idx, src.indexOf('\n});', idx));
    expect(fn).toContain('INSERT INTO notification_settings');
    expect(fn).toContain('ON CONFLICT(id) DO UPDATE SET slack_enabled = excluded.slack_enabled');
  });
});
