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
  無操作のまま<strong id="sleep-after-value">?</strong>経過すると自動停止します。単価・累計接続時間・予定支出は下の表を参照してください。
</div>
<div class="card">
  <strong>トークン設定（CLI不要）</strong>
  <p class="subtitle" style="margin:4px 0 10px;">nekorootトンネル・Tailscaleのトークンをここから設定できます。設定後、自動的にコンテナを再起動して反映します。</p>
  <div class="status-row">
    <label for="secret-name" style="font-size:13px;">対象:</label>
    <select id="secret-name">
      <option value="NEKOROOT_TUNNEL_TOKEN">NEKOROOT_TUNNEL_TOKEN（nekorootトンネル）</option>
      <option value="TAILSCALE_AUTHKEY">TAILSCALE_AUTHKEY（Tailscale）</option>
      <option value="CF_CONTAINER_API_TOKEN">CF_CONTAINER_API_TOKEN（コンテナ内cfコマンド）</option>
    </select>
  </div>
  <input id="secret-value" type="password" placeholder="トークンを貼り付け" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);margin-bottom:8px;" />
  <button id="btn-set-secret" type="button">設定して再起動</button>
  <div id="secret-log" style="margin-top:8px;font-size:12px;color:var(--muted);"></div>
</div>
<div class="card">
  <div class="status-row">
    <span id="status-chip" class="chip" data-running="false">状態取得中…</span>
    <button id="btn-refresh" type="button">状態を再取得</button>
  </div>
  <div id="live-clock" style="font-size:20px;font-weight:600;margin-bottom:10px;" hidden>00:00:00</div>
  <table class="health-table" style="margin-bottom:10px;">
    <thead><tr><th></th><th>vCPU(0.5)</th><th>メモリ(4GiB)</th><th>ディスク(8GB)</th><th>合計</th></tr></thead>
    <tbody>
      <tr>
        <td>$/時間</td>
        <td id="rate-vcpu"></td><td id="rate-memory"></td><td id="rate-disk"></td><td id="rate-total"></td>
      </tr>
    </tbody>
  </table>
  <div id="cost-summary" style="font-size:13px;"></div>
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
    <strong>コンテナのネットワーク情報(IPアドレス・CIDR)</strong>
    <button id="btn-net" type="button">ip addr / ip route を取得</button>
  </div>
  <pre id="net-log" style="margin-top:8px;font-size:12px;white-space:pre-wrap;"></pre>
</div>
<div class="card">
  <div class="status-row">
    <strong>本番ビルド(Workers Builds)のログ</strong>
    <button id="btn-buildlog" type="button">最新ビルドのログを取得</button>
  </div>
  <pre id="buildlog-log" style="margin-top:8px;font-size:12px;white-space:pre-wrap;max-height:480px;overflow:auto;"></pre>
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

  var isRunning = false;

  // 起動中は「起動」、停止中は「停止」を押せないようにする(状態と矛盾する
  // 操作をボタンの見た目からも分かるようにする)。
  function applyRunningDisabled() {
    buttons.start.disabled = isRunning;
    buttons.stop.disabled = !isRunning;
  }

  function setBusy(busy) {
    if (busy) {
      Object.keys(buttons).forEach(function (key) {
        buttons[key].disabled = true;
      });
      return;
    }
    buttons.restart.disabled = false;
    buttons.refresh.disabled = false;
    applyRunningDisabled();
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

  var sleepAfterValue = document.getElementById('sleep-after-value');
  var liveClock = document.getElementById('live-clock');
  var costSummary = document.getElementById('cost-summary');
  var rateCells = {
    vcpu: document.getElementById('rate-vcpu'),
    memory: document.getElementById('rate-memory'),
    disk: document.getElementById('rate-disk'),
    total: document.getElementById('rate-total')
  };
  var liveClockTimer = null;
  var sleepAfterShown = false;

  function formatSleepAfter(value) {
    var m = /^(\d+)([a-z]+)$/.exec(String(value || ''));
    if (!m) return String(value || '不明');
    var n = m[1];
    if (m[2] === 'm') return n + '分';
    if (m[2] === 's') return n + '秒';
    if (m[2] === 'h') return n + '時間';
    return value;
  }

  function formatHms(totalSeconds) {
    var s = Math.max(0, Math.floor(totalSeconds));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return pad(h) + ':' + pad(m) + ':' + pad(sec);
  }

  function renderStatus(data) {
    chip.textContent = data.label;
    chip.setAttribute('data-running', data.running ? 'true' : 'false');
    isRunning = !!data.running;
    applyRunningDisabled();
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
    if (!sleepAfterShown && data.sleepAfter) {
      sleepAfterValue.textContent = formatSleepAfter(data.sleepAfter);
      sleepAfterShown = true;
    }
    if (data.cost) {
      rateCells.vcpu.textContent = '$' + data.cost.hourlyRate.vcpuUsdPerHour.toFixed(5);
      rateCells.memory.textContent = '$' + data.cost.hourlyRate.memoryUsdPerHour.toFixed(5);
      rateCells.disk.textContent = '$' + data.cost.hourlyRate.diskUsdPerHour.toFixed(5);
      rateCells.total.textContent = '$' + data.cost.hourlyRate.totalUsdPerHour.toFixed(5);
      costSummary.textContent =
        '累計接続時間: ' + formatHms(data.cost.cumulativeConnectedSeconds) +
        ' / 予定支出(概算、無料枠未考慮): $' + data.cost.estimatedCostUsd.toFixed(4) +
        '（' + data.cost.instanceType + '）';
    }
    if (liveClockTimer) {
      clearInterval(liveClockTimer);
      liveClockTimer = null;
    }
    if (data.running && data.usage && data.usage.lastStartedAt) {
      var startedAtMs = Date.parse(data.usage.lastStartedAt);
      liveClock.hidden = false;
      var tick = function () {
        var elapsedThisSession = (Date.now() - startedAtMs) / 1000;
        liveClock.textContent = formatHms(elapsedThisSession) + '（今回のセッション）';
      };
      tick();
      liveClockTimer = setInterval(tick, 1000);
    } else {
      liveClock.hidden = true;
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

  var btnNet = document.getElementById('btn-net');
  var netLog = document.getElementById('net-log');
  btnNet.addEventListener('click', function () {
    btnNet.disabled = true;
    netLog.textContent = '取得中…';
    fetch('/cf-containers/proxy/debug/net')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        netLog.textContent = '[ip addr]\\n' + (data.addr || '') + '\\n\\n[ip route]\\n' + (data.route || '')
          + '\\n\\n[/etc/resolv.conf]\\n' + (data.dns || '') + '\\n\\n[ss -tulpn]\\n' + (data.netstat || '');
      })
      .catch(function (err) {
        netLog.textContent = 'エラー: ' + String(err);
      })
      .finally(function () {
        btnNet.disabled = false;
      });
  });

  var btnBuildLog = document.getElementById('btn-buildlog');
  var buildLogPre = document.getElementById('buildlog-log');
  btnBuildLog.addEventListener('click', function () {
    btnBuildLog.disabled = true;
    buildLogPre.textContent = '取得中…';
    fetch('/api/cf-containers/build-log')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) { buildLogPre.textContent = 'エラー: ' + data.error; return; }
        buildLogPre.textContent = 'build=' + data.buildUuid + ' status=' + (data.status || '?') + '\\n\\n[直近のビルド]\\n' + (data.recentBuilds || []).join('\\n') + '\\n\\n' + (data.log || '(ログ空)');
      })
      .catch(function (err) { buildLogPre.textContent = 'エラー: ' + String(err); })
      .finally(function () { btnBuildLog.disabled = false; });
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

  var secretName = document.getElementById('secret-name');
  var secretValue = document.getElementById('secret-value');
  var btnSetSecret = document.getElementById('btn-set-secret');
  var secretLog = document.getElementById('secret-log');
  btnSetSecret.addEventListener('click', function () {
    var value = secretValue.value.trim();
    if (!value) {
      secretLog.textContent = 'トークンを入力してください';
      return;
    }
    btnSetSecret.disabled = true;
    secretLog.textContent = '設定中…(設定後にコンテナを再起動するため少し時間がかかります)';
    fetch('/api/cf-containers/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: secretName.value, value: value })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          secretLog.textContent = 'エラー: ' + data.error;
          return;
        }
        secretValue.value = '';
        secretLog.textContent = data.warning ? data.warning : '設定・再起動が完了しました';
        fetchStatus();
      })
      .catch(function (err) {
        secretLog.textContent = 'エラー: ' + String(err);
      })
      .finally(function () {
        btnSetSecret.disabled = false;
      });
  });
})();
</script>
</body>
</html>`;
}
