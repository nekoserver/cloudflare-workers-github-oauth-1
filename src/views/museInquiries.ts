import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

/**
 * /muse-inquiries: Museとの協議(D1 agent-inquiries)のカンバン。ユーザー指定(2026-11-07)。
 *
 * 列はフェーズ(協議・未解決の論点・提案・採用・完了・不採用)で、各列に問い合わせ・キー・提案のパネルを並べる。
 * 上部にケースごとのパネル(採否待ちの提案数・問い合わせ数・未解決の論点・所要時間)を置き、ケースで絞り込める。
 * どのパネルからも詳細モーダルを開く。Museの回答など上流の文字列はすべてtextContentで表示する。
 * template literalに埋め込むため、バックスラッシュのエスケープと正規表現リテラルを使わない(CLAUDE.md ルール29)。
 */
export const MUSE_INQUIRIES_SCRIPT = `
    var INQ_CASE_STATUS_LABELS = { open: '協議中', resolved: '解決', abandoned: '中止' };
    var INQ_KEY_KIND_LABELS = { unknown: '未確認', pitfall: '落とし穴', known: '事実' };
    var INQ_PROPOSAL_STATUS_LABELS = { proposed: '採否待ち', adopted: '採用', done: '完了', rejected: '不採用' };
    // 件数は選択中ケースのカード数。業務フェーズは変更せず、表示対象だけを切り替える。
    var INQ_STATUS_FILTERS = {
      all: { label: 'すべて', phases: null },
      discussing: { label: '協議中', phases: ['inquiry', 'open-keys', 'adopted'] },
      pending: { label: '採否待ち', phases: ['proposed'] },
      done: { label: '完了', phases: ['done'] }
    };

    function formatInqDuration(seconds) {
      if (seconds === null || seconds === undefined) return '—';
      var s = Math.max(0, Math.round(Number(seconds) || 0));
      if (s < 60) return s + '秒';
      if (s < 3600) return Math.floor(s / 60) + '分' + (s % 60) + '秒';
      return Math.floor(s / 3600) + '時間' + Math.floor((s % 3600) / 60) + '分';
    }
    function formatInqTime(iso) {
      return iso ? String(iso).replace('T', ' ').slice(0, 16) : '—';
    }
    /** 開いているfixed要素の最大のz-index + 100(CLAUDE.md ルール26)。 */
    function getNextZ(doc) {
      var max = 1000;
      var all = doc.querySelectorAll('body *');
      for (var i = 0; i < all.length; i++) {
        var view = doc.defaultView;
        var style = view && view.getComputedStyle ? view.getComputedStyle(all[i]) : null;
        if (!style || style.position !== 'fixed') continue;
        var z = parseInt(style.zIndex, 10);
        if (!isNaN(z) && z > max) max = z;
      }
      return max + 100;
    }
    function el(doc, tag, className, text) {
      var node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = String(text);
      return node;
    }
    function badge(doc, text, kind) {
      return el(doc, 'span', 'inq-badge inq-badge-' + kind, text);
    }

    function initMuseInquiriesPage(deps) {
      var doc = deps.document;
      var notice = doc.getElementById('inq-notice');
      var boardEl = doc.getElementById('inq-board');
      var casesEl = doc.getElementById('inq-cases');
      var filter = doc.getElementById('inq-case-filter');
      var modal = doc.getElementById('inq-modal');
      var modalTitle = doc.getElementById('inq-modal-title');
      var modalBody = doc.getElementById('inq-modal-body');
      var board = null;
      var caseCache = {};
      var statusFilter = 'all';
      var statusButtons = doc.querySelectorAll('[data-status-filter]');

      function setNotice(text) { notice.textContent = text; notice.hidden = !text; }
      function caseById(id) { return board ? board.cases.filter(function(c) { return c.id === id; })[0] : null; }
      function loadCase(caseId) {
        if (!caseCache[caseId]) {
          caseCache[caseId] = deps.fetchJson('/api/muse-inquiries/cases/' + encodeURIComponent(caseId)).catch(function(error) {
            delete caseCache[caseId];
            throw error;
          });
        }
        return caseCache[caseId];
      }

      function openModal(title) {
        modalTitle.textContent = title;
        modalBody.textContent = '';
        modal.style.zIndex = String(getNextZ(doc));
        modal.hidden = false;
        return modalBody;
      }
      function closeModal() { modal.hidden = true; }
      function field(body, label, value, pre) {
        if (value === null || value === undefined || value === '') return;
        var row = el(doc, 'div', 'inq-field');
        row.appendChild(el(doc, 'div', 'inq-field-label', label));
        row.appendChild(el(doc, 'div', pre ? 'inq-field-value inq-pre' : 'inq-field-value', value));
        body.appendChild(row);
      }
      function failModal(body, error) {
        body.appendChild(el(doc, 'p', 'inq-error', '読み込めませんでした: ' + (error && error.message ? error.message : String(error))));
      }
      function renderEntry(body, entry) {
        var meta = el(doc, 'p', 'inq-meta');
        meta.textContent = '#' + entry.seq + ' ' + entry.agent + ' / ' + entry.askedBy + ' / ' + formatInqTime(entry.createdAt) + ' / 所要 ' + formatInqDuration(entry.durationSeconds) + (entry.askId ? ' / ' + entry.askId : '');
        body.appendChild(meta);
        field(body, '手掛かり', entry.clue);
        field(body, '質問', entry.question, true);
        field(body, '回答', entry.answer, true);
        field(body, '聞き出した事実', entry.info, true);
        field(body, '前進', entry.progress, true);
        field(body, 'エラー', entry.error, true);
      }
      function findEntry(detail, ref) {
        return detail.entries.filter(function(e) { return (ref.id && e.id === ref.id) || (ref.seq !== undefined && e.seq === ref.seq); })[0];
      }
      function openEntry(caseId, ref) {
        var body = openModal('協議の内容');
        body.appendChild(el(doc, 'p', 'inq-meta', '読み込み中…'));
        return loadCase(caseId).then(function(detail) {
          body.textContent = '';
          var entry = findEntry(detail, ref);
          if (!entry) { body.appendChild(el(doc, 'p', 'inq-error', '問い合わせが見つかりません')); return; }
          modalTitle.textContent = '協議の内容 #' + entry.seq;
          field(body, 'ケース', detail.case.goal);
          renderEntry(body, entry);
        }, function(error) { body.textContent = ''; failModal(body, error); });
      }
      function openKey(panel) {
        var body = openModal('未解決の論点');
        var c = caseById(panel.caseId);
        field(body, 'ケース', c ? c.goal : panel.caseId);
        field(body, '種類', INQ_KEY_KIND_LABELS[panel.kind] || panel.kind);
        field(body, '内容', panel.title, true);
        field(body, '止まるか', panel.blocking ? '止まる(先に解決する)' : '止まらない');
        field(body, '変更を伴うか', panel.mutating ? '変更を伴う(承認が要る)' : '読み取りのみ');
      }
      function openProposal(panel) {
        var body = openModal('提案');
        var c = caseById(panel.caseId);
        field(body, 'ケース', c ? c.goal : panel.caseId);
        field(body, '提案', panel.title, true);
        field(body, '状態', INQ_PROPOSAL_STATUS_LABELS[panel.status] || panel.status);
        field(body, '理由', panel.reason, true);
        field(body, '提案者', panel.proposedBy);
        if (panel.entryId) {
          var button = el(doc, 'button', 'inq-link-btn', '発端の問い合わせを開く');
          button.type = 'button';
          button.setAttribute('data-action', 'open-entry');
          button.addEventListener('click', function() { openEntry(panel.caseId, { id: panel.entryId }); });
          body.appendChild(button);
        }
      }
      function openCase(caseId) {
        var c = caseById(caseId);
        var body = openModal(c ? c.goal : caseId);
        body.appendChild(el(doc, 'p', 'inq-meta', '読み込み中…'));
        return loadCase(caseId).then(function(detail) {
          body.textContent = '';
          var meta = el(doc, 'p', 'inq-meta');
          meta.textContent = caseId + ' / ' + (INQ_CASE_STATUS_LABELS[detail.case.status] || detail.case.status) + ' / 開始 ' + formatInqTime(detail.case.createdAt) + ' / 所要 ' + formatInqDuration(detail.case.durationSeconds);
          body.appendChild(meta);
          body.appendChild(el(doc, 'h3', '', '協議（' + detail.entries.length + '件）'));
          detail.entries.forEach(function(entry) {
            var details = el(doc, 'details', 'inq-details');
            details.appendChild(el(doc, 'summary', '', '#' + entry.seq + ' ' + entry.clue));
            renderEntry(details, entry);
            body.appendChild(details);
          });
          body.appendChild(el(doc, 'h3', '', 'キー（' + detail.keys.length + '件）'));
          var keys = el(doc, 'ul', 'inq-list');
          detail.keys.forEach(function(key) {
            var li = el(doc, 'li');
            li.appendChild(badge(doc, INQ_KEY_KIND_LABELS[key.kind] || key.kind, key.status === 'open' ? 'warn' : 'muted'));
            li.appendChild(doc.createTextNode(' ' + key.text + (key.status === 'open' ? '(未解決)' : '')));
            keys.appendChild(li);
          });
          body.appendChild(keys);
          body.appendChild(el(doc, 'h3', '', '提案（' + detail.proposals.length + '件）'));
          var proposals = el(doc, 'ul', 'inq-list');
          detail.proposals.forEach(function(p) {
            var li = el(doc, 'li');
            li.appendChild(badge(doc, INQ_PROPOSAL_STATUS_LABELS[p.status] || p.status, p.status === 'proposed' ? 'warn' : p.status === 'rejected' ? 'muted' : 'ok'));
            li.appendChild(doc.createTextNode(' ' + p.text));
            proposals.appendChild(li);
          });
          body.appendChild(proposals);
        }, function(error) { body.textContent = ''; failModal(body, error); });
      }

      function renderPanel(panel) {
        var button = el(doc, 'button', 'inq-panel inq-panel-' + panel.type);
        button.type = 'button';
        button.setAttribute('data-panel', panel.type);
        var c = caseById(panel.caseId);
        if (panel.type === 'entry') {
          button.appendChild(el(doc, 'div', 'inq-panel-title', panel.title));
          if (panel.summary) button.appendChild(el(doc, 'div', 'inq-panel-summary', panel.summary));
          button.appendChild(el(doc, 'div', 'inq-meta', '#' + panel.seq + ' ' + panel.agent + ' / 所要 ' + formatInqDuration(panel.durationSeconds) + ' / ' + formatInqTime(panel.createdAt)));
          button.addEventListener('click', function() { openEntry(panel.caseId, { seq: panel.seq }); });
        } else if (panel.type === 'key') {
          var row = el(doc, 'div', 'inq-row');
          row.appendChild(badge(doc, INQ_KEY_KIND_LABELS[panel.kind] || panel.kind, 'warn'));
          if (panel.blocking) row.appendChild(el(doc, 'span', 'inq-badge inq-badge-ng inq-blocking', '止まる'));
          if (panel.mutating) row.appendChild(badge(doc, '変更を伴う', 'muted'));
          button.appendChild(row);
          button.appendChild(el(doc, 'div', 'inq-panel-title', panel.title));
          button.addEventListener('click', function() { openKey(panel); });
        } else {
          button.appendChild(el(doc, 'div', 'inq-panel-title', panel.title));
          if (panel.reason) button.appendChild(el(doc, 'div', 'inq-panel-summary', panel.reason));
          button.addEventListener('click', function() { openProposal(panel); });
        }
        button.appendChild(el(doc, 'div', 'inq-meta inq-panel-case', c ? c.goal : panel.caseId));
        return button;
      }
      function renderBoard() {
        var selected = filter.value;
        var active = INQ_STATUS_FILTERS[statusFilter];
        var counts = { all: 0, discussing: 0, pending: 0, done: 0 };
        boardEl.textContent = '';
        board.phases.forEach(function(phase) {
          var panels = phase.panels.filter(function(p) { return !selected || p.caseId === selected; });
          Object.keys(counts).forEach(function(key) {
            var phases = INQ_STATUS_FILTERS[key].phases;
            if (!phases || phases.indexOf(phase.key) !== -1) counts[key] += panels.length;
          });
          if (active.phases && active.phases.indexOf(phase.key) === -1) return;
          var col = el(doc, 'section', 'inq-col');
          col.setAttribute('data-phase', phase.key);
          var head = el(doc, 'h2', 'inq-col-head');
          var label = el(doc, 'span', '', phase.label);
          label.setAttribute('data-field', 'label');
          var count = el(doc, 'span', 'inq-count', panels.length);
          count.setAttribute('data-field', 'count');
          head.appendChild(label);
          head.appendChild(count);
          col.appendChild(head);
          if (!panels.length) {
            var empty = el(doc, 'p', 'inq-meta', 'ありません');
            empty.setAttribute('data-field', 'empty');
            col.appendChild(empty);
          }
          panels.forEach(function(panel) { col.appendChild(renderPanel(panel)); });
          boardEl.appendChild(col);
        });
        statusButtons.forEach(function(button) {
          var key = button.getAttribute('data-status-filter');
          button.disabled = false;
          button.setAttribute('aria-pressed', String(key === statusFilter));
          button.querySelector('[data-filter-count]').textContent = String(counts[key]);
        });
        doc.getElementById('inq-filter-result').textContent = active.label + ': ' + counts[statusFilter] + '件';
      }
      function renderCases() {
        casesEl.textContent = '';
        filter.textContent = '';
        var all = el(doc, 'option', '', 'すべてのケース');
        all.value = '';
        filter.appendChild(all);
        board.cases.forEach(function(c) {
          var option = el(doc, 'option', '', c.goal);
          option.value = c.id;
          filter.appendChild(option);
          var button = el(doc, 'button', 'inq-case');
          button.type = 'button';
          button.setAttribute('data-case-summary', c.id);
          var top = el(doc, 'div', 'inq-row');
          top.appendChild(badge(doc, INQ_CASE_STATUS_LABELS[c.status] || c.status, c.status === 'open' ? 'warn' : c.status === 'resolved' ? 'ok' : 'muted'));
          top.appendChild(el(doc, 'span', 'inq-panel-title', c.goal));
          button.appendChild(top);
          var stats = el(doc, 'div', 'inq-row inq-stats');
          stats.appendChild(el(doc, 'span', '', '採否待ちの提案 ' + c.proposed));
          stats.appendChild(el(doc, 'span', '', '問い合わせ ' + c.entries));
          stats.appendChild(el(doc, 'span', c.blockingOpenKeys ? 'inq-blocking' : '', '未解決 ' + c.openKeys));
          stats.appendChild(el(doc, 'span', '', '所要 ' + formatInqDuration(c.durationSeconds)));
          button.appendChild(stats);
          button.appendChild(el(doc, 'div', 'inq-meta', c.id + ' / 最後の問い合わせ ' + formatInqTime(c.lastAskedAt)));
          button.addEventListener('click', function() { openCase(c.id); });
          casesEl.appendChild(button);
        });
      }

      doc.getElementById('inq-modal-close').addEventListener('click', closeModal);
      modal.addEventListener('click', function(event) { if (event.target === modal) closeModal(); });
      doc.addEventListener('keydown', function(event) { if (event.key === 'Escape') closeModal(); });
      filter.addEventListener('change', function() { if (board) renderBoard(); });
      statusButtons.forEach(function(button) {
        button.addEventListener('click', function() {
          if (!board) return;
          statusFilter = button.getAttribute('data-status-filter');
          renderBoard();
        });
      });
      doc.getElementById('inq-refresh').addEventListener('click', function() { caseCache = {}; load(); });

      function load() {
        return deps.fetchJson('/api/muse-inquiries/board').then(function(data) {
          board = data;
          setNotice('');
          var selected = filter.value;
          renderCases();
          filter.value = selected && caseById(selected) ? selected : '';
          renderBoard();
        }, function(error) {
          setNotice('協議の記録を読み込めませんでした: ' + (error && error.message ? error.message : String(error)));
        });
      }
      return load();
    }
`;

export function getMuseInquiriesPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Museとの協議</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    body { margin: 0; background: var(--bg-secondary); color: var(--text-primary); font-family: system-ui, sans-serif; line-height: 1.6; }
    .inq-header { position: sticky; top: 0; z-index: 20; background: var(--card-bg); border-bottom: 1px solid var(--border-color); }
    .inq-header-content { padding: 0 16px 12px; }
    .inq-status-filters { display: flex; flex-wrap: wrap; gap: 8px; }
    .inq-filter-button { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; cursor: pointer; }
    .inq-filter-button[aria-pressed="true"] { border-color: var(--accent-color); outline: 2px solid var(--accent-color); outline-offset: 1px; }
    .inq-filter-button:focus-visible { outline: 2px solid var(--text-primary); outline-offset: 3px; }
    .inq-filter-button:disabled { cursor: wait; opacity: 0.6; }
    .inq-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .inq-nav { position: sticky; top: 0; z-index: 10; box-sizing: border-box; height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 16px; background: var(--card-bg); border-bottom: 1px solid var(--border-color); }
    .inq-nav a { color: var(--text-primary); }
    .inq-nav-end { margin-left: auto; display: flex; align-items: center; }
    .inq-main { padding: 16px; }
    h1 { font-size: 22px; margin: 8px 0; }
    h3 { font-size: 14px; margin: 16px 0 6px; }
    .inq-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 8px 0 12px; }
    .inq-toolbar label { display: flex; align-items: center; gap: 6px; min-width: 0; max-width: 100%; }
    .inq-toolbar select { flex: 1; min-width: 0; max-width: 100%; }
    .inq-cases { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 10px; margin-bottom: 16px; }
    .inq-case, .inq-panel { display: block; width: 100%; text-align: left; font: inherit; color: var(--text-primary); background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; cursor: pointer; }
    .inq-case:hover, .inq-panel:hover { border-color: var(--accent-color); }
    .inq-board { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(260px, 1fr); gap: 12px; overflow-x: auto; padding-bottom: 8px; align-items: start; }
    .inq-col { background: var(--bg-primary, var(--card-bg)); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .inq-col-head { display: flex; align-items: center; justify-content: space-between; font-size: 15px; margin: 0 0 4px; }
    .inq-count { font-size: 13px; color: var(--text-secondary); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 10px; padding: 0 8px; }
    .inq-panel-title { font-weight: 600; overflow-wrap: anywhere; }
    .inq-panel-summary { font-size: 13px; color: var(--text-secondary); margin-top: 4px; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .inq-panel-case { margin-top: 4px; }
    .inq-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .inq-stats { font-size: 13px; color: var(--text-secondary); gap: 10px; margin-top: 4px; }
    .inq-meta { font-size: 12px; color: var(--text-secondary); margin: 2px 0; overflow-wrap: anywhere; }
    /* 状態の意味が固定の色(CLAUDE.CSS.mdの例外)。両テーマで白文字が読める濃さにする。 */
    .inq-badge { display: inline-block; padding: 0 8px; border-radius: 10px; font-size: 12px; color: #fff; }
    .inq-badge-ok { background: #1a7f37; }
    .inq-badge-warn { background: #9a6700; }
    .inq-badge-ng { background: #cf222e; }
    .inq-badge-muted { background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color); }
    span.inq-blocking:not(.inq-badge) { color: var(--danger-color); font-weight: 600; }
    #inq-notice { color: var(--text-primary); background: var(--card-bg); border-left: 4px solid var(--danger-color); padding: 8px 12px; margin: 0 0 12px; }
    button, select { min-height: 32px; font: inherit; color: var(--text-primary); background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; }
    .inq-modal { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .inq-modal[hidden] { display: none; }
    .inq-modal-box { background: var(--card-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 10px; width: min(900px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column; }
    .inq-modal-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--border-color); }
    .inq-modal-head h2 { font-size: 16px; margin: 0; flex: 1; overflow-wrap: anywhere; }
    .inq-modal-body { padding: 12px 14px; overflow: auto; }
    .inq-field { margin: 8px 0; }
    .inq-field-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
    .inq-pre { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; font-size: 13px; }
    .inq-details { border: 1px solid var(--border-color); border-radius: 6px; padding: 6px 10px; margin: 6px 0; }
    .inq-details summary { cursor: pointer; font-weight: 600; }
    .inq-list { padding-left: 18px; margin: 4px 0; }
    .inq-list li { margin: 4px 0; overflow-wrap: anywhere; }
    .inq-error { color: var(--danger-color); }
    .inq-link-btn { margin-top: 8px; padding: 0 12px; cursor: pointer; }
  </style>
</head>
<body>
  <header id="inq-header" class="inq-header">
  <nav class="inq-nav"><a href="/muse-status">← Museの状態</a><span class="inq-nav-end">${getThemeToggleHTML()}</span></nav>
  <div class="inq-header-content">
    <h1>Museとの協議</h1>
    <div class="inq-status-filters" role="group" aria-label="カードの状態で絞り込む">
      <button type="button" class="inq-filter-button" data-status-filter="all" aria-pressed="true" aria-controls="inq-board" disabled><span class="inq-badge inq-badge-muted" data-filter-label>すべて</span><span class="inq-count" data-filter-count>—</span></button>
      <button type="button" class="inq-filter-button" data-status-filter="discussing" aria-pressed="false" aria-controls="inq-board" disabled><span class="inq-badge inq-badge-warn" data-filter-label>協議中</span><span class="inq-count" data-filter-count>—</span></button>
      <button type="button" class="inq-filter-button" data-status-filter="pending" aria-pressed="false" aria-controls="inq-board" disabled><span class="inq-badge inq-badge-warn" data-filter-label>採否待ち</span><span class="inq-count" data-filter-count>—</span></button>
      <button type="button" class="inq-filter-button" data-status-filter="done" aria-pressed="false" aria-controls="inq-board" disabled><span class="inq-badge inq-badge-ok" data-filter-label>完了</span><span class="inq-count" data-filter-count>—</span></button>
    </div>
    <span id="inq-filter-result" class="inq-sr-only" role="status" aria-live="polite"></span>
  </div>
  </header>
  <main class="inq-main">
    <p id="inq-notice" role="status" hidden></p>
    <div id="inq-cases" class="inq-cases" aria-label="ケース"></div>
    <div class="inq-toolbar">
      <label>ケース <select id="inq-case-filter" aria-label="ケースで絞り込む"><option value="">すべてのケース</option></select></label>
      <button type="button" id="inq-refresh">再読み込み</button>
      <span class="inq-meta">パネルを押すと詳細を開きます。記録はD1 agent-inquiriesで、Claude Codeが問い合わせのたびに書きます。</span>
    </div>
    <div id="inq-board" class="inq-board"></div>
  </main>
  <div id="inq-modal" class="inq-modal" role="dialog" aria-modal="true" aria-labelledby="inq-modal-title" hidden>
    <div class="inq-modal-box">
      <div class="inq-modal-head"><h2 id="inq-modal-title"></h2><button type="button" id="inq-modal-close" aria-label="閉じる">✕</button></div>
      <div id="inq-modal-body" class="inq-modal-body"></div>
    </div>
  </div>
  <script>${getThemeToggleScript()}</script>
  <script>${MUSE_INQUIRIES_SCRIPT}
    initMuseInquiriesPage({
      document: document,
      fetchJson: function(url) {
        return fetch(url, { credentials: 'same-origin' }).then(function(response) {
          return response.json().catch(function() { return {}; }).then(function(data) {
            if (!response.ok) throw new Error((data && data.error) || ('HTTP ' + response.status));
            return data;
          });
        });
      }
    });
  </script>
</body>
</html>`;
}
