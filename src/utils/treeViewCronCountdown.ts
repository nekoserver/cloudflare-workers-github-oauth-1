/** tree-view の定期更新に対応するカウントダウン予定名。 */
export const TREE_VIEW_CRON_COUNTDOWN_LABEL = 'tree-view cron更新';

/**
 * wrangler.toml の `0 *\/6 * * *` と同じ、次の UTC 6時間境界を返す。
 * 境界時刻そのものは「実行済み」とみなし、必ず次の実行を返す。
 */
export function getNextTreeViewCronAt(now: Date): string {
  const next = new Date(now.getTime());
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(Math.floor(now.getUTCHours() / 6) * 6 + 6);
  return next.toISOString();
}

/**
 * cron 実行後、ログイン可能な全ユーザーの次回 tree-view 更新予定を置換する。
 * DELETE と INSERT ... SELECT を使い、ユーザーごとに予定が増殖しないようにする。
 */
export async function registerNextTreeViewCronCountdown(
  db: D1Database | undefined,
  executedAt = new Date()
): Promise<{ registered: number; targetAt: string }> {
  const targetAt = getNextTreeViewCronAt(executedAt);
  if (!db) return { registered: 0, targetAt };

  const deleteExisting = db.prepare('DELETE FROM countdown_events WHERE label = ?')
    .bind(TREE_VIEW_CRON_COUNTDOWN_LABEL);
  const insertNext = db.prepare(
    `INSERT INTO countdown_events (user_id, label, target_at, group_id)
     SELECT user_id, ?, ?, NULL FROM user_sessions`
  ).bind(TREE_VIEW_CRON_COUNTDOWN_LABEL, targetAt);
  const [, result] = await db.batch([deleteExisting, insertNext]);

  return { registered: Number(result.meta?.changes ?? 0), targetAt };
}

/**
 * /countdown を開いたユーザーについても次回予定を保証する。
 * デプロイ直後（次の scheduled 実行前）でも表示でき、過去の予定は増殖させない。
 */
export async function ensureTreeViewCronCountdownForUser(
  db: D1Database,
  userId: string,
  now = new Date()
): Promise<{ targetAt: string }> {
  const targetAt = getNextTreeViewCronAt(now);
  await db.prepare(
    `DELETE FROM countdown_events
     WHERE user_id = ? AND label = ?`
  ).bind(userId, TREE_VIEW_CRON_COUNTDOWN_LABEL).run();
  await db.prepare(
    `INSERT INTO countdown_events (user_id, label, target_at, group_id)
     VALUES (?, ?, ?, NULL)`
  ).bind(userId, TREE_VIEW_CRON_COUNTDOWN_LABEL, targetAt).run();
  return { targetAt };
}
