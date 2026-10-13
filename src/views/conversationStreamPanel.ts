/** 通常のチャット入力から独立した、認証付き会話ストリームの埋め込み。 */
export function getConversationStreamPanel(): string {
  return `<style>
    .conversation-stream-panel { flex-shrink: 0; padding: 8px 12px; border-bottom: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-primary); }
    .conversation-stream-panel summary { cursor: pointer; }
    .conversation-stream-controls { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
    .conversation-stream-controls button { background: var(--input-bg); color: var(--text-primary); border: 1px solid var(--input-border); padding: 6px 10px; border-radius: 4px; cursor: pointer; }
    .conversation-stream-controls button[aria-pressed="true"] { border-color: var(--accent-color); }
    .conversation-stream-note { color: var(--text-secondary); font-size: 12px; }
    .conversation-stream-frame { display: block; width: 100%; height: min(65vh, 640px); min-height: 360px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--card-bg); }
  </style>
  <details id="conversationStreamPanel" class="conversation-stream-panel">
    <summary>この会話のストリーム（閲覧のみ）</summary>
    <div class="conversation-stream-controls" role="group" aria-label="会話の通信方式">
      <button type="button" data-conversation-protocol="sse" aria-pressed="false">SSE</button>
      <button type="button" data-conversation-protocol="websocket" aria-pressed="true">WebSocket</button>
      <button type="button" data-conversation-protocol="ndjson" aria-pressed="false">NDJSON</button>
      <button type="button" data-conversation-protocol="jsonseq" aria-pressed="false">JSON Text Sequence</button>
    </div>
    <p class="conversation-stream-note">欄内で既存のHMACキーを入力して「表示を開始」。方式の切替後はキーを再入力してください。この会話への送信や通常のAI履歴への保存は行いません。</p>
    <iframe id="conversationStreamFrame" class="conversation-stream-frame" title="この会話の閲覧専用ストリーム" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin"></iframe>
  </details>
  <script>
  (function () {
    var panel = document.getElementById('conversationStreamPanel');
    var frame = document.getElementById('conversationStreamFrame');
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
        if (panel.open) load();
      });
    });
    panel.addEventListener('toggle', function () {
      if (panel.open) { if (!frame.getAttribute('src')) load(); }
      else frame.removeAttribute('src');
    });
    new MutationObserver(function () {
      if (panel.open && frame.contentWindow) frame.contentWindow.postMessage({ type: 'conversation-theme', theme: theme() }, 'https://mynw.nekomaneki.work');
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('pagehide', function () { frame.removeAttribute('src'); });
  })();
  </script>`;
}
