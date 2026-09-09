import { describe, expect, it, vi } from 'vitest';
import {
  formatSqlImpactReport,
  interpretAichatSlashCommand,
  type SqlImpactCatalogRow,
} from './utils/aichatSlashCommand';

const rows: SqlImpactCatalogRow[] = [
  {
    queryName: 'ListShares', command: 'many', commandConfirmed: 1,
    sourceFile: 'src/index.ts', sourceLine: 120, migrationFile: '0074_add_deleted_at_to_ai_chat_shares.sql',
    lastCommitHash: '1234567890abcdef', lastCommitAt: '2026-09-08 10:00:00', sqlText: 'SELECT * FROM ai_chat_shares',
  },
  {
    queryName: 'DeleteShare', command: 'exec', commandConfirmed: 0,
    sourceFile: 'src/index.ts', sourceLine: 180, migrationFile: null,
    lastCommitHash: null, lastCommitAt: null, sqlText: 'DELETE FROM ai_chat_shares WHERE id = ?',
  },
];

const deps = { fetchLatestCommitAgentLog: async () => null };

describe('/neko sql impact', () => {
  it('テーブル名を依存関数へ渡し、カタログの影響レポートを返す', async () => {
    const sqlImpactLookup = vi.fn().mockResolvedValue(rows);
    const result = await interpretAichatSlashCommand('/neko sql impact ai_chat_shares', new Date(), {
      ...deps,
      sqlImpactLookup,
    });

    expect(sqlImpactLookup).toHaveBeenCalledWith('ai_chat_shares');
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('slash command was not handled');
    expect(result.response).toBe(formatSqlImpactReport('ai_chat_shares', rows));
    expect(result.response).toContain('| 関連SQL | 2 |');
    expect(result.response).toContain('| 読み取り処理 | 1 |');
    expect(result.response).toContain('| 書き込み処理 | 1 |');
    expect(result.response).toContain('sqlcコマンド種別が推測状態です');
    expect(result.response).toContain('/d1-query-catalog?table=ai_chat_shares');
  });

  it('テーブル名欠落、不正な名前、DB未設定、空結果を明示する', async () => {
    const missing = await interpretAichatSlashCommand('/neko sql impact', new Date(), deps);
    const invalid = await interpretAichatSlashCommand('/neko sql impact users;DROP', new Date(), deps);
    const unavailable = await interpretAichatSlashCommand('/neko sql impact users', new Date(), deps);
    const empty = await interpretAichatSlashCommand('/neko sql impact users', new Date(), {
      ...deps, sqlImpactLookup: async () => [],
    });
    expect(missing.handled && missing.response).toContain('/neko sql impact <テーブル名>');
    expect(invalid.handled && invalid.response).toContain('テーブル名が不正です');
    expect(unavailable.handled && unavailable.response).toContain('DB未設定');
    expect(empty.handled && empty.response).toContain('関連SQLは登録されていません');
  });

  it('取得エラーを空結果として握りつぶさず利用者へ返す', async () => {
    const result = await interpretAichatSlashCommand('/neko sql impact users', new Date(), {
      ...deps, sqlImpactLookup: async () => { throw new Error('catalog unavailable'); },
    });
    expect(result.handled && result.response).toContain('catalog unavailable');
  });
});
