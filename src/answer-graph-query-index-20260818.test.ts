import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// 対象: /answer-graphの回答伝播グラフ構築(buildAnswerPropagationGraph)が
// BFSの各層で呼ぶ findKeywordsForShares・findSharesContainingKeywords の
// D1クエリ負荷を下げるためのインデックス追加(migrations/0106)。
//
// 背景: findKeywordsForShares は `WHERE user_id = ? AND share_id IN (...)` で
// aichat_search_log を検索するが、既存の唯一のインデックス
// idx_aichat_search_log_unique は (user_id, keyword, share_id) の順で
// keyword が2番目にあるため、share_idでの絞り込みには使えず
// user_idだけでその他の行を全走査していた。(user_id, share_id) の
// インデックスを追加し、直接絞り込めるようにする。
// ai_chat_shares 側もINSTR全文検索の前段で user_id・deleted_at による
// 絞り込みを複合インデックスで高速化する。
//
// 故障シナリオ:
//   (1) インデックス定義に誤字があり、実際にはクエリのWHERE句の列順と
//       一致しないインデックスが作られてしまう(効果が出ない)
//   (2) 既存の buildAnswerPropagationGraph の挙動(返すノード/エッジ)が
//       意図せず変わってしまう(インデックス追加だけならクエリ結果は
//       変わらないはずなので、既存の振る舞いテストが引き続き通ることで保証する)

describe('migrations/0106: answer-graphクエリ用インデックス', () => {
  const migrationPath = path.resolve(__dirname, '..', 'migrations', '0106_add_answer_graph_query_indexes.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  it('aichat_search_logに(user_id, share_id)の複合インデックスを追加する', () => {
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_aichat_search_log_user_share ON aichat_search_log(user_id, share_id);');
  });

  it('ai_chat_sharesに(user_id, deleted_at)の複合インデックスを追加する', () => {
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_ai_chat_shares_user_deleted ON ai_chat_shares(user_id, deleted_at);');
  });

  it('SQLに -- コメントを含まない(D1コンソールへの直接貼り付け対応、CLAUDE.mdルール6)', () => {
    expect(sql).not.toMatch(/--/);
  });
});

describe('migrations/0106: 実際にSQLiteのクエリプランが新インデックスを使う', () => {
  function setupDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE aichat_search_log (
        user_id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        share_id TEXT NOT NULL,
        select_count INTEGER NOT NULL DEFAULT 1,
        last_searched_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_aichat_search_log_unique ON aichat_search_log(user_id, keyword, share_id);
      CREATE TABLE ai_chat_shares (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX idx_ai_chat_shares_user_id ON ai_chat_shares(user_id);
    `);
    // migrations/0106 の内容をそのまま適用する(将来ファイルが変わってもこのテストが追随する)
    const migrationPath = path.resolve(__dirname, '..', 'migrations', '0106_add_answer_graph_query_indexes.sql');
    db.exec(fs.readFileSync(migrationPath, 'utf-8'));

    // 空テーブルのままだとSQLiteのプランナーが統計情報(ANALYZE)無しで
    // 既存インデックスを恣意的に選んでしまい、新インデックスの効果を
    // 正しく検証できない。実運用に近い件数を投入しANALYZEすることで、
    // プランナーが実際にどちらのインデックスを選ぶか正しく再現する。
    const insLog = db.prepare(
      'INSERT INTO aichat_search_log (user_id, keyword, share_id, last_searched_at) VALUES (?, ?, ?, ?)'
    );
    const insShare = db.prepare(
      'INSERT INTO ai_chat_shares (id, user_id, question, answer, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (let u = 0; u < 20; u++) {
      for (let k = 0; k < 30; k++) {
        for (let s = 0; s < 20; s++) {
          insLog.run(`user${u}`, `kw${k}`, `share${s}`, '2026-01-01T00:00:00.000Z');
        }
      }
      for (let s = 0; s < 20; s++) {
        insShare.run(`share${u}-${s}`, `user${u}`, `質問${s}`, `回答${s}`, '2026-01-01T00:00:00.000Z', null);
      }
    }
    db.exec('ANALYZE;');
    return db;
  }

  it('findKeywordsForSharesの`WHERE user_id = ? AND share_id IN (...)`がidx_aichat_search_log_user_shareを使う(既存のuser_id,keyword,share_id順インデックスでは使えない)', () => {
    const db = setupDb();
    const plan = db.prepare(
      `EXPLAIN QUERY PLAN SELECT share_id, keyword FROM aichat_search_log WHERE user_id = ? AND share_id IN (?,?,?) GROUP BY share_id, keyword ORDER BY SUM(select_count) DESC`
    ).all('user1', 'share1', 'share2', 'share3') as { detail: string }[];
    const detail = plan.map((r) => r.detail).join(' / ');
    expect(detail).toContain('idx_aichat_search_log_user_share');
    expect(detail).not.toContain('SCAN aichat_search_log');
  });

  it('findSharesContainingKeywordsの`WHERE user_id = ? AND deleted_at IS NULL AND (...)`前段がidx_ai_chat_shares_user_deletedを使う', () => {
    const db = setupDb();
    const plan = db.prepare(
      `EXPLAIN QUERY PLAN SELECT id, question, answer FROM ai_chat_shares WHERE user_id = ? AND deleted_at IS NULL AND (INSTR(question, ?) > 0 OR INSTR(answer, ?) > 0) ORDER BY created_at DESC`
    ).all('user1', 'kw', 'kw') as { detail: string }[];
    const detail = plan.map((r) => r.detail).join(' / ');
    expect(detail).toContain('idx_ai_chat_shares_user_deleted');
  });
});
