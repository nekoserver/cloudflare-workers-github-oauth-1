/**
 * HTMLエスケープユーティリティ
 * XSS対策のためにユーザー入力をHTMLエスケープします
 */

/**
 * HTMLの特殊文字をエスケープ
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
