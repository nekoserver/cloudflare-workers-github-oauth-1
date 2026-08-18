import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getFileDepsPage(username: string): string {
  const safeUsername = escapeHtml(username);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ファイル間依存グラフ - Cloudflare Workers GitHub OAuth</title>
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
    .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .toolbar select, .toolbar input {
      font-size: 13px;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
    .legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .canvas-wrap { width: 100%; overflow: auto; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); }
    .status-msg { font-size: 13px; color: var(--text-muted); margin-top: 8px; }
    #depsTooltip {
      position: fixed;
      display: none;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 12px;
      color: var(--text-primary);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      max-width: 340px;
      z-index: 200;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🕸️</span>
      <span>ファイル間依存グラフ</span>
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
    <div class="title">ファイル間依存グラフ</div>
    <div class="subtitle">src/配下のTypeScriptファイル間の相対import依存関係(ast-grep(WASM)で抽出、ビルド時にD1へ保存したデータを表示)</div>
    <div class="toolbar">
      <label style="font-size:13px;color:var(--text-secondary);">ディレクトリで絞り込み:</label>
      <select id="dirFilter"><option value="">すべて</option></select>
      <label style="font-size:13px;color:var(--text-secondary);">ファイル名検索:</label>
      <input type="text" id="searchInput" placeholder="例: aichat">
    </div>
    <div class="legend" id="legend"></div>
    <div class="canvas-wrap">
      <canvas id="depsCanvas" width="1040" height="700"></canvas>
    </div>
    <div class="status-msg" id="statusMsg">読み込み中…</div>
  </div>
  <div id="depsTooltip"></div>

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

    var canvas = document.getElementById('depsCanvas');
    var ctx = canvas.getContext('2d');
    var statusMsg = document.getElementById('statusMsg');
    var dirFilter = document.getElementById('dirFilter');
    var searchInput = document.getElementById('searchInput');
    var tooltip = document.getElementById('depsTooltip');
    var legendEl = document.getElementById('legend');

    var GROUP_COLORS = {
      views: '#3b82f6',
      utils: '#22c55e',
      data: '#f97316',
      routes: '#a855f7',
      middleware: '#ef4444',
      root: '#64748b',
      other: '#8b949e',
    };

    function groupOf(filePath) {
      var parts = filePath.split('/');
      // parts[0] = 'src'
      if (parts.length <= 2) return 'root';
      var g = parts[1];
      return GROUP_COLORS[g] ? g : 'other';
    }

    var allNodes = [];
    var allEdges = [];
    var posById = {};
    var selectedId = null;

    function buildGraph(nodeIds, edges) {
      posById = {};
      var w = canvas.width, h = canvas.height;
      var cx = w / 2, cy = h / 2;
      nodeIds.forEach(function(id, i) {
        var angle = (i / nodeIds.length) * Math.PI * 2;
        var r = Math.min(w, h) * 0.35;
        posById[id] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, vx: 0, vy: 0 };
      });

      // 簡易力学レイアウト(反発力+ばね引力)。ノード数が少ないので同期実行で十分。
      var ITER = 220;
      var REPULSION = 2600;
      var SPRING_LEN = 90;
      var SPRING_K = 0.02;
      var DAMPING = 0.85;
      for (var it = 0; it < ITER; it++) {
        for (var i = 0; i < nodeIds.length; i++) {
          var a = posById[nodeIds[i]];
          var fx = 0, fy = 0;
          for (var j = 0; j < nodeIds.length; j++) {
            if (i === j) continue;
            var b = posById[nodeIds[j]];
            var dx = a.x - b.x, dy = a.y - b.y;
            var distSq = Math.max(dx * dx + dy * dy, 1);
            var force = REPULSION / distSq;
            var dist = Math.sqrt(distSq);
            fx += (dx / dist) * force;
            fy += (dy / dist) * force;
          }
          a.vx = (a.vx + fx) * DAMPING;
          a.vy = (a.vy + fy) * DAMPING;
        }
        edges.forEach(function(e) {
          var a = posById[e.source], b = posById[e.target];
          if (!a || !b) return;
          var dx = b.x - a.x, dy = b.y - a.y;
          var dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          var force = (dist - SPRING_LEN) * SPRING_K;
          var fx = (dx / dist) * force, fy = (dy / dist) * force;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        });
        nodeIds.forEach(function(id) {
          var p = posById[id];
          p.x += p.vx; p.y += p.vy;
          p.x = Math.max(30, Math.min(w - 30, p.x));
          p.y = Math.max(30, Math.min(h - 30, p.y));
        });
      }
    }

    function draw(nodeIds, edges) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var bg = getComputedStyle(document.body).getPropertyValue('--text-muted') || '#8b949e';

      edges.forEach(function(e) {
        var a = posById[e.source], b = posById[e.target];
        if (!a || !b) return;
        var isHighlighted = selectedId && (e.source === selectedId || e.target === selectedId);
        ctx.strokeStyle = isHighlighted ? '#0969da' : (bg.trim() + '55');
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });

      nodeIds.forEach(function(id) {
        var p = posById[id];
        if (!p) return;
        var isSelected = id === selectedId;
        var color = GROUP_COLORS[groupOf(id)] || GROUP_COLORS.other;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isSelected ? 8 : 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (isSelected) {
          ctx.strokeStyle = '#0969da';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    }

    function currentFilteredNodeIds() {
      var dir = dirFilter.value;
      var q = searchInput.value.trim().toLowerCase();
      return allNodes.filter(function(id) {
        if (dir && groupOf(id) !== dir) return false;
        if (q && id.toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
    }

    function currentFilteredEdges(nodeIdSet) {
      return allEdges.filter(function(e) { return nodeIdSet.has(e.source) && nodeIdSet.has(e.target); });
    }

    function renderGraph() {
      var nodeIds = currentFilteredNodeIds();
      var nodeIdSet = new Set(nodeIds);
      var edges = currentFilteredEdges(nodeIdSet);
      buildGraph(nodeIds, edges);
      draw(nodeIds, edges);
      statusMsg.textContent = 'ノード: ' + nodeIds.length + '件 / エッジ: ' + edges.length + '件';
    }

    function nodeAtPoint(x, y) {
      var nodeIds = currentFilteredNodeIds();
      for (var i = 0; i < nodeIds.length; i++) {
        var p = posById[nodeIds[i]];
        if (!p) continue;
        var dx = p.x - x, dy = p.y - y;
        if (dx * dx + dy * dy <= 100) return nodeIds[i];
      }
      return null;
    }

    canvas.addEventListener('mousemove', function(e) {
      var rect = canvas.getBoundingClientRect();
      var x = (e.clientX - rect.left) * (canvas.width / rect.width);
      var y = (e.clientY - rect.top) * (canvas.height / rect.height);
      var id = nodeAtPoint(x, y);
      if (id) {
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top = (e.clientY + 12) + 'px';
        tooltip.textContent = id;
        canvas.style.cursor = 'pointer';
      } else {
        tooltip.style.display = 'none';
        canvas.style.cursor = 'default';
      }
    });

    canvas.addEventListener('click', function(e) {
      var rect = canvas.getBoundingClientRect();
      var x = (e.clientX - rect.left) * (canvas.width / rect.width);
      var y = (e.clientY - rect.top) * (canvas.height / rect.height);
      var id = nodeAtPoint(x, y);
      selectedId = (id && id === selectedId) ? null : id;
      draw(currentFilteredNodeIds(), currentFilteredEdges(new Set(currentFilteredNodeIds())));
    });

    dirFilter.addEventListener('change', function() { selectedId = null; renderGraph(); });
    searchInput.addEventListener('input', function() { selectedId = null; renderGraph(); });

    function renderLegend() {
      var html = '';
      Object.keys(GROUP_COLORS).forEach(function(g) {
        html += '<span class="legend-item"><span class="legend-dot" style="background:' + GROUP_COLORS[g] + ';"></span>' + escHtml(g) + '</span>';
      });
      legendEl.innerHTML = html;
    }

    function loadGraph() {
      fetch('/api/file-deps', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          allNodes = data.nodes || [];
          allEdges = data.edges || [];
          if (allNodes.length === 0) {
            statusMsg.textContent = 'データがありません。scripts/index-file-deps.mjs を実行してD1に登録してください。';
            return;
          }
          var dirs = Array.from(new Set(allNodes.map(groupOf))).sort();
          dirs.forEach(function(d) {
            var opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            dirFilter.appendChild(opt);
          });
          renderGraph();
        })
        .catch(function(err) {
          statusMsg.textContent = '読み込みに失敗しました: ' + (err && err.message ? err.message : String(err));
        });
    }

    renderLegend();
    loadGraph();
  </script>
</body>
</html>`;
}
