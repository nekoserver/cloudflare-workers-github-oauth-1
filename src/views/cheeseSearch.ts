import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getCheeseSearchPage(username: string): string {
  const safeUsername = escapeHtml(username);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>フランスチーズ検索 - Cloudflare Workers GitHub OAuth</title>
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
      display: none;
      position: absolute;
      top: 48px;
      right: 0;
      background: var(--card-bg);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      min-width: 200px;
      overflow: hidden;
      z-index: 100;
    }
    .dropdown-menu.open { display: block; }
    .dropdown-item {
      display: block;
      padding: 12px 16px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px;
    }
    .dropdown-item:hover { background: var(--bg-secondary); }
    .dropdown-item.logout { color: #e53e3e; }
    .dropdown-item.switch-account { color: var(--accent-color, #667eea); }
    .container { max-width: 1100px; margin: 0 auto; padding: 24px 20px; }
    .title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 16px; }
    .search-box {
      width: 100%;
      font-size: 15px;
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
      margin-bottom: 12px;
    }
    .facets { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .facet-group { display: flex; align-items: center; gap: 6px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px 12px; }
    .facet-options { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-start; }
    .facet-label { font-size: 12px; color: var(--text-muted); margin-right: 2px; }
    .facet-btn {
      font-size: 12px;
      padding: 5px 10px;
      border-radius: 999px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: pointer;
    }
    .facet-btn.active { background: #0969da; color: #fff; border-color: #0969da; }
    .pairing-input { font-size: 12px; padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); width: 140px; }
    .pairing-search-wrap { display: flex; align-items: center; gap: 4px; }
    .pairing-key-btn {
      font-size: 14px;
      line-height: 1;
      padding: 5px 7px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: pointer;
    }
    .pairing-key-btn:hover { background: var(--card-bg); }
    .pairing-modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.45);
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .pairing-modal-overlay.open { display: flex; }
    .pairing-modal {
      background: var(--card-bg);
      border-radius: 10px;
      max-width: 720px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      padding: 20px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.3);
    }
    .pairing-modal-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; }
    .pairing-modal-close {
      float: right;
      font-size: 13px;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: pointer;
    }
    .pairing-candidates { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-start; clear: both; }
    .pairing-candidate-btn {
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: pointer;
      max-width: 100%;
      text-align: left;
    }
    .pairing-candidate-btn:hover { background: #0969da; color: #fff; border-color: #0969da; }
    .result-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
    .result-count { font-size: 13px; color: var(--text-muted); }
    .view-toggle { display: flex; gap: 6px; }
    .view-toggle .facet-btn { padding: 5px 12px; }
    .cheese-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
    .cheese-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px 16px; }
    .cheese-name { font-size: 15px; font-weight: 700; color: var(--text-primary); }
    .cheese-reading { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
    .cheese-row { font-size: 12px; color: var(--text-secondary); margin-top: 4px; display: flex; gap: 6px; }
    .cheese-row .k { color: var(--text-muted); min-width: 64px; flex-shrink: 0; }
    .cheese-row .v { color: var(--text-secondary); }
    .cheese-row .v.empty { color: var(--text-muted); font-style: italic; }
    .cheese-table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--border-color); border-radius: 10px; }
    .cheese-table { width: 100%; border-collapse: collapse; font-size: 12px; background: var(--card-bg); }
    .cheese-table th, .cheese-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border-color); white-space: nowrap; }
    .cheese-table th { color: var(--text-muted); font-weight: 600; background: var(--bg-secondary); position: sticky; top: 0; }
    .cheese-table td { color: var(--text-secondary); }
    .cheese-table td.empty { color: var(--text-muted); font-style: italic; }
    .cheese-table tr:hover td { background: var(--bg-secondary); }
    .empty-msg { color: var(--text-muted); font-size: 13px; padding: 24px 0; text-align: center; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🧀</span>
      <span>フランスチーズ検索</span>
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

  <div class="container">
    <div class="title">フランスチーズ検索</div>
    <div class="subtitle">225種のフランスチーズをフリーワード・条件で検索できます(原材料・製法・固さ・食材ペアリングは推定値を含みます)</div>

    <input type="text" id="freeword" class="search-box" placeholder="フリーワード検索(名称・読み仮名・原材料・生産者・製法・備考・ペアリング)">

    <div class="facets">
      <div class="facet-group">
        <span class="facet-label">乳種:</span>
        <span class="facet-options" id="facetOptions-milk"></span>
      </div>
      <div class="facet-group">
        <span class="facet-label">固さ:</span>
        <span class="facet-options" id="facetOptions-hardness"></span>
      </div>
      <div class="facet-group">
        <span class="facet-label">カビ:</span>
        <span class="facet-options" id="facetOptions-mold"></span>
      </div>
      <div class="facet-group">
        <span class="facet-label">産地:</span>
        <span class="facet-options" id="facetOptions-region"></span>
      </div>
      <div class="facet-group">
        <span class="facet-label">合う食材:</span>
        <div class="pairing-search-wrap">
          <button type="button" class="pairing-key-btn" id="pairingKeyBtn" title="候補一覧をヒット件数付きで表示">🔑</button>
          <input type="text" id="pairingInput" class="pairing-input" placeholder="例: はちみつ、赤ワイン">
        </div>
      </div>
      <div class="facet-group">
        <button type="button" class="facet-btn" id="resetBtn">条件をリセット</button>
      </div>
    </div>

    <div class="result-bar">
      <div class="result-count" id="resultCount"></div>
      <div class="view-toggle">
        <button type="button" class="facet-btn active" id="viewCardBtn" data-view="card">🗂 カード表示</button>
        <button type="button" class="facet-btn" id="viewListBtn" data-view="list">📋 リスト表示</button>
      </div>
    </div>
    <div class="cheese-grid" id="cheeseGrid"></div>
    <div class="cheese-table-wrap" id="cheeseTableWrap" style="display:none;">
      <table class="cheese-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>読み仮名</th>
            <th>原材料</th>
            <th>生産者</th>
            <th>製法</th>
            <th>固さ</th>
            <th>合う食材</th>
            <th>備考</th>
          </tr>
        </thead>
        <tbody id="cheeseTableBody"></tbody>
      </table>
    </div>
    <div class="empty-msg" id="emptyMsg" style="display:none;">条件に一致するチーズが見つかりませんでした。</div>
  </div>

  <div class="pairing-modal-overlay" id="pairingModalOverlay">
    <div class="pairing-modal" id="pairingModal">
      <button type="button" class="pairing-modal-close" id="pairingModalCloseBtn">✕ 閉じる</button>
      <div class="pairing-modal-title">合う食材の候補(ヒット件数順)</div>
      <div class="pairing-candidates" id="pairingCandidates"></div>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}

    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('open');
    }
    window.toggleDropdown = toggleDropdown;
    document.addEventListener('click', function(e) {
      var menu = document.getElementById('dropdownMenu');
      var container = document.querySelector('.user-menu-container');
      if (menu.classList.contains('open') && container && !container.contains(e.target)) {
        menu.classList.remove('open');
      }
    });

    function escHtml(s) {
      return String(s).replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    var allItems = [];
    var freewordInput = document.getElementById('freeword');
    var pairingInput = document.getElementById('pairingInput');
    var grid = document.getElementById('cheeseGrid');
    var tableWrap = document.getElementById('cheeseTableWrap');
    var tableBody = document.getElementById('cheeseTableBody');
    var viewCardBtn = document.getElementById('viewCardBtn');
    var viewListBtn = document.getElementById('viewListBtn');
    var resultCount = document.getElementById('resultCount');
    var emptyMsg = document.getElementById('emptyMsg');
    var activeFacets = { milk: null, hardness: null, mold: null, region: null };
    var viewMode = 'card';

    viewCardBtn.addEventListener('click', function() {
      viewMode = 'card';
      viewCardBtn.classList.add('active');
      viewListBtn.classList.remove('active');
      render();
    });
    viewListBtn.addEventListener('click', function() {
      viewMode = 'list';
      viewListBtn.classList.add('active');
      viewCardBtn.classList.remove('active');
      render();
    });

    var FACET_DEFS = {
      milk: [
        { value: '牛乳', label: '牛乳' },
        { value: '山羊', label: '山羊' },
        { value: '羊乳', label: '羊乳' },
      ],
      hardness: [
        { value: 'ハード', label: 'ハード' },
        { value: 'セミハード', label: 'セミハード' },
        { value: 'セミソフト', label: 'セミソフト' },
        { value: 'ソフト', label: 'ソフト' },
      ],
      mold: [
        { value: '有', label: 'カビ有' },
        { value: '無', label: 'カビ無' },
      ],
      region: [
        { value: '限定', label: '産地限定' },
      ],
    };

    var FACET_MATCHERS = {
      milk: matchesMilk,
      hardness: matchesHardness,
      mold: matchesMold,
      region: matchesRegion,
    };

    document.getElementById('resetBtn').addEventListener('click', function() {
      activeFacets = { milk: null, hardness: null, mold: null, region: null };
      freewordInput.value = '';
      pairingInput.value = '';
      render();
    });

    freewordInput.addEventListener('input', render);
    pairingInput.addEventListener('input', render);

    function matchesFreeword(item, q) {
      if (!q) return true;
      var haystack = [item.name_fr, item.reading, item.ingredient, item.producer, item.method, item.notes, item.pairing]
        .filter(function(v) { return v; })
        .join(' ')
        .toLowerCase();
      return haystack.indexOf(q.toLowerCase()) !== -1;
    }

    function matchesMilk(item, value) {
      if (!value) return true;
      var ingredient = item.ingredient || '';
      if (value === '牛乳') return ingredient.indexOf('牛乳') !== -1;
      if (value === '山羊') return ingredient.indexOf('山羊乳') !== -1;
      if (value === '羊乳') return ingredient.indexOf('羊乳') !== -1 && ingredient.indexOf('山羊乳') === -1;
      return true;
    }

    function matchesHardness(item, value) {
      if (!value) return true;
      return (item.hardness || '') === value;
    }

    function matchesMold(item, value) {
      if (!value) return true;
      var method = item.method || '';
      var hasMold = method.indexOf('カビ') !== -1;
      if (value === '有') return hasMold;
      if (value === '無') return !hasMold;
      return true;
    }

    function matchesRegion(item, value) {
      if (!value) return true;
      return !!item.producer;
    }

    var PAIRING_UNKNOWN_LABEL = '不明';

    function matchesPairing(item, q) {
      if (!q) return true;
      if (q === PAIRING_UNKNOWN_LABEL) return !item.pairing;
      var pairing = (item.pairing || '').toLowerCase();
      return pairing.indexOf(q.toLowerCase()) !== -1;
    }

    function matchesAllFacetsExcept(item, excludeFacet) {
      var facetNames = ['milk', 'hardness', 'mold', 'region'];
      for (var i = 0; i < facetNames.length; i++) {
        var name = facetNames[i];
        if (name === excludeFacet) continue;
        if (!FACET_MATCHERS[name](item, activeFacets[name])) return false;
      }
      return true;
    }

    function baseFilteredExcluding(excludeFacet) {
      var q = freewordInput.value.trim();
      var pairingQ = pairingInput.value.trim();
      return allItems.filter(function(item) {
        return matchesFreeword(item, q)
          && matchesPairing(item, pairingQ)
          && matchesAllFacetsExcept(item, excludeFacet);
      });
    }

    function currentFiltered() {
      return baseFilteredExcluding(null);
    }

    function renderFacetGroup(facetName) {
      var container = document.getElementById('facetOptions-' + facetName);
      if (!container) return;
      var base = baseFilteredExcluding(facetName);
      var matcher = FACET_MATCHERS[facetName];
      var options = FACET_DEFS[facetName].map(function(opt) {
        var count = base.filter(function(item) { return matcher(item, opt.value); }).length;
        return { value: opt.value, label: opt.label, count: count };
      });
      var noneCount = base.length;
      options.sort(function(a, b) { return b.count - a.count; });

      var html = '';
      var isNoneActive = !activeFacets[facetName];
      html += '<button type="button" class="facet-btn' + (isNoneActive ? ' active' : '') + '" data-facet="' + facetName + '" data-value="">条件なし(' + noneCount + ')</button>';
      options.forEach(function(opt) {
        var isActive = activeFacets[facetName] === opt.value;
        html += '<button type="button" class="facet-btn' + (isActive ? ' active' : '') + '" data-facet="' + facetName + '" data-value="' + escHtml(opt.value) + '">' + escHtml(opt.label) + '(' + opt.count + ')</button>';
      });
      container.innerHTML = html;
    }

    function renderFacets() {
      Object.keys(FACET_DEFS).forEach(renderFacetGroup);
    }

    document.querySelector('.facets').addEventListener('click', function(e) {
      var btn = e.target.closest ? e.target.closest('.facet-btn[data-facet]') : null;
      if (!btn) return;
      var facet = btn.getAttribute('data-facet');
      var value = btn.getAttribute('data-value');
      activeFacets[facet] = value || null;
      render();
    });

    function getNextZ() {
      var maxZ = 0;
      document.querySelectorAll('*').forEach(function(el) {
        var cs = window.getComputedStyle(el);
        if (cs.position === 'fixed') {
          var z = parseInt(cs.zIndex, 10);
          if (!isNaN(z) && z > maxZ) maxZ = z;
        }
      });
      var staticZDefaults = { pairingModalOverlay: 1000 };
      Object.keys(staticZDefaults).forEach(function(id) {
        if (staticZDefaults[id] > maxZ) maxZ = staticZDefaults[id];
      });
      return maxZ + 100;
    }

    function baseForPairingCandidates() {
      var q = freewordInput.value.trim();
      return allItems.filter(function(item) {
        return matchesFreeword(item, q) && matchesAllFacetsExcept(item, null);
      });
    }

    function renderPairingCandidates() {
      var container = document.getElementById('pairingCandidates');
      var base = baseForPairingCandidates();
      var valuesSet = {};
      allItems.forEach(function(item) { valuesSet[item.pairing || PAIRING_UNKNOWN_LABEL] = true; });
      var candidates = Object.keys(valuesSet).map(function(value) {
        var count = base.filter(function(item) { return matchesPairing(item, value); }).length;
        return { value: value, count: count };
      });
      candidates.sort(function(a, b) { return b.count - a.count; });
      container.innerHTML = candidates.map(function(c) {
        return '<button type="button" class="pairing-candidate-btn" data-value="' + escHtml(c.value) + '">' + escHtml(c.value) + '(' + c.count + ')</button>';
      }).join('');
    }

    var pairingModalOverlay = document.getElementById('pairingModalOverlay');

    function openPairingModal() {
      renderPairingCandidates();
      pairingModalOverlay.style.zIndex = String(getNextZ());
      pairingModalOverlay.classList.add('open');
    }

    function closePairingModal() {
      pairingModalOverlay.classList.remove('open');
    }

    document.getElementById('pairingKeyBtn').addEventListener('click', openPairingModal);
    document.getElementById('pairingModalCloseBtn').addEventListener('click', closePairingModal);
    pairingModalOverlay.addEventListener('click', function(e) {
      if (e.target === pairingModalOverlay) closePairingModal();
    });
    document.getElementById('pairingCandidates').addEventListener('click', function(e) {
      var btn = e.target.closest ? e.target.closest('.pairing-candidate-btn') : null;
      if (!btn) return;
      pairingInput.value = btn.getAttribute('data-value');
      closePairingModal();
      render();
    });

    function fieldRow(label, value) {
      var safe = value ? escHtml(value) : '不明';
      var cls = value ? 'v' : 'v empty';
      return '<div class="cheese-row"><span class="k">' + escHtml(label) + '</span><span class="' + cls + '">' + safe + '</span></div>';
    }

    function renderCard(item) {
      var html = '<div class="cheese-card">';
      html += '<div class="cheese-name">' + escHtml(item.name_fr) + '</div>';
      html += '<div class="cheese-reading">' + escHtml(item.reading) + '</div>';
      html += fieldRow('原材料', item.ingredient);
      html += fieldRow('生産者', item.producer);
      html += fieldRow('製法', item.method);
      html += fieldRow('固さ', item.hardness);
      html += fieldRow('合う食材', item.pairing);
      html += fieldRow('備考', item.notes);
      html += '</div>';
      return html;
    }

    function tableCell(value) {
      var safe = value ? escHtml(value) : '不明';
      var cls = value ? '' : 'empty';
      return '<td class="' + cls + '">' + safe + '</td>';
    }

    function renderTableRow(item) {
      var html = '<tr>';
      html += '<td>' + escHtml(item.name_fr) + '</td>';
      html += '<td>' + escHtml(item.reading) + '</td>';
      html += tableCell(item.ingredient);
      html += tableCell(item.producer);
      html += tableCell(item.method);
      html += tableCell(item.hardness);
      html += tableCell(item.pairing);
      html += tableCell(item.notes);
      html += '</tr>';
      return html;
    }

    function render() {
      renderFacets();
      var filtered = currentFiltered();
      resultCount.textContent = filtered.length + ' 件 / 全 ' + allItems.length + ' 件';
      grid.style.display = viewMode === 'card' ? 'grid' : 'none';
      tableWrap.style.display = viewMode === 'list' ? 'block' : 'none';
      if (filtered.length === 0) {
        grid.innerHTML = '';
        tableBody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
      }
      emptyMsg.style.display = 'none';
      if (viewMode === 'card') {
        grid.innerHTML = filtered.map(renderCard).join('');
      } else {
        tableBody.innerHTML = filtered.map(renderTableRow).join('');
      }
    }

    function load() {
      fetch('/api/cheese-fr', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          allItems = data.items || [];
          render();
        })
        .catch(function(err) {
          resultCount.textContent = '読み込みに失敗しました: ' + (err && err.message ? err.message : String(err));
        });
    }

    load();
  </script>
</body>
</html>`;
}
