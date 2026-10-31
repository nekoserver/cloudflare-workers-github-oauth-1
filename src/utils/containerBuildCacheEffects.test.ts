import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCacheEffects } from './containerBuildCacheEffects';
import { storeBuildTimings } from './containerBuildTimings';

// ソースからビルドしたら、ソースを捨てる前に「ソースからのコンパイル時間」と「パッケージ(キャッシュ)からのインストール時間」を
// 測ってビルドログに出し、ビルドのたびにD1(cf_container_build_cache_effects)に記録する(ユーザー指定 2026-10-31)。
// ログの行: CACHE_EFFECT package=<名前> version=<版> compile_ms=<ミリ秒> install_ms=<ミリ秒> source_bytes=<ソースアーカイブのバイト数> package_bytes=<パッケージのバイト数>
describe('キャッシュの効果の記録', () => {
  it('BuildKitのログから、パッケージごとのコンパイル時間とインストール時間を読む', () => {
    const log = '#12 [ruby-build 3/3] RUN curl ...\n#12 812.301 CACHE_EFFECT package=ruby version=4.0.9 compile_ms=780200 install_ms=3100 source_bytes=23000000 package_bytes=41000000\n#12 DONE 815.0s\n#9 433.1 CACHE_EFFECT package=tailscale version=1.104.4 compile_ms=430000 install_ms=900 source_bytes=150000000 package_bytes=30000000';
    expect(parseCacheEffects(log)).toEqual([
      { packageName: 'ruby', version: '4.0.9', compileSeconds: 780.2, installSeconds: 3.1, savedSeconds: 777.1, sourceBytes: 23000000, packageBytes: 41000000 },
      { packageName: 'tailscale', version: '1.104.4', compileSeconds: 430, installSeconds: 0.9, savedSeconds: 429.1, sourceBytes: 150000000, packageBytes: 30000000 },
    ]);
  });
  it('形の崩れた行や負の値は記録しない(推測で埋めない)', () => {
    expect(parseCacheEffects('CACHE_EFFECT package=ruby version=4.0.9 compile_ms=abc install_ms=1\nCACHE_EFFECT package=x version=1 compile_ms=-1 install_ms=1\necho CACHE_EFFECT package=$P')).toEqual([]);
  });
  it('サイズの無い古い形の行は、サイズを空(null)として記録する(0で埋めない)', () => {
    expect(parseCacheEffects('CACHE_EFFECT package=ruby version=4.0.9 compile_ms=1000 install_ms=10')[0]).toMatchObject({ sourceBytes: null, packageBytes: null });
  });
  it('同じパッケージが2回出たら、最後の値を使う(再表示されたログ)', () => {
    expect(parseCacheEffects('CACHE_EFFECT package=jj version=1 compile_ms=1000 install_ms=10 source_bytes=1 package_bytes=1\nCACHE_EFFECT package=jj version=1 compile_ms=2000 install_ms=20 source_bytes=1 package_bytes=1')).toHaveLength(1);
  });
  it('ビルドの記録と同じbatchで、cf_container_build_cache_effects に保存する', async () => {
    const batches: { sql: string; values: unknown[] }[][] = [];
    const db = { prepare: (sql: string) => ({ bind: (...values: unknown[]) => ({ sql, values }) }), batch: async (s: { sql: string; values: unknown[] }[]) => { batches.push(s); } };
    const log = '#1 [ruby-build 3/3] RUN make\n#1 812.3 CACHE_EFFECT package=ruby version=4.0.9 compile_ms=780200 install_ms=3100 source_bytes=23000000 package_bytes=41000000\n#1 DONE 815s';
    const result = await storeBuildTimings(db as never, { buildUuid: 'b1', status: 'success', log, logComplete: true });
    const insert = batches[0].find(s => s.sql.includes('cf_container_build_cache_effects'))!;
    expect(insert.values).toEqual([result.snapshotKey, 'b1', 'ruby', '4.0.9', 780.2, 3.1, 777.1, 23000000, 41000000]);
  });
  it('マイグレーションと/statusの登録がある', () => {
    const migration = readFileSync(new URL('../../migrations/0191_create_cf_container_build_cache_effects.sql', import.meta.url), 'utf8');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS cf_container_build_cache_effects');
    expect(migration).not.toContain('--');
    expect(migration).toContain('source_bytes INTEGER');
    expect(migration).toContain('package_bytes INTEGER');
    const index = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
    expect(index).toContain("name: 'cf_container_build_cache_effects', migration: '0191'");
  });
});
