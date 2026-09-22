import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(process.cwd(), 'migrations/0156_reset_tree_view_seed.sql'),
  'utf8',
);

describe('migration 0156 tree-view seed reset', () => {
  it('既存データと更新履歴を白紙に戻し、指定された2リポジトリだけを投入する', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE tree_view_snapshots (
        repo_name TEXT PRIMARY KEY,
        tree_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE tree_view_snapshot_refresh_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        repo_name TEXT NOT NULL,
        requested_at TEXT NOT NULL
      );
      CREATE TABLE tree_view_update_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_name TEXT NOT NULL,
        update_source TEXT NOT NULL,
        changed INTEGER NOT NULL,
        executed_at TEXT NOT NULL
      );
      INSERT INTO tree_view_snapshots VALUES ('nekoserver/broken', '{}', '2000-01-01T00:00:00.000Z');
      INSERT INTO tree_view_snapshot_refresh_log (user_id, repo_name, requested_at)
        VALUES ('user', 'nekoserver/broken', '2000-01-01T00:00:00.000Z');
      INSERT INTO tree_view_update_log (repo_name, update_source, changed, executed_at)
        VALUES ('nekoserver/broken', 'manual', 1, '2000-01-01T00:00:00.000Z');
    `);

    db.exec(migrationSql);

    const snapshots = db.prepare(
      'SELECT repo_name, tree_json FROM tree_view_snapshots ORDER BY repo_name',
    ).all() as Array<{ repo_name: string; tree_json: string }>;
    expect(snapshots.map((row) => row.repo_name)).toEqual([
      'nekoserver/cloudflare-workers-github-oauth-1',
      'nekoserver/dynamicneko',
    ]);
    for (const row of snapshots) {
      expect(JSON.parse(row.tree_json)).toMatchObject({ name: row.repo_name, type: 'dir' });
    }
    expect(db.prepare('SELECT COUNT(*) AS count FROM tree_view_snapshot_refresh_log').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM tree_view_update_log').get()).toEqual({ count: 0 });
  });

  it('再実行しても同じ2件に収束する', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE tree_view_snapshots (repo_name TEXT PRIMARY KEY, tree_json TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE tree_view_snapshot_refresh_log (id INTEGER PRIMARY KEY, user_id TEXT, repo_name TEXT, requested_at TEXT);
      CREATE TABLE tree_view_update_log (id INTEGER PRIMARY KEY, repo_name TEXT, update_source TEXT, changed INTEGER, executed_at TEXT);
    `);
    db.exec(migrationSql);
    db.exec(migrationSql);
    expect(db.prepare('SELECT COUNT(*) AS count FROM tree_view_snapshots').get()).toEqual({ count: 2 });
  });
});
