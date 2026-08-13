import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

// 対象: POST /api/aichat/moondream-analysis のロジックと同一の
// recordAichatMoondreamAnalysis 相当の処理(D1Databaseを直接受け取る非exportな
// 関数のため、ここでは同じSQLをそのまま再現してテストする)。
// AIチャットの画像添付投稿でMoondreamに問い合わせた分析結果を、回答文
// (share_id)・画像(image_id)に紐づけて aichat_moondream_analyses へ保存する。
// /api/aichat(回答本体)と/api/moondream-analyze(画像分析)は並行に呼ばれるため、
// 両方が揃った時点でクライアントから改めてこのAPIが呼ばれる想定。
//
// 故障シナリオ:
//   (1) shareIdが他ユーザーのものだと保存できてしまう(データ越境)
//   (2) 画像添付の無い回答(image_id NULL)に対しても保存できてしまう
//   (3) 同じ回答に対して2回保存すると2行できてしまう(UNIQUE(share_id)違反の
//       ハンドリング漏れ)
//   (4) 論理削除済みの回答に対しても保存できてしまう

interface D1Row {
  [key: string]: unknown;
}

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async first<T = D1Row>(): Promise<T | null> {
              const row = stmt.get(...(args as never[])) as unknown as T | undefined;
              return row ?? null;
            },
            async all<T = D1Row>(): Promise<{ results?: T[] }> {
              const rows = stmt.all(...(args as never[])) as unknown as T[];
              return { results: rows };
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
    CREATE TABLE ai_chat_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      image_id TEXT,
      deleted_at TEXT
    );
    CREATE TABLE aichat_moondream_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      share_id TEXT NOT NULL,
      image_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      model TEXT NOT NULL,
      analysis_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX idx_aichat_moondream_analyses_share ON aichat_moondream_analyses(share_id);
  `);
  return db;
}

// src/index.ts の recordAichatMoondreamAnalysis と同一のロジック
async function recordAichatMoondreamAnalysis(
  db: ReturnType<typeof wrapD1>,
  userId: string,
  shareId: string,
  analysisText: string,
  model: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const share = await db.prepare(
    'SELECT image_id FROM ai_chat_shares WHERE id = ? AND user_id = ? AND deleted_at IS NULL'
  ).bind(shareId, userId).first<{ image_id: string | null }>();
  if (!share) return { ok: false, error: '指定された回答が見つかりません' };
  if (!share.image_id) return { ok: false, error: '指定された回答には画像添付がありません' };

  await db.prepare(
    'INSERT OR IGNORE INTO aichat_moondream_analyses (share_id, image_id, user_id, model, analysis_text) VALUES (?, ?, ?, ?, ?)'
  ).bind(shareId, share.image_id, userId, model, analysisText).run();
  return { ok: true };
}

describe('recordAichatMoondreamAnalysis', () => {
  it('画像添付済みの自分の回答には保存できる', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO ai_chat_shares (id, user_id, image_id) VALUES ('s1', 'user1', 'img1')`).run();
    const wrapped = wrapD1(db);

    const result = await recordAichatMoondreamAnalysis(wrapped, 'user1', 's1', '猫が写っています', 'moondream3.1');
    expect(result.ok).toBe(true);

    const row = db.prepare('SELECT * FROM aichat_moondream_analyses WHERE share_id = ?').get('s1') as D1Row;
    expect(row.image_id).toBe('img1');
    expect(row.user_id).toBe('user1');
    expect(row.analysis_text).toBe('猫が写っています');
  });

  it('他ユーザーのshareIdでは保存できない', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO ai_chat_shares (id, user_id, image_id) VALUES ('s1', 'user2', 'img1')`).run();
    const wrapped = wrapD1(db);

    const result = await recordAichatMoondreamAnalysis(wrapped, 'user1', 's1', '猫が写っています', 'moondream3.1');
    expect(result.ok).toBe(false);

    const count = db.prepare('SELECT COUNT(*) AS cnt FROM aichat_moondream_analyses').get() as { cnt: number };
    expect(count.cnt).toBe(0);
  });

  it('画像添付のない回答(image_id NULL)には保存できない', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO ai_chat_shares (id, user_id, image_id) VALUES ('s1', 'user1', NULL)`).run();
    const wrapped = wrapD1(db);

    const result = await recordAichatMoondreamAnalysis(wrapped, 'user1', 's1', '猫が写っています', 'moondream3.1');
    expect(result.ok).toBe(false);
  });

  it('論理削除済みの回答には保存できない', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO ai_chat_shares (id, user_id, image_id, deleted_at) VALUES ('s1', 'user1', 'img1', '2026-08-01T00:00:00Z')`).run();
    const wrapped = wrapD1(db);

    const result = await recordAichatMoondreamAnalysis(wrapped, 'user1', 's1', '猫が写っています', 'moondream3.1');
    expect(result.ok).toBe(false);
  });

  it('同じ回答に対して2回保存しても1行のまま(UNIQUE(share_id)により2回目は無視)', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO ai_chat_shares (id, user_id, image_id) VALUES ('s1', 'user1', 'img1')`).run();
    const wrapped = wrapD1(db);

    await recordAichatMoondreamAnalysis(wrapped, 'user1', 's1', '1回目の分析', 'moondream3.1');
    const second = await recordAichatMoondreamAnalysis(wrapped, 'user1', 's1', '2回目の分析(無視されるべき)', 'moondream3.1');
    expect(second.ok).toBe(true);

    const rows = db.prepare('SELECT * FROM aichat_moondream_analyses WHERE share_id = ?').all('s1') as D1Row[];
    expect(rows).toHaveLength(1);
    expect(rows[0].analysis_text).toBe('1回目の分析');
  });
});
