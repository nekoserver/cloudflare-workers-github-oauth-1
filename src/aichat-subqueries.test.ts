/**
 * aichat_subqueries / aichat_share_subquery_links テーブルと関連エンドポイントの整合性テスト
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TABLE_COLUMN_KEYS, TABLE_GROUP_MAP, COLUMN_FK_TARGETS } from './index';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');
const INDEX_SRC = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');

describe('aichat_subqueries テーブル登録', () => {
  it('TABLE_COLUMN_KEYS に aichat_subqueries が登録されている', () => {
    expect(TABLE_COLUMN_KEYS['aichat_subqueries']).toBeDefined();
  });

  it('aichat_subqueries の id が pk', () => {
    expect(TABLE_COLUMN_KEYS['aichat_subqueries']['id']).toBe('pk');
  });

  it('TABLE_GROUP_MAP で aichat_subqueries が ai グループ', () => {
    expect(TABLE_GROUP_MAP['aichat_subqueries']).toBe('ai');
  });
});

describe('aichat_share_subquery_links テーブル登録', () => {
  it('TABLE_COLUMN_KEYS に aichat_share_subquery_links が登録されている', () => {
    expect(TABLE_COLUMN_KEYS['aichat_share_subquery_links']).toBeDefined();
  });

  it('aichat_share_subquery_links の id が pk', () => {
    expect(TABLE_COLUMN_KEYS['aichat_share_subquery_links']['id']).toBe('pk');
  });

  it('aichat_share_subquery_links の subquery_id が fk', () => {
    expect(TABLE_COLUMN_KEYS['aichat_share_subquery_links']['subquery_id']).toBe('fk');
  });

  it('TABLE_GROUP_MAP で aichat_share_subquery_links が ai グループ', () => {
    expect(TABLE_GROUP_MAP['aichat_share_subquery_links']).toBe('ai');
  });

  it('COLUMN_FK_TARGETS で aichat_share_subquery_links.subquery_id が aichat_subqueries を参照', () => {
    expect(COLUMN_FK_TARGETS['aichat_share_subquery_links']?.['subquery_id']).toBe('aichat_subqueries');
  });
});

describe('aichat_subqueries マイグレーション', () => {
  it('0045_create_aichat_subqueries.sql が存在する', () => {
    const file = path.join(MIGRATIONS_DIR, '0045_create_aichat_subqueries.sql');
    expect(fs.existsSync(file)).toBe(true);
  });

  it('query カラムが含まれる', () => {
    const file = path.join(MIGRATIONS_DIR, '0045_create_aichat_subqueries.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    expect(sql).toContain('query');
  });

  it('UNIQUE 制約が含まれる', () => {
    const file = path.join(MIGRATIONS_DIR, '0045_create_aichat_subqueries.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    expect(sql.toUpperCase()).toContain('UNIQUE');
  });
});

describe('aichat_share_subquery_links マイグレーション', () => {
  it('0046_create_aichat_share_subquery_links.sql が存在する', () => {
    const file = path.join(MIGRATIONS_DIR, '0046_create_aichat_share_subquery_links.sql');
    expect(fs.existsSync(file)).toBe(true);
  });

  it('question カラムが含まれる', () => {
    const file = path.join(MIGRATIONS_DIR, '0046_create_aichat_share_subquery_links.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    expect(sql).toContain('question');
  });

  it('subquery_id カラムが含まれる', () => {
    const file = path.join(MIGRATIONS_DIR, '0046_create_aichat_share_subquery_links.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    expect(sql).toContain('subquery_id');
  });

  it('url カラムが含まれる', () => {
    const file = path.join(MIGRATIONS_DIR, '0046_create_aichat_share_subquery_links.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    expect(sql).toContain('url');
  });
});

describe('GET /api/aichat/subqueries エンドポイント', () => {
  it('index.ts に app.get の subqueries ハンドラが存在する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/subqueries'");
    expect(idx).toBeGreaterThan(-1);
  });

  it('ハンドラが aichat_subqueries を SELECT する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/subqueries'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 800);
    expect(handler).toContain('aichat_subqueries');
    expect(handler).toContain('SELECT');
  });
});

describe('POST /api/aichat/subqueries エンドポイント', () => {
  it('index.ts に app.post の subqueries ハンドラが存在する', () => {
    const idx = INDEX_SRC.indexOf("app.post('/api/aichat/subqueries'");
    expect(idx).toBeGreaterThan(-1);
  });

  it('ハンドラが query を INSERT する', () => {
    const idx = INDEX_SRC.indexOf("app.post('/api/aichat/subqueries'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 800);
    expect(handler).toContain('query');
    expect(handler).toContain('INSERT');
    expect(handler).toContain('aichat_subqueries');
  });

  it('ハンドラが重複チェックを行う', () => {
    const idx = INDEX_SRC.indexOf("app.post('/api/aichat/subqueries'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 800);
    expect(handler).toContain('OR IGNORE');
  });
});

describe('GET /api/aichat/share-subquery-links エンドポイント', () => {
  it('index.ts に app.get の share-subquery-links ハンドラが存在する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/share-subquery-links'");
    expect(idx).toBeGreaterThan(-1);
  });

  it('ハンドラが question パラメータで絞り込む', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/share-subquery-links'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 800);
    expect(handler).toContain('question');
    expect(handler).toContain('aichat_share_subquery_links');
  });

  it('ハンドラが aichat_subqueries を JOIN する', () => {
    const idx = INDEX_SRC.indexOf("app.get('/api/aichat/share-subquery-links'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 800);
    expect(handler).toContain('aichat_subqueries');
    expect(handler).toContain('JOIN');
  });
});

describe('POST /api/aichat/share-subquery-links エンドポイント', () => {
  it('index.ts に app.post の share-subquery-links ハンドラが存在する', () => {
    const idx = INDEX_SRC.indexOf("app.post('/api/aichat/share-subquery-links'");
    expect(idx).toBeGreaterThan(-1);
  });

  it('ハンドラが question, subquery_id, url を INSERT する', () => {
    const idx = INDEX_SRC.indexOf("app.post('/api/aichat/share-subquery-links'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 1000);
    expect(handler).toContain('question');
    expect(handler).toContain('subquery_id');
    expect(handler).toContain('url');
    expect(handler).toContain('INSERT');
  });

  it('ハンドラが重複チェックを行う', () => {
    const idx = INDEX_SRC.indexOf("app.post('/api/aichat/share-subquery-links'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 1000);
    expect(handler).toContain('OR IGNORE');
  });
});

describe('DELETE /api/aichat/share-subquery-links/:id エンドポイント', () => {
  it('ログインユーザー自身の追加質問リンクだけを削除する', () => {
    const idx = INDEX_SRC.indexOf("app.delete('/api/aichat/share-subquery-links/:id'");
    expect(idx).toBeGreaterThan(-1);
    const handler = INDEX_SRC.slice(idx, idx + 900);
    expect(handler).toContain('DELETE FROM aichat_share_subquery_links');
    expect(handler).toContain('user_id = ?');
    expect(handler).toContain('Not found');
  });
});

describe('追加質問リンク削除 UI', () => {
  const AICHAT_VIEW_SRC = fs.readFileSync(path.resolve(__dirname, 'views', 'aichat.ts'), 'utf-8');

  it('過去ログの追加質問リンクに削除ボタンと確認を表示する', () => {
    expect(AICHAT_VIEW_SRC).toContain('class="subquery-link-delete"');
    expect(AICHAT_VIEW_SRC).toContain('この追加質問を削除しますか？');
    expect(AICHAT_VIEW_SRC).toContain("method: 'DELETE'");
  });
});
