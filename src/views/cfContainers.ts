/**
 * /cf-containers（Cloudflare Containersのデモ用管理ページ、管理者限定）の
 * HTML。コンテナの状態参照・起動/停止/再起動・プロキシへの導線を持つ。
 */
import { CONFIGURED_INSTANCE_TYPE, CONFIGURED_INSTANCE_SPEC, computeHourlyRate } from '../utils/cfContainerCost';

export function getCfContainersPage(): string {
  const instancePrices = [
    { name: CONFIGURED_INSTANCE_TYPE, spec: CONFIGURED_INSTANCE_SPEC },
    { name: 'standard-2', spec: { vcpu: 1, memoryGiB: 6, diskGB: 12 } },
  ].map(({ name, spec }) => {
    const rate = computeHourlyRate(spec);
    const selected = name === CONFIGURED_INSTANCE_TYPE;
    return `<tr>
      <th scope="row"><span class="instance-model" data-selected="${selected}">${name}</span>${selected ? '（選択中）' : ''}</th>
      <td>${spec.vcpu} vCPU<br>$${rate.vcpuUsdPerHour.toFixed(5)}</td>
      <td>${spec.memoryGiB} GiB<br>$${rate.memoryUsdPerHour.toFixed(5)}</td>
      <td>${spec.diskGB} GB<br>$${rate.diskUsdPerHour.toFixed(5)}</td>
      <td>$${rate.totalUsdPerHour.toFixed(5)}</td>
    </tr>`;
  }).join('');
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
body { background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, sans-serif; padding: 12px; max-width: 760px; margin: 0 auto; }
h1 { font-size: 20px; margin-bottom: 4px; }
.subtitle { color: var(--muted); font-size: 13px; margin-bottom: 8px; }
.notice {
  background: var(--warn-bg); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 8px 12px; margin-bottom: 8px; font-size: 13px; line-height: 1.5; color: var(--text);
}
.card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 8px 12px; margin-bottom: 8px;
}
.status-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
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
#log { margin-top: 6px; font-size: 12px; color: var(--muted); white-space: pre-wrap; }
details.card > summary { cursor: pointer; font-weight: 600; color: var(--text); padding: 2px 0; }
details.card[open] > summary { margin-bottom: 6px; }
/* 前回表示時との差分: 増えた・変わった=黄、同じ=淡色 */
.diff-up { color: var(--warn); font-weight: 600; }
.diff-same { color: var(--muted); }
details.sub > summary { cursor: pointer; font-weight: 600; color: var(--text); margin: 6px 0 4px; }
a.proxy-link { color: var(--link); font-size: 13px; }
table.health-table, table.tunnel-table { border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 10px; }
table.health-table th, table.health-table td, table.tunnel-table th, table.tunnel-table td {
  border: 1px solid var(--border); padding: 6px 10px; text-align: left;
}
.instance-model[data-selected="true"] { color: var(--ok); font-weight: 700; }
.pricing-scroll { overflow-x: auto; }
.pricing-table { min-width: 540px; }
.badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.badge[data-ok="true"] { background: var(--ok-bg); color: var(--ok); }
.badge[data-ok="false"] { background: var(--err-bg); color: var(--err); }
.badge[data-level="ok"] { background: var(--ok-bg); color: var(--ok); }
.badge[data-level="warn"] { background: var(--warn-bg); color: var(--warn); }
.badge[data-level="ng"] { background: var(--err-bg); color: var(--err); }
</style>
</head>
<body>
<h1>Cloudflare Containers（デモ）</h1>
<p><a href="/cf-containers/diagnostics">コンテナ診断 — ヘルスチェック・通信統計・保存履歴</a></p>
<p class="subtitle">Durable Objects上で動くコンテナの起動・停止・状態確認・プロキシのデモページ。</p>
<div class="notice">
  自動停止はしません(停止ボタンで止めるまで動き続け、課金も続きます)。単価・累計接続時間・予定支出は下の表を参照してください。
</div>
<details class="card" data-section="secrets">
  <summary>トークン設定（CLI不要）</summary>
  <p class="subtitle" style="margin:0 0 6px;">CF API・nekorootトンネル・Tailscaleのトークンを設定・更新できます。CF APIトークンは期限切れでも、新しいトークンを入力して更新できます。新しいCF APIトークンには対象アカウントのWorkers Scripts:EditとCloudflare Tunnel:Read権限が必要です。保存後、コンテナを再起動して反映します。</p>
  <div class="status-row">
    <label for="secret-name" style="font-size:13px;">対象:</label>
    <select id="secret-name">
      <option value="NEKOROOT_TUNNEL_TOKEN">NEKOROOT_TUNNEL_TOKEN（nekorootトンネル）</option>
      <option value="TAILSCALE_AUTHKEY">TAILSCALE_AUTHKEY（Tailscale）</option>
      <option value="CF_CONTAINER_API_TOKEN">CF_CONTAINER_API_TOKEN（コンテナ内cfコマンド）</option>
      <option value="CONTAINER_GH_TOKEN">CONTAINER_GH_TOKEN（コンテナ内gh・git push）</option>
    </select>
  </div>
  <input id="secret-value" type="password" placeholder="トークンを貼り付け" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);margin-bottom:8px;" />
  <button id="btn-set-secret" type="button">保存・更新して再起動</button>
  <div id="secret-log" style="margin-top:6px;font-size:12px;color:var(--muted);"></div>
</details>
<details class="card" data-section="control" open>
  <summary>コンテナの操作（起動・停止・状態）</summary>
  <div class="status-row">
    <span id="status-chip" class="chip" data-running="false">状態取得中…</span>
    <button id="btn-refresh" type="button">状態を再取得</button>
  </div>
  <div id="live-clock" style="font-size:18px;font-weight:600;margin-bottom:4px;" hidden>00:00:00</div>
  <details class="sub" data-section="pricing">
  <summary>Cloudflare Containers 単価表（USD/時間）</summary>
  <div class="pricing-scroll">
    <table class="health-table pricing-table" style="margin-bottom:10px;">
      <thead><tr><th scope="col">モデル</th><th scope="col">vCPU</th><th scope="col">メモリ</th><th scope="col">ディスク</th><th scope="col">合計</th></tr></thead>
      <tbody>${instancePrices}</tbody>
    </table>
  </div>
  <p class="subtitle">無料枠未考慮・CPUを上限まで使用した場合の目安。CPUは実使用量、メモリ・ディスクは確保量で課金されます。通信・Workers・Durable Objects等の料金は別途。<a class="proxy-link" href="https://developers.cloudflare.com/containers/platform/pricing/" target="_blank" rel="noreferrer">公式料金</a></p>
  </details>
  <div id="cost-summary" style="font-size:13px;"></div>
  <div id="cost-diff" style="font-size:12px;"></div>
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
</details>
<details class="card" data-section="links">
  <summary>リンク（Docker コマンドセンター・プロキシ）</summary>
  <p><a class="proxy-link" href="/cf-containers/docker.html" target="_blank" rel="noreferrer">Docker コマンドセンターを開く（管理者認証で接続）</a></p>
  <p><a class="proxy-link" href="/cf-containers/proxy/" target="_blank" rel="noreferrer">プロキシ経由でコンテナのレスポンスを開く(新しいタブ)</a></p>
</details>
<details class="card" data-section="health" open>
  <summary>ヘルスチェック</summary>
  <div class="status-row">
    <button id="btn-health" type="button">コンテナ内部の状態を確認</button>
  </div>
  <div class="pricing-scroll">
  <table class="health-table" id="health-table" hidden>
    <thead><tr><th>Apache(8443)</th><th>sshd(2222)</th><th>cloudflared(nekoroot)</th><th>Tailscale</th><th>Docker</th><th>確認時刻</th></tr></thead>
    <tbody><tr>
      <td id="health-apache"></td><td id="health-sshd"></td><td id="health-cloudflared"></td><td id="health-tailscale"></td><td id="health-docker"></td><td id="health-time"></td>
    </tr></tbody>
  </table>
  </div>
  <div id="image-build" style="font-size:12px;margin-bottom:6px;" hidden></div>
  <div class="pricing-scroll">
  <table class="health-table" id="version-table" hidden>
    <thead><tr><th>デーモン・CLI</th><th>実際の版</th><th>前回の版</th><th>想定の版</th><th>判定</th><th>今の版のリリース日</th><th>配布元の最新(リリース日)</th></tr></thead>
    <tbody id="version-tbody"></tbody>
  </table>
  </div>
  <div id="health-log" style="margin-top:6px;font-size:12px;color:var(--muted);"></div>
</details>
<details class="card" data-section="report">
  <summary>6時間レポート(Slack通知)</summary>
  <label style="font-size:13px;display:flex;align-items:center;gap:6px;">
    <input type="checkbox" id="report-slack-toggle" disabled />
    6時間ごとのレポート(稼働数・支出・版の新旧)をSlackに送る
  </label>
  <div id="report-slack-log" style="margin-top:4px;font-size:12px;color:var(--muted);">OFFでもD1への記録は続けます。</div>
</details>
<details class="card" data-section="net">
  <summary>コンテナのネットワーク情報(IPアドレス・CIDR)</summary>
  <div class="status-row">
    <button id="btn-net" type="button">ip addr / ip route を取得</button>
  </div>
  <pre id="net-log" style="margin-top:6px;font-size:12px;white-space:pre-wrap;"></pre>
</details>
<details class="card" data-section="buildlog">
  <summary>本番ビルド(Workers Builds)のログ</summary>
  <div class="status-row">
    <button id="btn-buildlog" type="button">最新ビルドのログを取得</button>
  </div>
  <pre id="buildlog-log" style="margin-top:6px;font-size:12px;white-space:pre-wrap;max-height:480px;overflow:auto;"></pre>
</details>
<details class="card" data-section="tunnels">
  <summary>Cloudflare Tunnel一覧</summary>
  <div class="status-row">
    <button id="btn-tunnels" type="button">取得</button>
  </div>
  <table class="tunnel-table" id="tunnel-table" hidden>
    <thead><tr><th>name</th><th>status</th><th>connections</th><th>id</th></tr></thead>
    <tbody id="tunnel-tbody"></tbody>
  </table>
  <div id="tunnel-log" style="margin-top:6px;font-size:12px;color:var(--muted);"></div>
</details>
<script>
  // 前回のヘルスチェック時の記録(D1のcf_container_snapshots)。開いた時点で読み、比較元として固定する。
  // ヘルスチェックのたびに今回の値をD1へ記録する(差分はcf_container_snapshot_diffsに残る)。
  var prevSnapshot = null;
  var prevSnapshotLoaded = false;
  var currentSnapshot = {};
  var onPrevSnapshotLoaded = [];
  fetch('/api/cf-containers/snapshot/latest')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var r = data && data.snapshot;
      if (data && data.error) console.error('[cf-containers] 前回の記録の取得に失敗', data.error);
      prevSnapshot = r ? {
        savedAt: r.createdAt,
        cost: r.connectedSeconds === null ? null : { cumulativeConnectedSeconds: r.connectedSeconds, estimatedCostUsd: r.estimatedCostUsd },
        commit: r.imageCommit,
        versions: r.versions || {}
      } : null;
    })
    .catch(function (err) { console.error('[cf-containers] 前回の記録の取得に失敗', err); })
    .finally(function () {
      prevSnapshotLoaded = true;
      onPrevSnapshotLoaded.forEach(function (fn) { fn(); });
    });
  function saveSnapshot(part) {
    Object.keys(part).forEach(function (k) { currentSnapshot[k] = part[k]; });
  }
  // ヘルスチェックの結果がそろったら、今回の値をD1へ記録する
  function recordSnapshotToServer() {
    var c = currentSnapshot.cost || {};
    fetch('/api/cf-containers/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runningContainers: typeof currentSnapshot.running === 'boolean' ? (currentSnapshot.running ? 1 : 0) : null,
        connectedSeconds: typeof c.cumulativeConnectedSeconds === 'number' ? c.cumulativeConnectedSeconds : null,
        estimatedCostUsd: typeof c.estimatedCostUsd === 'number' ? c.estimatedCostUsd : null,
        imageCommit: currentSnapshot.commit || null,
        versions: currentSnapshot.versions || {}
      })
    })
      .then(readJsonOrText)
      .then(function (data) {
        var el = document.getElementById('health-log');
        if (data.error) { el.textContent = '記録に失敗: ' + data.error; return; }
        el.textContent = '今回の値を記録しました(前回からの変更 ' + (data.diffs ? data.diffs.length : 0) + '件)';
      })
      .catch(function (err) { document.getElementById('health-log').textContent = '記録に失敗: ' + String(err); });
  }
  function prevSince() {
    return prevSnapshot && prevSnapshot.savedAt ? '前回(' + prevSnapshot.savedAt.replace('T', ' ').slice(0, 16) + ' UTC)から' : '';
  }

  // 各セクションの開閉をブラウザに覚えさせる(保存できない環境でも表示は既定のまま動く)
  document.querySelectorAll('details[data-section]').forEach(function (d) {
    var key = 'cf-containers:open:' + d.getAttribute('data-section');
    try {
      var saved = localStorage.getItem(key);
      if (saved !== null) d.open = saved === '1';
    } catch (e) {}
    d.addEventListener('toggle', function () {
      try { localStorage.setItem(key, d.open ? '1' : '0'); } catch (e) {}
    });
  });
</script>
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
    if (sleepAfterValue && !sleepAfterShown && data.sleepAfter) {
      sleepAfterValue.textContent = formatSleepAfter(data.sleepAfter);
      sleepAfterShown = true;
    }
    if (data.cost) {
      costSummary.textContent =
        '累計接続時間: ' + formatHms(data.cost.cumulativeConnectedSeconds) +
        ' / 予定支出(概算、無料枠未考慮): $' + data.cost.estimatedCostUsd.toFixed(4) +
        (data.cost.cumulativeConnectedSeconds > 0
          ? ' / 実質時間単価(総経費÷総接続時間): $' + (data.cost.estimatedCostUsd / (data.cost.cumulativeConnectedSeconds / 3600)).toFixed(5) + '/時間'
          : '');
      renderCostDiff(data.cost);
    }
    if (typeof data.running === 'boolean') saveSnapshot({ running: data.running });
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
      .then(readJsonOrText)
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
      .then(readJsonOrText)
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

  // JSON以外(例: コンテナ停止中のHTTP 500のテキスト)が返っても、Safariの
  // "The string did not match the expected pattern" ではなく本文をそのまま見せる
  function readJsonOrText(res) {
    return res.text().then(function (text) {
      try { return JSON.parse(text); } catch (e) {
        throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 300));
      }
    });
  }

  function badge(ok) {
    return '<span class="badge" data-ok="' + (ok ? 'true' : 'false') + '">' + (ok ? 'OK' : 'NG') + '</span>';
  }

  // 版の判定: ok=想定どおり(緑)、warn=想定と違う(黄)、ng=無い・最低版より古い(赤)
  var VERSION_LABELS = { ok: 'OK', warn: '想定と違う', ng: 'NG' };
  // 版を数値の並びとして比べる(server.jsのcompareVersionsと同じ考え方)
  function compareVer(a, b) {
    var pa = String(a).split(/[^0-9]+/).filter(Boolean).map(Number);
    var pb = String(b).split(/[^0-9]+/).filter(Boolean).map(Number);
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  }
  var latestVersions = null;
  var lastVersions = null;
  function loadLatestVersions(versions) {
    var node = (versions.items || []).filter(function (v) { return v.name === 'node'; })[0];
    var major = node && node.actual ? String(node.actual).split('.')[0] : '26';
    var current = (versions.items || []).filter(function (v) { return v.actual; })
      .map(function (v) { return v.name + ':' + v.actual; }).join(',');
    fetch('/api/cf-containers/latest-versions?nodeMajor=' + encodeURIComponent(major) + '&current=' + encodeURIComponent(current))
      .then(readJsonOrText)
      .then(function (data) { latestVersions = data.latest || null; renderVersions(lastVersions); })
      .catch(function (err) { latestVersions = { _error: String(err) }; renderVersions(lastVersions); });
  }
  function renderVersions(versions) {
    lastVersions = versions;
    var table = document.getElementById('version-table');
    var tbody = document.getElementById('version-tbody');
    tbody.innerHTML = '';
    if (!versions || !versions.items) { table.hidden = true; return; }
    versions.items.forEach(function (v) {
      var tr = document.createElement('tr');
      var prevVersions = (prevSnapshot && prevSnapshot.versions) || {};
      var before = prevVersions[v.name];
      var changed = before !== undefined && before !== v.actual;
      var cells = [v.name, v.actual || '(取得できず)', before === undefined ? '-' : (before || '(取得できず)'), v.expected || (v.minimum ? v.minimum + '以上' : '-')];
      cells.forEach(function (text, i) {
        var td = document.createElement('td');
        td.textContent = text;
        if (i === 1 || i === 2) td.className = changed ? 'diff-up' : '';
        tr.appendChild(td);
      });
      var tdLevel = document.createElement('td');
      var span = document.createElement('span');
      span.className = 'badge';
      span.setAttribute('data-level', v.level);
      span.textContent = VERSION_LABELS[v.level] || v.level;
      span.title = v.raw || '';
      tdLevel.appendChild(span);
      tr.appendChild(tdLevel);
      // 今の版のリリース日(配布元から取れたもの。aptで入れるものは「-」)
      var info = latestVersions && latestVersions[v.name];
      var tdCurDate = document.createElement('td');
      tdCurDate.textContent = !latestVersions ? '確認中…' : (info && info.currentDate) ? info.currentDate : '-';
      tr.appendChild(tdCurDate);
      // 配布元に新しい版があれば黄のバッジ(aptで入れるものは対象外で「-」)
      var tdLatest = document.createElement('td');
      if (!latestVersions) {
        tdLatest.textContent = '確認中…';
      } else if (!info) {
        tdLatest.textContent = '-';
      } else if (!info.latest) {
        tdLatest.textContent = '取得できず';
        tdLatest.title = (info.source || '') + ': ' + (info.error || '');
      } else if (v.actual && compareVer(info.latest, v.actual) > 0) {
        var nb = document.createElement('span');
        nb.className = 'badge';
        nb.setAttribute('data-level', 'warn');
        nb.textContent = '新版あり ' + info.latest;
        nb.title = info.source;
        tdLatest.appendChild(nb);
        if (info.latestDate) tdLatest.appendChild(document.createTextNode(' (' + info.latestDate + ')'));
      } else {
        tdLatest.textContent = info.latest + (info.latestDate ? ' (' + info.latestDate + ')' : '');
        tdLatest.title = info.source;
      }
      tr.appendChild(tdLatest);
      tbody.appendChild(tr);
    });
    table.hidden = false;
    var snap = {};
    versions.items.forEach(function (v) { snap[v.name] = v.actual; });
    saveSnapshot({ versions: snap });
  }

  // 累計接続時間・予定支出の前回表示時からの増分
  function renderCostDiff(cost) {
    if (!prevSnapshotLoaded) { onPrevSnapshotLoaded.push(function () { renderCostDiff(cost); }); return; }
    var el = document.getElementById('cost-diff');
    var prev = prevSnapshot && prevSnapshot.cost;
    if (prev) {
      var dSec = cost.cumulativeConnectedSeconds - prev.cumulativeConnectedSeconds;
      var dUsd = cost.estimatedCostUsd - prev.estimatedCostUsd;
      el.className = dSec > 0 || dUsd > 0 ? 'diff-up' : 'diff-same';
      el.textContent = prevSince() + ': 接続時間 +' + formatHms(Math.max(0, dSec)) + ' / 支出 +$' + Math.max(0, dUsd).toFixed(4);
    } else {
      el.className = 'diff-same';
      el.textContent = '(前回の記録なし。ヘルスチェックを実行すると記録され、次回から差分を表示します)';
    }
    saveSnapshot({ cost: { cumulativeConnectedSeconds: cost.cumulativeConnectedSeconds, estimatedCostUsd: cost.estimatedCostUsd } });
  }

  // どのコミット・ビルドから作ったイメージかを表示する(build-info.json)
  function renderBuild(build) {
    var el = document.getElementById('image-build');
    if (!build) { el.hidden = true; return; }
    el.textContent = build.error
      ? 'イメージのビルド情報: 取得できず(' + build.error + ')'
      : 'イメージ: commit ' + String(build.commit || '?').slice(0, 7) + ' / branch ' + (build.branch || '?') +
        ' / build ' + (build.buildUuid || '?') + ' / 作成 ' + (build.builtAt || '?');
    var prevCommit = prevSnapshot && prevSnapshot.commit;
    if (!build.error && prevCommit && prevCommit !== build.commit) {
      el.textContent += '(' + prevSince() + '変更: ' + String(prevCommit).slice(0, 7) + ' → ' + String(build.commit).slice(0, 7) + ')';
      el.className = 'diff-up';
    } else {
      el.className = '';
    }
    if (!build.error) saveSnapshot({ commit: build.commit });
    el.hidden = false;
  }

  // 6時間レポートのSlack通知のON/OFF(D1に保存)
  var reportToggle = document.getElementById('report-slack-toggle');
  var reportLog = document.getElementById('report-slack-log');
  fetch('/api/cf-containers/report-settings')
    .then(readJsonOrText)
    .then(function (data) {
      if (data.error) { reportLog.textContent = 'エラー: ' + data.error; return; }
      reportToggle.checked = !!data.slackEnabled;
      reportToggle.disabled = false;
    })
    .catch(function (err) { reportLog.textContent = 'エラー: ' + String(err); });
  reportToggle.addEventListener('change', function () {
    reportToggle.disabled = true;
    fetch('/api/cf-containers/report-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slackEnabled: reportToggle.checked })
    })
      .then(readJsonOrText)
      .then(function (data) {
        if (data.error) { reportLog.textContent = 'エラー: ' + data.error; reportToggle.checked = !reportToggle.checked; return; }
        reportLog.textContent = data.slackEnabled ? 'ONにしました(次回の6時間cronから送ります)' : 'OFFにしました(D1への記録は続けます)';
      })
      .catch(function (err) { reportLog.textContent = 'エラー: ' + String(err); reportToggle.checked = !reportToggle.checked; })
      .finally(function () { reportToggle.disabled = false; });
  });

  var btnHealth = document.getElementById('btn-health');
  var healthTable = document.getElementById('health-table');
  var healthLog = document.getElementById('health-log');
  btnHealth.addEventListener('click', function () {
    btnHealth.disabled = true;
    healthLog.textContent = '確認中…(コンテナが停止中の場合は起動を待ちます)';
    fetch('/cf-containers/proxy/health')
      .then(readJsonOrText)
      .then(function (data) {
        document.getElementById('health-apache').innerHTML = badge(data.apache);
        document.getElementById('health-sshd').innerHTML = badge(data.sshd);
        document.getElementById('health-cloudflared').innerHTML = badge(data.cloudflared);
        document.getElementById('health-tailscale').innerHTML = badge(data.tailscale);
        document.getElementById('health-docker').innerHTML = badge(data.docker);
        document.getElementById('health-time').textContent = data.checkedAt || '';
        healthTable.hidden = false;
        latestVersions = null;
        renderVersions(data.versions);
        if (data.versions && data.versions.items) loadLatestVersions(data.versions);
        renderBuild(data.build);
        recordSnapshotToServer();
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
      .then(readJsonOrText)
      .then(function (data) {
        netLog.textContent = '[ip addr]\\n' + (data.addr || '') + '\\n\\n[ip route]\\n' + (data.route || '')
          + '\\n\\n[/etc/resolv.conf]\\n' + (data.dns || '') + '\\n\\n[ss -tulpn]\\n' + (data.netstat || '')
          + '\\n\\n[netstat -tunap]\\n' + (data.netstatLegacy || '') + '\\n\\n[top]\\n' + (data.top || '')
          + '\\n\\n[dig 既定DNS region1.v2.argotunnel.com]\\n' + (data.digDefault || '') + '\\n\\n[dig @1.1.1.1 region1.v2.argotunnel.com]\\n' + (data.digV4 || '')
          + '\\n\\n[dig @1.1.1.1 controlplane.tailscale.com]\\n' + (data.digTailscale || '') + '\\n\\n[ping 1.1.1.1]\\n' + (data.ping || '')
          + '\\n\\n[whois nekomaneki.work]\\n' + (data.whois || '')
          + '\\n\\n[ファイアウォール: 送信元・逆引き・WHOIS・CIDR集計]\\n' + JSON.stringify(data.firewallStats || {}, null, 2)
          + '\\n\\n[nft ruleset / counters]\\n' + (data.nftRuleset || '')
          + '\\n\\n[drop log]\\n' + (data.dropLog || '');
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
      .then(readJsonOrText)
      .then(function (data) {
        if (data.error) { buildLogPre.textContent = 'エラー: ' + data.error; return; }
        buildLogPre.textContent = 'build=' + data.buildUuid + ' status=' + (data.status || '?') + '\\n\\n[直近のビルド]\\n' + (data.recentBuilds || []).join('\\n') + '\\n\\n[API応答の形]\\n' + (data.responseShape || []).join('\\n') + '\\n\\n' + (data.log || '(ログ空)');
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
      .then(readJsonOrText)
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
        var q = data.queriedWith || {};
        tunnelLog.textContent = data.tunnels && data.tunnels.length ? '' :
          '(トンネルが見つかりません: アカウント末尾' + (q.accountIdTail || '?') + '、トークン=' + (q.tokenSource || '?') + '。このアカウントに削除されていないトンネルが無いか、トンネルが別のアカウントにあります)';
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
      .then(readJsonOrText)
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
