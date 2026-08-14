import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { buildFuzzySearchLikePattern, searchAiChatShares } from './index';

// ===========================================================================
// 根本原因:
//   AIチャットのサイドバー検索窓（履歴を検索...）は ai_chat_shares.question /
//   answer に対して単純な LIKE '%q%' で検索していた。SQLite(D1) の LIKE は
//   非ASCII文字を正規化せずバイト単位の完全一致で比較するため、
//   全角中黒「・」(U+30FB) と半角中黒「･」(U+FF65) のように見た目がほぼ同じでも
//   コードポイントが異なる文字が入力側・保存側でどちらか一方でも混在すると
//   一致しなくなる。日本語IME・スマートフォンの日本語キーボードでは
//   どちらの中黒が入力されるか環境によって異なるため、
//   「タージ・マハル」のような中黒を含む世界遺産名で検索してもヒットしない
//   という報告に直結する。
//
// 本テストは実際のSQLite(node:sqlite)で、全角/半角中黒が食い違うケースの
// 再現と、LIKE の "_"（任意の1文字）ワイルドカードに置き換えることで
// 中黒の表記ゆれを吸収する修正の検証を行う。
// ===========================================================================

interface D1Row {
  [key: string]: unknown;
}

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async all<T = D1Row>(): Promise<{ results?: T[] }> {
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
      user_hash TEXT NOT NULL DEFAULT 'h',
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'model-x',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      access_count INTEGER NOT NULL DEFAULT 0,
      question_hash TEXT,
      deleted_at TEXT,
      image_data_url TEXT,
      image_id TEXT
    );
    CREATE TABLE aichat_images (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      image_data_url TEXT NOT NULL,
      byte_length INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE aichat_moondream_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      share_id TEXT NOT NULL,
      image_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      model TEXT NOT NULL,
      analysis_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function insertShare(db: DatabaseSync, id: string, question: string) {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer) VALUES (?, ?, ?, ?)`
  ).run(id, 'user1', question, '回答本文');
}

function insertMoondreamAnalysis(
  db: DatabaseSync,
  opts: { shareId: string; imageId?: string; userId?: string; analysisText: string },
) {
  db.prepare(
    `INSERT INTO aichat_moondream_analyses (share_id, image_id, user_id, model, analysis_text) VALUES (?, ?, ?, ?, ?)`
  ).run(opts.shareId, opts.imageId ?? 'img1', opts.userId ?? 'user1', 'moondream3.1', opts.analysisText);
}

describe('buildFuzzySearchLikePattern: 中黒の表記ゆれをLIKEワイルドカードで吸収する', () => {
  it('全角中黒(・)を任意の1文字ワイルドカードに変換する', () => {
    expect(buildFuzzySearchLikePattern('サンタ・マリア')).toBe('%サンタ_マリア%');
  });

  it('半角中黒(･)も同様に変換する', () => {
    expect(buildFuzzySearchLikePattern('サンタ･マリア')).toBe('%サンタ_マリア%');
  });

  it('LIKE のワイルドカード文字(%,_)自体は検索対象の文字として escape する', () => {
    expect(buildFuzzySearchLikePattern('50%_off')).toBe('%50\\%\\_off%');
  });

  it('中黒とワイルドカード文字が混在しても正しく処理する', () => {
    expect(buildFuzzySearchLikePattern('A_B・C%D')).toBe('%A\\_B_C\\%D%');
  });

  it('バックスラッシュ自体も escape する', () => {
    expect(buildFuzzySearchLikePattern('a\\b')).toBe('%a\\\\b%');
  });
});

describe('searchAiChatShares — 実SQLiteでの中黒表記ゆれ吸収の検証', () => {
  it('保存済みの質問と完全一致する中黒(全角)で検索するとヒットする', async () => {
    const real = setupDb();
    insertShare(real, 's1', '「タージ・マハル」の「見どころ」について説明してください');
    const { results } = await searchAiChatShares(wrapD1(real), 'user1', 'タージ・マハル');
    expect(results).toHaveLength(1);
  });

  it('バグ再現: 保存側が全角中黒、検索側が半角中黒だと表記ゆれ吸収前は一致しない想定を修正後は一致させる', async () => {
    const real = setupDb();
    insertShare(real, 's1', '「タージ・マハル」の「見どころ」について説明してください');
    // ユーザーが半角中黒(･ U+FF65)で検索した場合でもヒットするべき
    const { results } = await searchAiChatShares(wrapD1(real), 'user1', 'タージ･マハル');
    expect(results).toHaveLength(1);
  });

  it('逆方向: 保存側が半角中黒、検索側が全角中黒でもヒットする', async () => {
    const real = setupDb();
    insertShare(real, 's1', '「タージ･マハル」の「見どころ」について説明してください');
    const { results } = await searchAiChatShares(wrapD1(real), 'user1', 'タージ・マハル');
    expect(results).toHaveLength(1);
  });

  it('複数の中黒を含む長い世界遺産名でも表記ゆれを吸収する', async () => {
    const real = setupDb();
    insertShare(real, 's1', '「サンタ・マリア・デッレ・グラツィエ教会（レオナルドの最後の晩餐）」の「見どころ」について説明してください');
    const { results } = await searchAiChatShares(wrapD1(real), 'user1', 'サンタ･マリア･デッレ･グラツィエ教会');
    expect(results).toHaveLength(1);
  });

  it('answerフィールドに対しても中黒の表記ゆれを吸収する', async () => {
    const real = setupDb();
    real.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer) VALUES (?, ?, ?, ?)`
    ).run('s1', 'user1', '質問文', 'サン・モリッツ駅からの行き方を回答');
    const { results } = await searchAiChatShares(wrapD1(real), 'user1', 'サン･モリッツ');
    expect(results).toHaveLength(1);
  });

  it('実際に検索対象のワイルドカード文字(%,_)を含む質問はリテラルとして扱われる（誤ヒットしない）', async () => {
    const real = setupDb();
    insertShare(real, 's1', '「A_B」の「見どころ」について説明してください');
    insertShare(real, 's2', '「AXB」の「見どころ」について説明してください');
    const { results } = await searchAiChatShares(wrapD1(real), 'user1', 'A_B');
    expect(results.map((r) => r.id)).toEqual(['s1']);
  });

  it('他ユーザーの質問は検索結果に含まれない', async () => {
    const real = setupDb();
    insertShare(real, 's1', '「タージ・マハル」の「見どころ」について説明してください');
    real.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer) VALUES (?, ?, ?, ?)`
    ).run('s-other', 'other-user', '「タージ・マハル」の「見どころ」について説明してください', '回答');
    const { results } = await searchAiChatShares(wrapD1(real), 'user1', 'タージ・マハル');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s1');
  });

  it('削除済み(deleted_at)の質問は検索結果に含まれない', async () => {
    const real = setupDb();
    real.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, deleted_at) VALUES (?, ?, ?, ?, ?)`
    ).run('s1', 'user1', '「タージ・マハル」の「見どころ」について説明してください', '回答', '2026-01-01T00:00:00Z');
    const { results } = await searchAiChatShares(wrapD1(real), 'user1', 'タージ・マハル');
    expect(results).toHaveLength(0);
  });

  // 根本原因: D1はLIKEパターンが(ワイルドカードの有無に関わらず)約50バイトを
  // 超えると"LIKE or GLOB pattern too complex"で失敗する(wrangler devの実D1で
  // 実機確認済み)。検索窓は自由入力でありユーザーが長い世界遺産名等を
  // そのまま貼り付ける可能性があるため、LIKEをやめてINSTRに切り替えた。
  it('49文字(D1でLIKEなら確実に失敗する長さ)の検索語でもエラーにならず正しくヒットする', async () => {
    const real = setupDb();
    const longQuery = 'サンタ・マリア・デッレ・グラツィエ教会（レオナルドの最後の晩餐）';
    insertShare(real, 's1', `「${longQuery}」の「見どころ」について説明してください`);
    const { results } = await searchAiChatShares(wrapD1(real), 'user1', longQuery);
    expect(results).toHaveLength(1);
  });
});

// ===========================================================================
// 根本原因:
//   添付画像付き投稿は、画像に何が写っているかを説明するテキストが
//   ai_chat_shares.question/answerに存在しないことがある(画像だけを送って
//   文章を打たなかった場合はquestionが空文字になる、回答文が画像の内容に
//   触れない、等)。画像の内容を説明するテキストはMoondreamの分析結果
//   (aichat_moondream_analyses.analysis_text)としてのみ保存されているため、
//   サイドバー検索窓(searchAiChatShares)がquestion/answerしか見ていないと、
//   「画像に写っている物」で検索してもヒットしようがなかった。
// ===========================================================================
describe('searchAiChatShares — 添付画像のMoondream分析結果(analysis_text)も検索対象にする', () => {
  it('質問文・回答文にキーワードが無くても、紐づくanalysis_textにあればヒットする', async () => {
    const real = setupDb();
    // 画像だけを送って文章を打たなかった想定(questionが空文字)
    real.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, image_id) VALUES (?, ?, ?, ?, ?)`
    ).run('s1', 'user1', '', 'かわいい猫ですね!', 'img1');
    insertMoondreamAnalysis(real, { shareId: 's1', analysisText: '茶色い猫が窓際で寝ています' });
    const { results } = await searchAiChatShares(wrapD1(real), 'user1', '猫');
    expect(results.map((r) => r.id)).toEqual(['s1']);
  });

  it('analysis_textの中黒表記ゆれも吸収する', async () => {
    const real = setupDb();
    real.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, image_id) VALUES (?, ?, ?, ?, ?)`
    ).run('s1', 'user1', '', '説明します', 'img1');
    insertMoondreamAnalysis(real, { shareId: 's1', analysisText: '「タージ・マハル」が写っています' });
    const { results } = await searchAiChatShares(wrapD1(real), 'user1', 'タージ･マハル');
    expect(results).toHaveLength(1);
  });

  it('他ユーザーのanalysis_textはヒットしない', async () => {
    const real = setupDb();
    real.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, image_id) VALUES (?, ?, ?, ?, ?)`
    ).run('s1', 'other-user', '', '説明します', 'img1');
    insertMoondreamAnalysis(real, { shareId: 's1', userId: 'other-user', analysisText: '猫が写っています' });
    const { results } = await searchAiChatShares(wrapD1(real), 'user1', '猫');
    expect(results).toHaveLength(0);
  });

  it('質問文にヒットする通常の検索は従来通り動作する(analysis_text追加による回帰なし)', async () => {
    const real = setupDb();
    insertShare(real, 's1', '「タージ・マハル」の「見どころ」について説明してください');
    const { results } = await searchAiChatShares(wrapD1(real), 'user1', 'タージ・マハル');
    expect(results).toHaveLength(1);
  });
});
