/**
 * /muse-search の👤ボタン: ログインユーザーのハンドルネーム(D1 muse_user_handles、マイグレーション0197、2026-11-19、ユーザー指定)。
 * 登録のとき、すでに登録済みのハンドルネームと照合する(画面は、一文字入力するごとに照合し、一致が無ければ登録ボタンを押せる)。
 *
 * - 一致の判定は、大文字小文字・全角半角(NFKC)を無視した完全一致。前後の空白は無視する。保存する名前は、入力のまま(前後の空白だけ除く)。
 *   判定用のキー(handle_key)は、SQLiteではNFKCできないので、ここで作る。D1のUNIQUEが、競合(照合と書き込みの間の登録)を防ぐ。
 * - 使える名前は、1〜20文字(コードポイント)で、制御文字を含まない。
 * - ユーザー名(このアプリへのログインユーザー)を、一緒に記録する。1人1つで、あとから別の名前に変えられる(上書き)。
 * - 結果は、型(判別できる共用体)で返す。例外にしない。D1の失敗は、理由つきで返し、「使える」「登録した」に見せない。
 */

export const MUSE_HANDLE_MAX_LENGTH = 20;

export type HandleErrorCode = 'empty' | 'too_long' | 'invalid_chars';
export type MuseHandle = { userId: string; userName: string; handleName: string; updatedAt: string };

/** 照合用のキー。NFKC(全角半角・互換文字)にそろえ、前後の空白を除き、小文字にする。 */
export function normalizeHandleKey(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase();
}

export type ValidatedHandle = { ok: true; name: string } | { ok: false; errorCode: HandleErrorCode };

/** 名前の検査。使える名前は、前後の空白だけ除いて、入力のまま返す。 */
export function validateHandleName(raw: string): ValidatedHandle {
  const name = raw.trim();
  if (!name) return { ok: false, errorCode: 'empty' };
  const chars = Array.from(name);
  if (chars.length > MUSE_HANDLE_MAX_LENGTH) return { ok: false, errorCode: 'too_long' };
  for (const ch of chars) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return { ok: false, errorCode: 'invalid_chars' };
  }
  return { ok: true, name };
}

type DbFailure = { ok: false; errorCode: 'db_missing' | 'db_error'; detail: string };
const dbMissing: DbFailure = { ok: false, errorCode: 'db_missing', detail: 'D1(DB)が未設定です' };
const dbError = (error: unknown): DbFailure => ({ ok: false, errorCode: 'db_error', detail: (error instanceof Error ? error.message : String(error)).slice(0, 200) });

/** 登録済みのハンドルネーム。無ければ null。D1が読めなければ例外(呼び出し側が、理由つきで失敗にする)。 */
export async function getHandle(db: D1Database, userId: string): Promise<MuseHandle | null> {
  const row = await db.prepare('SELECT user_id AS userId, user_name AS userName, handle_name AS handleName, updated_at AS updatedAt FROM muse_user_handles WHERE user_id = ?1')
    .bind(userId).first<MuseHandle>();
  return row ?? null;
}

export type HandleCheckResult =
  | { ok: true; status: 'available' | 'taken' | 'same' }
  | { ok: false; errorCode: HandleErrorCode }
  | DbFailure;

/**
 * 登録済みのハンドルネームとの照合。他のユーザーの名前と一致すれば taken、自分の今の名前と一致すれば same(変更にならない)、
 * どれとも一致しなければ available。誰の名前かは返さない。検査に通らない名前は、D1を見ずに理由を返す。
 */
export async function checkHandleAvailability(db: D1Database | undefined, userId: string, raw: string): Promise<HandleCheckResult> {
  const valid = validateHandleName(raw);
  if (!valid.ok) return valid;
  if (!db) return dbMissing;
  try {
    const row = await db.prepare('SELECT user_id FROM muse_user_handles WHERE handle_key = ?1').bind(normalizeHandleKey(valid.name)).first<{ user_id: string }>();
    if (!row) return { ok: true, status: 'available' };
    return { ok: true, status: row.user_id === userId ? 'same' : 'taken' };
  } catch (error) {
    return dbError(error);
  }
}

export type RegisterHandleResult =
  | { ok: true; handle: MuseHandle }
  | { ok: false; errorCode: HandleErrorCode | 'taken' | 'same' | 'user_name_missing' }
  | DbFailure;

/**
 * ハンドルネームを登録する(自分の名前は、別の名前に変えられる)。他のユーザーの名前・自分の今の名前と一致するときは、何も書かずに断る。
 * 照合のあとに、他のユーザーが同じ名前を登録していても(競合)、D1のUNIQUE(handle_key)で二重にならず、taken で返す。
 */
export async function registerHandle(
  db: D1Database | undefined,
  input: { userId: string; userName: string; name: string; now?: string },
): Promise<RegisterHandleResult> {
  const valid = validateHandleName(input.name);
  if (!valid.ok) return valid;
  const userName = input.userName.trim();
  if (!userName) return { ok: false, errorCode: 'user_name_missing' };
  if (!db) return dbMissing;
  const check = await checkHandleAvailability(db, input.userId, valid.name);
  if (!check.ok) return check;
  if (check.status !== 'available') return { ok: false, errorCode: check.status };
  const now = input.now ?? new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO muse_user_handles (user_id, user_name, handle_name, handle_key, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5)
       ON CONFLICT(user_id) DO UPDATE SET user_name = excluded.user_name, handle_name = excluded.handle_name, handle_key = excluded.handle_key, updated_at = excluded.updated_at`,
    ).bind(input.userId, userName, valid.name, normalizeHandleKey(valid.name), now).run();
    return { ok: true, handle: { userId: input.userId, userName, handleName: valid.name, updatedAt: now } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE/i.test(message) && /handle_key/i.test(message)) return { ok: false, errorCode: 'taken' };
    return dbError(error);
  }
}

/** 画面に出す理由の文言(サーバーが返す。画面は、そのまま表示する)。 */
export const MUSE_HANDLE_MESSAGES: Record<'empty' | 'too_long' | 'invalid_chars' | 'taken' | 'same' | 'available', string> = {
  empty: '名前を入力してください',
  too_long: `${MUSE_HANDLE_MAX_LENGTH}文字までです`,
  invalid_chars: '使えない文字(改行・タブなどの制御文字)が含まれています',
  taken: 'そのハンドルネームは、すでに使われています',
  same: '今のハンドルネームと同じです',
  available: '使えます',
};
