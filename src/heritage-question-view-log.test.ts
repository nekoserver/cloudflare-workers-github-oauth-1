import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');
const view = readFileSync(new URL('./views/heritageAccess.ts', import.meta.url).pathname, 'utf-8');

describe('heritage_question_view_log 書き込み — バックエンド', () => {
  it('check-heritage-questions で heritage_question_view_log に INSERT している', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 3500);
    expect(block).toContain('heritage_question_view_log');
  });

  it('INSERT OR IGNORE で重複を防いでいる', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 3500);
    expect(block).toContain('INSERT OR IGNORE');
  });

  it('heritage_ai_question_masters から question_master_id を取得している', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 3500);
    expect(block).toContain('heritage_ai_question_masters');
  });

  it('country_name クエリパラメータを受け取っている', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 3500);
    expect(block).toContain('country_name');
  });

  it('searched_at を記録している', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 3500);
    expect(block).toContain('searched_at');
  });

  it('キャッシュがある質問のみ記録する（isCached フラグで絞り込み）', () => {
    const idx = src.indexOf('/api/aichat/check-heritage-questions');
    const block = src.slice(idx, idx + 3500);
    expect(block).toContain('isCached');
  });
});

describe('heritage_question_view_log 書き込み — フロントエンド', () => {
  it('check-heritage-questions に country_name を渡している', () => {
    const idx = view.indexOf('check-heritage-questions?heritage=');
    const block = view.slice(idx, idx + 400);
    expect(block).toContain('country_name');
  });

  it('都市の前の行(data-cc)ではなく、各世界遺産自身の国名(h.country_name)を使っている', () => {
    // 都市の近隣世界遺産には、都市の所在国とは異なる国の遺産も距離だけで
    // 含まれ得るため、都市のdata-cc(accTr.previousElementSibling経由)ではなく
    // 世界遺産自身の国(APIが返すh.country_name、行頭国旗が表す国)を使う。
    expect(view).toContain('h.country_name');
    expect(view).not.toContain('previousElementSibling');
  });
});

describe('マイグレーションファイル — 新テーブル', () => {
  it('heritage_ai_question_masters マイグレーションが存在する', () => {
    const fs = readFileSync(
      new URL('../migrations/0065_create_heritage_ai_question_masters.sql', import.meta.url).pathname,
      'utf-8'
    );
    expect(fs).toContain('CREATE TABLE IF NOT EXISTS heritage_ai_question_masters');
    expect(fs).toContain('INSERT OR IGNORE INTO heritage_ai_question_masters');
  });

  it('6つのトピックがマスタに定義されている', () => {
    const fs = readFileSync(
      new URL('../migrations/0065_create_heritage_ai_question_masters.sql', import.meta.url).pathname,
      'utf-8'
    );
    expect(fs).toContain('交通手段');
    expect(fs).toContain('見どころ');
    expect(fs).toContain('最寄り空港');
    expect(fs).toContain('鉄道でのアクセス');
    expect(fs).toContain('宿泊施設');
    expect(fs).toContain('スポーツ施設');
  });

  it('heritage_question_view_log マイグレーションが存在する', () => {
    const fs = readFileSync(
      new URL('../migrations/0066_create_heritage_question_view_log.sql', import.meta.url).pathname,
      'utf-8'
    );
    expect(fs).toContain('CREATE TABLE IF NOT EXISTS heritage_question_view_log');
    expect(fs).toContain('question_master_id');
    expect(fs).toContain('deleted_at');
    expect(fs).toContain('heritage_ai_question_masters');
  });
});
