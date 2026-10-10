import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import type { WebBotAuthVerifyResult } from '../utils/webBotAuthVerify';

/**
 * Cloudflareのweb-bot-authライブラリ(HTTP Message Signatures)を使い、
 * CursorのBot等からの署名付きリクエストを検証した結果を表示するページ。
 * /bot-auth-verify。認証は署名そのものが担うため、通常のログインは要求しない
 * (/access-verifyと同じ設計方針)。
 */
export function getBotAuthVerifyPage(result: WebBotAuthVerifyResult): string {
  const overallBadge = result.status === 'valid'
    ? '<span class="bav-overall bav-overall-valid">✅ 署名検証OK</span>'
    : result.status === 'neutral'
      ? '<span class="bav-overall bav-overall-neutral">➖ Signatureヘッダーなし(未検証)</span>'
      : '<span class="bav-overall bav-overall-invalid">❌ 署名検証NG</span>';

  const details = result.status === 'valid'
    ? `<table>
        <tbody>
          <tr><td>keyid</td><td class="bav-mono">${escapeHtml(result.keyid)}</td></tr>
          <tr><td>algorithm</td><td class="bav-mono">${escapeHtml(result.algorithm)}</td></tr>
          ${result.signatureAgentUri ? `<tr><td>Signature-Agent</td><td class="bav-mono">${escapeHtml(result.signatureAgentUri)}</td></tr>` : ''}
          <tr><td>created</td><td class="bav-mono">${escapeHtml(result.created.toISOString())}</td></tr>
          <tr><td>expires</td><td class="bav-mono">${escapeHtml(result.expires.toISOString())}</td></tr>
        </tbody>
      </table>`
    : result.status === 'invalid'
      ? `<div class="bav-detail">${escapeHtml(result.detail)}</div>`
      : `<p class="bav-note">このリクエストには<code>Signature</code>ヘッダーがありません。Web Bot Authで署名したリクエストでアクセスしてください。</p>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content">
  <title>Web Bot Auth 検証</title>
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
    .bav-overall { display: inline-block; font-size: 16px; font-weight: 700; padding: 10px 18px; border-radius: 10px; margin-bottom: 18px; }
    .bav-overall-valid { background: rgba(26,127,55,0.12); color: var(--success-color, #1a7f37); }
    .bav-overall-invalid { background: rgba(207,34,46,0.12); color: var(--danger-color, #cf222e); }
    .bav-overall-neutral { background: var(--bg-secondary); color: var(--text-muted); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 10px; }
    th, td { border: 1px solid var(--border-color); padding: 7px 10px; text-align: left; vertical-align: top; }
    .bav-mono { font-family: ui-monospace, monospace; word-break: break-all; }
    .bav-detail { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
    .bav-note { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
  </style>
</head>
<body>
  <nav class="navbar">
    <span class="navbar-brand">🤖 Web Bot Auth 検証</span>
    <div class="navbar-spacer"></div>
    ${getThemeToggleHTML()}
  </nav>

  <div class="container">
    <p class="subtitle">
      Cloudflareのweb-bot-authライブラリ(HTTP Message Signatures)を使い、このリクエストへの
      署名(Signature/Signature-Input/Signature-Agentヘッダー)を検証します。署名者の公開鍵は
      Signature-Agentヘッダーが指すBot自身のkey directoryから都度取得し、固定のハードコードは行いません。
    </p>

    ${overallBadge}

    ${details}
  </div>
  <script>
    ${getThemeToggleScript()}
  </script>
</body>
</html>`;
}
