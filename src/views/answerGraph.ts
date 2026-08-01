function escAG(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getAnswerGraphPage(username: string): string {
  const safeUser = escAG(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>回答伝播グラフ</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--bg,#0d1117); color:var(--fg,#e6edf3); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:14px; min-height:100vh; display:flex; flex-direction:column; }
@media (prefers-color-scheme:light) { :root { --bg:#f6f8fa; --fg:#24292f; --card:#fff; --border:#d0d7de; --label:#57606a; --btn-bg:#f3f4f6; --btn-border:#d0d7de; --btn-hover:#e9ecef; --accent:#0969da; --accent-fg:#fff; --answer-color:#0969da; --keyword-color:#c2410c; --danger:#cf222e; } }
@media (prefers-color-scheme:dark) { :root { --bg:#0d1117; --fg:#e6edf3; --card:#161b22; --border:#30363d; --label:#8b949e; --btn-bg:#21262d; --btn-border:#30363d; --btn-hover:#30363d; --accent:#1f6feb; --accent-fg:#fff; --answer-color:#63b3ed; --keyword-color:#f6ad55; --danger:#f85149; } }
.topbar { background:var(--card); border-bottom:1px solid var(--border); padding:10px 20px; display:flex; align-items:center; gap:12px; flex-shrink:0; }
.topbar h1 { font-size:16px; font-weight:700; flex:1; }
.topbar a { color:var(--accent); text-decoration:none; font-size:12px; }
.topbar a:hover { text-decoration:underline; }
.user-badge { font-size:11px; background:rgba(31,111,235,.15); color:var(--accent); border-radius:12px; padding:2px 10px; }
main { flex:1; max-width:1100px; width:100%; margin:0 auto; padding:24px 16px; display:flex; flex-direction:column; gap:16px; }
.card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:18px 20px; }
.card-title { font-size:13px; font-weight:600; color:var(--label); margin-bottom:14px; text-transform:uppercase; letter-spacing:.04em; }
.search-row { display:flex; gap:8px; margin-bottom:10px; }
input[type=search] { flex:1; background:var(--btn-bg); border:1px solid var(--btn-border); border-radius:6px; color:var(--fg); font-size:13px; padding:8px 12px; outline:none; }
input[type=search]:focus { border-color:var(--accent); }
.search-results { display:flex; flex-direction:column; gap:4px; max-height:220px; overflow-y:auto; }
.search-result-item { padding:8px 10px; border:1px solid var(--border); border-radius:6px; cursor:pointer; font-size:12px; background:var(--btn-bg); }
.search-result-item:hover { border-color:var(--accent); }
.search-result-item.selected { border-color:var(--accent); background:rgba(31,111,235,.1); }
.search-status { font-size:11px; color:var(--label); }
.graph-layout { display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; }
.canvas-wrap { flex:1; min-width:320px; overflow:auto; border:1px solid var(--border); border-radius:8px; background:var(--btn-bg); }
#graphCanvas { display:block; cursor:pointer; }
.side-panel { width:260px; flex-shrink:0; border:1px solid var(--border); border-radius:8px; padding:12px 14px; font-size:12px; min-height:120px; }
.side-panel .empty-hint { color:var(--label); }
.legend { display:flex; width:100%; gap:14px; font-size:11px; color:var(--label); margin-bottom:14px; flex-wrap:wrap; }
.legend-dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:4px; vertical-align:middle; }
.node-type-label { font-size:11px; padding:2px 8px; border-radius:10px; display:inline-block; margin-bottom:6px; font-weight:600; }
.node-type-answer { background:rgba(9,105,218,.15); color:var(--answer-color); }
.node-type-keyword { background:rgba(194,65,12,.15); color:var(--keyword-color); }
.graph-status { font-size:12px; color:var(--label); margin-bottom:8px; }
.graph-status.err { color:var(--danger); }
</style>
</head>
<body>
<div class="topbar">
  <h1>🕸️ 回答伝播グラフ</h1>
  <a href="/aichat">AIチャット</a>
  <a href="/welcome">ホーム</a>
  <span class="user-badge">${safeUser}</span>
</div>
<main>
  <div class="card">
    <div class="card-title">起点にする回答を検索</div>
    <div class="search-row">
      <input type="search" id="seedSearchInput" placeholder="質問・回答のキーワードで検索..." autocomplete="off">
    </div>
    <div class="search-status" id="seedSearchStatus"></div>
    <div class="search-results" id="seedSearchResults"></div>
  </div>

  <div class="card">
    <div class="card-title">どんな質問と回答が広がっていくか</div>
    <div class="legend">
      <span><span class="legend-dot" style="background:var(--answer-color);"></span>回答（質問）</span>
      <span><span class="legend-dot" style="background:var(--keyword-color);"></span>キーワード</span>
      <span>中心 = 起点として選んだ回答。外側の輪ほど深い階層。</span>
    </div>
    <div class="graph-status" id="graphStatus">起点を選ぶとここにグラフが表示されます</div>
    <div class="graph-layout">
      <div class="canvas-wrap">
        <canvas id="graphCanvas" width="800" height="600"></canvas>
      </div>
      <div class="side-panel" id="sidePanel"><span class="empty-hint">ノードをクリックすると詳細がここに表示されます</span></div>
    </div>
  </div>
</main>
<script>
(function() {
  var seedSearchInput = document.getElementById('seedSearchInput');
  var seedSearchStatus = document.getElementById('seedSearchStatus');
  var seedSearchResults = document.getElementById('seedSearchResults');
  var graphStatus = document.getElementById('graphStatus');
  var canvas = document.getElementById('graphCanvas');
  var ctx = canvas.getContext('2d');
  var sidePanel = document.getElementById('sidePanel');

  var searchTimer = null;
  var selectedShareId = null;
  var nodePositions = [];
  var currentGraph = null;

  function escHtml(s) {
    return String(s == null ? '' : s)
      .split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;')
      .split('"').join('&quot;').split("'").join('&#39;');
  }

  function doSeedSearch(q) {
    seedSearchStatus.textContent = '検索中...';
    fetch('/api/aichat/shares/search?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var results = (d && d.results) || [];
        seedSearchStatus.textContent = results.length + ' 件ヒット';
        seedSearchResults.innerHTML = '';
        results.forEach(function(r) {
          var item = document.createElement('div');
          item.className = 'search-result-item' + (r.id === selectedShareId ? ' selected' : '');
          item.textContent = r.question;
          item.title = r.question;
          item.addEventListener('click', function() {
            selectedShareId = r.id;
            seedSearchResults.querySelectorAll('.search-result-item').forEach(function(el) { el.classList.remove('selected'); });
            item.classList.add('selected');
            loadGraph(r.id);
          });
          seedSearchResults.appendChild(item);
        });
      })
      .catch(function() { seedSearchStatus.textContent = '検索エラー'; });
  }

  seedSearchInput.addEventListener('input', function() {
    var q = seedSearchInput.value.trim();
    clearTimeout(searchTimer);
    if (!q) { seedSearchStatus.textContent = ''; seedSearchResults.innerHTML = ''; return; }
    searchTimer = setTimeout(function() { doSeedSearch(q); }, 350);
  });

  function loadGraph(shareId) {
    graphStatus.textContent = '読み込み中...';
    graphStatus.className = 'graph-status';
    sidePanel.innerHTML = '<span class="empty-hint">ノードをクリックすると詳細がここに表示されます</span>';
    fetch('/api/aichat/answer-propagation-graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ shareId: shareId }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d || d.error) {
          graphStatus.textContent = 'グラフの取得に失敗しました: ' + ((d && d.error) || '不明なエラー');
          graphStatus.className = 'graph-status err';
          currentGraph = null;
          drawGraph();
          return;
        }
        currentGraph = d;
        graphStatus.textContent = 'ノード ' + d.nodes.length + ' 件 / エッジ ' + d.edges.length + ' 件';
        drawGraph();
      })
      .catch(function() {
        graphStatus.textContent = 'グラフの取得に失敗しました（通信エラー）';
        graphStatus.className = 'graph-status err';
      });
  }

  function drawGraph() {
    nodePositions = [];
    if (!currentGraph || currentGraph.nodes.length === 0) {
      canvas.width = 800; canvas.height = 400;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    var nodes = currentGraph.nodes;
    var edges = currentGraph.edges;
    var maxDepth = 0;
    nodes.forEach(function(n) { if (n.depth > maxDepth) maxDepth = n.depth; });
    var ringSpacing = 80;
    var size = Math.max(500, (maxDepth + 1) * ringSpacing * 2 + 80);
    canvas.width = size;
    canvas.height = size;
    var cx = size / 2, cy = size / 2;

    var byDepth = {};
    nodes.forEach(function(n) {
      if (!byDepth[n.depth]) byDepth[n.depth] = [];
      byDepth[n.depth].push(n);
    });

    var posById = {};
    Object.keys(byDepth).forEach(function(depthKey) {
      var depth = parseInt(depthKey, 10);
      var group = byDepth[depthKey];
      var radius = depth * ringSpacing;
      group.forEach(function(n, i) {
        var angle = (i / group.length) * Math.PI * 2 - Math.PI / 2;
        var x = depth === 0 ? cx : cx + radius * Math.cos(angle);
        var y = depth === 0 ? cy : cy + radius * Math.sin(angle);
        posById[n.id] = { x: x, y: y, node: n };
      });
    });

    ctx.clearRect(0, 0, size, size);

    var lineColor = getComputedLineColor();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    edges.forEach(function(e) {
      var from = posById[e.from], to = posById[e.to];
      if (!from || !to) return;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });

    var answerColor = getCssVar('--answer-color') || '#0969da';
    var keywordColor = getCssVar('--keyword-color') || '#c2410c';
    Object.keys(posById).forEach(function(id) {
      var p = posById[id];
      var isAnswer = p.node.type === 'answer';
      var r = isAnswer ? (p.node.depth === 0 ? 10 : 7) : 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isAnswer ? answerColor : keywordColor;
      ctx.fill();
      nodePositions.push({ x: p.x, y: p.y, r: r + 4, node: p.node });
    });
  }

  function getCssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function getComputedLineColor() {
    var c = getCssVar('--border');
    return c || '#888';
  }

  canvas.addEventListener('click', function(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var x = (e.clientX - rect.left) * scaleX;
    var y = (e.clientY - rect.top) * scaleY;
    var hit = null;
    for (var i = 0; i < nodePositions.length; i++) {
      var p = nodePositions[i];
      var dx = p.x - x, dy = p.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= p.r) { hit = p.node; break; }
    }
    if (!hit) return;
    var typeLabelClass = hit.type === 'answer' ? 'node-type-answer' : 'node-type-keyword';
    var typeLabelText = hit.type === 'answer' ? '回答（質問）' : 'キーワード';
    sidePanel.innerHTML = '<span class="node-type-label ' + typeLabelClass + '">' + typeLabelText + '</span>'
      + '<div style="margin-bottom:6px;color:var(--label);">深さ: ' + hit.depth + '</div>'
      + '<div style="word-break:break-word;">' + escHtml(hit.label) + '</div>';
  });

  drawGraph();
})();
</script>
</body>
</html>`;
}
