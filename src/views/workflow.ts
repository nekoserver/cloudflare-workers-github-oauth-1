import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export type WorkflowSummary = {
  workflow_no: string;
  title: string;
  page_path: string;
  summary: string | null;
};

export type WorkflowStep = {
  step_order: number;
  stage_title: string;
  api_method: string | null;
  api_path: string | null;
  note: string | null;
};

const METHOD_COLORS: Record<string, string> = {
  GET: '#1a7f37',
  POST: '#0969da',
  PUT: '#9a6700',
  PATCH: '#6639ba',
  DELETE: '#cf222e',
};

function renderSidebar(workflows: WorkflowSummary[], activeNo: string | null): string {
  if (workflows.length === 0) {
    return `<div class="wf-empty-sidebar">登録済みワークフローはありません</div>`;
  }
  return workflows.map((w) => {
    const active = w.workflow_no === activeNo ? ' active' : '';
    return `<a class="wf-nav-item${active}" href="${escapeHtml(w.workflow_no)}" data-wf-no="${escapeHtml(w.workflow_no)}">
      <span class="wf-nav-no">${escapeHtml(w.workflow_no)}</span>
      <span class="wf-nav-title">${escapeHtml(w.title)}</span>
    </a>`;
  }).join('');
}

function renderSteps(steps: WorkflowStep[]): string {
  if (steps.length === 0) {
    return `<div class="wf-empty">この番号には処理段階が登録されていません</div>`;
  }
  return `<ol class="wf-timeline">${steps.map((s) => {
    const color = s.api_method ? (METHOD_COLORS[s.api_method] ?? '#656d76') : null;
    const apiLine = s.api_method && s.api_path
      ? `<div class="wf-api-call"><span class="wf-method" style="background:${color}22;color:${color}">${escapeHtml(s.api_method)}</span><code class="wf-path">${escapeHtml(s.api_path)}</code></div>`
      : `<div class="wf-api-call wf-no-api">API問い合わせなし</div>`;
    const note = s.note ? `<div class="wf-note">${escapeHtml(s.note)}</div>` : '';
    return `<li class="wf-step">
      <div class="wf-step-marker">${s.step_order}</div>
      <div class="wf-step-body">
        <div class="wf-step-title">${escapeHtml(s.stage_title)}</div>
        ${apiLine}
        ${note}
      </div>
    </li>`;
  }).join('')}</ol>`;
}

export function getWorkflowPage(
  username: string,
  workflows: WorkflowSummary[],
  selected?: { workflow: WorkflowSummary; steps: WorkflowStep[] } | null
): string {
  const activeNo = selected ? selected.workflow.workflow_no : null;

  const mainContent = selected
    ? `<div class="wf-detail-header">
        <div class="wf-detail-no">#${escapeHtml(selected.workflow.workflow_no)}</div>
        <h1 class="wf-detail-title">${escapeHtml(selected.workflow.title)}</h1>
        <div class="wf-detail-path">対象ページ: <a href="${escapeHtml(selected.workflow.page_path)}">${escapeHtml(selected.workflow.page_path)}</a></div>
        ${selected.workflow.summary ? `<p class="wf-detail-summary">${escapeHtml(selected.workflow.summary)}</p>` : ''}
      </div>
      ${renderSteps(selected.steps)}`
    : `<div class="wf-placeholder">
        <p>左のサイドバーからワークフローを選択してください。</p>
        <p class="wf-placeholder-sub">各ワークフローには通し番号(0001〜9999)が割り当てられ、<code>/workflow/番号</code>で直接呼び出せます。</p>
      </div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#0d1117">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="ワークフロー">
  <link rel="manifest" href="/manifest-workflow.json">
  <base href="/workflow/">
  <title>${selected ? escapeHtml(selected.workflow.title) + ' - ' : ''}ワークフロー - Cloudflare Workers GitHub OAuth</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-primary, #f6f8fa);
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
    }
    @media (display-mode: standalone) { .pwa-hide { display: none !important; } }
    .navbar {
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px var(--navbar-shadow);
      padding: 10px 20px;
      padding-top: calc(10px + env(safe-area-inset-top));
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .navbar-brand { font-size: 16px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
    .user-menu { display: flex; align-items: center; gap: 12px; }
    .wf-layout { display: flex; flex: 1; min-height: 0; overflow: hidden; }
    .wf-sidebar, .wf-main { overflow-y: auto; }
    .wf-sidebar {
      width: 260px; min-width: 260px; border-right: 1px solid var(--border-color);
      background: var(--card-bg); overflow-y: auto; padding: 12px 0;
      transition: width .15s ease, min-width .15s ease;
    }
    .wf-layout.wf-sidebar-collapsed .wf-sidebar { width: 44px; min-width: 44px; overflow: hidden; }
    .wf-sidebar-title { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; padding: 6px 0 6px 4px; }
    .wf-nav-item {
      display: flex; align-items: baseline; gap: 8px; padding: 8px 16px; text-decoration: none;
      color: var(--text-secondary); font-size: 13px; border-left: 3px solid transparent;
    }
    .wf-nav-item:hover { background: var(--bg-secondary); }
    .wf-nav-item.active { background: var(--bg-secondary); border-left-color: var(--accent-color, #667eea); color: var(--text-primary); font-weight: 600; }
    .wf-nav-no { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
    .wf-empty-sidebar { padding: 16px; font-size: 13px; color: var(--text-muted); }
    .wf-sidebar-header { display: flex; align-items: center; gap: 6px; padding: 0 8px 10px; }
    .wf-sidebar-toggle {
      background: none; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;
      color: var(--text-secondary); font-size: 13px; line-height: 1; padding: 4px 7px; flex-shrink: 0;
    }
    .wf-sidebar-toggle:hover { background: var(--bg-secondary); color: var(--text-primary); }
    .wf-layout.wf-sidebar-collapsed .wf-sidebar-title,
    .wf-layout.wf-sidebar-collapsed .wf-nav-item,
    .wf-layout.wf-sidebar-collapsed .wf-empty-sidebar { display: none; }
    .wf-main { flex: 1; padding: 28px 32px; max-width: 900px; }
    .wf-placeholder { color: var(--text-muted); font-size: 14px; line-height: 1.8; }
    .wf-placeholder-sub { margin-top: 6px; font-size: 12px; }
    .wf-detail-header { margin-bottom: 20px; }
    .wf-detail-no { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; color: var(--text-muted); }
    .wf-detail-title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin: 2px 0 6px; }
    .wf-detail-path { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
    .wf-detail-path a { color: var(--link-color, #0969da); }
    .wf-detail-summary { font-size: 13px; color: var(--text-secondary); line-height: 1.7; }
    .wf-timeline { list-style: none; position: relative; padding-left: 28px; }
    .wf-timeline::before { content:''; position:absolute; left: 9px; top: 6px; bottom: 6px; width: 2px; background: var(--border-color); }
    .wf-step { position: relative; margin-bottom: 20px; }
    .wf-step-marker {
      position: absolute; left: -28px; top: 0; width: 20px; height: 20px; border-radius: 50%;
      background: var(--accent-color, #667eea); color: #fff; font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .wf-step-body { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 14px; }
    .wf-step-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
    .wf-api-call { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 4px; }
    .wf-api-call.wf-no-api { color: var(--text-muted); font-style: italic; }
    .wf-method { padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; }
    .wf-path { font-family: ui-monospace, SFMono-Regular, monospace; color: var(--text-secondary); }
    .wf-note { font-size: 12px; color: var(--text-muted); margin-top: 4px; line-height: 1.6; }
    .wf-empty { color: var(--text-muted); font-size: 13px; padding: 12px 0; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">🔀 ワークフロー</div>
    <div class="user-menu">
      ${getThemeToggleHTML()}
    </div>
  </nav>
  <div class="wf-layout" id="wfLayout">
    <aside class="wf-sidebar">
      <div class="wf-sidebar-header">
        <button type="button" id="wfSidebarToggle" class="wf-sidebar-toggle" title="サイドパネルを開閉" aria-label="サイドパネルを開閉">☰</button>
        <div class="wf-sidebar-title">ワークフロー一覧</div>
      </div>
      ${renderSidebar(workflows, activeNo)}
    </aside>
    <main class="wf-main" id="wfMain">
      ${mainContent}
    </main>
  </div>
  <script>
    ${getThemeToggleScript()}
    (function() {
      var layout = document.getElementById('wfLayout');
      var toggleBtn = document.getElementById('wfSidebarToggle');
      var STORAGE_KEY = 'wfSidebarCollapsed';
      function applyState(collapsed) {
        layout.classList.toggle('wf-sidebar-collapsed', collapsed);
      }
      applyState(localStorage.getItem(STORAGE_KEY) === '1');
      toggleBtn.addEventListener('click', function() {
        var collapsed = !layout.classList.contains('wf-sidebar-collapsed');
        applyState(collapsed);
        localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
      });
    })();

    // PWA(display-mode:standalone)でサイドパネルのリンクをクリックすると
    // 通常のページ遷移(フルリロード)になり、iOSではその瞬間だけアドレスバーが
    // 表示されてしまう。同一オリジン・相対パスのfetch + history.pushStateで
    // ページを差し替えることで、フルリロードを起こさずワークフローを
    // 切り替えられるようにする(hrefは自体はJS無効時のフォールバックとして残す)。
    (function() {
      var METHOD_COLORS = { GET: '#1a7f37', POST: '#0969da', PUT: '#9a6700', PATCH: '#6639ba', DELETE: '#cf222e' };
      function escHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }
      function renderSteps(steps) {
        if (!steps || steps.length === 0) {
          return '<div class="wf-empty">この番号には処理段階が登録されていません</div>';
        }
        var items = steps.map(function(s) {
          var color = s.api_method ? (METHOD_COLORS[s.api_method] || '#656d76') : null;
          var apiLine = s.api_method && s.api_path
            ? '<div class="wf-api-call"><span class="wf-method" style="background:' + color + '22;color:' + color + '">' + escHtml(s.api_method) + '</span><code class="wf-path">' + escHtml(s.api_path) + '</code></div>'
            : '<div class="wf-api-call wf-no-api">API問い合わせなし</div>';
          var note = s.note ? '<div class="wf-note">' + escHtml(s.note) + '</div>' : '';
          return '<li class="wf-step"><div class="wf-step-marker">' + s.step_order + '</div><div class="wf-step-body"><div class="wf-step-title">' + escHtml(s.stage_title) + '</div>' + apiLine + note + '</div></li>';
        }).join('');
        return '<ol class="wf-timeline">' + items + '</ol>';
      }
      function renderDetail(workflow, steps) {
        var summary = workflow.summary ? '<p class="wf-detail-summary">' + escHtml(workflow.summary) + '</p>' : '';
        return '<div class="wf-detail-header"><div class="wf-detail-no">#' + escHtml(workflow.workflow_no) + '</div>' +
          '<h1 class="wf-detail-title">' + escHtml(workflow.title) + '</h1>' +
          '<div class="wf-detail-path">対象ページ: <a href="' + escHtml(workflow.page_path) + '">' + escHtml(workflow.page_path) + '</a></div>' +
          summary + '</div>' + renderSteps(steps);
      }
      var wfMain = document.getElementById('wfMain');
      var navItems = document.querySelectorAll('[data-wf-no]');
      function setActiveNav(no) {
        navItems.forEach(function(el) {
          el.classList.toggle('active', el.getAttribute('data-wf-no') === no);
        });
      }
      function loadWorkflow(no, push) {
        fetch('/api/workflow/' + encodeURIComponent(no), { credentials: 'same-origin' })
          .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
          .then(function(res) {
            if (!res.ok || !res.data || !res.data.workflow) return;
            wfMain.innerHTML = renderDetail(res.data.workflow, res.data.steps || []);
            document.title = res.data.workflow.title + ' - ワークフロー - Cloudflare Workers GitHub OAuth';
            setActiveNav(no);
            if (push) history.pushState({ wfNo: no }, '', '/workflow/' + no);
          })
          .catch(function() {});
      }
      document.querySelectorAll('.wf-sidebar').forEach(function(sidebar) {
        sidebar.addEventListener('click', function(e) {
          var link = e.target.closest('[data-wf-no]');
          if (!link) return;
          e.preventDefault();
          loadWorkflow(link.getAttribute('data-wf-no'), true);
        });
      });
      window.addEventListener('popstate', function() {
        var path = location.pathname;
        var prefix = '/workflow/';
        if (path.indexOf(prefix) === 0) {
          loadWorkflow(path.slice(prefix.length), false);
        }
      });
    })();

    // Android Chromeは有効なWeb App Manifest(name/icons/start_url/display)に加え
    // Service Workerの登録が無いと、ホーム画面追加時に本来のstandalone表示ではなく
    // アドレスバー付きの簡易ショートカット表示になることがある。/workflow専用の
    // Service Worker(webgl系ページと共有しない)を登録して回避する。
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw-workflow.js', { scope: '/workflow' }).catch(function() {});
    }
  </script>
</body>
</html>`;
}
