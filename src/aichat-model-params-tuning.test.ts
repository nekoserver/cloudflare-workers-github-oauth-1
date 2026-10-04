import { describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

// 対象: POST /api/aichat が、色丸ドロップダウンの「パラメータ調整」モーダルから
// 送られてくるmaxTokens/temperatureを実際にAI.run()へ渡す経路
// (resolveAichatRunOverrides、aichatModelConfig.ts)。
//
// 故障シナリオ:
//   (1) 対象モデル(Gemma-4・Qwen)なのにmaxTokens/temperatureが実際のAI.run()
//       呼び出しに渡らない
//   (2) 対象外のモデルにもmaxTokens/temperatureが渡ってしまい、パラメータ
//       調整機能の対象範囲(ユーザー要望: よく使う2モデルだけ)が守られない
//   (3) デフォルト値を超えるmaxTokensを指定しても、クランプされずそのまま
//       渡ってしまう(コスト・レイテンシ上限を超えさせない設計が効いていない)

async function makeAuthHeader(sub = 'test-user') {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function makeDb() {
  return {
    prepare: (_sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => ({ revoked_at: null }),
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      }),
    }),
  };
}

describe('POST /api/aichat: パラメータ調整モーダルのmaxTokens/temperature', () => {
  it('対象モデル(qwen3.8-27b)の場合、クランプ済みのmaxTokens/temperatureが実際にAI.run()へ渡る', async () => {
    const run = vi.fn(async (_model: string, _params: unknown) => ({ response: '了解しました' }));
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/aichat',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'こんにちは',
          model: '@cf/qwen/qwen3.8-27b',
          maxTokens: 2048,
          temperature: 0.3,
        }),
      },
      { JWT_SECRET, DB: makeDb() as never, AI: { run } as never }
    );
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledOnce();
    const [calledModel, calledParams] = run.mock.calls[0] as [string, { max_tokens?: number; temperature?: number }];
    expect(calledModel).toBe('@cf/qwen/qwen3.8-27b');
    expect(calledParams.max_tokens).toBe(2048);
    expect(calledParams.temperature).toBe(0.3);
  });

  it.each([16384, 999999])('対象モデルのmaxTokens=%iは新しい上限16384でAI.run()へ渡る', async (maxTokens) => {
    const run = vi.fn(async (_model: string, _params: unknown) => ({ response: '了解しました' }));
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/aichat',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'こんにちは', model: '@cf/qwen/qwen3.8-27b', maxTokens }),
      },
      { JWT_SECRET, DB: makeDb() as never, AI: { run } as never }
    );
    expect(res.status).toBe(200);
    const [, calledParams] = run.mock.calls[0] as [string, { max_tokens?: number }];
    expect(calledParams.max_tokens).toBe(16384);
  });

  it('対象外のモデル(llama-3.3-70b)の場合、maxTokens/temperatureを指定しても無視される', async () => {
    const run = vi.fn(async (_model: string, _params: unknown) => ({ response: '了解しました' }));
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/aichat',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'こんにちは',
          model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          maxTokens: 123,
          temperature: 1.9,
        }),
      },
      { JWT_SECRET, DB: makeDb() as never, AI: { run } as never }
    );
    expect(res.status).toBe(200);
    const [calledModel, calledParams] = run.mock.calls[0] as [string, { max_tokens?: number; temperature?: number }];
    expect(calledModel).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    expect(calledParams.max_tokens).toBe(4096);
    expect(calledParams.temperature).toBeUndefined();
  });
});
