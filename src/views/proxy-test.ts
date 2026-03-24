/**
 * プロキシテストページ
 * Cloudflare Worker 経由でオリジンに IPv4 代理アクセスし、接続結果を表示する
 */

import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getProxyTestPage(userName: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proxy Test - Origin IPv4 Access</title>
<style>
${getThemeCSS()}
${getThemeToggleCSS()}

* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end));
  min-height: 100vh;
  color: var(--text-primary);
}

.navbar {
  background: var(--navbar-bg);
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 3px var(--navbar-shadow);
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 100;
}
.navbar h1 { font-size: 16px; font-weight: 700; }
.navbar .spacer { flex: 1; }
.navbar .user-name { font-size: 13px; color: var(--text-muted); }

.container {
  max-width: 900px;
  margin: 32px auto;
  padding: 0 16px;
}

.card {
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 4px 12px var(--card-shadow-light);
  padding: 24px;
  margin-bottom: 20px;
}

.card h2 {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.form-row input[type="text"] {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  font-size: 14px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-family: 'SF Mono', Monaco, Consolas, monospace;
}

.form-row input[type="text"]:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}
.btn-primary {
  background: var(--accent-color);
  color: #fff;
}
.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-muted);
  flex-wrap: wrap;
}
.option-row label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.option-row select {
  padding: 4px 8px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  font-size: 13px;
  background: var(--input-bg);
  color: var(--text-primary);
}

.result-area {
  display: none;
}
.result-area.show { display: block; }

.result-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.result-metric {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px;
}
.result-metric .metric-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.result-metric .metric-value {
  font-size: 18px;
  font-weight: 700;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
}
.result-metric .metric-value.ok { color: var(--success-color); }
.result-metric .metric-value.err { color: var(--danger-color); }

.result-headers {
  margin-top: 12px;
}
.result-headers summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 8px 0;
}
.headers-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  margin-top: 4px;
}
.headers-table th,
.headers-table td {
  text-align: left;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-light);
}
.headers-table th {
  color: var(--text-muted);
  font-weight: 600;
  width: 30%;
}
.headers-table td {
  word-break: break-all;
}

.body-preview {
  margin-top: 12px;
}
.body-preview summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 8px 0;
}
.body-preview pre {
  background: var(--code-bg);
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin-top: 4px;
}

.history-list {
  font-size: 13px;
}
.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
}
.history-item:hover { background: var(--bg-secondary); margin: 0 -8px; padding: 6px 8px; border-radius: 6px; }
.history-item:last-child { border-bottom: none; }
.history-item .h-status {
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  font-weight: 700;
  font-size: 12px;
  min-width: 36px;
}
.history-item .h-url {
  flex: 1;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-item .h-time {
  color: var(--text-faint);
  font-size: 11px;
  white-space: nowrap;
}

.error-msg {
  background: rgba(229, 62, 62, 0.1);
  border: 1px solid rgba(229, 62, 62, 0.3);
  border-radius: 8px;
  padding: 12px;
  color: var(--danger-color);
  font-size: 13px;
  display: none;
}
.error-msg.show { display: block; }

.loading {
  display: none;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
  padding: 12px 0;
}
.loading.show { display: flex; }
.spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.note {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
  line-height: 1.6;
}
</style>
${getThemeInitScript()}
</head>
<body>

<nav class="navbar">
  <h1>Proxy Test</h1>
  <span class="spacer"></span>
  ${getThemeToggleHTML()}
  <span class="user-name">${userName}</span>
</nav>

<div class="container">
  <div class="card">
    <h2>Origin IPv4 Proxy Access</h2>
    <div class="form-row">
      <input type="text" id="url-input" placeholder="https://example.com" spellcheck="false" autofocus>
      <button class="btn btn-primary" id="fetch-btn" onclick="doFetch()">Fetch</button>
    </div>
    <div class="option-row">
      <label>Method:
        <select id="method-select">
          <option value="GET">GET</option>
          <option value="HEAD">HEAD</option>
          <option value="POST">POST</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>
      </label>
      <label><input type="checkbox" id="follow-redirects" checked> Follow redirects</label>
      <label><input type="checkbox" id="include-body" checked> Include body preview</label>
    </div>
    <p class="note">
      Cloudflare Worker (IPv4) 経由でオリジンにアクセスし、レスポンスヘッダー・ステータス・応答時間を確認します。
      プロキシ下のオリジンが正常に応答するかのテストに使えます。
    </p>
  </div>

  <div class="loading" id="loading">
    <div class="spinner"></div>
    <span>Fetching...</span>
  </div>
  <div class="error-msg" id="error-msg"></div>

  <div class="result-area" id="result-area">
    <div class="card">
      <h2>Result</h2>
      <div class="result-summary" id="result-summary"></div>
      <details class="result-headers" open>
        <summary>Response Headers</summary>
        <table class="headers-table" id="headers-table"><tbody></tbody></table>
      </details>
      <details class="body-preview" id="body-section">
        <summary>Body Preview (first 4KB)</summary>
        <pre id="body-content"></pre>
      </details>
    </div>
  </div>

  <div class="card" id="history-card" style="display:none">
    <h2>History</h2>
    <div class="history-list" id="history-list"></div>
  </div>
</div>

<script>
${getThemeToggleScript()}

const urlInput = document.getElementById('url-input');
const fetchBtn = document.getElementById('fetch-btn');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error-msg');
const resultArea = document.getElementById('result-area');

let history = [];

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doFetch();
});

async function doFetch() {
  const rawUrl = urlInput.value.trim();
  if (!rawUrl) return;

  let url = rawUrl;
  if (!/^https?:\\/\\//.test(url)) url = 'https://' + url;

  const method = document.getElementById('method-select').value;
  const followRedirects = document.getElementById('follow-redirects').checked;
  const includeBody = document.getElementById('include-body').checked;

  fetchBtn.disabled = true;
  loadingEl.classList.add('show');
  errorEl.classList.remove('show');
  resultArea.classList.remove('show');

  try {
    const resp = await fetch('/api/proxy-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ url, method, followRedirects, includeBody }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || 'Request failed');
    }

    showResult(data);
    addHistory(url, method, data);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.add('show');
  } finally {
    fetchBtn.disabled = false;
    loadingEl.classList.remove('show');
  }
}

function showResult(data) {
  const summaryEl = document.getElementById('result-summary');
  const isOk = data.status >= 200 && data.status < 400;

  summaryEl.innerHTML = [
    metric('Status', data.status + ' ' + (data.statusText || ''), isOk),
    metric('Duration', data.durationMs + ' ms', data.durationMs < 3000),
    metric('CF-Ray', data.cfRay || '-', true),
    metric('Server', data.server || '-', true),
  ].join('');

  const tbody = document.querySelector('#headers-table tbody');
  tbody.innerHTML = '';
  for (const [k, v] of Object.entries(data.headers || {})) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<th>' + esc(k) + '</th><td>' + esc(v) + '</td>';
    tbody.appendChild(tr);
  }

  const bodySection = document.getElementById('body-section');
  if (data.bodyPreview != null) {
    document.getElementById('body-content').textContent = data.bodyPreview;
    bodySection.style.display = '';
  } else {
    bodySection.style.display = 'none';
  }

  resultArea.classList.add('show');
}

function metric(label, value, ok) {
  return '<div class="result-metric"><div class="metric-label">' + esc(label)
    + '</div><div class="metric-value ' + (ok ? 'ok' : 'err') + '">'
    + esc(String(value)) + '</div></div>';
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function addHistory(url, method, data) {
  history.unshift({ url, method, status: data.status, time: new Date().toLocaleTimeString() });
  if (history.length > 20) history.pop();
  renderHistory();
}

function renderHistory() {
  const card = document.getElementById('history-card');
  const list = document.getElementById('history-list');
  if (history.length === 0) { card.style.display = 'none'; return; }
  card.style.display = '';
  list.innerHTML = history.map((h) => {
    const ok = h.status >= 200 && h.status < 400;
    return '<div class="history-item" onclick="urlInput.value=\\'' + h.url.replace(/'/g, "\\\\'") + '\\';doFetch()">'
      + '<span class="h-status" style="color:' + (ok ? 'var(--success-color)' : 'var(--danger-color)') + '">' + h.status + '</span>'
      + '<span class="h-url">' + esc(h.method + ' ' + h.url) + '</span>'
      + '<span class="h-time">' + esc(h.time) + '</span>'
      + '</div>';
  }).join('');
}
</script>
</body>
</html>`;
}
