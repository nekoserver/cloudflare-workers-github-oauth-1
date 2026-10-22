import type { Bindings } from '../types';
import { askTunnelSigner } from './tunnelSignerAsk';

export const CODEX_RESET_COUNTDOWN_PREFIX = 'Codex 5時間リセット（日本時間 ';
const CRON_ACTOR = 'cron Bot';
const RESET_REPLACEMENT_REASON = '6時間cronによるCodexリセット予定の更新';

/** Read only the Codex five-hour window, never the weekly or another model's quota. */
export function parseCodexFiveHourReset(reply: string, now = new Date()): { targetAt: string; japanTime: string } {
  const line = reply.split('\n').find((value) => /^codex 5時間枠:/.test(value));
  const match = line?.match(/リセット (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC\s*$/);
  if (!match) throw new Error('Codexの5時間枠のリセット日時を秒まで取得できませんでした');
  const targetAt = `${match[1]}T${match[2]}.000Z`;
  const date = new Date(targetAt);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== targetAt) throw new Error('Codexのリセット日時が不正です');
  if (date.getTime() <= now.getTime()) throw new Error('Codexの5時間枠のリセット日時が過去のため登録しません');
  // Fixed JST offset, independent of the Worker or browser timezone.
  const japanTime = new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
  return { targetAt, japanTime };
}

/** The same shared-account schedule is registered for the users of countdown. */
export async function registerCodexResetCountdown(db: D1Database, reply: string, now = new Date()) {
  const reset = parseCodexFiveHourReset(reply, now);
  const label = `${CODEX_RESET_COUNTDOWN_PREFIX}${reset.japanTime}）`;
  const labelPattern = `${CODEX_RESET_COUNTDOWN_PREFIX}%`;
  const [retired, inserted] = await db.batch([
    // A manual quota reset invalidates every previous schedule, even when
    // the reported timestamp is unchanged. Keep the old rows as history.
    db.prepare(`UPDATE countdown_events SET deleted_at = ?, deleted_by = ?, deletion_reason = ?
      WHERE label LIKE ? AND deleted_at IS NULL`)
      .bind(now.toISOString(), CRON_ACTOR, RESET_REPLACEMENT_REASON, labelPattern),
    db.prepare(`INSERT INTO countdown_events (user_id, label, target_at, group_id, created_at, created_by, creation_reason)
      SELECT u.user_id, ?, ?, NULL, ?, ?, ? FROM user_sessions u`)
      .bind(label, reset.targetAt, now.toISOString(), CRON_ACTOR, RESET_REPLACEMENT_REASON),
  ]);
  return { ...reset, processedBy: CRON_ACTOR, retired: Number(retired.meta?.changes ?? 0), registered: Number(inserted.meta?.changes ?? 0) };
}

export async function runCodexResetCountdownCron(env: Pick<Bindings, 'DB' | 'RUST_WORKER' | 'ASKGK_TUNNELS_URL'>) {
  if (!env.DB) throw new Error('Codexリセット予定: DBが未設定です');
  if (!env.RUST_WORKER) throw new Error('Codexリセット予定: RUST_WORKERが未設定です');
  const status = await askTunnelSigner(env.RUST_WORKER, 'codex_prompt="/status"', env.ASKGK_TUNNELS_URL);
  return registerCodexResetCountdown(env.DB, status.reply);
}
