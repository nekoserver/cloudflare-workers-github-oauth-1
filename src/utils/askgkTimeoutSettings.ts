export const DEFAULT_ASKGK_TIMEOUT_SECONDS = 120;
export const MAX_ASKGK_TIMEOUT_SECONDS = 300;
export type AskgkTimeoutSetting = { revision: number; timeoutSeconds: number };

export function validateAskgkTimeoutSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_ASKGK_TIMEOUT_SECONDS) {
    throw new Error('待ち時間は1〜300秒の整数で指定してください');
  }
  return value;
}

export async function readAskgkTimeoutSetting(db: D1Database): Promise<AskgkTimeoutSetting> {
  const row = await db.prepare('SELECT revision, timeout_seconds AS timeoutSeconds FROM askgk_timeout_settings ORDER BY revision DESC LIMIT 1').first<AskgkTimeoutSetting>();
  if (!row || !Number.isInteger(row.revision) || row.revision < 1) throw new Error('askgk待ち時間の保存設定を取得できません');
  validateAskgkTimeoutSeconds(row.timeoutSeconds);
  return row;
}

/** Append a revision conditionally; preserve history and reject concurrent edits. */
export async function saveAskgkTimeoutSetting(db: D1Database, value: unknown, expectedRevision: unknown, actor: string): Promise<AskgkTimeoutSetting> {
  const timeoutSeconds = validateAskgkTimeoutSeconds(value);
  if (typeof expectedRevision !== 'number' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new Error('設定のリビジョンが不正です');
  const result = await db.prepare(`INSERT INTO askgk_timeout_settings (revision, timeout_seconds, changed_by, changed_at)
    SELECT ?, ?, ?, ? WHERE (SELECT MAX(revision) FROM askgk_timeout_settings) = ?`)
    .bind(expectedRevision + 1, timeoutSeconds, actor, new Date().toISOString(), expectedRevision).run();
  if (Number(result.meta?.changes) !== 1) throw new Error('設定が別の操作で更新されました。再読み込みしてください');
  return { revision: expectedRevision + 1, timeoutSeconds };
}
