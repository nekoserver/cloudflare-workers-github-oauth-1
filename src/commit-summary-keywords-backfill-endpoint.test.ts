/**
 * POST /api/commit-summary-keywords-backfill の統合テスト。
 *
 * 対象: デプロイ前にWebhook経由(PRマージ・push)で自動生成され、キーワードが
 * 一度も抽出されていないai_summary_logの既存行に、ログイン済みユーザーが
 * 手動で少しずつキーワードを遡って付けるためのバックフィルAPI。
 *
 * 故障シナリオ:
 *   (1) AI未設定時に例外で落ちる(503で明示すべき)
 *   (2) 1件の抽出失敗が他の行の処理を止めてしまう
 *   (3) limitを無視して無制限に処理してしまう(リクエストタイムアウトの原因)
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader(sub = 'test-user') {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

type SummaryRow = { id: number; request_id: string; summary: string; hasKeywords: boolean; repoFullName?: string };

function createMockDb(rows: SummaryRow[]) {
  const savedKeywords: { summaryLogId: string; keyword: string }[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            first: async () => {
              if (sql.includes('user_sessions')) return { revoked_at: null };
              return null;
            },
            all: async () => {
              if (sql.includes('FROM ai_summary_log l')) {
                let candidates = rows.filter((r) => !r.hasKeywords);
                let argIndex = 0;
                if (sql.includes('l.repo_full_name = ?')) {
                  const repoName = args[argIndex++] as string;
                  candidates = candidates.filter((r) => r.repoFullName === repoName);
                }
                const limit = args[argIndex] as number;
                const targets = candidates.slice(0, limit);
                return { results: targets.map((r) => ({ id: r.id, request_id: r.request_id, summary: r.summary })) };
              }
              return { results: [] };
            },
            run: async () => ({ success: true }),
          };
        },
      };
    },
    batch: async (stmts: Array<{ run(): Promise<unknown> }>) => {
      savedKeywords.push(...stmts.map(() => ({ summaryLogId: '', keyword: '' })));
      return Promise.all(stmts.map((s) => s.run()));
    },
  };
  return { db, savedKeywords };
}

function makeAiStub(keywordsByPrefix: Record<string, string[] | 'error'>) {
  return {
    run: vi.fn(async (_model: string, input: { messages: { role: string; content: string }[] }) => {
      const content = input.messages.find((m) => m.role === 'user')?.content ?? '';
      for (const [prefix, result] of Object.entries(keywordsByPrefix)) {
        if (content.includes(prefix)) {
          if (result === 'error') throw new Error('AI呼び出し失敗');
          return { response: result.join('\n') };
        }
      }
      return { response: '' };
    }),
  };
}

async function postBackfill(env: Record<string, unknown>, body: Record<string, unknown> = {}) {
  const auth = await makeAuthHeader();
  return app.request(
    '/api/commit-summary-keywords-backfill',
    { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { JWT_SECRET, ...env }
  );
}

describe('POST /api/commit-summary-keywords-backfill', () => {
  it('AI未設定時は503で明示する', async () => {
    const { db } = createMockDb([]);
    const res = await postBackfill({ DB: db });
    expect(res.status).toBe(503);
  });

  it('キーワード未抽出の行を抽出・保存し、処理件数と成功件数を返す', async () => {
    const { db } = createMockDb([
      { id: 1, request_id: 'r1', summary: 'ログイン機能の修正', hasKeywords: false },
      { id: 2, request_id: 'r2', summary: 'キャッシュの改善', hasKeywords: false },
    ]);
    const ai = makeAiStub({ 'ログイン機能': ['ログイン機能'], 'キャッシュ': ['キャッシュ'] });
    const res = await postBackfill({ DB: db, AI: ai });
    expect(res.status).toBe(200);
    const body = await res.json() as { processed: number; succeeded: number; failed: unknown[] };
    expect(body.processed).toBe(2);
    expect(body.succeeded).toBe(2);
    expect(body.failed).toEqual([]);
  });

  it('1件の抽出失敗は他の行の処理を止めず、failedに記録する', async () => {
    const { db } = createMockDb([
      { id: 1, request_id: 'r1', summary: 'エラーになる要約', hasKeywords: false },
      { id: 2, request_id: 'r2', summary: '正常な要約', hasKeywords: false },
    ]);
    const ai = makeAiStub({ 'エラーになる': 'error', '正常な要約': ['正常な要約'] });
    const res = await postBackfill({ DB: db, AI: ai });
    expect(res.status).toBe(200);
    const body = await res.json() as { processed: number; succeeded: number; failed: { id: number }[] };
    expect(body.processed).toBe(2);
    expect(body.succeeded).toBe(1);
    expect(body.failed.map((f) => f.id)).toEqual([1]);
  });

  it('limitを渡した件数に絞って処理する(0件なら即終了)', async () => {
    const { db } = createMockDb([]);
    const ai = makeAiStub({});
    const res = await postBackfill({ DB: db, AI: ai }, { limit: 5 });
    expect(res.status).toBe(200);
    const body = await res.json() as { processed: number };
    expect(body.processed).toBe(0);
  });

  it('repoNameを指定すると、そのリポジトリの行だけを対象にする(他リポジトリの行は処理しない)', async () => {
    const { db } = createMockDb([
      { id: 1, request_id: 'r1', summary: '対象リポジトリの要約', hasKeywords: false, repoFullName: 'nekoserver/rails-root' },
      { id: 2, request_id: 'r2', summary: '別リポジトリの要約', hasKeywords: false, repoFullName: 'nekoserver/dynamicneko' },
    ]);
    const ai = makeAiStub({ '対象リポジトリ': ['対象リポジトリ'] });
    const res = await postBackfill({ DB: db, AI: ai }, { repoName: 'nekoserver/rails-root' });
    expect(res.status).toBe(200);
    const body = await res.json() as { processed: number; succeeded: number };
    expect(body.processed).toBe(1);
    expect(body.succeeded).toBe(1);
  });
});
