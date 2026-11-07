import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import { MUSE_BRIDGE_NODE, MUSE_NODE_NAMES } from '../utils/museNodeStatus';

/** /muse-statusのCSP。Tailscale WASM(公式@tailscale/connect)の実行と、TailscaleのHTTPS・WebSocketへの接続だけを足す。/container-monitorと同じ。 */
export const MUSE_STATUS_CSP = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; connect-src 'self' blob: https://*.tailscale.com wss://*.tailscale.com https://*.tailscale.io wss://*.tailscale.io; img-src 'self' data:; font-src 'self' data:; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";

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
    var MUSE_ALL_NODES = ${JSON.stringify(MUSE_NODE_NAMES)};
    var MUSE_BRIDGE_PORT = 8080;
    var MUSE_WASM_STORAGE_PREFIX = 'muse-status.tailscale.';
    // ユーザー指定(2026-11-07): ログイン状態はこのブラウザのlocalStorageにログインから30日保ち、読み込みのたびにログインし直さない。
    // 保存した日時は接頭辞の外のキーに置く(参加状態のキーと混ざらないように)。書き込みのたびには延ばさない。
    var MUSE_WASM_SAVED_AT_KEY = 'muse-status.tailscale-saved-at';
    var MUSE_WASM_STATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
    // ユーザー指定(2026-11-07): faviconはAIチャットと同じ四角。本体コンテナが稼働中は緑、Tailscale WASMで接続中は黄、それ以外は灰。
    var MUSE_FAVICON_COLORS = { container: '%2322c55e', wasm: '%23eab308', none: '%239ca3af' };
    // 本体コンテナ経由のWorkerの待ち時間(8秒)と同じ。
    var MUSE_WASM_SIGNAL_TIMEOUT_MS = 8000;
    var MUSE_SOURCE_LABELS = { container: '本体コンテナ', wasm: 'Tailscale WASM（このブラウザ）', none: 'なし' };
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
      wasm_unsupported: 'Tailscale WASM経由ではNixの一覧を取得しません。一覧の取得にはMUSE_API_KEYが要り、キーをブラウザへ渡さないためです。本体コンテナの起動中に取得してください',
      not_provided: 'このノードは /nix/packages を提供していません',
      container_not_running: '本体コンテナが停止中のため取得できません',
      not_authenticated: 'MUSE_API_KEYが未設定です',
      auth_failed: 'ノードがキーを拒否しました',
      connection_failed: 'ノードへ接続できません',
      timeout: '時間内に応答がありませんでした',
      invalid_response: 'ノードの応答を読み取れませんでした'
    };
    var MUSE_NODES_ERRORS = {
      container_not_running: '本体コンテナが停止中です。ここからは起動しません。/cf-containers から起動するか、下の「Tailscaleへ接続」でこのブラウザから状態とシグナルを取得してください',
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

    function museFaviconHref(kind) {
      return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='" + (MUSE_FAVICON_COLORS[kind] || MUSE_FAVICON_COLORS.none) + "'/%3E%3C/svg%3E";
    }
    function setMuseBadge(element, label, kind) {
      element.textContent = label;
      element.className = 'muse-badge muse-badge-' + kind;
    }

    function renderMuseNode(doc, node) {
      var field = function(name) { return doc.querySelector('[data-node="' + node.name + '"] [data-field="' + name + '"]'); };
      var section = doc.querySelector('[data-node="' + node.name + '"]');
      if (section) section.setAttribute('data-tailnet-online', node.found && node.online === true ? 'true' : 'false');
      if (!node.found) setMuseBadge(field('online'), 'tailnetに見つかりません', 'muted');
      else if (node.online === null) setMuseBadge(field('online'), '不明', 'muted');
      else setMuseBadge(field('online'), node.online ? 'オンライン' : 'オフライン', node.online ? 'ok' : 'ng');
      if (!node.found || node.connection === null) field('connection').textContent = '—';
      else field('connection').textContent = node.connection === 'direct' ? '直接' : node.connection === 'relay' ? '中継 ' + node.relay : 'なし';
      field('os').textContent = node.os || '—';
      field('ip').textContent = node.ip || '—';
      field('lastSeen').textContent = node.online ? '接続中' : formatMuseTime(node.lastSeen);
      field('lastHandshake').textContent = formatMuseTime(node.lastHandshake);
    }

    /** どこからも状態を読めていないとき。「見つからない」「オフライン」とは言わない。 */
    function renderMuseNodeUnknown(doc, name) {
      var section = doc.querySelector('[data-node="' + name + '"]');
      if (!section) return;
      section.setAttribute('data-tailnet-online', 'false');
      setMuseBadge(section.querySelector('[data-field="online"]'), '確認できません', 'muted');
      ['connection', 'os', 'ip', 'lastSeen', 'lastHandshake'].forEach(function(key) {
        section.querySelector('[data-field="' + key + '"]').textContent = '—';
      });
    }

    function museHostLabel(name) {
      var text = String(name || '').toLowerCase();
      var dot = text.indexOf('.');
      return dot === -1 ? text : text.slice(0, dot);
    }

    /** tailnetのIPv4(100.64.0.0/10)か。末尾の/32は外して判定する。 */
    function isMuseTailnetIPv4(value) {
      var parts = String(value || '').split('/')[0].split('.');
      if (parts.length !== 4) return false;
      for (var i = 0; i < 4; i++) {
        if (!/^[0-9]{1,3}$/.test(parts[i]) || Number(parts[i]) > 255) return false;
      }
      return Number(parts[0]) === 100 && Number(parts[1]) >= 64 && Number(parts[1]) <= 127;
    }

    /**
     * @tailscale/connectのnotifyNetMapの値から、muse・muse-vmだけを取り出す。
     * peerはname(FQDN)・addresses・online(省略あり)しか持たないので、OS・経路・最終接続は不明のまま。鍵は持ち出さない。
     */
    function museNodesFromNetMap(value) {
      var map = typeof value === 'string' ? JSON.parse(value) : value;
      if (!map || !Array.isArray(map.peers)) throw new Error('Tailscaleの端末一覧を読み取れません');
      return MUSE_ALL_NODES.map(function(name) {
        var peer = map.peers.filter(function(item) { return item && museHostLabel(item.name) === name; })[0];
        if (!peer) return { name: name, found: false, online: false, connection: null, relay: '', os: '', ip: '', lastSeen: '', lastHandshake: '' };
        var addresses = Array.isArray(peer.addresses) ? peer.addresses : [];
        var ip = addresses.filter(isMuseTailnetIPv4)[0] || '';
        return {
          name: name, found: true, online: typeof peer.online === 'boolean' ? peer.online : null,
          connection: null, relay: '', os: '', ip: ip.split('/')[0], lastSeen: '', lastHandshake: ''
        };
      });
    }

    function museWasmHealthURL(node) {
      if (!node || !node.found || !isMuseTailnetIPv4(node.ip)) return null;
      return 'http://' + node.ip.split('/')[0] + ':' + MUSE_BRIDGE_PORT + '/health';
    }

    /**
     * ブラウザのTailscale WASMからmuse-vmの/healthへ1回送る。@tailscale/connectのfetchはGETだけでヘッダーを付けられない。
     * /healthはブリッジの認証より前に返るのでキーは要らない(2026-11-07、Museの回答。ソース上で、稼働版は未確認)。
     * fetchは取り消せないので、時間切れは結果だけ先に返す。
     */
    function sendMuseWasmSignal(client, node, url, timeoutMs) {
      var limit = typeof timeoutMs === 'number' ? timeoutMs : MUSE_WASM_SIGNAL_TIMEOUT_MS;
      var startedAt = Date.now();
      function finish(code, latencyMs, detail) {
        return { node: node, code: code, latencyMs: typeof latencyMs === 'number' ? latencyMs : null, checkedAt: new Date().toISOString(), detail: detail || null, via: 'wasm' };
      }
      if (!url) return Promise.resolve(finish('connection_failed', null, 'Tailscaleの端末一覧に' + node + 'のtailnetのIPv4アドレスがありません'));
      var timer = null;
      var expired = new Promise(function(resolve) { timer = setTimeout(function() { resolve(finish('timeout')); }, limit); });
      var attempt = Promise.resolve().then(function() { return client.fetch(url); }).then(function(response) {
        var latency = Date.now() - startedAt;
        if (!response || response.status !== 200) return finish('unhealthy', latency);
        return Promise.resolve(response.text()).then(function(text) {
          try {
            var body = JSON.parse(text);
            return finish(body && body.status === 'ok' ? 'ok' : 'unhealthy', latency);
          } catch (e) {
            return finish('unhealthy', latency);
          }
        });
      }, function(error) {
        var message = error && error.message ? error.message : String(error || '');
        return finish('connection_failed', null, message.slice(0, 300));
      });
      return Promise.race([attempt, expired]).then(function(result) {
        clearTimeout(timer);
        return result;
      });
    }

    function museIsTailscaleLoginURL(value) {
      var url;
      try { url = new URL(value); } catch (e) { return false; }
      return url.protocol === 'https:' && !url.username && !url.password
        && (url.hostname === 'login.tailscale.com' || url.hostname.slice(-14) === '.tailscale.com');
    }

    function renderMuseSignal(doc, result) {
      var root = doc.querySelector('[data-node="' + result.node + '"]');
      var label = MUSE_SIGNAL_LABELS[result.code] || ['不明', 'muted'];
      setMuseBadge(root.querySelector('[data-field="signal"]'), label[0], label[1]);
      var detail = formatMuseTime(result.checkedAt);
      if (typeof result.latencyMs === 'number') detail += ' / ' + result.latencyMs + 'ms';
      // 2026-11-07 Museの提案: WASMの端末からの/healthの成功は到達性だけを示し、認証付きの経路が使えることまでは示さない。
      if (result.via === 'wasm') detail += ' / Tailscale WASM（到達性の確認のみ）';
      root.querySelector('[data-field="signalAt"]').textContent = detail;
      // 接続できなかった理由(本体コンテナのtailscale ncのエラー出力)。上流の文字列なのでtextContentで表示する。
      var reason = root.querySelector('[data-field="signalDetail"]');
      var lines = [];
      if (result.code === 'connection_failed' && result.via === 'wasm') {
        lines.push('このブラウザのTailscale WASMから' + result.node + 'の' + MUSE_BRIDGE_PORT + '番へ届きませんでした。tailnetのACL、ノードの稼働、WASMの接続状態を確認してください。');
        lines.push(typeof result.detail === 'string' && result.detail ? '理由: ' + result.detail : '理由: 詳細を受け取れませんでした');
      } else if (result.code === 'connection_failed') {
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
      if (!deps.now) deps = Object.assign({}, deps, { now: function() { return Date.now(); } });
      var nixResults = {};
      var settings = readMuseStatusSettings(doc.cookie);
      var enabledInput = doc.getElementById('muse-signal-enabled');
      var intervalInput = doc.getElementById('muse-signal-interval');
      var intervalError = doc.getElementById('muse-signal-error');
      var notice = doc.getElementById('muse-notice');
      var wasmState = doc.getElementById('muse-wasm-state');
      var wasmLogin = doc.getElementById('muse-wasm-login');
      var wasmConnect = doc.getElementById('muse-wasm-connect');
      // 本体コンテナの最後の応答と、ブラウザのTailscale WASMの状態。表示はrender()が両方から決める。
      var lastStatus = null;
      var wasm = { client: null, loading: null, state: 'Stopped', nodes: null, receivedAt: null };
      var schedule = createMuseSignalSchedule({
        send: function() { refreshStatus(); sendAll(); },
        isHidden: function() { return doc.hidden; },
        getSettings: function() { return settings; }
      });

      function setNotice(text) {
        notice.textContent = text;
        notice.hidden = !text;
      }
      function setWasmState(text) {
        wasmState.textContent = text;
      }
      /** 「Tailscale: 状態」。Runningだけを緑の文字で点滅させる(ユーザー指定、2026-11-07)。状態はSDKの文字列なのでtextContentで入れる。 */
      function setWasmTailscaleState(state) {
        wasmState.textContent = 'Tailscale: ';
        if (state === 'Running') {
          var running = doc.createElement('span');
          running.className = 'muse-wasm-running';
          running.textContent = state;
          wasmState.append(running);
        } else {
          wasmState.append(doc.createTextNode(state));
        }
      }
      function renderFavicon() {
        var icon = doc.getElementById('muse-favicon');
        if (!icon) return;
        var kind = lastStatus && lastStatus.containerRunning === true ? 'container' : wasmReady() ? 'wasm' : 'none';
        icon.setAttribute('href', museFaviconHref(kind));
      }
      function wasmReady() {
        return wasm.client !== null && wasm.state === 'Running' && wasm.nodes !== null;
      }
      function containerUsable() {
        return lastStatus !== null && lastStatus.containerRunning === true && !lastStatus.error;
      }
      /** 本体コンテナが使えればそちら、使えずWASMが接続済みならWASM、どちらも無ければ「確認できません」。 */
      function render() {
        var source = containerUsable() ? 'container' : wasmReady() ? 'wasm' : 'none';
        if (source === 'container') {
          lastStatus.nodes.forEach(function(node) { renderMuseNode(doc, node); });
          doc.getElementById('muse-checked-at').textContent = formatMuseTime(lastStatus.checkedAt);
          setNotice('');
        } else if (source === 'wasm') {
          wasm.nodes.forEach(function(node) { renderMuseNode(doc, node); });
          doc.getElementById('muse-checked-at').textContent = formatMuseTime(wasm.receivedAt);
          setNotice('');
        } else {
          nodes.forEach(function(name) { renderMuseNodeUnknown(doc, name); });
          doc.getElementById('muse-checked-at').textContent = lastStatus ? formatMuseTime(lastStatus.checkedAt) : '—';
          setNotice(lastStatus && lastStatus.error ? (MUSE_NODES_ERRORS[lastStatus.error] || '状態を取得できませんでした') : '状態を取得できませんでした');
        }
        if (lastStatus) setMuseBadge(doc.getElementById('muse-container'), lastStatus.containerRunning ? '起動中' : '停止中', lastStatus.containerRunning ? 'ok' : 'ng');
        else setMuseBadge(doc.getElementById('muse-container'), '不明', 'muted');
        setMuseBadge(doc.getElementById('muse-source'), MUSE_SOURCE_LABELS[source], source === 'none' ? 'muted' : 'ok');
        renderFavicon();
      }
      function refreshStatus() {
        return deps.fetchJson('/api/muse-status').then(function(data) {
          lastStatus = data;
        }, function() {
          lastStatus = null;
        }).then(function() {
          render();
          if (lastStatus && !lastStatus.containerRunning && !wasm.client && hasStoredWasmState()) connectWasm();
        });
      }
      function wasmNode(name) {
        return wasm.nodes ? wasm.nodes.filter(function(node) { return node.name === name; })[0] : null;
      }
      function sendWasmSignal(node) {
        return sendMuseWasmSignal(wasm.client, node, museWasmHealthURL(wasmNode(node)));
      }
      function sendSignal(node) {
        if (node !== MUSE_BRIDGE_NODE) return Promise.resolve();
        var root = doc.querySelector('[data-node="' + node + '"]');
        var button = root.querySelector('[data-action="signal"]');
        button.disabled = true;
        // 本体コンテナ経由を先に試し、停止中と分かったときだけWASMで送る。WorkerのAPIは停止中のコンテナを起動しない。
        return deps.fetchJson('/api/muse-status/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ node: node }) })
          .then(function(result) {
            return result && result.code === 'container_not_running' && wasmReady() ? sendWasmSignal(node) : result;
          }, function() {
            return wasmReady() ? sendWasmSignal(node) : { node: node, code: 'connection_failed', latencyMs: null, checkedAt: new Date().toISOString() };
          })
          .then(function(result) { renderMuseSignal(doc, result); })
          .then(function() { button.disabled = false; });
      }
      function storage() {
        try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (e) { return null; }
      }
      /** ログインから30日を過ぎた参加状態と、保存した日時の分からない参加状態を消す。 */
      function expireStoredWasmState() {
        var store = storage();
        if (!store) return;
        var savedAt = NaN;
        try { savedAt = Number(store.getItem(MUSE_WASM_SAVED_AT_KEY)); } catch (e) { return; }
        if (!(savedAt > 0) || deps.now() - savedAt > MUSE_WASM_STATE_TTL_MS) clearStoredWasmState();
      }
      function hasStoredWasmState() {
        expireStoredWasmState();
        var store = storage();
        if (!store) return false;
        try {
          for (var i = 0; i < store.length; i++) {
            if (String(store.key(i)).indexOf(MUSE_WASM_STORAGE_PREFIX) === 0) return true;
          }
        } catch (e) { return false; }
        return false;
      }
      function clearStoredWasmState() {
        var store = storage();
        if (!store) return;
        try {
          var keys = [];
          for (var i = 0; i < store.length; i++) keys.push(String(store.key(i)));
          keys.forEach(function(key) { if (key.indexOf(MUSE_WASM_STORAGE_PREFIX) === 0) store.removeItem(key); });
          store.removeItem(MUSE_WASM_SAVED_AT_KEY);
        } catch (e) { /* 保存できない環境では、もともと何も残っていない */ }
      }
      function dropWasmView() {
        wasm.nodes = null;
        wasm.receivedAt = null;
        render();
      }
      function onWasmReady() {
        render();
        if (containerUsable()) return;
        // 停止中で読めなかったNixの欄は、WASMでは取らない理由に差し替える
        loadNix(MUSE_BRIDGE_NODE);
        if (settings.enabled) { schedule.markSent(); sendAll(); }
      }
      function connectWasm() {
        if (!deps.createTailscaleClient) { setWasmState('この画面ではTailscale WASMを使えません'); return Promise.resolve(); }
        if (wasm.client) { wasm.client.login(); return Promise.resolve(); }
        if (wasm.loading) return wasm.loading;
        wasmConnect.disabled = true;
        setWasmState('Tailscale WASMを読み込み中…');
        var stateStorage = {
          getState: function(key) { var store = storage(); try { return store ? store.getItem(MUSE_WASM_STORAGE_PREFIX + key) || '' : ''; } catch (e) { return ''; } },
          setState: function(key, value) {
            var store = storage();
            try {
              if (!store) return;
              store.setItem(MUSE_WASM_STORAGE_PREFIX + key, value);
              if (!store.getItem(MUSE_WASM_SAVED_AT_KEY)) store.setItem(MUSE_WASM_SAVED_AT_KEY, String(deps.now()));
            } catch (e) { /* メモリ上の参加状態だけで続ける */ }
          }
        };
        function onPanic() {
          setWasmState('Tailscale接続でエラーが発生しました。ページを再読み込みしてください');
          wasm.state = 'Stopped';
          dropWasmView();
        }
        wasm.loading = Promise.resolve().then(function() {
          return deps.createTailscaleClient({ authKey: '', hostname: 'muse-status-browser', stateStorage: stateStorage, panicHandler: onPanic });
        }).then(function(client) {
          wasm.client = client;
          client.run({
            notifyState: function(state) {
              var wasReady = wasmReady();
              wasm.state = state;
              setWasmTailscaleState(state);
              if (state === 'Running') {
                wasmLogin.textContent = '';
                if (!wasReady && wasmReady()) onWasmReady();
              } else if (state !== 'Starting') {
                dropWasmView();
              }
            },
            notifyNetMap: function(value) {
              var wasReady = wasmReady();
              try {
                wasm.nodes = museNodesFromNetMap(value);
                wasm.receivedAt = new Date().toISOString();
              } catch (error) {
                setWasmState(error.message);
                return;
              }
              if (!wasReady && wasmReady()) onWasmReady();
              else render();
            },
            notifyBrowseToURL: function(value) {
              if (!museIsTailscaleLoginURL(value)) return;
              var link = doc.createElement('a');
              link.href = value;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.textContent = 'Tailscaleのログイン画面を開く';
              wasmLogin.textContent = '';
              wasmLogin.append(link);
            },
            notifyPanicRecover: onPanic
          });
          client.login();
        }).catch(function(error) {
          wasm.client = null;
          setWasmState('WASMの読み込みに失敗しました: ' + (error && error.message ? error.message : String(error)));
        }).then(function() {
          wasm.loading = null;
          wasmConnect.disabled = false;
        });
        return wasm.loading;
      }
      function logoutWasm() {
        if (wasm.client) wasm.client.logout();
        clearStoredWasmState();
        wasm.state = 'Stopped';
        wasmLogin.textContent = '';
        setWasmState('Tailscaleからログアウトしました');
        dropWasmView();
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
            if (result && result.state === 'container_not_running' && wasmReady()) result = { node: node, state: 'wasm_unsupported' };
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
      wasmConnect.addEventListener('click', connectWasm);
      doc.getElementById('muse-wasm-logout').addEventListener('click', logoutWasm);
      doc.addEventListener('visibilitychange', schedule.checkIfDue);

      expireStoredWasmState();
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
  <link rel="icon" id="muse-favicon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%239ca3af'/%3E%3C/svg%3E">
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
    /* ユーザー指定(2026-11-07): 「Tailscale: Running」のRunningは緑の文字で点滅し続ける。 */
    .muse-wasm-running { color: var(--success-color); font-weight: 600; animation: muse-blink 1.2s ease-in-out infinite; }
    @keyframes muse-blink { 50% { opacity: 0.25; } }
  </style>
</head>
<body>
  <nav class="muse-nav"><a href="/cf-containers">← コンテナ管理</a><span class="muse-nav-end">${getThemeToggleHTML()}</span></nav>
  <main class="muse-main">
    <h1>Museの状態</h1>
    <p id="muse-notice" role="status" hidden></p>
    <section class="muse-panel">
      <p class="muse-row">本体コンテナ <span class="muse-badge muse-badge-muted" id="muse-container">確認中</span>
        取得経路 <span class="muse-badge muse-badge-muted" id="muse-source">確認中</span>
        <span class="muse-meta">確認 <span id="muse-checked-at">—</span></span>
        <button type="button" id="muse-refresh">状態を更新</button></p>
      <p class="muse-row">
        <label><input type="checkbox" id="muse-signal-enabled"> シグナルを定期送信する</label>
        <label>送信間隔(秒) <input type="number" id="muse-signal-interval" min="${MUSE_STATUS_SIGNAL_MIN_SECONDS}" max="${MUSE_STATUS_SIGNAL_MAX_SECONDS}" step="1"></label>
        <span id="muse-signal-error" role="alert"></span></p>
      <p class="muse-meta">シグナルはブリッジmuse-vmの8080番(/health)へ送ります。museは外向き専用のため送信対象外です。推論は走らず、モデルが回答できることまでは確かめません。tailnetの表示はTailscaleの制御サーバーの情報で、オフラインと表示されていてもシグナルに応答することがあります。稼働の判断にはシグナルの結果を使ってください。この設定はこのブラウザのCookieに保存します。タブを隠している間は送信しません。</p>
    </section>
    <section class="muse-panel" aria-labelledby="muse-wasm-title">
      <h2 id="muse-wasm-title">Tailscale WASM（本体コンテナの停止中に使う）</h2>
      <p class="muse-row"><button type="button" id="muse-wasm-connect">Tailscaleへ接続</button>
        <button type="button" id="muse-wasm-logout">ログアウト</button>
        <span class="muse-meta" id="muse-wasm-state" role="status">未接続</span></p>
      <p id="muse-wasm-login"></p>
      <p class="muse-meta">本体コンテナが停止中のとき、このブラウザがTailscaleの端末としてtailnetへ参加し、状態とmuse-vmの/healthを直接取得します。本体コンテナが起動中ならそちらを使います。Tailscaleへのログインが必要で、見える端末と届く先はログインしたアカウントとACLに従います。WASMは公式の@tailscale/connectで、接続を押したときだけ読み込みます。Nixの一覧はMUSE_API_KEYが要るため、WASMでは取得しません。参加状態はこのブラウザのlocalStorageにログインから30日保存し、その間はページを開き直してもログインし直さずに再接続します。ログアウトか期限切れで消します。共有の端末では使い終わったらログアウトしてください。</p>
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
      createTailscaleClient: function(config) {
        return import('/tailscale-wasm-client.mjs').then(function(module) { return module.loadTailscaleClient(config); });
      },
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
