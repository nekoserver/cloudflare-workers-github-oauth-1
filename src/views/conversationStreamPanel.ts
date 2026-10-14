/** 通常のチャット入力から独立した、認証付き会話ストリームの埋め込み。 */
export function getConversationStreamToggle(): string {
  return '<button type="button" class="search-hist-btn conversation-stream-toggle" id="conversationStreamToggle" aria-controls="conversationStreamPanel" aria-expanded="false" aria-pressed="false" title="この会話のストリーム（閲覧のみ）">会話ストリーム</button>';
}

export function getConversationStreamPanel(): string {
  return `<style>
    .conversation-stream-panel { position: fixed; top: var(--aichat-navbar-height, 44px); right: 0; bottom: 0; z-index: 190; width: min(420px, 100%); display: flex; flex-direction: column; gap: 8px; padding: 10px; border-left: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-primary); overflow-y: auto; }
    .conversation-stream-panel[hidden] { display: none; }
    .conversation-stream-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-shrink: 0; }
    .conversation-stream-heading h2 { font-size: 12px; font-weight: 600; }
    .conversation-stream-close { background: transparent; color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; width: 28px; height: 28px; cursor: pointer; flex-shrink: 0; }
    .conversation-stream-toggle[aria-pressed="true"] { color: var(--accent-color); border-color: var(--accent-color); background: var(--bg-secondary); }
    @media (min-width: 1000px) { body.conversation-stream-open .body-area { padding-right: 420px; } }
    .conversation-stream-controls { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
    .conversation-stream-controls button { background: var(--input-bg); color: var(--text-primary); border: 1px solid var(--input-border); padding: 5px 7px; border-radius: 4px; cursor: pointer; font: inherit; font-size: 10px; }
    .conversation-stream-controls button[aria-pressed="true"] { border-color: var(--accent-color); }
    .conversation-stream-note { color: var(--text-secondary); font-size: 11px; line-height: 1.5; }
    .conversation-stream-frame { display: block; width: 100%; flex: 1; height: 100%; min-height: 240px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--card-bg); }
  </style>
  <aside id="conversationStreamPanel" class="conversation-stream-panel" aria-labelledby="conversationStreamTitle" hidden>
    <div class="conversation-stream-heading">
      <h2 id="conversationStreamTitle">この会話のストリーム（閲覧のみ）</h2>
      <button type="button" id="conversationStreamClose" class="conversation-stream-close" aria-label="会話ストリームを閉じる">✕</button>
    </div>
    <div class="conversation-stream-controls" role="group" aria-label="会話の通信方式">
      <button type="button" data-conversation-protocol="sse" aria-pressed="false">SSE</button>
      <button type="button" data-conversation-protocol="websocket" aria-pressed="true">WebSocket</button>
      <button type="button" data-conversation-protocol="ndjson" aria-pressed="false">NDJSON</button>
      <button type="button" data-conversation-protocol="jsonseq" aria-pressed="false">JSON Text Sequence</button>
    </div>
    <p class="conversation-stream-note">欄内で既存のHMACキーを入力して「表示を開始」。方式の切替後はキーを再入力してください。この会話への送信や通常のAI履歴への保存は行いません。</p>
    <iframe id="conversationStreamFrame" class="conversation-stream-frame" title="この会話の閲覧専用ストリーム" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin"></iframe>
  </aside>
  <script>
  (function () {
    var panel = document.getElementById('conversationStreamPanel');
    var frame = document.getElementById('conversationStreamFrame');
    var toggle = document.getElementById('conversationStreamToggle');
    var close = document.getElementById('conversationStreamClose');
    var protocol = 'websocket';
    var buttons = panel.querySelectorAll('[data-conversation-protocol]');
    function theme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
    function load() {
      var url = new URL('https://mynw.nekomaneki.work/lib/conversation-embed.html');
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
    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-pressed', String(open));
      document.body.classList.toggle('conversation-stream-open', open);
      if (open) { if (!frame.getAttribute('src')) load(); }
      else frame.removeAttribute('src');
    }
    toggle.addEventListener('click', function () { setOpen(panel.hidden); });
    close.addEventListener('click', function () { setOpen(false); toggle.focus(); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) { setOpen(false); toggle.focus(); }
    });
    new MutationObserver(function () {
      if (!panel.hidden && frame.contentWindow) frame.contentWindow.postMessage({ type: 'conversation-theme', theme: theme() }, 'https://mynw.nekomaneki.work');
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('pagehide', function () { frame.removeAttribute('src'); });
  })();
  </script>`;
}
