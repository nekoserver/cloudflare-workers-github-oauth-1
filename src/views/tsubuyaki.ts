import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import { SLACK_POST_TEMPLATES, buildFreeTextSlackBlocks, buildFreeTextSlackMessage } from '../utils/freeTextSlackPost';

const PREVIEW_DISPLAY_NAME = 'あなたの表示名';
const PREVIEW_TEXT = '（ここに入力した本文が入ります）';

function buildTemplateSnippet(templateId: typeof SLACK_POST_TEMPLATES[number]['id']): string {
  if (templateId === 'plain') {
    return JSON.stringify({ text: buildFreeTextSlackMessage(PREVIEW_DISPLAY_NAME, PREVIEW_TEXT) }, null, 2);
  }
  const blocks = buildFreeTextSlackBlocks(PREVIEW_DISPLAY_NAME, PREVIEW_TEXT, templateId);
  return JSON.stringify(blocks, null, 2);
}

export function getTsubuyakiPage(username: string): string {
  const safeUsername = escapeHtml(username);

  const sidebarIcons = SLACK_POST_TEMPLATES.map((template, index) => `
        <button type="button" class="sidebar-icon${index === 0 ? ' selected' : ''}" data-template="${template.id}" title="${escapeHtml(template.title)} - ${escapeHtml(template.description)}" aria-pressed="${index === 0 ? 'true' : 'false'}">
          <span>${template.emoji}</span>
        </button>`).join('');

  const templatesPayload = SLACK_POST_TEMPLATES.map((template) => ({
    id: template.id,
    emoji: template.emoji,
    title: template.title,
    description: template.description,
    snippet: buildTemplateSnippet(template.id),
  }));
  const templatesJson = JSON.stringify(templatesPayload).replace(/<\/script/gi, '<\\/script');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>つぶやき投稿 - Cloudflare Workers GitHub OAuth</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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
    .navbar-brand { font-size: 20px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
    .user-menu { display: flex; align-items: center; gap: 12px; }
    .user-name { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
    .user-icon {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 16px; cursor: pointer;
    }
    .user-menu-container { position: relative; }
    .dropdown-menu {
      display: none; position: absolute; top: 50px; right: 0;
      background: var(--dropdown-bg); border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; z-index: 1000; overflow: hidden;
    }
    .dropdown-menu.show { display: block; }
    .dropdown-item {
      padding: 12px 20px; color: var(--text-secondary); text-decoration: none;
      display: block; cursor: pointer; border-bottom: 1px solid var(--border-color);
      transition: background 0.2s ease;
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item:hover { background: var(--dropdown-hover); }
    .dropdown-item.switch-account { color: var(--accent-color); }
    .dropdown-item.logout { color: var(--danger-color); }

    .layout { display: flex; align-items: flex-start; }
    .template-sidebar {
      flex: 0 0 64px; width: 64px; position: sticky; top: 0;
      height: calc(100vh - 73px); overflow-y: auto;
      display: flex; flex-direction: column; gap: 8px;
      padding: 16px 8px; background: var(--card-bg); border-right: 1px solid var(--border-color);
    }
    .sidebar-icon {
      width: 48px; height: 48px; flex: 0 0 auto; border-radius: 10px;
      border: 1px solid var(--input-border); background: var(--input-bg);
      font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: var(--text-primary);
    }
    .sidebar-icon:hover { border-color: var(--accent-color); }
    .sidebar-icon.selected { border-color: var(--accent-color); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 20%, transparent); }

    .container { flex: 1; max-width: 640px; margin: 0 auto; padding: 48px 32px; }
    .post-card {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow); padding: 48px;
    }
    .post-title { font-size: 32px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .post-subtitle { font-size: 15px; color: var(--text-muted); margin-bottom: 28px; }

    .snippet-heading { font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; }
    .snippet-card { margin-bottom: 18px; }
    .snippet-info { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .snippet-emoji { font-size: 22px; }
    .snippet-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
    .snippet-desc { font-size: 12px; color: var(--text-muted); }
    .snippet-code-wrap { position: relative; }
    .snippet-code-wrap .snippet-code { padding-right: 78px; }
    .snippet-code {
      margin: 0; padding: 12px; overflow: auto; max-height: 220px;
      border: 1px solid var(--border-color); border-radius: 8px; background: var(--code-bg);
      color: var(--text-primary); white-space: pre-wrap; word-break: break-word;
      font: 12px/1.6 'Monaco', 'Courier New', monospace;
    }
    .snippet-run-button {
      position: absolute; top: 8px; right: 8px; z-index: 1;
      border: 1px solid var(--success-color); border-radius: 7px; padding: 6px 9px;
      background: var(--card-bg); color: var(--success-color); cursor: pointer;
      font: 700 12px/1.4 'Monaco', 'Courier New', monospace;
    }
    .snippet-run-button:hover, .snippet-run-button:focus-visible { background: var(--success-color); color: white; }
    .applied-template { font-size: 12px; color: var(--text-muted); margin: 10px 0 0; }
    .applied-template strong { color: var(--text-primary); }

    textarea {
      width: 100%; min-height: 160px; resize: vertical;
      background: var(--input-bg); color: var(--text-primary);
      border: 1px solid var(--input-border); border-radius: 10px;
      padding: 14px; font-size: 15px; font-family: inherit; line-height: 1.6;
    }
    textarea:focus { outline: none; border-color: var(--accent-color); }
    .char-count { text-align: right; font-size: 12px; color: var(--text-muted); margin-top: 6px; }
    .char-count.over { color: var(--danger-color); font-weight: 600; }
    .post-btn {
      margin-top: 20px; width: 100%;
      background: var(--accent-color); color: white; border: none; border-radius: 10px;
      padding: 14px 24px; font-size: 15px; font-weight: 700; cursor: pointer;
      transition: background 0.15s ease;
    }
    .post-btn:hover:not(:disabled) { background: var(--accent-hover); }
    .post-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .status-msg {
      margin-top: 16px; padding: 12px 16px; border-radius: 8px; font-size: 14px;
      display: none;
    }
    .status-msg.show { display: block; }
    .status-msg.success { background: rgba(72, 187, 120, 0.15); color: var(--success-color); }
    .status-msg.error { background: rgba(229, 62, 62, 0.15); color: var(--danger-color); }
    .back-link {
      display: inline-block; margin-top: 24px; color: var(--accent-color); text-decoration: none; font-size: 14px;
    }
    .back-link:hover { text-decoration: underline; }
    @media (max-width: 560px) {
      .layout { flex-direction: column; }
      .template-sidebar {
        flex: 0 0 auto; width: 100%; height: auto; position: static;
        flex-direction: row; overflow-x: auto; overflow-y: hidden;
      }
      .container { padding: 24px 14px; }
      .post-card { padding: 26px 18px; }
    }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>📮</span>
      <span>つぶやき投稿</span>
    </div>
    <div class="user-menu">
      ${getThemeToggleHTML()}
      <span class="user-name">${safeUsername}</span>
      <div class="user-menu-container">
        <div class="user-icon" title="${safeUsername}" onclick="toggleDropdown()">
          ${escapeHtml(username.substring(0, 2).toUpperCase())}
        </div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/settings" class="dropdown-item">⚙️ 設定</a>
          <a href="/api-keys" class="dropdown-item">🔑 キー管理</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="layout">
    <aside class="template-sidebar" id="templateSidebar" aria-label="Block Kit テンプレート一覧（${SLACK_POST_TEMPLATES.length}種類）">
${sidebarIcons}
    </aside>

    <div class="container">
      <div class="post-card">
        <h1 class="post-title">📮 つぶやき投稿</h1>
        <p class="post-subtitle">自由に書いた一言をSlackに投稿できます。</p>

        <h2 class="snippet-heading">Block Kit テンプレート（${SLACK_POST_TEMPLATES.length}種類）— 左のアイコンから選ぶとここにプレビューが表示されます</h2>
        <div class="snippet-card">
          <div class="snippet-info">
            <span class="snippet-emoji" id="snippetEmoji">💬</span>
            <div>
              <div class="snippet-title" id="snippetTitle">フリーメッセージ</div>
              <div class="snippet-desc" id="snippetDesc">自由な内容をそのまま共有</div>
            </div>
          </div>
          <div class="snippet-code-wrap">
            <pre class="snippet-code" id="snippetCode"></pre>
            <button type="button" class="snippet-run-button" id="applyTemplateButton" title="このテンプレートを使う">Run▶︎</button>
          </div>
          <p class="applied-template" id="appliedTemplateLabel">使用中のテンプレート: <strong>💬 フリーメッセージ</strong></p>
        </div>

        <textarea id="freeText" placeholder="ここに投稿したい内容を書いてください…" maxlength="3000"></textarea>
        <div class="char-count" id="charCount">0 / 3000</div>
        <button class="post-btn" id="postBtn" onclick="postToSlack()">📮 Slackに投稿する</button>
        <div class="status-msg" id="statusMsg"></div>

        <a href="/welcome" class="back-link">← ホームに戻る</a>
      </div>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}

    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('show');
    }
    window.addEventListener('click', function(e) {
      var icon = document.querySelector('.user-icon');
      var dd = document.getElementById('dropdownMenu');
      if (!icon.contains(e.target) && !dd.contains(e.target)) dd.classList.remove('show');
    });

    var TEMPLATES = ${templatesJson};
    var freeTextEl = document.getElementById('freeText');
    var charCountEl = document.getElementById('charCount');
    var postBtnEl = document.getElementById('postBtn');
    var statusMsgEl = document.getElementById('statusMsg');
    var snippetEmojiEl = document.getElementById('snippetEmoji');
    var snippetTitleEl = document.getElementById('snippetTitle');
    var snippetDescEl = document.getElementById('snippetDesc');
    var snippetCodeEl = document.getElementById('snippetCode');
    var appliedTemplateLabelEl = document.getElementById('appliedTemplateLabel');
    var previewTemplate = TEMPLATES[0];
    var selectedTemplate = TEMPLATES[0].id;
    var MAX_LEN = 3000;

    function findTemplate(id) {
      for (var i = 0; i < TEMPLATES.length; i++) {
        if (TEMPLATES[i].id === id) return TEMPLATES[i];
      }
      return TEMPLATES[0];
    }

    function renderPreview(template) {
      previewTemplate = template;
      snippetEmojiEl.textContent = template.emoji;
      snippetTitleEl.textContent = template.title;
      snippetDescEl.textContent = template.description;
      snippetCodeEl.textContent = template.snippet;
    }

    function renderAppliedLabel() {
      var template = findTemplate(selectedTemplate);
      appliedTemplateLabelEl.innerHTML = '使用中のテンプレート: <strong>' + template.emoji + ' ' + template.title + '</strong>';
    }

    document.getElementById('templateSidebar').addEventListener('click', function(e) {
      var icon = e.target.closest('.sidebar-icon');
      if (!icon) return;
      var template = findTemplate(icon.dataset.template);
      renderPreview(template);
      document.querySelectorAll('.sidebar-icon').forEach(function(item) {
        var selected = item === icon;
        item.classList.toggle('selected', selected);
        item.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    });

    document.getElementById('applyTemplateButton').addEventListener('click', function() {
      selectedTemplate = previewTemplate.id;
      if (selectedTemplate === 'interactive_sample') {
        freeTextEl.value = '更新時間: ' + new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false }) + '（日本時間）';
        freeTextEl.dispatchEvent(new Event('input'));
      }
      renderAppliedLabel();
      freeTextEl.focus();
    });

    renderPreview(TEMPLATES[0]);
    renderAppliedLabel();

    freeTextEl.addEventListener('input', function() {
      var len = freeTextEl.value.length;
      charCountEl.textContent = len + ' / ' + MAX_LEN;
      charCountEl.classList.toggle('over', len > MAX_LEN);
    });

    function showStatus(kind, text) {
      statusMsgEl.textContent = text;
      statusMsgEl.className = 'status-msg show ' + kind;
    }

    function postToSlack() {
      var text = freeTextEl.value.trim();
      if (!text) {
        showStatus('error', '本文が空です');
        return;
      }
      postBtnEl.disabled = true;
      postBtnEl.textContent = '投稿中…';
      fetch('/api/tsubuyaki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: text, template: selectedTemplate })
      }).then(function(r) { return r.json().then(function(data) { return { status: r.status, data: data }; }); })
        .then(function(res) {
          if (res.status >= 200 && res.status < 300 && res.data.ok) {
            showStatus('success', '✅ Slackに投稿しました');
            freeTextEl.value = '';
            charCountEl.textContent = '0 / ' + MAX_LEN;
            charCountEl.classList.remove('over');
          } else {
            showStatus('error', '❌ ' + (res.data.error || '投稿に失敗しました'));
          }
        })
        .catch(function() {
          showStatus('error', '❌ 通信エラーが発生しました');
        })
        .finally(function() {
          postBtnEl.disabled = false;
          postBtnEl.textContent = '📮 Slackに投稿する';
        });
    }
  </script>
</body>
</html>`;
}
