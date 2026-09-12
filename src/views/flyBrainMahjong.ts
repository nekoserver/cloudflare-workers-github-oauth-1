import { MAHJONG_DISCARD_PROBLEMS } from '../data/mahjongDiscardProblems';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

const PROBLEMS_JSON = JSON.stringify(MAHJONG_DISCARD_PROBLEMS);

/** ハエの脳に麻雀「何切り」を解かせるデモページ */
export function getFlyBrainMahjongPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>🪰 ハエの脳 — 麻雀何切り</title>
${getThemeInitScript()}
<style>
${getThemeCSS()}
${getThemeToggleCSS()}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
.topbar {
  position: sticky; top: 0; z-index: 10;
  height: 44px; min-height: 44px; max-height: 44px;
  background: var(--navbar-bg);
  border-bottom: 1px solid var(--border-color);
  display: flex; align-items: center; gap: 10px; padding: 0 14px;
}
.topbar h1 { font-size: 14px; font-weight: 700; flex: 1; }
.layout {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 0;
  min-height: 0;
}
@media (max-width: 800px) { .layout { grid-template-columns: 1fr; } }
.main { padding: 16px; overflow-y: auto; }
.side {
  background: var(--card-bg);
  border-left: 1px solid var(--border-color);
  padding: 12px;
  overflow-y: auto;
}
@media (max-width: 800px) { .side { border-left: none; border-top: 1px solid var(--border-color); } }
.panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.panel h2 { font-size: 11px; color: var(--text-muted); margin-bottom: 8px; letter-spacing: 0.06em; }
select, input[type=text] {
  width: 100%;
  background: var(--input-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
}
.btn {
  background: var(--accent-color);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
}
.btn:hover { background: var(--accent-hover); }
.btn.secondary {
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}
.tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0;
}
.tile {
  min-width: 38px;
  height: 48px;
  border-radius: 6px;
  border: 2px solid var(--border-color);
  background: var(--card-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  box-shadow: 0 2px 0 var(--border-color);
}
.tile.m { color: #c53030; }
.tile.p { color: #2b6cb0; }
.tile.s { color: #276749; }
.tile.z { color: #744210; font-size: 11px; }
.tile.discard {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-color);
  transform: translateY(-4px);
}
.fly-box {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}
.fly-icon { font-size: 36px; line-height: 1; }
.result {
  font-size: 15px;
  font-weight: 700;
  color: var(--accent-color);
}
.note { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
table.cands {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
table.cands th, table.cands td {
  border: 1px solid var(--border-color);
  padding: 4px 6px;
  text-align: center;
}
table.cands th { background: var(--bg-secondary); color: var(--text-muted); }
table.cands tr.best { background: rgba(102,126,234,0.12); font-weight: 700; }
.neuron-graph { width: 100%; height: 120px; }
.stat { font-family: ui-monospace, monospace; font-size: 10px; color: var(--text-secondary); line-height: 1.7; }
</style>
</head>
<body>
<div class="topbar">
  <h1>🪰 ハエの脳 — 麻雀何切り</h1>
  ${getThemeToggleHTML()}
</div>
<div class="layout">
  <div class="main">
    <div class="panel">
      <h2>問題</h2>
      <select id="problem-select"></select>
      <input type="text" id="hand-input" placeholder="例: 123m 456m 789m 11p 34p 7s" style="margin-top:8px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="btn-solve" type="button">ハエに考えさせる</button>
        <button class="btn secondary" id="btn-load" type="button">問題を読み込む</button>
      </div>
    </div>
    <div class="panel">
      <h2>14枚の手牌</h2>
      <div class="tiles" id="hand-tiles"></div>
      <div class="fly-box">
        <div class="fly-icon" id="fly-emoji">🪰</div>
        <div>
          <div class="result" id="result-text">「考えさせる」を押してください</div>
          <div class="note" id="result-note"></div>
        </div>
      </div>
    </div>
    <div class="panel">
      <h2>全候補の評価</h2>
      <div style="overflow-x:auto">
        <table class="cands" id="cand-table">
          <thead><tr><th>切る牌</th><th>向聴</th><th>受入</th><th>孤立</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>
  <aside class="side">
    <div class="panel">
      <h2>ハエの脳（切牌決定）</h2>
      <svg class="neuron-graph" id="graph" viewBox="0 0 220 120" aria-hidden="true"></svg>
      <div class="stat" id="brain-stat">—</div>
    </div>
    <div class="panel">
      <h2>入力の書式</h2>
      <p class="note">萬子/筒子/索子は <code>123m</code> <code>11p</code>、字牌は <code>1z</code>(東)〜<code>7z</code>(中)。スペース区切りで14枚。</p>
    </div>
  </aside>
</div>
<script>
${getThemeToggleScript()}
(function() {
  var PROBLEMS = ${PROBLEMS_JSON};
  var problemSelect = document.getElementById('problem-select');
  var handInput = document.getElementById('hand-input');
  var handTiles = document.getElementById('hand-tiles');
  var resultText = document.getElementById('result-text');
  var resultNote = document.getElementById('result-note');
  var candBody = document.querySelector('#cand-table tbody');
  var graph = document.getElementById('graph');
  var brainStat = document.getElementById('brain-stat');
  var flyEmoji = document.getElementById('fly-emoji');

  PROBLEMS.forEach(function(p, i) {
    var opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = p.title;
    problemSelect.appendChild(opt);
  });

  function tileClass(label) {
    if (label.indexOf('m') >= 0) return 'm';
    if (label.indexOf('p') >= 0) return 'p';
    if (label.indexOf('s') >= 0) return 's';
    return 'z';
  }

  function renderHand(labels, discardLabel) {
    handTiles.innerHTML = '';
    labels.forEach(function(l) {
      var el = document.createElement('div');
      el.className = 'tile ' + tileClass(l);
      el.textContent = l;
      if (l === discardLabel) el.classList.add('discard');
      handTiles.appendChild(el);
    });
  }

  function drawGraph(neurons) {
    if (!neurons) return;
    var s = neurons.sensory;
    var h = neurons.interneuron;
    var nodes = [
      { x: 16, y: 20, v: s[0], l: 'SH' },
      { x: 16, y: 45, v: s[1], l: 'UK' },
      { x: 16, y: 70, v: s[2], l: 'ISO' },
      { x: 16, y: 95, v: s[3], l: 'HON' },
      { x: 110, y: 35, v: h[0], l: 'MB' },
      { x: 110, y: 70, v: h[1], l: 'AL' },
      { x: 110, y: 105, v: h[2], l: 'LN' },
      { x: 200, y: 60, v: Math.max(0, Math.min(1, neurons.discardScore / 3)), l: 'CUT' }
    ];
    var html = '';
    [[0,4],[1,4],[2,5],[3,6],[4,7],[5,7],[6,7]].forEach(function(e) {
      var a = nodes[e[0]], b = nodes[e[1]];
      var al = 0.15 + ((a.v + b.v) / 2) * 0.55;
      html += '<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#667eea" stroke-opacity="'+al.toFixed(2)+'" stroke-width="1.5"/>';
    });
    nodes.forEach(function(n) {
      var r = 5 + n.v * 7;
      html += '<circle cx="'+n.x+'" cy="'+n.y+'" r="'+r.toFixed(1)+'" fill="#667eea" fill-opacity="'+(0.35+n.v*0.65).toFixed(2)+'"/>';
      html += '<text x="'+n.x+'" y="'+(n.y+18)+'" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.7">'+n.l+'</text>';
    });
    graph.innerHTML = html;
    brainStat.textContent =
      'SH=向聴 SHanten  UK=受入  ISO=孤立\\n' +
      'score '+neurons.discardScore.toFixed(2);
  }

  function solveHand(handStr) {
    flyEmoji.textContent = '🪰💭';
    return fetch('/api/fly-brain-mahjong/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hand: handStr })
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (!data.ok) throw new Error(data.error || '解析失敗');
      flyEmoji.textContent = '🪰✂️';
      renderHand(data.handLabels, data.discard);
      resultText.textContent = '切る牌: ' + data.discard;
      resultNote.textContent = data.note || ('向聴 ' + data.shanten + ' / 受入 ' + data.ukeire);
      candBody.innerHTML = '';
      (data.candidates || []).forEach(function(c) {
        var tr = document.createElement('tr');
        if (c.tileLabel === data.discard) tr.className = 'best';
        tr.innerHTML = '<td>'+c.tileLabel+'</td><td>'+c.shanten+'</td><td>'+c.ukeire+'</td><td>'+(c.isolated?'○':'—')+'</td>';
        candBody.appendChild(tr);
      });
      drawGraph(data.neurons);
    }).catch(function(err) {
      flyEmoji.textContent = '🪰❌';
      resultText.textContent = 'エラー';
      resultNote.textContent = err.message || String(err);
    });
  }

  document.getElementById('btn-load').addEventListener('click', function() {
    var p = PROBLEMS[parseInt(problemSelect.value, 10)];
    handInput.value = p.hand;
    resultNote.textContent = p.note;
  });

  document.getElementById('btn-solve').addEventListener('click', function() {
    solveHand(handInput.value.trim());
  });

  var first = PROBLEMS[0];
  handInput.value = first.hand;
  resultNote.textContent = first.note;
  solveHand(first.hand);
})();
</script>
</body>
</html>`;
}
