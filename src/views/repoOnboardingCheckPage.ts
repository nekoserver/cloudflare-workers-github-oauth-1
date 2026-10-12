import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import type { OnboardingCheckResult } from '../utils/repoOnboardingCheck';

function statusBadge(status: OnboardingCheckResult['status']): string {
  const map: Record<OnboardingCheckResult['status'], { cls: string; label: string }> = {
    ok: { cls: 'roc-badge-ok', label: '✅ OK' },
    warning: { cls: 'roc-badge-warn', label: '⚠️ 要確認' },
    missing: { cls: 'roc-badge-ng', label: '❌ 未達' },
    not_implemented: { cls: 'roc-badge-info', label: '🚧 未実装' },
  };
  const { cls, label } = map[status];
  return `<span class="roc-badge ${cls}">${label}</span>`;
}

export type RepoOnboardingStageView = {
  stepNumber: number;
  title: string;
  result: OnboardingCheckResult;
};

export function getRepoOnboardingCheckPage(
  username: string,
  repoName: string | null,
  stages: RepoOnboardingStageView[] | null
): string {
  const resultsHtml = (() => {
    if (!repoName) {
      return `<p class="roc-empty">リポジトリ名(owner/repo)を入力して「確認」を押してください。</p>`;
    }
    if (!stages) {
      return `<p class="roc-empty">「${escapeHtml(repoName)}」を確認できませんでした。owner/repo形式で入力してください。</p>`;
    }
    const rows = stages
      .map(
        (stage) => `<tr>
          <td class="roc-step-no">${stage.stepNumber}</td>
          <td class="roc-step-title">${escapeHtml(stage.title)}</td>
          <td>${statusBadge(stage.result.status)}</td>
          <td>
            <div class="roc-summary">${escapeHtml(stage.result.summary)}</div>
            ${stage.result.detail ? `<div class="roc-detail">${escapeHtml(stage.result.detail)}</div>` : ''}
          </td>
        </tr>`
      )
      .join('');
    return `<table class="roc-table">
      <thead><tr><th>#</th><th>段階</th><th>状態</th><th>詳細</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  })();

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#0d1117">
  <title>新リポジトリ オンボーディング確認</title>
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
    .roc-main { max-width: 920px; margin: 0 auto; padding: 24px 16px 80px; }
    .roc-main h1 { font-size: 22px; margin-bottom: 6px; }
    .roc-lead { color: var(--text-secondary); font-size: 13px; margin-bottom: 16px; }
    .roc-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
    .roc-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .roc-form input[type="text"] {
      flex: 1; min-width: 220px; padding: 8px 10px; border-radius: 6px;
      border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);
      font-size: 13px; font-family: ui-monospace, SFMono-Regular, monospace;
    }
    .roc-form button {
      padding: 8px 16px; border-radius: 6px; border: none; background: var(--accent-color, #667eea);
      color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    code { background: var(--bg-secondary); padding: 1px 5px; border-radius: 4px; font-size: 12px; font-family: ui-monospace, SFMono-Regular, monospace; }
    .roc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .roc-table th, .roc-table td { text-align: left; padding: 10px; border-bottom: 1px solid var(--border-color); vertical-align: top; }
    .roc-table th { font-weight: 500; color: var(--text-secondary); white-space: nowrap; }
    .roc-step-no { font-weight: 700; color: var(--text-secondary); width: 28px; }
    .roc-step-title { font-weight: 600; white-space: nowrap; }
    .roc-summary { font-weight: 500; }
    .roc-detail { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
    .roc-badge { display: inline-block; font-size: 12px; padding: 2px 8px; border-radius: 999px; font-weight: 600; white-space: nowrap; }
    .roc-badge-ok { background: #d9f7e3; color: #1a7f37; }
    .roc-badge-ng { background: #ffebe9; color: #cf222e; }
    .roc-badge-warn { background: #fff8c5; color: #9a6700; }
    .roc-badge-info { background: #ddf4ff; color: #0969da; }
    .roc-empty { font-size: 13px; color: var(--text-secondary); }
    .roc-note { font-size: 12px; color: var(--text-secondary); margin-top: 10px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="navbar">
    <div class="navbar-brand">🧭 新リポジトリ オンボーディング確認</div>
    ${getThemeToggleHTML()}
  </div>
  <div class="roc-main">
    <h1>新リポジトリのwebhookオンボーディング状態</h1>
    <p class="roc-lead">ログインユーザー: ${escapeHtml(username)} / <a href="/wh-setting_github-to-slack">GitHub webhook → Slack / cf-auth 通知設定ガイド</a>も参照してください。</p>

    <div class="roc-card">
      <h2 style="margin-top:0">リポジトリを指定して確認</h2>
      <form class="roc-form" method="get" action="/repo-onboarding-check">
        <input type="text" name="repo" placeholder="nekoserver/railway" value="${repoName ? escapeHtml(repoName) : ''}" autocomplete="off" spellcheck="false">
        <button type="submit">確認</button>
      </form>
      <p class="roc-note">SPEC.cloudflare-workers-github-oauth-1.new-repo-onboarding.mdの8ステップのうち、本体Workerのデータだけで判定できる①〜③を表示します。④(cf-authの/wspace記録)・⑤(dynamicnekoのtree-view組み込み)は現時点では未実装です(🚧表示)。</p>
    </div>

    <div class="roc-card">
      <h2 style="margin-top:0">確認結果</h2>
      ${resultsHtml}
    </div>
  </div>
  <script>
    ${getThemeToggleScript()}
  </script>
</body>
</html>`;
}
