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

    // 重なり順は固定値で書かず、いま画面にある固定位置の要素の z-index の最大値 + 100 にする(CLAUDE.mdルール26)。
    // このページには静的なモーダルが無いので、staticZDefaults は空。静的なモーダルを足すときは、ここに登録する。
    var staticZDefaults = {};
    function getNextZ(doc) {
      var max = 700;
      var all = doc.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var style = doc.defaultView.getComputedStyle(all[i]);
        if (style.position === 'fixed') {
          var z = parseInt(style.zIndex, 10) || 0;
          if (z > max && z < 9000) max = z;
        }
      }
      Object.keys(staticZDefaults).forEach(function (id) {
        var el = doc.getElementById(id);
        if (el && el.classList.contains('open')) {
          var z2 = parseInt(el.style.zIndex, 10) || staticZDefaults[id];
          if (z2 > max) max = z2;
        }
      });
      return max + 100;
    }

    function museKeysCell(doc, text, className) {
      var td = museSearchEl(doc, 'td', className, text);
      return td;
    }

    function renderMuseKeysTable(doc, keys) {
      var table = museSearchEl(doc, 'table', 'muse-keys-table');
      var head = doc.createElement('thead');
      var headRow = doc.createElement('tr');
      ['検索キー', 'AIチャットでの出現回数', 'tree-viewでの出現回数', '検索回数', '最後に検索した日時(日本時間)'].forEach(function (label, index) {
        var th = museSearchEl(doc, 'th', index > 0 && index < 4 ? 'muse-keys-num' : '', label);
        th.setAttribute('scope', 'col');
        headRow.appendChild(th);
      });
      head.appendChild(headRow);
      table.appendChild(head);
      var body = doc.createElement('tbody');
      keys.forEach(function (item) {
        var row = doc.createElement('tr');
        row.appendChild(museKeysCell(doc, item.searchKey, 'muse-keys-key'));
        row.appendChild(museKeysCell(doc, String(item.aiChatCount), 'muse-keys-num'));
        var tree = museKeysCell(doc, item.treeViewCount === null ? '—' : String(item.treeViewCount), 'muse-keys-num');
        if (item.treeViewCount === null) tree.title = 'tree-viewでの出現回数を取得できませんでした';
        row.appendChild(tree);
        row.appendChild(museKeysCell(doc, String(item.searchCount), 'muse-keys-num'));
        row.appendChild(museKeysCell(doc, formatMuseSearchTime(Date.parse(item.lastSearchedAt) / 1000), 'muse-keys-time'));
        body.appendChild(row);
      });
      table.appendChild(body);
      return table;
    }

    // 回答IDの表示。前後4文字ずつを残して、残りを「…」にする(8文字以下はそのまま。絵文字は割らない)。
    function shortenMuseAnswerId(id) {
      var chars = Array.from(id);
      if (chars.length <= 8) return id;
      return chars.slice(0, 4).join('') + '…' + chars.slice(chars.length - 4).join('');
    }

    // 回答IDのリンクを押したときの、最上位のモーダル。回答の全文を、当たったキーワードを <mark> で強調して出す(区間はサーバーで計算済み。文字は textContent だけで入れる)。
    function openMuseAnswerModal(doc, fetchFn, opener, answerId) {
      if (doc.querySelector('[data-overlay="muse-answer"]')) return;
      var overlay = museSearchEl(doc, 'div', 'muse-answer-overlay');
      overlay.setAttribute('data-overlay', 'muse-answer');
      overlay.style.zIndex = String(getNextZ(doc));
      var dialog = museSearchEl(doc, 'div', 'muse-keys-dialog');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'muse-answer-title');
      var head = museSearchEl(doc, 'div', 'muse-keys-head');
      var title = museSearchEl(doc, 'h2', 'muse-keys-title muse-answer-title', '回答 ' + shortenMuseAnswerId(answerId));
      title.id = 'muse-answer-title';
      title.title = answerId;
      var close = museSearchEl(doc, 'button', 'muse-keys-close', '✕');
      close.type = 'button';
      close.setAttribute('data-action', 'close');
      close.setAttribute('aria-label', '閉じる');
      head.appendChild(title);
      head.appendChild(close);
      var content = museSearchEl(doc, 'div', 'muse-keys-body', '読み込んでいます…');
      dialog.appendChild(head);
      dialog.appendChild(content);
      overlay.appendChild(dialog);
      doc.body.appendChild(overlay);

      var closed = false;
      function closeModal() {
        closed = true;
        doc.removeEventListener('keydown', onKeydown);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (opener && opener.focus) opener.focus();
      }
      function onKeydown(event) {
        if (event.key === 'Escape') closeModal();
        else if (event.key === 'Tab') { event.preventDefault(); close.focus(); }
      }
      close.addEventListener('click', closeModal);
      overlay.addEventListener('click', function (event) { if (event.target === overlay) closeModal(); });
      doc.addEventListener('keydown', onKeydown);
      close.focus();

      function show(node) {
        while (content.firstChild) content.removeChild(content.firstChild);
        content.appendChild(node);
      }
      fetchFn('/api/muse-search/answer?answerId=' + encodeURIComponent(answerId)).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
      }).then(function (r) {
        if (closed) return;
        if (!r.ok) {
          var why = r.data && r.data.detail ? r.data.detail : (r.data && r.data.error ? r.data.error : '');
          show(museSearchEl(doc, 'p', 'muse-search-error', '回答を読み込めませんでした(HTTP ' + r.status + ')' + (why ? ': ' + why : '')));
          return;
        }
        var wrap = museSearchEl(doc, 'div', 'muse-answer');
        wrap.appendChild(museSearchEl(doc, 'p', 'muse-search-status', 'キーワード: ' + r.data.keys.join(', ') + '(チャット ' + r.data.chatId + '・' + formatMuseSearchTime(r.data.createdAt) + ')'));
        var text = museSearchEl(doc, 'div', 'muse-answer-text');
        r.data.segments.forEach(function (segment) {
          if (segment.hit) text.appendChild(museSearchEl(doc, 'mark', '', segment.text));
          else text.appendChild(doc.createTextNode(segment.text));
        });
        wrap.appendChild(text);
        if (r.data.truncated) wrap.appendChild(museSearchEl(doc, 'p', 'muse-search-status', '回答が長いため、途中までを表示しています。'));
        show(wrap);
      }).catch(function (error) {
        if (closed) return;
        show(museSearchEl(doc, 'p', 'muse-search-error', '回答を読み込めませんでした: ' + (error && error.message ? error.message : String(error))));
      });
    }

    // 🗒️ボタン: 本体D1の回答ごとの記録を、全キー合算で、チャットIDごとのループ(合計の多い順)の中に、回答IDを回答日時の古い順に並べる。
    // 回答の並べ替え。sort は { key: 'createdAt' | 'occurrences', dir: 'asc' | 'desc' }。同数のときは、出現回数なら回答日時の古い順、回答日時なら回答ID順にする。
    function sortMuseAnswers(answers, sort) {
      var sign = sort.dir === 'desc' ? -1 : 1;
      return answers.slice().sort(function (a, b) {
        var primary = (a[sort.key] - b[sort.key]) * sign;
        if (primary !== 0) return primary;
        if (sort.key === 'occurrences' && a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
        return a.answerId < b.answerId ? -1 : (a.answerId > b.answerId ? 1 : 0);
      });
    }

    function renderMuseAnswersChats(doc, chats, sort, onSort, onOpen) {
      var wrap = museSearchEl(doc, 'div', 'muse-answers');
      chats.forEach(function (group) {
        var section = museSearchEl(doc, 'section', 'muse-answers-thread');
        var threadLabel = group.threadId !== null ? 'スレッド ' + group.threadId : 'スレッド化なし';
        section.appendChild(museSearchEl(doc, 'h3', 'muse-answers-heading', 'チャット ' + group.chatId + '(' + threadLabel + '・合計' + group.totalOccurrences + '回・回答' + group.answers.length + '件)'));
        var table = museSearchEl(doc, 'table', 'muse-keys-table');
        var head = doc.createElement('thead');
        var headRow = doc.createElement('tr');
        [['回答ID', ''], ['回答日時(日本時間)', 'createdAt'], ['出現回数', 'occurrences'], ['検索キー', ''], ['一致箇所の前後', '']].forEach(function (column, index) {
          var th = museSearchEl(doc, 'th', index === 2 ? 'muse-keys-num' : '');
          th.setAttribute('scope', 'col');
          if (column[1] === '') {
            th.textContent = column[0];
          } else {
            var active = sort.key === column[1];
            th.setAttribute('aria-sort', active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
            var sortButton = museSearchEl(doc, 'button', 'muse-sort');
            sortButton.type = 'button';
            sortButton.setAttribute('data-sort-key', column[1]);
            sortButton.appendChild(doc.createTextNode(column[0]));
            sortButton.appendChild(museSearchEl(doc, 'span', 'muse-sort-indicator', active ? (sort.dir === 'asc' ? '▲' : '▼') : ''));
            sortButton.addEventListener('click', function () { onSort(column[1]); });
            th.appendChild(sortButton);
          }
          headRow.appendChild(th);
        });
        head.appendChild(headRow);
        table.appendChild(head);
        var body = doc.createElement('tbody');
        sortMuseAnswers(group.answers, sort).forEach(function (item) {
          var row = doc.createElement('tr');
          var idCell = museKeysCell(doc, '', 'muse-answers-id');
          var idLink = museSearchEl(doc, 'a', 'muse-answers-link', shortenMuseAnswerId(item.answerId));
          idLink.setAttribute('href', '#');
          idLink.setAttribute('data-answer-id', item.answerId);
          idLink.setAttribute('aria-label', '回答 ' + item.answerId + ' の全文を開く');
          idLink.title = item.answerId;
          idLink.addEventListener('click', function (event) { event.preventDefault(); onOpen(idLink.getAttribute('data-answer-id'), idLink); });
          idCell.appendChild(idLink);
          row.appendChild(idCell);
          row.appendChild(museKeysCell(doc, formatMuseSearchTime(item.createdAt), 'muse-keys-time'));
          row.appendChild(museKeysCell(doc, String(item.occurrences), 'muse-keys-num'));
          row.appendChild(museKeysCell(doc, item.searchKeys.join(', '), 'muse-answers-keys'));
          row.appendChild(museKeysCell(doc, item.preview, 'muse-answers-preview'));
          body.appendChild(row);
        });
        table.appendChild(body);
        var scroll = museSearchEl(doc, 'div', 'muse-keys-scroll');
        scroll.appendChild(table);
        section.appendChild(scroll);
        wrap.appendChild(section);
      });
      return wrap;
    }

    // 📅ボタン: スレッド・チャットを問わず、回答を回答日時の新しい順に1つの表で出す(同時刻は回答ID順)。回答の一覧(チャットごと)の応答をそのまま平らにして使う。
    function flattenMuseAnswers(chats) {
      var rows = [];
      chats.forEach(function (group) {
        group.answers.forEach(function (item) {
          rows.push({ answerId: item.answerId, chatId: group.chatId, threadId: group.threadId, occurrences: item.occurrences, searchKeys: item.searchKeys, preview: item.preview, createdAt: item.createdAt });
        });
      });
      return rows.sort(function (a, b) {
        if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
        return a.answerId < b.answerId ? -1 : (a.answerId > b.answerId ? 1 : 0);
      });
    }

    function renderMuseRecentAnswers(doc, rows, onOpen) {
      var scroll = museSearchEl(doc, 'div', 'muse-keys-scroll');
      var table = museSearchEl(doc, 'table', 'muse-keys-table muse-recent-table');
      var head = doc.createElement('thead');
      var headRow = doc.createElement('tr');
      ['回答日時(日本時間)', '回答ID', 'チャットID', '出現回数', '検索キー', '一致箇所の前後'].forEach(function (text, index) {
        var th = museSearchEl(doc, 'th', index === 3 ? 'muse-keys-num' : '', text);
        th.setAttribute('scope', 'col');
        headRow.appendChild(th);
      });
      head.appendChild(headRow);
      table.appendChild(head);
      var body = doc.createElement('tbody');
      rows.forEach(function (item) {
        var row = doc.createElement('tr');
        row.appendChild(museKeysCell(doc, formatMuseSearchTime(item.createdAt), 'muse-keys-time'));
        var idCell = museKeysCell(doc, '', 'muse-answers-id');
        var idLink = museSearchEl(doc, 'a', 'muse-answers-link', shortenMuseAnswerId(item.answerId));
        idLink.setAttribute('href', '#');
        idLink.setAttribute('data-answer-id', item.answerId);
        idLink.setAttribute('aria-label', '回答 ' + item.answerId + ' の全文を開く');
        idLink.title = item.answerId;
        idLink.addEventListener('click', function (event) { event.preventDefault(); onOpen(idLink.getAttribute('data-answer-id'), idLink); });
        idCell.appendChild(idLink);
        row.appendChild(idCell);
        row.appendChild(museKeysCell(doc, item.chatId, 'muse-answers-id'));
        row.appendChild(museKeysCell(doc, String(item.occurrences), 'muse-keys-num'));
        row.appendChild(museKeysCell(doc, item.searchKeys.join(', '), 'muse-answers-keys'));
        row.appendChild(museKeysCell(doc, item.preview, 'muse-answers-preview'));
        body.appendChild(row);
      });
      table.appendChild(body);
      scroll.appendChild(table);
      return scroll;
    }

    // 📅ボタンのレイヤー: 検索キーのモーダルの上(最上位)に、スレッド・チャットを問わず、回答を日付の新しい順に1つの表で出す。
    // 回答IDのリンクを押すと、回答のモーダルが、このレイヤーのさらに上に開く。Esc・✕・外側のクリックで、このレイヤーだけを閉じる。
    function openMuseRecentModal(doc, fetchFn, opener) {
      if (doc.querySelector('[data-overlay="muse-recent"]')) return;
      var overlay = museSearchEl(doc, 'div', 'muse-recent-overlay');
      overlay.setAttribute('data-overlay', 'muse-recent');
      overlay.style.zIndex = String(getNextZ(doc));
      var dialog = museSearchEl(doc, 'div', 'muse-keys-dialog');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'muse-recent-title');
      var head = museSearchEl(doc, 'div', 'muse-keys-head');
      var title = museSearchEl(doc, 'h2', 'muse-keys-title muse-recent-title', '最新の回答(スレッド問わず日付の新しい順)');
      title.id = 'muse-recent-title';
      var close = museSearchEl(doc, 'button', 'muse-keys-close', '✕');
      close.type = 'button';
      close.setAttribute('data-action', 'close');
      close.setAttribute('aria-label', '閉じる');
      head.appendChild(title);
      head.appendChild(close);
      var content = museSearchEl(doc, 'div', 'muse-keys-body', '読み込んでいます…');
      dialog.appendChild(head);
      dialog.appendChild(content);
      overlay.appendChild(dialog);
      doc.body.appendChild(overlay);

      var closed = false;
      function closeModal() {
        closed = true;
        doc.removeEventListener('keydown', onKeydown);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (opener && opener.focus) opener.focus();
      }
      function onKeydown(event) {
        // 回答のモーダルが上に開いている間は、そちらが操作を受ける。
        if (doc.querySelector('[data-overlay="muse-answer"]')) return;
        if (event.key === 'Escape') closeModal();
        else if (event.key === 'Tab') {
          event.preventDefault();
          var items = dialog.querySelectorAll('button, a[href]');
          var at = Array.prototype.indexOf.call(items, doc.activeElement);
          var next = event.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : (at < 0 || at === items.length - 1 ? 0 : at + 1);
          items[next].focus();
        }
      }
      close.addEventListener('click', closeModal);
      overlay.addEventListener('click', function (event) { if (event.target === overlay) closeModal(); });
      doc.addEventListener('keydown', onKeydown);
      close.focus();

      function show(node) {
        while (content.firstChild) content.removeChild(content.firstChild);
        content.appendChild(node);
      }
      fetchFn('/api/muse-search/answers').then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
      }).then(function (r) {
        if (closed) return;
        if (!r.ok) {
          var why = r.data && r.data.detail ? r.data.detail : (r.data && r.data.error ? r.data.error : '');
          show(museSearchEl(doc, 'p', 'muse-search-error', '回答の一覧を読み込めませんでした(HTTP ' + r.status + ')' + (why ? ': ' + why : '')));
          return;
        }
        var rows = flattenMuseAnswers(r.data.chats);
        if (rows.length === 0) {
          show(museSearchEl(doc, 'p', 'muse-search-status', 'まだ回答ごとの出現回数が記録されていません。'));
          return;
        }
        show(renderMuseRecentAnswers(doc, rows, function (answerId, link) { openMuseAnswerModal(doc, fetchFn, link, answerId); }));
      }).catch(function (error) {
        if (closed) return;
        show(museSearchEl(doc, 'p', 'muse-search-error', '回答の一覧を読み込めませんでした: ' + (error && error.message ? error.message : String(error))));
      });
    }

    // 🔑ボタン: 検索キーを、AIチャットでの出現回数の多い順に、tree-viewでの出現回数とともに、最上位のモーダルに出す。
    function openMuseKeysModal(doc, fetchFn, opener) {
      if (doc.querySelector('[data-overlay="muse-keys"]')) return;
      var overlay = museSearchEl(doc, 'div', 'muse-keys-overlay');
      overlay.setAttribute('data-overlay', 'muse-keys');
      overlay.style.zIndex = String(getNextZ(doc));
      var dialog = museSearchEl(doc, 'div', 'muse-keys-dialog');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'muse-keys-title');
      var head = museSearchEl(doc, 'div', 'muse-keys-head');
      var title = museSearchEl(doc, 'h2', 'muse-keys-title', '検索キー(AIチャットでの出現回数の多い順)');
      title.id = 'muse-keys-title';
      var close = museSearchEl(doc, 'button', 'muse-keys-close', '✕');
      close.type = 'button';
      close.setAttribute('data-action', 'close');
      close.setAttribute('aria-label', '閉じる');
      var notes = museSearchEl(doc, 'button', 'muse-keys-notes', '🗒️');
      notes.type = 'button';
      notes.setAttribute('data-action', 'answers');
      notes.setAttribute('aria-label', 'チャットごとの回答の一覧を開く');
      notes.setAttribute('aria-pressed', 'false');
      notes.title = 'チャットごとの回答の一覧(回答日時の順)';
      // 📅は🗒️の右。押すと、最上位のレイヤーに、スレッド・チャットを問わず、回答を日付の新しい順に出す。
      var recent = museSearchEl(doc, 'button', 'muse-keys-notes muse-keys-recent', '📅');
      recent.type = 'button';
      recent.setAttribute('data-action', 'recent');
      recent.setAttribute('aria-label', 'スレッド問わず日付順の回答の一覧を開く');
      recent.title = 'スレッド問わず日付順の回答の一覧';
      head.appendChild(title);
      head.appendChild(notes);
      head.appendChild(recent);
      head.appendChild(close);
      var content = museSearchEl(doc, 'div', 'muse-keys-body', '読み込んでいます…');
      dialog.appendChild(head);
      dialog.appendChild(content);
      overlay.appendChild(dialog);
      doc.body.appendChild(overlay);

      function closeModal() {
        doc.removeEventListener('keydown', onKeydown);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (opener && opener.focus) opener.focus();
      }
      function onKeydown(event) {
        // 回答・📅のレイヤーが上に開いている間は、そちらが操作を受ける(Escで重なった全部が閉じない)。
        if (doc.querySelector('[data-overlay="muse-answer"], [data-overlay="muse-recent"]')) return;
        if (event.key === 'Escape') closeModal();
        // Tabでフォーカスがモーダルの外へ出ないようにする(モーダルの中のボタンとリンクの間を行き来する)。
        else if (event.key === 'Tab') {
          event.preventDefault();
          var items = dialog.querySelectorAll('button, a[href]');
          var at = Array.prototype.indexOf.call(items, doc.activeElement);
          var next = event.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : (at < 0 || at === items.length - 1 ? 0 : at + 1);
          items[next].focus();
        }
      }
      close.addEventListener('click', closeModal);
      overlay.addEventListener('click', function (event) { if (event.target === overlay) closeModal(); });
      doc.addEventListener('keydown', onKeydown);
      close.focus();

      function show(node) {
        while (content.firstChild) content.removeChild(content.firstChild);
        content.appendChild(node);
      }
      // 表示の切り替え。遅れて届いた応答が、いま見ている画面を上書きしないよう、番号で最新の要求だけを反映する。
      var view = 'keys';
      var requestNumber = 0;
      var KEYS_TITLE = '検索キー(AIチャットでの出現回数の多い順)';
      var SORT_LABELS = { createdAt: '回答日時', occurrences: '出現回数' };
      // 🗒️の並べ替えの基準。最初は回答日時の昇順。🔑へ戻って開き直しても覚えている(モーダルを閉じたら最初に戻る)。
      var sortState = { key: 'createdAt', dir: 'asc' };
      var answersData = null;
      function answersTitle() { return 'チャットごとの回答(' + SORT_LABELS[sortState.key] + 'の' + (sortState.dir === 'asc' ? '昇順' : '降順') + ')'; }
      function onSortAnswers(key) {
        if (sortState.key === key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        else { sortState.key = key; sortState.dir = 'desc'; }
        show(buildAnswers());
        title.textContent = answersTitle();
        var again = content.querySelector('button[data-sort-key="' + key + '"]');
        if (again) again.focus();
      }
      function buildAnswers() {
        return renderMuseAnswersChats(doc, answersData, sortState, onSortAnswers, function (answerId, opener) { openMuseAnswerModal(doc, fetchFn, opener, answerId); });
      }
      function load(url, failText, build) {
        requestNumber += 1;
        var mine = requestNumber;
        show(museSearchEl(doc, 'p', 'muse-search-status', '読み込んでいます…'));
        fetchFn(url).then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
        }).then(function (r) {
          if (mine !== requestNumber) return;
          if (!r.ok) {
            var detail = r.data && r.data.detail ? r.data.detail : (r.data && r.data.error ? r.data.error : '');
            show(museSearchEl(doc, 'p', 'muse-search-error', failText + '(HTTP ' + r.status + ')' + (detail ? ': ' + detail : '')));
            return;
          }
          show(build(r.data));
        }).catch(function (error) {
          if (mine !== requestNumber) return;
          show(museSearchEl(doc, 'p', 'muse-search-error', failText + ': ' + (error && error.message ? error.message : String(error))));
        });
      }
      function markView(name) {
        view = name;
        notes.setAttribute('aria-pressed', name === 'answers' ? 'true' : 'false');
      }
      function showKeys() {
        markView('keys');
        title.textContent = KEYS_TITLE;
        load('/api/muse-search/keys', '検索キーの一覧を読み込めませんでした', function (data) {
          if (data.keys.length === 0) return museSearchEl(doc, 'p', 'muse-search-status', 'まだ検索キーが記録されていません。');
          var scroll = museSearchEl(doc, 'div', 'muse-keys-scroll');
          scroll.appendChild(renderMuseKeysTable(doc, data.keys));
          return scroll;
        });
      }
      function showAnswers() {
        markView('answers');
        title.textContent = answersTitle();
        load('/api/muse-search/answers', 'チャットごとの回答の一覧を読み込めませんでした', function (data) {
          if (data.chats.length === 0) return museSearchEl(doc, 'p', 'muse-search-status', 'まだ回答ごとの出現回数が記録されていません。');
          answersData = data.chats;
          return buildAnswers();
        });
      }
      notes.addEventListener('click', function () { if (view === 'answers') showKeys(); else showAnswers(); });
      recent.addEventListener('click', function () { openMuseRecentModal(doc, fetchFn, recent); });
      showKeys();
    }

    function initMuseSearchPage(doc, fetchFn) {
      var form = doc.querySelector('form');
      var input = doc.querySelector('input[name="q"]');
      var button = doc.querySelector('button[type="submit"]');
      var status = doc.querySelector('[data-field="status"]');
      var list = doc.querySelector('[data-field="results"]');
      var busy = false;
      var keysButton = doc.querySelector('button[data-action="keys"]');
      keysButton.addEventListener('click', function () { openMuseKeysModal(doc, fetchFn, keysButton); });

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
          if (r.data.keyLogged === false) {
            status.textContent += '(検索キーを記録できませんでした' + (r.data.keyLogError ? ': ' + r.data.keyLogError : '') + ')';
            status.className = 'muse-search-status muse-search-error';
          }
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
    .muse-keys-overlay { position: fixed; inset: 0; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--modal-overlay); }
    .muse-keys-dialog { display: flex; flex-direction: column; box-sizing: border-box; width: 100%; max-width: 820px; max-height: min(80vh, 640px); background: var(--card-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px; }
    .muse-keys-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--border-color); }
    .muse-keys-title { margin: 0; font-size: 16px; }
    .muse-keys-head .muse-keys-title { flex: 1 1 auto; }
    .muse-keys-notes { min-width: 36px; min-height: 36px; color: var(--text-primary); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; }
    .muse-keys-notes[aria-pressed="true"] { border-color: var(--accent-color); }
    .muse-answers-thread { margin: 0 0 16px; }
    .muse-keys-table .muse-answers-id { white-space: nowrap; }
    .muse-keys-table .muse-keys-num { min-width: 4.5em; }
    .muse-keys-table .muse-answers-keys { min-width: 8em; overflow-wrap: anywhere; }
    .muse-keys-table .muse-answers-preview { min-width: 14em; overflow-wrap: anywhere; }
    .muse-answer-overlay { position: fixed; inset: 0; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--modal-overlay); }
    .muse-recent-overlay { position: fixed; inset: 0; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--modal-overlay); }
    .muse-answers-link { color: var(--accent-color); text-decoration: none; }
    .muse-sort { font: inherit; font-weight: 600; line-height: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; min-height: 0; min-width: 0; height: auto; cursor: pointer; text-align: inherit; white-space: nowrap; }
    .muse-sort-indicator { display: inline-block; min-width: 1.2em; font-size: 11px; color: var(--accent-color); }
    .muse-answer-text { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; font-size: 14px; }
    .muse-answer-text mark { background: var(--warning-color); color: var(--bg-primary); border-radius: 2px; padding: 0 2px; }
    .muse-keys-table.muse-recent-table th { white-space: nowrap; }
    .muse-keys-table.muse-recent-table .muse-answers-preview { min-width: 8em; }
    .muse-keys-table.muse-recent-table .muse-answers-keys { min-width: 6em; }
    .muse-answers-heading { margin: 0 0 6px; font-size: 14px; overflow-wrap: anywhere; }
    .muse-keys-close { min-width: 36px; min-height: 36px; color: var(--text-primary); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; }
    .muse-keys-body { padding: 12px 16px; overflow: auto; min-height: 0; }
    .muse-keys-scroll { overflow: auto; }
    .muse-keys-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .muse-keys-table th, .muse-keys-table td { padding: 6px 8px; border-bottom: 1px solid var(--border-light); text-align: left; vertical-align: top; }
    .muse-keys-table thead th { position: sticky; top: 0; background: var(--card-bg); color: var(--text-secondary); font-weight: 600; }
    .muse-keys-table .muse-keys-num { text-align: right; min-width: 5.5em; }
    .muse-keys-table .muse-keys-key { min-width: 12em; overflow-wrap: anywhere; }
    .muse-keys-table .muse-keys-time { white-space: nowrap; }
    .muse-search-form button[data-action="keys"] { padding: 0 12px; }
    .muse-search-snippet mark { background: var(--warning-color); color: var(--bg-primary); border-radius: 2px; padding: 0 2px; }
  </style>
</head>
<body>
  <nav class="muse-search-nav"><span class="muse-search-title">Museの会話を検索</span><span class="muse-search-nav-end">${getThemeToggleHTML()}</span></nav>
  <main class="muse-search-main">
    <form class="muse-search-form" role="search">
      <input type="search" name="q" placeholder="tree-view の Museタブの会話から探す" aria-label="検索する文字" maxlength="500" autocomplete="off">
      <button type="submit">検索</button>
      <button type="button" data-action="keys" aria-label="検索キーの一覧を開く" title="検索キーの一覧(AIチャットでの出現回数の順)">🔑</button>
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
