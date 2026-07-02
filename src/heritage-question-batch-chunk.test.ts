import { describe, it, expect } from 'vitest';
import {
  chunkBindValues,
  lookupHeritageQuestionAnswers,
  lookupHeritageKeywordTopics,
  lookupHeritageTopicModelCache,
  D1_MAX_BOUND_PARAMS,
} from './index';

// ===========================================================================
// 根本原因テスト:
//   都市タップでアコーディオンを開くと、メニュー内の全世界遺産について
//   ai_chat_shares のキャッシュ判定を一括（バッチ）で行う。旧実装は全質問文を
//   1つの IN(...) に詰めていたため、近隣世界遺産が多い都市では D1 の
//   「1クエリあたりバインドパラメータ上限（=100）」を超え、クエリが失敗。
//   その失敗は catch で握りつぶされ「全件キャッシュなし」に化けていた。
//   （per-row タップは1遺産=6質問なので常に成功 → 症状が「個別は動くが全件は
//   動かない」となっていた。）
//
//   本テストはチャンク分割により「どのクエリもバインド数が D1 上限を超えない」
//   ことと「全遺産の回答が正しくマージされる」ことを実DBコール相当のモックで
//   保証する。
// ===========================================================================

const TOPICS = ['交通手段', '見どころ', '最寄り空港', '鉄道でのアクセス', '宿泊施設', 'スポーツ施設'];
// D1 の実上限。どのクエリのバインド数もこれ以下でなければならない。
const D1_HARD_LIMIT = 100;

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

function heritageQuestion(name: string, topic: string): string {
  return `「${name}」の「${topic}」について説明してください`;
}

describe('chunkBindValues: 純粋なチャンク分割', () => {
  it('要素数がチャンクサイズ以下なら1チャンク', () => {
    expect(chunkBindValues([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it('チャンクサイズちょうどで分割される', () => {
    expect(chunkBindValues([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it('余りが最後のチャンクに入る', () => {
    expect(chunkBindValues([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('空配列は空のチャンク列', () => {
    expect(chunkBindValues([], 10)).toEqual([]);
  });

  it('全要素が順序を保ったまま保存される（欠落なし）', () => {
    const input = Array.from({ length: 257 }, (_, i) => i);
    const flat = chunkBindValues(input, 30).flat();
    expect(flat).toEqual(input);
  });

  it('どのチャンクも指定サイズを超えない', () => {
    const input = Array.from({ length: 600 }, (_, i) => i);
    for (const ch of chunkBindValues(input, 89)) {
      expect(ch.length).toBeLessThanOrEqual(89);
    }
  });

  it('不正なサイズ（0以下）でも最低1件ずつに分割し無限ループしない', () => {
    expect(chunkBindValues([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe('lookupHeritageQuestionAnswers: バインド上限を超えない', () => {
  it('世界遺産100件でもどのクエリもバインド数が D1 上限(100)を超えない', async () => {
    const heritages = Array.from({ length: 100 }, (_, i) => 'H' + i);
    const { db, queries } = makeRecordingDb();
    await lookupHeritageQuestionAnswers(db, 'user1', heritages, TOPICS);
    expect(queries.length).toBeGreaterThan(1); // チャンク分割されている
    for (const q of queries) {
      expect(q.params.length).toBeLessThanOrEqual(D1_HARD_LIMIT);
    }
  });

  it('旧実装が壊れる境界（17件=102バインド相当）でも全クエリが上限以下', async () => {
    // 17遺産 × 6トピック = 102 質問 → 旧実装は単一クエリで user_id 込み 103 バインド → 失敗。
    const heritages = Array.from({ length: 17 }, (_, i) => 'H' + i);
    const { db, queries } = makeRecordingDb();
    await lookupHeritageQuestionAnswers(db, 'user1', heritages, TOPICS);
    for (const q of queries) {
      expect(q.params.length).toBeLessThanOrEqual(D1_HARD_LIMIT);
    }
  });

  it('各クエリの先頭バインドは user_id、残りは質問文（バインド構造の検証）', async () => {
    const heritages = Array.from({ length: 50 }, (_, i) => 'H' + i);
    const { db, queries } = makeRecordingDb();
    await lookupHeritageQuestionAnswers(db, 'user-xyz', heritages, TOPICS);
    for (const q of queries) {
      expect(q.params[0]).toBe('user-xyz');
    }
  });
});

describe('lookupHeritageQuestionAnswers: 全遺産の回答が正しくマージされる', () => {
  it('最後のチャンクに入る遺産でもキャッシュ回答が拾われる', async () => {
    const heritages = Array.from({ length: 100 }, (_, i) => 'H' + i);
    const target = heritageQuestion('H99', '見どころ'); // 最終チャンクに入る
    const { db } = makeRecordingDb({
      rowsFor: (_sql, params) =>
        params.includes(target) ? [{ id: 'share-99', question: target }] : [],
    });
    const { answered, error } = await lookupHeritageQuestionAnswers(db, 'user1', heritages, TOPICS);
    expect(error).toBeUndefined();
    expect(answered['H99']['見どころ']).toBe('share-99');
    // 他はnullのまま
    expect(answered['H0']['見どころ']).toBeNull();
    expect(answered['H99']['交通手段']).toBeNull();
  });

  it('複数遺産・複数トピックのキャッシュを横断して返す', async () => {
    const heritages = ['H1', 'H2', 'H3'];
    const cache: Record<string, string> = {
      [heritageQuestion('H1', '交通手段')]: 's1',
      [heritageQuestion('H3', '宿泊施設')]: 's3',
    };
    const { db } = makeRecordingDb({
      rowsFor: (_sql, params) => {
        const out: Array<Record<string, unknown>> = [];
        for (const p of params) {
          if (typeof p === 'string' && cache[p]) out.push({ id: cache[p], question: p });
        }
        return out;
      },
    });
    const { answered } = await lookupHeritageQuestionAnswers(db, 'user1', heritages, TOPICS);
    expect(answered['H1']['交通手段']).toBe('s1');
    expect(answered['H3']['宿泊施設']).toBe('s3');
    expect(answered['H2']['交通手段']).toBeNull();
  });

  it('全遺産が answered に必ずキー存在（未キャッシュでも空文字/undefinedにならずnull）', async () => {
    const heritages = ['A', 'B'];
    const { db } = makeRecordingDb();
    const { answered } = await lookupHeritageQuestionAnswers(db, 'user1', heritages, TOPICS);
    for (const h of heritages) {
      expect(answered[h]).toBeDefined();
      for (const t of TOPICS) expect(answered[h][t]).toBeNull();
    }
  });
});

describe('lookupHeritageQuestionAnswers: 失敗を握りつぶさない（CLAUDE.md ルール8）', () => {
  it('一部チャンクが失敗したら error=partial_query_failure を返す', async () => {
    const heritages = Array.from({ length: 100 }, (_, i) => 'H' + i);
    const poison = heritageQuestion('H99', '交通手段');
    const { db } = makeRecordingDb({
      throwIf: (_sql, params) => params.includes(poison),
    });
    const { error } = await lookupHeritageQuestionAnswers(db, 'user1', heritages, TOPICS);
    expect(error).toBe('partial_query_failure');
  });

  it('一部チャンクが失敗しても成功チャンクの回答は残る', async () => {
    const heritages = Array.from({ length: 100 }, (_, i) => 'H' + i);
    const poison = heritageQuestion('H99', '交通手段'); // 最終チャンク側を毒する
    const okTarget = heritageQuestion('H0', '見どころ'); // 先頭チャンク
    const { db } = makeRecordingDb({
      throwIf: (_sql, params) => params.includes(poison),
      rowsFor: (_sql, params) =>
        params.includes(okTarget) ? [{ id: 'ok-0', question: okTarget }] : [],
    });
    const { answered, error } = await lookupHeritageQuestionAnswers(db, 'user1', heritages, TOPICS);
    expect(error).toBe('partial_query_failure');
    expect(answered['H0']['見どころ']).toBe('ok-0');
  });

  it('全クエリが失敗（テーブル未作成相当）でも例外を投げずに error を返す', async () => {
    const heritages = ['A', 'B'];
    const { db } = makeRecordingDb({ throwIf: () => true });
    const { answered, error } = await lookupHeritageQuestionAnswers(db, 'user1', heritages, TOPICS);
    expect(error).toBe('partial_query_failure');
    expect(answered['A']['交通手段']).toBeNull();
  });
});

describe('lookupHeritageKeywordTopics: キーワードバッジ側も同じバインド上限を超えない', () => {
  it('キーワード200件でもどのクエリも D1 上限以下', async () => {
    const keywords = Array.from({ length: 200 }, (_, i) => 'K' + i);
    const { db, queries } = makeRecordingDb();
    await lookupHeritageKeywordTopics(db, 'user1', keywords);
    expect(queries.length).toBeGreaterThan(1);
    for (const q of queries) {
      expect(q.params.length).toBeLessThanOrEqual(D1_HARD_LIMIT);
    }
  });

  it('閲覧ログのトピックを遺産名ごとに集約し重複排除する', async () => {
    const keywords = ['K1', 'K2'];
    const { db } = makeRecordingDb({
      rowsFor: () => [
        { heritage_name: 'K1', topic: '見どころ' },
        { heritage_name: 'K1', topic: '見どころ' }, // 重複
        { heritage_name: 'K1', topic: '交通手段' },
      ],
    });
    const { hits } = await lookupHeritageKeywordTopics(db, 'user1', keywords);
    expect(hits['K1']).toEqual(['見どころ', '交通手段']);
    expect(hits['K2']).toEqual([]);
  });

  it('一部チャンク失敗時も error を返しつつ成功分の hits は残る', async () => {
    const keywords = Array.from({ length: 200 }, (_, i) => 'K' + i);
    const { db } = makeRecordingDb({
      throwIf: (_sql, params) => params.includes('K199'),
      rowsFor: (_sql, params) =>
        params.includes('K0') ? [{ heritage_name: 'K0', topic: '宿泊施設' }] : [],
    });
    const { hits, error } = await lookupHeritageKeywordTopics(db, 'user1', keywords);
    expect(error).toBe('partial_query_failure');
    expect(hits['K0']).toEqual(['宿泊施設']);
  });
});

describe('lookupHeritageTopicModelCache: 見どころ×gemmaキャッシュ判定', () => {
  const TOPIC = '見どころ';
  const MODEL = '@cf/google/gemma-4-26b-a4b-it';

  it('世界遺産100件でもどのクエリもバインド数が D1 上限(100)を超えない', async () => {
    const heritages = Array.from({ length: 100 }, (_, i) => 'H' + i);
    const { db, queries } = makeRecordingDb();
    await lookupHeritageTopicModelCache(db, 'user1', heritages, TOPIC, MODEL);
    expect(queries.length).toBeGreaterThan(1);
    for (const q of queries) {
      expect(q.params.length).toBeLessThanOrEqual(D1_HARD_LIMIT);
    }
  });

  it('質問文とモデルが一致する行の share_id を該当世界遺産にセットする', async () => {
    const heritages = ['タージ・マハル', '万里の長城'];
    const target = heritageQuestion('タージ・マハル', TOPIC);
    const { db } = makeRecordingDb({
      rowsFor: (_sql, params) =>
        params.includes(target) ? [{ id: 'share-abc', question: target }] : [],
    });
    const { cached, error } = await lookupHeritageTopicModelCache(db, 'user1', heritages, TOPIC, MODEL);
    expect(error).toBeUndefined();
    expect(cached['タージ・マハル']).toBe('share-abc');
    expect(cached['万里の長城']).toBeNull();
  });

  it('先頭バインドは user_id、2番目は model（バインド構造の検証）', async () => {
    const heritages = Array.from({ length: 30 }, (_, i) => 'H' + i);
    const { db, queries } = makeRecordingDb();
    await lookupHeritageTopicModelCache(db, 'user-xyz', heritages, TOPIC, MODEL);
    for (const q of queries) {
      expect(q.params[0]).toBe('user-xyz');
      expect(q.params[1]).toBe(MODEL);
    }
  });

  it('最終チャンクに入る世界遺産でもキャッシュが拾われる（欠落なし）', async () => {
    const heritages = Array.from({ length: 100 }, (_, i) => 'H' + i);
    const target = heritageQuestion('H99', TOPIC);
    const { db } = makeRecordingDb({
      rowsFor: (_sql, params) =>
        params.includes(target) ? [{ id: 'share-99', question: target }] : [],
    });
    const { cached } = await lookupHeritageTopicModelCache(db, 'user1', heritages, TOPIC, MODEL);
    expect(cached['H99']).toBe('share-99');
    expect(cached['H0']).toBeNull();
  });

  it('一部チャンク失敗時も error を返しつつ成功分の cached は残る', async () => {
    const heritages = Array.from({ length: 200 }, (_, i) => 'H' + i);
    const target = heritageQuestion('H0', TOPIC);
    const { db } = makeRecordingDb({
      throwIf: (_sql, params) => params.includes(heritageQuestion('H199', TOPIC)),
      rowsFor: (_sql, params) => (params.includes(target) ? [{ id: 'share-0', question: target }] : []),
    });
    const { cached, error } = await lookupHeritageTopicModelCache(db, 'user1', heritages, TOPIC, MODEL);
    expect(error).toBe('partial_query_failure');
    expect(cached['H0']).toBe('share-0');
  });
});

describe('定数の健全性', () => {
  it('D1_MAX_BOUND_PARAMS は user_id 込みでも D1 上限(100)未満に収まる', () => {
    // チャンクサイズ = D1_MAX_BOUND_PARAMS - 1、これに user_id 1件を足した値が上限以下。
    expect((D1_MAX_BOUND_PARAMS - 1) + 1).toBeLessThanOrEqual(D1_HARD_LIMIT);
  });
});
