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
  `);
  return db;
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
