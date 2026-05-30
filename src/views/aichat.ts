/**
 * AI チャットページのHTML
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getAiChatPage(user: {
  name?: string;
  username: string;
  avatar?: string;
  aiChatModel: string;
  aiChatModelConfigured?: boolean;
  fallbackModel?: string;
}): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const safeModel = escapeHtml(user.aiChatModel);
  const isConfigured = user.aiChatModelConfigured !== false;
  const safeFallback = escapeHtml(user.fallbackModel ?? '@cf/meta/llama-3.1-8b-instruct-fp8');
  const modelShortName = escapeHtml(user.aiChatModel.split('/').pop() ?? user.aiChatModel);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI チャット</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary, #f8fafc);
      color: var(--text-primary);
      display: flex;
      flex-direction: column;
    }

    .navbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px var(--navbar-shadow);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }

    .navbar-brand {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      text-decoration: none;
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .navbar-model {
      font-size: 11px;
      font-weight: 400;
      color: var(--text-muted);
      letter-spacing: 0;
    }

    .user-menu { display: flex; align-items: center; gap: 12px; }
    .user-name { font-size: 14px; color: var(--text-secondary); font-weight: 500; }

    .user-icon {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 16px; cursor: pointer;
      transition: transform 0.2s ease;
      box-shadow: 0 2px 8px rgba(102,126,234,0.3);
    }
    .user-icon:hover { transform: scale(1.05); }

    .user-menu-container { position: relative; }

    .dropdown-menu {
      display: none; position: absolute; top: 50px; right: 0;
      background: var(--dropdown-bg); border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; z-index: 1000; overflow: hidden;
    }
    .dropdown-menu.show { display: block; }
    .dropdown-item {
      padding: 12px 20px; color: var(--text-secondary); text-decoration: none;
      display: block; transition: background 0.2s ease; cursor: pointer;
      border-bottom: 1px solid var(--border-color);
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item:hover { background: var(--dropdown-hover); }
    .dropdown-item.logout { color: var(--danger-color); }

    .chat-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
      padding: 12px 16px 0;
      overflow: hidden;
      min-height: 0;
    }

    .chat-log {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-bottom: 16px;
    }

    .chat-bubble {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .chat-bubble.user {
      align-self: flex-end;
      background: var(--accent-color, #0969da);
      color: #fff;
      border-bottom-right-radius: 3px;
    }
    .chat-bubble.assistant {
      align-self: flex-start;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      border-bottom-left-radius: 3px;
    }
    .chat-bubble.error {
      align-self: flex-start;
      background: rgba(207,34,46,0.08);
      border: 1px solid rgba(207,34,46,0.3);
      color: #cf222e;
    }
    [data-theme="dark"] .chat-bubble.error {
      background: rgba(252,129,129,0.12);
      border: 1px solid rgba(252,129,129,0.4);
      color: #fc8181;
    }
    .chat-bubble.thinking {
      align-self: flex-start;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      font-style: italic;
    }

    .chat-form-area {
      flex-shrink: 0;
      background: var(--bg-primary, #f8fafc);
      padding: 12px 0 20px;
      border-top: 1px solid var(--border-color);
    }
    .chat-form {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }
    .chat-input {
      flex: 1;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: var(--card-bg);
      color: var(--text-primary);
      font-size: 14px;
      resize: none;
      min-height: 42px;
      max-height: 160px;
      overflow-y: auto;
      font-family: inherit;
      line-height: 1.5;
    }
    .chat-input:focus { outline: none; border-color: var(--accent-color, #0969da); }
    .chat-send-btn {
      padding: 10px 18px;
      border-radius: 8px;
      border: none;
      background: var(--accent-color, #0969da);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 0.15s;
      height: 42px;
    }
    .chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .chat-send-btn:not(:disabled):hover { opacity: 0.85; }
  </style>
</head>
<body>
  <nav class="navbar">
    <a href="/welcome" class="navbar-brand">🤖 AI チャット<span class="navbar-model">${modelShortName}</span></a>
    <div class="user-menu">
      ${getThemeToggleHTML()}
      <span class="user-name">${displayName}</span>
      <div class="user-menu-container">
        <div class="user-icon" id="userIcon">${initials}</div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/userinfo" class="dropdown-item">👤 ユーザー情報</a>
          <a href="/settings" class="dropdown-item">⚙️ 設定</a>
          <a href="/status" class="dropdown-item">📊 キャッシュ状況</a>
          <a href="/auth/switch" class="dropdown-item">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="chat-wrapper">
    <div class="chat-log" id="chatLog"></div>
    <div class="chat-form-area">
      <form class="chat-form" id="chatForm">
        <textarea class="chat-input" id="chatInput" placeholder="メッセージを入力... (Shift+Enter で改行)" rows="1"></textarea>
        <button type="submit" class="chat-send-btn" id="chatSendBtn">送信</button>
      </form>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}

    var userIcon = document.getElementById('userIcon');
    var dropdownMenu = document.getElementById('dropdownMenu');
    if (userIcon && dropdownMenu) {
      userIcon.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
      });
      document.addEventListener('click', function() { dropdownMenu.classList.remove('show'); });
    }

    var chatLog = document.getElementById('chatLog');
    var chatForm = document.getElementById('chatForm');
    var chatInput = document.getElementById('chatInput');
    var chatSendBtn = document.getElementById('chatSendBtn');

    // textarea の高さを内容に応じて自動調整
    chatInput.addEventListener('input', function() {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
    });

    // Shift+Enter で改行、Enter のみで送信
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!chatSendBtn.disabled) chatForm.dispatchEvent(new Event('submit'));
      }
    });

    function appendBubble(text, role) {
      var el = document.createElement('div');
      el.className = 'chat-bubble ' + role;
      el.textContent = text;
      chatLog.appendChild(el);
      chatLog.scrollTop = chatLog.scrollHeight;
      return el;
    }

    chatForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var msg = chatInput.value.trim();
      if (!msg) return;

      appendBubble(msg, 'user');
      chatInput.value = '';
      chatInput.style.height = 'auto';
      chatSendBtn.disabled = true;

      var thinking = appendBubble('考え中...', 'thinking');

      fetch('/api/aichat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          thinking.remove();
          if (data.error) {
            appendBubble('エラー: ' + data.error, 'error');
          } else {
            appendBubble(data.response || '(応答なし)', 'assistant');
          }
        })
        .catch(function(err) {
          thinking.remove();
          appendBubble('通信エラーが発生しました', 'error');
        })
        .finally(function() {
          chatSendBtn.disabled = false;
          chatInput.focus();
        });
    });

    chatInput.focus();
  </script>
</body>
</html>`;
}
