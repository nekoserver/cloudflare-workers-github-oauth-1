-- 作成セッションで Codex による作成を確認できた本体リポジトリの PR。
-- 同じ GitHub アカウントによる他の PR や、検出済みの別エージェントは対象外。
UPDATE commit_agent_log
SET detected_agent_name = 'codex', detected_signal = 'pr'
WHERE repo_full_name = 'nekoserver/cloudflare-workers-github-oauth-1'
  AND pr_number IN (2689, 2690, 2691, 2694, 2695, 2696, 2697, 2698)
  AND (detected_agent_name IS NULL OR detected_agent_name = 'unknown');
