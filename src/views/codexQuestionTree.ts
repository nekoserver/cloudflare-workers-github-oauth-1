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
          question.addEventListener('toggle', () => {
            if (!question.open || question.dataset.loaded) return;
            question.dataset.loaded = 'true';
            const content = document.createElement('div');
            content.className = 'question-content';
            const answerTitle = document.createElement('h3');
            answerTitle.textContent = 'Codexの回答';
            const answer = document.createElement('div');
            answer.className = 'markdown-body';
            answer.textContent = '読み込み中…';
            for (const element of [answerTitle, answer]) content.appendChild(element);
            question.appendChild(content);
            fetch('/api/mcp-sample/codex-questions/' + encodeURIComponent(row.id)).then(async response => {
              if (!response.ok) {
                const messages = { 400: '質問IDが正しくありません', 401: 'ログインの有効期限が切れています。再ログインしてください', 404: '回答が見つかりません。削除された可能性があります', 503: 'データベースを利用できません' };
                throw new Error('回答を取得できませんでした（HTTP ' + response.status + '）：' + (messages[response.status] || 'サーバーでエラーが発生しました'));
              }
              const data = await response.json();
              answer.innerHTML = parseMd(data.answer || '回答なし');
            }).catch(error => {
              answer.textContent = error.message;
              const retry = document.createElement('button');
              retry.textContent = '再試行';
              retry.onclick = () => { content.remove(); delete question.dataset.loaded; question.open = false; question.open = true; };
              content.appendChild(retry);
            });
          });
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
  *{box-sizing:border-box}body{margin:0;background:var(--bg-primary);color:var(--text-primary);font-family:system-ui,sans-serif}header{height:44px;position:sticky;top:0;background:var(--navbar-bg);border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;padding:0 20px}main{max-width:1000px;margin:32px auto;padding:0 20px}h1{font-size:1.6rem}p,#status{color:var(--text-muted)}a{color:var(--accent-color)}input{width:100%;padding:12px;background:var(--input-bg);color:var(--text-primary);border:1px solid var(--input-border);border-radius:8px}details{margin:10px 0 10px 14px;border-left:1px solid var(--border-color);padding-left:12px}summary{cursor:pointer;padding:8px;overflow-wrap:anywhere;border-radius:6px}summary:hover{background:var(--bg-secondary)}summary:focus-visible,button:focus-visible{outline:2px solid var(--accent-color)}.question-content{background:var(--card-bg);padding:16px;border:1px solid var(--border-color);border-radius:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.7}button{padding:10px;background:var(--card-bg);color:var(--text-primary);border:1px solid var(--border-color);border-radius:6px}.markdown-body{line-height:1.7;overflow-wrap:anywhere;overflow-x:auto}.markdown-body p{color:var(--text-primary)}.markdown-body pre{background:var(--code-bg);padding:12px;overflow-x:auto;white-space:pre;font-family:monospace}.markdown-body code{background:var(--code-bg);font-family:monospace}.markdown-body table{border-collapse:collapse;max-width:100%}.markdown-body th,.markdown-body td{border:1px solid var(--border-color);padding:8px}.markdown-body blockquote{margin-left:0;padding-left:14px;border-left:3px solid var(--accent-color);color:var(--text-secondary)}.markdown-body img{max-width:100%;height:auto}#question-tree{margin-left:-14px}@media(max-width:600px){main{padding:0 12px}details{margin-left:6px;padding-left:6px}.question-content{padding:10px}}
  </style></head><body><header><strong>MCPサンプル</strong>${getThemeToggleHTML()}</header><main><p><a href="/thread-tracker">スレッド追跡</a> · <a href="/aichat">AIチャット</a></p><input id="search" type="search" aria-label="質問文で絞り込み" placeholder="質問文で絞り込み"><p id="status" role="status" aria-live="polite"></p><section id="question-tree" aria-label="Codex質問フォルダ"></section><button id="load-more">さらに読み込む</button></main><script>${getThemeToggleScript()}</script><script>${getMarkdownParserScript()}
${getCodexQuestionTreeClientScript()}</script></body></html>`;
}
