import { describe, it, expect } from 'vitest';
import {
  TABLE_COLUMN_KEYS,
  COLUMN_FK_TARGETS,
  COLUMN_FK_TARGET_COLUMNS,
  resolveLogicalFkTargetCol,
} from './index';

// 対象: `TABLE_COLUMN_KEYS`(全テーブルのPK/FK/UK/IDXバッジ定義)と
// `COLUMN_FK_TARGETS`(ER図・/statusページで使う論理FKの参照先テーブル定義)。
// 「外部キーの設定がなされていない箇所」の調査で、user_id/share_id という
// このリポジトリで最も頻出するFK命名パターンにもかかわらず
// COLUMN_FK_TARGETS への登録が漏れていたテーブルが複数見つかったため、
// 個別テーブルの回帰テストに加え、同種の登録漏れを機械的に検出する
// リポジトリ全体の不変条件テストを追加する。
//
// 故障シナリオ:
//   (1) 新しいテーブルに user_id/share_id カラムを追加した際、
//       COLUMN_FK_TARGETS への登録を忘れてもテストが失敗せず気づけない
//   (2) 今回修正した個別テーブル(aichat_answer_vectors等)が
//       将来のリファクタで再び登録漏れになる

describe('COLUMN_FK_TARGETS — user_id/share_idカラムの登録漏れが無いこと(全テーブル横断)', () => {
  it('FKバッジを持つ全カラムに参照先テーブルが登録されている', () => {
    const missing = Object.entries(TABLE_COLUMN_KEYS)
      .flatMap(([table, cols]) => Object.entries(cols)
        .filter(([, keyType]) => keyType?.includes('fk'))
        .filter(([column]) => !COLUMN_FK_TARGETS[table]?.[column])
        .map(([column]) => `${table}.${column}`));
    expect(missing).toEqual([]);
  });

  it('全ての論理FKが存在する参照先テーブル・キーカラムを指している', () => {
    const invalid = Object.entries(COLUMN_FK_TARGETS)
      .flatMap(([fromTable, columns]) => Object.entries(columns).flatMap(([fromColumn, toTable]) => {
        const toColumn = resolveLogicalFkTargetCol(fromTable, fromColumn);
        return TABLE_COLUMN_KEYS[toTable]?.[toColumn]
          ? []
          : [`${fromTable}.${fromColumn}->${toTable}.${toColumn}`];
      }));
    expect(invalid).toEqual([]);
  });

  it('全ての論理FKが存在する参照元テーブル・カラムに定義されている', () => {
    const invalid = Object.entries(COLUMN_FK_TARGETS)
      .flatMap(([fromTable, columns]) => Object.keys(columns)
        .filter((fromColumn) => !TABLE_COLUMN_KEYS[fromTable]?.[fromColumn])
        .map((fromColumn) => `${fromTable}.${fromColumn}`));
    expect(invalid).toEqual([]);
  });

  it('参照先カラムの上書き定義が存在する論理FKに対応している', () => {
    const invalid = Object.keys(COLUMN_FK_TARGET_COLUMNS)
      .filter((source) => {
        const separator = source.lastIndexOf('.');
        const fromTable = source.slice(0, separator);
        const fromColumn = source.slice(separator + 1);
        return separator < 1 || !COLUMN_FK_TARGETS[fromTable]?.[fromColumn];
      });
    expect(invalid).toEqual([]);
  });

  it('user_idカラムを持つテーブル(user_sessions自身を除く)は全てCOLUMN_FK_TARGETSにuser_id→user_sessionsを登録している', () => {
    const missing = Object.entries(TABLE_COLUMN_KEYS)
      .filter(([table, cols]) => table !== 'user_sessions' && 'user_id' in cols)
      .filter(([table]) => !COLUMN_FK_TARGETS[table]?.['user_id'])
      .map(([table]) => table);
    expect(missing).toEqual([]);
  });

  it('share_idカラムを持つテーブルは全てCOLUMN_FK_TARGETSにshare_id→ai_chat_sharesを登録している', () => {
    const missing = Object.entries(TABLE_COLUMN_KEYS)
      .filter(([, cols]) => 'share_id' in cols)
      .filter(([table]) => !COLUMN_FK_TARGETS[table]?.['share_id'])
      .map(([table]) => table);
    expect(missing).toEqual([]);
  });
});

describe('COLUMN_FK_TARGETS — 今回の調査で登録漏れが見つかった個別テーブルの回帰テスト', () => {
  it('aichat_answer_vectors.share_id / aichat_answer_category_scores.share_id / aichat_answer_keyword_vectors.share_id がai_chat_sharesを参照する', () => {
    expect(COLUMN_FK_TARGETS['aichat_answer_vectors']?.['share_id']).toBe('ai_chat_shares');
    expect(COLUMN_FK_TARGETS['aichat_answer_category_scores']?.['share_id']).toBe('ai_chat_shares');
    expect(COLUMN_FK_TARGETS['aichat_answer_keyword_vectors']?.['share_id']).toBe('ai_chat_shares');
  });

  it('uuid_history.user_id / aichat_category_groups.user_id / heritage_question_view_log.user_id / heritage_area_boxes.user_id がuser_sessionsを参照する', () => {
    expect(COLUMN_FK_TARGETS['uuid_history']?.['user_id']).toBe('user_sessions');
    expect(COLUMN_FK_TARGETS['aichat_category_groups']?.['user_id']).toBe('user_sessions');
    expect(COLUMN_FK_TARGETS['heritage_question_view_log']?.['user_id']).toBe('user_sessions');
    expect(COLUMN_FK_TARGETS['heritage_area_boxes']?.['user_id']).toBe('user_sessions');
  });

  it('aichat_share_subquery_links にuser_idカラムがTABLE_COLUMN_KEYSへ追加され、user_sessionsを参照する', () => {
    expect(TABLE_COLUMN_KEYS['aichat_share_subquery_links']?.['user_id']).toBe('idx');
    expect(COLUMN_FK_TARGETS['aichat_share_subquery_links']?.['user_id']).toBe('user_sessions');
  });
});
