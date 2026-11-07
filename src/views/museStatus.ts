import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import { MUSE_BRIDGE_NODE, MUSE_NODE_NAMES } from '../utils/museNodeStatus';

/** シグナル送信の既定の間隔(秒)。範囲は/aichatのシグナル送信と同じ。 */
export const MUSE_STATUS_SIGNAL_DEFAULT_SECONDS = 600;
const MUSE_STATUS_SIGNAL_MIN_SECONDS = 60;
const MUSE_STATUS_SIGNAL_MAX_SECONDS = 86_400;

/**
 * /muse-statusのページscript。依存を受け取る関数に分け、museStatus.test.tsで動かす。
 * 設定はCookieに保存し(ブラウザごと)、ページ読み込み時に画面へ反映する。
 * 上流から来た文字列はtextContentでしか表示しない。
 */
export const MUSE_STATUS_SCRIPT = `
    var MUSE_BRIDGE_NODE = ${JSON.stringify(MUSE_BRIDGE_NODE)};
    var MUSE_STATUS_COOKIE = 'muse_status_signal';
    var MUSE_STATUS_DEFAULT_SECONDS = ${MUSE_STATUS_SIGNAL_DEFAULT_SECONDS};
    var MUSE_STATUS_MIN_SECONDS = ${MUSE_STATUS_SIGNAL_MIN_SECONDS};
    var MUSE_STATUS_MAX_SECONDS = ${MUSE_STATUS_SIGNAL_MAX_SECONDS};
    var MUSE_SIGNAL_LABELS = {
      ok: ['稼働中', 'ok'],
      unhealthy: ['異常応答', 'ng'],
      not_applicable: ['対象外（外向き専用）', 'muted'],
      container_not_running: ['本体コンテナ停止中', 'muted'],
      not_authenticated: ['MUSE_API_KEY未設定', 'ng'],
      connection_failed: ['接続できません', 'ng'],
      timeout: ['応答なし(時間切れ)', 'ng']
    };
    var MUSE_NIX_MESSAGES = {
      not_applicable: 'museは外向き専用のため、HTTPで一覧を取得しません。ブリッジの一覧はmuse-vmで確認してください',
      not_provided: 'このノードは /nix/packages を提供していません',
      container_not_running: '本体コンテナが停止中のため取得できません',
      not_authenticated: 'MUSE_API_KEYが未設定です',
      auth_failed: 'ノードがキーを拒否しました',
      connection_failed: 'ノードへ接続できません',
      timeout: '時間内に応答がありませんでした',
      invalid_response: 'ノードの応答を読み取れませんでした'
    };
    var MUSE_NODES_ERRORS = {
      container_not_running: '本体コンテナが停止中です。ここからは起動しません。/cf-containers から起動してください',
      tailscale_unavailable: '本体コンテナからtailscaleの状態を読めません',
      timeout: '本体コンテナから時間内に応答がありませんでした'
    };

    function isValidMuseStatusSeconds(seconds) {
      return typeof seconds === 'number' && Math.floor(seconds) === seconds
        && seconds >= MUSE_STATUS_MIN_SECONDS && seconds <= MUSE_STATUS_MAX_SECONDS;
    }

    function normalizeMuseStatusSettings(value) {
      var settings = (value && typeof value === 'object') ? value : {};
      return {
        enabled: settings.enabled !== false,
        intervalSeconds: isValidMuseStatusSeconds(settings.intervalSeconds) ? settings.intervalSeconds : MUSE_STATUS_DEFAULT_SECONDS
      };
    }

    function readMuseStatusSettings(cookieText) {
      var prefix = MUSE_STATUS_COOKIE + '=';
      var parts = String(cookieText || '').split(';');
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (part.indexOf(prefix) !== 0) continue;
        try {
          return normalizeMuseStatusSettings(JSON.parse(decodeURIComponent(part.slice(prefix.length))));
        } catch (e) {
          break;
        }
      }
      return normalizeMuseStatusSettings(null);
    }

    function writeMuseStatusSettings(doc, settings) {
      doc.cookie = MUSE_STATUS_COOKIE + '=' + encodeURIComponent(JSON.stringify(settings)) + '; path=/; max-age=' + (60 * 60 * 24 * 365) + '; SameSite=Lax';
    }

    /** ONの間だけ送信間隔ごとにsendを呼ぶ。タブが隠れている間は送らず、戻ったときに間隔が空いていれば送る。 */
    function createMuseSignalSchedule(options) {
      var timer = null;
      var lastSentAt = null;
      function stop() {
        if (timer !== null) clearInterval(timer);
        timer = null;
      }
      function sendNow() {
        lastSentAt = Date.now();
        options.send();
      }
      function intervalMs() {
        return options.getSettings().intervalSeconds * 1000;
      }
      function apply() {
        stop();
        if (!options.getSettings().enabled) return;
        timer = setInterval(function() {
          if (!options.isHidden()) sendNow();
        }, intervalMs());
      }
      function checkIfDue() {
        if (!options.getSettings().enabled || options.isHidden()) return;
        if (lastSentAt === null || Date.now() - lastSentAt >= intervalMs()) sendNow();
      }
      return { apply: apply, stop: stop, checkIfDue: checkIfDue, markSent: function() { lastSentAt = Date.now(); } };
    }

    function formatMuseTime(value) {
      if (!value || /^0001-/.test(value)) return '—';
      var date = new Date(value);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
    }

    function setMuseBadge(element, label, kind) {
      element.textContent = label;
      element.className = 'muse-badge muse-badge-' + kind;
    }

    function renderMuseNode(doc, node) {
      var field = function(name) { return doc.querySelector('[data-node="' + node.name + '"] [data-field="' + name + '"]'); };
      var section = doc.querySelector('[data-node="' + node.name + '"]');
      if (section) section.setAttribute('data-tailnet-online', node.found && node.online ? 'true' : 'false');
      if (!node.found) setMuseBadge(field('online'), 'tailnetに見つかりません', 'muted');
      else setMuseBadge(field('online'), node.online ? 'オンライン' : 'オフライン', node.online ? 'ok' : 'ng');
      field('connection').textContent = node.found ? (node.connection === 'direct' ? '直接' : node.connection === 'relay' ? '中継 ' + node.relay : 'なし') : '—';
      field('os').textContent = node.os || '—';
      field('ip').textContent = node.ip || '—';
      field('lastSeen').textContent = node.online ? '接続中' : formatMuseTime(node.lastSeen);
      field('lastHandshake').textContent = formatMuseTime(node.lastHandshake);
    }

    function renderMuseSignal(doc, result) {
      var root = doc.querySelector('[data-node="' + result.node + '"]');
      var label = MUSE_SIGNAL_LABELS[result.code] || ['不明', 'muted'];
      setMuseBadge(root.querySelector('[data-field="signal"]'), label[0], label[1]);
      var detail = formatMuseTime(result.checkedAt);
      if (typeof result.latencyMs === 'number') detail += ' / ' + result.latencyMs + 'ms';
      root.querySelector('[data-field="signalAt"]').textContent = detail;
      // 接続できなかった理由(本体コンテナのtailscale ncのエラー出力)。上流の文字列なのでtextContentで表示する。
      var reason = root.querySelector('[data-field="signalDetail"]');
      var lines = [];
      if (result.code === 'connection_failed') {
        if (root.getAttribute('data-tailnet-online') === 'true') {
          lines.push('Tailscaleではオンラインです。ノードの8080番(/health)で待ち受けていないか、途中で切断された可能性があります。');
        }
        lines.push(typeof result.detail === 'string' && result.detail ? '理由: ' + result.detail : '理由: 本体コンテナから詳細を受け取れませんでした');
      }
      reason.textContent = lines.join(' ');
      reason.hidden = lines.length === 0;
    }

    function renderMuseNix(doc, result, filterText) {
      var root = doc.querySelector('[data-node="' + result.node + '"]');
      var summary = root.querySelector('[data-field="nixSummary"]');
      var body = root.querySelector('[data-field="nixRows"]');
      var wrapper = root.querySelector('[data-field="nixTable"]');
      body.textContent = '';
      if (result.state !== 'ok') {
        summary.textContent = MUSE_NIX_MESSAGES[result.state] || '取得できませんでした';
        wrapper.hidden = true;
        return;
      }
      var query = String(filterText || '').trim().toLowerCase();
      var rows = result.packages.filter(function(item) { return item.name.toLowerCase().indexOf(query) !== -1; });
      rows.forEach(function(item) {
        var row = doc.createElement('tr');
        var name = doc.createElement('td');
        var version = doc.createElement('td');
        name.textContent = item.name;
        version.textContent = item.version === null ? '—' : item.version;
        row.append(name, version);
        body.append(row);
      });
      wrapper.hidden = result.packages.length === 0;
      var text = result.total + '件' + (query ? '(一致 ' + rows.length + '件)' : '');
      if (result.truncated) text += ' 先頭' + result.packages.length + '件のみ表示';
      if (result.generatedAt) text += ' / ノードの生成 ' + formatMuseTime(result.generatedAt);
      summary.textContent = text;
    }

    function initMuseStatusPage(deps) {
      var doc = deps.document;
      var nodes = deps.nodes;
      var nixResults = {};
      var settings = readMuseStatusSettings(doc.cookie);
      var enabledInput = doc.getElementById('muse-signal-enabled');
      var intervalInput = doc.getElementById('muse-signal-interval');
      var intervalError = doc.getElementById('muse-signal-error');
      var notice = doc.getElementById('muse-notice');
      var schedule = createMuseSignalSchedule({
        send: function() { refreshStatus(); sendAll(); },
        isHidden: function() { return doc.hidden; },
        getSettings: function() { return settings; }
      });

      function setNotice(text) {
        notice.textContent = text;
        notice.hidden = !text;
      }
      function refreshStatus() {
        return deps.fetchJson('/api/muse-status').then(function(data) {
          data.nodes.forEach(function(node) { renderMuseNode(doc, node); });
          setMuseBadge(doc.getElementById('muse-container'), data.containerRunning ? '起動中' : '停止中', data.containerRunning ? 'ok' : 'ng');
          doc.getElementById('muse-checked-at').textContent = formatMuseTime(data.checkedAt);
          setNotice(data.error ? (MUSE_NODES_ERRORS[data.error] || '状態を取得できませんでした') : '');
        }).catch(function() {
          setNotice('状態を取得できませんでした');
        });
      }
      function sendSignal(node) {
        if (node !== MUSE_BRIDGE_NODE) return Promise.resolve();
        var root = doc.querySelector('[data-node="' + node + '"]');
        var button = root.querySelector('[data-action="signal"]');
        button.disabled = true;
        return deps.fetchJson('/api/muse-status/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ node: node }) })
          .then(function(result) { renderMuseSignal(doc, result); })
          .catch(function() { renderMuseSignal(doc, { node: node, code: 'connection_failed', latencyMs: null, checkedAt: new Date().toISOString() }); })
          .then(function() { button.disabled = false; });
      }
      function sendAll() {
        return Promise.all(nodes.filter(function(node) { return node === MUSE_BRIDGE_NODE; }).map(sendSignal));
      }
      function loadNix(node) {
        var root = doc.querySelector('[data-node="' + node + '"]');
        if (node !== MUSE_BRIDGE_NODE) {
          renderMuseNix(doc, { node: node, state: 'not_applicable' }, '');
          return Promise.resolve();
        }
        root.querySelector('[data-field="nixSummary"]').textContent = '取得中…';
        return deps.fetchJson('/api/muse-status/nix?node=' + encodeURIComponent(node))
          .then(function(result) {
            nixResults[node] = result;
            renderMuseNix(doc, result, root.querySelector('[data-action="nixFilter"]').value);
          })
          .catch(function() {
            renderMuseNix(doc, { node: node, state: 'connection_failed' }, '');
          });
      }
      function saveSettings() {
        var seconds = Number(intervalInput.value);
        var enabled = enabledInput.checked;
        intervalInput.disabled = !enabled;
        if (enabled && !isValidMuseStatusSeconds(seconds)) {
          intervalError.textContent = MUSE_STATUS_MIN_SECONDS + '〜' + MUSE_STATUS_MAX_SECONDS + 'の整数で入力してください';
          return;
        }
        intervalError.textContent = '';
        settings = normalizeMuseStatusSettings({ enabled: enabled, intervalSeconds: isValidMuseStatusSeconds(seconds) ? seconds : settings.intervalSeconds });
        writeMuseStatusSettings(doc, settings);
        schedule.apply();
      }

      enabledInput.checked = settings.enabled;
      intervalInput.value = String(settings.intervalSeconds);
      intervalInput.disabled = !settings.enabled;
      enabledInput.addEventListener('change', saveSettings);
      intervalInput.addEventListener('change', saveSettings);
      nodes.forEach(function(node) {
        var root = doc.querySelector('[data-node="' + node + '"]');
        root.querySelector('[data-action="signal"]').addEventListener('click', function() { sendSignal(node); });
        root.querySelector('[data-action="nixReload"]').addEventListener('click', function() { loadNix(node); });
        root.querySelector('[data-action="nixFilter"]').addEventListener('input', function(event) {
          if (nixResults[node]) renderMuseNix(doc, nixResults[node], event.target.value);
        });
      });
      doc.getElementById('muse-refresh').addEventListener('click', refreshStatus);
      doc.addEventListener('visibilitychange', schedule.checkIfDue);

      var loading = [refreshStatus()].concat(nodes.map(loadNix));
      if (settings.enabled) { schedule.markSent(); loading.push(sendAll()); }
      schedule.apply();
      return Promise.all(loading);
    }
`;

function renderNodeCard(node: string): string {
  const bridge = node === MUSE_BRIDGE_NODE;
  return `<section class="muse-card" data-node="${node}">
      <h2>${node}</h2>
      <p class="muse-meta">${bridge ? 'HTTPブリッジ。8080番の応答を確認します。' : '組み込み側の外向き専用ノードです。着信を受けないため、Tailscaleの接続状態だけを表示します。'}</p>
      <table class="muse-facts"><tbody>
        <tr><th scope="row">tailnet</th><td><span class="muse-badge muse-badge-muted" data-field="online">確認中</span></td></tr>
        <tr><th scope="row">経路</th><td data-field="connection">—</td></tr>
        <tr><th scope="row">OS</th><td data-field="os">—</td></tr>
        <tr><th scope="row">Tailscale IP</th><td data-field="ip">—</td></tr>
        <tr><th scope="row">最終接続</th><td data-field="lastSeen">—</td></tr>
        <tr><th scope="row">最終ハンドシェイク</th><td data-field="lastHandshake">—</td></tr>
      </tbody></table>
      <h3>シグナル</h3>
      <p class="muse-row"><span class="muse-badge muse-badge-muted" data-field="signal">${bridge ? '未送信' : '対象外（外向き専用）'}</span>
        <span class="muse-meta" data-field="signalAt"></span>
        <button type="button" data-action="signal"${bridge ? '' : ' disabled'}>シグナルを送信</button></p>
      <p class="muse-meta muse-signal-detail" data-field="signalDetail" hidden></p>
      <h3>Nixのインストールパッケージ</h3>
      <p class="muse-row"><span class="muse-meta" data-field="nixSummary">取得中…</span>
        <button type="button" data-action="nixReload"${bridge ? '' : ' disabled'}>再取得</button></p>
      <input type="search" data-action="nixFilter" placeholder="パッケージ名で絞り込み" aria-label="${node}のパッケージ名で絞り込み"${bridge ? '' : ' disabled'}>
      <div class="muse-scroll" data-field="nixTable" hidden><table><thead><tr><th scope="col">パッケージ</th><th scope="col">バージョン</th></tr></thead><tbody data-field="nixRows"></tbody></table></div>
    </section>`;
}

export function getMuseStatusPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Museの状態</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    body { margin: 0; background: var(--bg-secondary); color: var(--text-primary); font-family: system-ui, sans-serif; line-height: 1.6; }
    .muse-nav { position: sticky; top: 0; z-index: 10; box-sizing: border-box; height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 16px; background: var(--card-bg); border-bottom: 1px solid var(--border-color); }
    .muse-nav a { color: var(--text-primary); }
    .muse-nav-end { margin-left: auto; display: flex; align-items: center; }
    .muse-main { max-width: 1100px; margin: 0 auto; padding: 16px; }
    h1 { font-size: 22px; margin: 8px 0; }
    h2 { font-size: 18px; margin: 0 0 8px; }
    h3 { font-size: 14px; margin: 16px 0 4px; }
    .muse-panel, .muse-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; min-width: 0; }
    .muse-panel { margin-bottom: 16px; }
    .muse-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 16px; }
    .muse-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 4px 0; }
    .muse-meta { color: var(--text-secondary); font-size: 13px; }
    .muse-facts { width: 100%; border-collapse: collapse; font-size: 14px; }
    .muse-facts th { text-align: left; font-weight: 500; color: var(--text-secondary); padding: 2px 12px 2px 0; white-space: nowrap; width: 1%; }
    .muse-facts td { padding: 2px 0; overflow-wrap: anywhere; }
    .muse-scroll { max-height: 320px; overflow: auto; margin-top: 8px; border: 1px solid var(--border-color); border-radius: 6px; }
    .muse-scroll table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .muse-scroll th { position: sticky; top: 0; text-align: left; background: var(--bg-secondary); padding: 4px 8px; }
    .muse-scroll td { padding: 3px 8px; border-top: 1px solid var(--border-color); overflow-wrap: anywhere; }
    /* 状態の意味が固定の色(CLAUDE.CSS.mdの例外)。両テーマで白文字が読める濃さにする。 */
    .muse-badge { display: inline-block; padding: 0 8px; border-radius: 10px; font-size: 13px; color: #fff; }
    .muse-badge-ok { background: #1a7f37; }
    .muse-badge-ng { background: #cf222e; }
    .muse-badge-muted { background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color); }
    button { min-height: 32px; padding: 0 12px; color: var(--text-primary); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; }
    button:disabled { opacity: .6; cursor: default; }
    input[type="number"], input[type="search"] { box-sizing: border-box; color: var(--text-primary); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; }
    input[type="number"] { width: 110px; }
    input[type="search"] { width: 100%; margin-top: 4px; }
    #muse-notice { color: var(--text-primary); background: var(--bg-secondary); border-left: 4px solid #cf222e; padding: 8px 12px; margin: 0 0 16px; }
    #muse-signal-error { color: #cf222e; font-size: 13px; }
  </style>
</head>
<body>
  <nav class="muse-nav"><a href="/cf-containers">← コンテナ管理</a><span class="muse-nav-end">${getThemeToggleHTML()}</span></nav>
  <main class="muse-main">
    <h1>Museの状態</h1>
    <p id="muse-notice" role="status" hidden></p>
    <section class="muse-panel">
      <p class="muse-row">本体コンテナ <span class="muse-badge muse-badge-muted" id="muse-container">確認中</span>
        <span class="muse-meta">確認 <span id="muse-checked-at">—</span></span>
        <button type="button" id="muse-refresh">状態を更新</button></p>
      <p class="muse-row">
        <label><input type="checkbox" id="muse-signal-enabled"> シグナルを定期送信する</label>
        <label>送信間隔(秒) <input type="number" id="muse-signal-interval" min="${MUSE_STATUS_SIGNAL_MIN_SECONDS}" max="${MUSE_STATUS_SIGNAL_MAX_SECONDS}" step="1"></label>
        <span id="muse-signal-error" role="alert"></span></p>
      <p class="muse-meta">シグナルはブリッジmuse-vmの8080番(/health)へ送ります。museは外向き専用のため送信対象外です。推論は走らず、モデルが回答できることまでは確かめません。tailnetの表示はTailscaleの制御サーバーの情報で、オフラインと表示されていてもシグナルに応答することがあります。稼働の判断にはシグナルの結果を使ってください。この設定はこのブラウザのCookieに保存します。タブを隠している間は送信しません。</p>
    </section>
    <div class="muse-grid">
      ${MUSE_NODE_NAMES.map(renderNodeCard).join('\n      ')}
    </div>
  </main>
  <script>${getThemeToggleScript()}</script>
  <script>${MUSE_STATUS_SCRIPT}
    initMuseStatusPage({
      document: document,
      nodes: ${JSON.stringify(MUSE_NODE_NAMES)},
      fetchJson: function(url, init) {
        return fetch(url, Object.assign({ credentials: 'same-origin' }, init)).then(function(response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        });
      }
    });
  </script>
</body>
</html>`;
}
