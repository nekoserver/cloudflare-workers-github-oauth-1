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
      white-space: normal;
    }
    .chat-bubble.assistant h1 { font-size: 1.4em; font-weight: 700; margin: 12px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
    .chat-bubble.assistant h2 { font-size: 1.2em; font-weight: 600; margin: 10px 0 6px; padding-bottom: 3px; border-bottom: 1px solid var(--border-color); }
    .chat-bubble.assistant h3 { font-size: 1.1em; font-weight: 600; margin: 8px 0 4px; }
    .chat-bubble.assistant h4, .chat-bubble.assistant h5, .chat-bubble.assistant h6 { font-size: 1em; font-weight: 600; margin: 6px 0 4px; }
    .chat-bubble.assistant p { margin: 0 0 10px; }
    .chat-bubble.assistant ul, .chat-bubble.assistant ol { margin: 0 0 10px; padding-left: 1.5em; }
    .chat-bubble.assistant li { margin: 2px 0; }
    .chat-bubble.assistant code { background: var(--bg-secondary); padding: 1px 5px; border-radius: 3px; font-size: 0.88em; font-family: ui-monospace, monospace; }
    .chat-bubble.assistant pre { background: var(--bg-secondary); padding: 10px 12px; border-radius: 6px; overflow-x: auto; margin: 0 0 10px; }
    .chat-bubble.assistant pre code { background: none; padding: 0; font-size: 0.85em; }
    .chat-bubble.assistant blockquote { border-left: 3px solid var(--border-color); margin: 0 0 10px; padding: 4px 0 4px 12px; color: var(--text-muted); }
    .chat-bubble.assistant table { border-collapse: collapse; width: 100%; margin: 0 0 10px; font-size: 12px; }
    .chat-bubble.assistant th, .chat-bubble.assistant td { border: 1px solid var(--border-color); padding: 4px 8px; }
    .chat-bubble.assistant th { background: var(--bg-secondary); font-weight: 600; }
    .chat-bubble.assistant hr { border: none; border-top: 1px solid var(--border-color); margin: 12px 0; }
    .chat-bubble.assistant a { color: var(--accent-color, #667eea); }
    .chat-bubble.assistant img { max-width: 100%; }
    .chat-bubble.assistant input[type="checkbox"] { margin-right: 4px; }
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
      <div class="chat-bubble assistant" id="shareAnswer"></div>
    </div>

    <a href="/aichat" class="back-link">← AI チャットに戻る</a>
  </div>

  <script>
    ${getThemeToggleScript()}
    var rawAnswer = ${JSON.stringify(share.answer)};
    function mdEsc(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function mdInline(text) {
      text = text.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g,'<img src="$2" alt="$1">');
      text = text.replace(/\\[([^\\]]*)\\]\\(([^)]+)\\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      text = text.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g,'<strong><em>$1</em></strong>');
      text = text.replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>');
      text = text.replace(/__(.+?)__/g,'<strong>$1</strong>');
      text = text.replace(/\\*(.+?)\\*/g,'<em>$1</em>');
      text = text.replace(/~~(.+?)~~/g,'<del>$1</del>');
      text = text.replace(/\\n/g,'<br>');
      return text;
    }
    function mdSplitRow(line) {
      return line.replace(/^\\|\\s*/,'').replace(/\\s*\\|$/,'').split(/\\s*\\|\\s*/);
    }
    function mdParseList(lines, start, tag) {
      var items = [], i = start;
      var pat = tag === 'ul' ? /^\\s*[-*+]\\s(.*)/ : /^\\s*\\d+\\.\\s(.*)/;
      while (i < lines.length) {
        var m = lines[i].match(pat); if (!m) break;
        var txt = m[1], task = txt.match(/^\\[([ xX])\\]\\s(.*)/);
        if (task) { items.push('<li><input type="checkbox"' + (task[1] !== ' ' ? ' checked' : '') + ' disabled> ' + mdInline(task[2]) + '</li>'); }
        else { items.push('<li>' + mdInline(txt) + '</li>'); }
        i++;
      }
      return '<' + tag + '>' + items.join('') + '</' + tag + '>';
    }
    function parseMd(src) {
      src = src.replace(/\\r\\n?/g,'\\n');
      var codeBlocks = [];
      src = src.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, function(_, lang, code) {
        var idx = codeBlocks.length;
        codeBlocks.push('<pre><code' + (lang ? ' class="language-' + lang + '"' : '') + '>' + mdEsc(code.replace(/\\n$/, '')) + '</code></pre>');
        return '\\x00CB' + idx + '\\x00';
      });
      var inlineCodes = [];
      src = src.replace(/\`([^\`]+)\`/g, function(_, code) {
        var idx = inlineCodes.length; inlineCodes.push('<code>' + mdEsc(code) + '</code>');
        return '\\x00IC' + idx + '\\x00';
      });
      var lines = src.split('\\n'), html = '', i = 0;
      while (i < lines.length) {
        var line = lines[i];
        if (line.trim() === '') { i++; continue; }
        var cbM = line.match(/^\\x00CB(\\d+)\\x00$/);
        if (cbM) { html += codeBlocks[parseInt(cbM[1])]; i++; continue; }
        var hM = line.match(/^(#{1,6})\\s+(.+)$/);
        if (hM) { var lv = hM[1].length; html += '<h' + lv + '>' + mdInline(hM[2]) + '</h' + lv + '>'; i++; continue; }
        if (/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(line)) { html += '<hr>'; i++; continue; }
        if (i + 1 < lines.length && /^\\|/.test(line) && /^[\\|\\s:-]+$/.test(lines[i + 1])) {
          var tbl = '<table><thead><tr>';
          mdSplitRow(line).forEach(function(h) { tbl += '<th>' + mdInline(h.trim()) + '</th>'; });
          tbl += '</tr></thead><tbody>'; i += 2;
          while (i < lines.length && /^\\|/.test(lines[i])) {
            tbl += '<tr>';
            mdSplitRow(lines[i]).forEach(function(c) { tbl += '<td>' + mdInline(c.trim()) + '</td>'; });
            tbl += '</tr>'; i++;
          }
          tbl += '</tbody></table>'; html += tbl; continue;
        }
        if (/^>\\s?/.test(line)) {
          var bq = [];
          while (i < lines.length && /^>\\s?/.test(lines[i])) { bq.push(lines[i].replace(/^>\\s?/,'')); i++; }
          html += '<blockquote>' + parseMd(bq.join('\\n')) + '</blockquote>'; continue;
        }
        if (/^\\s*[-*+]\\s/.test(line)) {
          html += mdParseList(lines, i, 'ul');
          while (i < lines.length && /^\\s*[-*+]\\s/.test(lines[i])) i++;
          continue;
        }
        if (/^\\s*\\d+\\.\\s/.test(line)) {
          html += mdParseList(lines, i, 'ol');
          while (i < lines.length && /^\\s*\\d+\\.\\s/.test(lines[i])) i++;
          continue;
        }
        var pLines = [];
        while (i < lines.length && lines[i].trim() !== '' && !/^#{1,6}\\s/.test(lines[i]) && !/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(lines[i]) && !/^>\\s?/.test(lines[i]) && !/^\\|/.test(lines[i]) && !/^\\x00CB/.test(lines[i])) {
          pLines.push(lines[i]); i++;
        }
        if (pLines.length) html += '<p>' + mdInline(pLines.join('\\n')) + '</p>';
      }
      html = html.replace(/\\x00IC(\\d+)\\x00/g, function(_, idx) { return inlineCodes[parseInt(idx)]; });
      return html;
    }
    document.getElementById('shareAnswer').innerHTML = parseMd(rawAnswer);
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
