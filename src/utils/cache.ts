/**
 * D1キャッシュユーティリティ
 *
 * 3層キャッシュ設計:
 *   Layer 1: 不変データ（commit_calendar_cache — 永久保存、既存テーブル）
 *   Layer 2: リポジトリ単位 repo_cache（TTL付き、ユーザー間で共有）
 *   Layer 3: ユーザー単位 user_cache（TTL付き、ユーザー固有）
 */

/** データ種別ごとのTTL定義（秒） */
const CACHE_TTL: Record<string, number> = {
  // Layer 2: リポジトリ単位
  latest_commit: 300,     // 5分
  issues_count:  600,     // 10分
  hooks:         3600,    // 1時間
  // Layer 3: ユーザー単位
  repositories:    1800,  // 30分
  installations:   3600,  // 1時間
  linked_services: 1800,  // 30分
};

/**
 * Layer 2: リポジトリ単位キャッシュの読み取り
 */
export async function getRepoCache<T>(
  db: D1Database,
  owner: string,
  repo: string,
  dataType: string
): Promise<T | null> {
  const ttl = CACHE_TTL[dataType] ?? 600;
  try {
    const row = await db.prepare(
      `SELECT data FROM repo_cache
       WHERE owner = ? AND repo = ? AND data_type = ?
       AND unixepoch('now') - unixepoch(cached_at) < ?`
    ).bind(owner, repo, dataType, ttl).first<{ data: string }>();
    return row ? JSON.parse(row.data) : null;
  } catch {
    return null;
  }
}

/**
 * Layer 2: リポジトリ単位キャッシュの書き込み
 */
export async function setRepoCache(
  db: D1Database,
  owner: string,
  repo: string,
  dataType: string,
  data: unknown
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO repo_cache (owner, repo, data_type, data, cached_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (owner, repo, data_type) DO UPDATE SET
         data = excluded.data,
         cached_at = excluded.cached_at`
    ).bind(owner, repo, dataType, JSON.stringify(data), now).run();
  } catch {
    // キャッシュ書き込み失敗は無視（テーブル未作成時も含む）
  }
}

/**
 * Layer 3: ユーザー単位キャッシュの読み取り
 */
export async function getUserCache<T>(
  db: D1Database,
  userId: string,
  dataType: string
): Promise<T | null> {
  const ttl = CACHE_TTL[dataType] ?? 600;
  try {
    const row = await db.prepare(
      `SELECT data FROM user_cache
       WHERE user_id = ? AND data_type = ?
       AND unixepoch('now') - unixepoch(cached_at) < ?`
    ).bind(userId, dataType, ttl).first<{ data: string }>();
    return row ? JSON.parse(row.data) : null;
  } catch {
    return null;
  }
}

/**
 * Layer 3: ユーザー単位キャッシュの書き込み
 */
export async function setUserCache(
  db: D1Database,
  userId: string,
  dataType: string,
  data: unknown
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO user_cache (user_id, data_type, data, cached_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, data_type) DO UPDATE SET
         data = excluded.data,
         cached_at = excluded.cached_at`
    ).bind(userId, dataType, JSON.stringify(data), now).run();
  } catch {
    // キャッシュ書き込み失敗は無視
  }
}

/**
 * ユーザー単位キャッシュの無効化（ログアウト時等）
 */
export async function invalidateUserCache(
  db: D1Database,
  userId: string,
  dataType?: string
): Promise<void> {
  try {
    if (dataType) {
      await db.prepare(
        `DELETE FROM user_cache WHERE user_id = ? AND data_type = ?`
      ).bind(userId, dataType).run();
    } else {
      await db.prepare(
        `DELETE FROM user_cache WHERE user_id = ?`
      ).bind(userId).run();
    }
  } catch {
    // 無視
  }
}
