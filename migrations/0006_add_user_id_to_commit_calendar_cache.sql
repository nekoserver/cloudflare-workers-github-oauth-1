-- commit_calendar_cache にユーザーIDを追加
-- キャッシュをユーザー単位で分離し、他人のデータが混在しないようにする
ALTER TABLE commit_calendar_cache ADD COLUMN user_id TEXT NOT NULL DEFAULT '';

-- 既存のユニークインデックスを削除して user_id を含む新しいインデックスに置き換え
DROP INDEX IF EXISTS idx_commit_calendar_owner_repo_ym;

CREATE UNIQUE INDEX idx_commit_calendar_user_owner_repo_ym
  ON commit_calendar_cache (user_id, owner, repo, year, month);
