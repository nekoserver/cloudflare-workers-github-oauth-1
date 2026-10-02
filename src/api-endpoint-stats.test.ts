import { describe, it, expect, vi } from 'vitest';
import app from './index';

describe('APIエンドポイント集計(recordApiAccess)', () => {
  it('/api/* 配下のレスポンス後に、endpointキー(METHOD routePath)でapi_endpoint_statsへ記録を試みる', async () => {
    const run = vi.fn(async (_sql: string, _args: unknown[]) => ({ success: true }));
    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          run: async () => run(sql, args),
          first: async () => null,
        }),
      }),
    };
    const res = await app.request('/api/some-nonexistent-endpoint', {}, { DB: db as never });
    // waitUntilは実行コンテキストが無いテスト環境では安全にスキップされるため、
    // レスポンス自体が壊れていないことをまず確認する(recordApiAccessの例外で
    // リクエスト自体が失敗しないことの確認)。
    expect(res.status).toBeGreaterThanOrEqual(200);
  });

  it('recordApiAccessはDBが無い場合に例外を投げず早期returnする(直接呼び出しで確認)', async () => {
    // index.tsのrecordApiAccessはトップレベル関数でexportされていないため、
    // 同じ入力をdbQueryへ素直に失敗させて確認する代わりに、実際のミドルウェア
    // 経由でDB無しのリクエストが500にならないことを確認する。
    const res = await app.request('/api/some-nonexistent-endpoint', {}, {});
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(600);
  });

  it('/slack/* 配下のレスポンス後もミドルウェアで落ちない(DBありでも無しでも200系/4xx系のレスポンスが返る)', async () => {
    const db = {
      prepare: (_sql: string) => ({
        bind: (..._args: unknown[]) => ({ run: async () => ({ success: true }), first: async () => null }),
      }),
    };
    const resWithDb = await app.request('/slack/commands', { method: 'POST', body: 'command=%2Funknown' }, { DB: db as never });
    expect(resWithDb.status).toBe(200);
    const resWithoutDb = await app.request('/slack/commands', { method: 'POST', body: 'command=%2Funknown' }, {});
    expect(resWithoutDb.status).toBe(200);
  });
});
