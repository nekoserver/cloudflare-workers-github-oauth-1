/**
 * /countdownページの純粋ロジック。D1・DOM操作を含まないため、
 * ハンドラ側でモック地獄にならずにユニットテストできる（CLAUDE.mdルール15）。
 */

export type CountdownEventRow = {
  id: number;
  label: string;
  target_at: string;
};

export type CountdownGroupRow = {
  id: number;
  group_id: string | null;
};

export type CountdownGroupPosition = { index: number; total: number };

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
  return findUpcomingCountdownEvents(rows, nowIso)[0] ?? null;
}

/**
 * 現在時刻より未来のイベントを、目標日時が近い順ですべて返す。
 * 同時刻の場合はid順にして、APIを再取得しても表示順が揺れないようにする。
 * パース不能な日時は、ほかの正常なタイマーの表示を妨げないよう除外する。
 */
export function findUpcomingCountdownEvents(rows: CountdownEventRow[], nowIso: string): CountdownEventRow[] {
  const now = new Date(nowIso).getTime();
  return rows
    .map((row) => ({ row, at: new Date(row.target_at).getTime() }))
    .filter(({ at }) => !Number.isNaN(at) && at > now)
    .sort((a, b) => a.at - b.at || a.row.id - b.row.id)
    .map(({ row }) => row);
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

/**
 * 一括登録(同じgroup_idを持つイベント群)の中で、指定イベントが何番目/何件中かを返す。
 * group_idがnull、またはそのgroup内に自分しかいない(=単発登録)場合はnullを返す
 * (単発登録では「◯/△」表示が不要なため)。同グループ内の順序はidの昇順(登録順)とする。
 */
export function computeCountdownGroupPosition(
  rows: CountdownGroupRow[],
  targetId: number
): CountdownGroupPosition | null {
  const target = rows.find((r) => r.id === targetId);
  if (!target || !target.group_id) return null;
  const groupRows = rows.filter((r) => r.group_id === target.group_id).sort((a, b) => a.id - b.id);
  if (groupRows.length <= 1) return null;
  const index = groupRows.findIndex((r) => r.id === targetId) + 1;
  return { index, total: groupRows.length };
}

/** Dateオブジェクトのローカル日付を'YYYY-MM-DD'形式にする(/countdownページのカレンダーと同じ書式)。 */
function toLocalDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * カレンダーで選択された日付(dateStr、'YYYY-MM-DD'形式のローカル日付)で
 * イベント一覧を絞り込む。dateStrがnullなら絞り込まず全件を返す
 * (「すべて表示」状態)。target_atがパース不能な行は一致しないものとして除外する。
 */
export function filterCountdownEventsByDate<T extends { target_at: string }>(
  events: T[],
  dateStr: string | null
): T[] {
  if (!dateStr) return events;
  return events.filter((ev) => {
    const at = new Date(ev.target_at);
    if (Number.isNaN(at.getTime())) return false;
    return toLocalDateKey(at) === dateStr;
  });
}

/** cf-authのセッション有効期限(nekoserver/cf-authのsrc/session.tsのSESSION_TTL)。
 *  この値が変わったら合わせて更新すること。 */
export const CF_AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** /countdownで自動登録するcf-authの期限カウントダウンの固定ラベル。 */
export const CF_AUTH_DEADLINE_LABEL = 'cf-auth 期限';

/** ログイン時の cf-auth 期限登録と同じ単発INSERT。group_id は SQL の NULL リテラル。 */
export const COUNTDOWN_EVENT_INSERT_SQL =
  'INSERT INTO countdown_events (user_id, label, target_at, group_id) VALUES (?, ?, ?, NULL)';

/**
 * countdown_events へのINSERTに必要な最小限のD1形。
 * テストではこの形を満たすモックを渡せる。
 */
export interface CountdownInsertDb {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
    };
  };
}

export type CountdownInsertResult =
  | { ok: true; registered: true }
  | { ok: true; registered: false; skipReason: 'no_expiry' }
  | { ok: false; errorCode: 'no_db' | 'insert_failed'; detail: string };

/**
 * countdown_events へ単発の予定を新規INSERTする。
 * label は右下ウィジェットと完了トーストに出る予定名で、呼び出し側が渡す文字列をそのまま保存する。
 * targetAt が null のときは予約しない(無期限など)。
 * 既存行があっても上書きせず、呼ぶたびに新しい行を追加する。
 * 失敗しても例外は投げず、判別可能な結果を返す。
 */
export async function insertCountdownEvent(
  db: CountdownInsertDb | undefined,
  params: { userId: string; label: string; targetAt: string | null }
): Promise<CountdownInsertResult> {
  if (!params.targetAt) {
    return { ok: true, registered: false, skipReason: 'no_expiry' };
  }
  if (!db) {
    return { ok: false, errorCode: 'no_db', detail: 'DB未設定です' };
  }
  try {
    await db.prepare(COUNTDOWN_EVENT_INSERT_SQL)
      .bind(params.userId, params.label, params.targetAt).run();
    return { ok: true, registered: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, errorCode: 'insert_failed', detail };
  }
}

/** 発行レスポンス/発行モーダル向けのカウントダウン登録結果文言。 */
export function formatCountdownInsertNotice(
  result: CountdownInsertResult,
  label: string
): string {
  if (!result.ok) {
    return `カウントダウンへの登録に失敗しました: ${result.detail}`;
  }
  if (result.registered) {
    return `カウントダウンに「${label}」を登録しました`;
  }
  switch (result.skipReason) {
    case 'no_expiry':
      return '無期限のためカウントダウンには登録しませんでした';
    default: {
      const _exhaustive: never = result.skipReason;
      return _exhaustive;
    }
  }
}

/**
 * cf-authへのログイン日時(loginAt)から、cf-auth側のセッション有効期限
 * (CF_AUTH_SESSION_TTL_MS)ぶん先の日時をISO 8601形式で返す。
 * /webhook/cf-authのログイン通知を受けるたびに、countdown_eventsへ
 * 「cf-auth 期限」ラベルで自動登録・更新するために使う。
 */
export function computeCfAuthDeadlineTargetAt(loginAt: Date): string {
  return new Date(loginAt.getTime() + CF_AUTH_SESSION_TTL_MS).toISOString();
}
