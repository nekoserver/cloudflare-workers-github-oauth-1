/**
 * 対象: cf_container_operation_log テーブル(migrations/0178)への書き込み。
 * /cf-containers の起動/停止/再起動操作を記録する。
 *
 * 失敗時の方針(CLAUDE.mdルール8): INSERT失敗はログに記録(notify)し、
 * 操作自体(start/stop/restart)は失敗させない(ログ機能の不調で本来の
 * 操作まで止めない)。呼び出し元には成否をbooleanで返す(record)。
 */
import type { D1Database } from '@cloudflare/workers-types';

export interface ContainerOperationLogEntry {
  action: string;
  performedBy: string;
  result: 'success' | 'failure';
  detail?: string;
}

export interface ContainerUsageSummary {
  totalStartCount: number;
  lastStartedAt: string | null;
}

/**
 * 成功したstart操作の累計回数と直近のstart時刻を返す。1件もなければ
 * totalStartCount=0・lastStartedAt=nullを返す(0件とクエリ失敗を区別する
 * ため、失敗時はrejectする。呼び出し元でtry/catchして握りつぶす)。
 */
export async function getContainerUsageSummary(db: D1Database): Promise<ContainerUsageSummary> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS cnt, MAX(created_at) AS last_started_at FROM cf_container_operation_log WHERE action = 'start' AND result = 'success'"
    )
    .first<{ cnt: number; last_started_at: string | null }>();
  return {
    totalStartCount: row?.cnt ?? 0,
    lastStartedAt: row?.last_started_at ?? null,
  };
}

/**
 * 直近起動時刻(ISO文字列)から現在までの経過時間を「◯時間△分」形式で返す。
 * lastStartedAtがnull、または不正な日時文字列の場合はnullを返す(「起動
 * したことがない」と「経過時間が0分」を混同させない)。
 */
export function formatElapsedSinceLastStart(lastStartedAt: string | null, now: Date = new Date()): string | null {
  if (!lastStartedAt) return null;
  const startMs = Date.parse(lastStartedAt);
  if (Number.isNaN(startMs)) return null;
  const elapsedMs = Math.max(0, now.getTime() - startMs);
  const totalMinutes = Math.floor(elapsedMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`;
}

export async function recordContainerOperation(
  db: D1Database | undefined,
  entry: ContainerOperationLogEntry,
  onError: (message: string) => void = () => {}
): Promise<boolean> {
  if (!db) {
    onError('DBバインディングが未設定のため記録をスキップしました');
    return false;
  }
  try {
    await db
      .prepare(
        'INSERT INTO cf_container_operation_log (action, performed_by, result, detail, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(entry.action, entry.performedBy, entry.result, entry.detail ?? null, new Date().toISOString())
      .run();
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onError(message);
    return false;
  }
}
