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
.graph-layout { display:flex; flex-direction:column; gap:12px; }
.canvas-wrap { width:100%; overflow:auto; border:1px solid var(--border); border-radius:8px; background:var(--btn-bg); }
#graphCanvas { display:block; cursor:pointer; }
.side-panel { width:100%; border:1px solid var(--border); border-radius:8px; padding:12px 14px; font-size:12px; min-height:60px; }
.side-panel .empty-hint { color:var(--label); }
.legend { display:flex; width:100%; gap:14px; font-size:11px; color:var(--label); margin-bottom:14px; flex-wrap:wrap; }
.legend-dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:4px; vertical-align:middle; }
.node-type-label { font-size:11px; padding:2px 8px; border-radius:10px; display:inline-block; margin-bottom:6px; font-weight:600; }
.node-type-answer { background:rgba(9,105,218,.15); color:var(--answer-color); }
.node-type-keyword { background:rgba(194,65,12,.15); color:var(--keyword-color); }
.graph-status { font-size:12px; color:var(--label); margin-bottom:8px; }
.graph-status.err { color:var(--danger); }
.node-tooltip { position:absolute; z-index:500; max-width:260px; background:var(--card); border:1px solid var(--border); border-radius:8px; padding:10px 12px; font-size:12px; box-shadow:0 6px 20px rgba(0,0,0,.25); }
.node-tooltip .node-type-label { margin-bottom:4px; }
.question-line { cursor:pointer; text-decoration:none; }
.question-line:hover { color:var(--accent); }
.answer-modal-backdrop { display:none; position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:1000; align-items:flex-start; justify-content:center; padding-top:60px; }
.answer-modal-backdrop.open { display:flex; }
.answer-modal { background:var(--card); border:1px solid var(--border); border-radius:12px; width:min(640px,94vw); max-height:80vh; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,.3); }
.answer-modal-head { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid var(--border); flex-shrink:0; }
.answer-modal-head strong { font-size:13px; }
.answer-modal-head button { background:none; border:none; cursor:pointer; font-size:16px; color:var(--label); padding:0 4px; }
.answer-modal-body { padding:16px 18px; overflow-y:auto; flex:1; font-size:13px; line-height:1.7; white-space:pre-wrap; word-break:break-word; }
.answer-modal-body .q-block { color:var(--accent); font-weight:600; margin-bottom:10px; }
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
    <div class="legend" id="categoryLegend"></div>
    <div class="graph-status" id="graphStatus">起点を選ぶとここにグラフが表示されます</div>
    <div class="graph-layout">
      <div class="side-panel" id="sidePanel"><span class="empty-hint">ノードをクリックすると詳細がここに表示されます</span></div>
      <div class="canvas-wrap">
        <canvas id="graphCanvas" width="800" height="600"></canvas>
      </div>
    </div>
  </div>
</main>
<div class="node-tooltip" id="nodeTooltip" style="display:none;"></div>
<div class="answer-modal-backdrop" id="answerModalBackdrop">
  <div class="answer-modal">
    <div class="answer-modal-head">
      <strong>回答</strong>
      <button type="button" id="answerModalClose">✕</button>
    </div>
    <div class="answer-modal-body" id="answerModalBody"></div>
  </div>
</div>
<script>
(function() {
  var seedSearchInput = document.getElementById('seedSearchInput');
  var seedSearchStatus = document.getElementById('seedSearchStatus');
  var seedSearchResults = document.getElementById('seedSearchResults');
  var graphStatus = document.getElementById('graphStatus');
  var canvas = document.getElementById('graphCanvas');
  var ctx = canvas.getContext('2d');
  var sidePanel = document.getElementById('sidePanel');
  var categoryLegend = document.getElementById('categoryLegend');
  var nodeTooltip = document.getElementById('nodeTooltip');
  var answerModalBackdrop = document.getElementById('answerModalBackdrop');
  var answerModalBody = document.getElementById('answerModalBody');
  var answerModalClose = document.getElementById('answerModalClose');

  var searchTimer = null;
  var selectedShareId = null;
  var nodePositions = [];
  var currentGraph = null;

  function escHtml(s) {
    return String(s == null ? '' : s)
      .split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;')
      .split('"').join('&quot;').split("'").join('&#39;');
  }

  function mdEsc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function mdInline(text) {
    var latexMap = {
      rightarrow:'→',to:'→',longrightarrow:'⟶',leftarrow:'←',longleftarrow:'⟵',
      Rightarrow:'⇒',Leftarrow:'⇐',leftrightarrow:'↔',Leftrightarrow:'⟺',
      uparrow:'↑',downarrow:'↓',nearrow:'↗',searrow:'↘',
      times:'×',div:'÷',pm:'±',mp:'∓',cdot:'·',
      geq:'≥',leq:'≤',neq:'≠',approx:'≈',equiv:'≡',
      infty:'∞',ldots:'…',cdots:'⋯',
      sum:'∑',prod:'∏',int:'∫',partial:'∂',nabla:'∇',sqrt:'√',
      in:'∈',notin:'∉',subset:'⊂',supset:'⊃',cup:'∪',cap:'∩',emptyset:'∅',
      forall:'∀',exists:'∃',
      alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',zeta:'ζ',
      eta:'η',theta:'θ',iota:'ι',kappa:'κ',lambda:'λ',mu:'μ',
      nu:'ν',xi:'ξ',pi:'π',rho:'ρ',sigma:'σ',tau:'τ',
      upsilon:'υ',phi:'φ',chi:'χ',psi:'ψ',omega:'ω',
      Alpha:'Α',Beta:'Β',Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',
      Pi:'Π',Sigma:'Σ',Phi:'Φ',Omega:'Ω',
    };
    text = text.replace(/\$\\\\([a-zA-Z]+)\$/g, function(_, cmd) {
      return latexMap[cmd] !== undefined ? latexMap[cmd] : ('$\\\\' + cmd + '$');
    });
    text = text.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, '<img src="$2" alt="$1">');
    text = text.replace(/\\[([^\\]]*)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    text = text.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    text = text.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
    text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
    text = text.replace(/\\n/g, '<br>');
    return text;
  }
  function mdSplitRow(line) {
    return line.replace(/^\\|\\s*/, '').replace(/\\s*\\|$/, '').split(/\\s*\\|\\s*/);
  }
  function mdParseList(lines, start, tag) {
    var items = [];
    var i = start;
    var pat = tag === 'ul' ? /^\\s*[-*+]\\s(.*)/ : /^\\s*\\d+\\.\\s(.*)/;
    while (i < lines.length) {
      var m = lines[i].match(pat);
      if (!m) break;
      var txt = m[1];
      var task = txt.match(/^\\[([ xX])\\]\\s(.*)/);
      if (task) {
        items.push('<li><input type="checkbox"' + (task[1] !== ' ' ? ' checked' : '') + ' disabled> ' + mdInline(task[2]) + '</li>');
      } else {
        items.push('<li>' + mdInline(txt) + '</li>');
      }
      i++;
    }
    return '<' + tag + '>' + items.join('') + '</' + tag + '>';
  }
  function parseMd(src) {
    src = src.replace(/\\r\\n?/g, '\\n');
    var codeBlocks = [];
    src = src.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, function(_, lang, code) {
      var idx = codeBlocks.length;
      codeBlocks.push('<pre><code' + (lang ? ' class="language-' + lang + '"' : '') + '>' + mdEsc(code.replace(/\\n$/, '')) + '</code></pre>');
      return '\\x00CB' + idx + '\\x00';
    });
    var inlineCodes = [];
    src = src.replace(/\`([^\`]+)\`/g, function(_, code) {
      var idx = inlineCodes.length;
      inlineCodes.push('<code>' + mdEsc(code) + '</code>');
      return '\\x00IC' + idx + '\\x00';
    });
    var lines = src.split('\\n');
    var html = '';
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (line.trim() === '') { i++; continue; }
      var cbM = line.match(/^\\x00CB(\\d+)\\x00$/);
      if (cbM) { html += codeBlocks[parseInt(cbM[1])]; i++; continue; }
      var hM = line.match(/^(#{1,6})\\s+(.+)$/);
      if (hM) { var lv = hM[1].length; html += '<h' + lv + '>' + mdInline(hM[2]) + '</h' + lv + '>'; i++; continue; }
      if (/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(line)) { html += '<hr>'; i++; continue; }
      if (i + 1 < lines.length && /^\\|/.test(line) && /^[\\|\\s:-]+$/.test(lines[i + 1])) {
        var tbl = '<table><thead><tr>';
        mdSplitRow(line).forEach(function(h) { tbl += '<th>' + mdInline(h.trim()) + '</th>'; });
        tbl += '</tr></thead><tbody>';
        i += 2;
        while (i < lines.length && /^\\|/.test(lines[i])) {
          tbl += '<tr>';
          mdSplitRow(lines[i]).forEach(function(c) { tbl += '<td>' + mdInline(c.trim()) + '</td>'; });
          tbl += '</tr>'; i++;
        }
        tbl += '</tbody></table>'; html += tbl; continue;
      }
      if (/^>\\s?/.test(line)) {
        var bq = [];
        while (i < lines.length && /^>\\s?/.test(lines[i])) { bq.push(lines[i].replace(/^>\\s?/, '')); i++; }
        html += '<blockquote>' + parseMd(bq.join('\\n')) + '</blockquote>'; continue;
      }
      if (/^\\s*[-*+]\\s/.test(line)) {
        html += mdParseList(lines, i, 'ul');
        while (i < lines.length && /^\\s*[-*+]\\s/.test(lines[i])) i++;
        continue;
      }
      if (/^\\s*\\d+\\.\\s/.test(line)) {
        html += mdParseList(lines, i, 'ol');
        while (i < lines.length && /^\\s*\\d+\\.\\s/.test(lines[i])) i++;
        continue;
      }
      var pLines = [];
      while (i < lines.length && lines[i].trim() !== '' && !/^#{1,6}\\s/.test(lines[i]) && !/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(lines[i]) && !/^>\\s?/.test(lines[i]) && !/^\\|/.test(lines[i]) && !/^\\x00CB/.test(lines[i])) {
        pLines.push(lines[i]); i++;
      }
      if (pLines.length) html += '<p>' + mdInline(pLines.join('\\n')) + '</p>';
    }
    html = html.replace(/\\x00IC(\\d+)\\x00/g, function(_, idx) { return inlineCodes[parseInt(idx)]; });
    return html;
  }

  function openAnswerModal(shareId) {
    answerModalBody.textContent = '読み込み中...';
    answerModalBackdrop.classList.add('open');
    fetch('/api/aichat/shares/' + encodeURIComponent(shareId), { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d || d.error) { answerModalBody.textContent = '回答の取得に失敗しました: ' + ((d && d.error) || '不明なエラー'); return; }
        answerModalBody.innerHTML = '<div class="q-block">' + parseMd(d.question) + '</div><div>' + parseMd(d.answer) + '</div>';
      })
      .catch(function() { answerModalBody.textContent = '回答の取得に失敗しました（通信エラー）'; });
  }

  function closeAnswerModal() {
    answerModalBackdrop.classList.remove('open');
  }

  answerModalClose.addEventListener('click', closeAnswerModal);
  answerModalBackdrop.addEventListener('click', function(e) { if (e.target === answerModalBackdrop) closeAnswerModal(); });

  function hideNodeTooltip() {
    nodeTooltip.style.display = 'none';
  }

  function buildNodeLabelLine(node) {
    return node.type === 'answer'
      ? '<div class="question-line" style="word-break:break-word;" data-share-id="' + escHtml(node.id.slice(2)) + '">' + escHtml(node.label) + '</div>'
      : '<div style="word-break:break-word;">' + escHtml(node.label) + '</div>';
  }

  function showNodeTooltip(node, pageX, pageY) {
    var typeLabelClass = node.type === 'answer' ? 'node-type-answer' : 'node-type-keyword';
    var typeLabelText = node.type === 'answer' ? '回答（質問）' : 'キーワード';
    var categoryLine = node.dominantCategory
      ? '<div style="margin-bottom:4px;"><span class="legend-dot" style="background:' + escHtml(node.color || '#888888') + ';"></span>分類: ' + escHtml(node.dominantCategory) + '</div>'
      : '';
    nodeTooltip.innerHTML = '<span class="node-type-label ' + typeLabelClass + '">' + typeLabelText + '</span>'
      + '<div style="margin-bottom:4px;color:var(--label);">深さ: ' + node.depth + '</div>'
      + categoryLine
      + buildNodeLabelLine(node);
    nodeTooltip.style.display = 'block';
    var tipWidth = nodeTooltip.offsetWidth || 260;
    var left = pageX + 12;
    if (left + tipWidth > window.scrollX + document.documentElement.clientWidth) {
      left = pageX - tipWidth - 12;
    }
    nodeTooltip.style.left = Math.max(4, left) + 'px';
    nodeTooltip.style.top = (pageY + 12) + 'px';
  }

  document.addEventListener('click', function(e) {
    var q = e.target.closest('.question-line');
    if (q) { openAnswerModal(q.getAttribute('data-share-id')); return; }
    if (e.target === canvas) return;
    if (nodeTooltip.contains(e.target)) return;
    hideNodeTooltip();
  });

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
        var statusText = 'ノード ' + d.nodes.length + ' 件 / エッジ ' + d.edges.length + ' 件';
        if (d._colorWarning) {
          statusText += '　※色分け無効: ' + d._colorWarning;
          graphStatus.className = 'graph-status err';
        } else {
          graphStatus.className = 'graph-status';
        }
        graphStatus.textContent = statusText;
        drawGraph();
      })
      .catch(function() {
        graphStatus.textContent = 'グラフの取得に失敗しました（通信エラー）';
        graphStatus.className = 'graph-status err';
      });
  }

  function renderCategoryLegend() {
    if (!currentGraph) { categoryLegend.innerHTML = ''; return; }
    var seen = {};
    var items = [];
    currentGraph.nodes.forEach(function(n) {
      if (!n.dominantCategory || !n.color) return;
      var key = n.dominantCategory + '|' + n.color;
      if (seen[key]) return;
      seen[key] = true;
      items.push({ label: n.dominantCategory, color: n.color });
    });
    if (items.length === 0) { categoryLegend.innerHTML = ''; return; }
    var html = '<span>分類の色（類似度によるブレンド）:</span>';
    items.forEach(function(it) {
      html += '<span><span class="legend-dot" style="background:' + escHtml(it.color) + ';"></span>' + escHtml(it.label) + '</span>';
    });
    categoryLegend.innerHTML = html;
  }

  function drawGraph() {
    nodePositions = [];
    renderCategoryLegend();
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
      var fallbackColor = isAnswer ? answerColor : keywordColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.node.color || fallbackColor;
      ctx.fill();
      if (p.node.color) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = fallbackColor;
        ctx.stroke();
      }
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
    var categoryLine = hit.dominantCategory
      ? '<div style="margin-bottom:6px;"><span class="legend-dot" style="background:' + escHtml(hit.color || '#888888') + ';"></span>分類: ' + escHtml(hit.dominantCategory) + '</div>'
      : '';
    sidePanel.innerHTML = '<span class="node-type-label ' + typeLabelClass + '">' + typeLabelText + '</span>'
      + '<div style="margin-bottom:6px;color:var(--label);">深さ: ' + hit.depth + '</div>'
      + categoryLine
      + buildNodeLabelLine(hit);
    showNodeTooltip(hit, e.pageX, e.pageY);
  });

  drawGraph();
})();
</script>
</body>
</html>`;
}
