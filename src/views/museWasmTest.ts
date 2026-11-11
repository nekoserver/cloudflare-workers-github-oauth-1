import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import { MUSE_STATUS_CSP } from './museStatus';

/**
 * /muse-wasm-test: テスト用ページ(ユーザー指定、2026-11-08)。
 * 1. 本体ワーカーのTailscaleノード(TAILSCALE_WASM、main-worker-muse)で、muse-vmの/healthへ届くかを定期的に確かめる
 *    (/api/tailscale-wasm/bridge-health・/status)。以前はブラウザ自身をノードにしていたが、状態をメモリにしか持たず
 *    開くたびにログインが要ったため替えた。Workerのノードは状態をDOのSQLiteに保存し、認証キーで自動ログインする。
 * 2. 要望はWorkerのジョブ台帳(MuseAgentJobs、/api/tailscale-wasm/jobs)へ送る。DOのアラームが取り出し、
 *    WorkerのTailscale WASMノードがmuse-vmのMuseへ届ける。コンテナ上のエージェントは使わない(このWorkerの方針)。
 *    以前はD1 bridge_jobsに積んでいたが、それは本体コンテナのCLIが手動で片付ける前提で、積まれたまま止まっていた。
 * 3. muse-monitor経由のモニタ: 本体→muse-monitor→muse-vm(:8090)で15項目を読む(/api/muse-monitor/:section)。
 *
 * template literalに埋め込むため、バックスラッシュのエスケープと正規表現リテラルを使わない(CLAUDE.md ルール29)。
 * 上流の文字列(応答の本文・要望・結果)はtextContentで表示し、HTMLとして解釈しない。
 */
export const MUSE_WASM_TEST_CSP = MUSE_STATUS_CSP;

// muse-monitorのダッシュボード(src/index.ts SECTIONS)と同じ並びと見出し。
const MUSE_MONITOR_SECTION_LABELS: [string, string][] = [
  ['status', '状態(tailscaled / Bridge)'], ['diag', '診断サマリ'],
  ['sdkhealth', 'SDK ヘルス'], ['sdkprofiles', 'SDK プロファイル'], ['sdksessions', 'SDK セッション'], ['sdkts', 'SDK ヘルス(TypeScript)'],
  ['jobs', 'ジョブキュー'], ['pending', '承認待ち'], ['execlog', '実行監査ログ'],
  ['pkgs', 'パッケージ版数'], ['vm', 'VM 情報'], ['procs', 'プロセス上位'], ['ports', '待ち受けポート'], ['git', 'git 状態'], ['recent', '直近の完了ジョブ'],
];

export const MUSE_WASM_TEST_SCRIPT = `
    var MWT_DEFAULT_SECONDS = 30;
    var MWT_MIN_SECONDS = 10;
    var MWT_MAX_SECONDS = 3600;
    var MWT_LOG_MAX = 50;
    var MWT_NODE = 'muse-vm';

    var MWT_MON_SECTIONS = ${JSON.stringify(MUSE_MONITOR_SECTION_LABELS)};
    var MWT_MON_TITLES = {};
    MWT_MON_SECTIONS.forEach(function(pair) { MWT_MON_TITLES[pair[0]] = pair[1]; });
    function mwtIsTailscaleLoginURL(value) {
      var url;
      try { url = new URL(value); } catch (e) { return false; }
      return url.protocol === 'https:' && !url.username && !url.password
        && (url.hostname === 'login.tailscale.com' || url.hostname.slice(-14) === '.tailscale.com');
    }

    /** netmapからmuse-vmのIPv4を取り出す。nameはFQDNなので先頭のラベルで比べる。 */
    function mwtMuseVmFromNetMap(value) {
      var map = typeof value === 'string' ? JSON.parse(value) : value;
      var peers = (map && Array.isArray(map.peers)) ? map.peers : [];
      for (var i = 0; i < peers.length; i++) {
        var peer = peers[i] || {};
        if (String(peer.name || '').split('.')[0] !== MWT_NODE) continue;
        var addresses = Array.isArray(peer.addresses) ? peer.addresses : [];
        var ip = '';
        for (var j = 0; j < addresses.length; j++) {
          var address = String(addresses[j]).split('/')[0];
          if (address.indexOf('.') !== -1) { ip = address; break; }
        }
        return { found: true, ip: ip, online: peer.online === true ? true : (peer.online === false ? false : null) };
      }
      return { found: false, ip: '', online: null };
    }

    function mwtFormatTime(ms) {
      try { return new Date(ms).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false }); } catch (e) { return String(ms); }
    }

    function initMuseWasmTest(deps) {
      var doc = deps.document;
      var el = function(id) { return doc.getElementById(id); };
      var state = { timer: null, seconds: MWT_DEFAULT_SECONDS, checking: null };

      function setText(id, text) { el(id).textContent = text; }
      function stopSchedule() {
        if (state.timer !== null) { deps.clearInterval(state.timer); state.timer = null; }
      }
      function startSchedule() {
        stopSchedule();
        state.timer = deps.setInterval(checkAll, state.seconds * 1000);
      }

      function addLog(startedAt, ok, result, detail, ms) {
        var tbody = el('mwt-log');
        var row = doc.createElement('tr');
        [mwtFormatTime(startedAt), 'Workerのノード → ' + MWT_NODE + ':8080/health', result, detail, String(ms) + 'ms'].forEach(function(value) {
          var cell = doc.createElement('td'); cell.textContent = value; row.appendChild(cell);
        });
        if (!ok) row.className = 'mwt-ng';
        tbody.insertBefore(row, tbody.firstChild);
        while (tbody.children.length > MWT_LOG_MAX) tbody.removeChild(tbody.lastChild);
      }

      function describeNode(status) {
        if (!status || typeof status !== 'object') return 'ノードの状態を読めませんでした';
        if (status.error) return 'ノードの状態: ' + status.error;
        var node = mwtMuseVmFromNetMap(status);
        var text = 'ノード: ' + (status.state || '不明') + ' / ';
        if (!node.found) return text + 'ピアにmuse-vmが見つかりません';
        return text + 'muse-vm ' + (node.ip || '(IPv4なし)') + ' ' + (node.online === true ? 'オンライン' : node.online === false ? 'オフライン' : 'オンライン表示なし');
      }

      function renderLogin(status) {
        var box = el('mwt-login');
        box.textContent = '';
        if (!status || status.state === 'Running' || !mwtIsTailscaleLoginURL(status.loginURL)) return;
        var link = doc.createElement('a');
        link.href = status.loginURL;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Workerのノードを承認する(一度承認すれば状態はWorkerに保存され、以後ログインは要りません)';
        box.appendChild(link);
      }

      function checkAll() {
        if (state.checking) return state.checking;
        var startedAt = deps.now();
        var started = Date.now();
        setText('mwt-state', '確認中…');
        state.checking = Promise.all([
          deps.fetchJson('/api/tailscale-wasm/bridge-health'),
          deps.fetchJson('/api/tailscale-wasm/status')
        ]).then(function(results) {
          var health = results[0] || {};
          var status = results[1];
          var ok = health.healthy === true;
          var detail = describeNode(status) + (health.error ? ' / ' + health.error : '');
          addLog(startedAt, ok, ok ? '200 OK' : '届かない', detail, Date.now() - started);
          setText('mwt-state', ok ? '届いています' : '届いていません');
          renderLogin(status);
        }).catch(function(error) {
          addLog(startedAt, false, '失敗', error && error.message ? error.message : String(error), Date.now() - started);
          setText('mwt-state', '確認できませんでした');
        }).then(function() { state.checking = null; });
        return state.checking;
      }

      function applyInterval() {
        var input = el('mwt-interval');
        var seconds = Number(input.value);
        if (!(seconds >= MWT_MIN_SECONDS && seconds <= MWT_MAX_SECONDS && Math.floor(seconds) === seconds)) {
          setText('mwt-interval-error', MWT_MIN_SECONDS + '〜' + MWT_MAX_SECONDS + 'の整数で入力してください');
          return;
        }
        setText('mwt-interval-error', '');
        state.seconds = seconds;
        if (state.timer !== null) startSchedule();
      }

      var MWT_JOBS_URL = '/api/tailscale-wasm/jobs';
      var MWT_PENDING = { queued: true, sending: true };
      var jobPoll = null;
      var listShown = false;
      var toast = { enabled: true, messageId: null, startedAt: 0, timer: null };

      function mwtSecondsBetween(from, to) {
        var a = Date.parse(from), b = Date.parse(to);
        if (!(a >= 0) || !(b >= 0)) return null;
        return Math.max(0, Math.round((b - a) / 1000));
      }
      /** 受付から終了までにかかった時間。サーバーの記録(queuedAt・startedAt・finishedAt)から作る。 */
      function mwtTimingText(message) {
        var total = message.finishedAt ? mwtSecondsBetween(message.queuedAt, message.finishedAt) : null;
        if (total !== null) {
          var waited = message.startedAt ? mwtSecondsBetween(message.queuedAt, message.startedAt) : null;
          var sent = message.startedAt ? mwtSecondsBetween(message.startedAt, message.finishedAt) : null;
          return '合計 ' + total + '秒' + (waited !== null && sent !== null ? '(送信待ち ' + waited + '秒・送信 ' + sent + '秒)' : '');
        }
        if (message.state === 'queued') return '送信待ち';
        if (message.state === 'sending') return '送信中';
        return '';
      }
      function mwtStateClass(state) {
        if (state === 'sending') return 'mwt-blink';
        if (state === 'done') return 'mwt-ok';
        if (state === 'failed' || state === 'delivery_unknown') return 'mwt-bad';
        return '';
      }
      /** 開いているposition:fixedの要素より手前に出すz-index(CLAUDE.md ルール26)。 */
      function mwtNextZ() {
        var max = 0;
        var view = doc.defaultView;
        var nodes = doc.querySelectorAll('body *');
        for (var i = 0; i < nodes.length; i++) {
          var style = view && view.getComputedStyle ? view.getComputedStyle(nodes[i]) : null;
          if (!style || (style.position !== 'fixed' && style.position !== 'sticky')) continue;
          var z = parseInt(style.zIndex, 10);
          if (z > max) max = z;
        }
        return max + 100;
      }
      function toastSeconds() { return Math.max(0, Math.floor((deps.now() - toast.startedAt) / 1000)); }
      function stopToastTimer() {
        if (toast.timer !== null) { deps.clearInterval(toast.timer); toast.timer = null; }
      }
      function hideToast() {
        stopToastTimer();
        toast.messageId = null;
        el('mwt-toast').hidden = true;
      }
      function showToast(className, text) {
        var box = el('mwt-toast');
        box.className = 'mwt-toast ' + className;
        box.textContent = text;
        if (box.hidden) { box.style.zIndex = String(mwtNextZ()); box.hidden = false; }
      }
      function tickToast(state) {
        showToast('mwt-toast-run mwt-toast-blink', '送信中(' + (state || 'queued') + ')… ' + toastSeconds() + '秒経過');
      }
      function startToast(messageId) {
        if (!toast.enabled) return;
        stopToastTimer();
        toast.messageId = messageId;
        toast.startedAt = deps.now();
        toast.state = 'queued';
        tickToast(toast.state);
        toast.timer = deps.setInterval(function() { tickToast(toast.state); }, 1000);
      }
      function followToast(message) {
        if (!toast.enabled || toast.timer === null) return;
        var state = message.state;
        toast.state = state;
        // 終わったときの秒数は、サーバーの記録(受付から終了まで)があればそれを使う。無ければこのページで数えた秒数。
        var total = message.finishedAt ? mwtSecondsBetween(message.queuedAt, message.finishedAt) : null;
        var seconds = total !== null ? total : toastSeconds();
        if (state === 'done') { stopToastTimer(); showToast('mwt-toast-ok', '合格(' + seconds + '秒)'); }
        else if (state === 'failed' || state === 'delivery_unknown') { stopToastTimer(); showToast('mwt-toast-bad', '失敗(' + seconds + '秒、' + state + ')'); }
        else tickToast(state);
      }
      function toggleList() {
        listShown = !listShown;
        el('mwt-jobs-list').hidden = !listShown;
        el('mwt-jobs-toggle').textContent = listShown ? '一覧を隠す' : '一覧を表示';
        el('mwt-jobs-toggle').setAttribute('aria-expanded', listShown ? 'true' : 'false');
        if (listShown) return loadJobs();
        return Promise.resolve();
      }
      function stopJobPoll() {
        if (jobPoll !== null) { deps.clearInterval(jobPoll); jobPoll = null; }
      }
      function renderJobs(jobs) {
        var tbody = el('mwt-jobs');
        tbody.textContent = '';
        var pending = false;
        var rows = [];
        jobs.forEach(function(job) {
          (job.messages || []).forEach(function(message) {
            if (MWT_PENDING[message.state]) pending = true;
            rows.push([job.createdAt + ' ' + message.messageId, message.prompt, { text: message.state + (message.error ? ' ' + message.error : ''), className: mwtStateClass(message.state) }, message.reply === null || message.reply === undefined ? '' : message.reply, mwtTimingText(message)]);
            if (toast.messageId === message.messageId) followToast(message);
          });
        });
        if (!rows.length) {
          var empty = doc.createElement('tr');
          var cell = doc.createElement('td');
          cell.colSpan = 5;
          cell.textContent = 'まだ要望はありません';
          empty.appendChild(cell);
          tbody.appendChild(empty);
        }
        rows.forEach(function(values) {
          var row = doc.createElement('tr');
          values.forEach(function(value, index) {
            var td = doc.createElement('td');
            td.textContent = value.text === undefined ? value : value.text;
            if (index === 2 && value.className) td.className = value.className;
            row.appendChild(td);
          });
          tbody.appendChild(row);
        });
        return pending;
      }
      function loadJobs() {
        return deps.fetchJson(MWT_JOBS_URL).then(function(data) {
          if (data && Array.isArray(data.jobs)) {
            setText('mwt-jobs-error', '');
            if (!renderJobs(data.jobs)) stopJobPoll();
          } else setText('mwt-jobs-error', (data && data.error) || '一覧を読めませんでした');
        }).catch(function(error) { setText('mwt-jobs-error', '一覧を読めませんでした: ' + (error && error.message ? error.message : String(error))); });
      }
      function startJobPoll() {
        if (jobPoll === null) jobPoll = deps.setInterval(function() { loadJobs(); }, 5000);
      }
      function submitJob() {
        var input = el('mwt-request');
        var text = input.value.trim();
        if (!text) { setText('mwt-submit-result', '要望を入力してください'); return Promise.resolve(); }
        el('mwt-submit').disabled = true;
        setText('mwt-submit-result', '送信中…');
        var requestId = 'mwt-' + deps.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        return deps.fetchJson(MWT_JOBS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: requestId, prompt: text })
        }).then(function(data) {
          if (data && data.ok && typeof data.messageId === 'string') {
            setText('mwt-submit-result', '受け付けました: ' + data.messageId + '(Workerがmuse-vmのMuseへ送ります)');
            input.value = '';
            startToast(data.messageId);
            startJobPoll();
            return loadJobs();
          }
          setText('mwt-submit-result', '送れませんでした: ' + ((data && (data.error || data.detail)) || '理由が返りませんでした'));
        }).catch(function(error) {
          setText('mwt-submit-result', '送れませんでした: ' + (error && error.message ? error.message : String(error)));
        }).then(function() { el('mwt-submit').disabled = false; });
      }
      function monText(data) {
        if (data && typeof data.errorCode === 'string') {
          return { ok: false, text: 'エラー(' + data.errorCode + (data.upstreamStatus ? ', HTTP ' + data.upstreamStatus : '') + '): ' + (data.error || '理由が返りませんでした') };
        }
        if (data && data.body !== undefined) {
          var body = data.body;
          var ok = data.status === 200;
          var text;
          if (body && typeof body.output === 'string') text = body.output + (body.truncated ? ' …(続きは省略)' : '');
          else if (body && typeof body.error === 'string') text = body.error + (body.message ? ': ' + body.message : '');
          else text = JSON.stringify(body, null, 2);
          return { ok: ok, text: 'HTTP ' + data.status + ' ' + text };
        }
        return { ok: false, text: '予期しない応答: ' + JSON.stringify(data) };
      }
      function addMonRow(section, startedAt, outcome) {
        var row = doc.createElement('tr');
        if (!outcome.ok) row.className = 'mwt-ng';
        [mwtFormatTime(startedAt), (MWT_MON_TITLES[section] || section) + ' (' + section + ')', outcome.ok ? 'OK' : 'NG', outcome.text].forEach(function(value) {
          var cell = doc.createElement('td');
          cell.textContent = value;
          row.appendChild(cell);
        });
        var tbody = el('mwt-mon-log');
        tbody.insertBefore(row, tbody.firstChild);
      }
      function monGet(section) {
        var startedAt = deps.now();
        return deps.fetchJson('/api/muse-monitor/' + encodeURIComponent(section)).then(function(data) {
          addMonRow(section, startedAt, monText(data));
        }).catch(function(error) {
          addMonRow(section, startedAt, { ok: false, text: '取得できませんでした: ' + (error && error.message ? error.message : String(error)) });
        });
      }
      function monAll() {
        return Promise.all(MWT_MON_SECTIONS.map(function(pair) { return monGet(pair[0]); }));
      }

      el('mwt-interval').value = String(MWT_DEFAULT_SECONDS);
      el('mwt-check-now').addEventListener('click', function() { checkAll(); });
      el('mwt-interval').addEventListener('change', applyInterval);
      el('mwt-submit').addEventListener('click', function() { submitJob(); });
      el('mwt-jobs-toggle').addEventListener('click', function() { toggleList(); });
      el('mwt-toast-enabled').addEventListener('change', function() {
        toast.enabled = el('mwt-toast-enabled').checked;
        if (!toast.enabled) hideToast();
      });
      el('mwt-toast').addEventListener('click', function() { if (toast.timer === null) hideToast(); });
      MWT_MON_SECTIONS.forEach(function(pair) {
        var option = doc.createElement('option');
        option.value = pair[0];
        option.textContent = pair[1] + ' (' + pair[0] + ')';
        el('mwt-mon-section').appendChild(option);
      });
      el('mwt-mon-get').addEventListener('click', function() { monGet(el('mwt-mon-section').value); });
      el('mwt-mon-all').addEventListener('click', function() { monAll(); });
      startSchedule();
      checkAll();
      return loadJobs();
    }
`;

export function getMuseWasmTestPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Muse WASMテスト</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    body { margin: 0; background: var(--bg-secondary); color: var(--text-primary); font-family: system-ui, sans-serif; line-height: 1.6; }
    .mwt-nav { position: sticky; top: 0; z-index: 10; box-sizing: border-box; height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 16px; background: var(--card-bg); border-bottom: 1px solid var(--border-color); }
    .mwt-nav a { color: var(--text-primary); }
    .mwt-nav-end { margin-left: auto; display: flex; align-items: center; }
    main { max-width: 1000px; margin: 0 auto; padding: 16px; display: grid; gap: 16px; }
    section { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 16px; }
    h1 { font-size: 20px; margin: 4px 0; }
    h2 { font-size: 16px; margin: 0 0 8px; }
    .mwt-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 6px 0; }
    .mwt-meta { color: var(--text-secondary); font-size: 13px; }
    .mwt-error { color: var(--danger-color); font-size: 13px; }
    .mwt-scroll { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border-bottom: 1px solid var(--border-color); padding: 4px 6px; text-align: left; vertical-align: top; white-space: pre-wrap; word-break: break-word; }
    tr.mwt-ng td { color: var(--danger-color); }
    .mwt-ok { color: var(--success-color); font-weight: 600; }
    .mwt-bad { color: var(--danger-color); font-weight: 600; }
    .mwt-blink { animation: mwt-blink 1s step-start infinite; }
    @keyframes mwt-blink { 50% { opacity: 0.25; } }
    @media (prefers-reduced-motion: reduce) { .mwt-blink { animation: none; text-decoration: underline; } }
    .mwt-toast { position: fixed; top: 12vh; left: 50%; transform: translateX(-50%); max-width: min(90vw, 480px); padding: 10px 18px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-primary); box-shadow: 0 6px 20px color-mix(in srgb, var(--text-primary) 25%, transparent); font-weight: 600; text-align: center; cursor: default; }
    .mwt-toast[hidden] { display: none; }
    .mwt-toast-blink { animation: mwt-blink 1s step-start infinite; }
    @media (prefers-reduced-motion: reduce) { .mwt-toast-blink { animation: none; } }
    .mwt-toast-ok { background: color-mix(in srgb, var(--success-color) 22%, var(--card-bg)); border-color: var(--success-color); cursor: pointer; }
    .mwt-toast-bad { background: color-mix(in srgb, var(--danger-color) 18%, var(--card-bg)); border-color: var(--danger-color); cursor: pointer; }
    textarea { width: 100%; box-sizing: border-box; min-height: 90px; font: inherit; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 6px; }
    input[type=number] { width: 6em; }
  </style>
</head>
<body>
  <nav class="mwt-nav"><a href="/muse-status">← Museの状態</a><span class="mwt-nav-end">${getThemeToggleHTML()}</span></nav>
  <main>
    <h1>Muse WASMテスト</h1>
    <section>
      <h2>Workerのノードからmuse-vmへの到達</h2>
      <p class="mwt-meta">本体ワーカーのTailscaleノード(main-worker-muse)で、muse-vmの/healthへ定期的に届くかを確かめます。ノードの状態はWorker(Durable Object)に保存され、シークレットの認証キーで自動的にログインし直すので、このページでのログインは要りません。</p>
      <p class="mwt-row"><button type="button" id="mwt-check-now">今すぐ確認</button>
        <span id="mwt-state" class="mwt-meta">未確認</span></p>
      <p class="mwt-row" id="mwt-login"></p>
      <p class="mwt-row"><label>確認の間隔(秒) <input type="number" id="mwt-interval" min="10" max="3600" step="1"></label>
        <span id="mwt-interval-error" class="mwt-error" role="alert"></span></p>
      <div class="mwt-scroll"><table><thead><tr><th scope="col">時刻</th><th scope="col">経路</th><th scope="col">結果</th><th scope="col">状態・理由</th><th scope="col">所要</th></tr></thead><tbody id="mwt-log"></tbody></table></div>
    </section>
    <section>
      <h2>muse-monitor経由のモニタ</h2>
      <p class="mwt-meta">本体ワーカーがService Binding(MUSE_MONITOR)とHMAC署名(MONITOR_HMAC_SECRET)でmuse-monitorを呼び、muse-monitorがTailscale WASMノードでmuse-vmの受信側(:8090)から読み取ります。このブラウザのTailscale接続は使いません。</p>
      <p class="mwt-row"><label>項目 <select id="mwt-mon-section"></select></label>
        <button type="button" id="mwt-mon-get">取得</button>
        <button type="button" id="mwt-mon-all">全て取得</button></p>
      <div class="mwt-scroll"><table><thead><tr><th scope="col">時刻</th><th scope="col">項目</th><th scope="col">結果</th><th scope="col">内容・理由</th></tr></thead><tbody id="mwt-mon-log"></tbody></table></div>
    </section>
    <section>
      <h2>要望を渡す</h2>
      <p class="mwt-meta">要望はWorkerのジョブ台帳(MuseAgentJobs)に積まれ、WorkerのTailscale WASMノードがmuse-vmのMuseへ送ります。コンテナ上のエージェントは使いません。処理中は5秒ごとに一覧を読み直します。</p>
      <textarea id="mwt-request" aria-label="要望" maxlength="8000" placeholder="例: muse-monitorの状態を確認して"></textarea>
      <p class="mwt-row"><button type="button" id="mwt-submit">送る</button>
        <label><input type="checkbox" id="mwt-toast-enabled" checked> 結果をトースト表示</label></p>
      <p id="mwt-submit-result" class="mwt-meta" role="status"></p>
      <p class="mwt-row"><button type="button" id="mwt-jobs-toggle" aria-expanded="false" aria-controls="mwt-jobs-list">一覧を表示</button><span id="mwt-jobs-error" class="mwt-error"></span></p>
      <div class="mwt-scroll" id="mwt-jobs-list" hidden><table><thead><tr><th scope="col">登録・message id</th><th scope="col">要望</th><th scope="col">状態</th><th scope="col">Museの返事</th><th scope="col">かかった時間</th></tr></thead><tbody id="mwt-jobs"></tbody></table></div>
    </section>
  </main>
  <div id="mwt-toast" class="mwt-toast" role="status" aria-live="polite" hidden></div>
  <script>${getThemeToggleScript()}</script>
  <script>${MUSE_WASM_TEST_SCRIPT}</script>
  <script type="module">
    initMuseWasmTest({
      document: document,
      fetchJson: function(url, init) { return fetch(url, Object.assign({ credentials: 'same-origin' }, init || {})).then(function(res) { return res.json(); }); },
      setInterval: function(fn, ms) { return window.setInterval(fn, ms); },
      clearInterval: function(id) { window.clearInterval(id); },
      now: function() { return Date.now(); }
    });
  </script>
</body>
</html>`;
}
