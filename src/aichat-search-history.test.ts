/**
 * aichat_search_history テーブルと POST /api/aichat/search-log の整合性テスト
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TABLE_COLUMN_KEYS, TABLE_GROUP_MAP, COLUMN_FK_TARGETS } from './index';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');
const INDEX_SRC = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');

describe('aichat_search_history テーブル登録', () => {
  it('TABLE_COLUMN_KEYS に aichat_search_history が登録されている', () => {
    expect(TABLE_COLUMN_KEYS['aichat_search_history']).toBeDefined();
  });

  it('aichat_search_history の id が pk', () => {
    expect(TABLE_COLUMN_KEYS['aichat_search_history']['id']).toBe('pk');
  });

  it('aichat_search_history の user_id が fk', () => {
    expect(TABLE_COLUMN_KEYS['aichat_search_history']['user_id']).toBe('fk');
  });

  it('aichat_search_history の share_id が fk', () => {
    expect(TABLE_COLUMN_KEYS['aichat_search_history']['share_id']).toBe('fk');
  });

  it('TABLE_GROUP_MAP で aichat_search_history が ai グループ', () => {
    expect(TABLE_GROUP_MAP['aichat_search_history']).toBe('ai');
  });

  it('COLUMN_FK_TARGETS で aichat_search_history.user_id が user_sessions を参照', () => {
    expect(COLUMN_FK_TARGETS['aichat_search_history']?.['user_id']).toBe('user_sessions');
  });

  it('COLUMN_FK_TARGETS で aichat_search_history.share_id が ai_chat_shares を参照', () => {
    expect(COLUMN_FK_TARGETS['aichat_search_history']?.['share_id']).toBe('ai_chat_shares');
  });
});

describe('aichat_search_history マイグレーションファイル', () => {
  it('migrations/0041_create_aichat_search_history.sql が存在する', () => {
    const file = path.join(MIGRATIONS_DIR, '0041_create_aichat_search_history.sql');
    expect(fs.existsSync(file)).toBe(true);
  });

  it('マイグレーションファイルに seq_num カラムが含まれる', () => {
    const file = path.join(MIGRATIONS_DIR, '0041_create_aichat_search_history.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    expect(sql).toContain('seq_num');
  });

  it('マイグレーションファイルに deleted_at カラムが含まれる', () => {
    const file = path.join(MIGRATIONS_DIR, '0041_create_aichat_search_history.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    expect(sql).toContain('deleted_at');
  });

  it('マイグレーションファイルに searched_at カラムが含まれる', () => {
    const file = path.join(MIGRATIONS_DIR, '0041_create_aichat_search_history.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    expect(sql).toContain('searched_at');
  });
});

describe('GET /api/aichat/search-history エンドポイント', () => {
  it('index.ts に app.get の search-history ハンドラが存在する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/search-history'");
    expect(idx).toBeGreaterThan(-1);
  });

  it('search-history ハンドラが aichat_search_history を SELECT する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/search-history'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 600);
    expect(handler).toContain('aichat_search_history');
    expect(handler).toContain('SELECT');
  });

  it('search-history ハンドラが ai_chat_shares を LEFT JOIN する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/search-history'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 600);
    expect(handler).toContain('ai_chat_shares');
  });

  it('search-history ハンドラが LIMIT 30 で取得する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/search-history'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 600);
    expect(handler).toContain('LIMIT 30');
  });
});

describe('GET /api/aichat/search-keyword-analysis エンドポイント', () => {
  it('index.ts に app.get の search-keyword-analysis ハンドラが存在する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/search-keyword-analysis'");
    expect(idx).toBeGreaterThan(-1);
  });

  it('ハンドラが aichat_search_history を GROUP BY で集計する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/search-keyword-analysis'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 700);
    expect(handler).toContain('aichat_search_history');
    expect(handler).toContain('GROUP BY');
    expect(handler).toContain('MAX');
  });

  it('ハンドラが ai_chat_shares を LEFT JOIN する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/search-keyword-analysis'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 700);
    expect(handler).toContain('ai_chat_shares');
    expect(handler).toContain('LEFT JOIN');
  });

  it('ハンドラが share_id でグループ化したレスポンスを返す', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/search-keyword-analysis'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 1200);
    expect(handler).toContain('share_id');
    expect(handler).toContain('items');
  });
});

describe('POST /api/aichat/search-log が aichat_search_history へも書き込む', () => {
  it('index.ts の search-log POST ハンドラに aichat_search_history への INSERT が含まれる', () => {
    const idx = INDEX_SRC.indexOf("app.post('/api/aichat/search-log'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 1400);
    expect(handler).toContain('aichat_search_history');
  });

  it('seq_num の計算に COUNT(*) + 1 の SQL サブクエリが含まれる', () => {
    const idx = INDEX_SRC.indexOf('INSERT INTO aichat_search_history');
    expect(idx).toBeGreaterThan(-1);
    const nearby = INDEX_SRC.slice(idx, idx + 400);
    expect(nearby).toContain('COUNT(*)');
  });

  it('searched_at カラムへの書き込みが含まれる', () => {
    const idx = INDEX_SRC.indexOf('INSERT INTO aichat_search_history');
    expect(idx).toBeGreaterThan(-1);
    const nearby = INDEX_SRC.slice(idx, idx + 300);
    expect(nearby).toContain('searched_at');
  });
});
