INSERT OR IGNORE INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order) VALUES
('slack_interaction_log', 'config', 'Slack操作ログ', '0024', 'auto', 0),
('commit_agent_log', 'ai', 'コミットエージェント検出ログ', '0025', 'auto', 0),
('group_oauth_apps', 'config', 'グループ別OAuth App認可状況', '0027', 'manual', 0),
('ai_summary_link_access_log', 'ai', 'AI要約リンクアクセス監査ログ', '0029', 'auto', 0),
('commit_stats_cache', 'commit', 'コミット統計キャッシュ', '0030', 'auto', 0),
('commit_search_hit_details', 'commit', 'コミット検索ヒット詳細（コミット単位）', '0032', 'auto', 0);

INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('user_sessions', 'current_workspace_id', 'fk', 'workspaces'),
('team_members', 'user_id', 'pk+fk', 'user_sessions'),
('cache_stats', 'user_id', 'fk', 'user_sessions'),
('cloudflare_setup_pending', 'user_id', 'fk', 'user_sessions'),
('commit_search_history', 'user_id', 'fk', 'user_sessions'),
('commit_search_hit_details', 'search_history_id', 'fk', 'commit_search_history'),
('commit_calendar_cache', 'workspace_id', 'fk', 'workspaces'),
('commit_list_cache', 'workspace_id', 'fk', 'workspaces'),
('repo_color_settings', 'workspace_id', 'fk', 'workspaces'),
('repo_color_settings', 'repo_name', 'fk', 'installation_permissions'),
('repo_groups', 'workspace_id', 'fk', 'workspaces'),
('repo_group_members', 'workspace_id', 'fk', 'workspaces'),
('repo_group_members', 'repo_name', 'pk+fk', 'installation_permissions'),
('group_oauth_apps', 'workspace_id', 'fk', 'workspaces'),
('commit_agent_log', 'request_id', 'fk', 'ai_summary_log'),
('ai_summary_link_access_log', 'request_id', 'fk', 'ai_summary_log'),
('email_mfa_challenges', 'user_id', 'fk', 'user_sessions'),
('email_audit_anomalies', 'target_user_id', 'fk', 'user_sessions');
