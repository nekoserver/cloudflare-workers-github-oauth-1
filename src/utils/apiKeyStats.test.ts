import { describe, expect, it, vi } from 'vitest';
import { recordApiKeyEndpointAccess, summarizeApiKeyUsage, type ApiKeyStatsDb, type ApiKeyEndpointStatRow } from './apiKeyStats';

/**
 * 対象: APIキー単位の使用統計(api_key_endpoint_stats)の記録・集計ロジック。
 *
 * 故障シナリオ:
 *   (1) keyIdやroutePathが空の場合は記録しない(存在しないキーの下に
 *       ゴミ行が積み上がるのを防ぐ)
 *   (2) 同じキー・同じ日・同じエンドポイント・同じステータスの行はcountを
 *       積み上げる(INSERT OR IGNOREではなくON CONFLICT DO UPDATE)
 *   (3) 集計(summarizeApiKeyUsage)は日をまたぐ・エンドポイントが複数ある
 *       場合でも正しく合算する
 *   (4) 行が0件のときは合計0・空配列を返す(nullや例外にしない)
 */

function createMockDb(): { db: ApiKeyStatsDb; calls: { sql: string; args: unknown[] }[] } {
  const calls: { sql: string; args: unknown[] }[] = [];
  const db: ApiKeyStatsDb = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          calls.push({ sql, args });
          return { async run() { return { success: true }; } };
        },
      };
    },
  };
  return { db, calls };
}

describe('recordApiKeyEndpointAccess', () => {
  it('keyIdが空なら記録しない', async () => {
    const { db, calls } = createMockDb();
    await recordApiKeyEndpointAccess(db, '', 'POST', '/api/aichat', 200);
    expect(calls).toHaveLength(0);
  });

  it('routePathが空なら記録しない', async () => {
    const { db, calls } = createMockDb();
    await recordApiKeyEndpointAccess(db, 'key1', 'POST', '', 200);
    expect(calls).toHaveLength(0);
  });

  it('method+routePathを"METHOD /path"の形にしたendpointと、JSTの日付でUPSERTする', async () => {
    const { db, calls } = createMockDb();
    // 2026-01-01T15:30:00Z は JST で 2026-01-02 00:30
    await recordApiKeyEndpointAccess(db, 'key1', 'POST', '/api/aichat', 200, new Date('2026-01-01T15:30:00.000Z'));
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('ON CONFLICT(key_id, day, endpoint, status_code) DO UPDATE SET');
    expect(calls[0].sql).toContain('count = count + 1');
    expect(calls[0].args).toEqual(['key1', '2026-01-02', 'POST /api/aichat', 200]);
  });
});

describe('summarizeApiKeyUsage', () => {
  it('行が0件なら合計0・空配列を返す', () => {
    const result = summarizeApiKeyUsage([]);
    expect(result).toEqual({ totalCount: 0, byEndpoint: [], byDay: [], byMonth: [] });
  });

  it('複数日・複数エンドポイントの件数を正しく合算する(月別は日別からロールアップ)', () => {
    const rows: ApiKeyEndpointStatRow[] = [
      { day: '2026-06-01', endpoint: 'POST /api/aichat', status_code: 200, count: 5 },
      { day: '2026-06-01', endpoint: 'POST /api/aichat', status_code: 401, count: 1 },
      { day: '2026-06-02', endpoint: 'POST /api/aichat', status_code: 200, count: 3 },
      { day: '2026-07-01', endpoint: 'GET /', status_code: 200, count: 2 },
    ];
    const result = summarizeApiKeyUsage(rows);

    expect(result.totalCount).toBe(11);
    expect(result.byEndpoint).toEqual([
      { endpoint: 'POST /api/aichat', count: 9 },
      { endpoint: 'GET /', count: 2 },
    ]);
    expect(result.byDay).toEqual([
      { day: '2026-06-01', count: 6 },
      { day: '2026-06-02', count: 3 },
      { day: '2026-07-01', count: 2 },
    ]);
    expect(result.byMonth).toEqual([
      { month: '2026-06', count: 9 },
      { month: '2026-07', count: 2 },
    ]);
  });

  it('byEndpointは件数の多い順に並ぶ', () => {
    const rows: ApiKeyEndpointStatRow[] = [
      { day: '2026-06-01', endpoint: 'GET /', status_code: 200, count: 1 },
      { day: '2026-06-01', endpoint: 'POST /api/aichat', status_code: 200, count: 10 },
    ];
    const result = summarizeApiKeyUsage(rows);
    expect(result.byEndpoint.map((e) => e.endpoint)).toEqual(['POST /api/aichat', 'GET /']);
  });
});
