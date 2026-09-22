/**
 * POST /api/jev-playground-external の無効化を保証する回帰テスト。
 *
 * 共有BearerとuserTokenだけでJEV_API_KEYを代理利用できる経路は、
 * 利用者別クォータと専用の短命・audience固定トークンが実装されるまで
 * 公開しない。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from './index';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/jev-playground-external', () => {
  it('ルートが存在せず、共有認証情報が正しくてもJev APIを呼び出さない', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request(
      '/api/jev-playground-external',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer leaked-shared-secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userToken: 'attacker-controlled-token',
          state: '条件が成立しています。',
          questions: { condition: { type: 'noul', question: '成立しているか？' } },
          model: 'attacker-selected-model',
        }),
      },
      {
        AICHAT_EXTERNAL_SECRET: 'leaked-shared-secret',
        AICHAT_USER_TOKEN_SECRET: 'shared-user-token-secret',
        JEV_API_KEY: 'production-jev-key',
      },
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
