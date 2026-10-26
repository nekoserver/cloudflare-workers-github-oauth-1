import { CONVERSATION_STREAM_URLS } from '../utils/conversationStreamHosts';

/** 通常のチャット入力から独立した、認証付き会話ストリームの埋め込み。 */
export function getConversationStreamToggle(): string {
  return '<button type="button" class="search-hist-btn conversation-stream-toggle" id="conversationStreamToggle" aria-controls="conversationStreamPanel" aria-expanded="false" aria-pressed="false" title="ストリーム">ストリーム</button>';
}

export function getConversationStreamPanel(): string {
  return `<style>
    .conversation-stream-panel { position: fixed; top: var(--aichat-navbar-height, 44px); right: 0; bottom: 0; z-index: 190; width: min(420px, 100%); display: flex; flex-direction: column; gap: 8px; padding: 10px; border-left: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-primary); overflow: hidden; }
    .conversation-stream-panel[hidden] { display: none; }
    .conversation-stream-close { background: transparent; color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; width: 18px; height: 20px; padding: 0; margin-left: auto; cursor: pointer; flex-shrink: 0; }
    .conversation-stream-toggle,
    .conversation-stream-toggle[aria-pressed="true"] { background: transparent; border: 1px solid #16a34a; }
    .conversation-stream-toggle[data-server-state="error"] { border-color: #dc2626; }
    @media (min-width: 1000px) { body.conversation-stream-open .body-area { padding-right: 420px; } }
    .conversation-stream-controls { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 2px 0; flex-shrink: 0; }
    .conversation-stream-controls button, .conversation-stream-controls select { background: var(--input-bg); color: var(--text-primary); border: 1px solid var(--input-border); height: 20px; padding: 2px 3px; white-space: nowrap; border-radius: 4px; cursor: pointer; font: inherit; font-size: 7px; }
    .conversation-stream-controls select { max-width: 180px; }
    .conversation-stream-host-picker { display: inline-flex; }
    #conversationStreamHostPicker { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
    .conversation-stream-host-options { position: absolute; top: 100%; left: 0; right: 0; z-index: 5; padding: 4px; border: 1px solid var(--input-border); border-radius: 4px; background: var(--card-bg); box-shadow: 0 4px 12px #0003; }
    .conversation-stream-host-options[hidden] { display: none; }
    .conversation-stream-controls .conversation-stream-host-option { display: block; width: 100%; height: auto; min-height: 28px; padding: 5px 8px; text-align: left; border-color: transparent; background: transparent; font-size: 11px; }
    .conversation-stream-host-option[aria-selected="true"] { font-weight: 700; text-decoration: underline; }
    .conversation-stream-host-option:focus-visible { outline: 2px solid var(--accent-color); outline-offset: -2px; }
    .conversation-stream-controls button[aria-pressed="true"] { border-color: var(--accent-color); }
    @media (max-width: 360px) { .conversation-stream-controls button, .conversation-stream-controls select { font-size: 6px; padding: 2px; } }
    .conversation-stream-frame { display: block; width: 100%; flex: 1; height: 100%; min-height: 0; border: 1px solid var(--border-color); border-radius: 6px; background: var(--card-bg); }
  </style>
  <aside id="conversationStreamPanel" class="conversation-stream-panel" aria-label="ストリーム" hidden>
    <div class="conversation-stream-controls" role="group" aria-label="通信方式と受信操作">
      <button type="button" data-conversation-protocol="sse" aria-pressed="false">SSE</button>
      <button type="button" data-conversation-protocol="websocket" aria-pressed="true">WebSocket</button>
      <button type="button" data-conversation-protocol="ndjson" aria-pressed="false">NDJSON</button>
      <button type="button" data-conversation-protocol="jsonseq" aria-pressed="false">JSON Text Sequence</button>
      <label for="conversationStreamHostPicker">接続先</label>
      <span class="conversation-stream-host-picker">
      <button type="button" id="conversationStreamHostPicker" aria-label="ストリーム接続先" aria-haspopup="listbox" aria-expanded="false" aria-controls="conversationStreamHostOptions">自動 ▾</button>
      <span id="conversationStreamHostOptions" class="conversation-stream-host-options" role="listbox" aria-label="ストリーム接続先の候補" hidden></span>
      <select id="conversationStreamHost" aria-label="ストリーム接続先の値" hidden tabindex="-1">
        <option value="auto" selected>自動</option>
        <option value="mygw">mygw.nekomaneki.work</option>
        <option value="mynw">mynw.nekomaneki.work</option>
        <option value="testcfc">stream.test.cfc.nekomaneki.work</option>
        <option value="redmine">r9.nekomaneki.work (Redmine)</option>
      </select>
      </span>
      <span id="conversationStreamHostStatus" role="status" aria-live="polite">自動</span>
      <button type="button" id="conversationStreamStart" disabled>表示を開始</button>
      <button type="button" id="conversationStreamStop" disabled>受信を停止</button>
      <button type="button" id="conversationStreamClose" class="conversation-stream-close" aria-label="ストリームを閉じる">✕</button>
    </div>
    <iframe id="conversationStreamFrame" class="conversation-stream-frame" title="この会話の閲覧専用ストリーム" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"></iframe>
  </aside>
  <script>
  (function () {
    var panel = document.getElementById('conversationStreamPanel');
    var frame = document.getElementById('conversationStreamFrame');
    var toggle = document.getElementById('conversationStreamToggle');
    var close = document.getElementById('conversationStreamClose');
    var start = document.getElementById('conversationStreamStart');
    var stop = document.getElementById('conversationStreamStop');
    var hostSelect = document.getElementById('conversationStreamHost');
    var hostStatus = document.getElementById('conversationStreamHostStatus');
    var hostPicker = document.getElementById('conversationStreamHostPicker');
    var hostOptions = document.getElementById('conversationStreamHostOptions');
    var hostChoices = {};
    function setHostMenuOpen(open, restoreFocus) {
      hostOptions.hidden = !open;
      hostPicker.setAttribute('aria-expanded', String(open));
      if (open) hostChoices[hostSelect.value].focus();
      else if (restoreFocus) hostPicker.focus();
    }
    Array.from(hostSelect.options).forEach(function (option) {
      var choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'conversation-stream-host-option';
      choice.setAttribute('role', 'option');
      choice.dataset.value = option.value;
      choice.tabIndex = -1;
      choice.textContent = option.textContent;
      choice.addEventListener('click', function () {
        hostSelect.value = option.value;
        hostSelect.dispatchEvent(new Event('change'));
        setHostMenuOpen(false, true);
      });
      hostChoices[option.value] = choice;
      hostOptions.appendChild(choice);
    });
    hostPicker.addEventListener('click', function () { setHostMenuOpen(hostOptions.hidden, false); });
    hostPicker.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setHostMenuOpen(true, false); }
    });
    hostOptions.addEventListener('keydown', function (event) {
      var choices = Object.values(hostChoices);
      var index = choices.indexOf(document.activeElement);
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setHostMenuOpen(false, true); }
      else if (event.key === 'Tab') setHostMenuOpen(false, true);
      else if ((event.key === 'Enter' || event.key === ' ') && index >= 0) { event.preventDefault(); choices[index].click(); }
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(event.key) >= 0) {
        event.preventDefault();
        var next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
        choices[next].focus();
      }
    });
    document.addEventListener('click', function (event) {
      if (event.target !== hostPicker && !hostOptions.contains(event.target)) setHostMenuOpen(false, false);
    });
    var hostPreference = 'auto';
    var activeHost = null;
    var connectedHost = null;
    var availableHosts = [];
    var availabilityKnown = false;
    var healthGeneration = 0;
    var latestHealth = null;
    var loadGeneration = 0;
    var embedUrls = ${JSON.stringify(CONVERSATION_STREAM_URLS)};
    function installStreamDirectory(streams) {
      var next = {};
      streams.forEach(function (stream) {
        if (!stream || typeof stream.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(stream.id)
          || typeof stream.embedUrl !== 'string') return;
        try {
          var url = new URL(stream.embedUrl);
          if (url.protocol !== 'https:' || url.pathname !== '/lib/conversation-embed.html') return;
          next[stream.id] = url.href;
        } catch {}
      });
      var previousPreference = hostPreference;
      embedUrls = next;
      origins = Object.fromEntries(Object.entries(embedUrls).map(function (entry) { return [entry[0], new URL(entry[1]).origin]; }));
      hostSelect.innerHTML = '<option value="auto">自動</option>';
      Object.keys(embedUrls).forEach(function (id) {
        var stream = streams.find(function (item) { return item.id === id; });
        var option = document.createElement('option');
        option.value = id;
        option.textContent = (stream && stream.label ? stream.label + ' — ' : '') + new URL(embedUrls[id]).host;
        hostSelect.appendChild(option);
      });
      hostOptions.innerHTML = '';
      hostChoices = {};
      Array.from(hostSelect.options).forEach(function (option) {
        var choice = document.createElement('button');
        choice.type = 'button';
        choice.className = 'conversation-stream-host-option';
        choice.setAttribute('role', 'option');
        choice.dataset.value = option.value;
        choice.tabIndex = -1;
        choice.textContent = option.textContent;
        choice.addEventListener('click', function () {
          hostSelect.value = option.value;
          hostSelect.dispatchEvent(new Event('change'));
          setHostMenuOpen(false, true);
        });
        hostChoices[option.value] = choice;
        hostOptions.appendChild(choice);
      });
      var removedManualChoice = previousPreference !== 'auto' && !Object.prototype.hasOwnProperty.call(embedUrls, previousPreference);
      hostPreference = previousPreference !== 'auto' && !removedManualChoice ? previousPreference : 'auto';
      hostSelect.value = hostPreference;
      renderHostOptions();
      if (removedManualChoice) hostStatus.textContent = '手動選択先が登録解除されたため自動へ切り替えました';
    }
    var origins = Object.fromEntries(Object.entries(embedUrls).map(function (entry) { return [entry[0], new URL(entry[1]).origin]; }));
    var protocol = 'websocket';
    var healthTimer = null;
    var checkingHealth = false;
    function renderHostOptions() {
      hostChoices.auto.setAttribute('aria-selected', String(hostPreference === 'auto'));
      hostPicker.textContent = (hostPreference === 'auto' ? '自動' : new URL(embedUrls[hostPreference]).host) + ' ▾';
      Array.from(hostSelect.options).forEach(function (option) {
        if (!Object.prototype.hasOwnProperty.call(embedUrls, option.value)) return;
        var automatic = hostPreference === 'auto';
        var available = availableHosts.indexOf(option.value) >= 0;
        var connected = automatic && available && connectedHost === option.value && !panel.hidden;
        var label = new URL(embedUrls[option.value]).host;
        var state = connected ? 'connected' : available ? 'available' : availabilityKnown ? 'unavailable' : 'unknown';
        option.textContent = (connected ? '🟢 ' : '') + label;
        option.style.color = automatic ? (available ? '#16a34a' : '#9ca3af') : '';
        option.dataset.streamState = automatic ? state : 'manual';
        option.title = automatic ? label + ' — ' + (connected ? '接続済み' : available ? '接続可能（認証が必要な場合があります）' : availabilityKnown ? '接続不可' : '接続状況を確認できません') : label;
        var choice = hostChoices[option.value];
        choice.textContent = option.textContent;
        choice.style.color = option.style.color;
        choice.dataset.streamState = option.dataset.streamState;
        choice.title = option.title;
        choice.setAttribute('aria-label', option.title);
        choice.setAttribute('aria-selected', String(option.value === hostPreference));
      });
      if (hostPreference !== 'auto' && availabilityKnown && availableHosts.indexOf(hostPreference) < 0) {
        hostStatus.textContent = '手動選択先は接続できません: ' + new URL(embedUrls[hostPreference]).host;
      }
    }
    function applyHealth(data) {
      latestHealth = data;
      if (data && Array.isArray(data.streams)) installStreamDirectory(data.streams);
      availabilityKnown = !!(data && Array.isArray(data.availableHosts));
      availableHosts = availabilityKnown ? data.availableHosts.filter(function (host) {
        return Object.prototype.hasOwnProperty.call(embedUrls, host);
      }) : [];
      if (availableHosts.indexOf(connectedHost) < 0) connectedHost = null;
      renderHostOptions();
    }
    async function requestHealth() {
      var generation = ++healthGeneration;
      try {
        var response = await fetch('/api/aichat/conversation-stream/health', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        var data = response.ok ? await response.json() : null;
        if (generation !== healthGeneration) return latestHealth;
        applyHealth(data);
        var healthy = !!(data && data.healthy === true);
        toggle.setAttribute('data-server-state', healthy ? 'healthy' : 'error');
        toggle.title = healthy ? 'ストリーム（接続可能）' : 'ストリーム（接続先なし）';
        return data;
      } catch (error) {
        if (generation !== healthGeneration) return latestHealth;
        applyHealth(null);
        toggle.setAttribute('data-server-state', 'error');
        toggle.title = 'ストリーム（接続先なし）';
        return null;
      }
    }
    async function checkHealth() {
      if (checkingHealth || document.hidden) return null;
      checkingHealth = true;
      try {
        var data = await requestHealth();
        if (hostPreference === 'auto' && !panel.hidden) {
          var candidates = data && Array.isArray(data.availableHosts) ? data.availableHosts : [];
          var next = candidates.indexOf(activeHost) >= 0 ? activeHost : candidates.find(function (candidate) { return Object.prototype.hasOwnProperty.call(embedUrls, candidate); }) || null;
          if (next !== activeHost) load(data);
          else if (!next && activeHost) {
            loadGeneration++;
            activeHost = null;
            frame.removeAttribute('src');
            hostStatus.textContent = '自動: 接続先が見つかりません';
            start.disabled = true; stop.disabled = true;
          }
        }
        return data;
      } finally { checkingHealth = false; }
    }
    function startHealthChecks() {
      if (healthTimer !== null) return;
      checkHealth();
      healthTimer = setInterval(checkHealth, 30000);
    }
    var buttons = panel.querySelectorAll('[data-conversation-protocol]');
    function theme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
    async function load(preloadedHealth) {
      var generation = ++loadGeneration;
      var previousHost = activeHost;
      activeHost = null;
      connectedHost = null;
      renderHostOptions();
      start.disabled = true; stop.disabled = true;
      frame.removeAttribute('src');
      var host = hostPreference;
      if (host === 'auto') {
        var health = preloadedHealth || await requestHealth();
        if (generation !== loadGeneration || panel.hidden) return;
        var candidates = health && Array.isArray(health.availableHosts) ? health.availableHosts : [];
        host = candidates.indexOf(previousHost) >= 0 ? previousHost : candidates.find(function (candidate) { return Object.prototype.hasOwnProperty.call(embedUrls, candidate); }) || null;
      }
      if (!host || !Object.prototype.hasOwnProperty.call(embedUrls, host)) {
        activeHost = null;
        renderHostOptions();
        hostStatus.textContent = '自動: 接続先が見つかりません';
        start.disabled = true; stop.disabled = true;
        return;
      }
      activeHost = host;
      renderHostOptions();
      hostStatus.textContent = (hostPreference === 'auto' ? '自動: ' : '') + new URL(embedUrls[host]).host;
      var url = new URL(embedUrls[host]);
      url.searchParams.set('protocol', protocol);
      url.searchParams.set('theme', theme());
      frame.src = url.href;
    }
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        protocol = button.getAttribute('data-conversation-protocol');
        buttons.forEach(function (item) { item.setAttribute('aria-pressed', String(item === button)); });
        if (!panel.hidden) load();
      });
    });
    hostSelect.addEventListener('change', function () {
      hostPreference = hostSelect.value;
      activeHost = null;
      connectedHost = null;
      renderHostOptions();
      if (!panel.hidden) load();
      else hostStatus.textContent = hostPreference === 'auto' ? '自動' : hostPreference;
    });
    function setOpen(open) {
      if (!open) setHostMenuOpen(false, false);
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-pressed', String(open));
      document.body.classList.toggle('conversation-stream-open', open);
      if (open) { if (!frame.getAttribute('src')) load(); }
      else { loadGeneration++; activeHost = null; connectedHost = null; frame.removeAttribute('src'); }
      renderHostOptions();
    }
    frame.addEventListener('load', function () {
      if (!panel.hidden && frame.getAttribute('src') && activeHost) frame.contentWindow.postMessage({ type: 'conversation-controls' }, origins[activeHost]);
    });
    start.addEventListener('click', function () { if (activeHost) frame.contentWindow.postMessage({ type: 'conversation-start' }, origins[activeHost]); });
    stop.addEventListener('click', function () { if (activeHost) frame.contentWindow.postMessage({ type: 'conversation-stop' }, origins[activeHost]); });
    window.addEventListener('message', function (event) {
      if (!activeHost || event.origin !== origins[activeHost] || event.source !== frame.contentWindow || panel.hidden) return;
      if (event.data && event.data.type === 'conversation-state' && typeof event.data.busy === 'boolean') {
        connectedHost = activeHost;
        renderHostOptions();
        start.disabled = event.data.busy; stop.disabled = !event.data.busy;
      }
      if (event.data && event.data.type === 'conversation-transport' && event.data.protocol === 'sse') {
        protocol = 'sse';
        buttons.forEach(function (button) { button.setAttribute('aria-pressed', String(button.getAttribute('data-conversation-protocol') === protocol)); });
      }
    });
    toggle.addEventListener('click' , function () { setOpen(panel.hidden); });
    close.addEventListener('click', function () { setOpen(false); toggle.focus(); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) { setOpen(false); toggle.focus(); }
    });
    new MutationObserver(function () {
      if (!panel.hidden && frame.contentWindow && activeHost) frame.contentWindow.postMessage({ type: 'conversation-theme', theme: theme() }, origins[activeHost]);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('pagehide', function () {
      frame.removeAttribute('src'); clearInterval(healthTimer); healthTimer = null; activeHost = null; connectedHost = null; loadGeneration++;
      renderHostOptions();
    });
    window.addEventListener('pageshow', function () {
      startHealthChecks();
      if (!panel.hidden && !frame.getAttribute('src')) load();
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) checkHealth(); });
    renderHostOptions();
    startHealthChecks();
  })();
  </script>`;
}
