import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

const installBlock = (() => {
  const idx = src.indexOf("app.get('/auth/slack/install'");
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
})();

const callbackBlock = (() => {
  const idx = src.indexOf("app.get('/auth/v1/callback'");
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
})();

describe('GET /auth/slack/install', () => {
  it('authMiddleware で保護されている（ログイン中のユーザーのみインストール開始できる）', () => {
    expect(installBlock).toContain('authMiddleware');
  });

  it('SLACK_CLIENT_IDが未設定なら500を返す', () => {
    expect(installBlock).toMatch(/if \(!clientId\) \{\s*return jsonUtf8\(\{ error: 'Slack OAuth is not configured' \}, 500\);/);
  });

  it('CSRF対策のstateをHttpOnlyクッキーに保存してからSlackの認可画面へリダイレクトする', () => {
    expect(installBlock).toContain('const state = generateOAuthState();');
    expect(installBlock).toContain('slack_oauth_state=${state}');
    expect(installBlock).toContain('HttpOnly; Secure; SameSite=Lax');
  });

  it('redirect_uriは/auth/v1/callbackを指す', () => {
    expect(installBlock).toContain('/auth/v1/callback');
  });
});

describe('GET /auth/v1/callback', () => {
  it('authMiddleware で保護されている', () => {
    expect(callbackBlock).toContain('authMiddleware');
  });

  it('stateパラメータをクッキーの値と比較してCSRFを検証する', () => {
    expect(callbackBlock).toContain("getCookieValue(cookieHeader, 'slack_oauth_state')");
    expect(callbackBlock).toMatch(/if \(!state \|\| !savedState \|\| state !== savedState\)/);
  });

  it('exchangeSlackOAuthCodeで認可コードをアクセストークンに交換する', () => {
    expect(callbackBlock).toContain('exchangeSlackOAuthCode({');
  });

  it('fetchImplは裸のfetch参照ではなくアロー関数で渡す（Cloudflare WorkersのIllegal invocation回避）', () => {
    // `fetchImpl: fetch` は fetch を this バインドなしで呼び出すことになり、
    // Cloudflare Workers ランタイムでは "Illegal invocation" 例外になる（実機で再現確認済み）
    expect(callbackBlock).not.toMatch(/fetchImpl:\s*fetch\s*[,}]/);
    expect(callbackBlock).toContain('fetchImpl: (url, init) => fetch(url, init),');
  });

  it('交換失敗時は502でエラー内容を返す（握りつぶさない）', () => {
    expect(callbackBlock).toMatch(/if \(!exchangeResult\.ok\) \{[\s\S]*?return c\.json\(\{ error: `Slack連携に失敗しました: \$\{exchangeResult\.error\}` \}, 502,/);
  });

  it('slack_installationsにteam_idでUPSERTする（再インストール時はトークンを更新）', () => {
    expect(callbackBlock).toContain('INSERT INTO slack_installations');
    expect(callbackBlock).toContain('ON CONFLICT(team_id) DO UPDATE SET');
  });

  it('成功時はstateクッキーを削除してから/settingsへリダイレクトする', () => {
    expect(callbackBlock).toContain("Location': '/settings?slack=connected'");
    expect(callbackBlock).toContain('clearStateCookie');
  });
});
