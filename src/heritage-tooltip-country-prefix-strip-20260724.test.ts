import { describe, expect, it } from 'vitest';
import { lookupHeritageTopicModelCache, stripHeritageQuestionCountryPrefix } from './index';

// 対象: /webgl-heritage ページのツールチップ👀👁️アイコン判定
// (lookupHeritageTopicModelCache, /api/aichat/check-heritage-mitokoro-{gemma,llama}-batch)。
//
// 背景: heritage-accessページの「AIに何を質問しますか」パネルは、同名で国が異なる
// 世界遺産の誤回答を防ぐため、質問文の先頭に「「国名」にある」を補足してから
// 問い合わせている(heritageAccess.tsのaskAI参照)。そのためDB(ai_chat_shares)に
// 保存される question は「「国名」にある「遺産名」の「見どころ」について
// 説明してください」という形になる。旧実装は接頭辞なしの質問文で
// `question IN (...)` の完全一致検索をしていたため、国名接頭辞付きの質問文は
// 一致せず、実際にはキャッシュがあるのに👀👁️アイコンが表示されない不具合があった。
//
// 故障シナリオ:
//   (1) 国名接頭辞付きの質問文がDBにあるのにキャッシュなし扱いになる(旧不具合の再現)
//   (2) 接頭辞なしの通常の質問文が誤って一致しなくなる(退行)
//   (3) 異なる遺産・トピックの質問文を誤って一致させてしまう(誤爆)
//   (4) チャンク分割によるD1バインド数上限(90)超過が再発する

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

function makeRecordingDb(opts?: {
  rowsFor?: (sql: string, params: unknown[]) => Array<Record<string, unknown>>;
  throwIf?: (sql: string, params: unknown[]) => boolean;
}) {
  const queries: RecordedQuery[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async all<T = Record<string, unknown>>(): Promise<{ results?: T[] }> {
              queries.push({ sql, params });
              if (opts?.throwIf && opts.throwIf(sql, params)) {
                throw new Error('D1_ERROR: too many SQL variables');
              }
              return { results: (opts?.rowsFor ? opts.rowsFor(sql, params) : []) as T[] };
            },
          };
        },
      };
    },
  };
  return { db, queries };
}

function bareQuestion(name: string, topic: string): string {
  return `「${name}」の「${topic}」について説明してください`;
}

function prefixedQuestion(country: string, name: string, topic: string): string {
  return `「${country}」にある${bareQuestion(name, topic)}`;
}

// 実装は「遺産名」をINSTRのニードルとしてバインドする（D1のLIKEパターン長制限を
// 回避するため）。モックも本番と同じバインド内容で照合する必要がある。
function needle(name: string): string {
  return `「${name}」`;
}

describe('stripHeritageQuestionCountryPrefix: 「「国名」にある」接頭辞の除去', () => {
  it('先頭の「「国名」にある」を取り除く', () => {
    expect(stripHeritageQuestionCountryPrefix('「イタリア」にある「モンテ・サン・ジョルジョ」の「見どころ」について説明してください'))
      .toBe('「モンテ・サン・ジョルジョ」の「見どころ」について説明してください');
  });

  it('接頭辞の直後に読点・句点・空白があればそれも取り除く', () => {
    expect(stripHeritageQuestionCountryPrefix('「日本」にある、「姫路城」の「見どころ」について説明してください'))
      .toBe('「姫路城」の「見どころ」について説明してください');
  });

  it('接頭辞が無い通常の質問文はそのまま返す', () => {
    const q = bareQuestion('姫路城', '見どころ');
    expect(stripHeritageQuestionCountryPrefix(q)).toBe(q);
  });

  it('null/undefined/空文字を渡しても例外を投げず空文字を返す', () => {
    expect(() => stripHeritageQuestionCountryPrefix(null as unknown as string)).not.toThrow();
    expect(stripHeritageQuestionCountryPrefix(null as unknown as string)).toBe('');
    expect(stripHeritageQuestionCountryPrefix(undefined as unknown as string)).toBe('');
    expect(stripHeritageQuestionCountryPrefix('')).toBe('');
  });
});

describe('lookupHeritageTopicModelCache: 国名接頭辞つき質問文でもツールチップキャッシュを検出する', () => {
  const TOPIC = '見どころ';
  const MODEL = '@cf/google/gemma-4-26b-a4b-it';

  it('国名接頭辞つきの質問文がDBにあれば事前に接頭辞を取り除いてshare_idを検出する(旧不具合の修正確認)', async () => {
    const heritages = ['モンテ・サン・ジョルジョ', '万里の長城'];
    const stored = prefixedQuestion('イタリア', 'モンテ・サン・ジョルジョ', TOPIC);
    const { db } = makeRecordingDb({
      rowsFor: () => [{ id: 'share-italy', question: stored }],
    });
    const { cached, error } = await lookupHeritageTopicModelCache(db, 'user1', heritages, TOPIC, MODEL);
    expect(error).toBeUndefined();
    expect(cached['モンテ・サン・ジョルジョ']).toBe('share-italy');
  });

  it('接頭辞なしの通常の質問文も引き続き一致する(退行防止)', async () => {
    const heritages = ['タージ・マハル', '万里の長城'];
    const target = bareQuestion('タージ・マハル', TOPIC);
    const { db } = makeRecordingDb({
      rowsFor: (_sql, params) =>
        params.includes(needle('タージ・マハル')) ? [{ id: 'share-abc', question: target }] : [],
    });
    const { cached, error } = await lookupHeritageTopicModelCache(db, 'user1', heritages, TOPIC, MODEL);
    expect(error).toBeUndefined();
    expect(cached['タージ・マハル']).toBe('share-abc');
    expect(cached['万里の長城']).toBeNull();
  });

  it('異なる遺産・トピックの質問文を誤って一致させない(誤爆防止)', async () => {
    const heritages = ['姫路城'];
    // 「姫路城」を含むが遺産名も末尾の形も異なる無関係な質問文
    const unrelated = '「姫路城」に似た他の城について説明してください';
    const { db } = makeRecordingDb({
      rowsFor: () => [{ id: 'share-unrelated', question: unrelated }],
    });
    const { cached } = await lookupHeritageTopicModelCache(db, 'user1', heritages, TOPIC, MODEL);
    expect(cached['姫路城']).toBeNull();
  });

  it('LIKE検索でも世界遺産100件でどのクエリもD1バインド上限(90)を超えない', async () => {
    const heritages = Array.from({ length: 100 }, (_, i) => 'H' + i);
    const { db, queries } = makeRecordingDb();
    await lookupHeritageTopicModelCache(db, 'user1', heritages, TOPIC, MODEL);
    expect(queries.length).toBeGreaterThan(1);
    for (const q of queries) {
      expect(q.params.length).toBeLessThanOrEqual(90);
    }
  });

  it('先頭バインドはuser_id、2番目はmodel(バインド構造は変更前と同じ)', async () => {
    const heritages = Array.from({ length: 30 }, (_, i) => 'H' + i);
    const { db, queries } = makeRecordingDb();
    await lookupHeritageTopicModelCache(db, 'user-xyz', heritages, TOPIC, MODEL);
    for (const q of queries) {
      expect(q.params[0]).toBe('user-xyz');
      expect(q.params[1]).toBe(MODEL);
    }
  });

  it('一部チャンクが失敗してもerrorを返しつつ成功分(接頭辞つき含む)は残る', async () => {
    const heritages = Array.from({ length: 200 }, (_, i) => 'H' + i);
    const stored = prefixedQuestion('日本', 'H0', TOPIC);
    const { db } = makeRecordingDb({
      throwIf: (_sql, params) => params.includes(needle('H199')),
      rowsFor: (_sql, params) => (params.includes(needle('H0')) ? [{ id: 'share-0', question: stored }] : []),
    });
    const { cached, error } = await lookupHeritageTopicModelCache(db, 'user1', heritages, TOPIC, MODEL);
    expect(error).toBe('partial_query_failure');
    expect(cached['H0']).toBe('share-0');
  });
});
