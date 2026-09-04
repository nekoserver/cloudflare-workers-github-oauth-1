/**
 * 公開鍵チャレンジ署名ログインの異常検知(不一致・署名失敗)を記録・通知するための
 * 純粋関数群。DB書き込み自体はrecordPublicKeySecurityEventで行うが、
 * SQL組み立て・Slack本文組み立てはテスト可能な純粋関数として切り出す
 * (CLAUDE.mdルール15)。
 *
 * 想定シナリオ: 秘密鍵(IndexedDB上のCryptoKeyオブジェクト)が何らかの方法で
 * 取り出され、別の環境に持ち込まれてログイン・照合が試みられた場合。
 * - 対象の公開鍵が見つからない(userId/keyIdの組み合わせ不一致・失効・期限切れ) → key_not_found
 * - 対象鍵は存在するが、署名が登録済み公開鍵と一致しない(=秘密鍵が違う) → signature_mismatch
 * のいずれも、CLAUDE.mdルール8(catchで握りつぶすなら記録・通知・テストの3つを
 * 満たす)に従い、DB記録(public_key_security_events)とSlack通知の両方を行う。
 */

export type PublicKeySecurityEventType = 'key_not_found' | 'signature_mismatch';

export interface PublicKeySecurityEventParams {
  userId: string;
  keyId: string;
  eventType: PublicKeySecurityEventType;
  detail: string;
  ip: string;
}

/** D1Database(Cloudflare Workers)のうち、この機能に必要な最小限の形。テストではこの形を満たすモックを渡せる。 */
export interface PublicKeySecurityEventDb {
  prepare(sql: string): {
    bind(...args: unknown[]): { run(): Promise<unknown> };
  };
}

/** Slack通知本文を組み立てる(誰が・どの鍵で・いつ・何が起きたかを1通で追えるようにする)。 */
export function buildPublicKeySecurityAlertText(params: PublicKeySecurityEventParams, createdAt: string): string {
  return `[セキュリティ警告] 公開鍵ログインの異常\n`
    + `ユーザー: ${params.userId}\n`
    + `鍵ID: ${params.keyId}\n`
    + `種別: ${params.eventType}\n`
    + `詳細: ${params.detail}\n`
    + `IP: ${params.ip}\n`
    + `時刻: ${createdAt}`;
}

/** public_key_security_eventsテーブルへ1件記録する。 */
export async function recordPublicKeySecurityEvent(
  db: PublicKeySecurityEventDb,
  params: PublicKeySecurityEventParams,
  id: string,
  createdAt: string
): Promise<void> {
  await db.prepare(
    'INSERT INTO public_key_security_events (id, user_id, key_id, event_type, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, params.userId, params.keyId, params.eventType, params.detail, params.ip, createdAt).run();
}
