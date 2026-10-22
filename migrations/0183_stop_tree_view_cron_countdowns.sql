-- Repository checks are paused by user request. Retain their schedule history.
UPDATE countdown_events
SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    deleted_by = 'system',
    deletion_reason = 'ユーザー指定によるリポジトリcronチェックの停止'
WHERE label = 'tree-view cron更新' AND deleted_at IS NULL;
