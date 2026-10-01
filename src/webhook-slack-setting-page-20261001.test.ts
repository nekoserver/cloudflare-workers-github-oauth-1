import { describe, expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

// 対象: GET /wh-setting_github-to-slack (新規ページ)。
// GitHub webhook → Slack / cf-auth 通知設定の処理順序・設定確認・直近の
// push受信ログをまとめた診断ページ。認証必須。
//
// 故障シナリオ:
//   (1) 未認証でアクセスできてしまう(secretの設定有無とはいえ内部情報なので
//       認証は必須)
//   (2) DBが無い/webhook_logが空でも例外で落ちる
//   (3) secretの値そのものがHTMLに埋め込まれて漏洩する

const JWT_SECRET = 'test-secret';

async function makeAuthHeader(sub = 'test-user') {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(pushLogs: { event_type: string; status: string; payload: string | null; error: string | null; received_at: string }[]) {
  return {
    prepare: (sql: string) => ({
      bind: () => ({
        all: async () => ({ results: sql.includes('webhook_log') ? pushLogs : [] }),
        first: async () => null,
        run: async () => ({ success: true }),
      }),
      all: async () => ({ results: sql.includes('webhook_log') ? pushLogs : [] }),
      first: async () => null,
    }),
  };
}

describe('GET /wh-setting_github-to-slack', () => {
  it('未認証は401', async () => {
    const res = await app.request('/wh-setting_github-to-slack', {}, { JWT_SECRET });
    expect(res.status).toBe(401);
  });

  it('認証済みなら200でページを返し、secretの値は含まれない', async () => {
    const auth = await makeAuthHeader();
    const res = await app.request(
      '/wh-setting_github-to-slack',
      { headers: { Authorization: auth } },
      {
        JWT_SECRET,
        DB: createMockDb([
          {
            event_type: 'push',
            status: 'ok',
            payload: '{"action":"unknown","repository":"nekoserver/rails-root"}',
            error: null,
            received_at: '2026-10-01T00:30:00.000Z',
          },
        ]),
        GITHUB_WEBHOOK_SECRET: 'super-secret-webhook',
        NOTIFY_TARGET: 'worker',
        NOTIFY_WORKER_URL: 'https://notify.example.com/ingest',
        NOTIFY_WORKER_SECRET: 'super-secret-notify',
      }
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('nekoserver/rails-root');
    expect(html).toContain('送信可能');
    expect(html).not.toContain('super-secret-webhook');
    expect(html).not.toContain('super-secret-notify');
  });

  it('DBが無くても例外にならずページを返す', async () => {
    const auth = await makeAuthHeader();
    const res = await app.request('/wh-setting_github-to-slack', { headers: { Authorization: auth } }, { JWT_SECRET });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('直近のpush webhook受信ログはありません');
  });
});
