/**
 * Markdown プレビューページ
 * .md ファイルの内容をタブ切り替えで編集・プレビューできるページ
 */
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getMarkdownPreviewPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Preview</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
      min-height: 100vh;
    }

    .navbar {
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px var(--navbar-shadow);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .navbar-brand {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .navbar-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px;
    }

    .editor-card {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow);
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
    }

    .tab-group {
      display: flex;
      gap: 4px;
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 3px;
    }

    .tab-btn {
      padding: 8px 20px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text-muted);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .tab-btn:hover { color: var(--text-primary); }

    .tab-btn.active {
      background: var(--accent-color);
      color: #fff;
      box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
    }

    .file-actions {
      display: flex;
      gap: 8px;
      margin-left: auto;
      align-items: center;
    }

    .file-name-input {
      padding: 6px 12px;
      border: 1px solid var(--input-border);
      border-radius: 6px;
      background: var(--input-bg);
      color: var(--text-secondary);
      font-size: 13px;
      font-family: 'Monaco', 'Courier New', monospace;
      width: 220px;
    }

    .file-name-input:focus {
      outline: none;
      border-color: var(--accent-color);
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
    }

    .action-btn {
      padding: 6px 14px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .action-btn:hover {
      background: var(--border-color);
      color: var(--text-primary);
    }

    .action-btn.primary {
      background: var(--accent-color);
      color: #fff;
      border-color: var(--accent-color);
    }

    .action-btn.primary:hover {
      background: var(--accent-hover);
    }

    .panel-container {
      position: relative;
      min-height: 500px;
    }

    .panel { display: none; height: 100%; }
    .panel.active { display: block; }

    .editor-textarea {
      width: 100%;
      min-height: 500px;
      padding: 24px;
      border: none;
      resize: vertical;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.7;
      background: var(--card-bg);
      color: var(--text-secondary);
      tab-size: 4;
    }

    .editor-textarea:focus { outline: none; }

    .preview-area {
      padding: 24px 32px;
      line-height: 1.8;
      color: var(--text-secondary);
      overflow-wrap: break-word;
    }

    .preview-area h1 { font-size: 2em; font-weight: 700; color: var(--text-primary); margin: 24px 0 16px; padding-bottom: 8px; border-bottom: 2px solid var(--border-color); }
    .preview-area h2 { font-size: 1.5em; font-weight: 600; color: var(--text-primary); margin: 20px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--border-color); }
    .preview-area h3 { font-size: 1.25em; font-weight: 600; color: var(--text-primary); margin: 16px 0 8px; }
    .preview-area h4 { font-size: 1.1em; font-weight: 600; color: var(--text-primary); margin: 14px 0 6px; }
    .preview-area h5, .preview-area h6 { font-size: 1em; font-weight: 600; color: var(--text-muted); margin: 12px 0 6px; }

    .preview-area p { margin: 0 0 16px; }
    .preview-area ul, .preview-area ol { margin: 0 0 16px; padding-left: 2em; }
    .preview-area li { margin: 4px 0; }
    .preview-area li > ul, .preview-area li > ol { margin: 4px 0 4px; }

    .preview-area blockquote {
      border-left: 4px solid var(--accent-color);
      padding: 8px 16px;
      margin: 0 0 16px;
      background: var(--bg-secondary);
      border-radius: 0 6px 6px 0;
      color: var(--text-muted);
    }

    .preview-area code {
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 0.9em;
    }

    .preview-area pre {
      background: var(--code-bg);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 0 0 16px;
    }

    .preview-area pre code {
      background: none;
      padding: 0;
      font-size: 0.88em;
      line-height: 1.6;
    }

    .preview-area table {
      border-collapse: collapse;
      width: 100%;
      margin: 0 0 16px;
    }

    .preview-area th, .preview-area td {
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      text-align: left;
    }

    .preview-area th {
      background: var(--bg-secondary);
      font-weight: 600;
      color: var(--text-primary);
    }

    .preview-area hr {
      border: none;
      border-top: 2px solid var(--border-color);
      margin: 24px 0;
    }

    .preview-area a { color: var(--accent-color); text-decoration: none; }
    .preview-area a:hover { text-decoration: underline; }

    .preview-area img { max-width: 100%; height: auto; border-radius: 8px; }

    .preview-area .task-list-item { list-style: none; margin-left: -1.5em; }
    .preview-area .task-list-item input[type="checkbox"] { margin-right: 6px; }

    .empty-state {
      text-align: center;
      padding: 80px 32px;
      color: var(--text-muted);
    }

    .empty-state-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
    .empty-state-text { font-size: 16px; }

    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      border-top: 1px solid var(--border-color);
      font-size: 12px;
      color: var(--text-muted);
    }

    .drop-overlay {
      display: none;
      position: absolute;
      inset: 0;
      background: rgba(102, 126, 234, 0.1);
      border: 3px dashed var(--accent-color);
      border-radius: 12px;
      z-index: 10;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      color: var(--accent-color);
      font-weight: 600;
      pointer-events: none;
    }

    .drop-overlay.active {
      display: flex;
    }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span style="font-size:24px">M&darr;</span>
      <span>Markdown Preview</span>
    </div>
    <div class="navbar-actions">
      ${getThemeToggleHTML()}
    </div>
  </nav>

  <div class="container">
    <div class="editor-card">
      <div class="toolbar">
        <div class="tab-group">
          <button class="tab-btn active" data-tab="edit" onclick="switchTab('edit')">Edit</button>
          <button class="tab-btn" data-tab="preview" onclick="switchTab('preview')">Preview</button>
          <button class="tab-btn" data-tab="split" onclick="switchTab('split')">Split</button>
        </div>
        <div class="file-actions">
          <input type="text" class="file-name-input" id="fileName" value="README.md" placeholder="filename.md">
          <label class="action-btn" style="margin:0">
            Open
            <input type="file" accept=".md,.markdown,.txt" id="fileInput" style="display:none">
          </label>
          <button class="action-btn primary" onclick="downloadFile()">Download</button>
        </div>
      </div>

      <div class="panel-container" id="panelContainer">
        <div class="drop-overlay" id="dropOverlay">.md ファイルをドロップ</div>

        <!-- Edit panel -->
        <div class="panel active" id="panelEdit" style="height:100%">
          <textarea class="editor-textarea" id="editor" spellcheck="false" placeholder="Markdown を入力..."># Hello Markdown

これは **Markdown プレビュー** ページです。

## 機能

- **Edit** タブで Markdown を編集
- **Preview** タブでレンダリング結果を確認
- **Split** タブで左右並べて表示
- ファイルの読み込み・ダウンロード対応
- ドラッグ&amp;ドロップで .md ファイルを開く

## コード例

\`\`\`js
function greet(name) {
  return \\\`Hello, \\\${name}!\\\`;
}
\`\`\`

> 引用文もサポートされています

| 項目 | 値 |
|---|---|
| フレームワーク | Hono |
| ランタイム | Cloudflare Workers |

---

タスクリスト:
- [x] 完了済み
- [ ] 未完了
</textarea>
        </div>

        <!-- Preview panel -->
        <div class="panel" id="panelPreview">
          <div class="preview-area" id="previewArea"></div>
        </div>

        <!-- Split panel -->
        <div class="panel" id="panelSplit" style="display:none">
          <div style="display:flex; height:500px;">
            <div style="flex:1; overflow:auto; border-right:1px solid var(--border-color);">
              <textarea class="editor-textarea" id="editorSplit" spellcheck="false" style="min-height:100%; height:100%;"></textarea>
            </div>
            <div style="flex:1; overflow:auto;">
              <div class="preview-area" id="previewAreaSplit"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="status-bar">
        <span id="charCount">0 文字</span>
        <span id="lineCount">0 行</span>
      </div>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}

    // --- Simple Markdown parser ---
    function parseMd(src) {
      // Normalize line endings
      src = src.replace(/\\r\\n?/g, '\\n');

      // Fenced code blocks
      var codeBlocks = [];
      src = src.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, function(_, lang, code) {
        var i = codeBlocks.length;
        codeBlocks.push('<pre><code' + (lang ? ' class="language-' + lang + '"' : '') + '>' + esc(code.replace(/\\n$/, '')) + '</code></pre>');
        return '\\x00CB' + i + '\\x00';
      });

      // Inline code (protect from further processing)
      var inlineCodes = [];
      src = src.replace(/\`([^\`]+)\`/g, function(_, code) {
        var i = inlineCodes.length;
        inlineCodes.push('<code>' + esc(code) + '</code>');
        return '\\x00IC' + i + '\\x00';
      });

      // Split into lines for block-level processing
      var lines = src.split('\\n');
      var html = '';
      var i = 0;

      while (i < lines.length) {
        var line = lines[i];

        // Empty line
        if (line.trim() === '') { i++; continue; }

        // Code block placeholder
        var cbMatch = line.match(/^\\x00CB(\\d+)\\x00$/);
        if (cbMatch) { html += codeBlocks[parseInt(cbMatch[1])]; i++; continue; }

        // Heading
        var hMatch = line.match(/^(#{1,6})\\s+(.+)$/);
        if (hMatch) {
          var level = hMatch[1].length;
          html += '<h' + level + '>' + inline(hMatch[2]) + '</h' + level + '>';
          i++; continue;
        }

        // HR
        if (/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(line)) {
          html += '<hr>'; i++; continue;
        }

        // Table
        if (i + 1 < lines.length && /^\\|/.test(line) && /^[\\|\\s:-]+$/.test(lines[i+1])) {
          var tbl = '<table><thead><tr>';
          var heads = splitTableRow(line);
          for (var h = 0; h < heads.length; h++) tbl += '<th>' + inline(heads[h].trim()) + '</th>';
          tbl += '</tr></thead><tbody>';
          i += 2;
          while (i < lines.length && /^\\|/.test(lines[i])) {
            tbl += '<tr>';
            var cells = splitTableRow(lines[i]);
            for (var c = 0; c < cells.length; c++) tbl += '<td>' + inline(cells[c].trim()) + '</td>';
            tbl += '</tr>'; i++;
          }
          tbl += '</tbody></table>';
          html += tbl; continue;
        }

        // Blockquote
        if (/^>\\s?/.test(line)) {
          var bqLines = [];
          while (i < lines.length && /^>\\s?/.test(lines[i])) {
            bqLines.push(lines[i].replace(/^>\\s?/, ''));
            i++;
          }
          html += '<blockquote>' + parseMd(bqLines.join('\\n')) + '</blockquote>';
          continue;
        }

        // Unordered list
        if (/^\\s*[-*+]\\s/.test(line)) {
          html += parseList(lines, i, 'ul');
          while (i < lines.length && (/^\\s*[-*+]\\s/.test(lines[i]) || /^\\s{2,}/.test(lines[i]))) i++;
          continue;
        }

        // Ordered list
        if (/^\\s*\\d+\\.\\s/.test(line)) {
          html += parseList(lines, i, 'ol');
          while (i < lines.length && (/^\\s*\\d+\\.\\s/.test(lines[i]) || /^\\s{2,}/.test(lines[i]))) i++;
          continue;
        }

        // Paragraph
        var pLines = [];
        while (i < lines.length && lines[i].trim() !== '' && !/^#{1,6}\\s/.test(lines[i]) && !/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(lines[i]) && !/^>\\s?/.test(lines[i]) && !/^\\|/.test(lines[i]) && !/^\\x00CB/.test(lines[i])) {
          pLines.push(lines[i]); i++;
        }
        if (pLines.length) html += '<p>' + inline(pLines.join('\\n')) + '</p>';
      }

      // Restore inline code placeholders
      html = html.replace(/\\x00IC(\\d+)\\x00/g, function(_, idx) { return inlineCodes[parseInt(idx)]; });

      return html;
    }

    function splitTableRow(line) {
      return line.replace(/^\\|\\s*/, '').replace(/\\s*\\|$/, '').split(/\\s*\\|\\s*/);
    }

    function parseList(lines, start, tag) {
      var items = [];
      var i = start;
      var pattern = tag === 'ul' ? /^\\s*[-*+]\\s(.*)/ : /^\\s*\\d+\\.\\s(.*)/;
      while (i < lines.length) {
        var m = lines[i].match(pattern);
        if (m) {
          var text = m[1];
          // Check for task list
          var taskMatch = text.match(/^\\[([ xX])\\]\\s(.*)/);
          if (taskMatch) {
            var checked = taskMatch[1] !== ' ' ? ' checked disabled' : ' disabled';
            items.push('<li class="task-list-item"><input type="checkbox"' + checked + '>' + inline(taskMatch[2]) + '</li>');
          } else {
            items.push('<li>' + inline(text) + '</li>');
          }
          i++;
        } else {
          break;
        }
      }
      return '<' + tag + '>' + items.join('') + '</' + tag + '>';
    }

    function inline(text) {
      // Images
      text = text.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, '<img src="$2" alt="$1">');
      // Links
      text = text.replace(/\\[([^\\]]*)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      // Bold + Italic
      text = text.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
      // Bold
      text = text.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
      text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
      // Italic
      text = text.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
      text = text.replace(/_(.+?)_/g, '<em>$1</em>');
      // Strikethrough
      text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
      // Line break
      text = text.replace(/\\n/g, '<br>');
      return text;
    }

    function esc(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // --- UI logic ---
    var editor = document.getElementById('editor');
    var editorSplit = document.getElementById('editorSplit');
    var previewArea = document.getElementById('previewArea');
    var previewAreaSplit = document.getElementById('previewAreaSplit');
    var currentTab = 'edit';

    function switchTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
      document.getElementById('panelEdit').classList.toggle('active', tab === 'edit');
      document.getElementById('panelPreview').classList.toggle('active', tab === 'preview');
      var splitPanel = document.getElementById('panelSplit');
      if (tab === 'split') {
        splitPanel.style.display = 'block';
        splitPanel.classList.add('active');
        editorSplit.value = editor.value;
        updatePreview();
      } else {
        splitPanel.style.display = 'none';
        splitPanel.classList.remove('active');
      }
      if (tab === 'preview') updatePreview();
    }

    function updatePreview() {
      var md = editor.value;
      if (currentTab === 'preview') {
        previewArea.innerHTML = md.trim() ? parseMd(md) : '<div class="empty-state"><div class="empty-state-icon">M&darr;</div><div class="empty-state-text">Markdown を入力するとプレビューが表示されます</div></div>';
      }
      if (currentTab === 'split') {
        previewAreaSplit.innerHTML = editorSplit.value.trim() ? parseMd(editorSplit.value) : '';
      }
    }

    function updateStatus() {
      var text = currentTab === 'split' ? editorSplit.value : editor.value;
      document.getElementById('charCount').textContent = text.length + ' 文字';
      document.getElementById('lineCount').textContent = text.split('\\n').length + ' 行';
    }

    editor.addEventListener('input', function() {
      if (currentTab === 'split') editorSplit.value = editor.value;
      updateStatus();
    });

    editorSplit.addEventListener('input', function() {
      editor.value = editorSplit.value;
      updatePreview();
      updateStatus();
    });

    // Live preview for split mode
    var splitTimer;
    editorSplit.addEventListener('input', function() {
      clearTimeout(splitTimer);
      splitTimer = setTimeout(updatePreview, 150);
    });

    // File open
    document.getElementById('fileInput').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      document.getElementById('fileName').value = file.name;
      var reader = new FileReader();
      reader.onload = function(ev) {
        editor.value = ev.target.result;
        editorSplit.value = ev.target.result;
        updateStatus();
        if (currentTab === 'preview' || currentTab === 'split') updatePreview();
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Download
    function downloadFile() {
      var text = editor.value;
      var name = document.getElementById('fileName').value || 'document.md';
      var blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    // Drag & drop
    var container = document.getElementById('panelContainer');
    var dropOverlay = document.getElementById('dropOverlay');
    var dragCount = 0;

    container.addEventListener('dragenter', function(e) {
      e.preventDefault();
      dragCount++;
      dropOverlay.classList.add('active');
    });

    container.addEventListener('dragleave', function(e) {
      e.preventDefault();
      dragCount--;
      if (dragCount <= 0) { dropOverlay.classList.remove('active'); dragCount = 0; }
    });

    container.addEventListener('dragover', function(e) { e.preventDefault(); });

    container.addEventListener('drop', function(e) {
      e.preventDefault();
      dragCount = 0;
      dropOverlay.classList.remove('active');
      var file = e.dataTransfer.files[0];
      if (!file) return;
      document.getElementById('fileName').value = file.name;
      var reader = new FileReader();
      reader.onload = function(ev) {
        editor.value = ev.target.result;
        editorSplit.value = ev.target.result;
        updateStatus();
        if (currentTab === 'preview' || currentTab === 'split') updatePreview();
      };
      reader.readAsText(file);
    });

    // Tab key support in editor
    function handleTab(textarea, e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var start = textarea.selectionStart;
        var end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        textarea.dispatchEvent(new Event('input'));
      }
    }
    editor.addEventListener('keydown', function(e) { handleTab(editor, e); });
    editorSplit.addEventListener('keydown', function(e) { handleTab(editorSplit, e); });

    // Init
    updateStatus();
  </script>
</body>
</html>`;
}
