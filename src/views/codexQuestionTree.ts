import { getMarkdownParserScript } from '../utils/markdownRenderer';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

/** ブラウザ用コードを文字列で保持し、Workerビルドの補助関数に依存させない。 */
export function getCodexQuestionTreeClientScript(): string {
  return String.raw`(function() {
  const tree = document.getElementById('question-tree');
  const status = document.getElementById('status');
  const more = document.getElementById('load-more');
  const search = document.getElementById('search');
  let cursor = null;
  let rows = [];
  const dialog = document.getElementById('keyword-dialog');
  const badges = document.getElementById('keyword-badges');
  const categoryBadges = document.getElementById('keyword-categories');
  let modalRequest = 0;
  let jumpSerial = 0;
  document.getElementById('keyword-close').onclick = () => dialog.close();
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  function jumpToKeyword(answer, keyword, id) {
    const walker = document.createTreeWalker(answer, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let text = '', node;
    while ((node = walker.nextNode())) { nodes.push({ node, start: text.length }); text += node.textContent; }
    const start = text.indexOf(keyword);
    if (start < 0) { status.textContent = 'このキーワードは回答の表示本文に見つかりませんでした。'; return; }
    const end = start + keyword.length;
    const range = document.createRange();
    for (const item of nodes) {
      const limit = item.start + item.node.textContent.length;
      if (start >= item.start && start < limit) range.setStart(item.node, start - item.start);
      if (end > item.start && end <= limit) range.setEnd(item.node, end - item.start);
    }
    const mark = document.createElement('mark');
    mark.id = id; mark.className = 'keyword-hit'; mark.tabIndex = -1;
    mark.appendChild(range.extractContents()); range.insertNode(mark);
    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    mark.focus({ preventScroll: true });
  }
  async function showKeywords(row, question, loadAnswer) {
    const request = ++modalRequest;
    badges.textContent = '読み込み中…';
    categoryBadges.replaceChildren();
    dialog.showModal();
    try {
      const response = await fetch('/api/mcp-sample/codex-questions/' + encodeURIComponent(row.id) + '/keywords');
      if (!response.ok) throw new Error('キーワードを取得できませんでした（HTTP ' + response.status + '）');
      const data = await response.json();
      if (request !== modalRequest || !dialog.open) return;
      badges.replaceChildren();
      const keywordLinks = [];
      const categoryButtons = [];
      let selectedCategory = null;
      function colorFor(category) { return /^#[0-9a-f]{6}$/i.test(category.color || '') ? category.color : '#6366f1'; }
      // 分類色に合わせ、黒または白のうち読みやすい文字色を選ぶ。
      function inkFor(color) {
        const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179 ? '#000000' : '#ffffff';
      }
      for (const category of (data.categories || []).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))) {
        const button = document.createElement('button');
        const color = colorFor(category);
        button.type = 'button'; button.className = 'keyword-category';
        button.textContent = '(' + category.count + ')' + category.name;
        button.style.backgroundColor = color; button.style.color = inkFor(color);
        button.setAttribute('aria-pressed', 'false');
        button.onclick = () => {
          selectedCategory = selectedCategory === category.id ? null : category.id;
          for (const item of categoryButtons) item.button.setAttribute('aria-pressed', String(item.id === selectedCategory));
          for (const item of keywordLinks) {
            const selected = selectedCategory !== null && item.categoryIds.includes(selectedCategory);
            item.link.classList.toggle('keyword-category-highlight', selected);
            for (const property of ['background-color', 'color', 'border-color']) item.link.style.removeProperty(property);
            if (selected) { item.link.style.backgroundColor = color; item.link.style.color = inkFor(color); item.link.style.borderColor = color; }
          }
        };
        categoryButtons.push({ button, id: category.id }); categoryBadges.appendChild(button);
      }
      for (const item of data.keywords.sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))) {
        const id = 'keyword-hit-' + (++jumpSerial);
        const link = document.createElement('a');
        link.className = 'keyword-badge'; link.href = '#' + id;
        link.textContent = item.keyword + '(' + item.count + ')';
        link.onclick = async event => {
          event.preventDefault(); dialog.close();
          for (let element = question; element; element = element.parentElement) {
            if (element.tagName === 'DETAILS') element.open = true;
          }
          try { jumpToKeyword(await loadAnswer(), item.keyword, id); }
          catch (error) { status.textContent = error.message; }
        };
        keywordLinks.push({ link, categoryIds: item.categoryIds || [] });
        badges.appendChild(link);
      }
      if (!data.keywords.length) badges.textContent = 'この回答に含まれる登録キーワードはありません。';
    } catch (error) { if (request === modalRequest && dialog.open) badges.textContent = error.message; }
  }
  function render() {
    tree.replaceChildren();
    const dates = new Map();
    for (const row of rows) {
      if (!row.question.toLowerCase().includes(search.value.toLowerCase())) continue;
      const date = (row.created_at || '').slice(0, 10) || '日付不明';
      if (!dates.has(date)) dates.set(date, new Map());
      const threads = dates.get(date);
      const key = row.thread_id || '単独の質問';
      if (!threads.has(key)) threads.set(key, []);
      threads.get(key).push(row);
    }
    function folder(parent, label) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = '📁 ' + label;
      details.appendChild(summary);
      parent.appendChild(details);
      return details;
    }
    for (const [date, threads] of dates) {
      const day = folder(tree, date);
      for (const [thread, questions] of threads) {
        const firstQuestion = questions[questions.length - 1].question.replace(/\s+/g, ' ').trim();
        const threadName = thread === '単独の質問' ? thread : (firstQuestion.slice(0, 60) + (firstQuestion.length > 60 ? '…' : '') || '質問文なし');
        const group = folder(day, threadName + '（' + questions.length + '件）');
        for (const row of questions) {
          const question = folder(group, row.question.replace(/\s+/g, ' ').slice(0, 100) || '質問文なし');
          let answerReady = null;
          let content = null;
          function loadAnswer() {
            if (answerReady) return answerReady;
            if (content) content.remove();
            content = document.createElement('div');
            content.className = 'question-content';
            const answerTitle = document.createElement('h3');
            answerTitle.textContent = 'Codexの回答';
            const answer = document.createElement('div');
            answer.className = 'markdown-body';
            answer.textContent = '読み込み中…';
            content.appendChild(answerTitle); content.appendChild(answer);
            question.appendChild(content);
            answerReady = fetch('/api/mcp-sample/codex-questions/' + encodeURIComponent(row.id)).then(async response => {
              if (!response.ok) {
                const messages = { 400: '質問IDが正しくありません', 401: 'ログインの有効期限が切れています。再ログインしてください', 404: '回答が見つかりません。削除された可能性があります', 503: 'データベースを利用できません' };
                throw new Error('回答を取得できませんでした（HTTP ' + response.status + '）：' + (messages[response.status] || 'サーバーでエラーが発生しました'));
              }
              const data = await response.json();
              answer.innerHTML = parseMd(data.answer || '回答なし');
              return answer;
            }).catch(error => {
              answerReady = null;
              answer.textContent = error.message;
              const retry = document.createElement('button');
              retry.textContent = '再試行';
              retry.onclick = () => loadAnswer().catch(() => {});
              content.appendChild(retry);
              throw error;
            });
            return answerReady;
          }
          question.addEventListener('toggle', () => { if (question.open) loadAnswer().catch(() => {}); });
          if (row.has_keywords) {
            const key = document.createElement('button');
            key.type = 'button'; key.className = 'keyword-key'; key.textContent = '🔑';
            key.setAttribute('aria-label', 'この回答のキーワードを表示');
            key.onclick = event => { event.preventDefault(); event.stopPropagation(); showKeywords(row, question, loadAnswer); };
            question.querySelector('summary').appendChild(key);
          }
        }
      }
    }
    status.textContent = rows.length ? rows.length + '件を読み込み済み' + (dates.size ? '' : '・検索結果なし') : 'Codexの質問ログはまだありません。';
  }
  async function load() {
    more.disabled = true;
    status.textContent = '読み込み中…';
    try {
      const response = await fetch('/api/mcp-sample/codex-questions' + (cursor === null ? '' : '?before=' + encodeURIComponent(cursor)));
      if (!response.ok) throw new Error('ログを取得できませんでした。ログイン状態を確認してください。');
      const data = await response.json();
      rows = rows.concat(data.items);
      cursor = data.nextCursor;
      more.hidden = cursor === null;
      render();
    } catch (error) { status.textContent = error.message; }
    finally { more.disabled = false; }
  }
  search.addEventListener('input', render);
  more.addEventListener('click', load);
  load();
})();`;
}

export function getCodexQuestionTreePage(): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Codex質問ツリー · MCPサンプル</title>${getThemeInitScript()}<style>${getThemeCSS()}${getThemeToggleCSS()}
  *{box-sizing:border-box}body{margin:0;background:var(--bg-primary);color:var(--text-primary);font-family:system-ui,sans-serif}header{height:44px;position:sticky;top:0;background:var(--navbar-bg);border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;padding:0 20px}main{max-width:1000px;margin:32px auto;padding:0 20px}h1{font-size:1.6rem}p,#status{color:var(--text-muted)}a{color:var(--accent-color)}input{width:100%;padding:12px;background:var(--input-bg);color:var(--text-primary);border:1px solid var(--input-border);border-radius:8px}details{margin:10px 0 10px 14px;border-left:1px solid var(--border-color);padding-left:12px}summary{cursor:pointer;padding:8px;overflow-wrap:anywhere;border-radius:6px}summary:hover{background:var(--bg-secondary)}summary:focus-visible,button:focus-visible{outline:2px solid var(--accent-color)}.question-content{background:var(--card-bg);padding:16px;border:1px solid var(--border-color);border-radius:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.7}button{padding:10px;background:var(--card-bg);color:var(--text-primary);border:1px solid var(--border-color);border-radius:6px}.keyword-key{margin-left:8px;padding:2px 6px}.keyword-dialog{width:min(700px,calc(100vw - 24px));max-height:80vh;padding:20px;border:1px solid var(--border-color);border-radius:12px;background:var(--card-bg);color:var(--text-primary);overflow:auto}.keyword-dialog::backdrop{background:var(--modal-overlay)}.keyword-dialog-header{display:flex;justify-content:space-between;align-items:center;gap:12px}.keyword-dialog h2{font-size:1.2rem;margin:0}.keyword-categories:empty{display:none}.keyword-category{border-radius:16px;padding:6px 10px;max-width:100%;overflow-wrap:anywhere}.keyword-category[aria-pressed="true"]{outline:2px solid var(--accent-color);outline-offset:2px}.keyword-category-highlight{font-weight:700}.keyword-categories,.keyword-badges{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:flex-start;gap:8px;margin-top:18px}.keyword-badge{display:inline-block;padding:6px 10px;border:1px solid var(--border-color);border-radius:16px;background:var(--badge-bg);color:var(--accent-color);text-decoration:none;overflow-wrap:anywhere;max-width:100%}.keyword-hit{background:var(--badge-bg);color:var(--text-primary);outline:2px solid var(--accent-color);scroll-margin-top:70px}.keyword-badge:focus-visible{outline:2px solid var(--accent-color)}.markdown-body{line-height:1.7;overflow-wrap:anywhere;overflow-x:auto}.markdown-body p{color:var(--text-primary)}.markdown-body pre{background:var(--code-bg);padding:12px;overflow-x:auto;white-space:pre;font-family:monospace}.markdown-body code{background:var(--code-bg);font-family:monospace}.markdown-body table{border-collapse:collapse;max-width:100%}.markdown-body th,.markdown-body td{border:1px solid var(--border-color);padding:8px}.markdown-body blockquote{margin-left:0;padding-left:14px;border-left:3px solid var(--accent-color);color:var(--text-secondary)}.markdown-body img{max-width:100%;height:auto}#question-tree{margin-left:-14px}@media(max-width:600px){main{padding:0 12px}details{margin-left:6px;padding-left:6px}.question-content{padding:10px}}
  </style></head><body><header><strong>MCPサンプル</strong>${getThemeToggleHTML()}</header><main><p><a href="/thread-tracker">スレッド追跡</a> · <a href="/aichat">AIチャット</a></p><input id="search" type="search" aria-label="質問文で絞り込み" placeholder="質問文で絞り込み"><p id="status" role="status" aria-live="polite"></p><section id="question-tree" aria-label="Codex質問フォルダ"></section><button id="load-more">さらに読み込む</button></main><dialog id="keyword-dialog" class="keyword-dialog" aria-labelledby="keyword-dialog-title"><div class="keyword-dialog-header"><h2 id="keyword-dialog-title">回答のキーワード</h2><button id="keyword-close" type="button" aria-label="キーワードを閉じる">閉じる</button></div><div id="keyword-categories" class="keyword-categories" role="group" aria-label="中分類カテゴリ"></div><div id="keyword-badges" class="keyword-badges" role="status" aria-live="polite"></div></dialog><script>${getThemeToggleScript()}</script><script>${getMarkdownParserScript()}
${getCodexQuestionTreeClientScript()}</script></body></html>`;
}
