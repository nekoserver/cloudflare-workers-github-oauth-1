import { CURSOR_AGENT_ALLOWED_REPOS } from '../utils/cursorAgentLaunch';

function escCursorAgent(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** /cursor-agent ページ。Cursor Background Agent APIをプロンプト・対象リポジトリ入力から起動する。 */
export function getCursorAgentPage(username: string): string {
  const safeUser = escCursorAgent(username);
  const repoOptions = CURSOR_AGENT_ALLOWED_REPOS
    .map((repo) => `<option value="${escCursorAgent(repo)}">${escCursorAgent(repo)}</option>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cursor Agent 起動</title>
<style>
:root {
  color-scheme: light dark;
  --bg:          light-dark(#f6f8fa, #0d1117);
  --panel:       light-dark(#ffffff, #161b22);
  --border:      light-dark(#d0d7de, #30363d);
  --text:        light-dark(#1f2328, #c9d1d9);
  --text-muted:  light-dark(#636c76, #8b949e);
  --text-strong: light-dark(#1f2328, #f0f6fc);
  --accent:      light-dark(#0969da, #58a6ff);
  --accent-fg:   light-dark(#ffffff, #0d1117);
  --input-bg:    light-dark(#ffffff, #0d1117);
  --danger:      light-dark(#cf222e, #f85149);
  --danger-bg:   light-dark(#fff0ee, #2d0e0a);
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px;
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px; line-height: 1.5;
  max-width: 900px; margin-left: auto; margin-right: auto;
}
h1 { color: var(--text-strong); font-size: 20px; margin: 0 0 4px; }
.subtitle { color: var(--text-muted); font-size: 12px; margin-bottom: 14px; }
.panel {
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  padding: 14px 16px; margin-bottom: 14px;
}
.panel-label { font-size: 12px; color: var(--text-muted); font-weight: 600; margin-bottom: 8px; }
textarea, select {
  width: 100%;
  background: var(--input-bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 10px; font-size: 13px;
  font-family: inherit;
  outline: none;
}
textarea { resize: vertical; min-height: 110px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
textarea:focus, select:focus { border-color: var(--accent); }
.toolbar { display: flex; align-items: center; gap: 10px; margin: 14px 0; flex-wrap: wrap; }
.btn {
  background: var(--accent); border: 1px solid var(--accent); border-radius: 6px;
  color: var(--accent-fg); font-size: 13px; padding: 7px 16px; cursor: pointer;
  font-weight: 600;
}
.btn:disabled { opacity: .5; cursor: not-allowed; }
.error-msg {
  display: none; margin-top: 8px; padding: 8px 12px; border-radius: 6px;
  background: var(--danger-bg); color: var(--danger); font-size: 12px; white-space: pre-wrap;
}
.error-msg.show { display: block; }
#agentResult { word-break: break-word; font-size: 12.5px; min-height: 30px; white-space: pre-wrap; }
.history-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.history-table th, .history-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
.history-table th { color: var(--text-muted); font-weight: 600; }
.history-prompt, .history-response { max-width: 320px; overflow-wrap: break-word; white-space: pre-wrap; }
</style>
</head>
<body>
<h1>🤖 Cursor Agent 起動</h1>
<p class="subtitle">Cursor Background Agent APIを起動します <span>${safeUser}</span></p>

<div class="panel">
  <div class="panel-label">対象リポジトリ</div>
  <select id="agentRepo">${repoOptions}</select>
</div>

<div class="panel">
  <div class="panel-label">プロンプト</div>
  <textarea id="agentPrompt" placeholder="Agentに実行してほしい内容を入力..."></textarea>
</div>

<div class="toolbar">
  <button class="btn" id="agentLaunchBtn">起動する</button>
  <span id="agentStatus" style="font-size:11px;color:var(--text-muted);"></span>
</div>

<div class="panel">
  <div class="panel-label">起動結果</div>
  <div id="agentResult"></div>
  <div class="error-msg" id="agentErrorMsg"></div>
</div>

<div class="panel">
  <div class="panel-label">
    問答履歴
    <button class="btn" id="agentHistoryReloadBtn" style="float:right;padding:4px 10px;font-size:11px;">再読み込み</button>
  </div>
  <div id="agentHistoryBody">
    <div style="font-size:11px;color:var(--text-muted);">読み込み中...</div>
  </div>
</div>

<script>
(function() {
  var repoEl = document.getElementById('agentRepo');
  var promptEl = document.getElementById('agentPrompt');
  var launchBtn = document.getElementById('agentLaunchBtn');
  var statusEl = document.getElementById('agentStatus');
  var resultEl = document.getElementById('agentResult');
  var errorEl = document.getElementById('agentErrorMsg');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('show');
  }
  function clearError() {
    errorEl.textContent = '';
    errorEl.classList.remove('show');
  }

  // Cursor APIの生JSONをそのまま出すと読みづらいため、agent.name/status・
  // run.status・agent.urlへのリンクだけをカード状に組み立てて表示する。
  // 生JSONはdetails/summaryで折りたたんで併記する(agent.name等は外部API
  // からの非信頼入力のため、innerHTMLではなくDOM API+textContentで組み立て、
  // hrefもhttps://始まりのみ許可する)。
  function renderCursorResponse(data) {
    resultEl.innerHTML = '';
    var agent = data && data.agent;
    var run = data && data.run;
    if (!agent) {
      resultEl.textContent = JSON.stringify(data, null, 2);
      return;
    }
    var card = document.createElement('div');

    var title = document.createElement('div');
    title.style.fontWeight = '600';
    title.style.marginBottom = '4px';
    title.textContent = '✅ ' + (agent.name || '(名称未設定)') + ' を起動しました';
    card.appendChild(title);

    var statusLine = document.createElement('div');
    statusLine.style.color = 'var(--text-muted)';
    statusLine.style.marginBottom = '6px';
    var statusParts = [];
    if (agent.status) statusParts.push('Agent: ' + agent.status);
    if (run && run.status) statusParts.push('Run: ' + run.status);
    statusLine.textContent = statusParts.join(' / ');
    card.appendChild(statusLine);

    if (typeof agent.url === 'string' && agent.url.indexOf('https://') === 0) {
      var link = document.createElement('a');
      link.href = agent.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Cursorで進捗を見る →';
      card.appendChild(link);
    }

    var details = document.createElement('details');
    details.style.marginTop = '8px';
    var summary = document.createElement('summary');
    summary.style.cursor = 'pointer';
    summary.style.color = 'var(--text-muted)';
    summary.style.fontSize = '11px';
    summary.textContent = '生のレスポンス(JSON)を見る';
    var pre = document.createElement('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordBreak = 'break-word';
    pre.style.fontSize = '11px';
    pre.textContent = JSON.stringify(data, null, 2);
    details.appendChild(summary);
    details.appendChild(pre);
    card.appendChild(details);

    resultEl.appendChild(card);
  }

  launchBtn.addEventListener('click', function() {
    clearError();
    resultEl.textContent = '';
    launchBtn.disabled = true;
    statusEl.textContent = '起動中...';
    fetch('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ prompt: promptEl.value, repoFullName: repoEl.value })
    })
      .then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
      .then(function(res) {
        if (res.status !== 200 || !res.data || res.data.error) {
          showError((res.data && res.data.error) || ('起動に失敗しました: HTTP ' + res.status));
          return;
        }
        renderCursorResponse(res.data.cursorResponse);
        if (res.data.historySaved === false) {
          showError('⚠️ Agentの起動には成功しましたが、問答履歴の保存に失敗しました(D1のcursor_agent_launch_logテーブル未作成の可能性があります)');
        }
        loadHistory();
      })
      .catch(function(err) {
        showError('通信エラー: ' + ((err && err.message) || '不明'));
      })
      .then(function() {
        launchBtn.disabled = false;
        statusEl.textContent = '';
      });
  });

  var historyBodyEl = document.getElementById('agentHistoryBody');
  var historyReloadBtn = document.getElementById('agentHistoryReloadBtn');

  function renderHistory(rows) {
    if (!rows || rows.length === 0) {
      historyBodyEl.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">まだ起動履歴がありません</div>';
      return;
    }
    var table = document.createElement('table');
    table.className = 'history-table';
    table.innerHTML = '<thead><tr><th>日時</th><th>リポジトリ</th><th>プロンプト</th><th>応答</th></tr></thead>';
    var tbody = document.createElement('tbody');
    rows.forEach(function(row) {
      var tr = document.createElement('tr');
      var tdDate = document.createElement('td');
      tdDate.textContent = row.created_at;
      var tdRepo = document.createElement('td');
      tdRepo.textContent = row.repo_full_name;
      var tdPrompt = document.createElement('td');
      tdPrompt.className = 'history-prompt';
      tdPrompt.textContent = row.prompt;
      var tdResponse = document.createElement('td');
      tdResponse.className = 'history-response';
      tdResponse.textContent = row.cursor_response;
      tr.appendChild(tdDate);
      tr.appendChild(tdRepo);
      tr.appendChild(tdPrompt);
      tr.appendChild(tdResponse);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    historyBodyEl.innerHTML = '';
    historyBodyEl.appendChild(table);
  }

  function loadHistory() {
    historyBodyEl.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">読み込み中...</div>';
    fetch('/api/cursor-agent/history', { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(d) { renderHistory(d.rows || []); })
      .catch(function() { historyBodyEl.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">読み込みに失敗しました</div>'; });
  }

  historyReloadBtn.addEventListener('click', loadHistory);
  loadHistory();
})();
</script>
</body>
</html>`;
}
