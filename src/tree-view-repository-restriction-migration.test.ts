import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(process.cwd(), 'migrations/0157_restrict_tree_view_repositories.sql'),
  'utf8',
);

describe('migration 0157 tree-view repository restriction', () => {
  it('指定2リポジトリ以外のJSONと関連ログを削除する', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE tree_view_snapshots (repo_name TEXT PRIMARY KEY, tree_json TEXT, updated_at TEXT);
      CREATE TABLE tree_view_snapshot_refresh_log (id INTEGER PRIMARY KEY, user_id TEXT, repo_name TEXT, requested_at TEXT);
      CREATE TABLE tree_view_update_log (id INTEGER PRIMARY KEY, repo_name TEXT, update_source TEXT, changed INTEGER, executed_at TEXT);
      INSERT INTO tree_view_snapshots VALUES
        ('nekoserver/cloudflare-workers-github-oauth-1', '{}', '2026-09-22'),
        ('nekoserver/dynamicneko', '{}', '2026-09-22'),
        ('nekoserver/unrequested', '{}', '2026-09-22');
      INSERT INTO tree_view_snapshot_refresh_log VALUES
        (1, 'user', 'nekoserver/dynamicneko', '2026-09-22'),
        (2, 'user', 'nekoserver/unrequested', '2026-09-22');
      INSERT INTO tree_view_update_log VALUES
        (1, 'nekoserver/cloudflare-workers-github-oauth-1', 'scheduled', 1, '2026-09-22'),
        (2, 'nekoserver/unrequested', 'scheduled', 1, '2026-09-22');
    `);

    db.exec(migrationSql);

    expect(db.prepare('SELECT repo_name FROM tree_view_snapshots ORDER BY repo_name').all()).toEqual([
      { repo_name: 'nekoserver/cloudflare-workers-github-oauth-1' },
      { repo_name: 'nekoserver/dynamicneko' },
    ]);
    expect(db.prepare('SELECT repo_name FROM tree_view_snapshot_refresh_log').all()).toEqual([
      { repo_name: 'nekoserver/dynamicneko' },
    ]);
    expect(db.prepare('SELECT repo_name FROM tree_view_update_log').all()).toEqual([
      { repo_name: 'nekoserver/cloudflare-workers-github-oauth-1' },
    ]);
  });
});
