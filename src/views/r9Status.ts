import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import type { R9StatusResult } from '../utils/r9Gateway';

/**
 * r9.nekomaneki.workへのHMAC署名付きGET結果(src/utils/r9Gateway.ts)を
 * そのまま表示する診断ページ。/r9-status。
 * resultがnullの場合はR9_HMAC_SECRET未設定であることを示す。
 */
export function getR9StatusPage(result: R9StatusResult | null): string {
  const body = result === null
    ? `<div class="r9s-overall r9s-fail">❌ 未設定</div>
       <p class="r9s-note">R9_HMAC_SECRETがWorkerに設定されていません(wrangler secret put R9_HMAC_SECRETで設定してください)。</p>`
    : result.ok
      ? `<div class="r9s-overall r9s-ok">✅ 取得成功(HTTP ${result.status})</div>
         <div class="r9s-section">r9.nekomaneki.workの応答本文</div>
         <pre class="r9s-body">${escapeHtml(result.bodyText)}</pre>`
      : `<div class="r9s-overall r9s-fail">❌ 取得失敗(${escapeHtml(result.errorCode)}${result.status ? ' / HTTP ' + result.status : ''})</div>
         <div class="r9s-section">詳細</div>
         <pre class="r9s-body">${escapeHtml(result.detail)}</pre>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content">
  <title>r9 ステータス確認</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-primary, #f8fafc);
      color: var(--text-primary);
    }
    .navbar {
      position: sticky; top: 0; z-index: 200;
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 8px var(--navbar-shadow);
      padding: 0 20px;
      height: 44px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .navbar-brand { font-size: 15px; font-weight: 700; color: var(--text-primary); white-space: nowrap; }
    .navbar-spacer { flex: 1; }
    .container { max-width: 880px; margin: 0 auto; padding: 20px 16px 60px; }
    .subtitle { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.6; }
    .r9s-overall { display: inline-block; font-size: 16px; font-weight: 700; padding: 10px 18px; border-radius: 10px; margin-bottom: 18px; }
    .r9s-ok { background: rgba(26,127,55,0.12); color: var(--success-color, #1a7f37); }
    .r9s-fail { background: rgba(207,34,46,0.12); color: var(--danger-color, #cf222e); }
    .r9s-section { font-size: 13px; font-weight: 700; color: var(--text-secondary); margin: 22px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; }
    .r9s-body { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 60vh; overflow-y: auto; }
    .r9s-note { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
  </style>
</head>
<body>
  <nav class="navbar">
    <span class="navbar-brand">📡 r9 ステータス確認</span>
    <div class="navbar-spacer"></div>
    ${getThemeToggleHTML()}
  </nav>

  <div class="container">
    <p class="subtitle">
      本体WorkerがHMAC-SHA256で署名したリクエストをhttps://r9.nekomaneki.workへ送信し、
      応答をそのまま表示します(deploy/redmine/のHMACゲートウェイと同じ方式)。
    </p>

    ${body}
  </div>
  <script>
    ${getThemeToggleScript()}
  </script>
</body>
</html>`;
}
