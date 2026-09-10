import { describe, it, expect, vi } from 'vitest';
import app, { KIMI_CODE_MODEL } from './index';

// 対象: POST /api/kimi-code/generate-external。dynamicneko(Cloudflare Dynamic
// Worker Loader使用)のNew Snippetウィジェットから、ユーザーのログインセッション
// を持たないService Binding経由で呼ばれる。/api/kimi-code/generateと処理内容は
// 同じだが、認証をGitHubログインセッション(authMiddleware)ではなく
// KIMI_CODE_EXTERNAL_SECRETとのBearer照合に切り替えている。
//
// 故障シナリオ:
//   (1) secret未設定・不一致でも呼べてしまう(認証バイパス)
//   (2) 環境変数名が呼び出し元(dynamicneko)と食い違い、値を揃えても401になる
//       (NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md 9-2節と
//       同じ事故を今回はここで再発させない)
//   (3) セッション必須のauthMiddlewareのままだと、ユーザーセッションを持たない
//       dynamicnekoからは常に401になる

const KIMI_CODE_EXTERNAL_SECRET = 'external-secret';

function makeEnv(ai: unknown, secret: string | undefined = KIMI_CODE_EXTERNAL_SECRET) {
  return {
    AI: ai,
    GITHUB_CLIENT_ID: 'test',
    GITHUB_CLIENT_SECRET: 'test',
    JWT_SECRET: 'test-secret',
    KIMI_CODE_EXTERNAL_SECRET: secret,
  };
}

describe('POST /api/kimi-code/generate-external', () => {
  it('正しいBearer secretとpromptで生成結果を返す(ログインセッション不要)', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ response: 'const x = 1;' }) };

    const res = await app.request('/api/kimi-code/generate-external', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KIMI_CODE_EXTERNAL_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'add two numbers' }),
    }, makeEnv(ai));

    expect(res.status).toBe(200);
    const data = await res.json() as { code: string; model: string };
    expect(data.code).toBe('const x = 1;');
    expect(data.model).toBe(KIMI_CODE_MODEL);
  });

  it('Authorizationヘッダー無しは401', async () => {
    const ai = { run: vi.fn() };
    const res = await app.request('/api/kimi-code/generate-external', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' }),
    }, makeEnv(ai));
    expect(res.status).toBe(401);
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('誤ったsecretは401', async () => {
    const ai = { run: vi.fn() };
    const res = await app.request('/api/kimi-code/generate-external', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' }),
    }, makeEnv(ai));
    expect(res.status).toBe(401);
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('KIMI_CODE_EXTERNAL_SECRET未設定時は誰も呼べない(安全側デフォルト)', async () => {
    const ai = { run: vi.fn() };
    const res = await app.request('/api/kimi-code/generate-external', {
      method: 'POST',
      headers: { Authorization: 'Bearer anything', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' }),
    }, makeEnv(ai, undefined));
    expect(res.status).toBe(401);
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('promptが空の場合は400を返しAIを呼ばない', async () => {
    const ai = { run: vi.fn() };
    const res = await app.request('/api/kimi-code/generate-external', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KIMI_CODE_EXTERNAL_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '  ' }),
    }, makeEnv(ai));
    expect(res.status).toBe(400);
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('AIバインディング未設定の場合は503を返す', async () => {
    const res = await app.request('/api/kimi-code/generate-external', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KIMI_CODE_EXTERNAL_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' }),
    }, makeEnv(undefined));
    expect(res.status).toBe(503);
  });

  it('AI呼び出しが例外を投げた場合、実際のエラー内容を返す(握りつぶさない)', async () => {
    const ai = { run: vi.fn().mockRejectedValue(new Error('rate limited: too many requests')) };
    const res = await app.request('/api/kimi-code/generate-external', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KIMI_CODE_EXTERNAL_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' }),
    }, makeEnv(ai));
    expect(res.status).toBe(500);
    const data = await res.json() as { error: string };
    expect(data.error).toContain('rate limited: too many requests');
  });

  it('AIが空応答を返した場合は502を返す(成功扱いにしない)', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ response: '' }) };
    const res = await app.request('/api/kimi-code/generate-external', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KIMI_CODE_EXTERNAL_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' }),
    }, makeEnv(ai));
    expect(res.status).toBe(502);
  });
});
