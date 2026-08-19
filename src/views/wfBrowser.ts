import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import { API_ENDPOINT_LIST } from '../data/apiEndpointList';

export type WfBrowserRef = { workflow_no: string; title: string };
export type WfBrowserWorkflowSummary = { workflow_no: string; title: string };

const METHOD_COLORS: Record<string, string> = {
  GET: '#1a7f37',
  POST: '#0969da',
  PUT: '#9a6700',
  PATCH: '#6639ba',
  DELETE: '#cf222e',
  QUERY: '#656d76',
};

function groupByGroup(): Map<string, typeof API_ENDPOINT_LIST> {
  const map = new Map<string, typeof API_ENDPOINT_LIST>();
  for (const e of API_ENDPOINT_LIST) {
    if (!map.has(e.group)) map.set(e.group, []);
    map.get(e.group)!.push(e);
  }
  return map;
}

export function getWfBrowserPage(
  username: string,
  refsByKey: Map<string, WfBrowserRef[]>,
  allWorkflows: WfBrowserWorkflowSummary[] = [],
  missingStepsWorkflows: WfBrowserWorkflowSummary[] = []
): string {
  const groups = groupByGroup();

  let referencedCount = 0;
  const totalCount = API_ENDPOINT_LIST.length;

  const groupsHtml = [...groups.entries()].map(([group, endpoints]) => {
    const rows = endpoints.map((e) => {
      const key = e.method + ' ' + e.path;
      const refs = refsByKey.get(key) ?? [];
      const referenced = refs.length > 0;
      if (referenced) referencedCount++;
      const color = METHOD_COLORS[e.method] ?? '#656d76';
      const refsHtml = referenced
        ? `<span class="wfb-refs">${refs.map((r) => `<a class="wfb-ref-badge" href="/workflow/${escapeHtml(r.workflow_no)}" title="${escapeHtml(r.title)}">${escapeHtml(r.workflow_no)}</a>`).join('')}</span>`
        : `<span class="wfb-unreferenced">未参照</span>`;
      const wfNos = refs.map((r) => r.workflow_no).join(' ');
      return `<tr class="wfb-row${referenced ? '' : ' wfb-row-gray'}" data-wf-nos="${escapeHtml(wfNos)}">
        <td><span class="wfb-method" style="background:${color}22;color:${color}">${escapeHtml(e.method)}</span></td>
        <td><code class="wfb-path">${escapeHtml(e.path)}</code></td>
        <td class="wfb-desc">${escapeHtml(e.desc)}</td>
        <td>${refsHtml}</td>
      </tr>`;
    }).join('');
    return `<section class="wfb-group">
      <h2 class="wfb-group-title">${escapeHtml(group)}</h2>
      <table class="wfb-table">
        <thead><tr><th>Method</th><th>Path</th><th>説明</th><th>参照元ワークフロー</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
  }).join('');

  const summaryHtml = `<div class="wfb-summary">全${totalCount}件中 <strong>${referencedCount}件</strong> がいずれかのワークフローから参照されています(未参照: ${totalCount - referencedCount}件)。</div>`;

  // バッジバーは各ワークフローが内部で使っているAPI数の多い順に左から並べる。
  // 件数はrefsByKey(エンドポイント→参照元ワークフロー一覧)を逆引きして数える。
  const apiCountByWfNo = new Map<string, number>();
  for (const refs of refsByKey.values()) {
    for (const r of refs) {
      apiCountByWfNo.set(r.workflow_no, (apiCountByWfNo.get(r.workflow_no) ?? 0) + 1);
    }
  }
  const sortedWorkflows = [...allWorkflows].sort((a, b) => {
    const countDiff = (apiCountByWfNo.get(b.workflow_no) ?? 0) - (apiCountByWfNo.get(a.workflow_no) ?? 0);
    return countDiff !== 0 ? countDiff : a.workflow_no.localeCompare(b.workflow_no);
  });

  const wfBadgesHtml = sortedWorkflows.length === 0
    ? `<span class="wfb-badgebar-empty">登録済みワークフローはありません</span>`
    : sortedWorkflows.map((w) => {
        const count = apiCountByWfNo.get(w.workflow_no) ?? 0;
        return `<button type="button" class="wfb-wf-badge" data-wf-no="${escapeHtml(w.workflow_no)}" title="${escapeHtml(w.title)}">${escapeHtml(w.title)} (${count})</button>`;
      }).join('');

  // workflow_registryには登録されているがworkflow_stepsが1行も無い
  // (処理段階のINSERT文がまだ未実行の)ワークフローがあれば、ページ上部に
  // 薄ピンク色のトーストでやんわり警告し、反映までの導線(該当ワークフロー
  // ページへのリンク)を示す。件数が0件ならトースト自体を描画しない。
  const missingListHtml = missingStepsWorkflows
    .map((w) => `<a class="wfb-toast-link" href="/workflow/${escapeHtml(w.workflow_no)}">${escapeHtml(w.workflow_no)} ${escapeHtml(w.title)}</a>`)
    .join('、');
  const toastHtml = missingStepsWorkflows.length === 0 ? '' : `<div class="wfb-toast" id="wfbToast" role="status">
    <span class="wfb-toast-icon">⚠️</span>
    <span class="wfb-toast-body">
      ワークフローは登録されていますが、処理段階(workflow_steps)がまだD1に反映されていないため、このページに表示されていません: ${missingListHtml}。
      各ワークフローページで登録済みSQLが実行済みか確認してください。
    </span>
    <button type="button" class="wfb-toast-close" id="wfbToastClose" aria-label="閉じる">✕</button>
  </div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>APIエンドポイント参照状況 - Cloudflare Workers GitHub OAuth</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-primary, #f6f8fa);
    }
    .navbar {
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px var(--navbar-shadow);
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .navbar-brand { font-size: 16px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
    .wfb-main { max-width: 1100px; margin: 0 auto; padding: 24px 20px 60px; }
    .wfb-title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .wfb-subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: 14px; line-height: 1.6; }
    .wfb-summary { font-size: 13px; color: var(--text-secondary); background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; }
    .wfb-group { margin-bottom: 26px; }
    .wfb-group-title { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
    .wfb-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .wfb-table th { text-align: left; color: var(--text-muted); font-weight: 600; padding: 6px 8px; border-bottom: 1px solid var(--border-color); }
    .wfb-row td { padding: 6px 8px; border-bottom: 1px solid var(--border-color); vertical-align: top; }
    .wfb-row:focus { outline: 2px solid var(--accent-color, #667eea); outline-offset: -2px; }
    .wfb-row-gray { opacity: 0.4; }
    .wfb-row-gray .wfb-path, .wfb-row-gray .wfb-desc { color: var(--text-muted); }
    .wfb-method { padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; white-space: nowrap; }
    .wfb-path { font-family: ui-monospace, SFMono-Regular, monospace; color: var(--text-secondary); }
    .wfb-desc { color: var(--text-secondary); }
    .wfb-refs { display: flex; flex-wrap: wrap; gap: 4px; }
    .wfb-ref-badge {
      font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; text-decoration: none;
      background: var(--accent-color, #667eea); color: #fff; border-radius: 4px; padding: 2px 6px;
    }
    .wfb-ref-badge:hover { opacity: 0.85; }
    .wfb-unreferenced { color: var(--text-muted); font-size: 11px; }
    .wfb-badgebar {
      position: sticky; top: 0; z-index: 20;
      background: var(--card-bg); border-bottom: 1px solid var(--border-color);
      padding: 10px 20px; display: flex; flex-wrap: wrap; gap: 1px; align-items: center;
    }
    .wfb-badgebar-label { font-size: 11px; font-weight: 700; color: var(--text-muted); margin-right: 4px; }
    .wfb-badgebar-empty { font-size: 12px; color: var(--text-muted); }
    .wfb-wf-badge {
      font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; cursor: pointer;
      background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color);
      border-radius: 999px; padding: 4px 10px;
    }
    .wfb-wf-badge:hover { border-color: var(--accent-color, #667eea); }
    .wfb-wf-badge.active { background: var(--accent-color, #667eea); color: #fff; border-color: var(--accent-color, #667eea); }
    .wfb-row.wfb-highlight { background: #d4f5d4; }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) .wfb-row.wfb-highlight { background: #1a3d1a; }
    }
    :root[data-theme="dark"] .wfb-row.wfb-highlight { background: #1a3d1a; }
    .wfb-toast {
      display: flex; align-items: flex-start; gap: 10px;
      background: #fde2e9; color: #7a2e42; border: 1px solid #f5b8cb; border-radius: 8px;
      padding: 12px 14px; margin: 14px 20px 0; font-size: 12px; line-height: 1.7;
    }
    :root[data-theme="dark"] .wfb-toast { background: #3a1f28; color: #f3b8cc; border-color: #6b3348; }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) .wfb-toast { background: #3a1f28; color: #f3b8cc; border-color: #6b3348; }
    }
    .wfb-toast-icon { flex-shrink: 0; }
    .wfb-toast-body { flex: 1; }
    .wfb-toast-link { color: inherit; text-decoration: underline; font-weight: 600; }
    .wfb-toast-close {
      flex-shrink: 0; background: none; border: none; cursor: pointer; color: inherit;
      font-size: 13px; line-height: 1; padding: 2px 4px; opacity: 0.7;
    }
    .wfb-toast-close:hover { opacity: 1; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">🔎 APIエンドポイント参照状況</div>
    <div class="user-menu">
      ${getThemeToggleHTML()}
    </div>
  </nav>
  <div class="wfb-badgebar" id="wfbBadgebar">
    <span class="wfb-badgebar-label">ワークフローで絞り込み:</span>
    ${wfBadgesHtml}
  </div>
  ${toastHtml}
  <main class="wfb-main">
    <div class="wfb-title">APIエンドポイント参照状況</div>
    <div class="wfb-subtitle">/apis ページにある全エンドポイントのうち、<a href="/workflow">/workflow</a> の各ワークフローから参照されていないものをグレーアウトして表示します。上部のバッジを押すと、そのワークフローが使用するエンドポイントの行が緑色にハイライトされます。</div>
    ${summaryHtml}
    ${groupsHtml}
  </main>
  <script>
    ${getThemeToggleScript()}
    (function() {
      var badgebar = document.getElementById('wfbBadgebar');
      if (!badgebar) return;
      var badges = badgebar.querySelectorAll('.wfb-wf-badge');
      var rows = document.querySelectorAll('.wfb-row');
      var activeNos = {};
      function applyHighlight() {
        var anyActive = Object.keys(activeNos).length > 0;
        rows.forEach(function(row) {
          if (!anyActive) { row.classList.remove('wfb-highlight'); return; }
          var nos = (row.getAttribute('data-wf-nos') || '').split(' ').filter(Boolean);
          var hit = nos.some(function(no) { return activeNos[no]; });
          row.classList.toggle('wfb-highlight', hit);
        });
      }
      function jumpToFirstRow(no) {
        for (var i = 0; i < rows.length; i++) {
          var nos = (rows[i].getAttribute('data-wf-nos') || '').split(' ').filter(Boolean);
          if (nos.indexOf(no) !== -1) {
            if (rows[i].scrollIntoView) rows[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
            rows[i].setAttribute('tabindex', '-1');
            rows[i].focus({ preventScroll: true });
            return;
          }
        }
      }
      badges.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var no = btn.getAttribute('data-wf-no');
          if (activeNos[no]) {
            delete activeNos[no];
            btn.classList.remove('active');
          } else {
            activeNos[no] = true;
            btn.classList.add('active');
            jumpToFirstRow(no);
          }
          applyHighlight();
        });
      });
    })();
    (function() {
      var closeBtn = document.getElementById('wfbToastClose');
      if (!closeBtn) return;
      closeBtn.addEventListener('click', function() {
        var toast = document.getElementById('wfbToast');
        if (toast) toast.remove();
      });
    })();
  </script>
</body>
</html>`;
}
