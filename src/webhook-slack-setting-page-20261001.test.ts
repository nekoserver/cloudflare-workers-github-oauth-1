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
//   (4) getThemeToggleScript()を<script>タグで囲み忘れ、JS関数の本体が
//       そのまま画面上の可視テキストとして出力されてしまう
//   (5) CF_AUTH Service Bindingが無い/cf-auth側が異常を返した場合に
//       ページ全体が例外で落ちる(本体Worker単体の設定チェックに影響しない)
//   (6) cf-auth側から取得した真偽値が正しく表示に反映されない

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

  it('CF_AUTH Service Bindingが無くても例外にならず、未取得の旨を表示する', async () => {
    const auth = await makeAuthHeader();
    const res = await app.request('/wh-setting_github-to-slack', { headers: { Authorization: auth } }, { JWT_SECRET });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('cf-auth側の設定状況を取得できませんでした');
  });

  it('CF_AUTH Service Bindingがあれば、cf-auth側の/settings-checkを呼び結果を表示する', async () => {
    const auth = await makeAuthHeader();
    const cfAuthFetch = async () =>
      new Response(
        JSON.stringify({
          ingestSecretSet: true,
          webhookSecretSet: true,
          googleClientIdSet: true,
          googleClientSecretSet: true,
          githubClientIdSet: true,
          githubClientSecretSet: true,
          cookieSecretIsDefault: true,
        }),
        { status: 200 }
      );
    const res = await app.request(
      '/wh-setting_github-to-slack',
      { headers: { Authorization: auth } },
      { JWT_SECRET, NOTIFY_WORKER_SECRET: 'shared-secret', CF_AUTH: { fetch: cfAuthFetch } }
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('cf-auth側へのService Binding経由の問い合わせに成功しました');
    expect(html).toContain('wrangler.tomlのデフォルト値のまま(要変更)');
    expect(html).not.toContain('shared-secret');
  });

  it('テーマ切替スクリプトは<script>タグ内に収まっており、可視テキストとして出力されない', async () => {
    const auth = await makeAuthHeader();
    const res = await app.request('/wh-setting_github-to-slack', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    const scriptContents = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scriptContents.some((s) => s.includes('function toggleTheme()'))).toBe(true);
    // 最後の</script>より後ろ(bodyの可視領域)に関数定義の文字列が漏れていないこと
    const afterLastScript = html.slice(html.lastIndexOf('</script>'));
    expect(afterLastScript).not.toContain('function toggleTheme()');
  });
});
