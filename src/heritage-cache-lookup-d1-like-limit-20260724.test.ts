import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  lookupHeritageTopicModelCache,
  lookupHeritageQuestionAnswers,
  lookupHeritageKeywordTopics,
  lookupHeritageMitokoroKeywordHits,
  matchHeritageQuestionTarget,
  stripHeritageQuestionCountryPrefix,
  normalizeNakaguro,
} from './index';

// ===========================================================================
// 対象: 世界遺産のAI回答キャッシュ判定4関数（👀👁️アイコン・🛬🚉アイコン・
//       トピックバッジ・🔑キーワードヒット数）のSQL構築。
//
// 根本原因（本番でのみ失敗し続けていた真因）:
//   Cloudflare D1 は(ワイルドカードの有無に関わらず)LIKEパターンが約50バイトを
//   超えると "LIKE or GLOB pattern too complex: SQLITE_ERROR" で失敗する
//   （このリポジトリでは wrangler dev の実機で確認済み。
//     src/heritage-area-search-instr.test.ts / src/aichat-search-nakaguro.test.ts 参照）。
//   日本語の質問文は1文字3バイトのため
//   「「遺産名」の「見どころ」について説明してください」は容易に100バイトを超える。
//   そのため質問文そのものをLIKEパターンに使う実装は、本番D1では
//   全クエリが例外になり、呼び出し元の catch で握りつぶされて
//   「キャッシュ無し(全件null)」に化け、アイコンもバッジも永遠に表示されなかった。
//   node:sqlite にはこの長さ制限が無いため、通常のvitestテストでは検出できない。
//
// 対策:
//   LIKEを全廃し、長さ制限のない INSTR による部分一致へ切り替える。
//   照合は「質問文に『「トピック」』が含まれるか」×「質問文に『「遺産名」』が
//   含まれるか」で行い、👀(gemma)/👁️(llama) は model 列で分岐する。
//   読み出した質問文は stripHeritageQuestionCountryPrefix で
//   接頭辞「「国名」にある」を完全に除去してから同定処理へ進む。
//
// 本テストは D1 の長さ制限を再現するラッパを通して各関数を実行し、
// (1) LIKEを使っていないこと (2) 長い遺産名でも実際にキャッシュを読み出せること
// を保証する。
// ===========================================================================

const TOPIC = '見どころ';
const GEMMA = '@cf/google/gemma-4-26b-a4b-it';
const LLAMA = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const ALL_TOPICS = ['交通手段', '見どころ', '最寄り空港', '鉄道でのアクセス', '宿泊施設', 'スポーツ施設'];

// D1 が LIKE パターン長超過で失敗する挙動を再現しつつ、実行された SQL を記録する。
function wrapD1WithD1Limits(db: DatabaseSync, captured: string[]) {
  return {
    prepare(sql: string) {
      captured.push(sql);
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          if (/\bLIKE\b/i.test(sql)) {
            for (const a of args) {
              if (typeof a !== 'string') continue;
              if (new TextEncoder().encode(a).length > 50) {
                throw new Error('D1_ERROR: LIKE or GLOB pattern too complex: SQLITE_ERROR');
              }
            }
          }
          return {
            async all<T = Record<string, unknown>>(): Promise<{ results?: T[] }> {
              return { results: stmt.all(...(args as never[])) as unknown as T[] };
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
      model TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE TABLE heritage_ai_question_masters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL UNIQUE
    );
    CREATE TABLE heritage_question_view_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      heritage_name TEXT NOT NULL,
      question_master_id INTEGER NOT NULL,
      searched_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE TABLE aichat_search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      share_id TEXT NOT NULL,
      seq_num INTEGER NOT NULL,
      searched_at TEXT NOT NULL,
      deleted_at TEXT
    );
    INSERT INTO heritage_ai_question_masters (id, topic) VALUES
      (1, '交通手段'), (2, '見どころ'), (3, '最寄り空港'),
      (4, '鉄道でのアクセス'), (5, '宿泊施設'), (6, 'スポーツ施設');
  `);
  return db;
}

function askAiPrompt(heritage: string, topic: string, countryName?: string): string {
  return (countryName ? `「${countryName}」にある` : '') +
    `「${heritage}」の「${topic}」について説明してください`;
}

function saveShare(
  db: DatabaseSync,
  o: { id: string; heritage: string; topic: string; country?: string; model?: string; answer?: string; deleted?: boolean; rawQuestion?: string },
) {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    o.id, 'user1',
    o.rawQuestion ?? askAiPrompt(o.heritage, o.topic, o.country),
    o.answer ?? '回答本文', o.model ?? GEMMA,
    '2026-07-24T00:00:00Z', o.deleted ? '2026-07-24T01:00:00Z' : null,
  );
}

// 実在する長い世界遺産名（LIKEなら D1 で確実に失敗する長さ）
const LONG_HERITAGE = 'サンタ・マリア・デッレ・グラツィエ教会（レオナルドの最後の晩餐）';

describe('D1のLIKEパターン長制限下でもキャッシュを読み出せる（LIKE全廃の担保）', () => {
  it('lookupHeritageTopicModelCache: 長い遺産名＋国名接頭辞つきでも👀キャッシュを読み出せる', async () => {
    const db = setupDb();
    const captured: string[] = [];
    saveShare(db, { id: 's-long', heritage: LONG_HERITAGE, topic: TOPIC, country: 'イタリア' });
    const { cached, error } = await lookupHeritageTopicModelCache(
      wrapD1WithD1Limits(db, captured), 'user1', [LONG_HERITAGE], TOPIC, GEMMA
    );
    expect(error).toBeUndefined();
    expect(cached[LONG_HERITAGE]).toBe('s-long');
    expect(captured.join('\n')).not.toMatch(/\bLIKE\b/i);
    expect(captured.join('\n')).toMatch(/INSTR\(/);
  });

  it('lookupHeritageQuestionAnswers: 長い遺産名でもトピック別のキャッシュを読み出せる', async () => {
    const db = setupDb();
    const captured: string[] = [];
    saveShare(db, { id: 'q-air', heritage: LONG_HERITAGE, topic: '最寄り空港', country: 'イタリア' });
    const { answered, error } = await lookupHeritageQuestionAnswers(
      wrapD1WithD1Limits(db, captured), 'user1', [LONG_HERITAGE], ALL_TOPICS
    );
    expect(error).toBeUndefined();
    expect(answered[LONG_HERITAGE]['最寄り空港']).toBe('q-air');
    expect(captured.join('\n')).not.toMatch(/\bLIKE\b/i);
  });

  it('lookupHeritageKeywordTopics: 長い遺産名でもトピックバッジが表示される', async () => {
    const db = setupDb();
    const captured: string[] = [];
    saveShare(db, { id: 'k-long', heritage: LONG_HERITAGE, topic: '見どころ', country: 'イタリア' });
    db.prepare(
      `INSERT INTO heritage_question_view_log (user_id, heritage_name, question_master_id) VALUES (?, ?, ?)`
    ).run('user1', LONG_HERITAGE, 2);
    const { hits, error } = await lookupHeritageKeywordTopics(
      wrapD1WithD1Limits(db, captured), 'user1', [LONG_HERITAGE]
    );
    expect(error).toBeUndefined();
    expect(hits[LONG_HERITAGE]).toContain('見どころ');
    expect(captured.join('\n')).not.toMatch(/\bLIKE\b/i);
  });

  it('lookupHeritageMitokoroKeywordHits: 長い遺産名でも🔑ヒット数を算出できる', async () => {
    const db = setupDb();
    const captured: string[] = [];
    saveShare(db, { id: 'm-long', heritage: LONG_HERITAGE, topic: '見どころ', country: 'イタリア', answer: '壁画の修復が有名です。' });
    db.prepare(
      `INSERT INTO aichat_search_history (user_id, keyword, share_id, seq_num, searched_at) VALUES (?, ?, ?, ?, ?)`
    ).run('user1', '壁画', 'm-long', 1, '2026-07-24T00:00:00Z');
    const { hitCount } = await lookupHeritageMitokoroKeywordHits(
      wrapD1WithD1Limits(db, captured), 'user1', LONG_HERITAGE, GEMMA
    );
    expect(hitCount).toBe(1);
    expect(captured.join('\n')).not.toMatch(/\bLIKE\b/i);
  });

  it('100件規模でもLIKEを使わず、最終チャンクの長い遺産名を取りこぼさない', async () => {
    const db = setupDb();
    const captured: string[] = [];
    const heritages = [...Array.from({ length: 99 }, (_, i) => 'H' + i), LONG_HERITAGE];
    saveShare(db, { id: 's-last', heritage: LONG_HERITAGE, topic: TOPIC, country: '日本' });
    const { cached, error } = await lookupHeritageTopicModelCache(
      wrapD1WithD1Limits(db, captured), 'user1', heritages, TOPIC, GEMMA
    );
    expect(error).toBeUndefined();
    expect(cached[LONG_HERITAGE]).toBe('s-last');
    expect(captured.join('\n')).not.toMatch(/\bLIKE\b/i);
  });
});

describe('👀👁️のモデル分岐と「質問文にトピックが含まれるか」による判定', () => {
  it('同一遺産でgemma/llama両方のキャッシュがある場合、それぞれのモデルで別のshare_idを返す', async () => {
    const db = setupDb();
    const captured: string[] = [];
    saveShare(db, { id: 'g1', heritage: '姫路城', topic: TOPIC, country: '日本', model: GEMMA });
    saveShare(db, { id: 'l1', heritage: '姫路城', topic: TOPIC, country: '日本', model: LLAMA });
    const g = await lookupHeritageTopicModelCache(wrapD1WithD1Limits(db, captured), 'user1', ['姫路城'], TOPIC, GEMMA);
    const l = await lookupHeritageTopicModelCache(wrapD1WithD1Limits(db, captured), 'user1', ['姫路城'], TOPIC, LLAMA);
    expect(g.cached['姫路城']).toBe('g1');
    expect(l.cached['姫路城']).toBe('l1');
  });

  it('llamaのキャッシュのみの場合、👀(gemma)側はnullで👁️(llama)側だけ返る', async () => {
    const db = setupDb();
    const captured: string[] = [];
    saveShare(db, { id: 'l2', heritage: '厳島神社', topic: TOPIC, country: '日本', model: LLAMA });
    const g = await lookupHeritageTopicModelCache(wrapD1WithD1Limits(db, captured), 'user1', ['厳島神社'], TOPIC, GEMMA);
    const l = await lookupHeritageTopicModelCache(wrapD1WithD1Limits(db, captured), 'user1', ['厳島神社'], TOPIC, LLAMA);
    expect(g.cached['厳島神社']).toBeNull();
    expect(l.cached['厳島神社']).toBe('l2');
  });

  it('質問文に「見どころ」が含まれない行（別トピック）は👀👁️の対象にしない', async () => {
    const db = setupDb();
    const captured: string[] = [];
    saveShare(db, { id: 'o1', heritage: '姫路城', topic: '宿泊施設', country: '日本' });
    const { cached } = await lookupHeritageTopicModelCache(wrapD1WithD1Limits(db, captured), 'user1', ['姫路城'], TOPIC, GEMMA);
    expect(cached['姫路城']).toBeNull();
  });

  it('半角中黒「･」で保存された質問文でも全角「・」の遺産名で読み出せる（表記ゆれ吸収）', async () => {
    const db = setupDb();
    const captured: string[] = [];
    saveShare(db, {
      id: 'n1', heritage: 'x', topic: 'x',
      rawQuestion: '「日本」にある「タージ･マハル」の「見どころ」について説明してください',
    });
    const { cached } = await lookupHeritageTopicModelCache(
      wrapD1WithD1Limits(db, captured), 'user1', ['タージ・マハル'], TOPIC, GEMMA
    );
    expect(cached['タージ・マハル']).toBe('n1');
  });
});

describe('stripHeritageQuestionCountryPrefix — 接頭辞の完全除去', () => {
  it('「「国名」にある」を除去する', () => {
    expect(stripHeritageQuestionCountryPrefix(askAiPrompt('姫路城', TOPIC, '日本')))
      .toBe(askAiPrompt('姫路城', TOPIC));
  });

  it('「「国名」に所在する」という言い回しでも除去する', () => {
    expect(stripHeritageQuestionCountryPrefix('「日本」に所在する「姫路城」の「見どころ」について説明してください'))
      .toBe(askAiPrompt('姫路城', TOPIC));
  });

  it('接頭辞が2重に付いていても完全に除去する', () => {
    expect(stripHeritageQuestionCountryPrefix('「アジア」にある「日本」にある「姫路城」の「見どころ」について説明してください'))
      .toBe(askAiPrompt('姫路城', TOPIC));
  });

  it('「/」で連結された複数国名でも除去する', () => {
    expect(stripHeritageQuestionCountryPrefix(askAiPrompt('エルツゲビルゲ', TOPIC, 'ドイツ/チェコ')))
      .toBe(askAiPrompt('エルツゲビルゲ', TOPIC));
  });

  it('接頭辞が無い質問文はそのまま返す', () => {
    const bare = askAiPrompt('姫路城', TOPIC);
    expect(stripHeritageQuestionCountryPrefix(bare)).toBe(bare);
  });
});

describe('matchHeritageQuestionTarget — 遺産名・トピックの同定', () => {
  it('遺産名とトピックの両方が含まれる場合に同定できる', () => {
    const hit = matchHeritageQuestionTarget(askAiPrompt('姫路城', '見どころ'), ['姫路城'], ALL_TOPICS);
    expect(hit).toEqual({ heritage: '姫路城', topic: '見どころ' });
  });

  it('部分文字列関係にある遺産名は最長一致を採用する（城 と 姫路城）', () => {
    const hit = matchHeritageQuestionTarget(askAiPrompt('姫路城', '見どころ'), ['城', '姫路城'], ALL_TOPICS);
    expect(hit?.heritage).toBe('姫路城');
  });

  it('遺産名「城」の質問文が「姫路城」に誤ヒットしない', () => {
    const hit = matchHeritageQuestionTarget(askAiPrompt('城', '見どころ'), ['姫路城'], ALL_TOPICS);
    expect(hit).toBeNull();
  });

  it('トピックが含まれない質問文はnullを返す', () => {
    expect(matchHeritageQuestionTarget('「姫路城」について教えてください', ['姫路城'], ALL_TOPICS)).toBeNull();
  });

  it('中黒の表記ゆれを吸収して同定できる', () => {
    const hit = matchHeritageQuestionTarget('「タージ･マハル」の「見どころ」について説明してください', ['タージ・マハル'], ALL_TOPICS);
    expect(hit?.heritage).toBe('タージ・マハル');
  });
});

describe('normalizeNakaguro', () => {
  it('半角中黒を全角へ正規化する', () => {
    expect(normalizeNakaguro('タージ･マハル')).toBe('タージ・マハル');
    expect(normalizeNakaguro('タージ・マハル')).toBe('タージ・マハル');
  });
});
