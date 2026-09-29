import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  getOrComputeAnswerEmbedding,
  isAnswerVectorized,
  parsePrerequisiteTermsResponse,
  extractPrerequisiteTerms,
  isAnswerKeywordVectorized,
  getOrComputeAnswerKeywordEmbedding,
  vectorizeAnswerKeywords,
  hasAnswerKeywordVectors,
  listAnswerKeywordVectors,
  getKeywordOccurrenceCounts,
  buildKeywordOccurrenceList,
  getKeywordCategoryColors,
  mergeKeywordOccurrenceWithCategory,
  enrichSearchResultsWithVectorizedFlag,
  isLowValuePrerequisiteTerm,
  filterMeaningfulPrerequisiteTerms,
  PLAMO_EMBEDDING_MODEL,
  ANSWER_PREREQUISITE_TERMS_MODEL,
} from './index';

// 対象: answer-graphの回答モーダル「この回答文をベクタ化する」ボタンが使う
// バックエンド処理。
//   1. getOrComputeAnswerEmbedding: 回答文をplamo-embedding-1bでベクタ化し
//      aichat_answer_vectorsへキャッシュする(getOrComputeKeywordEmbeddingと
//      同じ「同一モデルでキャッシュ済みならAIを呼ばない」方針)
//   2. isAnswerVectorized: 既にベクタ化済みかどうかの判定(モーダルの
//      ボタン表示切り替えに使う)
//   3. parsePrerequisiteTermsResponse / extractPrerequisiteTerms:
//      gemma-4-26b-a4b-itに「この文章を理解するのに必要な予備知識」を
//      単語単位で抽出させる
//
// 故障シナリオ:
//   (1) キャッシュ済みなのに毎回AIを呼んでしまう(コスト増・レイテンシ増)
//   (2) 他ユーザー・他回答・他モデルのキャッシュを誤って参照/上書きする
//   (3) gemma-4-26b-a4b-itの応答に箇条書き記号・番号・読点区切りが混じった
//       場合に用語を正しく分割できない、または重複を除去できない
//   (4) gemma-4-26b-a4b-it呼び出しにsystem messageを含めてしまい、
//       既知の制限(thinking modeが強制されて応答が壊れる)を踏む
//   (5) 予備知識抽出が失敗した場合に例外を伝播させてベクタ化自体まで
//       失敗扱いにしてしまう(ベクタ化とキーワード抽出は独立して扱うべき)

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      const toSqliteArgs = (args: unknown[]) =>
        args.map((a) => (a instanceof ArrayBuffer ? new Uint8Array(a) : a));
      const toD1Row = (row: unknown): unknown => {
        if (row && typeof row === 'object') {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
            out[k] = v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v;
          }
          return out;
        }
        return row;
      };
      return {
        bind(...args: unknown[]) {
          const sqliteArgs = toSqliteArgs(args);
          return {
            async first<T>(): Promise<T | null> {
              const row = stmt.get(...(sqliteArgs as never[]));
              return (row ? (toD1Row(row) as T) : null);
            },
            async all<T>(): Promise<{ results?: T[] }> {
              const rows = stmt.all(...(sqliteArgs as never[])) as unknown[];
              return { results: rows.map(toD1Row) as T[] };
            },
            async run(): Promise<{ meta: { changes: number } }> {
              const res = stmt.run(...(sqliteArgs as never[]));
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
    CREATE TABLE aichat_answer_vectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      share_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      model TEXT NOT NULL,
      dim INTEGER NOT NULL,
      vector BLOB NOT NULL,
      computed_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_aichat_answer_vectors_unique ON aichat_answer_vectors(user_id, share_id, model);
    CREATE TABLE aichat_answer_keyword_vectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      share_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      model TEXT NOT NULL,
      dim INTEGER NOT NULL,
      vector BLOB NOT NULL,
      computed_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_aichat_answer_keyword_vectors_unique ON aichat_answer_keyword_vectors(user_id, share_id, keyword, model);
    CREATE TABLE aichat_search_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      share_id TEXT NOT NULL,
      first_searched_at TEXT NOT NULL,
      last_searched_at TEXT NOT NULL,
      select_count INTEGER NOT NULL DEFAULT 1
    );
    CREATE UNIQUE INDEX idx_aichat_search_log_unique ON aichat_search_log(user_id, keyword, share_id);
    CREATE TABLE aichat_keyword_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE aichat_keyword_category_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES aichat_keyword_categories(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function insertCategory(db: DatabaseSync, userId: string, name: string, color: string): number {
  db.prepare(`INSERT INTO aichat_keyword_categories (user_id, name, color) VALUES (?, ?, ?)`).run(userId, name, color);
  return Number((db.prepare(`SELECT id FROM aichat_keyword_categories WHERE user_id = ? AND name = ?`).get(userId, name) as { id: number }).id);
}

function insertCategoryMap(db: DatabaseSync, userId: string, keyword: string, categoryId: number) {
  db.prepare(`INSERT INTO aichat_keyword_category_map (user_id, keyword, category_id) VALUES (?, ?, ?)`).run(userId, keyword, categoryId);
}

function insertSearchLog(db: DatabaseSync, userId: string, keyword: string, shareId: string, selectCount: number) {
  db.prepare(
    `INSERT INTO aichat_search_log (user_id, keyword, share_id, first_searched_at, last_searched_at, select_count) VALUES (?, ?, ?, '2026-01-01', '2026-01-01', ?)`
  ).run(userId, keyword, shareId, selectCount);
}

function makeMockAi(vector: number[]) {
  return { run: vi.fn().mockResolvedValue({ data: [vector] }) };
}

describe('getOrComputeAnswerEmbedding: 回答文のplamo-embedding-1bベクトルキャッシュ', () => {
  it('未キャッシュの場合はAIを呼び、結果をDBへ保存して返す', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2, 3]);

    const vector = await getOrComputeAnswerEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '駅について');

    expect(vector).toEqual([1, 2, 3]);
    expect(ai.run).toHaveBeenCalledTimes(1);
    const row = db.prepare('SELECT model, dim FROM aichat_answer_vectors WHERE user_id = ? AND share_id = ?').get('u1', 's1') as { model: string; dim: number };
    expect(row.model).toBe(PLAMO_EMBEDDING_MODEL);
    expect(row.dim).toBe(3);
  });

  it('同一モデルでキャッシュ済みの場合はAIを呼ばずキャッシュを返す', async () => {
    const db = setupDb();
    const ai = makeMockAi([9, 9, 9]);

    await getOrComputeAnswerEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '駅について');
    ai.run.mockClear();
    const vector = await getOrComputeAnswerEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '駅について');

    expect(vector).toEqual([9, 9, 9]);
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('別の回答(share_id違い)のキャッシュは参照しない', async () => {
    const db = setupDb();
    const ai1 = makeMockAi([1, 1]);
    await getOrComputeAnswerEmbedding(wrapD1(db) as never, ai1 as never, 'u1', 's1', 'A');

    const ai2 = makeMockAi([2, 2]);
    const vector = await getOrComputeAnswerEmbedding(wrapD1(db) as never, ai2 as never, 'u1', 's2', 'B');

    expect(vector).toEqual([2, 2]);
    expect(ai2.run).toHaveBeenCalledTimes(1);
  });

  it('別ユーザーのキャッシュは参照しない', async () => {
    const db = setupDb();
    const ai1 = makeMockAi([1, 1]);
    await getOrComputeAnswerEmbedding(wrapD1(db) as never, ai1 as never, 'u1', 's1', 'A');

    const ai2 = makeMockAi([2, 2]);
    const vector = await getOrComputeAnswerEmbedding(wrapD1(db) as never, ai2 as never, 'u2', 's1', 'A');

    expect(vector).toEqual([2, 2]);
    expect(ai2.run).toHaveBeenCalledTimes(1);
  });
});

describe('isAnswerVectorized: ベクタ化済みかどうかの判定', () => {
  it('未ベクタ化の場合はfalseを返す', async () => {
    const db = setupDb();
    expect(await isAnswerVectorized(wrapD1(db) as never, 'u1', 's1')).toBe(false);
  });

  it('ベクタ化済みの場合はtrueを返す', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    await getOrComputeAnswerEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', 'A');
    expect(await isAnswerVectorized(wrapD1(db) as never, 'u1', 's1')).toBe(true);
  });

  it('他ユーザーのベクタ化は自分のベクタ化済み判定に影響しない', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    await getOrComputeAnswerEmbedding(wrapD1(db) as never, ai as never, 'u2', 's1', 'A');
    expect(await isAnswerVectorized(wrapD1(db) as never, 'u1', 's1')).toBe(false);
  });
});

describe('parsePrerequisiteTermsResponse: gemma応答からの用語抽出', () => {
  it('1行1語のシンプルな応答をそのまま配列にする', () => {
    expect(parsePrerequisiteTermsResponse('東京駅\n新幹線\n乗車券')).toEqual(['東京駅', '新幹線', '乗車券']);
  });

  it('箇条書き記号(- ・ *)や番号付けを除去する', () => {
    expect(parsePrerequisiteTermsResponse('- 東京駅\n・新幹線\n* 乗車券\n1. 改札')).toEqual(['東京駅', '新幹線', '乗車券', '改札']);
  });

  it('読点・カンマ区切りの応答も1語ずつに分割する', () => {
    expect(parsePrerequisiteTermsResponse('東京駅、新幹線、乗車券')).toEqual(['東京駅', '新幹線', '乗車券']);
  });

  it('重複した用語は1件にまとめる', () => {
    expect(parsePrerequisiteTermsResponse('東京駅\n東京駅\n新幹線')).toEqual(['東京駅', '新幹線']);
  });

  it('空行・空文字は無視する', () => {
    expect(parsePrerequisiteTermsResponse('東京駅\n\n\n新幹線\n')).toEqual(['東京駅', '新幹線']);
  });

  it('空文字列やundefinedを渡しても例外にならず空配列を返す', () => {
    expect(parsePrerequisiteTermsResponse('')).toEqual([]);
    expect(parsePrerequisiteTermsResponse(undefined as unknown as string)).toEqual([]);
  });

  it('<think>タグ等の思考過程が混入していても除去してから抽出する', () => {
    const raw = '<think>これは思考過程です</think>東京駅\n新幹線';
    expect(parsePrerequisiteTermsResponse(raw)).toEqual(['東京駅', '新幹線']);
  });
});

describe('extractPrerequisiteTerms: gemma-4-26b-a4b-itへの問い合わせ', () => {
  it('system messageを含めずuserメッセージのみでAIを呼ぶ(既知のthinking mode強制バグを回避)', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ response: '東京駅\n新幹線' }) };
    await extractPrerequisiteTerms(ai as never, '駅の周辺には新幹線の乗換口があります');

    expect(ai.run).toHaveBeenCalledTimes(1);
    const [calledModel, calledParams] = ai.run.mock.calls[0];
    expect(calledModel).toBe(ANSWER_PREREQUISITE_TERMS_MODEL);
    const messages = (calledParams as { messages: Array<{ role: string }> }).messages;
    expect(messages.every((m) => m.role !== 'system')).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
  });

  it('enable_thinking:falseのchat_template_kwargsを付与する', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ response: '東京駅' }) };
    await extractPrerequisiteTerms(ai as never, 'テスト文章');

    const [, calledParams] = ai.run.mock.calls[0];
    expect((calledParams as { chat_template_kwargs?: { enable_thinking?: boolean } }).chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it('AIの応答(response形式)から用語一覧を抽出する', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ response: '東京駅\n新幹線\n乗車券' }) };
    const terms = await extractPrerequisiteTerms(ai as never, 'テスト文章');
    expect(terms).toEqual(['東京駅', '新幹線', '乗車券']);
  });

  it('AIの応答(choices形式)から用語一覧を抽出する', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ choices: [{ message: { content: '東京駅\n新幹線' } }] }) };
    const terms = await extractPrerequisiteTerms(ai as never, 'テスト文章');
    expect(terms).toEqual(['東京駅', '新幹線']);
  });
});

// 対象: answer-graphの回答モーダルで抽出した予備知識キーワード群を、その
// 回答文(share_id)に紐付けてaichat_answer_keyword_vectorsへベクタ化・登録する
// 処理(isAnswerKeywordVectorized / getOrComputeAnswerKeywordEmbedding /
// vectorizeAnswerKeywords)。
//
// 故障シナリオ:
//   (1) 同じキーワードでも回答文(share_id)が違えば別レコードとして
//       扱わずキャッシュを誤って使い回してしまう
//   (2) 既に登録済みのキーワードにも毎回AIを呼んでしまう
//   (3) ループの途中で1件のベクタ化が失敗すると、残りのキーワードの処理が
//       中断されてしまう(1件の失敗が全体を巻き込むべきではない)
//   (4) ループの結果(alreadyRegistered/新規登録)が抽出順と食い違う

describe('isAnswerKeywordVectorized: 回答文に紐付けたキーワードのベクタ化済み判定', () => {
  it('未登録の場合はfalseを返す', async () => {
    const db = setupDb();
    expect(await isAnswerKeywordVectorized(wrapD1(db) as never, 'u1', 's1', '東京駅')).toBe(false);
  });

  it('登録済みの場合はtrueを返す', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '東京駅');
    expect(await isAnswerKeywordVectorized(wrapD1(db) as never, 'u1', 's1', '東京駅')).toBe(true);
  });

  it('同じキーワードでも回答文(share_id)が異なれば別レコードとして扱う', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '東京駅');
    expect(await isAnswerKeywordVectorized(wrapD1(db) as never, 'u1', 's2', '東京駅')).toBe(false);
  });

  it('他ユーザーの登録は自分の判定に影響しない', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u2', 's1', '東京駅');
    expect(await isAnswerKeywordVectorized(wrapD1(db) as never, 'u1', 's1', '東京駅')).toBe(false);
  });
});

describe('getOrComputeAnswerKeywordEmbedding: キーワード×回答文単位のベクトルキャッシュ', () => {
  it('未キャッシュの場合はAIを呼び、share_idと紐付けてDBへ保存する', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2, 3]);
    const vector = await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '東京駅');
    expect(vector).toEqual([1, 2, 3]);
    expect(ai.run).toHaveBeenCalledTimes(1);
    const row = db.prepare(
      'SELECT share_id, keyword, model, dim FROM aichat_answer_keyword_vectors WHERE user_id = ? AND share_id = ? AND keyword = ?'
    ).get('u1', 's1', '東京駅') as { share_id: string; keyword: string; model: string; dim: number };
    expect(row.share_id).toBe('s1');
    expect(row.keyword).toBe('東京駅');
    expect(row.model).toBe(PLAMO_EMBEDDING_MODEL);
    expect(row.dim).toBe(3);
  });

  it('同一(share_id, keyword, model)で既に登録済みの場合はAIを呼ばずキャッシュを返す', async () => {
    const db = setupDb();
    const ai = makeMockAi([9, 9, 9]);
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '東京駅');
    ai.run.mockClear();
    const vector = await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '東京駅');
    expect(vector).toEqual([9, 9, 9]);
    expect(ai.run).not.toHaveBeenCalled();
  });
});

describe('vectorizeAnswerKeywords: 抽出キーワード群をshare_idに紐付けてループ処理する', () => {
  it('未登録のキーワードは新規にベクタ化してalreadyRegistered:falseを返す', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    const results = await vectorizeAnswerKeywords(wrapD1(db) as never, ai as never, 'u1', 's1', ['東京駅', '新幹線']);
    expect(results).toEqual([
      { keyword: '東京駅', alreadyRegistered: false },
      { keyword: '新幹線', alreadyRegistered: false },
    ]);
    expect(ai.run).toHaveBeenCalledTimes(2);
    expect(await isAnswerKeywordVectorized(wrapD1(db) as never, 'u1', 's1', '東京駅')).toBe(true);
    expect(await isAnswerKeywordVectorized(wrapD1(db) as never, 'u1', 's1', '新幹線')).toBe(true);
  });

  it('既に登録済みのキーワードはAIを呼ばずalreadyRegistered:trueを返す', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '東京駅');
    ai.run.mockClear();

    const results = await vectorizeAnswerKeywords(wrapD1(db) as never, ai as never, 'u1', 's1', ['東京駅', '新幹線']);

    expect(results).toEqual([
      { keyword: '東京駅', alreadyRegistered: true },
      { keyword: '新幹線', alreadyRegistered: false },
    ]);
    expect(ai.run).toHaveBeenCalledTimes(1);
  });

  it('結果は抽出順(渡したkeywords配列の順)のまま返す', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    const results = await vectorizeAnswerKeywords(wrapD1(db) as never, ai as never, 'u1', 's1', ['C', 'A', 'B']);
    expect(results.map((r) => r.keyword)).toEqual(['C', 'A', 'B']);
  });

  it('回答文のベクトルを渡すとキーワードごとのコサイン類似度スコアを返す', async () => {
    const db = setupDb();
    const ai = makeMockAi([3, 4]);

    const results = await vectorizeAnswerKeywords(
      wrapD1(db) as never,
      ai as never,
      'u1',
      's1',
      ['東京駅'],
      PLAMO_EMBEDDING_MODEL,
      [3, 4],
    );

    expect(results).toEqual([
      { keyword: '東京駅', alreadyRegistered: false, similarityScore: 1 },
    ]);
  });

  it('1件のベクタ化が失敗しても残りのキーワードの処理を続ける(1件の失敗で全体を巻き込まない)', async () => {
    const db = setupDb();
    const ai = { run: vi.fn().mockRejectedValueOnce(new Error('AI down')).mockResolvedValue({ data: [[1, 2]] }) };

    const results = await vectorizeAnswerKeywords(wrapD1(db) as never, ai as never, 'u1', 's1', ['東京駅', '新幹線']);

    expect(results[0]).toEqual({ keyword: '東京駅', alreadyRegistered: false, error: 'AI down' });
    expect(results[1]).toEqual({ keyword: '新幹線', alreadyRegistered: false });
    expect(await isAnswerKeywordVectorized(wrapD1(db) as never, 'u1', 's1', '新幹線')).toBe(true);
  });

  it('キーワードが空配列の場合は空配列を返す(AIを呼ばない)', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    const results = await vectorizeAnswerKeywords(wrapD1(db) as never, ai as never, 'u1', 's1', []);
    expect(results).toEqual([]);
    expect(ai.run).not.toHaveBeenCalled();
  });
});

// 対象: answer-graphの回答モーダルで「この回答文をベクタ化する」ボタンの
// 代わりに表示する「ベクタ化済み」バッジ+「キーワード一覧」/「キーワード抽出」
// ボタンの切り替えに使う判定・一覧取得(hasAnswerKeywordVectors /
// listAnswerKeywordVectors)。
//
// 故障シナリオ:
//   (1) 回答文は既にベクタ化済みだがキーワードは1件も紐付いていない場合、
//       誤って「キーワード一覧」(空の一覧)を出してしまう
//   (2) 他ユーザー・他回答文のキーワード登録を自分の判定/一覧に混入させる
//   (3) 一覧に同じキーワードが重複して並ぶ

describe('hasAnswerKeywordVectors: 回答文にキーワードが1件でも登録済みか判定', () => {
  it('1件も登録されていない場合はfalseを返す', async () => {
    const db = setupDb();
    expect(await hasAnswerKeywordVectors(wrapD1(db) as never, 'u1', 's1')).toBe(false);
  });

  it('1件でも登録されていればtrueを返す', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '東京駅');
    expect(await hasAnswerKeywordVectors(wrapD1(db) as never, 'u1', 's1')).toBe(true);
  });

  it('別の回答文(share_id違い)の登録は自分の判定に混入しない', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's2', '東京駅');
    expect(await hasAnswerKeywordVectors(wrapD1(db) as never, 'u1', 's1')).toBe(false);
  });

  it('他ユーザーの登録は自分の判定に混入しない', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u2', 's1', '東京駅');
    expect(await hasAnswerKeywordVectors(wrapD1(db) as never, 'u1', 's1')).toBe(false);
  });
});

describe('listAnswerKeywordVectors: 回答文に登録済みのキーワード一覧を取得', () => {
  it('登録されているキーワードを重複なく返す', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '東京駅');
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '新幹線');
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '東京駅');
    const keywords = await listAnswerKeywordVectors(wrapD1(db) as never, 'u1', 's1');
    expect(keywords.sort()).toEqual(['新幹線', '東京駅']);
  });

  it('未登録の場合は空配列を返す', async () => {
    const db = setupDb();
    expect(await listAnswerKeywordVectors(wrapD1(db) as never, 'u1', 's1')).toEqual([]);
  });

  it('別の回答文(share_id違い)のキーワードは一覧に含めない', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', '東京駅');
    await getOrComputeAnswerKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', 's2', '新幹線');
    expect(await listAnswerKeywordVectors(wrapD1(db) as never, 'u1', 's1')).toEqual(['東京駅']);
  });
});

// 対象: answer-graphの回答モーダル「キーワード一覧」ボタンで、各キーワードが
// AIチャットのキーワードテーブル(aichat_search_log)内で何回出現するかを
// 調べ(getKeywordOccurrenceCounts)、ループ終了後に出現回数の多い順へ
// 並べ替えたリストを作る(buildKeywordOccurrenceList)処理。
//
// 故障シナリオ:
//   (1) 同じキーワードが複数の回答文(share_id違い)に紐づいている場合、
//       select_countを合算せず1件分しかカウントしない
//   (2) 他ユーザーのログを自分の出現回数に混入させる
//   (3) 一度もログに現れていないキーワードで例外になる、またはundefinedのまま
//       ソートが崩れる(0件として扱われるべき)
//   (4) 出現回数が同じでない限り、多い順に並んでいない

describe('getKeywordOccurrenceCounts: キーワードごとのAIチャットキーワードテーブル内出現回数', () => {
  it('複数の回答文(share_id違い)にまたがるselect_countを合算する', async () => {
    const db = setupDb();
    insertSearchLog(db, 'u1', '東京駅', 's1', 2);
    insertSearchLog(db, 'u1', '東京駅', 's2', 3);
    const counts = await getKeywordOccurrenceCounts(wrapD1(db) as never, 'u1', ['東京駅']);
    expect(counts['東京駅']).toBe(5);
  });

  it('他ユーザーのログは自分の出現回数に含めない', async () => {
    const db = setupDb();
    insertSearchLog(db, 'u2', '東京駅', 's1', 10);
    const counts = await getKeywordOccurrenceCounts(wrapD1(db) as never, 'u1', ['東京駅']);
    expect(counts['東京駅']).toBeUndefined();
  });

  it('複数キーワードをまとめて1回のクエリ相当で取得する', async () => {
    const db = setupDb();
    insertSearchLog(db, 'u1', '東京駅', 's1', 4);
    insertSearchLog(db, 'u1', '新幹線', 's1', 1);
    const counts = await getKeywordOccurrenceCounts(wrapD1(db) as never, 'u1', ['東京駅', '新幹線', '乗車券']);
    expect(counts).toEqual({ '東京駅': 4, '新幹線': 1 });
  });

  it('キーワードが空配列の場合は空オブジェクトを返す', async () => {
    const db = setupDb();
    expect(await getKeywordOccurrenceCounts(wrapD1(db) as never, 'u1', [])).toEqual({});
  });
});

describe('buildKeywordOccurrenceList: 出現回数の多い順に並べたリストを作る', () => {
  it('出現回数の多い順に並べ替える', () => {
    const list = buildKeywordOccurrenceList(['東京駅', '新幹線', '乗車券'], { '東京駅': 2, '新幹線': 5, '乗車券': 3 });
    expect(list).toEqual([
      { keyword: '新幹線', count: 5 },
      { keyword: '乗車券', count: 3 },
      { keyword: '東京駅', count: 2 },
    ]);
  });

  it('出現回数が0件(ログに一度も現れていない)キーワードも0件として含める', () => {
    const list = buildKeywordOccurrenceList(['東京駅', '新幹線'], { '新幹線': 1 });
    expect(list).toEqual([
      { keyword: '新幹線', count: 1 },
      { keyword: '東京駅', count: 0 },
    ]);
  });

  it('空配列を渡すと空配列を返す', () => {
    expect(buildKeywordOccurrenceList([], {})).toEqual([]);
  });
});

// 対象: 「キーワード一覧」ボタンのバッジ外枠色を決めるためのカテゴリ分類
// 情報の取得(getKeywordCategoryColors)と、出現回数リストへのマージ
// (mergeKeywordOccurrenceWithCategory)。
//
// 故障シナリオ:
//   (1) 他ユーザーの分類を自分のキーワードの分類として混入させる
//   (2) 分類されていないキーワードにclassified:trueが付いてしまう
//   (3) 1キーワードが複数カテゴリに属する場合に例外になる、または
//       複数件分の色情報が返って呼び出し側の型を壊す
//   (4) マージ時に出現回数の並び順(多い順)が崩れる

describe('getKeywordCategoryColors: キーワードごとの分類カテゴリ色を取得', () => {
  it('分類済みのキーワードにはカテゴリid・色を返す', async () => {
    const db = setupDb();
    const catId = insertCategory(db, 'u1', '交通', '#3b82f6');
    insertCategoryMap(db, 'u1', '東京駅', catId);
    const result = await getKeywordCategoryColors(wrapD1(db) as never, 'u1', ['東京駅']);
    expect(result['東京駅']).toEqual({ categoryId: catId, color: '#3b82f6' });
  });

  it('未分類のキーワードは結果に含まれない', async () => {
    const db = setupDb();
    const result = await getKeywordCategoryColors(wrapD1(db) as never, 'u1', ['東京駅']);
    expect(result['東京駅']).toBeUndefined();
  });

  it('他ユーザーの分類は自分の結果に混入しない', async () => {
    const db = setupDb();
    const catId = insertCategory(db, 'u2', '交通', '#3b82f6');
    insertCategoryMap(db, 'u2', '東京駅', catId);
    const result = await getKeywordCategoryColors(wrapD1(db) as never, 'u1', ['東京駅']);
    expect(result['東京駅']).toBeUndefined();
  });

  it('1キーワードが複数カテゴリに属していても代表1件のみを返す(例外にならない)', async () => {
    const db = setupDb();
    const cat1 = insertCategory(db, 'u1', '交通', '#3b82f6');
    const cat2 = insertCategory(db, 'u1', '観光', '#22c55e');
    insertCategoryMap(db, 'u1', '東京駅', cat1);
    insertCategoryMap(db, 'u1', '東京駅', cat2);
    const result = await getKeywordCategoryColors(wrapD1(db) as never, 'u1', ['東京駅']);
    expect([cat1, cat2]).toContain(result['東京駅'].categoryId);
  });

  it('キーワードが空配列の場合は空オブジェクトを返す', async () => {
    const db = setupDb();
    expect(await getKeywordCategoryColors(wrapD1(db) as never, 'u1', [])).toEqual({});
  });
});

// 対象: answer-graphページの起点検索結果テーブルで、各質問行に対応する回答文が
// 既にベクタ化済み(aichat_answer_vectors)かどうかを付与するenrichSearchResultsWithVectorizedFlag。
// 質問の背景色を薄緑色に塗り分けるために使う。
//
// 故障シナリオ:
//   (1) 他ユーザー・他モデルのベクタ化を自分の判定に混入させる
//   (2) チャンク分割(D1バインド上限)をまたぐと一部の結果が判定漏れする
//   (3) 空配列を渡すと例外になる、または不要なクエリが発行される

describe('enrichSearchResultsWithVectorizedFlag: 検索結果へのベクタ化済みフラグ付与', () => {
  it('未ベクタ化の結果はvectorized:falseを付与する', async () => {
    const db = setupDb();
    const results = await enrichSearchResultsWithVectorizedFlag(wrapD1(db) as never, 'u1', [{ id: 's1' }]);
    expect(results).toEqual([{ id: 's1', vectorized: false }]);
  });

  it('ベクタ化済みの結果はvectorized:trueを付与する', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    await getOrComputeAnswerEmbedding(wrapD1(db) as never, ai as never, 'u1', 's1', 'A');
    const results = await enrichSearchResultsWithVectorizedFlag(wrapD1(db) as never, 'u1', [{ id: 's1' }, { id: 's2' }]);
    expect(results).toEqual([
      { id: 's1', vectorized: true },
      { id: 's2', vectorized: false },
    ]);
  });

  it('他ユーザーのベクタ化は自分の判定に混入しない', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    await getOrComputeAnswerEmbedding(wrapD1(db) as never, ai as never, 'u2', 's1', 'A');
    const results = await enrichSearchResultsWithVectorizedFlag(wrapD1(db) as never, 'u1', [{ id: 's1' }]);
    expect(results).toEqual([{ id: 's1', vectorized: false }]);
  });

  it('D1バインド上限(90件)をまたぐ件数でも全件を正しく判定する', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2]);
    const ids = Array.from({ length: 150 }, (_, i) => `s${i}`);
    for (const id of ['s0', 's149']) {
      await getOrComputeAnswerEmbedding(wrapD1(db) as never, ai as never, 'u1', id, id);
    }
    const results = await enrichSearchResultsWithVectorizedFlag(wrapD1(db) as never, 'u1', ids.map((id) => ({ id })));
    expect(results).toHaveLength(150);
    expect(results.find((r) => r.id === 's0')?.vectorized).toBe(true);
    expect(results.find((r) => r.id === 's149')?.vectorized).toBe(true);
    expect(results.find((r) => r.id === 's75')?.vectorized).toBe(false);
  });

  it('空配列の場合は空配列を返す', async () => {
    const db = setupDb();
    expect(await enrichSearchResultsWithVectorizedFlag(wrapD1(db) as never, 'u1', [])).toEqual([]);
  });
});

describe('mergeKeywordOccurrenceWithCategory: 出現回数リストへの分類情報マージ', () => {
  it('分類済みキーワードにclassified:trueとcategoryColorを付与する', () => {
    const merged = mergeKeywordOccurrenceWithCategory(
      [{ keyword: '東京駅', count: 3 }],
      { '東京駅': { categoryId: 1, color: '#3b82f6' } },
    );
    expect(merged).toEqual([{ keyword: '東京駅', count: 3, classified: true, categoryColor: '#3b82f6' }]);
  });

  it('未分類キーワードにはclassified:falseとcategoryColor:nullを付与する', () => {
    const merged = mergeKeywordOccurrenceWithCategory([{ keyword: '新幹線', count: 1 }], {});
    expect(merged).toEqual([{ keyword: '新幹線', count: 1, classified: false, categoryColor: null }]);
  });

  it('出現回数の並び順(入力順)を保持する', () => {
    const merged = mergeKeywordOccurrenceWithCategory(
      [{ keyword: 'B', count: 5 }, { keyword: 'A', count: 2 }],
      {},
    );
    expect(merged.map((m) => m.keyword)).toEqual(['B', 'A']);
  });
});

// 対象: 「この回答文をベクタ化する」ボタンで、未登録の予備知識キーワードを
// ベクタ化・登録する前に、意味の薄い語(英数字だけの語・ひらがなカタカナ
// 1文字だけの語)を弾くフィルタ。
//
// 故障シナリオ:
//   (1) "AI"や"GPT4"のような英数字だけの語(複数文字)を除外し損なう
//   (2) アルファベット1文字("A"等)を除外し損なう
//   (3) ひらがな・カタカナ1文字("あ"・"ア"・"ー"等)を除外し損なう
//   (4) 漢字1文字や、英数字+日本語が混在した語(例: "iOS版")まで
//       誤って除外してしまう
describe('isLowValuePrerequisiteTerm: 意味の薄い予備知識キーワードの判定', () => {
  it('英数字だけの語(複数文字)はtrue', () => {
    expect(isLowValuePrerequisiteTerm('GPT4')).toBe(true);
    expect(isLowValuePrerequisiteTerm('2024')).toBe(true);
    expect(isLowValuePrerequisiteTerm('AI')).toBe(true);
  });

  it('アルファベット1文字・数字1文字はtrue', () => {
    expect(isLowValuePrerequisiteTerm('A')).toBe(true);
    expect(isLowValuePrerequisiteTerm('a')).toBe(true);
    expect(isLowValuePrerequisiteTerm('1')).toBe(true);
  });

  it('ひらがな1文字・カタカナ1文字はtrue', () => {
    expect(isLowValuePrerequisiteTerm('あ')).toBe(true);
    expect(isLowValuePrerequisiteTerm('ア')).toBe(true);
    expect(isLowValuePrerequisiteTerm('ー')).toBe(true);
  });

  it('漢字1文字はfalse(除外しない)', () => {
    expect(isLowValuePrerequisiteTerm('駅')).toBe(false);
  });

  it('ひらがな・カタカナ2文字以上の語はfalse(除外しない)', () => {
    expect(isLowValuePrerequisiteTerm('あい')).toBe(false);
    expect(isLowValuePrerequisiteTerm('アイ')).toBe(false);
  });

  it('英数字と日本語が混在した語はfalse(除外しない)', () => {
    expect(isLowValuePrerequisiteTerm('iOS版')).toBe(false);
    expect(isLowValuePrerequisiteTerm('新幹線')).toBe(false);
  });

  it('空文字はfalse', () => {
    expect(isLowValuePrerequisiteTerm('')).toBe(false);
  });
});

describe('filterMeaningfulPrerequisiteTerms: 意味の薄い語を取り除く', () => {
  it('意味の薄い語だけを除外し、残りは順序を保ったまま返す', () => {
    const result = filterMeaningfulPrerequisiteTerms(['新幹線', 'A', 'GPT4', '駅', 'あ', '改札']);
    expect(result).toEqual(['新幹線', '駅', '改札']);
  });

  it('全て意味の薄い語なら空配列を返す', () => {
    expect(filterMeaningfulPrerequisiteTerms(['A', 'あ', 'ア', '123'])).toEqual([]);
  });

  it('空配列を渡すと空配列を返す', () => {
    expect(filterMeaningfulPrerequisiteTerms([])).toEqual([]);
  });
});
