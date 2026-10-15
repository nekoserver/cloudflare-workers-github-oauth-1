import { escapeHtml } from '../utils/html';

export interface RepoBackfillCoverage {
  repoName: string;
  totalCommits: number;
  committedAtFilled: number;
  ratio: number;
}

export interface CommitActivityBackfillStatusPageInput {
  repos: RepoBackfillCoverage[];
  generatedAt: string;
}

/**
 * repo_commit_index.committed_atの段階的バックフィル(SPEC.cloudflare-workers-github-oauth-1.20261015.commit-activity-dashboard.md
 * 8章)の達成度を、リポジトリ横断で一覧表示する簡易ページ。全履歴の一括
 * バックフィルはしない方針(dynamicnekoの/api/tree-view/commitsへの便乗で
 * 段階的に埋まる)のため、「今どれくらい埋まっているか」を確認する用途。
 */
export function getCommitActivityBackfillStatusPage(input: CommitActivityBackfillStatusPageInput): string {
  const rows = [...input.repos].sort((a, b) => b.ratio - a.ratio);
  const rowsHtml = rows.map((r) => `
    <tr>
      <td><code>${escapeHtml(r.repoName)}</code></td>
      <td>${r.committedAtFilled} / ${r.totalCommits}</td>
      <td><div class="bar"><div class="bar-fill" style="width:${(r.ratio * 100).toFixed(1)}%"></div></div></td>
      <td>${(r.ratio * 100).toFixed(1)}%</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>committed_atバックフィル達成度</title>
  <style>
    :root { color-scheme: light dark; --bg:light-dark(#f6f8fa,#0d1117); --panel:light-dark(#fff,#161b22); --border:light-dark(#d0d7de,#30363d); --text:light-dark(#1f2328,#e6edf3); --muted:light-dark(#636c76,#8b949e); --accent:light-dark(#0969da,#58a6ff); --ok:light-dark(#1a7f37,#3fb950); }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    header { border-bottom:1px solid var(--border); background:var(--panel); }
    .header-inner,.container { width:min(900px,calc(100% - 32px)); margin:auto; }
    .header-inner { min-height:58px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .brand { font-weight:700; } a { color:var(--accent); text-decoration:none; } a:hover { text-decoration:underline; }
    .container { padding:32px 0 56px; }
    h1 { margin:0 0 6px; font-size:24px; }
    .lead,.muted { color:var(--muted); } .lead { margin:0 0 22px; }
    .table-wrap { overflow:auto; border:1px solid var(--border); border-radius:10px; }
    table { width:100%; border-collapse:collapse; min-width:560px; background:var(--panel); }
    th,td { text-align:left; padding:10px 13px; border-bottom:1px solid var(--border); }
    th { color:var(--muted); font-size:12px; } tr:last-child td { border-bottom:0; }
    code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
    .bar { width:120px; height:8px; border-radius:4px; background:var(--border); overflow:hidden; }
    .bar-fill { height:100%; background:var(--ok); }
    .empty { padding:28px; text-align:center; color:var(--muted); background:var(--panel); }
  </style>
</head>
<body>
  <header><div class="header-inner"><span class="brand">📈 バックフィル達成度</span><a href="/status">/statusへ戻る</a></div></header>
  <main class="container">
    <h1>committed_atバックフィル達成度</h1>
    <p class="lead">repo_commit_index.committed_atは今後のpushから正確になるのみで、既存コミットの一括バックフィルは行っていません。dynamicnekoでtree-viewのコミット履歴を開くたびに段階的に埋まります。生成時刻: ${escapeHtml(input.generatedAt)}</p>
    ${rows.length
      ? `<div class="table-wrap"><table><thead><tr><th>リポジトリ</th><th>埋まった件数</th><th></th><th>比率</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`
      : '<div class="empty">repo_commit_indexにデータがありません。</div>'}
  </main>
</body>
</html>`;
}
