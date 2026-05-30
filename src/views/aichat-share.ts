import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getAiChatSharePage(share: {
  question: string;
  answer: string;
  model: string;
  created_at: string;
  access_count: number;
}): string {
  const safeQuestion = escapeHtml(share.question);
  const safeAnswer = escapeHtml(share.answer);
  const safeModel = escapeHtml(share.model);
  const modelShort = escapeHtml(share.model.split('/').pop() ?? share.model);
  const safeDate = escapeHtml(share.created_at.replace('T', ' ').replace(/\.\d+Z$/, ' UTC'));

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI チャット共有 — ${modelShort}</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary, #f8fafc);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .navbar {
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px var(--navbar-shadow);
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .navbar-brand {
      font-size: 18px;
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
    }
    .container {
      max-width: 760px;
      width: 100%;
      margin: 32px auto;
      padding: 0 16px 48px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .meta {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      gap: 16px;
    }
    .chat-bubble {
      padding: 14px 18px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .chat-bubble.user {
      align-self: flex-end;
      background: var(--accent-color, #667eea);
      color: #fff;
      border-bottom-right-radius: 3px;
    }
    .chat-bubble.assistant {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      border-bottom-left-radius: 3px;
    }
    .bubble-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .back-link {
      display: inline-block;
      margin-top: 8px;
      font-size: 13px;
      color: var(--accent-color, #667eea);
      text-decoration: none;
    }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <nav class="navbar">
    <a href="/aichat" class="navbar-brand">🤖 AI チャット<span class="navbar-model">${modelShort}</span></a>
    <div style="display:flex;align-items:center;gap:12px;">
      ${getThemeToggleHTML()}
    </div>
  </nav>

  <div class="container">
    <div class="meta">
      <span>📅 ${safeDate}</span>
      <span>👁 ${share.access_count} 回参照</span>
    </div>

    <div>
      <div class="bubble-label">質問</div>
      <div class="chat-bubble user">${safeQuestion}</div>
    </div>

    <div>
      <div class="bubble-label">回答 — ${safeModel}</div>
      <div class="chat-bubble assistant">${safeAnswer}</div>
    </div>

    <a href="/aichat" class="back-link">← AI チャットに戻る</a>
  </div>

  <script>
    ${getThemeToggleScript()}
  </script>
</body>
</html>`;
}

export function getAiChatShareNotFoundPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>共有リンクが見つかりません</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg-primary, #f8fafc); color: var(--text-primary); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .box { text-align: center; padding: 48px 32px; }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { color: var(--text-muted); margin-bottom: 24px; }
    a { color: var(--accent-color, #667eea); text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="box">
    <h1>共有リンクが見つかりません</h1>
    <p>リンクが期限切れか、URLが正しくない可能性があります。</p>
    <a href="/aichat">← AI チャットに戻る</a>
  </div>
  <script>${getThemeInitScript()}</script>
</body>
</html>`;
}
