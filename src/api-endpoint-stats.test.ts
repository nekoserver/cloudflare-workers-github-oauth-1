import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

describe('APIエンドポイント集計', () => {
  it('recordApiAccess 関数が定義されている', () => {
    expect(src).toContain('async function recordApiAccess');
  });

  it('api_endpoint_stats テーブルへの UPSERT 処理が存在する', () => {
    expect(src).toContain('api_endpoint_stats');
    expect(src).toContain('ON CONFLICT(endpoint, status_code)');
  });

  it('/api/* ミドルウェアが存在する', () => {
    expect(src).toContain("app.use('/api/*'");
  });

  it('ミドルウェアが waitUntil で recordApiAccess を呼び出す', () => {
    const mwStart = src.indexOf("app.use('/api/*'");
    const mwBody = src.slice(mwStart, mwStart + 300);
    expect(mwBody).toContain('waitUntil');
    expect(mwBody).toContain('recordApiAccess');
  });

  it('recordApiAccess は DB がない場合にスキップする', () => {
    const fnStart = src.indexOf('async function recordApiAccess');
    const fnBody = src.slice(fnStart, fnStart + 300);
    expect(fnBody).toContain('if (!db || !routePath) return');
  });

  it('endpoint キーが METHOD + routePath で構成される', () => {
    const fnStart = src.indexOf('async function recordApiAccess');
    const fnBody = src.slice(fnStart, fnStart + 300);
    expect(fnBody).toContain('`${method} ${routePath}`');
  });

  it('マイグレーション 0056 が STATUS_MIGRATION_SQL に登録されている', () => {
    expect(src).toContain("'0056':");
  });

  it('api_endpoint_stats が TABLE_COLUMN_KEYS に登録されている', () => {
    expect(src).toContain('api_endpoint_stats:');
  });
});
