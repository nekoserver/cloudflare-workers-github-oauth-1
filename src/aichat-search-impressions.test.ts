/**
 * aichat_search_impressions テーブルと関連エンドポイントの整合性テスト
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TABLE_COLUMN_KEYS, TABLE_GROUP_MAP, COLUMN_FK_TARGETS } from './index';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');
const INDEX_SRC = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');

describe('aichat_search_impressions テーブル登録', () => {
  it('TABLE_COLUMN_KEYS に aichat_search_impressions が登録されている', () => {
    expect(TABLE_COLUMN_KEYS['aichat_search_impressions']).toBeDefined();
  });

  it('aichat_search_impressions の id が pk', () => {
    expect(TABLE_COLUMN_KEYS['aichat_search_impressions']['id']).toBe('pk');
  });

  it('aichat_search_impressions の user_id が fk', () => {
    expect(TABLE_COLUMN_KEYS['aichat_search_impressions']['user_id']).toBe('fk');
  });

  it('aichat_search_impressions の share_id が fk', () => {
    expect(TABLE_COLUMN_KEYS['aichat_search_impressions']['share_id']).toBe('fk');
  });

  it('TABLE_GROUP_MAP で aichat_search_impressions が ai グループ', () => {
    expect(TABLE_GROUP_MAP['aichat_search_impressions']).toBe('ai');
  });

  it('COLUMN_FK_TARGETS で aichat_search_impressions.user_id が user_sessions を参照', () => {
    expect(COLUMN_FK_TARGETS['aichat_search_impressions']?.['user_id']).toBe('user_sessions');
  });

  it('COLUMN_FK_TARGETS で aichat_search_impressions.share_id が ai_chat_shares を参照', () => {
    expect(COLUMN_FK_TARGETS['aichat_search_impressions']?.['share_id']).toBe('ai_chat_shares');
  });
});

describe('aichat_search_impressions マイグレーション', () => {
  it('0044_create_aichat_search_impressions.sql が存在する', () => {
    const file = path.join(MIGRATIONS_DIR, '0044_create_aichat_search_impressions.sql');
    expect(fs.existsSync(file)).toBe(true);
  });

  it('result_count カラムが含まれる', () => {
    const file = path.join(MIGRATIONS_DIR, '0044_create_aichat_search_impressions.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    expect(sql).toContain('result_count');
  });

  it('searched_at カラムが含まれる', () => {
    const file = path.join(MIGRATIONS_DIR, '0044_create_aichat_search_impressions.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    expect(sql).toContain('searched_at');
  });

  it('deleted_at カラムが含まれる', () => {
    const file = path.join(MIGRATIONS_DIR, '0044_create_aichat_search_impressions.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    expect(sql).toContain('deleted_at');
  });
});

describe('GET /api/aichat/search-impressions エンドポイント', () => {
  it('index.ts に app.get の search-impressions ハンドラが存在する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/search-impressions'");
    expect(idx).toBeGreaterThan(-1);
  });

  it('ハンドラが aichat_search_impressions を SELECT する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/search-impressions'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 1200);
    expect(handler).toContain('aichat_search_impressions');
    expect(handler).toContain('LIMIT 30');
  });

  it('ハンドラが ai_chat_shares を LEFT JOIN する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/search-impressions'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 1200);
    expect(handler).toContain('ai_chat_shares');
    expect(handler).toContain('LEFT JOIN');
  });

  it('ハンドラが aichat_search_log を LEFT JOIN してキーワードを取得する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/search-impressions'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 1200);
    expect(handler).toContain('aichat_search_log');
  });

  it('ハンドラが impression_count を返す', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/search-impressions'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 1200);
    expect(handler).toContain('impression_count');
  });
});

describe('POST /api/aichat/search-impressions エンドポイント', () => {
  it('index.ts に app.post の search-impressions ハンドラが存在する', () => {
    const idx = INDEX_SRC.indexOf("app.post('/api/aichat/search-impressions'");
    expect(idx).toBeGreaterThan(-1);
  });

  it('ハンドラが shareIds を受け取りバルク INSERT する', () => {
    const idx = INDEX_SRC.indexOf("app.post('/api/aichat/search-impressions'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 800);
    expect(handler).toContain('shareIds');
    expect(handler).toContain('aichat_search_impressions');
    expect(handler).toContain('INSERT');
  });

  it('ハンドラが resultCount を記録する', () => {
    const idx = INDEX_SRC.indexOf("app.post('/api/aichat/search-impressions'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 800);
    expect(handler).toContain('resultCount');
    expect(handler).toContain('result_count');
  });
});
