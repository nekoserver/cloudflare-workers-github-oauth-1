import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

/**
 * /muse-search のCSP。ページの script はインラインで、通信は同じオリジンの /api/muse-search だけ。
 * 外部の読み込み・埋め込みは許さない。
 */
export const MUSE_SEARCH_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/**
 * /muse-search のページ script(2026-11-19)。依存を受け取る関数に分け、museSearch.test.ts で動かす。
 * 上流から来た文字列(会話の一部・チャットID・エラーの理由)は、textContent でしか表示しない。
 * このファイルのscriptはTypeScriptのtemplate literalの中にあるので、バックスラッシュ・正規表現・バッククォートを書かない。
 */
export const MUSE_SEARCH_SCRIPT = `
    var MUSE_SEARCH_ROLE_LABELS = { user: '質問', assistant: '回答' };

    function pad2(n) { return n < 10 ? '0' + n : String(n); }
    // 日本時間(UTC+9)の「YYYY/MM/DD HH:MM:SS」。日本は夏時間が無いので、9時間を足して UTC として読めばよい。
    function formatMuseSearchTime(sec) {
      var d = new Date(sec * 1000 + 9 * 60 * 60 * 1000);
      return d.getUTCFullYear() + '/' + pad2(d.getUTCMonth() + 1) + '/' + pad2(d.getUTCDate()) + ' ' +
        pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
    }

    function museSearchEl(doc, tag, className, text) {
      var el = doc.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    }

    function renderMuseSearchItem(doc, post) {
      var item = museSearchEl(doc, 'li', 'muse-search-item');
      var head = museSearchEl(doc, 'div', 'muse-search-head');
      head.appendChild(museSearchEl(doc, 'span', 'muse-search-role muse-search-role-' + post.role, MUSE_SEARCH_ROLE_LABELS[post.role] || post.role));
      head.getElementsByTagName('span')[0].setAttribute('data-field', 'role');
      head.appendChild(museSearchEl(doc, 'span', 'muse-search-meta', formatMuseSearchTime(post.createdAt)));
      head.appendChild(museSearchEl(doc, 'span', 'muse-search-meta', 'チャット ' + post.chatId));
      if (post.threadMark) head.appendChild(museSearchEl(doc, 'span', 'muse-search-meta', 'スレッド化済み'));
      item.appendChild(head);
      var body = museSearchEl(doc, 'p', 'muse-search-snippet');
      body.appendChild(doc.createTextNode(post.snippet.before));
      if (post.snippet.match) body.appendChild(museSearchEl(doc, 'mark', '', post.snippet.match));
      body.appendChild(doc.createTextNode(post.snippet.after));
      item.appendChild(body);
      return item;
    }

    function initMuseSearchPage(doc, fetchFn) {
      var form = doc.querySelector('form');
      var input = doc.querySelector('input[name="q"]');
      var button = doc.querySelector('button[type="submit"]');
      var status = doc.querySelector('[data-field="status"]');
      var list = doc.querySelector('[data-field="results"]');
      var busy = false;

      function clearResults() {
        while (list.firstChild) list.removeChild(list.firstChild);
      }
      function fail(text) {
        clearResults();
        status.textContent = text;
        status.className = 'muse-search-status muse-search-error';
      }

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (busy) return;
        var query = input.value.trim();
        if (!query) {
          clearResults();
          status.className = 'muse-search-status';
          status.textContent = '検索する文字を入力してください。';
          return;
        }
        busy = true;
        button.disabled = true;
        status.className = 'muse-search-status';
        status.textContent = '検索しています…';
        fetchFn('/api/muse-search?q=' + encodeURIComponent(query)).then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
        }).then(function (r) {
          if (!r.ok) {
            var detail = r.data && r.data.detail ? r.data.detail : (r.data && r.data.error ? r.data.error : '');
            fail('検索できませんでした(HTTP ' + r.status + ')' + (detail ? ': ' + detail : ''));
            return;
          }
          clearResults();
          if (r.data.count === 0) {
            status.textContent = '「' + query + '」を含む会話は見つかりませんでした。';
            return;
          }
          status.textContent = r.data.count + '件見つかりました。';
          r.data.posts.forEach(function (post) { list.appendChild(renderMuseSearchItem(doc, post)); });
        }).catch(function (error) {
          fail('検索できませんでした: ' + (error && error.message ? error.message : String(error)));
        }).then(function () {
          busy = false;
          button.disabled = false;
        });
      });
    }
`;

export function getMuseSearchPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Museの会話を検索</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
  </style>
  <style id="muse-search-style">
    body { margin: 0; background: var(--bg-secondary); color: var(--text-primary); font-family: system-ui, sans-serif; line-height: 1.6; }
    .muse-search-nav { position: sticky; top: 0; z-index: 10; box-sizing: border-box; height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 16px; background: var(--card-bg); border-bottom: 1px solid var(--border-color); }
    .muse-search-title { font-weight: 600; }
    .muse-search-nav-end { margin-left: auto; display: flex; align-items: center; }
    .muse-search-main { max-width: 900px; margin: 0 auto; padding: 16px; }
    .muse-search-form { display: flex; gap: 8px; flex-wrap: wrap; }
    .muse-search-form input { flex: 1 1 240px; min-width: 0; min-height: 36px; box-sizing: border-box; padding: 0 10px; color: var(--text-primary); background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px; font-size: 16px; }
    .muse-search-form button { min-height: 36px; padding: 0 16px; color: var(--text-primary); background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; }
    .muse-search-form button:disabled { opacity: 0.6; cursor: wait; }
    .muse-search-note { color: var(--text-muted); font-size: 13px; margin: 8px 0 0; }
    .muse-search-status { color: var(--text-secondary); margin: 16px 0 8px; }
    .muse-search-error { color: var(--danger-color); }
    .muse-search-results { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .muse-search-item { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; min-width: 0; }
    .muse-search-head { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; font-size: 13px; }
    .muse-search-role { padding: 0 8px; border-radius: 10px; background: var(--badge-bg); color: var(--text-primary); border: 1px solid var(--border-color); }
    .muse-search-meta { color: var(--text-muted); }
    .muse-search-snippet { margin: 6px 0 0; white-space: pre-wrap; word-break: break-word; }
    .muse-search-snippet mark { background: var(--warning-color); color: var(--bg-primary); border-radius: 2px; padding: 0 2px; }
  </style>
</head>
<body>
  <nav class="muse-search-nav"><span class="muse-search-title">Museの会話を検索</span><span class="muse-search-nav-end">${getThemeToggleHTML()}</span></nav>
  <main class="muse-search-main">
    <form class="muse-search-form" role="search">
      <input type="search" name="q" placeholder="tree-view の Museタブの会話から探す" aria-label="検索する文字" maxlength="500" autocomplete="off">
      <button type="submit">検索</button>
    </form>
    <p class="muse-search-note">質問と回答の両方を探します(大文字と小文字は区別しません)。新しい順に、最大100件まで表示します。</p>
    <p class="muse-search-status" data-field="status" role="status" aria-live="polite"></p>
    <ul class="muse-search-results" data-field="results"></ul>
  </main>
  <script>${MUSE_SEARCH_SCRIPT}
    initMuseSearchPage(document, function (url) { return fetch(url, { headers: { Accept: 'application/json' } }); });
  </script>
  <script>${getThemeToggleScript()}</script>
</body>
</html>`;
}
