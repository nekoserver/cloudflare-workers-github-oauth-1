import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(join(__dirname, 'index.ts'), 'utf-8');

// 対象: aichat_keyword_embeddings（bge-m3埋め込みベクトルのキャッシュ）と
// aichat_keyword_category_suggestions（AIによる分類推薦の履歴）の2テーブル。
//
// 背景: 「駅」→「Travel」のような分類提案をベクトル類似度で行うにあたり、
// (1) ベクトル自体はモデルバージョンが変わらない限りキーワード単位で
//     1件のみ保持し、再計算時は強制上書きする、
// (2) AIの分類推薦は人間が確定した aichat_keyword_category_map とは
//     別テーブルに履歴として積み上げ、人間の確定操作を一切上書きしない、
// という2つの設計方針をスキーマレベルで固定する。
//
// 故障シナリオ:
//   (1) aichat_keyword_embeddings に user_id+keyword のUNIQUE制約が無いと、
//       再計算のたびに重複行が増え「どれが最新か」を毎回ORDER BYで
//       探す羽目になる（強制上書きの前提が崩れる）
//   (2) aichat_keyword_category_suggestions に誤ってUNIQUE制約を付けると、
//       推薦履歴が上書きされてしまい「前回はTravel、今回はGeography」の
//       比較ができなくなる（履歴として残す方針が崩れる）
//   (3) 新テーブルをmigrationsに追加したのに登録レジストリ
//       (STATUS_TABLE_DEFINITIONS等)への反映を忘れる
//       → db-table-registry-completeness-20260728.test.ts で別途検知される

describe('aichat_keyword_embeddings: bge-m3埋め込みベクトルのキャッシュ', () => {
  it('migration 0087 で作成される', () => {
    expect(indexSrc).toContain("'0087': `CREATE TABLE IF NOT EXISTS aichat_keyword_embeddings");
  });

  it('user_id + keyword のUNIQUE制約を持つ（強制上書きのためキーワード単位で1件のみ保持）', () => {
    const idx = indexSrc.indexOf("'0087':");
    const block = indexSrc.slice(idx, idx + 700);
    expect(block).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_keyword_embeddings_user_keyword ON aichat_keyword_embeddings(user_id, keyword)');
  });

  it('model と dim カラムを持つ（モデルバージョン変更時の再計算判定に使う）', () => {
    const idx = indexSrc.indexOf("'0087':");
    const block = indexSrc.slice(idx, idx + 700);
    expect(block).toContain('model TEXT NOT NULL');
    expect(block).toContain('dim INTEGER NOT NULL');
    expect(block).toContain('vector BLOB NOT NULL');
  });
});

describe('aichat_keyword_category_suggestions: AI分類推薦の履歴（確定分類とは別テーブル）', () => {
  it('migration 0088 で作成される', () => {
    expect(indexSrc).toContain("'0088': `CREATE TABLE IF NOT EXISTS aichat_keyword_category_suggestions");
  });

  it('user_id/keywordにUNIQUE制約を持たない（複数回の推薦を履歴として積み上げる）', () => {
    const idx = indexSrc.indexOf("'0088':");
    const block = indexSrc.slice(idx, indexSrc.indexOf('`,', idx));
    expect(block).not.toContain('CREATE UNIQUE INDEX');
  });

  it('suggested_category_id は aichat_keyword_categories への論理FKとして登録されている', () => {
    expect(indexSrc).toContain(
      "aichat_keyword_category_suggestions: { user_id: 'user_sessions', suggested_category_id: 'aichat_keyword_categories' }"
    );
  });

  it('accepted カラムを持つ（人間の最終選択と一致したかを後から記録できる。NULL=未確認）', () => {
    const idx = indexSrc.indexOf("'0088':");
    const block = indexSrc.slice(idx, idx + 700);
    expect(block).toContain('accepted INTEGER');
  });

  it('aichat_keyword_category_map（確定分類テーブル）への書き込み文を含まない（AI推薦が確定分類を上書きしないことの静的保証）', () => {
    const idx = indexSrc.indexOf("'0088':");
    const block = indexSrc.slice(idx, indexSrc.indexOf('`,', idx));
    expect(block).not.toContain('aichat_keyword_category_map');
  });
});
