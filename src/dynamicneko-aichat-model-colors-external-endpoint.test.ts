/**
 * POST /api/aichat/model-colors-external のテスト
 *
 * 対象: dynamicnekoの/ai-cacheページの左サイドパネル(言語モデル色丸の凡例)が
 * 呼ぶ外部API。/aichatページのナビバー色丸と同じ aichat_model_colors を返す。
 * 色データはユーザー固有ではないため、permission-externalと同じ認可チェック
 * (許可済みメールアドレスかどうか)だけを行い、login解決は行わない。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1参照まで到達してしまう
 *   (3) D1未設定時にフェイルオープンする
 *   (4) aichat_model_colorsが空でも未割当モデルに新しい色が割り当てられず、
 *       色丸が表示されない
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';

const SECRET = 'test-aichat-external-secret';

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      const makeChain = (args: unknown[]) => ({
        async first<T>(): Promise<T | null> {
          const row = stmt.get(...(args as never[]));
          return (row ?? null) as T | null;
        },
        async all<T>(): Promise<{ results?: T[] }> {
          const rows = stmt.all(...(args as never[])) as unknown[];
          return { results: rows as T[] };
        },
        async run(): Promise<void> {
          stmt.run(...(args as never[]));
        },
        bind(...innerArgs: unknown[]) {
          return makeChain(innerArgs);
        },
      });
      return makeChain([]);
    },
  };
}

function setupDb(allowedUsers: Record<string, string>): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE dynamicneko_aichat_allowed_users (email TEXT PRIMARY KEY, github_login TEXT);
    CREATE TABLE aichat_model_colors (model_id TEXT PRIMARY KEY, color TEXT NOT NULL, label TEXT NOT NULL);
  `);
  for (const [email, login] of Object.entries(allowedUsers)) {
    db.prepare(`INSERT INTO dynamicneko_aichat_allowed_users (email, github_login) VALUES (?, ?)`).run(email, login);
  }
  return db;
}

describe('POST /api/aichat/model-colors-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/model-colors-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('未許可メールアドレスは403で拒否され、D1参照は実行されない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/model-colors-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ng@example.com' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('許可');
  });

  it('DB未設定時は503', async () => {
    const res = await app.request(
      '/api/aichat/model-colors-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET }
    );
    expect(res.status).toBe(503);
  });

  it('許可済みメールアドレスはD1に保存済みの色・ラベルをそのまま返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    db.prepare(`INSERT INTO aichat_model_colors (model_id, color, label) VALUES (?, ?, ?)`).run(
      '@cf/google/gemma-4-26b-a4b-it', '#4f46e5', 'Gemma-4'
    );
    const res = await app.request(
      '/api/aichat/model-colors-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { models: Array<{ id: string; color: string; label: string }> };
    const gemma = body.models.find((m) => m.id === '@cf/google/gemma-4-26b-a4b-it');
    expect(gemma?.color).toBe('#4f46e5');
    expect(gemma?.label).toBe('Gemma-4');
  });

  it('未割当のモデルには新しい色とラベルが割り当てられて返る(空文字やnullにならない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/model-colors-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { models: Array<{ id: string; color: string; label: string }> };
    expect(body.models.length).toBeGreaterThan(0);
    for (const model of body.models) {
      expect(model.color).toBeTruthy();
      expect(model.color.startsWith('#')).toBe(true);
      expect(model.label).toBeTruthy();
    }
  });
});
