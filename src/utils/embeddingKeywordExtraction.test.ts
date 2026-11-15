import { describe, it, expect, vi } from 'vitest';
import {
  KEYWORD_EXTRACTION_EMBEDDING_MODEL,
  KEYWORD_EXTRACTION_TOP_K,
  KEYWORD_EXTRACTION_MAX_CANDIDATES,
  KEYWORD_EXTRACTION_SCORE_METHOD,
  LLM_KEYWORD_EXTRACTION_SCORE_METHOD,
  extractKeywordCandidates,
  parseEmbeddingGemma2Vectors,
  rankCandidatesBySimilarity,
  extractKeywordsWithEmbedding,
  extractKeywordsWithFallback,
} from './embeddingKeywordExtraction';

// 対象:
//   予備知識キーワードの切り出し(extractPrerequisiteTerms)を、gemma-4-26b-a4b-it
//   (文章生成)からEmbeddingGemma 2(@cf/google/embeddinggemma-2、埋め込み)へ
//   置き換え、EmbeddingGemma 2が使えないときだけgemma-4へフォールバックする。
//   埋め込みモデルは文章を生成できないため、本文から候補語を拾い、本文全体との
//   コサイン類似度で順位付けして上位を返す。
//
// 故障シナリオ:
//   (1) EmbeddingGemma 2の入出力形式(input: string[] → data[i].embedding)を
//       従来の埋め込みモデル(text: string[] → data: number[][])と同じだと
//       思い込み、ベクトルが取れず常に空になる
//   (2) 候補語の抽出が漢字・カタカナの複合語(例: 量子コンピュータ)を分断する
//   (3) 本文と無関係な候補が上位に来る(類似度順になっていない)
//   (4) EmbeddingGemma 2が例外・空応答・件数不一致を返したのに、空配列を
//       「キーワードなし」として返し、gemma-4へフォールバックしない
//   (5) フォールバックしたことが呼び出し元から分からない(握りつぶし)
//   (6) 候補が0件の本文でも無駄にgemma-4を呼ぶ
//   (7) 候補数に上限がなく、長い本文で埋め込みの入力が膨れ上がる

function vecFor(text: string, table: Record<string, number[]>): number[] {
  for (const [key, v] of Object.entries(table)) {
    if (text.includes(key)) return v;
  }
  return [0, 0, 1];
}

function makeEmbeddingAi(table: Record<string, number[]>) {
  return {
    run: vi.fn(async (model: unknown, params: { input: string[] }) => {
      if (model !== KEYWORD_EXTRACTION_EMBEDDING_MODEL) throw new Error('unexpected model: ' + model);
      return {
        object: 'list',
        model,
        data: params.input.map((t, i) => ({ object: 'embedding', index: i, embedding: vecFor(t, table) })),
      };
    }),
  };
}

describe('extractKeywordCandidates: 本文からの候補語の抽出', () => {
  it('漢字・カタカナの複合語を1語として拾い、ひらがなで区切る', () => {
    const terms = extractKeywordCandidates('量子コンピュータは重ね合わせ状態を利用して計算します。');
    expect(terms).toContain('量子コンピュータ');
    expect(terms).toContain('状態');
    expect(terms).toContain('利用');
    expect(terms).toContain('計算');
  });

  it('記号を含む英字の技術用語(Node.jsなど)を拾う', () => {
    expect(extractKeywordCandidates('Node.jsとCloudflare Workersで動かす')).toEqual(
      expect.arrayContaining(['Node.js', 'Cloudflare', 'Workers']),
    );
  });

  it('1文字の語・長音だけの並び・ありふれた語(場合・必要など)を除外し、重複を取り除く', () => {
    const terms = extractKeywordCandidates('必要な場合は猫と猫と猫。ーー データベース データベース');
    expect(terms).not.toContain('必要');
    expect(terms).not.toContain('場合');
    expect(terms).not.toContain('猫');
    expect(terms).not.toContain('ーー');
    expect(terms.filter((t) => t === 'データベース')).toHaveLength(1);
  });

  it('候補はKEYWORD_EXTRACTION_MAX_CANDIDATES件までに絞り、出現回数の多い語を優先する', () => {
    const many = Array.from({ length: 200 }, (_, i) => 'カタカナ' + String.fromCharCode(0x30a2 + (i % 80)) + '語' + i).join('、');
    const text = many + '、頻出語句、頻出語句、頻出語句';
    const terms = extractKeywordCandidates(text);
    expect(terms.length).toBe(KEYWORD_EXTRACTION_MAX_CANDIDATES);
    expect(terms).toContain('頻出語句');
  });
});

describe('parseEmbeddingGemma2Vectors: EmbeddingGemma 2の応答の解釈', () => {
  it('data[i].embeddingをindex順に取り出す', () => {
    const res = { data: [{ index: 1, embedding: [2] }, { index: 0, embedding: [1] }] };
    expect(parseEmbeddingGemma2Vectors(res, 2)).toEqual({ ok: true, vectors: [[1], [2]] });
  });

  it('件数が合わない・形式が違う応答は失敗として返す(空配列で成功扱いにしない)', () => {
    expect(parseEmbeddingGemma2Vectors({ data: [{ index: 0, embedding: [1] }] }, 2).ok).toBe(false);
    expect(parseEmbeddingGemma2Vectors({ data: [[1, 2], [3, 4]] }, 2).ok).toBe(false);
    expect(parseEmbeddingGemma2Vectors(null, 1).ok).toBe(false);
  });
});

describe('rankCandidatesBySimilarity: 本文との類似度による順位付け', () => {
  it('本文ベクトルに近い順に並べ、topK件に絞る', () => {
    const ranked = rankCandidatesBySimilarity(
      [1, 0],
      ['遠い', '近い', '中間'],
      [[0, 1], [1, 0], [1, 1]],
      2,
    );
    expect(ranked.map((r) => r.term)).toEqual(['近い', '中間']);
    expect(ranked[0]).toEqual({ term: '近い', score: 1, vector: [1, 0] });
  });
});

describe('extractKeywordsWithEmbedding: EmbeddingGemma 2による切り出し', () => {
  it('本文1件+候補をまとめて1回でベクトル化し、本文に近い語から返す', async () => {
    const ai = makeEmbeddingAi({ 'text:': [1, 0, 0], 'query: 量子': [0.9, 0.1, 0], 'query: 状態': [0.1, 0.9, 0] });
    const result = await extractKeywordsWithEmbedding(ai as never, '量子コンピュータは状態を使う');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.terms[0]).toBe('量子コンピュータ');
    expect(result.analysis.documentVector).toEqual([1, 0, 0]);
    expect(result.analysis.candidateCount).toBe(2);
    expect(result.analysis.keywords[0].term).toBe('量子コンピュータ');
    expect(result.analysis.keywords[0].score).toBeGreaterThan(result.analysis.keywords[1].score);
    expect(ai.run).toHaveBeenCalledTimes(1);
    const params = ai.run.mock.calls[0][1] as { input: string[] };
    expect(params.input[0].startsWith('title: none | text: ')).toBe(true);
    expect(params.input.slice(1).every((s) => s.startsWith('task: search result | query: '))).toBe(true);
  });

  it(`返す語はKEYWORD_EXTRACTION_TOP_K件まで`, async () => {
    const words = Array.from({ length: 40 }, (_, i) => 'カタカナ' + String.fromCharCode(0x30a2 + i)).join('、');
    const ai = makeEmbeddingAi({});
    const result = await extractKeywordsWithEmbedding(ai as never, words);
    expect(result.ok && result.terms.length).toBe(KEYWORD_EXTRACTION_TOP_K);
  });

  it('候補が0件ならAIを呼ばず空で成功を返す', async () => {
    const ai = makeEmbeddingAi({});
    const result = await extractKeywordsWithEmbedding(ai as never, 'これはひらがなだけ');
    expect(result).toEqual({ ok: true, terms: [], analysis: { documentVector: [], candidateCount: 0, keywords: [] } });
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('AIが例外を投げたらAI_ERRORで失敗を返す', async () => {
    const ai = { run: vi.fn(async () => { throw new Error('5007: model not found'); }) };
    const result = await extractKeywordsWithEmbedding(ai as never, '量子コンピュータ');
    expect(result).toEqual({ ok: false, errorCode: 'AI_ERROR', detail: '5007: model not found' });
  });

  it('旧形式(data: number[][])の応答はAI_UNEXPECTED_FORMATで失敗を返す', async () => {
    const ai = { run: vi.fn(async () => ({ data: [[1, 0], [1, 0]] })) };
    const result = await extractKeywordsWithEmbedding(ai as never, '量子コンピュータ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe('AI_UNEXPECTED_FORMAT');
  });
});

describe('extractKeywordsWithFallback: 失敗時のgemma-4へのフォールバック', () => {
  it('EmbeddingGemma 2が成功すればgemma-4を呼ばない', async () => {
    const ai = makeEmbeddingAi({});
    const llm = vi.fn(async () => ['使われない']);
    const result = await extractKeywordsWithFallback(ai as never, '量子コンピュータ', llm);
    expect(result.terms).toEqual(['量子コンピュータ']);
    expect(result.usedModel).toBe(KEYWORD_EXTRACTION_EMBEDDING_MODEL);
    expect(result.fallback).toBeNull();
    expect(result.scoreMethod).toBe(KEYWORD_EXTRACTION_SCORE_METHOD);
    expect(result.analysis?.documentVector).toEqual([0, 0, 1]);
    expect(result.analysis?.keywords).toEqual([{ term: '量子コンピュータ', score: 1, vector: [0, 0, 1] }]);
    expect(llm).not.toHaveBeenCalled();
  });

  it('EmbeddingGemma 2が失敗したらgemma-4の結果を返し、失敗の理由を伝える', async () => {
    const ai = { run: vi.fn(async () => { throw new Error('boom'); }) };
    const llm = vi.fn(async () => ['量子', '重ね合わせ']);
    const result = await extractKeywordsWithFallback(ai as never, '量子コンピュータ', llm, '@cf/google/gemma-4-26b-a4b-it');
    expect(result.terms).toEqual(['量子', '重ね合わせ']);
    expect(result.usedModel).toBe('@cf/google/gemma-4-26b-a4b-it');
    expect(result.fallback).toEqual({ errorCode: 'AI_ERROR', detail: 'boom' });
    expect(result.analysis).toBeNull();
    expect(result.scoreMethod).toBe(LLM_KEYWORD_EXTRACTION_SCORE_METHOD);
    expect(llm).toHaveBeenCalledTimes(1);
  });

  it('gemma-4も失敗したら両方の理由を含む例外を投げる(空配列にしない)', async () => {
    const ai = { run: vi.fn(async () => { throw new Error('embed down'); }) };
    const llm = vi.fn(async () => { throw new Error('llm down'); });
    await expect(extractKeywordsWithFallback(ai as never, '量子コンピュータ', llm)).rejects.toThrow(/embed down.*llm down/);
  });
});
