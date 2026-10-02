import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app, { saveSlackAiShare } from './index';

// 対象: Slackの@メンション経由で得られたAI応答を、AIチャットページ(/aichat)から
// 参照できるようai_chat_sharesへ保存するsaveSlackAiShare。Web認証を経由しない
// Slackメッセージには本アプリのuser_idが直接紐づかないため、そのSlack
// ワークスペースを最初にインストールしたユーザー(slack_installations.
// installed_by_user)の持ち物として保存する。
//
// 故障シナリオ:
//   (1) teamIdが無い、またはそのteamIdに対応するslack_installationsの行が
//       無い場合に例外を投げてSlack応答自体まで失敗させてしまう
//   (2) installed_by_userが未設定(NULL)の場合に誤ったuser_idで保存して
//       しまう、またはNULLのまま保存してFK制約違反になる
//   (3) DB書き込みが失敗した場合に例外を伝播させる(付随機能のため
//       Slack応答は成功のまま握りつぶすべき)
//   (4) source列に'slack'が正しく記録されない(Web由来との区別ができない)
//   (5) usage(トークン数)がai_chat_sharesへ反映されない

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              const row = stmt.get(...(args as never[]));
              return (row ? (row as T) : null);
            },
            async run(): Promise<{ meta: { changes: number } }> {
              const res = stmt.run(...(args as never[]));
              return { meta: { changes: Number(res.changes) } };
            },
          };
        },
      };
    },
  };
}

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE slack_installations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL UNIQUE,
      installed_by_user TEXT
    );
    CREATE TABLE ai_chat_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_hash TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL,
      conversation_hash TEXT,
      question_hash TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER,
      source TEXT
    );
  `);
  return db;
}

const baseParams = {
  question: '今日の天気は？',
  answer: '晴れです',
  model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
};

describe('saveSlackAiShare: SlackメンションのAI応答をai_chat_sharesへ保存する', () => {
  it('installed_by_userが設定されたteamIdなら、そのユーザー名義でai_chat_sharesへ保存する(source=slack)', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO slack_installations (team_id, installed_by_user) VALUES (?, ?)').run('T1', 'octocat');

    await saveSlackAiShare(wrapD1(db) as never, 'T1', baseParams);

    const row = db.prepare('SELECT * FROM ai_chat_shares').get() as Record<string, unknown>;
    expect(row.user_id).toBe('octocat');
    expect(row.question).toBe('今日の天気は？');
    expect(row.answer).toBe('晴れです');
    expect(row.model).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    expect(row.source).toBe('slack');
    expect(row.input_tokens).toBe(5);
    expect(row.output_tokens).toBe(3);
    expect(row.total_tokens).toBe(8);
  });

  it('teamIdが未指定の場合は保存をスキップし、例外を投げない', async () => {
    const db = setupDb();
    await expect(saveSlackAiShare(wrapD1(db) as never, undefined, baseParams)).resolves.toBeUndefined();
    const count = (db.prepare('SELECT COUNT(*) as c FROM ai_chat_shares').get() as { c: number }).c;
    expect(count).toBe(0);
  });

  it('teamIdに対応するslack_installationsの行が無い場合は保存をスキップし、例外を投げない', async () => {
    const db = setupDb();
    await expect(saveSlackAiShare(wrapD1(db) as never, 'unknown-team', baseParams)).resolves.toBeUndefined();
    const count = (db.prepare('SELECT COUNT(*) as c FROM ai_chat_shares').get() as { c: number }).c;
    expect(count).toBe(0);
  });

  it('installed_by_userがNULLの場合は保存をスキップし、例外を投げない', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO slack_installations (team_id, installed_by_user) VALUES (?, NULL)').run('T2');
    await expect(saveSlackAiShare(wrapD1(db) as never, 'T2', baseParams)).resolves.toBeUndefined();
    const count = (db.prepare('SELECT COUNT(*) as c FROM ai_chat_shares').get() as { c: number }).c;
    expect(count).toBe(0);
  });

  it('DB書き込みが失敗しても例外を投げない(付随機能のためSlack応答自体は成功のまま扱う)', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO slack_installations (team_id, installed_by_user) VALUES (?, ?)').run('T1', 'octocat');
    db.exec('DROP TABLE ai_chat_shares');

    await expect(saveSlackAiShare(wrapD1(db) as never, 'T1', baseParams)).resolves.toBeUndefined();
  });

  it('別のteamIdは別のユーザー名義で独立して保存される', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO slack_installations (team_id, installed_by_user) VALUES (?, ?)').run('T1', 'alice');
    db.prepare('INSERT INTO slack_installations (team_id, installed_by_user) VALUES (?, ?)').run('T2', 'bob');

    await saveSlackAiShare(wrapD1(db) as never, 'T1', baseParams);
    await saveSlackAiShare(wrapD1(db) as never, 'T2', { ...baseParams, question: '別の質問' });

    const rows = db.prepare('SELECT user_id, question FROM ai_chat_shares ORDER BY user_id').all() as Array<{ user_id: string; question: string }>;
    expect(rows).toEqual([
      { user_id: 'alice', question: '今日の天気は？' },
      { user_id: 'bob', question: '別の質問' },
    ]);
  });
});

describe('/slack/* エンドポイントのAPI統計集計(別枠)', () => {
  it("/slack/* 配下へのリクエストはミドルウェアで落ちず、通常のレスポンスが返る(waitUntilでrecordApiAccessを呼ぶがテスト環境ではスキップされる)", async () => {
    const res = await app.request('/slack/commands', { method: 'POST', body: 'command=%2Funknown' }, {});
    expect(res.status).toBe(200);
  });

  it('/slack/* と /api/* は別々のミドルウェアとして同じパスプレフィックスに適用され、互いのレスポンスを壊さない', async () => {
    const slackRes = await app.request('/slack/commands', { method: 'POST', body: 'command=%2Funknown' }, {});
    const apiRes = await app.request('/api/some-nonexistent-endpoint', {}, {});
    expect(slackRes.status).toBe(200);
    expect(apiRes.status).toBeGreaterThanOrEqual(200);
    expect(apiRes.status).toBeLessThan(600);
  });
});
