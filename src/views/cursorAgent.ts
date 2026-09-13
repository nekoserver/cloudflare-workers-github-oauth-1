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
  /* サーバステータスバッジの配色。意味的に色が固定されている表示
     (CLAUDE.CSS.mdの例外規定: running=緑・遅延/その他=黄・通信障害=赤)。 */
  --status-green:    light-dark(#1a7f37, #3fb950);
  --status-green-bg: light-dark(#dafbe1, #0d2818);
  --status-yellow:    light-dark(#9a6700, #d29922);
  --status-yellow-bg: light-dark(#fff8c5, #2b2111);
  --status-red:    light-dark(#cf222e, #f85149);
  --status-red-bg: light-dark(#fff0ee, #2d0e0a);
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
.history-delete-btn {
  background: transparent; border: 1px solid var(--danger); border-radius: 6px;
  color: var(--danger); font-size: 11px; padding: 3px 8px; cursor: pointer;
}
.history-delete-btn:disabled { opacity: .5; cursor: not-allowed; }
.history-refresh-btn {
  background: transparent; border: 1px solid var(--accent); border-radius: 6px;
  color: var(--accent); font-size: 11px; padding: 3px 8px; cursor: pointer;
}
.history-refresh-btn:disabled { opacity: .5; cursor: not-allowed; }
#agentHistorySearch {
  width: 100%; background: var(--input-bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; font-size: 12px;
  outline: none;
}
#agentHistorySearch:focus { border-color: var(--accent); }
.status-badge {
  display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 7px;
  border-radius: 10px; line-height: 1.6; margin-right: 4px;
}
.status-badge.green { color: var(--status-green); background: var(--status-green-bg); }
.status-badge.yellow { color: var(--status-yellow); background: var(--status-yellow-bg); }
.status-badge.red { color: var(--status-red); background: var(--status-red-bg); }
.agent-id-link {
  background: none; border: none; padding: 0; margin: 0; cursor: pointer;
  color: var(--accent); text-decoration: none; font: inherit;
}
.agent-id-link:hover { text-decoration: none; }
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal-overlay[hidden] { display: none; }
.modal-box {
  background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
  padding: 18px 20px; max-width: 560px; width: 100%; max-height: 80vh; overflow-y: auto;
}
.modal-box h2 { margin: 0 0 10px; font-size: 15px; color: var(--text-strong); }
.modal-close-btn {
  float: right; background: transparent; border: 1px solid var(--border); border-radius: 6px;
  color: var(--text); font-size: 12px; padding: 3px 9px; cursor: pointer;
}
.timeline-list { margin: 10px 0 0; padding-left: 18px; font-size: 12px; }
.timeline-list li { margin-bottom: 10px; }
.timeline-report { white-space: pre-wrap; color: var(--text-muted); margin-top: 3px; }
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
  <input type="search" id="agentHistorySearch" placeholder="リポジトリ・Agent ID・プロンプト・応答を検索..." style="margin-bottom:8px;">
  <div id="agentHistoryBody">
    <div style="font-size:11px;color:var(--text-muted);">読み込み中...</div>
  </div>
</div>

<div class="modal-overlay" id="agentDetailModalOverlay" hidden>
  <div class="modal-box">
    <button class="modal-close-btn" id="agentDetailModalCloseBtn">閉じる</button>
    <h2 id="agentDetailModalTitle">Agent詳細</h2>
    <div id="agentDetailModalBody">読み込み中...</div>
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
  function renderCursorResponse(data, reportText) {
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

    // Agentが実際に生成したレポート本文(reportText)が取得できていれば、
    // 制御情報(status等)より前面に、本文として最も目立つ位置に表示する。
    // 見つからない場合は「未取得」と明示し、あたかも本文が無いかのように
    // 空欄のまま黙って見せない(でっち上げず、状態を伝える)。
    var reportBox = document.createElement('div');
    reportBox.style.marginTop = '8px';
    reportBox.style.marginBottom = '8px';
    reportBox.style.padding = '10px';
    reportBox.style.border = '1px solid var(--border)';
    reportBox.style.borderRadius = '6px';
    reportBox.style.whiteSpace = 'pre-wrap';
    reportBox.style.wordBreak = 'break-word';
    if (reportText) {
      reportBox.textContent = reportText;
    } else {
      reportBox.style.color = 'var(--text-muted)';
      reportBox.style.fontSize = '11px';
      reportBox.textContent = 'レポート本文はまだ取得できていません(Agentが実行中か、応答にレポートらしきフィールドが含まれていません)。「最新状態を取得」で再取得してください。';
    }
    card.appendChild(reportBox);

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
        renderCursorResponse(res.data.cursorResponse, res.data.reportText);
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
  var historySearchEl = document.getElementById('agentHistorySearch');
  // サーバーから読み込んだ全件を保持し、検索窓の入力ではAPIを再度叩かず
  // クライアント側でリポジトリ・プロンプト・応答の3列に対して部分一致で絞り込む。
  var allHistoryRows = [];

  // D1のcreated_atはdatetime('now')でUTC('YYYY-MM-DD HH:MM:SS'形式、タイムゾーン
  // 表記なし)で保存されるため、そのまま表示するとJSTだと誤解されうる。
  // UTCとして明示的に解釈しJST(UTC+9)に換算した上で「JST」と明記する。
  function formatJstFromUtcString(utcString) {
    if (!utcString) return '(不明)';
    var isoUtc = utcString.indexOf('T') === -1 ? utcString.replace(' ', 'T') + 'Z' : utcString;
    var d = new Date(isoUtc);
    if (isNaN(d.getTime())) return utcString;
    var jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    var pad = function(n) { return String(n).length < 2 ? '0' + n : String(n); };
    return jst.getUTCFullYear() + '-' + pad(jst.getUTCMonth() + 1) + '-' + pad(jst.getUTCDate()) + ' ' +
      pad(jst.getUTCHours()) + ':' + pad(jst.getUTCMinutes()) + ':' + pad(jst.getUTCSeconds()) + ' JST';
  }

  function deleteHistoryRow(id, btn) {
    if (!window.confirm('この履歴を削除しますか?')) return;
    btn.disabled = true;
    fetch('/api/cursor-agent/history/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' })
      .then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
      .then(function(res) {
        if (res.status !== 200) {
          btn.disabled = false;
          window.alert('削除に失敗しました: ' + ((res.data && res.data.error) || ('HTTP ' + res.status)));
          return;
        }
        allHistoryRows = allHistoryRows.filter(function(r) { return r.id !== id; });
        renderHistory(filterHistoryRows(allHistoryRows, historySearchEl.value));
      })
      .catch(function(err) {
        btn.disabled = false;
        window.alert('通信エラー: ' + ((err && err.message) || '不明'));
      });
  }

  function refreshHistoryRow(id, btn) {
    btn.disabled = true;
    var origText = btn.textContent;
    btn.textContent = '取得中...';
    fetch('/api/cursor-agent/history/' + encodeURIComponent(id) + '/refresh', { method: 'POST', credentials: 'same-origin' })
      .then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
      .then(function(res) {
        if (res.status !== 200) {
          window.alert('最新状態の取得に失敗しました: ' + ((res.data && res.data.error) || ('HTTP ' + res.status)));
          var failedRow = allHistoryRows.filter(function(r) { return r.id === id; })[0];
          if (failedRow && res.status === 502) {
            failedRow.commError = true;
            renderHistory(filterHistoryRows(allHistoryRows, historySearchEl.value));
          }
          return;
        }
        // cursor_agent_status_logへ新しい行が追記されただけなので、一覧全体を
        // 読み直して最新状態(agent_status/run_status/report_text)を反映する。
        loadHistory();
      })
      .catch(function(err) {
        window.alert('通信エラー: ' + ((err && err.message) || '不明'));
      })
      .then(function() {
        btn.disabled = false;
        btn.textContent = origText;
      });
  }

  // これ以上状態が変わらない終了状態。この状態に達した後は毎回モーダルを
  // 開くたびにCursor APIへ問い合わせ直しても結果が変わらないため、DBの
  // 記録だけを読んで表示し、無駄なAPI呼び出し(レート制限の消費)を避ける。
  // 未終了(RUNNING等)・未取得(null)の場合のみ、モーダルを開いたタイミングで
  // 自動的に最新状態を取得し直してDBへ追記する(=「どのタイミングで
  // チェックして書き込むべきか」への回答: 終了が確定するまでは開くたびに
  // 追記、確定後は読むだけにする)。
  var TERMINAL_AGENT_STATUSES = ['FINISHED', 'COMPLETED', 'ERROR', 'FAILED', 'CANCELLED'];

  function isTerminalStatus(status) {
    return TERMINAL_AGENT_STATUSES.indexOf((status || '').toUpperCase()) !== -1;
  }

  // ステータスバッジの色分け: 通信自体に失敗した場合は赤(通信障害)。
  // Agentが実行中なら緑。それ以外(未取得・完了・その他の状態)は黄色
  // (応答遅延=まだ確定的な最新情報ではない、の意味も含める)。
  function classifyStatusBadge(row) {
    if (row.commError) return { color: 'red', label: '通信障害' };
    var s = (row.agent_status || '').toUpperCase();
    if (s === 'RUNNING' || s === 'ACTIVE') return { color: 'green', label: row.agent_status };
    return { color: 'yellow', label: row.agent_status || '未取得' };
  }

  function buildStatusBadge(row) {
    var info = classifyStatusBadge(row);
    var badge = document.createElement('span');
    badge.className = 'status-badge ' + info.color;
    badge.textContent = info.label;
    return badge;
  }

  // モーダル・オーバーレイに複数のポップアップが重なっても、後から開いた
  // ものが必ず前面に来るよう、既存のposition:fixed要素の最大z-indexを
  // 走査してそれより大きい値を返す(CLAUDE.mdルール26)。
  function getNextZ() {
    var max = 1000;
    var all = document.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var z = parseInt(window.getComputedStyle(all[i]).zIndex, 10);
      if (!isNaN(z) && z > max) max = z;
    }
    return max + 10;
  }

  var modalOverlay = document.getElementById('agentDetailModalOverlay');
  var modalTitle = document.getElementById('agentDetailModalTitle');
  var modalBody = document.getElementById('agentDetailModalBody');
  var modalCloseBtn = document.getElementById('agentDetailModalCloseBtn');

  function closeAgentModal() {
    modalOverlay.hidden = true;
  }
  modalCloseBtn.addEventListener('click', closeAgentModal);
  modalOverlay.addEventListener('click', function(ev) {
    if (ev.target === modalOverlay) closeAgentModal();
  });

  function renderTimelineInto(container, rows) {
    container.innerHTML = '';
    if (!rows || rows.length === 0) {
      container.appendChild(document.createTextNode('状態取得の履歴がありません'));
      return;
    }
    var list = document.createElement('ol');
    list.className = 'timeline-list';
    rows.forEach(function(row) {
      var li = document.createElement('li');
      var badge = buildStatusBadge({ agent_status: row.agent_status });
      li.appendChild(badge);
      var line = formatJstFromUtcString(row.fetched_at) +
        (row.run_status ? ' / Run: ' + row.run_status : '');
      li.appendChild(document.createTextNode(line));
      if (row.report_text) {
        var reportDiv = document.createElement('div');
        reportDiv.className = 'timeline-report';
        reportDiv.textContent = row.report_text;
        li.appendChild(reportDiv);
      }
      list.appendChild(li);
    });
    container.appendChild(list);
  }

  /**
   * Agent IDをタップした時の処理。DBに書き込まれた記録(cursor_agent_status_log)を
   * このアプリ内の最上位レイヤーのモーダルへ読み出して表示する(外部の
   * Cursorアプリへ直接遷移させない)。既に終了状態(FINISHED等)と分かって
   * いれば読み出すだけ、そうでなければモーダルを開いたタイミングで
   * 最新状態を1回取得し直してからDBへ追記し、その結果を表示する。
   */
  function openAgentModal(row) {
    modalTitle.textContent = 'Agent: ' + (row.agent_id || '(未記録)');
    modalBody.innerHTML = '読み込み中...';
    modalOverlay.style.zIndex = String(getNextZ());
    modalOverlay.hidden = false;

    function loadTimelineAndRender() {
      return fetch('/api/cursor-agent/history/' + encodeURIComponent(row.id) + '/timeline', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var rows = d.rows || [];
          renderTimelineInto(modalBody, rows);
          if (rows.length > 0) {
            var latest = rows[rows.length - 1];
            row.agent_status = latest.agent_status;
            row.run_status = latest.run_status;
            row.report_text = latest.report_text;
          }
          if (typeof row.agent_url === 'string' && row.agent_url.indexOf('https://') === 0) {
            var link = document.createElement('a');
            link.href = row.agent_url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.style.display = 'block';
            link.style.marginTop = '10px';
            link.style.fontSize = '11px';
            link.textContent = 'Cursorで直接開く →';
            modalBody.appendChild(link);
          }
        });
    }

    if (isTerminalStatus(row.agent_status)) {
      loadTimelineAndRender().catch(function() { modalBody.textContent = '読み込みに失敗しました'; });
      return;
    }

    // 未終了・未取得の場合のみ、モーダルを開いたタイミングで最新状態を
    // 取得し直す(=書き込みのタイミング)。取得自体に失敗しても、
    // DBに既にある記録は表示できるようにする(失敗を隠さない: 通信障害
    // バッジを立てた上で、既存の記録は失わせない)。
    fetch('/api/cursor-agent/history/' + encodeURIComponent(row.id) + '/refresh', { method: 'POST', credentials: 'same-origin' })
      .then(function(r) { row.commError = r.status === 502; return loadTimelineAndRender(); })
      .catch(function() {
        row.commError = true;
        return loadTimelineAndRender();
      })
      .then(function() {
        renderHistory(filterHistoryRows(allHistoryRows, historySearchEl.value));
      })
      .catch(function() { modalBody.textContent = '読み込みに失敗しました'; });
  }

  function renderHistory(rows) {
    if (!rows || rows.length === 0) {
      historyBodyEl.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">' +
        (allHistoryRows.length === 0 ? 'まだ起動履歴がありません' : '検索条件に一致する履歴がありません') + '</div>';
      return;
    }
    var table = document.createElement('table');
    table.className = 'history-table';
    table.innerHTML = '<thead><tr><th>日時(JST)</th><th>リポジトリ</th><th>Agent ID</th><th>状態</th><th>プロンプト</th><th>レポート</th><th></th></tr></thead>';
    var tbody = document.createElement('tbody');
    rows.forEach(function(row) {
      var tr = document.createElement('tr');
      var tdDate = document.createElement('td');
      tdDate.textContent = formatJstFromUtcString(row.created_at);
      var tdRepo = document.createElement('td');
      tdRepo.textContent = row.repo_full_name;
      var tdAgentId = document.createElement('td');
      if (row.agent_id) {
        // タップすると外部のCursorアプリへは飛ばさず、DBに書き込まれた
        // 記録(cursor_agent_status_log)をこのアプリ内の最上位レイヤーの
        // モーダルへ読み出して表示する。下線は付けない(リンクに見せない)。
        var agentIdBtn = document.createElement('button');
        agentIdBtn.type = 'button';
        agentIdBtn.className = 'agent-id-link';
        agentIdBtn.textContent = row.agent_id;
        agentIdBtn.addEventListener('click', function() { openAgentModal(row); });
        tdAgentId.appendChild(agentIdBtn);
      } else {
        tdAgentId.textContent = '(未記録)';
      }
      var tdStatus = document.createElement('td');
      tdStatus.appendChild(buildStatusBadge(row));
      if (row.run_status) tdStatus.appendChild(document.createTextNode('Run: ' + row.run_status));
      var tdPrompt = document.createElement('td');
      tdPrompt.className = 'history-prompt';
      tdPrompt.textContent = row.prompt;
      var tdResponse = document.createElement('td');
      tdResponse.className = 'history-response';
      // agent_status・run_status・report_textはcursor_agent_status_logから
      // 個別カラムとして結合済み(JSONブロブを都度読み解く必要はない)。
      // report_textが無い(=まだAgentが完了していない)場合はその旨を明示する。
      tdResponse.textContent = row.report_text || '(未取得)';
      var tdActions = document.createElement('td');
      var refreshBtn = document.createElement('button');
      refreshBtn.className = 'history-refresh-btn';
      refreshBtn.textContent = '最新状態を取得';
      refreshBtn.style.marginRight = '6px';
      refreshBtn.addEventListener('click', function() { refreshHistoryRow(row.id, refreshBtn); });
      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'history-delete-btn';
      deleteBtn.textContent = '削除';
      deleteBtn.addEventListener('click', function() { deleteHistoryRow(row.id, deleteBtn); });
      tdActions.appendChild(refreshBtn);
      tdActions.appendChild(deleteBtn);
      tr.appendChild(tdDate);
      tr.appendChild(tdRepo);
      tr.appendChild(tdAgentId);
      tr.appendChild(tdStatus);
      tr.appendChild(tdPrompt);
      tr.appendChild(tdResponse);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    historyBodyEl.innerHTML = '';
    historyBodyEl.appendChild(table);
  }

  // リポジトリ・Agent ID・プロンプト・状態・レポートのいずれかに検索語
  // (大文字小文字を区別しない)を含む行だけを残す。検索語が空の場合は全件を返す。
  function filterHistoryRows(rows, query) {
    var q = (query || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(function(row) {
      return (row.repo_full_name || '').toLowerCase().indexOf(q) !== -1 ||
        (row.agent_id || '').toLowerCase().indexOf(q) !== -1 ||
        (row.prompt || '').toLowerCase().indexOf(q) !== -1 ||
        (row.agent_status || '').toLowerCase().indexOf(q) !== -1 ||
        (row.run_status || '').toLowerCase().indexOf(q) !== -1 ||
        (row.report_text || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  function loadHistory() {
    historyBodyEl.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">読み込み中...</div>';
    fetch('/api/cursor-agent/history', { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        allHistoryRows = d.rows || [];
        renderHistory(filterHistoryRows(allHistoryRows, historySearchEl.value));
      })
      .catch(function() { historyBodyEl.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">読み込みに失敗しました</div>'; });
  }

  historyReloadBtn.addEventListener('click', loadHistory);
  historySearchEl.addEventListener('input', function() {
    renderHistory(filterHistoryRows(allHistoryRows, historySearchEl.value));
  });
  loadHistory();
})();
</script>
</body>
</html>`;
}
