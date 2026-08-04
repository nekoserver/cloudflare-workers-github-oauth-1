import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { extractContainedKeywords, buildAnswerPropagationGraph } from './index';

// 対象: 新ページ /answer-graph が使う「起点の回答から、その回答に紐づく
// キーワードを手がかりに関連する回答へ次々と広がっていく様子」をBFSで
// 構築するロジック。
//
// キーワードの出所(重要):
//   各回答のキーワードは aichat_search_log の share_id で当該回答(共有)に
//   紐づけて記録されている(回答モーダルのキーワード一覧 /api/aichat/share-keywords
//   と同じ出所)。グラフの各層のキーワードはこの share_id 紐づけから取得する。
//   「検索履歴全体の人気キーワードを回答本文に部分一致でぶつける」方式は、
//   実装・例外・設計のような汎用語がどの回答にもマッチしてしまい、
//   「その回答のキーワード群」と一致しない結果を生むため使用しない。
//
// 故障シナリオ:
//   (1) 起点の回答が存在しない/他ユーザーの回答を指定した場合に例外を投げる
//   (2) 既に訪問済みの回答が再度ノードとして重複追加される
//   (3) 一度処理したキーワードが別の階層で再度キーワードノードとして重複追加される
//   (4) ループが収束条件を持たず無限に回り続ける(maxDepth/maxNodesで打ち切れるか)
//   (5) 他ユーザーの回答やキーワードが混入する
//   (6) 起点(第1層)のキーワードが maxKeywordsPerLayer で打ち切られ、検索結果の
//       keywordCount と一人称モード最前列のキーワード群が一致しなくなる
//   (7) 検索履歴全体の汎用キーワード(実装・例外・設計等)が、当該回答に
//       紐づいていないのに回答本文への部分一致だけで第1層に混入する

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
      share_id TEXT NOT NULL,
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

function insertKeyword(db: DatabaseSync, userId: string, keyword: string, shareId: string, count = 1) {
  db.prepare(
    `INSERT INTO aichat_search_log (user_id, keyword, share_id, select_count, last_searched_at) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, keyword, shareId, count, '2026-01-01T00:00:00.000Z');
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

  it('起点の回答に紐づくキーワードから、それを含む別の回答へ2段階で広がる', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', '東京駅の見どころは？', '駅周辺には商業施設があります');
    insertShare(db, 's2', 'u1', '大阪の駅は便利？', '駅ナカが充実しています');
    insertKeyword(db, 'u1', '駅', 's1');

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

  it('起点に紐づいていない検索履歴上の汎用キーワードは、回答本文に部分一致しても第1層に混入しない', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', 'Honoのエラー処理について', 'Honoの実装では例外の設計が重要です');
    insertShare(db, 's-other', 'u1', '別の質問', '別の回答');
    // 「実装」「例外」「設計」は別の共有(s-other)に紐づく履歴キーワードで、
    // s1の回答本文には文字列としては含まれる(旧実装だと混入していた)
    insertKeyword(db, 'u1', '実装', 's-other', 50);
    insertKeyword(db, 'u1', '例外', 's-other', 40);
    insertKeyword(db, 'u1', '設計', 's-other', 30);
    // s1に紐づくキーワードはこれだけ
    insertKeyword(db, 'u1', 'Hono', 's1');

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1');

    const depth1Keywords = result!.nodes.filter((n) => n.type === 'keyword' && n.depth === 1).map((n) => n.label);
    expect(depth1Keywords).toEqual(['Hono']);
  });

  it('起点(第1層)のキーワードはmaxKeywordsPerLayerで打ち切られず、起点に紐づく全キーワードがノード化される', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', '起点の質問', '起点の回答本文');
    const kws: string[] = [];
    for (let i = 1; i <= 14; i++) {
      const kw = 'キーワード' + String(i).padStart(2, '0');
      kws.push(kw);
      insertKeyword(db, 'u1', kw, 's1');
    }

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1', { maxKeywordsPerLayer: 12 });

    const depth1Keywords = result!.nodes.filter((n) => n.type === 'keyword' && n.depth === 1).map((n) => n.label);
    expect(depth1Keywords.sort()).toEqual(kws.slice().sort());
  });

  it('第2層以降のキーワードはこれまで通りmaxKeywordsPerLayerで打ち切られる', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', '起点の質問', '起点語 についての回答');
    insertShare(db, 's2', 'u1', '関連質問', '起点語 を含む別の回答');
    insertKeyword(db, 'u1', '起点語', 's1');
    for (let i = 1; i <= 5; i++) {
      insertKeyword(db, 'u1', '深い語' + i, 's2');
    }

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1', { maxKeywordsPerLayer: 2 });

    const depth3Keywords = result!.nodes.filter((n) => n.type === 'keyword' && n.depth === 3);
    expect(depth3Keywords.length).toBeLessThanOrEqual(2);
  });

  it('既に訪問済みの回答は再度ノードとして追加されない', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', '駅と新幹線について', '駅から新幹線に乗ります');
    insertShare(db, 's2', 'u1', '新幹線の駅は？', '駅と新幹線は隣接しています');
    insertKeyword(db, 'u1', '駅', 's1');
    insertKeyword(db, 'u1', '新幹線', 's1');

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1');

    const s2Nodes = result!.nodes.filter((n) => n.id === 'a:s2');
    expect(s2Nodes).toHaveLength(1);
  });

  it('一度処理したキーワードは別の階層で再度キーワードノードとして追加されない', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', '駅について', '駅の話です');
    insertShare(db, 's2', 'u1', '駅の近く', '駅周辺にはお店があります');
    insertShare(db, 's3', 'u1', 'また駅の話', '駅はいいですね');
    insertKeyword(db, 'u1', '駅', 's1');
    insertKeyword(db, 'u1', '駅', 's2');
    insertKeyword(db, 'u1', '駅', 's3');

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1');

    const kwNodes = result!.nodes.filter((n) => n.id === 'k:駅');
    expect(kwNodes).toHaveLength(1);
  });

  it('他ユーザーの回答・キーワードは結果に混入しない', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', '駅について', '駅の話です');
    insertShare(db, 's2', 'u2', '別ユーザーの駅の話', '駅は便利です');
    insertKeyword(db, 'u1', '駅', 's1');
    insertKeyword(db, 'u2', '新幹線', 's1');

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1');

    const ids = result!.nodes.map((n) => n.id);
    expect(ids).not.toContain('a:s2');
    expect(ids).not.toContain('k:新幹線');
  });

  it('maxNodesで打ち切ることでノード数が無限に増えない', async () => {
    const db = setupDb();
    insertShare(db, 's0', 'u1', '起点', '駅の話です');
    insertKeyword(db, 'u1', '駅', 's0');
    for (let i = 1; i <= 20; i++) {
      insertShare(db, 's' + i, 'u1', '駅の話その' + i, '駅について語ります' + i);
      insertKeyword(db, 'u1', '駅の話', 's' + i);
    }

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's0', { maxNodes: 6 });

    expect(result!.nodes.length).toBeLessThanOrEqual(6);
  });

  it('maxDepthで階層の深さを打ち切れる', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', '駅の話', '駅から新幹線に乗ります');
    insertShare(db, 's2', 'u1', '新幹線の話', '新幹線は飛行機より安いことがあります');
    insertKeyword(db, 'u1', '駅', 's1');
    insertKeyword(db, 'u1', '新幹線', 's1');
    insertKeyword(db, 'u1', '飛行機', 's2');

    const result = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1', { maxDepth: 1 });

    const maxDepthFound = Math.max(...result!.nodes.map((n) => n.depth));
    expect(maxDepthFound).toBeLessThanOrEqual(1);
  });
});
