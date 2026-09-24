import { escapeHtml } from '../utils/html';
import type { CallGraphNode, CallGraphEdge } from '../utils/callGraphBuilder';

const GROUP_META: Record<string, { color: string; label: string }> = {
  index:      { color: '#ee9900', label: 'index.ts' },
  view:       { color: '#e3b341', label: 'View' },
  util:       { color: '#8b949e', label: 'Util' },
  middleware: { color: '#3fb950', label: 'Middleware' },
  script:     { color: '#79c0ff', label: 'Script' },
  other:      { color: '#a371f7', label: 'その他' },
  unresolved: { color: '#6e7681', label: '呼び出し元不明(ファイル単位)' },
};

export type CallGraphRepo = { id: number; full_name: string };

export function getCallGraphPage(
  username: string,
  repos: CallGraphRepo[],
  selectedRepoId: number | null,
  nodes: CallGraphNode[],
  edges: CallGraphEdge[]
): string {
  const safeUsername = escapeHtml(username);
  const nodesJson = JSON.stringify(nodes);
  const edgesJson = JSON.stringify(edges);

  const groupsPresent = [...new Set(nodes.map((n) => n.group))];
  const groupsJson = JSON.stringify(
    Object.fromEntries(groupsPresent.map((g) => [g, GROUP_META[g] ?? { color: '#8b949e', label: g }]))
  );
  const groupCounts = new Map<string, number>();
  for (const n of nodes) groupCounts.set(n.group, (groupCounts.get(n.group) ?? 0) + 1);

  const repoOptionsHtml = repos
    .map((r) => `<option value="${r.id}" ${r.id === selectedRepoId ? 'selected' : ''}>${escapeHtml(r.full_name)}</option>`)
    .join('\n');

  // リポジトリ選択済みの場合、上部バーは初期状態で折りたたんでおく(トグルボタンのみ表示)。
  const topBarCollapsedInitially = selectedRepoId !== null;

  const legendHtml = groupsPresent
    .map((g) => {
      const meta = GROUP_META[g] ?? { color: '#8b949e', label: g };
      const count = groupCounts.get(g) ?? 0;
      return `<div class="legend-item"><div class="legend-dot" style="background:${meta.color}"></div>${escapeHtml(meta.label)} ${count}</div>`;
    })
    .join('\n');

  const filterButtonsHtml = groupsPresent
    .map((g) => `<button class="filter-btn" data-group="${g}">${escapeHtml((GROUP_META[g] ?? { label: g }).label)}</button>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>関数呼び出しグラフ(D1連動) - Cloudflare Workers GitHub OAuth</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d1117; color: #e6edf3; font-family: 'Segoe UI', system-ui, sans-serif; overflow: hidden; }

  #canvas { display: block; cursor: grab; }
  #canvas.dragging { cursor: grabbing; }

  #ui {
    position: fixed; top: 12px; left: 12px; z-index: 10;
    display: flex; flex-direction: column; gap: 8px;
    max-width: 260px;
  }

  #top-bar {
    position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 10;
    display: flex; align-items: center; gap: 10px;
    background: #161b22cc; border: 1px solid #30363d; border-radius: 6px;
    padding: 8px 14px; font-size: 12px; color: #8b949e;
  }
  #top-bar select, #top-bar a {
    background: #21262d; border: 1px solid #30363d; color: #e6edf3;
    border-radius: 6px; padding: 4px 8px; font-size: 12px;
  }
  #top-bar a { text-decoration: none; }
  #top-bar a:hover { border-color: #58a6ff; color: #58a6ff; }
  #top-bar-toggle {
    background: #21262d; border: 1px solid #30363d; color: #e6edf3;
    border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer;
  }
  #top-bar-toggle:hover { border-color: #58a6ff; color: #58a6ff; }
  #top-bar-content { display: flex; align-items: center; gap: 10px; }
  #top-bar.collapsed #top-bar-content { display: none; }
  #top-bar:not(.collapsed) #top-bar-toggle { display: none; }

  #search-box {
    background: #161b22; border: 1px solid #30363d; border-radius: 6px;
    padding: 6px 10px; color: #e6edf3; font-size: 13px; width: 220px;
    outline: none;
  }
  #search-box:focus { border-color: #58a6ff; }
  #search-box::placeholder { color: #6e7681; }

  #legend {
    background: #161b22cc; border: 1px solid #30363d; border-radius: 6px;
    padding: 10px 12px; font-size: 12px; line-height: 1.8;
  }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }

  #note {
    background: #161b22cc; border: 1px solid #30363d; border-radius: 6px;
    padding: 8px 10px; font-size: 11px; color: #8b949e; line-height: 1.6;
  }
  #note-dismiss {
    margin-top: 8px; font-size: 11px; padding: 4px 10px;
  }

  #info-panel {
    position: fixed; top: 60px; right: 12px; z-index: 10;
    background: #161b22; border: 1px solid #30363d; border-radius: 8px;
    padding: 14px 16px; max-width: 320px; min-width: 220px;
    max-height: 70vh; overflow-y: auto;
    display: none; font-size: 13px;
  }
  #info-panel h3 { font-size: 14px; color: #58a6ff; margin-bottom: 8px; word-break: break-all; }
  #info-panel .info-row { color: #8b949e; margin-bottom: 4px; }
  #info-panel .info-row span { color: #e6edf3; }
  #info-panel .callers-list, #info-panel .callees-list {
    margin-top: 6px; padding-left: 12px;
    color: #e6edf3; font-size: 12px; line-height: 1.8;
  }

  #controls {
    position: fixed; bottom: 16px; right: 16px; z-index: 10;
    display: flex; gap: 6px;
  }
  button {
    background: #21262d; border: 1px solid #30363d; color: #e6edf3;
    border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px;
  }
  button:hover { background: #30363d; }

  #filter-bar {
    position: fixed; bottom: 16px; left: 12px; z-index: 10;
    display: flex; gap: 6px; flex-wrap: wrap; max-width: 600px;
  }
  .filter-btn {
    font-size: 11px; padding: 4px 10px;
    border-radius: 20px;
  }
  .filter-btn.active { border-color: #58a6ff; color: #58a6ff; }

  #tooltip {
    position: fixed; pointer-events: none; z-index: 20;
    background: #1c2128; border: 1px solid #30363d; border-radius: 6px;
    padding: 6px 10px; font-size: 12px; color: #e6edf3;
    display: none; max-width: 240px; line-height: 1.5;
  }

  #empty-state {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 10; text-align: center; color: #8b949e; font-size: 13px; display: none;
  }
</style>
</head>
<body>

<canvas id="canvas"></canvas>

<div id="top-bar" class="${topBarCollapsedInitially ? 'collapsed' : ''}">
  <button id="top-bar-toggle" type="button" aria-label="関数呼び出しグラフの設定を開閉する">⚙ 関数呼び出しグラフ</button>
  <div id="top-bar-content">
    <span>関数呼び出しグラフ(D1連動: ts_function_catalog / ts_function_callers)</span>
    <form method="get" action="/call-graph" style="display:flex; align-items:center; gap:6px;">
      <select name="repo" onchange="this.form.submit()">
        <option value="">リポジトリを選択...</option>
        ${repoOptionsHtml}
      </select>
    </form>
  </div>
</div>

<div id="ui">
  <input id="search-box" type="text" placeholder="関数名・ファイル名を検索..." autocomplete="off">
  <div id="legend">
    ${legendHtml}
    <div class="legend-item" style="opacity:0.7">色相=グループ、濃淡=ファイル単位</div>
  </div>
  <div id="note">
    ※ ts_function_catalog はトップレベルの名前付き関数のみを対象とするため、
    app.get()/app.post() へ渡す無名のルートハンドラ自体はノード化されません。
    また ts_function_callers は呼び出し元の「ファイル+行番号」のみを記録しており、
    その行が catalog 上のどの関数の範囲にも一致しない場合は
    ファイル単位の「呼び出し元不明」ノードにまとめて表示しています。
    <div><button id="note-dismiss" type="button">了解</button></div>
  </div>
</div>

<div id="info-panel">
  <h3 id="info-name"></h3>
  <div class="info-row">ファイル: <span id="info-file"></span></div>
  <div class="info-row">種別: <span id="info-type"></span></div>
  <div class="info-row" id="info-desc-row">説明: <span id="info-desc"></span></div>
  <div class="info-row" id="info-meta-row"></div>
  <div id="info-callers-wrap">
    <div class="info-row" style="margin-top:8px">呼び出し元:</div>
    <ul id="info-callers" class="callers-list"></ul>
  </div>
  <div id="info-callees-wrap">
    <div class="info-row" style="margin-top:8px">呼び出し先:</div>
    <ul id="info-callees" class="callees-list"></ul>
  </div>
</div>

<div id="tooltip"></div>

<div id="empty-state">リポジトリを選択してください(上部のプルダウン)。</div>

<div id="controls">
  <button id="btn-reset">リセット</button>
  <button id="btn-fit">全体表示</button>
  <button id="btn-toggle-labels">ラベル表示</button>
</div>

<div id="filter-bar">
  <button class="filter-btn active" data-group="all">すべて</button>
  ${filterButtonsHtml}
</div>

<script>
const GROUPS = ${groupsJson};
const raw_nodes = ${nodesJson};
const raw_edges = ${edgesJson};
const username = ${JSON.stringify(safeUsername)};

if (raw_nodes.length === 0) {
  document.getElementById('empty-state').style.display = 'block';
}

// ─────────────────────────────────────────────
// FORCE SIMULATION
// ─────────────────────────────────────────────

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let W = window.innerWidth;
let H = window.innerHeight;
canvas.width = W;
canvas.height = H;

let nodes = raw_nodes.map((n, i) => ({
  ...n,
  x: W / 2 + (Math.random() - 0.5) * 600,
  y: H / 2 + (Math.random() - 0.5) * 400,
  vx: 0, vy: 0,
  radius: n.group === 'index' ? 14 : (n.unresolved ? 8 : 10),
}));

const nodeMap = {};
nodes.forEach(n => nodeMap[n.id] = n);

let edges = raw_edges.filter(e => nodeMap[e.from] && nodeMap[e.to]);

// Build adjacency for info panel
const edgesFrom = {}, edgesTo = {};
nodes.forEach(n => { edgesFrom[n.id] = []; edgesTo[n.id] = []; });
edges.forEach(e => {
  edgesFrom[e.from].push(e);
  edgesTo[e.to].push(e);
});

// Force simulation
const REPEL = 3500;
const ATTRACT = 0.05;
const LINK_LEN = 120;
const LINK_STR = 0.08;
const DAMPING = 0.85;
const CENTER_STR = 0.003;

let simRunning = true;
let simStep = 0;

function simulate() {
  if (!simRunning || simStep > 800) { simRunning = false; return; }
  simStep++;

  const filtered_nodes = getVisibleNodes();
  const nids = new Set(filtered_nodes.map(n => n.id));

  // Repulsion
  for (let i = 0; i < filtered_nodes.length; i++) {
    for (let j = i + 1; j < filtered_nodes.length; j++) {
      const a = filtered_nodes[i], b = filtered_nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist2 = dx * dx + dy * dy + 0.01;
      const dist = Math.sqrt(dist2);
      const force = REPEL / dist2;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx; a.vy -= fy;
      b.vx += fx; b.vy += fy;
    }
  }

  // Attraction along edges
  edges.filter(e => nids.has(e.from) && nids.has(e.to)).forEach(e => {
    const a = nodeMap[e.from], b = nodeMap[e.to];
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
    const delta = dist - LINK_LEN;
    const force = delta * LINK_STR;
    a.vx += (dx / dist) * force;
    a.vy += (dy / dist) * force;
    b.vx -= (dx / dist) * force;
    b.vy -= (dy / dist) * force;
  });

  // Same-group attraction
  for (let i = 0; i < filtered_nodes.length; i++) {
    for (let j = i + 1; j < filtered_nodes.length; j++) {
      const a = filtered_nodes[i], b = filtered_nodes[j];
      if (a.group !== b.group) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const force = ATTRACT;
      a.vx += (dx / dist) * force;
      a.vy += (dy / dist) * force;
      b.vx -= (dx / dist) * force;
      b.vy -= (dy / dist) * force;
    }
  }

  // Center gravity
  const cx = W / 2 / transform.k - transform.x / transform.k;
  const cy = H / 2 / transform.k - transform.y / transform.k;
  filtered_nodes.forEach(n => {
    n.vx += (cx - n.x) * CENTER_STR;
    n.vy += (cy - n.y) * CENTER_STR;
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx;
    n.y += n.vy;
  });
}

// ─────────────────────────────────────────────
// CAMERA TRANSFORM
// ─────────────────────────────────────────────

const transform = { x: 0, y: 0, k: 1 };

function worldToScreen(x, y) {
  return { x: x * transform.k + transform.x, y: y * transform.k + transform.y };
}
function screenToWorld(x, y) {
  return { x: (x - transform.x) / transform.k, y: (y - transform.y) / transform.k };
}

// ─────────────────────────────────────────────
// FILTER STATE
// ─────────────────────────────────────────────

let activeFilter = 'all';
let searchQuery = '';
let showLabels = true;
let highlightedNode = null;

function getVisibleNodes() {
  return nodes.filter(n => {
    if (activeFilter !== 'all' && n.group !== activeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return n.label.toLowerCase().includes(q) || n.file.toLowerCase().includes(q) || (n.desc || '').toLowerCase().includes(q);
    }
    return true;
  });
}

function getVisibleEdges(visibleSet) {
  return edges.filter(e => visibleSet.has(e.from) && visibleSet.has(e.to));
}

// ─────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────

// グループ(view/util等、GROUP_META由来のベース色)だけでは1ファイルあたり
// 数百件の関数が同じ色になり粒度が粗すぎるという指摘への対応。グループの
// 色相(hue)・彩度はそのまま(凡例・フィルタボタンとの対応を崩さない)、
// ファイルパスのハッシュから明度(lightness)だけをずらし、同じグループ内でも
// ファイルごとに濃淡が変わるようにする(色相=グループ、明度=ファイルという
// 2段階の粒度)。
const fileShadeCache = {};

function hashStringToUnit(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 1000) / 1000;
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function fileShadeHsl(baseHex, filePath) {
  const cacheKey = baseHex + '|' + filePath;
  if (fileShadeCache[cacheKey]) return fileShadeCache[cacheKey];
  const [h, s, l] = hexToHsl(baseHex);
  const seed = hashStringToUnit(filePath);
  const shadedL = Math.max(24, Math.min(80, l + (seed - 0.5) * 44));
  const result = [Math.round(h), Math.round(s), Math.round(shadedL)];
  fileShadeCache[cacheKey] = result;
  return result;
}

function drawArrow(x1, y1, x2, y2, color, r1, r2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const ux = dx / len, uy = dy / len;
  const sx = x1 + ux * r1, sy = y1 + uy * r1;
  const ex = x2 - ux * (r2 + 6), ey = y2 - uy * (r2 + 6);

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();

  const angle = Math.atan2(ey - sy, ex - sx);
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - 8 * Math.cos(angle - 0.4), ey - 8 * Math.sin(angle - 0.4));
  ctx.lineTo(ex - 8 * Math.cos(angle + 0.4), ey - 8 * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function render() {
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);

  const visibleNodes = getVisibleNodes();
  const visibleSet = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = getVisibleEdges(visibleSet);

  const highlightedIds = new Set();
  if (highlightedNode) {
    highlightedIds.add(highlightedNode.id);
    edgesFrom[highlightedNode.id].forEach(e => highlightedIds.add(e.to));
    edgesTo[highlightedNode.id].forEach(e => highlightedIds.add(e.from));
  }

  visibleEdges.forEach(e => {
    const a = nodeMap[e.from], b = nodeMap[e.to];
    let color;
    const isHighlighted = highlightedNode && (highlightedIds.has(e.from) || highlightedIds.has(e.to));
    if (highlightedNode && !isHighlighted) { color = '#ffffff08'; }
    else color = '#ffffff22';

    if (isHighlighted) color = '#ffffff88';

    drawArrow(a.x, a.y, b.x, b.y, color, a.radius, b.radius);

    if ((transform.k > 0.8 && showLabels) || isHighlighted) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.save();
      ctx.font = '9px system-ui';
      ctx.fillStyle = isHighlighted ? '#c9d1d9' : '#6e7681';
      ctx.textAlign = 'center';
      ctx.fillText(e.label || '', mx, my - 3);
      ctx.restore();
    }
  });

  visibleNodes.forEach(n => {
    const isHl = !highlightedNode || highlightedIds.has(n.id);
    const baseColor = (GROUPS[n.group] && GROUPS[n.group].color) || '#8b949e';
    const [h, s, l] = fileShadeHsl(baseColor, n.file);
    const hs = 'hsl(' + h + ',' + s + '%,' + l + '%)';
    const alpha = isHl ? 1 : 0.2;

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'hsla(' + h + ',' + s + '%,' + l + '%,' + (isHl ? 0.8 : 0.27) + ')';
    ctx.fill();
    ctx.strokeStyle = n === highlightedNode ? '#ffffff' : hs;
    ctx.lineWidth = n === highlightedNode ? 2.5 : 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (showLabels && transform.k > 0.4) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = \`\${Math.max(9, 11 / transform.k * 0.7)}px system-ui\`;
      ctx.fillStyle = isHl ? '#e6edf3' : '#6e7681';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const label = n.label.length > 28 ? n.label.slice(0, 26) + '…' : n.label;
      const textY = n.y + n.radius + 3;
      ctx.fillText(label, n.x, textY);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  });

  ctx.restore();
}

// ─────────────────────────────────────────────
// ANIMATION LOOP
// ─────────────────────────────────────────────

function loop() {
  simulate();
  render();
  requestAnimationFrame(loop);
}
loop();

// ─────────────────────────────────────────────
// INTERACTION
// ─────────────────────────────────────────────

let dragging = null, dragOffX = 0, dragOffY = 0;
let panStart = null;
let isPanning = false;

function hitTest(wx, wy) {
  const visibleNodes = getVisibleNodes();
  for (let i = visibleNodes.length - 1; i >= 0; i--) {
    const n = visibleNodes[i];
    const dx = n.x - wx, dy = n.y - wy;
    if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) return n;
  }
  return null;
}

canvas.addEventListener('mousedown', e => {
  const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);
  const hit = hitTest(wx, wy);
  if (hit) {
    dragging = hit;
    dragOffX = wx - hit.x;
    dragOffY = wy - hit.y;
    simRunning = true; simStep = 0;
  } else {
    isPanning = true;
    panStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  }
  canvas.classList.add('dragging');
});

canvas.addEventListener('mousemove', e => {
  const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);
  if (dragging) {
    dragging.x = wx - dragOffX;
    dragging.y = wy - dragOffY;
    dragging.vx = 0; dragging.vy = 0;
  } else if (isPanning) {
    transform.x = e.clientX - panStart.x;
    transform.y = e.clientY - panStart.y;
  }

  const hover = hitTest(wx, wy);
  const tip = document.getElementById('tooltip');
  if (hover) {
    tip.style.display = 'block';
    tip.style.left = (e.clientX + 12) + 'px';
    tip.style.top = (e.clientY - 10) + 'px';
    tip.innerHTML = \`<strong>\${hover.label}</strong><br>\${hover.file}<br><em>\${hover.desc || ''}</em>\`;
  } else {
    tip.style.display = 'none';
  }
});

canvas.addEventListener('mouseup', e => {
  if (!dragging && !isPanning) {
    const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);
    const hit = hitTest(wx, wy);
    if (hit) {
      highlightedNode = highlightedNode === hit ? null : hit;
      updateInfoPanel(hit === highlightedNode ? hit : null);
    } else {
      highlightedNode = null;
      updateInfoPanel(null);
    }
  }
  dragging = null;
  isPanning = false;
  canvas.classList.remove('dragging');
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.85 : 1.18;
  const mx = e.clientX, my = e.clientY;
  transform.x = mx - (mx - transform.x) * factor;
  transform.y = my - (my - transform.y) * factor;
  transform.k *= factor;
  transform.k = Math.min(4, Math.max(0.1, transform.k));
}, { passive: false });

let pinchDist = null;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const { x: wx, y: wy } = screenToWorld(t.clientX, t.clientY);
    const hit = hitTest(wx, wy);
    if (hit) {
      dragging = hit;
      dragOffX = wx - hit.x;
      dragOffY = wy - hit.y;
    } else {
      isPanning = true;
      panStart = { x: t.clientX - transform.x, y: t.clientY - transform.y };
    }
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    pinchDist = Math.sqrt(dx * dx + dy * dy);
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const { x: wx, y: wy } = screenToWorld(t.clientX, t.clientY);
    if (dragging) {
      dragging.x = wx - dragOffX;
      dragging.y = wy - dragOffY;
    } else if (isPanning) {
      transform.x = t.clientX - panStart.x;
      transform.y = t.clientY - panStart.y;
    }
  } else if (e.touches.length === 2 && pinchDist) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const factor = dist / pinchDist;
    pinchDist = dist;
    const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    transform.x = mx - (mx - transform.x) * factor;
    transform.y = my - (my - transform.y) * factor;
    transform.k = Math.min(4, Math.max(0.1, transform.k * factor));
  }
}, { passive: false });

canvas.addEventListener('touchend', () => {
  dragging = null;
  isPanning = false;
  pinchDist = null;
});

// ─────────────────────────────────────────────
// INFO PANEL
// ─────────────────────────────────────────────

function updateInfoPanel(node) {
  const panel = document.getElementById('info-panel');
  if (!node) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  document.getElementById('info-name').textContent = node.label;
  document.getElementById('info-file').textContent = node.file;
  document.getElementById('info-type').textContent = (GROUPS[node.group] && GROUPS[node.group].label) || node.group;
  document.getElementById('info-desc').textContent = node.desc || '(なし)';
  document.getElementById('info-meta-row').textContent = node.unresolved
    ? ''
    : \`\${node.isExported ? 'export' : 'local'} / \${node.isAsync ? 'async' : 'sync'}\${node.startLine ? ' / L' + node.startLine + '-' + node.endLine : ''}\`;

  const callersList = document.getElementById('info-callers');
  callersList.innerHTML = '';
  (edgesTo[node.id] || []).forEach(e => {
    const li = document.createElement('li');
    const fromNode = nodeMap[e.from];
    li.textContent = fromNode ? fromNode.label : e.from;
    li.style.cursor = 'pointer';
    li.style.color = '#79c0ff';
    li.addEventListener('click', () => {
      const n = nodeMap[e.from];
      if (n) { highlightedNode = n; updateInfoPanel(n); }
    });
    callersList.appendChild(li);
  });

  const calleesList = document.getElementById('info-callees');
  calleesList.innerHTML = '';
  (edgesFrom[node.id] || []).forEach(e => {
    const li = document.createElement('li');
    const toNode = nodeMap[e.to];
    li.textContent = toNode ? toNode.label : e.to;
    li.style.cursor = 'pointer';
    li.style.color = '#56d364';
    li.addEventListener('click', () => {
      const n = nodeMap[e.to];
      if (n) { highlightedNode = n; updateInfoPanel(n); }
    });
    calleesList.appendChild(li);
  });
}

// ─────────────────────────────────────────────
// CONTROLS
// ─────────────────────────────────────────────

document.getElementById('btn-reset').addEventListener('click', () => {
  nodes.forEach(n => {
    n.x = W / 2 + (Math.random() - 0.5) * 600;
    n.y = H / 2 + (Math.random() - 0.5) * 400;
    n.vx = 0; n.vy = 0;
  });
  transform.x = 0; transform.y = 0; transform.k = 1;
  simRunning = true; simStep = 0;
});

document.getElementById('btn-fit').addEventListener('click', () => {
  const vn = getVisibleNodes();
  if (vn.length === 0) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  vn.forEach(n => {
    minX = Math.min(minX, n.x - n.radius);
    minY = Math.min(minY, n.y - n.radius);
    maxX = Math.max(maxX, n.x + n.radius);
    maxY = Math.max(maxY, n.y + n.radius);
  });
  const pw = maxX - minX + 80, ph = maxY - minY + 80;
  const k = Math.min(W / pw, H / ph, 3);
  transform.k = k;
  transform.x = W / 2 - ((minX + maxX) / 2) * k;
  transform.y = H / 2 - ((minY + maxY) / 2) * k;
});

document.getElementById('btn-toggle-labels').addEventListener('click', () => {
  showLabels = !showLabels;
  document.getElementById('btn-toggle-labels').textContent = showLabels ? 'ラベル非表示' : 'ラベル表示';
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.group;
    simRunning = true; simStep = 0;
  });
});

document.getElementById('search-box').addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  simRunning = true; simStep = 0;
});

document.getElementById('top-bar-toggle').addEventListener('click', () => {
  document.getElementById('top-bar').classList.toggle('collapsed');
});

document.getElementById('note-dismiss').addEventListener('click', () => {
  document.getElementById('note').remove();
});

window.addEventListener('resize', () => {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
});
</script>
</body>
</html>`;
}
