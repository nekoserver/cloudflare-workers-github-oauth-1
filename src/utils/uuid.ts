export type UuidVersion = 'v4' | 'v7';

function formatUuidBytes(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Web Cryptoを使ってRFC 9562準拠のUUIDを1件生成する。 */
export function generateUuid(version: UuidVersion, now = Date.now()): string {
  if (version === 'v4') return crypto.randomUUID().toLowerCase();

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // UUIDv7の先頭48bitはUnix epoch milliseconds (big endian)。
  let timestamp = BigInt(now);
  for (let index = 5; index >= 0; index--) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuidBytes(bytes);
}

/** UUID生成画面と同じuuid_historyへ、生成結果をユーザー単位で保存する。 */
export async function generateAndSaveUuid(db: D1Database, userId: string, version: UuidVersion): Promise<string> {
  const uuid = generateUuid(version);
  await db.prepare(
    'INSERT INTO uuid_history (user_id, uuid, version, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
  ).bind(userId, uuid, version).run();
  return uuid;
}
