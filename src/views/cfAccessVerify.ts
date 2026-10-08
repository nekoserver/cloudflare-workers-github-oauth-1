import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import type { AccessVerificationReport } from '../utils/cfAccessVerify';

function statusBadge(status: 'pass' | 'fail' | 'skipped'): string {
  if (status === 'pass') return '<span class="cfav-badge cfav-badge-pass">合格</span>';
  if (status === 'fail') return '<span class="cfav-badge cfav-badge-fail">不合格</span>';
  return '<span class="cfav-badge cfav-badge-skipped">未検証</span>';
}

/**
 * CloudflareのWARP/Zero Trust Access ならびに Tunnel を経由した正規ユーザーの
 * ログインであることを証明するための診断ページ。/access-verify。
 *
 * 検証そのもの(JWT署名検証・各種チェック)はsrc/utils/cfAccessVerify.tsの
 * 純粋関数+ネットワークI/Oで事前に行い、このファイルは結果(report)の表示のみを担う。
 * 参考情報として表示する生ヘッダー(Cf-Connecting-Ip等)は、オリジンに届く時点で
 * クライアント側が自由に送れるため、本人証明の根拠にはならない旨を明記する。
 */
export function getCfAccessVerifyPage(report: AccessVerificationReport, diagnosticHeaders: Record<string, string | undefined>): string {
  const overallBadge = report.overall === 'pass'
    ? '<span class="cfav-overall cfav-overall-pass">✅ 合格</span>'
    : '<span class="cfav-overall cfav-overall-fail">❌ 不合格</span>';

  const checksHtml = report.checks.map((c) => `
    <tr>
      <td>${escapeHtml(c.label)}</td>
      <td>${statusBadge(c.status)}</td>
      <td class="cfav-detail">${escapeHtml(c.detail)}</td>
    </tr>`).join('');

  const headerRows = Object.entries(diagnosticHeaders).map(([name, value]) => `
    <tr>
      <td class="cfav-header-name">${escapeHtml(name)}</td>
      <td>${value ? escapeHtml(value) : '<span class="cfav-missing">(無し)</span>'}</td>
    </tr>`).join('');

  const payloadRows = report.jwtPayload
    ? Object.entries(report.jwtPayload).map(([k, v]) => `
      <tr>
        <td class="cfav-header-name">${escapeHtml(k)}</td>
        <td>${escapeHtml(typeof v === 'string' ? v : JSON.stringify(v))}</td>
      </tr>`).join('')
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content">
  <title>Cloudflare Access 検証</title>
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
    .cfav-overall { display: inline-block; font-size: 18px; font-weight: 700; padding: 10px 18px; border-radius: 10px; margin-bottom: 18px; }
    .cfav-overall-pass { background: rgba(26,127,55,0.12); color: var(--success-color, #1a7f37); }
    .cfav-overall-fail { background: rgba(207,34,46,0.12); color: var(--danger-color, #cf222e); }
    .cfav-section { font-size: 13px; font-weight: 700; color: var(--text-secondary); margin: 22px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 10px; }
    th, td { border: 1px solid var(--border-color); padding: 7px 10px; text-align: left; vertical-align: top; }
    th { background: var(--bg-secondary); font-weight: 600; }
    .cfav-detail { color: var(--text-secondary); }
    .cfav-header-name { font-family: ui-monospace, monospace; white-space: nowrap; }
    .cfav-missing { color: var(--text-muted); }
    .cfav-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 10px; white-space: nowrap; }
    .cfav-badge-pass { background: rgba(26,127,55,0.12); color: var(--success-color, #1a7f37); }
    .cfav-badge-fail { background: rgba(207,34,46,0.12); color: var(--danger-color, #cf222e); }
    .cfav-badge-skipped { background: var(--bg-secondary); color: var(--text-muted); }
    .cfav-note { font-size: 12px; color: var(--text-muted); margin-top: 6px; line-height: 1.6; }
  </style>
</head>
<body>
  <nav class="navbar">
    <span class="navbar-brand">🔐 Cloudflare Access 検証</span>
    <div class="navbar-spacer"></div>
    ${getThemeToggleHTML()}
  </nav>

  <div class="container">
    <p class="subtitle">
      Cloudflare WARP/Zero Trust Access および Tunnel を経由した正規ユーザーのログインであることを検証します。
      信用できる根拠は Cloudflare Access が署名した JWT(Cf-Access-Jwt-Assertion / CF_Authorization Cookie)の
      <strong>署名検証のみ</strong>です。それ以外のヘッダーはクライアント側から自由に送信可能なため、
      参考情報として表示するだけで合否判定には使いません。
    </p>

    ${overallBadge}

    <div class="cfav-section">検証結果</div>
    <table>
      <thead><tr><th>項目</th><th>判定</th><th>詳細</th></tr></thead>
      <tbody>${checksHtml}</tbody>
    </table>
    <p class="cfav-note">
      「未検証」は該当する環境変数(CF_ACCESS_TEAM_DOMAIN・CF_ACCESS_AUD・CF_ACCESS_ALLOWED_EMAIL_DOMAINS・
      CF_ACCESS_EXPECTED_HOST)が未設定のためそのチェックを行っていないことを示します(合否には含めません)。
    </p>

    ${payloadRows ? `
    <div class="cfav-section">JWTペイロード(参考)</div>
    <table>
      <tbody>${payloadRows}</tbody>
    </table>` : ''}

    <div class="cfav-section">診断用ヘッダー(参考情報・本人証明の根拠にはしていません)</div>
    <table>
      <tbody>${headerRows}</tbody>
    </table>
  </div>
  <script>
    ${getThemeToggleScript()}
  </script>
</body>
</html>`;
}
