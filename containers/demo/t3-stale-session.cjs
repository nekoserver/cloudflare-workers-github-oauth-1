'use strict';
// T3を作り直すと署名鍵が変わり、PWAに残った古いセッションは拒否され続ける。
// T3が401で拒否したセッションのクッキーだけを削除し、ペアリング画面へ戻れるようにする。
const NAME = /^[A-Za-z0-9_.-]+$/;
function hasCookie(cookieHeader, name) {
  if (typeof cookieHeader !== 'string' || typeof name !== 'string' || !NAME.test(name)) return false;
  return cookieHeader.split(';').some(part => part.trim().startsWith(name + '='));
}
function staleSessionClears({ status, cookieHeader, cookieName }) {
  if (status !== 401 || !hasCookie(cookieHeader, cookieName)) return [];
  // 中継が付けるクッキーは Partitioned なので、同名の通常のクッキーと分けて両方を消す。
  const base = `${cookieName}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; Secure; HttpOnly; SameSite=None`;
  return [base + '; Partitioned', base];
}
module.exports = { hasCookie, staleSessionClears };
