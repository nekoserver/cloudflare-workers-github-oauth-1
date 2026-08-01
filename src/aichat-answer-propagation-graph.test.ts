import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { extractContainedKeywords, buildAnswerPropagationGraph } from './index';

// 対象: 新ページ /answer-graph が使う「起点の回答から、含まれるキーワードを
// 手がかりに関連する回答へ次々と広がっていく様子」をBFSで構築するロジック。
//
// アルゴリズム(ユーザー指定):
//   1. 起点の回答に含まれる全キーワードそれぞれについてループし、
//      そのキーワードを含む回答を(既に処理済みの回答を除いて)すべて抽出する。
//      各キーワードはループの終了間際に「処理済み」としてpushする。
//   2. 得られた回答群をソート・重複除去し、その回答ループの中で
//      まだ処理していないキーワードを抽出し、1に戻って繰り返す。
//
// 故障シナリオ:
//   (1) 起点の回答が存在しない/他ユーザーの回答を指定した場合に例外を投げる
//   (2) 既に訪問済みの回答が再度ノードとして重複追加される
//   (3) 一度処理したキーワードが別の階層で再度キーワードノードとして重複追加される
//   (4) ループが収束条件を持たず無限に回り続ける(maxDepth/maxNodesで打ち切れるか)
//   (5) 他ユーザーの回答やキーワードが混入する

describe('extractContainedKeywords: テキストに含まれる登録済みキーワードの抽出', () => {
  it('テキストに含まれるキーワードだけを返す(大文字小文字を区別しない)', () => {
    const result = extractContainedKeywords('東京駅から新幹線で移動します', ['東京駅', '新幹線', '無関係']);
    expect(result).toEqual(['東京駅', '新幹線']);
  });

  it('一致するキーワードが無ければ空配列を返す', () => {
    expect(extractContainedKeywords('こんにちは', ['東京駅'])).toEqual([]);
  });

  it('空文字キーワードは無視する', () => {
    expect(extractContainedKeywords('テスト', ['', 'テスト'])).toEqual(['テスト']);
  });
});

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async all<T>(): Promise<{ results?: T[] }> {
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
      created_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE aichat_search_log (
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      select_count INTEGER NOT NULL DEFAULT 1,
      last_searched_at TEXT NOT NULL
    );
  `);
  return db;
}

function insertShare(db: DatabaseSync, id: string, userId: string, question: string, answer: string, createdAt = '2026-01-01T00:00:00.000Z') {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, userId, question, answer, createdAt);
}

function insertKeyword(db: DatabaseSync, userId: string, keyword: string, count = 1) {
  db.prepare(
    `INSERT INTO aichat_search_log (user_id, keyword, select_count, last_searched_at) VALUES (?, ?, ?, ?)`
  ).run(userId, keyword, count, '2026-01-01T00:00:00.000Z');
}

describe('buildAnswerPropagationGraph: 回答伝播グラフの構築', () => {
  it('起点の回答が存在しない場合は null を返す', async () => {
    const db = setupDb();
    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 'missing');
    expect(result).toBeNull();
  });

  it('他ユーザーの回答IDを指定した場合は null を返す(越境防止)', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u2', '質問A', '駅について');
    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1');
    expect(result).toBeNull();
  });

  it('起点の回答に含まれるキーワードから、それを含む別の回答へ2段階で広がる', async () => {
    const db = setupDb();
    insertKeyword(db, 'u1', '駅');
    insertShare(db, 's1', 'u1', '東京駅の見どころは？', '駅周辺には商業施設があります');
    insertShare(db, 's2', 'u1', '大阪の駅は便利？', '駅ナカが充実しています');

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1');

    expect(result).not.toBeNull();
    const ids = result!.nodes.map((n) => n.id);
    expect(ids).toContain('a:s1');
    expect(ids).toContain('k:駅');
    expect(ids).toContain('a:s2');
    const kwNode = result!.nodes.find((n) => n.id === 'k:駅')!;
    expect(kwNode.type).toBe('keyword');
    expect(kwNode.depth).toBe(1);
    const s2Node = result!.nodes.find((n) => n.id === 'a:s2')!;
    expect(s2Node.depth).toBe(2);
    expect(result!.edges).toContainEqual({ from: 'a:s1', to: 'k:駅' });
    expect(result!.edges).toContainEqual({ from: 'k:駅', to: 'a:s2' });
  });

  it('既に訪問済みの回答は再度ノードとして追加されない', async () => {
    const db = setupDb();
    insertKeyword(db, 'u1', '駅');
    insertKeyword(db, 'u1', '新幹線');
    insertShare(db, 's1', 'u1', '駅と新幹線について', '駅から新幹線に乗ります');
    insertShare(db, 's2', 'u1', '新幹線の駅は？', '駅と新幹線は隣接しています');

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1');

    const s2Nodes = result!.nodes.filter((n) => n.id === 'a:s2');
    expect(s2Nodes).toHaveLength(1);
  });

  it('一度処理したキーワードは別の階層で再度キーワードノードとして追加されない', async () => {
    const db = setupDb();
    insertKeyword(db, 'u1', '駅');
    insertShare(db, 's1', 'u1', '駅について', '駅の話です');
    insertShare(db, 's2', 'u1', '駅の近く', '駅周辺にはお店があります');
    insertShare(db, 's3', 'u1', 'また駅の話', '駅はいいですね');

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1');

    const kwNodes = result!.nodes.filter((n) => n.id === 'k:駅');
    expect(kwNodes).toHaveLength(1);
  });

  it('他ユーザーの回答・キーワードは結果に混入しない', async () => {
    const db = setupDb();
    insertKeyword(db, 'u1', '駅');
    insertShare(db, 's1', 'u1', '駅について', '駅の話です');
    insertShare(db, 's2', 'u2', '別ユーザーの駅の話', '駅は便利です');

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1');

    const ids = result!.nodes.map((n) => n.id);
    expect(ids).not.toContain('a:s2');
  });

  it('maxNodesで打ち切ることでノード数が無限に増えない', async () => {
    const db = setupDb();
    insertKeyword(db, 'u1', '駅');
    insertShare(db, 's0', 'u1', '起点', '駅の話です');
    for (let i = 1; i <= 20; i++) {
      insertShare(db, 's' + i, 'u1', '駅の話その' + i, '駅について語ります' + i);
    }

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's0', { maxNodes: 6 });

    expect(result!.nodes.length).toBeLessThanOrEqual(6);
  });

  it('maxDepthで階層の深さを打ち切れる', async () => {
    const db = setupDb();
    insertKeyword(db, 'u1', '駅');
    insertKeyword(db, 'u1', '新幹線');
    insertKeyword(db, 'u1', '飛行機');
    insertShare(db, 's1', 'u1', '駅の話', '駅から新幹線に乗ります');
    insertShare(db, 's2', 'u1', '新幹線の話', '新幹線は飛行機より安いことがあります');
    insertShare(db, 's3', 'u1', '飛行機の話', '飛行機は速いです');

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1', { maxDepth: 1 });

    const maxDepthFound = Math.max(...result!.nodes.map((n) => n.depth));
    expect(maxDepthFound).toBeLessThanOrEqual(1);
  });
});
