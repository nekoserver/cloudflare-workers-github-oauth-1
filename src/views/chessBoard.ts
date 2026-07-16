import { CHESS_TSUME_17TE_TITLE, CHESS_TSUME_17TE_INITIAL, CHESS_TSUME_17TE_MOVES } from '../data/chessTsume17te';

export function getChessTsumePage(): string {
  const initialJson = JSON.stringify(CHESS_TSUME_17TE_INITIAL);
  const movesJson = JSON.stringify(CHESS_TSUME_17TE_MOVES);
  const title = CHESS_TSUME_17TE_TITLE;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e6edf3;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column}
.pg-hdr{padding:8px 14px;border-bottom:1px solid #21262d;flex-shrink:0}
.pg-title{font-size:0.95rem;font-weight:700;color:#f0b429}
.pg-sub{font-size:0.68rem;color:#8b949e;margin-top:2px}
.layout{display:flex;flex-wrap:wrap;gap:18px;padding:16px;justify-content:center;align-items:flex-start;flex:1}

.board-wrap{display:flex;flex-direction:column;align-items:center;gap:10px}
.board{display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);width:min(520px,92vw);aspect-ratio:1/1;border:2px solid #30363d;border-radius:4px;overflow:hidden}
.sq{position:relative;display:flex;align-items:center;justify-content:center}
.sq-l{background:#3d4451}
.sq-d{background:#1c2028}
.sq-piece{font-size:clamp(20px,6vw,40px);line-height:1;user-select:none}
.pc-w{color:#f2f2f2;text-shadow:0 0 1px #000,0 0 2px #000}
.pc-b{color:#0a0a0a;text-shadow:0 0 1px #fff,0 0 2px #fff}
.sq-rank,.sq-file{position:absolute;font-size:9px;color:#6e7681;pointer-events:none}
.sq-rank{top:2px;left:3px}
.sq-file{bottom:1px;right:3px}

.status{font-size:0.8rem;color:#8b949e;min-height:1.2em;text-align:center}
.status.is-check{color:#f0b429;font-weight:700}
.status.is-mate{color:#f85149;font-weight:800}

.controls{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.ctl-btn{background:#161b22;border:1px solid #30363d;color:#e6edf3;border-radius:6px;padding:6px 10px;font-size:0.78rem;cursor:pointer;font-family:inherit}
.ctl-btn:hover:not(:disabled){border-color:#58a6ff;color:#58a6ff}
.ctl-btn.active{background:#1f6feb;border-color:#58a6ff;color:#fff}
.ctl-btn:disabled{opacity:0.4;cursor:default}
.ply-indicator{font-size:0.75rem;color:#8b949e;font-family:monospace;align-self:center;padding:0 4px}

.side{width:260px;max-width:92vw;display:flex;flex-direction:column;gap:8px}
.side-title{font-size:0.7rem;font-weight:700;color:#58a6ff;text-transform:uppercase;letter-spacing:.05em}
.move-list{display:flex;flex-direction:column;gap:2px;max-height:420px;overflow-y:auto;background:#161b22;border:1px solid #21262d;border-radius:6px;padding:6px}
.mv-row{display:flex;align-items:center;gap:4px}
.mv-num{font-size:0.7rem;color:#6e7681;font-family:monospace;width:24px;flex-shrink:0;text-align:right}
.mv-btn{background:transparent;border:1px solid transparent;color:#e6edf3;font-family:monospace;font-size:0.75rem;padding:2px 6px;border-radius:4px;cursor:pointer;flex:1;text-align:left}
.mv-btn:hover{background:#21262d}
.mv-btn.active{background:#1f6feb;color:#fff;font-weight:700}

.keyhint{font-size:0.65rem;color:#6e7681;text-align:center}

@media(max-width:600px){
  .layout{flex-direction:column;align-items:center}
}
</style>
</head>
<body>
<div class="pg-hdr">
  <div class="pg-title">&#9823; ${title}</div>
  <div class="pg-sub">白キング+ルーク2枚 対 黒の裸玉 / 白番・17手(白9手・黒8手)で詰み</div>
</div>
<div class="layout">
  <div class="board-wrap">
    <div class="board" id="board"></div>
    <div class="status" id="status"></div>
    <div class="ply-indicator" id="ply-indicator"></div>
    <div class="controls">
      <button type="button" class="ctl-btn" id="btn-first" title="最初へ">&#9198; 最初</button>
      <button type="button" class="ctl-btn" id="btn-play-rev" title="逆再生">&#9664; 逆再生</button>
      <button type="button" class="ctl-btn" id="btn-prev" title="1手戻る">&#9664; 戻る</button>
      <button type="button" class="ctl-btn" id="btn-next" title="1手進む">進む &#9654;</button>
      <button type="button" class="ctl-btn" id="btn-play" title="再生">再生 &#9654;</button>
      <button type="button" class="ctl-btn" id="btn-last" title="最後へ">最後 &#9197;</button>
    </div>
    <div class="keyhint">&#8592;/&#8594; キーでも1手ずつ移動できます</div>
  </div>
  <div class="side">
    <div class="side-title">&#128203; 棋譜(クリックでその局面へ)</div>
    <div class="move-list" id="move-list"></div>
  </div>
</div>
<script>
var INITIAL = ${initialJson};
var MOVES = ${movesJson};
var PLAY_INTERVAL_MS = 900;

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

var PIECE_GLYPH = {
  wK: '\\u2654', wQ: '\\u2655', wR: '\\u2656', wB: '\\u2657', wN: '\\u2658', wP: '\\u2659',
  bK: '\\u265A', bQ: '\\u265B', bR: '\\u265C', bB: '\\u265D', bN: '\\u265E', bP: '\\u265F'
};

function pieceGlyph(code) { return PIECE_GLYPH[code] || ''; }

function squareCoords(square) {
  var file = square.charCodeAt(0) - 97;
  var rank = parseInt(square[1], 10) - 1;
  return { file: file, rank: rank };
}

function applyPly(position, move) {
  var next = {};
  for (var k in position) { if (Object.prototype.hasOwnProperty.call(position, k)) { next[k] = position[k]; } }
  var piece = next[move.from];
  delete next[move.from];
  next[move.to] = piece;
  return next;
}

function buildPositions(initial, moves) {
  var positions = [initial];
  var cur = initial;
  for (var i = 0; i < moves.length; i++) {
    cur = applyPly(cur, moves[i]);
    positions.push(cur);
  }
  return positions;
}

function renderBoard(position) {
  var html = '';
  for (var row = 1; row <= 8; row++) {
    for (var col = 1; col <= 8; col++) {
      var file = col - 1;
      var rank = 8 - row;
      var square = String.fromCharCode(97 + file) + (rank + 1);
      var isLight = (file + rank) % 2 === 1;
      var piece = position[square];
      var glyph = piece ? pieceGlyph(piece) : '';
      var pieceClass = piece ? (piece.charAt(0) === 'w' ? 'pc-w' : 'pc-b') : '';
      html += '<div class="sq ' + (isLight ? 'sq-l' : 'sq-d') + '" data-square="' + square + '">';
      if (col === 1) { html += '<span class="sq-rank">' + (rank + 1) + '</span>'; }
      if (row === 8) { html += '<span class="sq-file">' + String.fromCharCode(97 + file) + '</span>'; }
      if (glyph) { html += '<span class="sq-piece ' + pieceClass + '" data-piece="' + piece + '">' + glyph + '</span>'; }
      html += '</div>';
    }
  }
  return html;
}

function renderMoveList(moves, currentPly) {
  var html = '';
  for (var i = 0; i < moves.length; i += 2) {
    var num = Math.floor(i / 2) + 1;
    var wPly = i + 1;
    html += '<div class="mv-row">';
    html += '<span class="mv-num">' + num + '.</span>';
    html += '<button type="button" class="mv-btn' + (currentPly === wPly ? ' active' : '') + '" data-ply="' + wPly + '">' + esc(moves[i].san) + '</button>';
    if (i + 1 < moves.length) {
      var bPly = i + 2;
      html += '<button type="button" class="mv-btn' + (currentPly === bPly ? ' active' : '') + '" data-ply="' + bPly + '">' + esc(moves[i + 1].san) + '</button>';
    }
    html += '</div>';
  }
  return html;
}

var state = { ply: 0, positions: buildPositions(INITIAL, MOVES), playTimer: null, playDir: 0 };

function updatePlayButtons() {
  document.getElementById('btn-play').classList.toggle('active', state.playDir === 1);
  document.getElementById('btn-play-rev').classList.toggle('active', state.playDir === -1);
}

function wireMoveButtons() {
  document.querySelectorAll('.mv-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      stopPlay();
      goTo(parseInt(btn.getAttribute('data-ply'), 10));
    });
  });
}

function render() {
  document.getElementById('board').innerHTML = renderBoard(state.positions[state.ply]);
  document.getElementById('move-list').innerHTML = renderMoveList(MOVES, state.ply);
  document.getElementById('ply-indicator').textContent = state.ply + ' / ' + MOVES.length;

  var statusEl = document.getElementById('status');
  var lastMove = state.ply > 0 ? MOVES[state.ply - 1] : null;
  statusEl.classList.remove('is-check', 'is-mate');
  if (!lastMove) {
    statusEl.textContent = '開始局面(白番)';
  } else if (lastMove.mate) {
    statusEl.textContent = '詰み! ' + lastMove.san;
    statusEl.classList.add('is-mate');
  } else if (lastMove.check) {
    statusEl.textContent = '王手: ' + lastMove.san;
    statusEl.classList.add('is-check');
  } else {
    statusEl.textContent = lastMove.san;
  }

  document.getElementById('btn-first').disabled = state.ply <= 0;
  document.getElementById('btn-prev').disabled = state.ply <= 0;
  document.getElementById('btn-next').disabled = state.ply >= MOVES.length;
  document.getElementById('btn-last').disabled = state.ply >= MOVES.length;

  wireMoveButtons();
  updatePlayButtons();
}

function goTo(ply) {
  state.ply = Math.max(0, Math.min(MOVES.length, ply));
  render();
}

function stepNext() { goTo(state.ply + 1); }
function stepPrev() { goTo(state.ply - 1); }

function stopPlay() {
  if (state.playTimer) { clearInterval(state.playTimer); state.playTimer = null; }
  state.playDir = 0;
  updatePlayButtons();
}

function startPlay(dir) {
  stopPlay();
  state.playDir = dir;
  updatePlayButtons();
  state.playTimer = setInterval(function() {
    if (dir > 0) {
      if (state.ply >= MOVES.length) { stopPlay(); return; }
      stepNext();
      if (state.ply >= MOVES.length) { stopPlay(); }
    } else {
      if (state.ply <= 0) { stopPlay(); return; }
      stepPrev();
      if (state.ply <= 0) { stopPlay(); }
    }
  }, PLAY_INTERVAL_MS);
}

document.getElementById('btn-first').addEventListener('click', function() { stopPlay(); goTo(0); });
document.getElementById('btn-last').addEventListener('click', function() { stopPlay(); goTo(MOVES.length); });
document.getElementById('btn-prev').addEventListener('click', function() { stopPlay(); stepPrev(); });
document.getElementById('btn-next').addEventListener('click', function() { stopPlay(); stepNext(); });
document.getElementById('btn-play').addEventListener('click', function() {
  if (state.playDir === 1) { stopPlay(); } else { startPlay(1); }
});
document.getElementById('btn-play-rev').addEventListener('click', function() {
  if (state.playDir === -1) { stopPlay(); } else { startPlay(-1); }
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowRight') { stopPlay(); stepNext(); }
  else if (e.key === 'ArrowLeft') { stopPlay(); stepPrev(); }
});

render();
</script>
</body>
</html>`;
}
