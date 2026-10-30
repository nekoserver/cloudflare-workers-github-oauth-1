'use strict';
// T3を作り直すと署名鍵が変わり、ブラウザーに残った古いセッションは拒否され続ける。
// T3は認証に失敗した要求に、/api/auth/session では200の authenticated:false を、ほかでは401を返す(T3 0.1.3のソースで確認)。
// 拒否された古いセッションのクッキーだけを削除し、ペアリング画面へ戻れるようにする。
const NAME = /^[A-Za-z0-9_.-]+$/;
const MAX_BODY = 65536;
function countCookie(cookieHeader, name) {
  if (typeof cookieHeader !== 'string' || typeof name !== 'string' || !NAME.test(name)) return 0;
  return cookieHeader.split(';').filter(part => part.trim().startsWith(name + '=')).length;
}
function hasCookie(cookieHeader, name) { return countCookie(cookieHeader, name) > 0; }
function isUnauthenticatedSessionBody(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_BODY) return false;
  try { return JSON.parse(text)?.authenticated === false; } catch { return false; }
}
function staleSessionClears({ status, unauthenticated, cookieHeader, cookieName }) {
  const rejected = status === 401 || (status === 200 && unauthenticated === true);
  if (!rejected || !hasCookie(cookieHeader, cookieName)) return [];
  const base = `${cookieName}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; Secure; HttpOnly; SameSite=None`;
  // 中継が発行するクッキーは必ず Partitioned。同じ名前が複数あるときは、発行していない側(Partitionedなし)が古い残りなので、そちらだけを消し、新しい有効なクッキーを残す。
  return countCookie(cookieHeader, cookieName) > 1 ? [base] : [base + '; Partitioned', base];
}
module.exports = { MAX_BODY, countCookie, hasCookie, isUnauthenticatedSessionBody, staleSessionClears };
