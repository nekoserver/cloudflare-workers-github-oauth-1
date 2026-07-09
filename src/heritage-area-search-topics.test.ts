import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { buildFuzzySearchLikePattern, HERITAGE_AREA_SEARCH_TOPICS } from './index';

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
            async all<T = D1Row>(): Promise<{ results?: T[] }> {
              const rows = stmt.all(...(args as never[])) as unknown as T[];
              return { results: rows };
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
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE aichat_search_impressions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      share_id TEXT NOT NULL,
      result_count INTEGER,
      searched_at TEXT NOT NULL,
      deleted_at TEXT
    );
  `);
  return db;
}

// heritage-area検索エンドポイント(src/index.ts の POST /api/heritage-area/search)と
// 同一のWHERE句構築ロジックを実データで再現し、実際に生成される質問文
// (`「地名」の「トピック」について説明してください`)がヒットするかを検証する。
async function runHeritageAreaSearch(db: DatabaseSync, keyword: string) {
  const real = wrapD1(db);
  const keywords = [keyword];
  const topics = HERITAGE_AREA_SEARCH_TOPICS;
  const keywordWhere = keywords.map(() => `(s.question LIKE ? ESCAPE '\\' OR s.answer LIKE ? ESCAPE '\\')`).join(' OR ');
  const topicWhere = topics.map(() => `s.question LIKE ? ESCAPE '\\'`).join(' OR ');
  const keywordParams = keywords.flatMap((kw) => {
    const pattern = buildFuzzySearchLikePattern(kw);
    return [pattern, pattern];
  });
  const topicParams = topics.map((topic) => buildFuzzySearchLikePattern(topic));
  const rows = await real.prepare(
    `SELECT s.question AS item_name, COUNT(DISTINCT i.id) AS impression_count
     FROM aichat_search_impressions i
     JOIN ai_chat_shares s ON s.id = i.share_id AND s.user_id = i.user_id AND s.deleted_at IS NULL
     WHERE i.user_id = ? AND i.deleted_at IS NULL AND (${keywordWhere}) AND (${topicWhere})
     GROUP BY i.share_id, s.question`
  ).bind('user1', ...keywordParams, ...topicParams).all<{ item_name: string; impression_count: number }>();
  return rows.results ?? [];
}

function insertShare(db: DatabaseSync, id: string, question: string) {
  db.prepare(`INSERT INTO ai_chat_shares (id, user_id, question, answer) VALUES (?, ?, ?, ?)`)
    .run(id, 'user1', question, '回答本文');
  db.prepare(`INSERT INTO aichat_search_impressions (user_id, share_id, result_count, searched_at) VALUES (?, ?, ?, ?)`)
    .run('user1', id, 1, '2026-01-01T00:00:00.000Z');
}

describe('HERITAGE_AREA_SEARCH_TOPICS は実際に生成される質問文のtopicと一致する', () => {
  it('質問文生成テンプレートに存在しない「最寄り駅」を含まない', () => {
    expect(HERITAGE_AREA_SEARCH_TOPICS).not.toContain('最寄り駅');
  });

  it('実際に生成される4トピック（見どころ/最寄り空港/鉄道でのアクセス/宿泊施設）のみを含む', () => {
    expect(HERITAGE_AREA_SEARCH_TOPICS).toEqual(['見どころ', '最寄り空港', '鉄道でのアクセス', '宿泊施設']);
  });

  it('「鉄道でのアクセス」トピックの実質問がヒットする', async () => {
    const db = setupDb();
    insertShare(db, 's1', '「立山黒部アルペンルート」の「鉄道でのアクセス」について説明してください');
    const results = await runHeritageAreaSearch(db, '立山黒部アルペンルート');
    expect(results).toHaveLength(1);
    expect(results[0].item_name).toContain('鉄道でのアクセス');
  });

  it('バグ再現: 存在しない「最寄り駅」をtopicsに使うと実質問文が一つもヒットしない', async () => {
    const db = setupDb();
    insertShare(db, 's1', '「立山黒部アルペンルート」の「鉄道でのアクセス」について説明してください');
    const brokenTopics = ['見どころ', '最寄り空港', '最寄り駅', '宿泊施設'];
    const real = wrapD1(db);
    const keywordWhere = `(s.question LIKE ? ESCAPE '\\' OR s.answer LIKE ? ESCAPE '\\')`;
    const topicWhere = brokenTopics.map(() => `s.question LIKE ? ESCAPE '\\'`).join(' OR ');
    const pattern = buildFuzzySearchLikePattern('立山黒部アルペンルート');
    const topicParams = brokenTopics.map((topic) => buildFuzzySearchLikePattern(topic));
    const rows = await real.prepare(
      `SELECT s.question AS item_name
       FROM aichat_search_impressions i
       JOIN ai_chat_shares s ON s.id = i.share_id AND s.user_id = i.user_id AND s.deleted_at IS NULL
       WHERE i.user_id = ? AND i.deleted_at IS NULL AND (${keywordWhere}) AND (${topicWhere})
       GROUP BY i.share_id, s.question`
    ).bind('user1', pattern, pattern, ...topicParams).all<{ item_name: string }>();
    expect(rows.results ?? []).toHaveLength(0);
  });
});
