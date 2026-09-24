-- dynamicneko /tree-view は指定された2リポジトリだけを公開する。
-- 過去の全件取得で追加されたその他のJSONと関連ログを削除する。
DELETE FROM tree_view_snapshot_refresh_log
WHERE repo_name NOT IN (
  'nekoserver/cloudflare-workers-github-oauth-1',
  'nekoserver/dynamicneko'
);

DELETE FROM tree_view_update_log
WHERE repo_name NOT IN (
  'nekoserver/cloudflare-workers-github-oauth-1',
  'nekoserver/dynamicneko'
);

DELETE FROM tree_view_snapshots
WHERE repo_name NOT IN (
  'nekoserver/cloudflare-workers-github-oauth-1',
  'nekoserver/dynamicneko'
);
