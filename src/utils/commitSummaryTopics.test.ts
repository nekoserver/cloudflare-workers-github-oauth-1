import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { saveSummaryKeywords } from './aiSummaryKeywords';
import { STATUS_MIGRATION_SQL, STATUS_TABLE_DEFINITIONS } from '../index';

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(readFileSync('migrations/0012_create_ai_summary_log.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0169_create_ai_summary_keywords.sql', 'utf8'));
  sqlite.exec("INSERT INTO ai_summary_log(id,request_id,daily_seq,event_date,created_at,repo_full_name,summary) VALUES(1,'req',1,'2026-10-14','2026-10-14T00:00:00Z','owner/repo','翻訳済み要約')");
  return sqlite;
}
const migration = () => readFileSync('migrations/0173_create_commit_summary_topics.sql', 'utf8');
function d1(sqlite: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      return { bind: (...args: any[]) => ({ run: () => stmt.run(...args) }) };
    },
    async batch(stmts: any[]) {
      sqlite.exec('BEGIN');
      try { const results = stmts.map(stmt => stmt.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  } as unknown as D1Database;
}
describe('commit summary topic persistence', () => {
  it('keeps the status-page migration consistent and preserves migration 0172', () => {
    expect(STATUS_MIGRATION_SQL['0173'].trim()).toBe(migration().trim());
    expect(readFileSync('migrations/0172_update_tree_view_depth_to_seven.sql', 'utf8')).toContain('UPDATE workflow_steps');
    for (const name of ['commit_summary_topics', 'commit_summary_topic_links']) {
      expect(STATUS_TABLE_DEFINITIONS.find(table => table.name === name)?.migration).toBe('0173');
    }
  });
  it('records each extracted key and timestamp immediately, and deduplicates repeat saves', async () => {
    const sqlite = setup(); sqlite.exec(migration());
    const now = '2026-10-14T01:00:00Z';
    await saveSummaryKeywords(d1(sqlite), 'req', ['HMAC', 'ストリーム'], now);
    await saveSummaryKeywords(d1(sqlite), 'req', ['HMAC'], '2026-10-15T01:00:00Z');
    const rows = sqlite.prepare('SELECT t.name, s.summary_log_id, s.recorded_at FROM commit_summary_topics t JOIN commit_summary_topic_links s ON s.topic_id=t.id ORDER BY t.name').all();
    expect(rows).toEqual([{name:'HMAC',summary_log_id:1,recorded_at:now},{name:'ストリーム',summary_log_id:1,recorded_at:now}]);
    sqlite.close();
  });
  it('backfills existing keys and can apply migration again without duplicates', () => {
    const sqlite = setup();
    sqlite.exec("INSERT INTO ai_summary_keywords(summary_log_id,keyword,created_at) VALUES(1,'HMAC','2026-10-14T01:00:00Z')");
    sqlite.exec(migration()); sqlite.exec(migration());
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM commit_summary_topic_links').get()).toEqual({n:1});
    sqlite.close();
  });
  it('rolls back keyword storage if topic storage fails', async () => {
    const sqlite = setup(); sqlite.exec(migration());
    sqlite.exec("CREATE TRIGGER fail_topic BEFORE INSERT ON commit_summary_topic_links BEGIN SELECT RAISE(ABORT, 'storage failed'); END");
    await expect(saveSummaryKeywords(d1(sqlite),'req',['HMAC'],'2026-10-14T01:00:00Z')).rejects.toThrow('storage failed');
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM ai_summary_keywords').get()).toEqual({n:0});
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM commit_summary_topics').get()).toEqual({n:0});
    sqlite.close();
  });
  it('shares topics across summaries, trims names and ignores blank keywords', async () => {
    const sqlite = setup();
    try {
      sqlite.exec(migration());
      sqlite.exec("INSERT INTO ai_summary_log(id,request_id,daily_seq,event_date,created_at,repo_full_name,summary) VALUES(2,'req2',2,'2026-10-14','2026-10-14T00:00:00Z','owner/other','別の要約')");
      await saveSummaryKeywords(d1(sqlite), 'req', [' HMAC ', '', '   '], '2026-10-14T01:00:00Z');
      await saveSummaryKeywords(d1(sqlite), 'req2', ['HMAC'], '2026-10-15T01:00:00Z');
      expect(sqlite.prepare('SELECT name,created_at FROM commit_summary_topics').all()).toEqual([
        { name: 'HMAC', created_at: '2026-10-14T01:00:00Z' },
      ]);
      expect(sqlite.prepare('SELECT summary_log_id,recorded_at FROM commit_summary_topic_links ORDER BY summary_log_id').all()).toEqual([
        { summary_log_id: 1, recorded_at: '2026-10-14T01:00:00Z' },
        { summary_log_id: 2, recorded_at: '2026-10-15T01:00:00Z' },
      ]);
    } finally { sqlite.close(); }
  });
  it('removes summary links when their parent summary is deleted', async () => {
    const sqlite = setup();
    try {
      sqlite.exec(migration());
      await saveSummaryKeywords(d1(sqlite), 'req', ['HMAC'], '2026-10-14T01:00:00Z');
      sqlite.exec('DELETE FROM ai_summary_keywords WHERE summary_log_id=1; DELETE FROM ai_summary_log WHERE id=1');
      expect(sqlite.prepare('SELECT COUNT(*) AS n FROM commit_summary_topic_links').get()).toEqual({ n: 0 });
    } finally { sqlite.close(); }
  });
});
