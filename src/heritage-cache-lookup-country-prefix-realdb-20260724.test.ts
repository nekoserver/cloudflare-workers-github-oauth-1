import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  lookupHeritageTopicModelCache,
  lookupHeritageQuestionAnswers,
  lookupHeritageKeywordTopics,
  lookupHeritageMitokoroKeywordHits,
  stripHeritageQuestionCountryPrefix,
} from './index';

// ===========================================================================
// 対象: 世界遺産のAI回答キャッシュ判定を行うサーバ側4関数
//   - lookupHeritageTopicModelCache      … /webgl-heritage ツールチップの👀👁️アイコン
//   - lookupHeritageQuestionAnswers      … 🛬🚉アイコン・トピックバッジ(一括)
//   - lookupHeritageKeywordTopics        … 閲覧ログ由来のトピックバッジ
//   - lookupHeritageMitokoroKeywordHits  … 👀モーダルの🔑キーワードヒット数
//
// 根本原因:
//   heritage-accessページの「AIに何を質問しますか」パネルは、同名で国が異なる
//   世界遺産(例: モンテ・サン・ジョルジョ)の誤回答を防ぐため、質問文の先頭に
//   「「国名」にある」を補足してから /api/aichat へ投げている
//   (heritageAccess.ts の askAI)。/api/aichat の autoSave はその生プロンプトを
//   そのまま ai_chat_shares.question へ保存する。
//   一方、上記4関数はいずれも接頭辞なしで組み立てた質問文との「完全一致」で
//   キャッシュ有無を判定していたため、接頭辞つきで保存された行を一切拾えず、
//   実際には回答がキャッシュ済みなのにアイコン・バッジ・🔑が出ない状態だった。
//
// 本テストの位置づけ:
//   先行のテストは makeRecordingDb 型のモックで rowsFor が常に行を返す構造だった
//   ため、SQLが実際にマッチするかを何も保証していなかった(CLAUDE.md「テストが
//   通るだけのモックを作るのは禁止」に該当)。本テストは node:sqlite の実DBに
//   本番と同じスキーマを作り、本番と同じ保存経路(接頭辞つきプロンプト)で
//   INSERT したうえで各関数を実行し、キャッシュが実際に読み出せることを保証する。
//
// 故障シナリオ:
//   (1) 接頭辞つき質問文の行を拾えずキャッシュなし扱いになる(旧不具合)
//   (2) 接頭辞なしの行が拾えなくなる(退行)
//   (3) 別の遺産・別トピック・別モデル・削除済みの行を誤って拾う(誤爆)
//   (4) 遺産名が他の遺産名の末尾に含まれる場合に取り違える(境界の誤爆)
// ===========================================================================

const TOPIC = '見どころ';
const GEMMA = '@cf/google/gemma-4-26b-a4b-it';
const LLAMA = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const ALL_TOPICS = ['交通手段', '見どころ', '最寄り空港', '鉄道でのアクセス', '宿泊施設', 'スポーツ施設'];

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
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

// heritageAccess.ts の askAI が組み立てる生プロンプト。
// countryName があれば「「国名」にある」が先頭に付く。
function askAiPrompt(heritage: string, topic: string, countryName?: string): string {
  return (countryName ? `「${countryName}」にある` : '') +
    `「${heritage}」の「${topic}」について説明してください`;
}

// /api/aichat の autoSave 相当。生プロンプトをそのまま question へ保存する。
function saveShare(
  db: DatabaseSync,
  opts: { id: string; heritage: string; topic: string; country?: string; model?: string; answer?: string; deleted?: boolean; createdAt?: string },
) {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    opts.id,
    'user1',
    askAiPrompt(opts.heritage, opts.topic, opts.country),
    opts.answer ?? '回答本文',
    opts.model ?? GEMMA,
    opts.createdAt ?? '2026-07-24T00:00:00Z',
    opts.deleted ? '2026-07-24T01:00:00Z' : null,
  );
}

describe('実DB: lookupHeritageTopicModelCache — ツールチップ👀👁️アイコンのキャッシュ判定', () => {
  it('国名接頭辞つきで保存された行から share_id を読み出せる(旧不具合の修正確認)', async () => {
    const db = setupDb();
    saveShare(db, { id: 's-italy', heritage: 'モンテ・サン・ジョルジョ', topic: TOPIC, country: 'イタリア' });
    const { cached, error } = await lookupHeritageTopicModelCache(
      wrapD1(db), 'user1', ['モンテ・サン・ジョルジョ'], TOPIC, GEMMA
    );
    expect(error).toBeUndefined();
    expect(cached['モンテ・サン・ジョルジョ']).toBe('s-italy');
  });

  it('接頭辞なしで保存された行も引き続き読み出せる(退行防止)', async () => {
    const db = setupDb();
    saveShare(db, { id: 's-bare', heritage: 'タージ・マハル', topic: TOPIC });
    const { cached } = await lookupHeritageTopicModelCache(
      wrapD1(db), 'user1', ['タージ・マハル'], TOPIC, GEMMA
    );
    expect(cached['タージ・マハル']).toBe('s-bare');
  });

  it('複数国が「/」で連結された国名(例: ドイツ/チェコ)の接頭辞でも読み出せる', async () => {
    const db = setupDb();
    saveShare(db, { id: 's-multi', heritage: 'エルツゲビルゲ/クルシュノホジ鉱山地帯', topic: TOPIC, country: 'ドイツ/チェコ' });
    const { cached } = await lookupHeritageTopicModelCache(
      wrapD1(db), 'user1', ['エルツゲビルゲ/クルシュノホジ鉱山地帯'], TOPIC, GEMMA
    );
    expect(cached['エルツゲビルゲ/クルシュノホジ鉱山地帯']).toBe('s-multi');
  });

  it('llamaフォールバックで保存された行は👁️側(llamaモデル)でのみ読み出せる', async () => {
    const db = setupDb();
    saveShare(db, { id: 's-llama', heritage: '姫路城', topic: TOPIC, country: '日本', model: LLAMA });
    const asLlama = await lookupHeritageTopicModelCache(wrapD1(db), 'user1', ['姫路城'], TOPIC, LLAMA);
    expect(asLlama.cached['姫路城']).toBe('s-llama');
    const asGemma = await lookupHeritageTopicModelCache(wrapD1(db), 'user1', ['姫路城'], TOPIC, GEMMA);
    expect(asGemma.cached['姫路城']).toBeNull();
  });

  it('別トピック(交通手段)の行は「見どころ」のキャッシュとして拾わない', async () => {
    const db = setupDb();
    saveShare(db, { id: 's-other', heritage: '姫路城', topic: '交通手段', country: '日本' });
    const { cached } = await lookupHeritageTopicModelCache(wrapD1(db), 'user1', ['姫路城'], TOPIC, GEMMA);
    expect(cached['姫路城']).toBeNull();
  });

  it('ソフトデリート済みの行は拾わない', async () => {
    const db = setupDb();
    saveShare(db, { id: 's-del', heritage: '姫路城', topic: TOPIC, country: '日本', deleted: true });
    const { cached } = await lookupHeritageTopicModelCache(wrapD1(db), 'user1', ['姫路城'], TOPIC, GEMMA);
    expect(cached['姫路城']).toBeNull();
  });

  it('遺産名が他の遺産名の末尾に含まれる場合でも取り違えない(境界の誤爆防止)', async () => {
    const db = setupDb();
    // 「姫路城」の行だけが存在する状態で、遺産名「城」を検索しても拾ってはならない。
    saveShare(db, { id: 's-himeji', heritage: '姫路城', topic: TOPIC, country: '日本' });
    const { cached } = await lookupHeritageTopicModelCache(wrapD1(db), 'user1', ['城', '姫路城'], TOPIC, GEMMA);
    expect(cached['城']).toBeNull();
    expect(cached['姫路城']).toBe('s-himeji');
  });

  it('接頭辞つき・なしが混在していても全件正しく読み出せる', async () => {
    const db = setupDb();
    saveShare(db, { id: 's1', heritage: 'モンテ・サン・ジョルジョ', topic: TOPIC, country: 'イタリア' });
    saveShare(db, { id: 's2', heritage: 'タージ・マハル', topic: TOPIC });
    saveShare(db, { id: 's3', heritage: '姫路城', topic: TOPIC, country: '日本' });
    const { cached } = await lookupHeritageTopicModelCache(
      wrapD1(db), 'user1', ['モンテ・サン・ジョルジョ', 'タージ・マハル', '姫路城', '万里の長城'], TOPIC, GEMMA
    );
    expect(cached['モンテ・サン・ジョルジョ']).toBe('s1');
    expect(cached['タージ・マハル']).toBe('s2');
    expect(cached['姫路城']).toBe('s3');
    expect(cached['万里の長城']).toBeNull();
  });

  it('チャンク分割が起きる100件規模でも最終チャンクの接頭辞つき行を取りこぼさない', async () => {
    const db = setupDb();
    const heritages = Array.from({ length: 100 }, (_, i) => 'H' + i);
    saveShare(db, { id: 's-last', heritage: 'H99', topic: TOPIC, country: '日本' });
    const { cached, error } = await lookupHeritageTopicModelCache(wrapD1(db), 'user1', heritages, TOPIC, GEMMA);
    expect(error).toBeUndefined();
    expect(cached['H99']).toBe('s-last');
  });
});

describe('実DB: lookupHeritageQuestionAnswers — 🛬🚉アイコン・トピックバッジ(一括)', () => {
  it('国名接頭辞つきで保存された行からトピックごとの share_id を読み出せる', async () => {
    const db = setupDb();
    saveShare(db, { id: 'a-air', heritage: '姫路城', topic: '最寄り空港', country: '日本' });
    saveShare(db, { id: 'a-rail', heritage: '姫路城', topic: '鉄道でのアクセス', country: '日本' });
    const { answered, error } = await lookupHeritageQuestionAnswers(wrapD1(db), 'user1', ['姫路城'], ALL_TOPICS);
    expect(error).toBeUndefined();
    expect(answered['姫路城']['最寄り空港']).toBe('a-air');
    expect(answered['姫路城']['鉄道でのアクセス']).toBe('a-rail');
    expect(answered['姫路城']['宿泊施設']).toBeNull();
  });

  it('接頭辞なしの行も引き続き読み出せる(退行防止)', async () => {
    const db = setupDb();
    saveShare(db, { id: 'a-bare', heritage: 'タージ・マハル', topic: '交通手段' });
    const { answered } = await lookupHeritageQuestionAnswers(wrapD1(db), 'user1', ['タージ・マハル'], ALL_TOPICS);
    expect(answered['タージ・マハル']['交通手段']).toBe('a-bare');
  });

  it('複数遺産×複数トピックが接頭辞混在でも取り違えなく対応付けられる', async () => {
    const db = setupDb();
    saveShare(db, { id: 'x1', heritage: '姫路城', topic: '見どころ', country: '日本' });
    saveShare(db, { id: 'x2', heritage: '厳島神社', topic: '宿泊施設' });
    const { answered } = await lookupHeritageQuestionAnswers(wrapD1(db), 'user1', ['姫路城', '厳島神社'], ALL_TOPICS);
    expect(answered['姫路城']['見どころ']).toBe('x1');
    expect(answered['姫路城']['宿泊施設']).toBeNull();
    expect(answered['厳島神社']['宿泊施設']).toBe('x2');
    expect(answered['厳島神社']['見どころ']).toBeNull();
  });

  it('遺産名の末尾一致による取り違えが起きない(境界の誤爆防止)', async () => {
    const db = setupDb();
    saveShare(db, { id: 'y1', heritage: '姫路城', topic: '見どころ', country: '日本' });
    const { answered } = await lookupHeritageQuestionAnswers(wrapD1(db), 'user1', ['城', '姫路城'], ALL_TOPICS);
    expect(answered['城']['見どころ']).toBeNull();
    expect(answered['姫路城']['見どころ']).toBe('y1');
  });

  it('ソフトデリート済みの行は拾わない', async () => {
    const db = setupDb();
    saveShare(db, { id: 'z1', heritage: '姫路城', topic: '見どころ', country: '日本', deleted: true });
    const { answered } = await lookupHeritageQuestionAnswers(wrapD1(db), 'user1', ['姫路城'], ALL_TOPICS);
    expect(answered['姫路城']['見どころ']).toBeNull();
  });
});

describe('実DB: lookupHeritageKeywordTopics — 閲覧ログ由来のトピックバッジ', () => {
  function insertViewLog(db: DatabaseSync, heritage: string, topicId: number) {
    db.prepare(
      `INSERT INTO heritage_question_view_log (user_id, heritage_name, question_master_id) VALUES (?, ?, ?)`
    ).run('user1', heritage, topicId);
  }

  it('国名接頭辞つきで保存された回答でもバッジが表示される(旧不具合の修正確認)', async () => {
    const db = setupDb();
    saveShare(db, { id: 'k1', heritage: 'モンテ・サン・ジョルジョ', topic: '見どころ', country: 'イタリア' });
    insertViewLog(db, 'モンテ・サン・ジョルジョ', 2);
    const { hits, error } = await lookupHeritageKeywordTopics(wrapD1(db), 'user1', ['モンテ・サン・ジョルジョ']);
    expect(error).toBeUndefined();
    expect(hits['モンテ・サン・ジョルジョ']).toContain('見どころ');
  });

  it('接頭辞なしの回答でもバッジが表示される(退行防止)', async () => {
    const db = setupDb();
    saveShare(db, { id: 'k2', heritage: 'タージ・マハル', topic: '見どころ' });
    insertViewLog(db, 'タージ・マハル', 2);
    const { hits } = await lookupHeritageKeywordTopics(wrapD1(db), 'user1', ['タージ・マハル']);
    expect(hits['タージ・マハル']).toContain('見どころ');
  });

  it('回答が削除済みならバッジは表示されない(既存仕様の維持)', async () => {
    const db = setupDb();
    saveShare(db, { id: 'k3', heritage: '姫路城', topic: '見どころ', country: '日本', deleted: true });
    insertViewLog(db, '姫路城', 2);
    const { hits } = await lookupHeritageKeywordTopics(wrapD1(db), 'user1', ['姫路城']);
    expect(hits['姫路城']).not.toContain('見どころ');
  });

  it('閲覧ログのトピックと異なるトピックの回答しか無い場合はバッジを出さない', async () => {
    const db = setupDb();
    saveShare(db, { id: 'k4', heritage: '姫路城', topic: '交通手段', country: '日本' });
    insertViewLog(db, '姫路城', 2); // 見どころの閲覧ログのみ
    const { hits } = await lookupHeritageKeywordTopics(wrapD1(db), 'user1', ['姫路城']);
    expect(hits['姫路城']).not.toContain('見どころ');
  });
});

describe('実DB: lookupHeritageMitokoroKeywordHits — 👀モーダルの🔑キーワードヒット数', () => {
  function insertSearchHistory(db: DatabaseSync, keyword: string, shareId: string) {
    db.prepare(
      `INSERT INTO aichat_search_history (user_id, keyword, share_id, seq_num, searched_at) VALUES (?, ?, ?, ?, ?)`
    ).run('user1', keyword, shareId, 1, '2026-07-24T00:00:00Z');
  }

  it('国名接頭辞つきで保存された回答からキーワードヒット数を算出できる(旧不具合の修正確認)', async () => {
    const db = setupDb();
    saveShare(db, {
      id: 'm1', heritage: 'モンテ・サン・ジョルジョ', topic: '見どころ', country: 'イタリア',
      answer: '化石が有名で、三畳紀の海洋生物の化石が多数発見されています。',
    });
    insertSearchHistory(db, '化石', 'm1');
    insertSearchHistory(db, '三畳紀', 'm1');
    const { keywords, hitCount } = await lookupHeritageMitokoroKeywordHits(
      wrapD1(db), 'user1', 'モンテ・サン・ジョルジョ', GEMMA
    );
    expect(hitCount).toBe(2);
    expect(keywords).toContain('化石');
    expect(keywords).toContain('三畳紀');
  });

  it('接頭辞なしの回答でも算出できる(退行防止)', async () => {
    const db = setupDb();
    saveShare(db, { id: 'm2', heritage: 'タージ・マハル', topic: '見どころ', answer: '白大理石の霊廟です。' });
    insertSearchHistory(db, '大理石', 'm2');
    const { hitCount } = await lookupHeritageMitokoroKeywordHits(wrapD1(db), 'user1', 'タージ・マハル', GEMMA);
    expect(hitCount).toBe(1);
  });

  it('回答本文に含まれないキーワードはヒットに数えない', async () => {
    const db = setupDb();
    saveShare(db, { id: 'm3', heritage: '姫路城', topic: '見どころ', country: '日本', answer: '白鷺城とも呼ばれます。' });
    insertSearchHistory(db, '白鷺', 'm3');
    insertSearchHistory(db, '天守閣', 'm3'); // 本文に無い
    const { keywords, hitCount } = await lookupHeritageMitokoroKeywordHits(wrapD1(db), 'user1', '姫路城', GEMMA);
    expect(hitCount).toBe(1);
    expect(keywords).toEqual(['白鷺']);
  });

  it('モデルが異なる行は対象にしない', async () => {
    const db = setupDb();
    saveShare(db, { id: 'm4', heritage: '姫路城', topic: '見どころ', country: '日本', model: LLAMA, answer: '白鷺城です。' });
    insertSearchHistory(db, '白鷺', 'm4');
    const { hitCount } = await lookupHeritageMitokoroKeywordHits(wrapD1(db), 'user1', '姫路城', GEMMA);
    expect(hitCount).toBe(0);
  });
});

describe('stripHeritageQuestionCountryPrefix — 接頭辞除去の単体挙動', () => {
  it('askAiPromptが生成した接頭辞つき質問文から接頭辞なし質問文を復元できる', () => {
    for (const country of ['日本', 'イタリア', 'ドイツ/チェコ', 'ジンバブエ/ザンビア']) {
      const prefixed = askAiPrompt('姫路城', '見どころ', country);
      expect(stripHeritageQuestionCountryPrefix(prefixed)).toBe(askAiPrompt('姫路城', '見どころ'));
    }
  });

  it('接頭辞が無い質問文はそのまま返す', () => {
    const bare = askAiPrompt('姫路城', '見どころ');
    expect(stripHeritageQuestionCountryPrefix(bare)).toBe(bare);
  });

  it('null/undefined/空文字でも例外を投げない', () => {
    expect(stripHeritageQuestionCountryPrefix(null as unknown as string)).toBe('');
    expect(stripHeritageQuestionCountryPrefix(undefined as unknown as string)).toBe('');
    expect(stripHeritageQuestionCountryPrefix('')).toBe('');
  });
});
