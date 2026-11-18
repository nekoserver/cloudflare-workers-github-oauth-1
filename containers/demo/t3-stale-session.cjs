'use strict';
// T3を作り直すと署名鍵が変わり、ブラウザーに残った古いセッションは拒否され続ける。
// T3は認証に失敗した要求に、/api/auth/session では200の authenticated:false を、ほかでは401を返す(T3 0.1.7のソースで確認)。
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
  // 中継はPartitioned付きと無しの2つの形でクッキーを発行するので、拒否されたら両方の形を消す。
  return [base + '; Partitioned', base];
}
// iOSのSafariはPartitioned付きのクッキーを拒否する場合があり(Safari 18.5の不具合報告)、
// iframeへの埋め込みかどうかは要求から見分けられない。そのため、T3が発行したクッキー1つにつき、
// 同じ値で「Partitioned付き」と「無し」の2つを返す。どちらもSecure・HttpOnly(T3の値を残す)・SameSite=Noneにする。
function rewriteSetCookies(cookies) {
  const out = [];
  for (const cookie of cookies || []) {
    const base = String(cookie).replace(/;\s*SameSite=[^;]*/ig, '').replace(/;\s*Secure\b/ig, '').replace(/;\s*Partitioned\b/ig, '') + '; SameSite=None; Secure';
    out.push(base + '; Partitioned', base);
  }
  return out;
}
module.exports = { MAX_BODY, countCookie, hasCookie, isUnauthenticatedSessionBody, rewriteSetCookies, staleSessionClears };
