import { getMarkdownParserScript, getMarkdownPreviewCSS } from '../utils/markdownRenderer';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

/**
 * /muse-search のCSP。ページの script はインラインで、通信は同じオリジンの /api/muse-search だけ。
 * 外部の読み込み・埋め込みは許さない。
 */
export const MUSE_SEARCH_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/**
 * /muse-search のページ script(2026-11-19)。依存を受け取る関数に分け、museSearch.test.ts で動かす。
 * チャット本文は共有 Markdown パーサーを通す。その他の上流の文字列はテキストとして表示する。
 * このファイルのscriptはTypeScriptのtemplate literalの中にあるので、バックスラッシュ・正規表現・バッククォートを書かない。
 */
export const MUSE_SEARCH_SCRIPT = `
    var parseMuseChatMarkdown = (function () { ${getMarkdownParserScript()} return parseMd; })();
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

    // 検索結果の1組 = 質問と回答のペア(回答ID単位、2026-11-20、ユーザー指定)。チャットIDは、複数のペアを入れる会話の容れ物なので、組の単位にしない。
    // 一致した側には、強調つきの抜粋を出す。一致していない側は「一致なし」(本文はここでは持たない。チャットIDを押すと、このペアの全文を出す)。
    function renderMuseSearchSide(doc, role, side) {
      var row = museSearchEl(doc, 'div', 'muse-search-side');
      row.setAttribute('data-side', role);
      var label = museSearchEl(doc, 'span', 'muse-search-role muse-search-role-' + role, MUSE_SEARCH_ROLE_LABELS[role] || role);
      label.setAttribute('data-field', 'role');
      row.appendChild(label);
      if (!side.hit) {
        row.appendChild(museSearchEl(doc, 'span', 'muse-search-nohit', '(一致なし)'));
        return row;
      }
      var body = museSearchEl(doc, 'p', 'muse-search-snippet');
      body.appendChild(doc.createTextNode(side.snippet.before));
      if (side.snippet.match) body.appendChild(museSearchEl(doc, 'mark', '', side.snippet.match));
      body.appendChild(doc.createTextNode(side.snippet.after));
      row.appendChild(body);
      return row;
    }

    function renderMuseSearchItem(doc, pair, onChat) {
      var item = museSearchEl(doc, 'li', 'muse-search-item');
      item.setAttribute('data-answer-id', pair.answerId);
      var head = museSearchEl(doc, 'div', 'muse-search-head');
      head.appendChild(museSearchEl(doc, 'span', 'muse-search-meta', formatMuseSearchTime(pair.createdAt)));
      // チャットIDはリンク。押すと、このペア(質問と回答)の全文を、最上位のモーダルに出す(2026-11-20、ユーザー指定)。
      var chatMeta = museSearchEl(doc, 'span', 'muse-search-meta', 'チャット ');
      var chatLink = museSearchEl(doc, 'a', 'muse-chat-link', pair.chatId);
      chatLink.setAttribute('href', '#');
      chatLink.setAttribute('data-chat-id', pair.chatId);
      chatLink.addEventListener('click', function (event) { event.preventDefault(); if (onChat) onChat(chatLink, pair.chatId, pair.answerId); });
      chatMeta.appendChild(chatLink);
      head.appendChild(chatMeta);
      if ((pair.question.hit && pair.question.threadMark) || (pair.answer.hit && pair.answer.threadMark)) head.appendChild(museSearchEl(doc, 'span', 'muse-search-meta', 'スレッド化済み'));
      item.appendChild(head);
      item.appendChild(renderMuseSearchSide(doc, 'user', pair.question));
      item.appendChild(renderMuseSearchSide(doc, 'assistant', pair.answer));
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

    // label は、スマホ幅で表を縦並び(項目名: 値)にするときの項目名(CSSの ::before で出す)。無ければ、行の見出しとして扱う。
    function museKeysCell(doc, text, className, label) {
      var td = museSearchEl(doc, 'td', className, text);
      if (label) td.setAttribute('data-label', label);
      return td;
    }

    // 検索キーの並べ替え。sort は { key: 'searchKey' | 'aiChatCount' | 'treeViewCount' | 'searchCount' | 'lastSearchedAt', dir: 'asc' | 'desc' }。
    // tree-viewでの出現回数が未取得(null)のキーは、どちらの向きでも最後。同じ値のときは、AIチャットでの出現回数なら「tree-viewでの回数の多い順 → 最後に検索した新しい順 → キー」(サーバーの並びと同じ)、それ以外は「最後に検索した新しい順 → キー」。
    function museKeyValue(item, key) {
      return key === 'lastSearchedAt' ? Date.parse(item.lastSearchedAt) : item[key];
    }
    function compareMuseValues(a, b, sign) {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      if (typeof a === 'string') return a.localeCompare(b, 'ja') * sign;
      return (a < b ? -1 : (a > b ? 1 : 0)) * sign;
    }
    function sortMuseKeys(keys, sort) {
      var sign = sort.dir === 'desc' ? -1 : 1;
      return keys.slice().sort(function (a, b) {
        var primary = compareMuseValues(museKeyValue(a, sort.key), museKeyValue(b, sort.key), sign);
        if (primary !== 0) return primary;
        if (sort.key === 'aiChatCount') {
          var tree = compareMuseValues(a.treeViewCount, b.treeViewCount, -1);
          if (tree !== 0) return tree;
        }
        var last = compareMuseValues(Date.parse(a.lastSearchedAt), Date.parse(b.lastSearchedAt), -1);
        if (last !== 0) return last;
        return compareMuseValues(a.searchKey, b.searchKey, 1);
      });
    }

    function renderMuseKeysTable(doc, keys, sort, onSort, onRow) {
      var table = museSearchEl(doc, 'table', 'muse-keys-table muse-keys-list');
      var head = doc.createElement('thead');
      var headRow = doc.createElement('tr');
      [['検索キー', 'searchKey'], ['AIチャットでの出現回数', 'aiChatCount'], ['tree-viewでの出現回数', 'treeViewCount'], ['検索回数', 'searchCount'], ['最後に検索した日時(日本時間)', 'lastSearchedAt']].forEach(function (column, index) {
        var th = museSearchEl(doc, 'th', index > 0 && index < 4 ? 'muse-keys-num' : '');
        th.setAttribute('scope', 'col');
        var active = sort.key === column[1];
        th.setAttribute('aria-sort', active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
        var sortButton = museSearchEl(doc, 'button', 'muse-sort');
        sortButton.type = 'button';
        sortButton.setAttribute('data-sort-key', column[1]);
        sortButton.appendChild(doc.createTextNode(column[0]));
        sortButton.appendChild(museSearchEl(doc, 'span', 'muse-sort-indicator', active ? (sort.dir === 'asc' ? '▲' : '▼') : ''));
        sortButton.addEventListener('click', function () { onSort(column[1]); });
        th.appendChild(sortButton);
        headRow.appendChild(th);
      });
      head.appendChild(headRow);
      table.appendChild(head);
      var body = doc.createElement('tbody');
      sortMuseKeys(keys, sort).forEach(function (item) {
        var row = doc.createElement('tr');
        row.appendChild(museKeysCell(doc, item.searchKey, 'muse-keys-key'));
        row.appendChild(museKeysCell(doc, String(item.aiChatCount), 'muse-keys-num', 'AIチャットでの出現回数'));
        var tree = museKeysCell(doc, item.treeViewCount === null ? '—' : String(item.treeViewCount), 'muse-keys-num', 'tree-viewでの出現回数');
        if (item.treeViewCount === null) tree.title = 'tree-viewでの出現回数を取得できませんでした';
        row.appendChild(tree);
        row.appendChild(museKeysCell(doc, String(item.searchCount), 'muse-keys-num', '検索回数'));
        row.appendChild(museKeysCell(doc, formatMuseSearchTime(Date.parse(item.lastSearchedAt) / 1000), 'muse-keys-time', '最後に検索した日時(日本時間)'));
        if (onRow) onRow(row, item);
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

    function renderMuseChatMarkdown(doc, post) {
      var body = museSearchEl(doc, 'div', 'muse-chat-markdown');
      var paragraphs = post.paragraphs;
      var markdown = post.markdown;
      if (typeof markdown !== 'string') {
        markdown = paragraphs.map(function (segments) {
          return segments.map(function (segment) { return segment.text; }).join('');
        }).join('\\n\\n');
      }

      var template = doc.createElement('template');
      template.innerHTML = parseMuseChatMarkdown(markdown);
      template.content.querySelectorAll('a[href]').forEach(function (link) {
        try {
          var url = new URL(link.getAttribute('href'), doc.baseURI);
          if (url.protocol === 'http:' || url.protocol === 'https:') return;
        } catch {
          // 不正なURLはラベルだけ残す。
        }
        link.removeAttribute('href');
      });
      // このページの CSP では画像を読み込めない。
      template.content.querySelectorAll('img').forEach(function (image) {
        image.replaceWith(doc.createTextNode(image.alt));
      });

      var hits = new Set();
      paragraphs.forEach(function (segments) {
        segments.forEach(function (segment) {
          if (segment.hit && segment.text) hits.add(segment.text);
        });
      });
      if (hits.size) {
        var pattern = Array.from(hits).sort(function (a, b) { return b.length - a.length; }).map(function (hit) {
          return hit.replace(/[.*+?^\\x24{}()|[\\]\\\\]/g, '\\\\$&');
        }).join('|');
        var matches = new RegExp(pattern, 'giu');
        var walker = doc.createTreeWalker(template.content, 4);
        var textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        textNodes.forEach(function (node) {
          var text = node.data;
          var cursor = 0;
          var highlighted = doc.createDocumentFragment();
          for (var match of text.matchAll(matches)) {
            highlighted.appendChild(doc.createTextNode(text.slice(cursor, match.index)));
            highlighted.appendChild(museSearchEl(doc, 'mark', '', match[0]));
            cursor = match.index + match[0].length;
          }
          if (cursor) {
            highlighted.appendChild(doc.createTextNode(text.slice(cursor)));
            node.replaceWith(highlighted);
          }
        });
      }
      body.appendChild(template.content);
      return body;
    }

    // チャットIDのリンクから、選択したペアの質問と回答をモーダルに表示する。
    function openMuseChatModal(doc, fetchFn, opener, chatId, answerId) {
      if (doc.querySelector('[data-overlay="muse-chat"]')) return;
      var overlay = museSearchEl(doc, 'div', 'muse-answer-overlay');
      overlay.setAttribute('data-overlay', 'muse-chat');
      overlay.style.zIndex = String(getNextZ(doc));
      var dialog = museSearchEl(doc, 'div', 'muse-keys-dialog');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'muse-chat-title');
      var head = museSearchEl(doc, 'div', 'muse-keys-head');
      var title = museSearchEl(doc, 'h2', 'muse-keys-title', 'チャット ' + chatId);
      title.id = 'muse-chat-title';
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
      fetchFn('/api/muse-search/chat?chatId=' + encodeURIComponent(chatId) + (answerId ? '&answerId=' + encodeURIComponent(answerId) : '')).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
      }).then(function (r) {
        if (closed) return;
        if (!r.ok) {
          var why = r.data && r.data.detail ? r.data.detail : (r.data && r.data.error ? r.data.error : '');
          show(museSearchEl(doc, 'p', 'muse-search-error', 'チャットを読み込めませんでした(HTTP ' + r.status + ')' + (why ? ': ' + why : '')));
          return;
        }
        var wrap = museSearchEl(doc, 'div', 'muse-chat');
        if (r.data.highlightError) wrap.appendChild(museSearchEl(doc, 'p', 'muse-thread-meta muse-thread-highlight-error', 'キーワードの強調は、できませんでした: ' + r.data.highlightError));
        var posts = r.data.posts;
        var latestAnswerIndex = -1;
        posts.forEach(function (post, index) {
          if (post.role !== 'assistant') return;
          if (latestAnswerIndex === -1 || post.createdAt >= posts[latestAnswerIndex].createdAt) {
            latestAnswerIndex = index;
          }
        });
        posts.forEach(function (post, index) {
          var section = museSearchEl(doc, 'details', 'muse-chat-post');
          section.setAttribute('data-role', post.role);
          var heading = museSearchEl(doc, 'summary', 'muse-chat-heading');
          var meta = museSearchEl(doc, 'span', 'muse-chat-meta');
          meta.appendChild(museSearchEl(doc, 'span', 'muse-chat-role', post.role === 'user' ? '質問' : '回答'));
          meta.appendChild(doc.createTextNode(' '));
          meta.appendChild(museSearchEl(doc, 'span', 'muse-chat-time', formatMuseSearchTime(post.createdAt)));
          heading.appendChild(meta);
          section.appendChild(heading);
          if (post.role === 'user' || index === latestAnswerIndex) section.setAttribute('open', '');
          section.appendChild(renderMuseChatMarkdown(doc, post));
          if (post.truncated) section.appendChild(museSearchEl(doc, 'p', 'muse-thread-meta', '長いため、途中までを表示しています。'));
          wrap.appendChild(section);
        });
        show(wrap);
      }).catch(function (error) {
        if (closed) return;
        show(museSearchEl(doc, 'p', 'muse-search-error', 'チャットを読み込めませんでした: ' + (error && error.message ? error.message : String(error))));
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

      // 行の左スワイプ削除(2026-11-20、ユーザー指定。AIチャットの左サイドパネルと同じ操作)。左へ50px以上で、その行の削除エリア(幅72px)が出る。
      // 開く行は1つだけ。削除エリアは、開いている行の右端に重ねる(1つのボタンを、開いた行へ動かして使う)。
      var SWIPE_WIDTH = 72;
      var SWIPE_OPEN_AT = 50;
      var deleteArea = museSearchEl(doc, 'button', 'muse-keys-delete-area', '削除');
      deleteArea.type = 'button';
      deleteArea.hidden = true;
      deleteArea.setAttribute('data-action', 'delete-key');
      dialog.appendChild(deleteArea);
      var swipeRow = null;
      var swipeItem = null;
      var deleteNote = null;
      function clearDeleteNote() {
        if (deleteNote && deleteNote.parentNode) deleteNote.parentNode.removeChild(deleteNote);
        deleteNote = null;
      }
      function showDeleteError(message) {
        clearDeleteNote();
        deleteNote = museSearchEl(doc, 'p', 'muse-search-error muse-keys-delete-error', 'キーを削除できませんでした' + message);
        dialog.insertBefore(deleteNote, content);
      }
      function placeDeleteArea(row) {
        var rect = row.getBoundingClientRect();
        var scroller = content.querySelector('.muse-keys-scroll');
        var right = Math.min(rect.right, scroller ? scroller.getBoundingClientRect().right : rect.right);
        deleteArea.style.top = rect.top + 'px';
        deleteArea.style.height = rect.height + 'px';
        deleteArea.style.left = (right - SWIPE_WIDTH) + 'px';
      }
      function closeSwipe() {
        if (swipeRow) {
          swipeRow.classList.remove('swipe-open');
          swipeRow.style.removeProperty('--swipe-x');
        }
        swipeRow = null;
        swipeItem = null;
        deleteArea.hidden = true;
        clearDeleteNote();
      }
      function openSwipe(row, item) {
        if (swipeRow && swipeRow !== row) closeSwipe();
        swipeRow = row;
        swipeItem = item;
        row.classList.add('swipe-open');
        row.style.setProperty('--swipe-x', '-' + SWIPE_WIDTH + 'px');
        deleteArea.setAttribute('aria-label', '「' + item.searchKey + '」を削除');
        placeDeleteArea(row);
        deleteArea.hidden = false;
      }
      var drag = null;
      var suppressClick = false;
      function dragStart(row, item, x, y) { drag = { row: row, item: item, x: x, y: y, decided: false, horizontal: false }; }
      function dragMove(x, y) {
        if (!drag) return;
        var dx = x - drag.x;
        var dy = y - drag.y;
        if (!drag.decided) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 4) return;
          drag.decided = true;
          drag.horizontal = Math.abs(dx) > Math.abs(dy);
        }
        if (!drag.horizontal) return;
        var base = swipeRow === drag.row ? -SWIPE_WIDTH : 0;
        drag.row.classList.add('swiping');
        drag.row.style.setProperty('--swipe-x', Math.max(-SWIPE_WIDTH, Math.min(0, base + dx)) + 'px');
      }
      // 戻り値: 横にドラッグした(クリックとは別の操作だった)かどうか。
      function dragEnd(x) {
        if (!drag) return false;
        var current = drag;
        drag = null;
        current.row.classList.remove('swiping');
        if (!current.horizontal) return false;
        var dx = x - current.x;
        if (swipeRow === current.row) {
          if (dx > SWIPE_WIDTH / 2) closeSwipe();
          else current.row.style.setProperty('--swipe-x', '-' + SWIPE_WIDTH + 'px');
        } else if (-dx >= SWIPE_OPEN_AT) openSwipe(current.row, current.item);
        else current.row.style.removeProperty('--swipe-x');
        return true;
      }
      function onMouseMove(event) { dragMove(event.clientX, event.clientY); }
      function onMouseUp(event) {
        if (!drag) return;
        if (dragEnd(event.clientX)) { suppressClick = true; setTimeout(function () { suppressClick = false; }, 0); }
      }
      doc.addEventListener('mousemove', onMouseMove);
      doc.addEventListener('mouseup', onMouseUp);
      function attachSwipe(row, item) {
        row.addEventListener('touchstart', function (event) { dragStart(row, item, event.touches[0].clientX, event.touches[0].clientY); }, { passive: true });
        row.addEventListener('touchmove', function (event) { dragMove(event.touches[0].clientX, event.touches[0].clientY); }, { passive: true });
        row.addEventListener('touchend', function (event) { dragEnd(event.changedTouches[0].clientX); });
        row.addEventListener('mousedown', function (event) { if (event.button === 0) dragStart(row, item, event.clientX, event.clientY); });
        row.addEventListener('click', function () { if (!suppressClick && swipeRow === row) closeSwipe(); });
      }
      // 削除の確認(2026-11-20、ユーザー指定)。削除エリアのタップでは削除せず、確認モーダルを出す。「削除する」を押して初めて DELETE を送る。
      // 送り方: 成功(deleted: true)を確かめてから、データと画面から消す。失敗は、行を残して理由を出す(成功に見せない)。
      var confirmOverlay = null;
      function closeDeleteConfirm(restoreFocus) {
        doc.removeEventListener('keydown', onConfirmKeydown);
        if (confirmOverlay && confirmOverlay.parentNode) confirmOverlay.parentNode.removeChild(confirmOverlay);
        confirmOverlay = null;
        if (restoreFocus && !deleteArea.hidden) deleteArea.focus();
      }
      function confirmButtons() { return confirmOverlay ? Array.prototype.slice.call(confirmOverlay.querySelectorAll('button')) : []; }
      function onConfirmKeydown(event) {
        if (!confirmOverlay) return;
        var buttons = confirmButtons();
        var pending = buttons.some(function (button) { return button.disabled; });
        if (event.key === 'Escape') { event.preventDefault(); if (!pending) closeDeleteConfirm(true); }
        else if (event.key === 'Tab') {
          event.preventDefault();
          if (pending) return;
          var at = buttons.indexOf(doc.activeElement);
          var next = event.shiftKey ? (at <= 0 ? buttons.length - 1 : at - 1) : (at < 0 || at === buttons.length - 1 ? 0 : at + 1);
          buttons[next].focus();
        }
      }
      function runDelete(item) {
        return fetchFn('/api/muse-search/key?key=' + encodeURIComponent(item.searchKey), { method: 'DELETE' }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
        }).then(function (r) {
          closeDeleteConfirm(false);
          if (r.ok && r.data && r.data.deleted === true) {
            keysData = keysData.filter(function (entry) { return entry !== item; });
            if (view === 'keys') showKeysData();
            else closeSwipe();
            return;
          }
          var detail = r.data && r.data.detail ? r.data.detail : (r.data && r.data.error ? r.data.error : '');
          showDeleteError('(HTTP ' + r.status + ')' + (detail ? ': ' + detail : ''));
          deleteArea.focus();
        }).catch(function (error) {
          closeDeleteConfirm(false);
          showDeleteError(': ' + (error && error.message ? error.message : String(error)));
          deleteArea.focus();
        });
      }
      function openDeleteConfirm(item) {
        closeDeleteConfirm(false);
        clearDeleteNote();
        confirmOverlay = museSearchEl(doc, 'div', 'muse-confirm-overlay');
        confirmOverlay.setAttribute('data-overlay', 'muse-key-delete-confirm');
        // キーのモーダルより必ず手前に出す(getNextZ は、画面の外のスタイルが当たっていない環境では、開いているモーダルを数え落とす)。
        confirmOverlay.style.zIndex = String(Math.max(getNextZ(doc), (parseInt(overlay.style.zIndex, 10) || 0) + 100));
        var box = museSearchEl(doc, 'div', 'muse-confirm-dialog');
        box.setAttribute('role', 'alertdialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-labelledby', 'muse-confirm-title');
        box.setAttribute('aria-describedby', 'muse-confirm-desc');
        var confirmTitle = museSearchEl(doc, 'h2', 'muse-confirm-title', '検索キーを削除しますか?');
        confirmTitle.id = 'muse-confirm-title';
        var confirmKey = museSearchEl(doc, 'p', 'muse-confirm-key', item.searchKey);
        var confirmDesc = museSearchEl(doc, 'p', 'muse-confirm-desc', 'このキーの検索の記録と、🗒️・📅の回答の一覧に出ているこのキーの記録が、すべて削除されます。元に戻せません。');
        confirmDesc.id = 'muse-confirm-desc';
        var buttons = museSearchEl(doc, 'div', 'muse-confirm-buttons');
        var cancel = museSearchEl(doc, 'button', 'muse-confirm-cancel', 'キャンセル');
        cancel.type = 'button';
        cancel.setAttribute('data-action', 'cancel-delete-key');
        var ok = museSearchEl(doc, 'button', 'muse-confirm-danger', '削除する');
        ok.type = 'button';
        ok.setAttribute('data-action', 'confirm-delete-key');
        buttons.appendChild(cancel);
        buttons.appendChild(ok);
        box.appendChild(confirmTitle);
        box.appendChild(confirmKey);
        box.appendChild(confirmDesc);
        box.appendChild(buttons);
        confirmOverlay.appendChild(box);
        doc.body.appendChild(confirmOverlay);
        cancel.addEventListener('click', function () { closeDeleteConfirm(true); });
        confirmOverlay.addEventListener('click', function (event) { if (event.target === confirmOverlay && !cancel.disabled) closeDeleteConfirm(true); });
        ok.addEventListener('click', function () {
          if (ok.disabled) return;
          ok.disabled = true;
          cancel.disabled = true;
          runDelete(item);
        });
        doc.addEventListener('keydown', onConfirmKeydown);
        cancel.focus();
      }
      deleteArea.addEventListener('click', function () { if (swipeItem) openDeleteConfirm(swipeItem); });

      function closeModal() {
        closeDeleteConfirm(false);
        doc.removeEventListener('keydown', onKeydown);
        doc.removeEventListener('mousemove', onMouseMove);
        doc.removeEventListener('mouseup', onMouseUp);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (opener && opener.focus) opener.focus();
      }
      function onKeydown(event) {
        // 回答・📅のレイヤーが上に開いている間は、そちらが操作を受ける(Escで重なった全部が閉じない)。
        if (doc.querySelector('[data-overlay="muse-answer"], [data-overlay="muse-recent"], [data-overlay="muse-key-delete-confirm"]')) return;
        if (event.key === 'Escape') closeModal();
        // Tabでフォーカスがモーダルの外へ出ないようにする(モーダルの中のボタンとリンクの間を行き来する)。
        else if (event.key === 'Tab') {
          event.preventDefault();
          var items = Array.prototype.filter.call(dialog.querySelectorAll('button, a[href]'), function (el) { return !el.hidden; });
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
        closeSwipe();
        while (content.firstChild) content.removeChild(content.firstChild);
        content.appendChild(node);
      }
      // 表示の切り替え。遅れて届いた応答が、いま見ている画面を上書きしないよう、番号で最新の要求だけを反映する。
      var view = 'keys';
      var requestNumber = 0;
      var KEYS_TITLE = '検索キー(AIチャットでの出現回数の多い順)';
      var KEYS_SORT_LABELS = { searchKey: '検索キー', aiChatCount: 'AIチャットでの出現回数', treeViewCount: 'tree-viewでの出現回数', searchCount: '検索回数', lastSearchedAt: '最後に検索した日時' };
      // 検索キーの並べ替えの基準。最初は、AIチャットでの出現回数の降順(これまでと同じ)。🗒️へ切り替えて戻っても覚えている(モーダルを閉じたら最初に戻る)。
      var keysSort = { key: 'aiChatCount', dir: 'desc' };
      var keysData = null;
      function keysTitle() {
        if (keysSort.key === 'aiChatCount' && keysSort.dir === 'desc') return KEYS_TITLE;
        return '検索キー(' + KEYS_SORT_LABELS[keysSort.key] + 'の' + (keysSort.dir === 'asc' ? '昇順' : '降順') + ')';
      }
      function buildKeys() {
        var scroll = museSearchEl(doc, 'div', 'muse-keys-scroll');
        scroll.appendChild(renderMuseKeysTable(doc, keysData, keysSort, onSortKeys, attachSwipe));
        scroll.addEventListener('scroll', closeSwipe);
        return scroll;
      }
      // 見出しを押すたびに、その列の降順/昇順をトグルして、表を作り直す。別の列は降順から始める。押した見出しにフォーカスを残す。
      function onSortKeys(key) {
        if (keysSort.key === key) keysSort.dir = keysSort.dir === 'asc' ? 'desc' : 'asc';
        else { keysSort.key = key; keysSort.dir = 'desc'; }
        show(buildKeys());
        title.textContent = keysTitle();
        var again = content.querySelector('button[data-sort-key="' + key + '"]');
        if (again) again.focus();
      }
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
        title.textContent = keysTitle();
        load('/api/muse-search/keys', '検索キーの一覧を読み込めませんでした', function (data) {
          keysData = data.keys;
          return keysNode();
        });
      }
      function keysNode() {
        if (keysData.length === 0) return museSearchEl(doc, 'p', 'muse-search-status', 'まだ検索キーが記録されていません。');
        return buildKeys();
      }
      function showKeysData() { show(keysNode()); }
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

    // 👤ボタン: ログインユーザーのハンドルネームの設定(ユーザー指定 2026-11-19)。最上位のモーダルに、ユーザー名と、いまのハンドルネームを出す。
    // 一文字入力するごとに、登録済みのハンドルネームと照合し(サーバーが判定)、一致が無ければ登録ボタンが押せる。押すと登録が完了する。
    var MUSE_HANDLE_MESSAGES = {
      available: '使えます',
      taken: 'そのハンドルネームは、すでに使われています',
      same: '今のハンドルネームと同じです',
      empty: '名前を入力してください',
      too_long: '20文字までです',
      invalid_chars: '使えない文字(改行・タブなどの制御文字)が含まれています'
    };
    function openMuseHandleModal(doc, fetchFn, opener) {
      if (doc.querySelector('[data-overlay="muse-handle"]')) return;
      var overlay = museSearchEl(doc, 'div', 'muse-handle-overlay');
      overlay.setAttribute('data-overlay', 'muse-handle');
      overlay.style.zIndex = String(getNextZ(doc));
      var dialog = museSearchEl(doc, 'div', 'muse-keys-dialog muse-handle-dialog');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'muse-handle-title');
      var head = museSearchEl(doc, 'div', 'muse-keys-head');
      var title = museSearchEl(doc, 'h2', 'muse-keys-title', 'ハンドルネーム');
      title.id = 'muse-handle-title';
      var close = museSearchEl(doc, 'button', 'muse-keys-close', '✕');
      close.type = 'button';
      close.setAttribute('data-action', 'close');
      close.setAttribute('aria-label', '閉じる');
      head.appendChild(title);
      head.appendChild(close);
      var body = museSearchEl(doc, 'div', 'muse-keys-body muse-handle-body');
      var userLine = museSearchEl(doc, 'p', 'muse-handle-user', 'ユーザー名: (未取得)');
      var currentLine = museSearchEl(doc, 'p', 'muse-handle-current', 'いまのハンドルネーム: (未取得)');
      var label = museSearchEl(doc, 'label', 'muse-handle-label', 'ハンドルネーム(20文字まで)');
      var input = museSearchEl(doc, 'input', 'muse-handle-input');
      input.type = 'text';
      input.setAttribute('data-field', 'handle-input');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('maxlength', '100');
      input.disabled = true;
      label.appendChild(input);
      var statusLine = museSearchEl(doc, 'p', 'muse-handle-status', 'ユーザー名・ハンドルネームを読み込んでいます…');
      statusLine.setAttribute('data-field', 'handle-status');
      statusLine.setAttribute('role', 'status');
      statusLine.setAttribute('aria-live', 'polite');
      var register = museSearchEl(doc, 'button', 'muse-handle-register', '登録');
      register.type = 'button';
      register.setAttribute('data-action', 'handle-register');
      register.disabled = true;
      body.appendChild(userLine);
      body.appendChild(currentLine);
      body.appendChild(label);
      body.appendChild(statusLine);
      body.appendChild(register);
      dialog.appendChild(head);
      dialog.appendChild(body);
      overlay.appendChild(dialog);
      doc.body.appendChild(overlay);

      var closed = false;
      var busy = false;
      var checkNumber = 0;
      function closeModal() {
        closed = true;
        doc.removeEventListener('keydown', onKeydown);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (opener && opener.focus) opener.focus();
      }
      function onKeydown(event) {
        if (event.key === 'Escape') closeModal();
        else if (event.key === 'Tab') {
          event.preventDefault();
          var items = dialog.querySelectorAll('button, input');
          var enabled = [];
          for (var i = 0; i < items.length; i++) { if (!items[i].disabled) enabled.push(items[i]); }
          var at = Array.prototype.indexOf.call(enabled, doc.activeElement);
          var next = event.shiftKey ? (at <= 0 ? enabled.length - 1 : at - 1) : (at < 0 || at === enabled.length - 1 ? 0 : at + 1);
          enabled[next].focus();
        }
      }
      close.addEventListener('click', closeModal);
      overlay.addEventListener('click', function (event) { if (event.target === overlay) closeModal(); });
      doc.addEventListener('keydown', onKeydown);
      close.focus();

      function setStatus(text, isError) {
        statusLine.textContent = text;
        statusLine.className = 'muse-handle-status' + (isError ? ' muse-search-error' : '');
      }
      function parse(res) {
        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
      }

      // いまのユーザー名と、登録済みのハンドルネームを取る。取れなかったときは、「未設定」に見せず、入力欄と登録ボタンを使えなくする。
      fetchFn('/api/muse-search/handle').then(parse).then(function (r) {
        if (closed) return;
        if (!r.ok) { setStatus(failText(r, 'ハンドルネーム'), true); return; }
        userLine.textContent = 'ユーザー名: ' + r.data.userName;
        currentLine.textContent = 'いまのハンドルネーム: ' + (r.data.handle ? r.data.handle.handleName : '未設定');
        input.disabled = false;
        setStatus('', false);
        input.focus();
      }).catch(function (error) {
        if (closed) return;
        setStatus('ハンドルネームを読み込めませんでした: ' + (error && error.message ? error.message : String(error)), true);
      });

      // 一文字入力するごとの照合。登録ボタンは、照合の応答を待つ間は押せず、一致が無い(available)ときだけ押せる。古い応答は、いまの入力の判定を上書きしない。
      input.addEventListener('input', function () {
        checkNumber += 1;
        var mine = checkNumber;
        var value = input.value;
        register.disabled = true;
        if (value.trim() === '') { setStatus(MUSE_HANDLE_MESSAGES.empty, false); return; }
        setStatus('照合しています…', false);
        fetchFn('/api/muse-search/handle/check?name=' + encodeURIComponent(value)).then(parse).then(function (r) {
          if (closed || mine !== checkNumber) return;
          if (!r.ok) { setStatus(failText(r, 'ハンドルネームの照合'), true); return; }
          var available = r.data.available === true;
          setStatus(MUSE_HANDLE_MESSAGES[r.data.status] || String(r.data.status), !available);
          register.disabled = !available || busy;
        }).catch(function (error) {
          if (closed || mine !== checkNumber) return;
          setStatus('照合できませんでした: ' + (error && error.message ? error.message : String(error)), true);
        });
      });

      // 登録。二重に送らない。他のユーザーが先に取っていた(409)ときは押せなくし、サーバーの失敗・通信の失敗は、理由を出して押し直せるようにする。
      register.addEventListener('click', function () {
        if (busy || register.disabled) return;
        busy = true;
        register.disabled = true;
        input.disabled = true;
        setStatus('登録しています…', false);
        fetchFn('/api/muse-search/handle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: input.value }) }).then(parse).then(function (r) {
          busy = false;
          input.disabled = false;
          if (closed) return;
          if (r.ok) {
            currentLine.textContent = 'いまのハンドルネーム: ' + r.data.handle.handleName;
            setStatus('登録しました: ' + r.data.handle.handleName, false);
            register.disabled = true;
            return;
          }
          if (r.status === 409) {
            setStatus(r.data && r.data.error ? r.data.error : MUSE_HANDLE_MESSAGES.taken, true);
            register.disabled = true;
            return;
          }
          setStatus(failText(r, 'ハンドルネームの登録'), true);
          register.disabled = false;
        }).catch(function (error) {
          busy = false;
          input.disabled = false;
          if (closed) return;
          setStatus('登録できませんでした: ' + (error && error.message ? error.message : String(error)), true);
          register.disabled = false;
        });
      });
    }

    // 初期画面のスレッド一覧。各スレッドへの最終書き込みの日時が新しいほうから順に(APIの順のまま)、スレッドタイトルのリンクだけを並べる。
    // リンクを押すと、そのスレッドへの最終書き込みを、リンクの下に、段落ごとの <p> で出す。もう一度押すと閉じる。開き直しでは取り直さない。
    var MUSE_THREAD_ROLE_LABELS = { user: '質問', assistant: '回答' };
    function failText(r, what) {
      var why = r.data && r.data.detail ? r.data.detail : (r.data && r.data.error ? r.data.error : '');
      return what + 'を読み込めませんでした(HTTP ' + r.status + ')' + (why ? ': ' + why : '');
    }
    function renderMuseThreadLast(doc, data) {
      var wrap = museSearchEl(doc, 'div', 'muse-thread-body');
      wrap.appendChild(museSearchEl(doc, 'p', 'muse-thread-meta', '最終書き込み: ' + formatMuseSearchTime(data.createdAt) + '・' + (MUSE_THREAD_ROLE_LABELS[data.role] || data.role) + '・チャット ' + data.chatId));
      // 各段落は、強調の区間(サーバーが、閲覧ユーザーが持つキーワードで計算済み)の並び。強調(hit)は <mark>、それ以外は文字。文字は textContent だけで入れる。
      data.paragraphs.forEach(function (segments) {
        var paragraph = museSearchEl(doc, 'p', 'muse-thread-paragraph');
        segments.forEach(function (segment) {
          if (segment.hit) paragraph.appendChild(museSearchEl(doc, 'mark', '', segment.text));
          else paragraph.appendChild(doc.createTextNode(segment.text));
        });
        wrap.appendChild(paragraph);
      });
      // 強調に使うキーワードを読めなかったときは、本文は出したまま、強調なしであることと、その理由を伝える(強調なしを「正常」に見せない)。
      if (data.highlightError) wrap.appendChild(museSearchEl(doc, 'p', 'muse-thread-meta muse-thread-highlight-error', 'キーワードの強調は、できませんでした: ' + data.highlightError));
      if (data.truncated) wrap.appendChild(museSearchEl(doc, 'p', 'muse-thread-meta', '本文が長いため、途中までを表示しています。'));
      return wrap;
    }
    // スレッド検索の記録を送るまでの待ち(入力が止まってから)。
    var MUSE_THREAD_SEARCH_LOG_DELAY_MS = 800;
    // 同時に取りにいく数の上限。「全開」で多数のスレッドを開いても、一度に何十本も送らない。
    function createMuseSemaphore(limit) {
      var active = 0;
      var queue = [];
      return {
        acquire: function () {
          return new Promise(function (resolve) {
            if (active < limit) { active += 1; resolve(); } else queue.push(resolve);
          });
        },
        release: function () {
          var next = queue.shift();
          if (next) next(); else active -= 1;
        }
      };
    }
    var MUSE_THREAD_FETCH_LIMIT = 4;

    function isMuseThreadOpen(link) {
      return link.getAttribute('aria-expanded') === 'true';
    }
    function closeMuseThread(link, item) {
      var panel = item.querySelector('.muse-thread-last');
      if (panel) panel.hidden = true;
      link.setAttribute('aria-expanded', 'false');
    }
    // 開く。取れている本文は取り直さない。読み込み中なら、そのまま表示する。失敗していたら、取り直す。
    function openMuseThread(doc, fetchFn, semaphore, link, item) {
      var panel = item.querySelector('.muse-thread-last');
      if (panel && (panel.getAttribute('data-state') === 'loaded' || panel.getAttribute('data-state') === 'loading')) {
        panel.hidden = false;
        link.setAttribute('aria-expanded', 'true');
        return;
      }
      if (!panel) {
        panel = museSearchEl(doc, 'div', 'muse-thread-last');
        item.appendChild(panel);
      }
      panel.hidden = false;
      panel.setAttribute('data-state', 'loading');
      panel.textContent = '読み込んでいます…';
      link.setAttribute('aria-expanded', 'true');
      semaphore.acquire().then(function () {
        return fetchFn('/api/muse-search/thread?threadId=' + encodeURIComponent(link.getAttribute('data-thread-id'))).then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
        }).then(function (r) {
          if (!r.ok) {
            panel.setAttribute('data-state', 'failed');
            panel.textContent = failText(r, '最終書き込み');
            return;
          }
          panel.setAttribute('data-state', 'loaded');
          panel.textContent = '';
          panel.appendChild(renderMuseThreadLast(doc, r.data));
        }).catch(function (error) {
          panel.setAttribute('data-state', 'failed');
          panel.textContent = '最終書き込みを読み込めませんでした: ' + (error && error.message ? error.message : String(error));
        }).then(function () { semaphore.release(); });
      });
    }
    // リンクを押したとき。開いていれば閉じ、閉じていれば開く。ただし、取れなかった(失敗した)ときは、押し直すと取り直す。
    function toggleMuseThread(doc, fetchFn, semaphore, link, item) {
      var panel = item.querySelector('.muse-thread-last');
      if (panel && panel.getAttribute('data-state') === 'failed') openMuseThread(doc, fetchFn, semaphore, link, item);
      else if (isMuseThreadOpen(link)) closeMuseThread(link, item);
      else openMuseThread(doc, fetchFn, semaphore, link, item);
    }
    // isCurrent: 取り直しの応答が前後しても、いちばん新しい取り直しの結果だけを出す(古い応答は、画面を上書きしない)。
    function loadMuseThreads(doc, fetchFn, container, isCurrent) {
      container.textContent = '読み込んでいます…';
      fetchFn('/api/muse-search/threads').then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
      }).then(function (r) {
        if (isCurrent && !isCurrent()) return;
        container.textContent = '';
        if (!r.ok) {
          container.appendChild(museSearchEl(doc, 'p', 'muse-search-error', failText(r, 'スレッドの一覧')));
          return;
        }
        if (!r.data || !Array.isArray(r.data.threads)) {
          container.appendChild(museSearchEl(doc, 'p', 'muse-search-error', 'スレッドの一覧を読み込めませんでした(応答の形が想定と違います)'));
          return;
        }
        if (r.data.threads.length === 0) {
          container.appendChild(museSearchEl(doc, 'p', 'muse-search-status', 'スレッドがまだありません。'));
          return;
        }
        var semaphore = createMuseSemaphore(MUSE_THREAD_FETCH_LIMIT);
        var items = [];

        // 検索窓(表示中のスレッドのタイトルを絞り込む。ブラウザ側だけで、サーバーは呼ばない)と、「全開/全閉」ボタン。
        var tools = museSearchEl(doc, 'div', 'muse-thread-tools');
        var filter = museSearchEl(doc, 'input', 'muse-thread-filter');
        filter.type = 'search';
        filter.setAttribute('data-field', 'thread-filter');
        filter.setAttribute('placeholder', '表示中のスレッドを絞り込む');
        filter.setAttribute('aria-label', 'スレッドのタイトルで絞り込む');
        filter.setAttribute('maxlength', '500');
        filter.setAttribute('autocomplete', 'off');
        var toggleAll = museSearchEl(doc, 'button', 'muse-thread-toggle-all', '全開');
        toggleAll.type = 'button';
        toggleAll.setAttribute('data-action', 'toggle-all');
        toggleAll.title = '表示中のスレッドの最終書き込みを、すべて開く/閉じる';
        tools.appendChild(filter);
        tools.appendChild(toggleAll);
        container.appendChild(tools);
        var noMatch = museSearchEl(doc, 'p', 'muse-thread-nomatch', 'タイトルに一致するスレッドはありません。');
        noMatch.hidden = true;
        container.appendChild(noMatch);

        function visibleItems() { return items.filter(function (entry) { return !entry.item.hidden; }); }
        // ボタンの文字は、表示中のスレッドがすべて開いていれば「全閉」、そうでなければ「全開」。
        function updateToggleAll() {
          var visible = visibleItems();
          var allOpen = visible.length > 0 && visible.every(function (entry) { return isMuseThreadOpen(entry.link); });
          toggleAll.textContent = allOpen ? '全閉' : '全開';
        }
        // スレッド検索の記録(2026-11-20、ユーザー指定): 検索したキーと、ヒットしたスレッドIDをサーバーへ送る(件数はサーバーが数える)。
        // 入力のたびには送らない。入力が止まって MUSE_THREAD_SEARCH_LOG_DELAY_MS 後、またはEnterですぐ。空の検索と、直前に記録したのと同じキーは送らない。
        // 失敗は、絞り込みを止めずに、理由つきで画面に出す(握りつぶさない)。
        var logNote = museSearchEl(doc, 'p', 'muse-thread-meta muse-thread-search-log-error');
        logNote.hidden = true;
        tools.appendChild(logNote);
        var logTimer = null;
        var lastLoggedKey = '';
        function showLogError(message) {
          logNote.textContent = 'スレッド検索を記録できませんでした: ' + message;
          logNote.hidden = false;
        }
        function recordThreadSearchNow() {
          if (logTimer !== null) { clearTimeout(logTimer); logTimer = null; }
          var key = filter.value.trim();
          if (key === '' || key.toLowerCase() === lastLoggedKey) return;
          lastLoggedKey = key.toLowerCase();
          var threadIds = visibleItems().map(function (entry) { return entry.link.getAttribute('data-thread-id'); });
          Promise.resolve().then(function () {
            return fetchFn('/api/muse-search/thread-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key, threadIds: threadIds }) });
          }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, status: res.status, body: body }; });
          }).then(function (r) {
            if (r.ok && r.body && r.body.recorded === true) { logNote.hidden = true; logNote.textContent = ''; return; }
            lastLoggedKey = '';
            showLogError((r.body && (r.body.detail || r.body.error)) ? (r.status + ' ' + (r.body.detail || r.body.error)) : String(r.status));
          }).catch(function (error) {
            lastLoggedKey = '';
            showLogError(error && error.message ? error.message : String(error));
          });
        }
        filter.addEventListener('input', function () {
          var query = filter.value.trim().toLowerCase();
          items.forEach(function (entry) {
            entry.item.hidden = query !== '' && entry.link.textContent.toLowerCase().indexOf(query) < 0;
          });
          noMatch.hidden = query === '' || visibleItems().length > 0;
          updateToggleAll();
          if (logTimer !== null) { clearTimeout(logTimer); logTimer = null; }
          if (query !== '') logTimer = setTimeout(recordThreadSearchNow, MUSE_THREAD_SEARCH_LOG_DELAY_MS);
        });
        filter.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') { event.preventDefault(); recordThreadSearchNow(); }
        });
        toggleAll.addEventListener('click', function () {
          var visible = visibleItems();
          var allOpen = visible.length > 0 && visible.every(function (entry) { return isMuseThreadOpen(entry.link); });
          visible.forEach(function (entry) {
            if (allOpen) closeMuseThread(entry.link, entry.item);
            else if (!isMuseThreadOpen(entry.link)) openMuseThread(doc, fetchFn, semaphore, entry.link, entry.item);
          });
          updateToggleAll();
        });

        var list = museSearchEl(doc, 'ul', 'muse-thread-list');
        r.data.threads.forEach(function (thread) {
          var item = museSearchEl(doc, 'li', 'muse-thread-item');
          var link = museSearchEl(doc, 'a', 'muse-thread-link', thread.title);
          link.setAttribute('href', '#');
          link.setAttribute('data-thread-id', thread.threadId);
          link.setAttribute('aria-expanded', 'false');
          link.title = '最終書き込み: ' + formatMuseSearchTime(thread.lastPostAt);
          link.addEventListener('click', function (event) {
            event.preventDefault();
            toggleMuseThread(doc, fetchFn, semaphore, link, item);
            updateToggleAll();
          });
          item.appendChild(link);
          list.appendChild(item);
          items.push({ item: item, link: link });
        });
        container.appendChild(list);
      }).catch(function (error) {
        if (isCurrent && !isCurrent()) return;
        container.textContent = '';
        container.appendChild(museSearchEl(doc, 'p', 'muse-search-error', 'スレッドの一覧を読み込めませんでした: ' + (error && error.message ? error.message : String(error))));
      });
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
      var handleButton = doc.querySelector('button[data-action="handle"]');
      handleButton.addEventListener('click', function () { openMuseHandleModal(doc, fetchFn, handleButton); });
      // 水平タブ(ユーザー指定 2026-11-19): 「スレッド一覧」「検索結果」。読み込み時は「スレッド一覧」が選ばれている。検索すると「検索結果」へ移る。
      // 「スレッド一覧」が選ばれるたびに、一覧を取り直す(読み込み時の1回も同じ)。「検索結果」は、前の結果をそのまま見せる。
      var threads = doc.querySelector('[data-field="threads"]');
      var tabs = { threads: doc.querySelector('[data-tab="threads"]'), results: doc.querySelector('[data-tab="results"]') };
      var panels = { threads: threads, results: doc.querySelector('[data-panel="results"]') };
      var TAB_ORDER = ['threads', 'results'];
      var threadsLoadNumber = 0;
      function reloadThreads() {
        threadsLoadNumber += 1;
        var mine = threadsLoadNumber;
        loadMuseThreads(doc, fetchFn, threads, function () { return mine === threadsLoadNumber; });
      }
      function selectTab(name) {
        TAB_ORDER.forEach(function (tabName) {
          var on = tabName === name;
          tabs[tabName].setAttribute('aria-selected', on ? 'true' : 'false');
          tabs[tabName].tabIndex = on ? 0 : -1;
          panels[tabName].hidden = !on;
        });
        if (name === 'threads') reloadThreads();
      }
      TAB_ORDER.forEach(function (tabName) {
        tabs[tabName].addEventListener('click', function () { selectTab(tabName); });
      });
      tabs.threads.parentNode.addEventListener('keydown', function (event) {
        var at = tabs.threads.getAttribute('aria-selected') === 'true' ? 0 : 1;
        var target = null;
        if (event.key === 'ArrowRight') target = TAB_ORDER[(at + 1) % TAB_ORDER.length];
        else if (event.key === 'ArrowLeft') target = TAB_ORDER[(at + TAB_ORDER.length - 1) % TAB_ORDER.length];
        else if (event.key === 'Home') target = TAB_ORDER[0];
        else if (event.key === 'End') target = TAB_ORDER[TAB_ORDER.length - 1];
        if (!target) return;
        event.preventDefault();
        selectTab(target);
        tabs[target].focus();
      });
      selectTab('threads');

      // スマホ幅の縦並びの設定(ユーザー指定 2026-11-19)。初期値はOFF(今までの表のまま)。この端末のブラウザにだけ保存する(サーバーには送らない)。
      // ONのときだけ <html> に muse-stacked を付け、幅560px以下の検索キーの表が縦並びになる。ブラウザの保存が使えなくても、スイッチはその場で効く。
      var MUSE_STACKED_KEY = 'museSearchStackedTables';
      var stackedToggle = doc.querySelector('input[data-setting="stacked"]');
      function readStackedSetting() {
        try { return doc.defaultView.localStorage.getItem(MUSE_STACKED_KEY) === '1'; } catch (error) { return false; }
      }
      function applyStackedSetting(on) {
        doc.documentElement.classList.toggle('muse-stacked', on);
      }
      stackedToggle.checked = readStackedSetting();
      applyStackedSetting(stackedToggle.checked);
      stackedToggle.addEventListener('change', function () {
        var on = stackedToggle.checked;
        applyStackedSetting(on);
        try {
          if (on) doc.defaultView.localStorage.setItem(MUSE_STACKED_KEY, '1');
          else doc.defaultView.localStorage.removeItem(MUSE_STACKED_KEY);
        } catch (error) { /* 保存できなくても、この画面では効いている */ }
      });

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
        // 検索の結果・メッセージは「検索結果」のタブにあるので、そのタブへ移る(検索を始めた時点で)。
        selectTab('results');
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
          status.textContent = r.data.count + '組見つかりました(質問と回答のペア)。';
          if (r.data.keyLogged === false) {
            status.textContent += '(検索キーを記録できませんでした' + (r.data.keyLogError ? ': ' + r.data.keyLogError : '') + ')';
            status.className = 'muse-search-status muse-search-error';
          }
          r.data.pairs.forEach(function (pair) { list.appendChild(renderMuseSearchItem(doc, pair, function (link, chatId, answerId) { openMuseChatModal(doc, fetchFn, link, chatId, answerId); })); });
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
    .muse-handle-user, .muse-handle-current { margin: 0 0 6px; overflow-wrap: anywhere; }
    .muse-handle-label { display: block; margin: 12px 0 0; color: var(--text-secondary); font-size: 13px; }
    .muse-handle-input { display: block; width: 100%; min-height: 36px; box-sizing: border-box; margin: 4px 0 0; padding: 0 12px; color: var(--text-primary); background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; font: inherit; }
    .muse-handle-status { min-height: 1.5em; margin: 8px 0; color: var(--text-secondary); overflow-wrap: anywhere; }
    .muse-handle-register { min-height: 36px; padding: 0 18px; color: var(--text-primary); background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font: inherit; }
    .muse-handle-register:disabled { opacity: 0.5; cursor: not-allowed; }
    .muse-setting { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 4px; color: var(--text-secondary); font-size: 13px; cursor: pointer; }
    .muse-setting input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent-color); }
    .muse-tabs { display: flex; gap: 4px; margin: 12px 0 8px; border-bottom: 1px solid var(--border-color); }
    .muse-tab { min-height: 36px; padding: 0 16px; margin-bottom: -1px; color: var(--text-secondary); background: none; border: 1px solid transparent; border-bottom: 0; border-radius: 6px 6px 0 0; cursor: pointer; font: inherit; }
    .muse-tab[aria-selected="true"] { color: var(--text-primary); background: var(--card-bg); border-color: var(--border-color); font-weight: 600; }
    .muse-threads { margin: 16px 0 0; }
    .muse-thread-tools { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; }
    .muse-thread-filter { flex: 1 1 auto; min-width: 0; min-height: 36px; box-sizing: border-box; padding: 0 12px; color: var(--text-primary); background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; font: inherit; }
    .muse-thread-toggle-all { flex: 0 0 auto; min-height: 36px; padding: 0 14px; white-space: nowrap; color: var(--text-primary); background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font: inherit; }
    .muse-thread-nomatch { margin: 0 0 8px; color: var(--text-secondary); }
    .muse-thread-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .muse-thread-link { color: var(--accent-color); text-decoration: none; overflow-wrap: anywhere; }
    .muse-thread-last { margin: 6px 0 4px 4px; padding: 6px 0 2px 12px; border-left: 2px solid var(--border-color); color: var(--text-primary); }
    .muse-thread-meta { margin: 0 0 8px; font-size: 12px; color: var(--text-secondary); }
    .muse-thread-paragraph mark { background: var(--warning-color); color: var(--bg-primary); border-radius: 2px; padding: 0 2px; }
    .muse-thread-paragraph { margin: 0 0 10px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
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
    .muse-handle-overlay { position: fixed; inset: 0; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--modal-overlay); }
    .muse-answers-link { color: var(--accent-color); text-decoration: none; }
    .muse-sort { font: inherit; font-weight: 600; line-height: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; min-height: 0; min-width: 0; height: auto; cursor: pointer; text-align: inherit; white-space: nowrap; }
    .muse-keys-list .muse-sort { white-space: normal; }
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
    .muse-keys-table tbody td { transform: translateX(var(--swipe-x, 0px)); transition: transform 0.2s ease; background: var(--card-bg); touch-action: pan-y; }
    .muse-keys-table tbody tr.swiping td { transition: none; }
    .muse-keys-table tbody tr.swipe-open td:first-child, .muse-keys-table tbody tr.swiping td:first-child { position: sticky; left: 0; z-index: 1; transform: none; }
    .muse-search-side { display: flex; gap: 8px; align-items: baseline; margin-top: 4px; }
    .muse-search-side .muse-search-snippet { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    .muse-search-side .muse-search-role { flex-shrink: 0; white-space: nowrap; }
    .muse-search-nohit { color: var(--text-muted); font-size: 13px; }
    .muse-chat-link { color: var(--accent-color, var(--text-primary)); text-decoration: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .muse-chat-post { padding: 10px 12px; border: 1px solid var(--border-light); border-radius: 8px; }
    .muse-chat-post + .muse-chat-post { margin-top: 8px; }
    .muse-chat-heading { cursor: pointer; }
    .muse-chat-meta { color: var(--text-secondary); font-size: 13px; }
    .muse-chat-role { font-weight: 700; color: var(--text-primary); }
    ${getMarkdownPreviewCSS().replaceAll('.preview-area', '.muse-chat-markdown')}
    .muse-chat-markdown { margin-top: 8px; overflow-wrap: anywhere; overflow-x: auto; }
    .muse-chat-markdown > :first-child { margin-top: 0; }
    .muse-chat-markdown > :last-child { margin-bottom: 0; }
    .muse-chat-markdown mark { background: var(--warning-color); color: var(--text-on-warning, var(--text-primary)); }
    .muse-confirm-overlay { position: fixed; inset: 0; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--modal-overlay); }
    .muse-confirm-dialog { box-sizing: border-box; width: 100%; max-width: 340px; padding: 20px 18px 16px; background: var(--card-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 12px; }
    .muse-confirm-title { margin: 0 0 8px; font-size: 15px; }
    .muse-confirm-key { margin: 0 0 8px; font-weight: 700; overflow-wrap: anywhere; }
    .muse-confirm-desc { margin: 0 0 18px; font-size: 13px; line-height: 1.55; color: var(--text-secondary); }
    .muse-confirm-buttons { display: flex; gap: 10px; justify-content: flex-end; }
    .muse-confirm-cancel, .muse-confirm-danger { min-height: 36px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; font-size: 13px; }
    .muse-confirm-cancel { background: var(--bg-secondary); color: var(--text-primary); }
    .muse-confirm-danger { background: var(--danger-color); color: var(--bg-primary); font-weight: 700; }
    .muse-confirm-cancel:disabled, .muse-confirm-danger:disabled { opacity: 0.6; cursor: default; }
    .muse-keys-delete-area { position: fixed; width: 72px; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; font-size: 12px; font-weight: 700; background: var(--danger-color); color: var(--bg-primary); }
    .muse-keys-delete-area[hidden] { display: none; }
    .muse-keys-delete-area:disabled { opacity: 0.6; cursor: default; }
    .muse-keys-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .muse-keys-table th, .muse-keys-table td { padding: 6px 8px; border-bottom: 1px solid var(--border-light); text-align: left; vertical-align: top; }
    .muse-keys-table thead th { position: sticky; top: 0; background: var(--card-bg); color: var(--text-secondary); font-weight: 600; }
    .muse-keys-table .muse-keys-num { text-align: right; min-width: 5.5em; }
    .muse-keys-table .muse-keys-key { min-width: 12em; overflow-wrap: anywhere; }
    .muse-keys-table .muse-keys-time { white-space: nowrap; }
    .muse-search-form button[data-action="keys"] { padding: 0 12px; }
    .muse-search-form button[data-action="handle"] { padding: 0 12px; }
    .muse-search-snippet mark { background: var(--warning-color); color: var(--bg-primary); border-radius: 2px; padding: 0 2px; }
    @media (max-width: 560px) {
      .muse-stacked .muse-keys-list, .muse-stacked .muse-keys-list tbody, .muse-stacked .muse-keys-list tr, .muse-stacked .muse-keys-list td { display: block; }
      .muse-stacked .muse-keys-list thead { display: block; }
      .muse-stacked .muse-keys-list thead tr { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 0 0 8px; border-bottom: 1px solid var(--border-color); }
      .muse-stacked .muse-keys-list thead th { display: block; position: static; padding: 0; border: 0; font-size: 13px; text-align: left; }
      .muse-stacked .muse-keys-list tr { padding: 8px 0; border-bottom: 1px solid var(--border-light); }
      .muse-stacked .muse-keys-list td { border: 0; padding: 2px 0; text-align: left; min-width: 0; white-space: normal; }
      .muse-stacked .muse-keys-list td[data-label] { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 12px; text-align: right; }
      .muse-stacked .muse-keys-list td.muse-keys-num, .muse-stacked .muse-keys-list td.muse-keys-time { min-width: 0; white-space: normal; }
      .muse-stacked .muse-keys-list td[data-label]::before { content: attr(data-label); flex: 0 0 auto; text-align: left; color: var(--text-secondary); }
      .muse-stacked .muse-keys-list td.muse-keys-key { min-width: 0; font-weight: 600; overflow-wrap: anywhere; }
    }
  </style>
</head>
<body>
  <nav class="muse-search-nav"><span class="muse-search-title">Museの会話を検索</span><span class="muse-search-nav-end">${getThemeToggleHTML()}</span></nav>
  <main class="muse-search-main">
    <form class="muse-search-form" role="search">
      <input type="search" name="q" placeholder="tree-view の Museタブの会話から探す" aria-label="検索する文字" maxlength="500" autocomplete="off">
      <button type="submit">検索</button>
      <button type="button" data-action="keys" aria-label="検索キーの一覧を開く" title="検索キーの一覧(AIチャットでの出現回数の順)">🔑</button>
      <button type="button" data-action="handle" aria-label="ハンドルネームを設定する" title="ハンドルネームの設定">👤</button>
    </form>
    <div class="muse-tabs" role="tablist" aria-label="表示の切り替え">
      <button type="button" class="muse-tab" role="tab" id="muse-tab-threads" data-tab="threads" aria-selected="true" aria-controls="muse-panel-threads">スレッド一覧</button>
      <button type="button" class="muse-tab" role="tab" id="muse-tab-results" data-tab="results" aria-selected="false" aria-controls="muse-panel-results" tabindex="-1">検索結果</button>
    </div>
    <p class="muse-search-note">質問と回答の両方を探します(大文字と小文字は区別しません)。新しい順に、最大100件まで表示します。</p>
    <label class="muse-setting"><input type="checkbox" data-setting="stacked"> スマホ幅(幅560px以下)で、検索キーの表を縦並びにする</label>
    <div class="muse-tabpanel" role="tabpanel" id="muse-panel-results" data-panel="results" aria-labelledby="muse-tab-results" hidden>
      <p class="muse-search-status" data-field="status" role="status" aria-live="polite"></p>
      <ul class="muse-search-results" data-field="results"></ul>
    </div>
    <section class="muse-threads" role="tabpanel" id="muse-panel-threads" data-panel="threads" aria-labelledby="muse-tab-threads" data-field="threads"></section>
  </main>
  <script>${MUSE_SEARCH_SCRIPT}
    initMuseSearchPage(document, function (url, init) { var options = init || {}; var headers = Object.assign({ Accept: 'application/json' }, options.headers || {}); return fetch(url, Object.assign({}, options, { headers: headers })); });
  </script>
  <script>${getThemeToggleScript()}</script>
</body>
</html>`;
}
