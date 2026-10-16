/**
 * /cf-containers（Cloudflare Containersのデモ用管理ページ、管理者限定）の
 * HTML。コンテナの状態参照・起動/停止/再起動・プロキシへの導線を持つ。
 */
export function getCfContainersPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cloudflare Containers（デモ）</title>
<style>
:root {
  --bg: #f6f8fa; --surface: #fff; --border: #d0d7de;
  --text: #1f2328; --muted: #656d76; --link: #0969da;
  --accent: #0969da; --accent-bg: #ddf4ff;
  --ok: #1a7f37; --ok-bg: #dafbe1;
  --err: #cf222e; --err-bg: #ffebe9;
  --warn: #9a6700; --warn-bg: #fff8c5;
  --radius: 8px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #30363d;
    --text: #e6edf3; --muted: #8b949e; --link: #58a6ff;
    --accent: #58a6ff; --accent-bg: #0c2d6b;
    --ok: #3fb950; --ok-bg: #0f2b18;
    --err: #f85149; --err-bg: #300a0a;
    --warn: #e3b341; --warn-bg: #2d1f00;
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font: 14px/1.6 system-ui, sans-serif; padding: 24px; max-width: 760px; margin: 0 auto; }
h1 { font-size: 20px; margin-bottom: 4px; }
.subtitle { color: var(--muted); font-size: 13px; margin-bottom: 16px; }
.notice {
  background: var(--warn-bg); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px 18px; margin-bottom: 20px; font-size: 13px; line-height: 1.7; color: var(--text);
}
.card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 20px; margin-bottom: 16px;
}
.status-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;
  background: var(--accent-bg); color: var(--accent);
}
.chip[data-running="true"] { background: var(--ok-bg); color: var(--ok); }
.chip[data-running="false"] { background: var(--border); color: var(--muted); }
button {
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
  border-radius: var(--radius); padding: 7px 14px; font-size: 13px; cursor: pointer; margin-right: 8px;
}
button:hover { background: var(--bg); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
#log { margin-top: 14px; font-size: 12px; color: var(--muted); white-space: pre-wrap; }
a.proxy-link { color: var(--link); font-size: 13px; }
table.health-table, table.tunnel-table { border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 10px; }
table.health-table th, table.health-table td, table.tunnel-table th, table.tunnel-table td {
  border: 1px solid var(--border); padding: 6px 10px; text-align: left;
}
.badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.badge[data-ok="true"] { background: var(--ok-bg); color: var(--ok); }
.badge[data-ok="false"] { background: var(--err-bg); color: var(--err); }
</style>
</head>
<body>
<h1>Cloudflare Containers（デモ）</h1>
<p class="subtitle">Durable Objects上で動くコンテナの起動・停止・状態確認・プロキシのデモページ。</p>
<div class="notice">
  Durable Objects・Containersはどちらも使用量課金が発生します（DO: リクエスト数・実行時間・ストレージ、Containers: vCPU秒・メモリGiB秒・ディスクGB-月）。
  使い終わったら必ず「停止」を押してください。一定時間操作が無ければコンテナ側で自動停止するよう設定していますが、放置しないよう注意してください。
</div>
<div class="card">
  <div class="status-row">
    <span id="status-chip" class="chip" data-running="false">状態取得中…</span>
    <button id="btn-refresh" type="button">状態を再取得</button>
  </div>
  <button id="btn-start" type="button">起動</button>
  <button id="btn-stop" type="button">停止</button>
  <button id="btn-restart" type="button">再起動</button>
  <div id="log"></div>
  <div id="usage-summary" style="margin-top:10px;font-size:12px;color:var(--muted);"></div>
  <div id="ssh-box" style="margin-top:10px;font-size:12px;" hidden>
    <strong>SSH接続:</strong>
    <code id="ssh-command" style="display:block;margin-top:4px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:4px;word-break:break-all;"></code>
    <button id="btn-copy-ssh" type="button" style="margin-top:6px;">コマンドをコピー</button>
  </div>
</div>
<div class="card">
  <p><a class="proxy-link" href="/cf-containers/proxy/" target="_blank" rel="noreferrer">プロキシ経由でコンテナのレスポンスを開く(新しいタブ)</a></p>
</div>
<div class="card">
  <div class="status-row">
    <strong>ヘルスチェック</strong>
    <button id="btn-health" type="button">コンテナ内部の状態を確認</button>
  </div>
  <table class="health-table" id="health-table" hidden>
    <thead><tr><th>Apache(8443)</th><th>sshd(22)</th><th>cloudflared(nekoroot)</th><th>確認時刻</th></tr></thead>
    <tbody><tr>
      <td id="health-apache"></td><td id="health-sshd"></td><td id="health-cloudflared"></td><td id="health-time"></td>
    </tr></tbody>
  </table>
  <div id="health-log" style="margin-top:8px;font-size:12px;color:var(--muted);"></div>
</div>
<div class="card">
  <div class="status-row">
    <strong>Cloudflare Tunnel一覧</strong>
    <button id="btn-tunnels" type="button">取得</button>
  </div>
  <table class="tunnel-table" id="tunnel-table" hidden>
    <thead><tr><th>name</th><th>status</th><th>connections</th><th>id</th></tr></thead>
    <tbody id="tunnel-tbody"></tbody>
  </table>
  <div id="tunnel-log" style="margin-top:8px;font-size:12px;color:var(--muted);"></div>
</div>
<script>
(function () {
  var chip = document.getElementById('status-chip');
  var log = document.getElementById('log');
  var buttons = {
    start: document.getElementById('btn-start'),
    stop: document.getElementById('btn-stop'),
    restart: document.getElementById('btn-restart'),
    refresh: document.getElementById('btn-refresh')
  };

  function setBusy(busy) {
    Object.keys(buttons).forEach(function (key) {
      buttons[key].disabled = busy;
    });
  }

  var usageSummary = document.getElementById('usage-summary');
  var sshBox = document.getElementById('ssh-box');
  var sshCommand = document.getElementById('ssh-command');
  var btnCopySsh = document.getElementById('btn-copy-ssh');
  btnCopySsh.addEventListener('click', function () {
    navigator.clipboard.writeText(sshCommand.textContent).then(function () {
      btnCopySsh.textContent = 'コピーしました';
      setTimeout(function () { btnCopySsh.textContent = 'コマンドをコピー'; }, 1500);
    });
  });

  function renderStatus(data) {
    chip.textContent = data.label;
    chip.setAttribute('data-running', data.running ? 'true' : 'false');
    if (data.usage) {
      var parts = ['累計起動回数: ' + data.usage.totalStartCount + '回'];
      if (data.usage.lastStartedAt) {
        parts.push('直近起動: ' + data.usage.lastStartedAt);
      }
      if (data.usage.elapsedSinceLastStart) {
        parts.push('経過: ' + data.usage.elapsedSinceLastStart);
      }
      usageSummary.textContent = parts.join(' / ');
    } else {
      usageSummary.textContent = '';
    }
    if (data.instanceId) {
      sshBox.hidden = false;
      sshCommand.textContent = 'ssh -o ProxyCommand="wrangler containers ssh %h" cloudchamber@' + data.instanceId;
    } else {
      sshBox.hidden = true;
    }
  }

  function fetchStatus() {
    return fetch('/api/cf-containers/status')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          chip.textContent = 'エラー: ' + data.error;
          chip.setAttribute('data-running', 'false');
          return;
        }
        renderStatus(data);
      })
      .catch(function (err) {
        chip.textContent = '取得に失敗しました';
        log.textContent = String(err);
      });
  }

  function runAction(action) {
    setBusy(true);
    log.textContent = action + ' を実行中…';
    fetch('/api/cf-containers/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          log.textContent = 'エラー: ' + data.error;
          return;
        }
        log.textContent = action + ' が完了しました(' + data.label + ')';
        renderStatus(data);
      })
      .catch(function (err) {
        log.textContent = 'エラー: ' + String(err);
      })
      .finally(function () {
        setBusy(false);
      });
  }

  buttons.start.addEventListener('click', function () { runAction('start'); });
  buttons.stop.addEventListener('click', function () { runAction('stop'); });
  buttons.restart.addEventListener('click', function () { runAction('restart'); });
  buttons.refresh.addEventListener('click', fetchStatus);

  fetchStatus();

  function badge(ok) {
    return '<span class="badge" data-ok="' + (ok ? 'true' : 'false') + '">' + (ok ? 'OK' : 'NG') + '</span>';
  }

  var btnHealth = document.getElementById('btn-health');
  var healthTable = document.getElementById('health-table');
  var healthLog = document.getElementById('health-log');
  btnHealth.addEventListener('click', function () {
    btnHealth.disabled = true;
    healthLog.textContent = '確認中…(コンテナが停止中の場合は起動を待ちます)';
    fetch('/cf-containers/proxy/health')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        document.getElementById('health-apache').innerHTML = badge(data.apache);
        document.getElementById('health-sshd').innerHTML = badge(data.sshd);
        document.getElementById('health-cloudflared').innerHTML = badge(data.cloudflared);
        document.getElementById('health-time').textContent = data.checkedAt || '';
        healthTable.hidden = false;
        healthLog.textContent = '';
      })
      .catch(function (err) {
        healthLog.textContent = 'エラー: ' + String(err);
      })
      .finally(function () {
        btnHealth.disabled = false;
      });
  });

  var btnTunnels = document.getElementById('btn-tunnels');
  var tunnelTable = document.getElementById('tunnel-table');
  var tunnelTbody = document.getElementById('tunnel-tbody');
  var tunnelLog = document.getElementById('tunnel-log');
  btnTunnels.addEventListener('click', function () {
    btnTunnels.disabled = true;
    tunnelLog.textContent = '取得中…';
    fetch('/api/cf-containers/tunnels')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          tunnelLog.textContent = 'エラー: ' + data.error;
          return;
        }
        tunnelTbody.innerHTML = '';
        (data.tunnels || []).forEach(function (t) {
          var tr = document.createElement('tr');
          var statusBadge = badge(t.status === 'healthy');
          tr.innerHTML = '<td>' + t.name + '</td><td>' + statusBadge + ' ' + t.status + '</td>' +
            '<td>' + t.connectionCount + '</td><td><code>' + t.id + '</code></td>';
          tunnelTbody.appendChild(tr);
        });
        tunnelTable.hidden = false;
        tunnelLog.textContent = data.tunnels && data.tunnels.length ? '' : '(トンネルが見つかりません)';
      })
      .catch(function (err) {
        tunnelLog.textContent = 'エラー: ' + String(err);
      })
      .finally(function () {
        btnTunnels.disabled = false;
      });
  });
})();
</script>
</body>
</html>`;
}
