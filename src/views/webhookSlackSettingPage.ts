import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import type { WebhookLogDisplayRow, WebhookSettingChecks } from '../utils/webhookSlackSettingDiagnostics';

function badge(ok: boolean, labelTrue = '設定済み', labelFalse = '未設定'): string {
  const cls = ok ? 'wh-badge wh-badge-ok' : 'wh-badge wh-badge-ng';
  return `<span class="${cls}">${ok ? '✅ ' + escapeHtml(labelTrue) : '❌ ' + escapeHtml(labelFalse)}</span>`;
}

function renderChecksTable(checks: WebhookSettingChecks): string {
  const targetBadge = `<span class="wh-badge wh-badge-info">${escapeHtml(checks.notifyTarget)}</span>`;
  return `<table class="wh-table">
    <tbody>
      <tr><th>GITHUB_WEBHOOK_SECRET(受信webhookの署名検証)</th><td>${badge(checks.githubWebhookSecretSet)}</td></tr>
      <tr><th>NOTIFY_TARGET(現在値)</th><td>${targetBadge}</td></tr>
      <tr><th>NOTIFY_WORKER_URL</th><td>${badge(checks.notifyWorkerUrlSet)}</td></tr>
      <tr><th>NOTIFY_WORKER_SECRET</th><td>${badge(checks.notifyWorkerSecretSet)}</td></tr>
      <tr><th>SLACK_OAUTH_TOKEN</th><td>${badge(checks.slackTokenSet)}</td></tr>
      <tr><th>SLACK_CHANNEL_ID</th><td>${badge(checks.slackChannelSet)}</td></tr>
      <tr class="wh-table-summary">
        <th>現在のNOTIFY_TARGET設定で、実際に通知が送信されうるか</th>
        <td>${badge(checks.isNotifyConfigured, '送信可能', '送信されない(設定不足)')}</td>
      </tr>
    </tbody>
  </table>`;
}

function renderRecentLogsTable(rows: WebhookLogDisplayRow[]): string {
  if (rows.length === 0) {
    return `<p class="wh-empty">直近のpush webhook受信ログはありません(まだ一度もpushイベントを受信していないか、webhook_logテーブルが空です)。</p>`;
  }
  const body = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.receivedAt)}</td>
        <td>${escapeHtml(row.repository ?? '(不明)')}</td>
        <td><span class="wh-badge ${row.status === 'ok' ? 'wh-badge-ok' : row.status === 'rejected' ? 'wh-badge-ng' : 'wh-badge-warn'}">${escapeHtml(row.status)}</span></td>
        <td>${row.error ? escapeHtml(row.error) : '-'}</td>
      </tr>`
    )
    .join('');
  return `<table class="wh-table wh-table-log">
    <thead><tr><th>受信日時</th><th>リポジトリ</th><th>状態</th><th>エラー</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

export function getWebhookSlackSettingPage(username: string, checks: WebhookSettingChecks, recentPushLogs: WebhookLogDisplayRow[]): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#0d1117">
  <title>GitHub webhook → Slack / cf-auth 通知設定ガイド</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-primary, #f6f8fa);
      color: var(--text-primary);
    }
    .navbar {
      background: var(--navbar-bg);
      box-shadow: 0 2px 10px var(--navbar-shadow);
      padding: 10px 20px;
      padding-top: calc(10px + env(safe-area-inset-top));
      display: flex; justify-content: space-between; align-items: center;
      position: sticky; top: 0; height: 44px; z-index: 10;
    }
    .navbar-brand { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .wh-main { max-width: 920px; margin: 0 auto; padding: 24px 16px 80px; }
    .wh-main h1 { font-size: 22px; margin-bottom: 6px; }
    .wh-main h2 { font-size: 16px; margin: 32px 0 10px; padding-top: 8px; border-top: 1px solid var(--border-color); }
    .wh-lead { color: var(--text-secondary); font-size: 13px; margin-bottom: 16px; }
    .wh-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
    .wh-steps { list-style: none; counter-reset: wh-step; }
    .wh-steps li { counter-increment: wh-step; position: relative; padding: 10px 0 10px 34px; border-bottom: 1px solid var(--border-color); font-size: 13px; }
    .wh-steps li:last-child { border-bottom: none; }
    .wh-steps li::before { content: counter(wh-step); position: absolute; left: 0; top: 10px; width: 22px; height: 22px; border-radius: 50%; background: var(--accent-color, #667eea); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .wh-steps .wh-step-title { font-weight: 600; display: block; margin-bottom: 2px; }
    .wh-steps .wh-step-detail { color: var(--text-secondary); font-size: 12px; }
    code { background: var(--bg-secondary); padding: 1px 5px; border-radius: 4px; font-size: 12px; font-family: ui-monospace, SFMono-Regular, monospace; }
    .wh-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .wh-table th, .wh-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border-color); vertical-align: top; }
    .wh-table th { font-weight: 500; color: var(--text-secondary); white-space: nowrap; }
    .wh-table-summary th, .wh-table-summary td { font-weight: 700; }
    .wh-table-log th { font-weight: 700; }
    .wh-badge { display: inline-block; font-size: 12px; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
    .wh-badge-ok { background: #d9f7e3; color: #1a7f37; }
    .wh-badge-ng { background: #ffebe9; color: #cf222e; }
    .wh-badge-warn { background: #fff8c5; color: #9a6700; }
    .wh-badge-info { background: #ddf4ff; color: #0969da; }
    .wh-note { font-size: 12px; color: var(--text-secondary); margin-top: 10px; line-height: 1.6; }
    .wh-route-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
    .wh-route-table th, .wh-route-table td { border: 1px solid var(--border-color); padding: 6px 8px; text-align: left; }
    .wh-empty { font-size: 13px; color: var(--text-secondary); }
    .wh-manual-list { font-size: 13px; line-height: 1.8; padding-left: 20px; }
  </style>
</head>
<body>
  <div class="navbar">
    <div class="navbar-brand">🔔 GitHub webhook → Slack / cf-auth 通知設定ガイド</div>
    ${getThemeToggleHTML()}
  </div>
  <div class="wh-main">
    <h1>処理の流れと設定確認</h1>
    <p class="wh-lead">ログインユーザー: ${escapeHtml(username)} / このページはsecretの値そのものは一切表示しません(設定の有無=真偽値のみ)。</p>

    <div class="wh-card">
      <h2 style="margin-top:0;border-top:none">1. 3種類の経路(用語整理)</h2>
      <table class="wh-route-table">
        <thead><tr><th>#</th><th>経路</th><th>認証方式</th><th>通信手段</th></tr></thead>
        <tbody>
          <tr><td>A</td><td>GitHub → 本体Worker <code>/webhook/github</code></td><td><code>X-Hub-Signature-256</code>(GITHUB_WEBHOOK_SECRET)</td><td>公開インターネット経由のGitHub公式webhook</td></tr>
          <tr><td>B</td><td>dynamicneko/cf-auth → 本体Worker <code>/webhook/cf-auth</code></td><td><code>X-Hub-Signature-256</code>(CF_AUTH_WEBHOOK_SECRET)</td><td>Service Binding経由</td></tr>
          <tr><td>C</td><td>本体Worker → dynamicneko/cf-auth <code>/ingest</code></td><td><code>Authorization: Bearer NOTIFY_WORKER_SECRET</code></td><td>公開URL(NOTIFY_WORKER_URL)への通常fetch</td></tr>
        </tbody>
      </table>
      <p class="wh-note">詳細: <a href="https://github.com/nekoserver/cloudflare-workers-github-oauth-1/blob/main/NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md">NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md</a></p>
    </div>

    <div class="wh-card">
      <h2 style="margin-top:0;border-top:none">2. /webhook/github の処理順序(経路A)</h2>
      <ol class="wh-steps">
        <li><span class="wh-step-title">署名検証</span><span class="wh-step-detail"><code>X-Hub-Signature-256</code>を<code>GITHUB_WEBHOOK_SECRET</code>で検証。失敗したら<code>webhook_log</code>にstatus=rejectedで記録し401を返す(ここで処理終了)。</span></li>
        <li><span class="wh-step-title">webhook_logへの無条件記録</span><span class="wh-step-detail">署名OKなら、event種別・action・repository.full_nameを<code>webhook_log</code>へstatus=okで記録する(この時点ではまだ通知先への転送は行わない)。</span></li>
        <li><span class="wh-step-title">イベント種別ごとの分岐</span><span class="wh-step-detail"><code>installation</code> / <code>installation_repositories</code> / <code>repository</code>(action=created) / <code>pull_request</code>(action=opened/synchronize) / <code>push</code> の5パターンだけが、この先の通知処理に進む。それ以外のイベント種別は記録されるのみで通知処理には進まない。</span></li>
        <li><span class="wh-step-title">通知設定の解決</span><span class="wh-step-detail"><code>resolveNotifyConfigWithSetting(env)</code>を呼び、<code>NOTIFY_TARGET</code>環境変数と(slack時のみ)D1の<code>slack_enabled</code>ユーザーオプションから送信先を決定する。</span></li>
        <li><span class="wh-step-title">送信可否の判定</span><span class="wh-step-detail"><code>isNotifyConfigured()</code>が必要な設定が揃っているかだけを見る(下記3節の表と同じロジック)。揃っていなければ通知はスキップされるが、処理自体(D1記録・AI要約等)は継続する。</span></li>
        <li><span class="wh-step-title">dispatchNotification()の実行</span><span class="wh-step-detail"><code>target=slack</code>なら<code>postSlackMessage()</code>でSlack APIへ、<code>target=worker</code>なら<code>sendToWorker()</code>で経路C(cf-authの<code>/ingest</code>)へPOSTする。<strong>どちらか一方にしか送られない(fan-outではない)。</strong></span></li>
        <li><span class="wh-step-title">cf-auth側 /ingest での受信</span><span class="wh-step-detail">経路Cの場合、cf-auth側は<code>Authorization</code>ヘッダーを自身の<code>INGEST_SECRET</code>と突き合わせ、一致しなければ401で拒否する(値は本体の<code>NOTIFY_WORKER_SECRET</code>と同じである必要がある。変数名は違ってよい)。一致すれば<code>alt_notify_ingest_log</code>テーブルへ記録する。</span></li>
        <li><span class="wh-step-title">cf-auth /wspace での表示</span><span class="wh-step-detail"><code>linked_request_id IS NULL</code>の行(PRサマリーに紐付かない生ログ。installation通知・push通知はここに該当)が「その他のWebhook通知」セクションに表示される。PRサマリーに紐付く行は通常のフィード欄に出る。</span></li>
      </ol>
    </div>

    <div class="wh-card">
      <h2 style="margin-top:0;border-top:none">3. 送信可否ロジック(isNotifyConfigured)</h2>
      <pre style="font-size:12px;background:var(--bg-secondary);padding:12px;border-radius:8px;overflow-x:auto;white-space:pre"><code>isNotifyConfigured(config):
  if target === 'worker':
    return NOTIFY_WORKER_URLが設定されているか   ← slack_enabledは見ない
  else (target === 'slack' または未設定):
    if slack_enabled === false (D1のユーザー設定、既定OFF): return false
    return SLACK_OAUTH_TOKEN && SLACK_CHANNEL_IDが両方あるか</code></pre>
      <p class="wh-note"><code>NOTIFY_TARGET</code>は<strong>本体Worker全体で1つだけ</strong>の設定であり、リポジトリ単位・イベント種別単位では切り替えられない。<code>worker</code>に設定するとSlackへの投稿は(slack_enabledの値によらず)一切行われなくなる。</p>
    </div>

    <div class="wh-card">
      <h2 style="margin-top:0;border-top:none">4. 現在の設定(実チェック・secretの値は非表示)</h2>
      ${renderChecksTable(checks)}
      <p class="wh-note">このページが確認できるのは本体Worker自身の環境変数のみです。cf-auth側(別Worker)の<code>INGEST_SECRET</code>設定状況や、D1の<code>slack_enabled</code>ユーザーオプションの現在値はここから直接確認できません(5節参照)。</p>
    </div>

    <div class="wh-card">
      <h2 style="margin-top:0;border-top:none">5. cf-auth側で手動確認が必要な項目(本体Workerからはチェック不可)</h2>
      <ul class="wh-manual-list">
        <li><code>INGEST_SECRET</code>が設定されており、値が本体の<code>NOTIFY_WORKER_SECRET</code>と<strong>完全に一致</strong>しているか(<code>wrangler secret put INGEST_SECRET</code>)</li>
        <li>cf-auth(Cloudflare Workers Build)が最新のmainブランチへデプロイ済みか</li>
        <li><code>/wspace</code>ページの「その他のWebhook通知」セクションに対象リポジトリの行が実際に増えているか</li>
      </ul>
    </div>

    <div class="wh-card">
      <h2 style="margin-top:0;border-top:none">6. 直近のpush webhook受信ログ(実データ・最大20件)</h2>
      ${renderRecentLogsTable(recentPushLogs)}
      <p class="wh-note">この一覧は経路Aの到達(3節のステップ1〜2)だけを示します。ここに行があっても、4節の送信可否が「送信されない」なら経路Cへは転送されていません。</p>
    </div>
  </div>
  ${getThemeToggleScript()}
</body>
</html>`;
}
