/**
 * /countdownページの純粋ロジック。D1・DOM操作を含まないため、
 * ハンドラ側でモック地獄にならずにユニットテストできる（CLAUDE.mdルール15）。
 */

export type CountdownEventRow = {
  id: number;
  label: string;
  target_at: string;
};

const MAX_LABEL_LENGTH = 100;

/** ISO 8601形式などパース可能な日時文字列かどうかを判定する。 */
export function isValidCountdownTargetAt(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

/** trim後に1〜100文字の文字列かどうかを判定する。 */
export function isValidCountdownLabel(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_LABEL_LENGTH;
}

/**
 * 現在時刻(nowIso)より未来のイベントのうち、最も近いものを1件返す。
 * target_atがパース不能な行は無視して継続する（1件の不正データで
 * 全体を壊さないため）。該当が無ければnullを返す。
 */
export function findNextCountdownEvent(rows: CountdownEventRow[], nowIso: string): CountdownEventRow | null {
  const now = new Date(nowIso).getTime();
  let best: { row: CountdownEventRow; at: number } | null = null;
  for (const row of rows) {
    const at = new Date(row.target_at).getTime();
    if (Number.isNaN(at) || at <= now) continue;
    if (!best || at < best.at) {
      best = { row, at };
    }
  }
  return best ? best.row : null;
}

/**
 * 残りミリ秒をカウントダウン表示用テキストに整形する。
 * 1日以上残っている場合のみ「N日 」を先頭に付ける。残り0以下は00:00:00にする
 * （負の値をそのまま表示してユーザーを混乱させないため）。
 */
export function formatCountdownRemaining(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}日 ${clock}` : clock;
}
