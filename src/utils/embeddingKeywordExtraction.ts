/**
 * AIチャットの✂️ボタン(/api/aichat/vectorize-answer)で使う予備知識キーワードの
 * 切り出しを、EmbeddingGemma 2(@cf/google/embeddinggemma-2)で行う。
 *
 * 従来はgemma-4-26b-a4b-it(文章生成)に「用語を1行1語で列挙して」と頼んでいたが、
 * キーワードの切り出しにしか使っていないため、より軽量で速い埋め込みモデルへ
 * 置き換える(ユーザー指定、2026-11-15)。埋め込みモデルは文章を生成できないので、
 *   1. 本文から候補語(漢字・カタカナの連なり、英字の技術用語)を拾い、
 *   2. 本文全体と候補を1回の呼び出しでまとめてベクトル化し、
 *   3. 本文とのコサイン類似度が高い順に上位を返す
 * という手順にする(KeyBERTと同じ考え方)。
 *
 * EmbeddingGemma 2が例外・想定外の応答を返したときだけ、呼び出し元から渡された
 * gemma-4の抽出関数へフォールバックする。どちらで切り出したか・フォールバックの
 * 理由は戻り値で呼び出し元へ返す(CLAUDE.mdルール8・32)。
 *
 * EmbeddingGemma 2の入出力は従来の埋め込みモデル(text: string[] → data: number[][])
 * と違い、input: string[] → data[i].embedding である
 * (https://developers.cloudflare.com/workers-ai/models/embeddinggemma-2/)。
 */

export const KEYWORD_EXTRACTION_EMBEDDING_MODEL = '@cf/google/embeddinggemma-2';

/**
 * スコアの計算条件。タスク接頭辞や計算方式を変えたら版(v1)を上げる。
 * D1のscore_method列に保存し、条件の違うスコアが混ざらないようにする。
 */
export const KEYWORD_EXTRACTION_SCORE_METHOD = 'cosine;doc=title-none;query=search-result;v1';

/** gemma-4へフォールバックしたとき(スコアなし、gemma-4の出力順)の計算条件 */
export const LLM_KEYWORD_EXTRACTION_SCORE_METHOD = 'llm-list;v1';

/** 返すキーワードの最大件数 */
export const KEYWORD_EXTRACTION_TOP_K = 15;

/** 埋め込みに渡す候補語の最大件数(長い本文で入力が膨らまないようにする) */
export const KEYWORD_EXTRACTION_MAX_CANDIDATES = 64;

/**
 * 本文の最大文字数。EmbeddingGemma 2の文脈長は1入力あたり8,192トークンのため、
 * 日本語でも収まる長さで切る。
 */
export const KEYWORD_EXTRACTION_MAX_DOCUMENT_CHARS = 6000;

/** 候補語の最大文字数(これより長い連なりは文の断片とみなして捨てる) */
const MAX_CANDIDATE_LENGTH = 24;

/** 回答文によく出るが、予備知識の用語としては意味の薄い語 */
const STOP_WORDS = new Set([
  '場合', '必要', '可能', '以下', '以上', '説明', '方法', '使用', '利用者', '今回', '最初', '最後',
  '一般', '一部', '全体', '部分', '理由', '結果', '内容', '問題', '注意', '例え', '具体', '具体的',
  '簡単', '重要', '主要', '基本', '通常', '程度', '自分', '状況', '関係', '影響', '特徴', '意味',
  '次', '他', '的', '等',
]);

const CANDIDATE_PATTERN = /[一-龯々〆ヵヶァ-ヴー]+|[A-Za-z][A-Za-z0-9.+#_-]*[A-Za-z0-9+#]/g;

/**
 * 本文から候補語を拾う純粋関数。ひらがな・記号・空白を区切りとして、
 * 漢字とカタカナの連なり(例: 量子コンピュータ)と英字の技術用語(例: Node.js)を拾う。
 * 1文字の語・長音だけの並び・STOP_WORDSを除き、出現回数の多い順(同数なら
 * 初出順)に最大KEYWORD_EXTRACTION_MAX_CANDIDATES件を返す。
 */
export function extractKeywordCandidates(text: string): string[] {
  const counts = new Map<string, { count: number; first: number }>();
  let order = 0;
  for (const match of (text || '').matchAll(CANDIDATE_PATTERN)) {
    const term = match[0].replace(/^ー+/, '');
    if (term.length < 2 || term.length > MAX_CANDIDATE_LENGTH) continue;
    if (/^ー+$/.test(term) || STOP_WORDS.has(term)) continue;
    const entry = counts.get(term);
    if (entry) entry.count += 1;
    else counts.set(term, { count: 1, first: order++ });
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first)
    .slice(0, KEYWORD_EXTRACTION_MAX_CANDIDATES)
    .map(([term]) => term);
}

export type EmbeddingParseResult =
  | { ok: true; vectors: number[][] }
  | { ok: false; detail: string };

/**
 * EmbeddingGemma 2の応答(data: [{ index, embedding }])からベクトルをindex順に
 * 取り出す。件数が合わない・形式が違う場合は失敗を返す(空配列で成功扱いにしない)。
 */
export function parseEmbeddingGemma2Vectors(result: unknown, expectedCount: number): EmbeddingParseResult {
  const obj = (typeof result === 'object' && result !== null) ? result as Record<string, unknown> : null;
  const data = obj && Array.isArray(obj.data) ? obj.data as unknown[] : null;
  if (!data) return { ok: false, detail: '応答にdata配列がありません' };
  if (data.length !== expectedCount) {
    return { ok: false, detail: `ベクトルの件数が一致しません(期待${expectedCount}件、実際${data.length}件)` };
  }
  const vectors: number[][] = new Array(expectedCount);
  for (let i = 0; i < data.length; i++) {
    const item = data[i] as Record<string, unknown> | null;
    const embedding = item && typeof item === 'object' && !Array.isArray(item) ? item.embedding : undefined;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return { ok: false, detail: `data[${i}].embeddingがありません` };
    }
    const index = typeof item!.index === 'number' ? item!.index : i;
    if (index < 0 || index >= expectedCount || vectors[index]) {
      return { ok: false, detail: `data[${i}].indexが不正です(${index})` };
    }
    vectors[index] = embedding as number[];
  }
  return { ok: true, vectors };
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/** 切り出したキーワード1件の分析結果(本文との類似度とベクトル) */
export interface RankedKeyword {
  term: string;
  score: number;
  vector: number[];
}

/** 切り出しと同時に得たベクトル分析の結果。D1へ保存する */
export interface KeywordVectorAnalysis {
  documentVector: number[];
  /** 本文から拾った候補語の数(順位付けの母数) */
  candidateCount: number;
  keywords: RankedKeyword[];
}

/**
 * 候補を本文ベクトルとのコサイン類似度が高い順に並べ、上位topK件を返す。
 * 類似度が同じなら元の順(出現回数の多い順)を保つ。
 */
export function rankCandidatesBySimilarity(
  documentVector: number[],
  candidates: string[],
  candidateVectors: number[][],
  topK: number,
): RankedKeyword[] {
  return candidates
    .map((term, i) => ({ term, i, score: cosine(documentVector, candidateVectors[i]), vector: candidateVectors[i] }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, topK)
    .map(({ term, score, vector }) => ({ term, score, vector }));
}

export type EmbeddingKeywordErrorCode = 'AI_ERROR' | 'AI_UNEXPECTED_FORMAT';

export type EmbeddingKeywordResult =
  | { ok: true; terms: string[]; analysis: KeywordVectorAnalysis }
  | { ok: false; errorCode: EmbeddingKeywordErrorCode; detail: string };

interface AiLike {
  run(model: string, params: unknown): Promise<unknown>;
}

/**
 * EmbeddingGemma 2で本文から予備知識キーワードを切り出す。候補が0件なら
 * AIを呼ばず空で成功を返す(フォールバックしても切り出せる語がないため)。
 * 検索用のタスク接頭辞を付ける(本文は文書側、候補は問い合わせ側)。
 */
export async function extractKeywordsWithEmbedding(ai: AiLike, text: string): Promise<EmbeddingKeywordResult> {
  const document = (text || '').slice(0, KEYWORD_EXTRACTION_MAX_DOCUMENT_CHARS);
  const candidates = extractKeywordCandidates(document);
  if (candidates.length === 0) return { ok: true, terms: [], analysis: { documentVector: [], candidateCount: 0, keywords: [] } };
  const input = [
    'title: none | text: ' + document,
    ...candidates.map((term) => 'task: search result | query: ' + term),
  ];
  let result: unknown;
  try {
    result = await ai.run(KEYWORD_EXTRACTION_EMBEDDING_MODEL, { input });
  } catch (err) {
    return { ok: false, errorCode: 'AI_ERROR', detail: err instanceof Error ? err.message : String(err) };
  }
  const parsed = parseEmbeddingGemma2Vectors(result, input.length);
  if (!parsed.ok) return { ok: false, errorCode: 'AI_UNEXPECTED_FORMAT', detail: parsed.detail };
  const [documentVector, ...candidateVectors] = parsed.vectors;
  const keywords = rankCandidatesBySimilarity(documentVector, candidates, candidateVectors, KEYWORD_EXTRACTION_TOP_K);
  return { ok: true, terms: keywords.map((k) => k.term), analysis: { documentVector, candidateCount: candidates.length, keywords } };
}

export interface KeywordExtractionOutcome {
  terms: string[];
  /** 実際に切り出しに使ったモデル */
  usedModel: string;
  /** フォールバックしたときの、EmbeddingGemma 2が失敗した理由。しなければnull */
  fallback: { errorCode: EmbeddingKeywordErrorCode; detail: string } | null;
  /** EmbeddingGemma 2で切り出したときのベクトル分析。フォールバック時はnull */
  analysis: KeywordVectorAnalysis | null;
  /** 順位(スコア)の計算条件 */
  scoreMethod: string;
}

/**
 * EmbeddingGemma 2で切り出し、失敗したときだけfallbackExtract(gemma-4)を使う。
 * 両方失敗したら、両方の理由を含む例外を投げる(空配列にしない)。
 */
export async function extractKeywordsWithFallback(
  ai: AiLike,
  text: string,
  fallbackExtract: (text: string) => Promise<string[]>,
  fallbackModel = 'fallback',
): Promise<KeywordExtractionOutcome> {
  const primary = await extractKeywordsWithEmbedding(ai, text);
  if (primary.ok) {
    return { terms: primary.terms, usedModel: KEYWORD_EXTRACTION_EMBEDDING_MODEL, fallback: null, analysis: primary.analysis, scoreMethod: KEYWORD_EXTRACTION_SCORE_METHOD };
  }
  const fallback = { errorCode: primary.errorCode, detail: primary.detail };
  try {
    const terms = await fallbackExtract(text);
    return { terms, usedModel: fallbackModel, fallback, analysis: null, scoreMethod: LLM_KEYWORD_EXTRACTION_SCORE_METHOD };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${KEYWORD_EXTRACTION_EMBEDDING_MODEL}で失敗(${primary.errorCode}: ${primary.detail})し、フォールバックの${fallbackModel}でも失敗しました: ${message}`);
  }
}
