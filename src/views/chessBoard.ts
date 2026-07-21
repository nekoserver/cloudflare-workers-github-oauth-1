import { CHESS_TSUME_17TE_TITLE, CHESS_TSUME_17TE_INITIAL, CHESS_TSUME_17TE_MOVES } from '../data/chessTsume17te';
import { FAMOUS_CHESS_GAMES } from '../data/famousChessGames';
import {
  CHESS_ENDGAME_2N_ID,
  CHESS_ENDGAME_2N_TITLE,
  CHESS_ENDGAME_2N_NOTE,
  CHESS_ENDGAME_2N_INITIAL,
  CHESS_ENDGAME_2N_MOVE_TEXT,
} from '../data/chessEndgame2n';

export function getChessTsumePage(): string {
  const initialJson = JSON.stringify(CHESS_TSUME_17TE_INITIAL);
  const movesJson = JSON.stringify(CHESS_TSUME_17TE_MOVES);
  const gamesJson = JSON.stringify(FAMOUS_CHESS_GAMES);
  const endgameJson = JSON.stringify({
    id: CHESS_ENDGAME_2N_ID,
    title: CHESS_ENDGAME_2N_TITLE,
    note: CHESS_ENDGAME_2N_NOTE,
    initial: CHESS_ENDGAME_2N_INITIAL,
    moveText: CHESS_ENDGAME_2N_MOVE_TEXT,
  });
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
.sq-piece{font-size:calc(clamp(20px,6vw,40px) * var(--piece-scale, 1));line-height:1;user-select:none}
.pc-w{color:#fbfbfb;text-shadow:0 0 1px #000,0 0 2px #000,0 0 3px #000;-webkit-text-stroke:0.6px #000}
.pc-b{color:#0a0a0a;text-shadow:0 0 1px #fff,0 0 2px #fff}
.sq-rank,.sq-file{position:absolute;font-size:9px;color:#6e7681;pointer-events:none}
.sq-rank{top:2px;left:3px}
.sq-file{bottom:1px;right:3px}
.sq-hl{position:absolute;border-radius:4px;pointer-events:none;border-width:2.5px;border-style:dashed;box-sizing:border-box}
.sq-hl-mover{border-color:#58a6ff;animation:sq-hl-blink 1.1s steps(1) infinite}
.sq-hl-move{border-color:#3fb950;animation:sq-hl-blink 0.9s steps(1) infinite}
.sq-hl-capture{border-color:#f85149;animation:sq-hl-blink 0.7s steps(1) infinite}
.sq-hl-hanging{border-color:#f0b429;animation:sq-hl-blink 0.7s steps(1) infinite}
@keyframes sq-hl-blink{0%,49%{opacity:1}50%,100%{opacity:0.15}}

.status{font-size:0.8rem;color:#8b949e;min-height:1.2em;text-align:center}
.status.is-check{color:#f0b429;font-weight:700}
.status.is-mate{color:#f85149;font-weight:800}

.controls{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.ctl-btn{background:#161b22;border:1px solid #30363d;color:#e6edf3;border-radius:6px;padding:6px 10px;font-size:0.78rem;cursor:pointer;font-family:inherit}
.ctl-btn:hover:not(:disabled){border-color:#58a6ff;color:#58a6ff}
.ctl-btn.active{background:#1f6feb;border-color:#58a6ff;color:#fff}
.ctl-btn:disabled{opacity:0.4;cursor:default}
.ply-indicator{font-size:0.75rem;color:#8b949e;font-family:monospace;align-self:center;padding:0 4px}

.piece-size-ctl{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center}
.piece-size-label{font-size:0.72rem;color:#8b949e}

.viz-ctl{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center}
.viz-label{font-size:0.72rem;color:#8b949e}

.side{width:280px;max-width:92vw;display:flex;flex-direction:column;gap:8px}
.side-title{font-size:0.7rem;font-weight:700;color:#58a6ff;text-transform:uppercase;letter-spacing:.05em}
.move-list{display:flex;flex-direction:column;gap:2px;max-height:300px;overflow-y:auto;background:#161b22;border:1px solid #21262d;border-radius:6px;padding:6px}
.mv-row{display:flex;align-items:center;gap:4px}
.mv-num{font-size:0.7rem;color:#6e7681;font-family:monospace;width:24px;flex-shrink:0;text-align:right}
.mv-btn{background:transparent;border:1px solid transparent;color:#e6edf3;font-family:monospace;font-size:0.75rem;padding:2px 6px;border-radius:4px;cursor:pointer;flex:1;text-align:left}
.mv-btn:hover{background:#21262d}
.mv-btn.active{background:#1f6feb;color:#fff;font-weight:700}

.keyhint{font-size:0.65rem;color:#6e7681;text-align:center}

.kifu-box{display:flex;flex-direction:column;gap:6px;background:#161b22;border:1px solid #21262d;border-radius:6px;padding:8px}
.kifu-select{background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:5px 6px;font-size:0.75rem;font-family:inherit}
.kifu-textarea{background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px;font-size:0.72rem;font-family:monospace;resize:vertical;min-height:90px;line-height:1.5}
.kifu-meta{font-size:0.65rem;color:#8b949e;line-height:1.5}
.kifu-actions{display:flex;gap:6px}
.kifu-error{font-size:0.7rem;color:#f85149;min-height:1.2em;white-space:pre-wrap}

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
    <div class="piece-size-ctl">
      <span class="piece-size-label">駒サイズ:</span>
      <button type="button" class="ctl-btn size-btn" data-scale="0.75">小</button>
      <button type="button" class="ctl-btn size-btn active" data-scale="1">標準</button>
      <button type="button" class="ctl-btn size-btn" data-scale="1.3">大</button>
      <button type="button" class="ctl-btn size-btn" data-scale="1.6">特大</button>
    </div>
    <div class="viz-ctl">
      <span class="viz-label">手の可視化:</span>
      <button type="button" class="ctl-btn viz-btn" id="viz-mover" data-viz="mover" title="次に動く駒のマスをハイライトします">&#9679; 動く駒</button>
      <button type="button" class="ctl-btn viz-btn" id="viz-moves" data-viz="moves" title="次に動く駒が移動できるマスを点滅枠で囲みます">&#8594; 移動先</button>
      <button type="button" class="ctl-btn viz-btn" id="viz-captures" data-viz="captures" title="次に動く駒が取れる相手の駒を点滅枠で囲みます">&#9876; 取れる駒</button>
      <button type="button" class="ctl-btn viz-btn" id="viz-hanging" data-viz="hanging" title="盤面全体で、手番側がこの手で取れる相手の駒すべてを点滅枠で囲みます">&#9888; 狙われている駒</button>
    </div>
    <div class="keyhint">&#8592;/&#8594; キーでも1手ずつ移動できます</div>
  </div>
  <div class="side">
    <div class="side-title">&#128203; 棋譜(クリックでその局面へ)</div>
    <div class="move-list" id="move-list"></div>
    <div class="kifu-box">
      <div class="side-title">&#9999; 棋譜を読み込む</div>
      <select class="kifu-select" id="kifu-select"></select>
      <div class="kifu-meta" id="kifu-meta"></div>
      <textarea class="kifu-textarea" id="kifu-input" spellcheck="false" placeholder="例: 1. e4 e5 2. Nf3 Nc6 ..."></textarea>
      <div class="kifu-actions">
        <button type="button" class="ctl-btn" id="btn-kifu-clear">クリア</button>
        <button type="button" class="ctl-btn" id="btn-kifu-load">読み込んで再生</button>
      </div>
      <div class="kifu-error" id="kifu-error"></div>
    </div>
  </div>
</div>
<script>
var TSUME_INITIAL = ${initialJson};
var TSUME_MOVES = ${movesJson};
var FAMOUS_GAMES = ${gamesJson};
var ENDGAME_2N = ${endgameJson};
var STANDARD_START = {
  a1:'wR', b1:'wN', c1:'wB', d1:'wQ', e1:'wK', f1:'wB', g1:'wN', h1:'wR',
  a2:'wP', b2:'wP', c2:'wP', d2:'wP', e2:'wP', f2:'wP', g2:'wP', h2:'wP',
  a7:'bP', b7:'bP', c7:'bP', d7:'bP', e7:'bP', f7:'bP', g7:'bP', h7:'bP',
  a8:'bR', b8:'bN', c8:'bB', d8:'bQ', e8:'bK', f8:'bB', g8:'bN', h8:'bR'
};
var PLAY_INTERVAL_MS = 1500;

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

// 白駒にも黒駒と同じ「塗りつぶし」書体のグリフ(U+265A-265F)を使う。
// 白駒専用のU+2654-2659は「中抜き(アウトライン)」書体でフォントが描画するため、
// 塗り面積がほとんど無くCSSで色を変えても視認性が上がらない。色の違いは
// pc-w/pc-bのCSS(色+縁取り)だけで表現する。
var PIECE_GLYPH = {
  wK: '\\u265A', wQ: '\\u265B', wR: '\\u265C', wB: '\\u265D', wN: '\\u265E', wP: '\\u265F',
  bK: '\\u265A', bQ: '\\u265B', bR: '\\u265C', bB: '\\u265D', bN: '\\u265E', bP: '\\u265F'
};

function pieceGlyph(code) { return PIECE_GLYPH[code] || ''; }

function squareCoords(square) {
  var file = square.charCodeAt(0) - 97;
  var rank = parseInt(square[1], 10) - 1;
  return { file: file, rank: rank };
}

function fileOf(square) { return square.charCodeAt(0) - 97; }
function rankOf(square) { return parseInt(square[1], 10) - 1; }
function squareName(file, rank) { return String.fromCharCode(97 + file) + (rank + 1); }
function inBounds(file, rank) { return file >= 0 && file < 8 && rank >= 0 && rank < 8; }

function movePiece(position, from, to, promoteTo) {
  var next = {};
  for (var k in position) { if (Object.prototype.hasOwnProperty.call(position, k)) { next[k] = position[k]; } }
  var piece = promoteTo || next[from];
  delete next[from];
  next[to] = piece;
  return next;
}

function applyPly(position, move) {
  var next = movePiece(position, move.from, move.to, move.promote);
  if (move.rookFrom && move.rookTo) { next = movePiece(next, move.rookFrom, move.rookTo); }
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

var KNIGHT_OFFSETS = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
var KING_OFFSETS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
var BISHOP_DIRS = [[1,1],[1,-1],[-1,1],[-1,-1]];
var ROOK_DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
var QUEEN_DIRS = BISHOP_DIRS.concat(ROOK_DIRS);

function stepReachable(from, dest, offsets) {
  var f0 = fileOf(from), r0 = rankOf(from);
  var fd = fileOf(dest), rd = rankOf(dest);
  for (var i = 0; i < offsets.length; i++) {
    if (f0 + offsets[i][0] === fd && r0 + offsets[i][1] === rd) return true;
  }
  return false;
}

function slideReachable(position, from, dirs, dest) {
  var f0 = fileOf(from), r0 = rankOf(from);
  for (var d = 0; d < dirs.length; d++) {
    var f = f0 + dirs[d][0], r = r0 + dirs[d][1];
    while (inBounds(f, r)) {
      var sq = squareName(f, r);
      if (sq === dest) return true;
      if (position[sq]) break;
      f += dirs[d][0]; r += dirs[d][1];
    }
  }
  return false;
}

function canReach(position, pieceType, from, dest) {
  if (pieceType === 'N') return stepReachable(from, dest, KNIGHT_OFFSETS);
  if (pieceType === 'K') return stepReachable(from, dest, KING_OFFSETS);
  if (pieceType === 'B') return slideReachable(position, from, BISHOP_DIRS, dest);
  if (pieceType === 'R') return slideReachable(position, from, ROOK_DIRS, dest);
  if (pieceType === 'Q') return slideReachable(position, from, QUEEN_DIRS, dest);
  return false;
}

function findKing(position, color) {
  for (var sq in position) {
    if (Object.prototype.hasOwnProperty.call(position, sq) && position[sq] === color + 'K') return sq;
  }
  return null;
}

// 手の可視化オプション用。スライド駒(B/R/Q)が到達できる全マスを、経路上の
// 駒でブロックされる/敵駒なら含めて味方駒なら含めない、という規則で列挙する。
function slideTargets(position, from, dirs, color) {
  var result = [];
  var f0 = fileOf(from), r0 = rankOf(from);
  for (var d = 0; d < dirs.length; d++) {
    var f = f0 + dirs[d][0], r = r0 + dirs[d][1];
    while (inBounds(f, r)) {
      var sq = squareName(f, r);
      var occ = position[sq];
      if (occ) {
        if (occ.charAt(0) !== color) result.push(sq);
        break;
      }
      result.push(sq);
      f += dirs[d][0]; r += dirs[d][1];
    }
  }
  return result;
}

// N/Kのようにジャンプ/1歩の駒が到達できる全マスを列挙する(味方駒があるマスは除外)。
function stepTargets(position, from, offsets, color) {
  var result = [];
  var f0 = fileOf(from), r0 = rankOf(from);
  for (var i = 0; i < offsets.length; i++) {
    var f = f0 + offsets[i][0], r = r0 + offsets[i][1];
    if (!inBounds(f, r)) continue;
    var sq = squareName(f, r);
    var occ = position[sq];
    if (occ && occ.charAt(0) === color) continue;
    result.push(sq);
  }
  return result;
}

// ポーンは前進(空きマスのみ・初期段なら2マス)と斜め捕獲(敵駒がある時のみ)で
// 移動規則が非対称なため、他の駒とは別に専用の判定を行う(アンパッサンは未対応)。
function pawnTargets(position, from, color) {
  var moves = [], captures = [];
  var f0 = fileOf(from), r0 = rankOf(from);
  var dir = color === 'w' ? 1 : -1;
  var startRank = color === 'w' ? 1 : 6;
  if (inBounds(f0, r0 + dir)) {
    var oneSq = squareName(f0, r0 + dir);
    if (!position[oneSq]) {
      moves.push(oneSq);
      if (r0 === startRank) {
        var twoSq = squareName(f0, r0 + dir * 2);
        if (!position[twoSq]) moves.push(twoSq);
      }
    }
  }
  [-1, 1].forEach(function(df) {
    var cf = f0 + df, cr = r0 + dir;
    if (!inBounds(cf, cr)) return;
    var csq = squareName(cf, cr);
    var occ = position[csq];
    if (occ && occ.charAt(0) !== color) captures.push(csq);
  });
  return { moves: moves, captures: captures };
}

// squareにある駒が指せる移動先を「駒が無いマス(moves)」と「敵駒を取れるマス
// (captures)」に分けて返す。手の可視化オプション(候補手・取れる駒のハイライト)
// の土台となる純粋関数。キングの安全(自玉が素抜きになる手の除外)や
// キャスリング・アンパッサンは対象外の簡易版(疑似合法手)。
function pieceTargets(position, square) {
  var piece = position[square];
  if (!piece) return { moves: [], captures: [] };
  var color = piece.charAt(0), type = piece.charAt(1);
  if (type === 'P') return pawnTargets(position, square, color);
  var all;
  if (type === 'N') all = stepTargets(position, square, KNIGHT_OFFSETS, color);
  else if (type === 'K') all = stepTargets(position, square, KING_OFFSETS, color);
  else if (type === 'B') all = slideTargets(position, square, BISHOP_DIRS, color);
  else if (type === 'R') all = slideTargets(position, square, ROOK_DIRS, color);
  else if (type === 'Q') all = slideTargets(position, square, QUEEN_DIRS, color);
  else all = [];
  var moves = [], captures = [];
  all.forEach(function(sq) { if (position[sq]) { captures.push(sq); } else { moves.push(sq); } });
  return { moves: moves, captures: captures };
}

// 現在の局面・手数・可視化オプションから、盤面に描くハイライトのマスと種類
// (mover/move/capture/hanging)を計算する。1マスに複数種のハイライトが
// 重なることもある(例: 次に動く駒の捕獲先が、盤面全体の「狙われている駒」
// 判定にも同時に含まれる場合)ため、値は種類名の配列で持つ。
function computeHighlights(position, moves, ply, viz) {
  var highlights = {};
  function add(sq, kind) {
    if (!highlights[sq]) { highlights[sq] = []; }
    if (highlights[sq].indexOf(kind) === -1) { highlights[sq].push(kind); }
  }
  var nextMove = moves[ply];
  if (nextMove && (viz.mover || viz.moves || viz.captures)) {
    var t = pieceTargets(position, nextMove.from);
    if (viz.mover) { add(nextMove.from, 'mover'); }
    if (viz.moves) { t.moves.forEach(function(sq) { add(sq, 'move'); }); }
    if (viz.captures) { t.captures.forEach(function(sq) { add(sq, 'capture'); }); }
  }
  if (viz.hanging) {
    var sideToMove = ply % 2 === 0 ? 'w' : 'b';
    for (var sq in position) {
      if (!Object.prototype.hasOwnProperty.call(position, sq)) continue;
      if (position[sq].charAt(0) !== sideToMove) continue;
      var tt = pieceTargets(position, sq);
      tt.captures.forEach(function(csq) { add(csq, 'hanging'); });
    }
  }
  return highlights;
}

function findPawnOrigin(position, color, dest, isCapture, originFileHint) {
  var destFile = fileOf(dest), destRank = rankOf(dest);
  if (isCapture) {
    var originFile = originFileHint.charCodeAt(0) - 97;
    var originRank = destRank + (color === 'w' ? -1 : 1);
    var originSq = squareName(originFile, originRank);
    if (position[originSq] === color + 'P') return originSq;
    throw new Error('ポーンの捕獲元が見つからない(' + originSq + ')');
  }
  var oneBack = squareName(destFile, destRank + (color === 'w' ? -1 : 1));
  if (position[oneBack] === color + 'P') return oneBack;
  var twoBack = squareName(destFile, destRank + (color === 'w' ? -2 : 2));
  var startRank = color === 'w' ? 1 : 6;
  if (rankOf(twoBack) === startRank && position[twoBack] === color + 'P') return twoBack;
  throw new Error('ポーンの起点が見つからない(宛先' + dest + ')');
}

function findPieceOrigin(position, color, pieceType, dest, disambigFile, disambigRank) {
  var candidates = [];
  for (var sq in position) {
    if (!Object.prototype.hasOwnProperty.call(position, sq)) continue;
    if (position[sq] !== color + pieceType) continue;
    if (disambigFile !== null && fileOf(sq) !== disambigFile) continue;
    if (disambigRank !== null && rankOf(sq) !== disambigRank) continue;
    if (canReach(position, pieceType, sq, dest)) candidates.push(sq);
  }
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) throw new Error('指せる' + pieceType + 'が見つからない(宛先' + dest + ')');
  throw new Error('指し手が曖昧(候補' + candidates.length + '個・宛先' + dest + ')');
}

var SAN_RE = /^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(=[QRBN])?([+#])?$/;

function stripAnnotation(tok) { return tok.replace(/[!?]+$/, ''); }

function applySanMove(position, rawToken, color) {
  var tok = stripAnnotation(rawToken);
  var m = /^(O-O-O|0-0-0)([+#])?$/.exec(tok);
  if (m) {
    var rank0 = color === 'w' ? 0 : 7;
    var kFrom0 = squareName(4, rank0), kTo0 = squareName(2, rank0);
    var rFrom0 = squareName(0, rank0), rTo0 = squareName(3, rank0);
    var next0 = movePiece(movePiece(position, kFrom0, kTo0), rFrom0, rTo0);
    return { move: { from: kFrom0, to: kTo0, rookFrom: rFrom0, rookTo: rTo0, san: rawToken, check: m[2] === '+', mate: m[2] === '#' }, next: next0 };
  }
  m = /^(O-O|0-0)([+#])?$/.exec(tok);
  if (m) {
    var rank1 = color === 'w' ? 0 : 7;
    var kFrom1 = squareName(4, rank1), kTo1 = squareName(6, rank1);
    var rFrom1 = squareName(7, rank1), rTo1 = squareName(5, rank1);
    var next1 = movePiece(movePiece(position, kFrom1, kTo1), rFrom1, rTo1);
    return { move: { from: kFrom1, to: kTo1, rookFrom: rFrom1, rookTo: rTo1, san: rawToken, check: m[2] === '+', mate: m[2] === '#' }, next: next1 };
  }

  m = SAN_RE.exec(tok);
  if (!m) throw new Error('解析できない手: "' + rawToken + '"');
  var pieceLetter = m[1];
  var dfileCh = m[2];
  var drankCh = m[3];
  var isCapture = !!m[4];
  var dest = m[5];
  var promo = m[6];
  var chk = m[7];

  var from;
  if (!pieceLetter) {
    from = findPawnOrigin(position, color, dest, isCapture, isCapture ? dfileCh : null);
  } else if (pieceLetter === 'K') {
    from = findKing(position, color);
    if (!from) throw new Error('キングが盤上に見つからない');
  } else {
    var disambigFile = dfileCh ? (dfileCh.charCodeAt(0) - 97) : null;
    var disambigRank = drankCh ? (parseInt(drankCh, 10) - 1) : null;
    from = findPieceOrigin(position, color, pieceLetter, dest, disambigFile, disambigRank);
  }

  if (!position[from]) throw new Error('起点マスに駒が無い: ' + from + ' ("' + rawToken + '")');
  var promoteTo = promo ? (color + promo.charAt(1)) : null;
  var next = movePiece(position, from, dest, promoteTo);
  // promoteをmoveに含めないと、loadGame→buildPositionsでの再生時に昇格が
  // 適用されずポーンのまま盤上を動いてしまう(解析時のpositionsとズレる)
  var move = { from: from, to: dest, san: rawToken, check: chk === '+', mate: chk === '#' };
  if (promoteTo) { move.promote = promoteTo; }
  return { move: move, next: next };
}

function parseGameText(text, startingPosition) {
  var cleaned = String(text || '').replace(/\\{[^}]*\\}/g, ' ').replace(/\\([^)]*\\)/g, ' ');
  var tokens = cleaned.split(/\\s+/).filter(function(t) { return t.length > 0; });
  var moves = [];
  var positions = [startingPosition];
  var cur = startingPosition;
  for (var i = 0; i < tokens.length; i++) {
    var tok = tokens[i];
    if (/^\\d+\\.+$/.test(tok)) continue;
    if (/^(1-0|0-1|1\\/2-1\\/2|\\*)$/.test(tok)) continue;
    var cleanedTok = tok.replace(/^\\d+\\.+/, '');
    if (!cleanedTok) continue;
    var color = (moves.length % 2 === 0) ? 'w' : 'b';
    var result;
    try {
      result = applySanMove(cur, cleanedTok, color);
    } catch (e) {
      throw new Error((moves.length + 1) + '手目「' + tok + '」: ' + e.message);
    }
    moves.push(result.move);
    cur = result.next;
    positions.push(cur);
  }
  if (!moves.length) throw new Error('指し手が見つかりませんでした');
  return { moves: moves, positions: positions };
}

function movesToText(moves) {
  var lines = [];
  for (var i = 0; i < moves.length; i += 2) {
    var num = Math.floor(i / 2) + 1;
    var line = num + '. ' + moves[i].san;
    if (i + 1 < moves.length) { line += ' ' + moves[i + 1].san; }
    lines.push(line);
  }
  return lines.join('\\n');
}

function renderBoard(position, highlights) {
  highlights = highlights || {};
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
      var kinds = highlights[square];
      if (kinds) {
        kinds.forEach(function(kind, idx) {
          html += '<span class="sq-hl sq-hl-' + kind + '" style="inset:' + (2 + idx * 4) + 'px" data-hl="' + kind + '"></span>';
        });
      }
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

var state = {
  initial: TSUME_INITIAL,
  moves: TSUME_MOVES,
  ply: 0,
  positions: buildPositions(TSUME_INITIAL, TSUME_MOVES),
  playTimer: null,
  playDir: 0,
  viz: { mover: false, moves: false, captures: false, hanging: false }
};

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
  var highlights = computeHighlights(state.positions[state.ply], state.moves, state.ply, state.viz);
  document.getElementById('board').innerHTML = renderBoard(state.positions[state.ply], highlights);
  document.getElementById('move-list').innerHTML = renderMoveList(state.moves, state.ply);
  document.getElementById('ply-indicator').textContent = state.ply + ' / ' + state.moves.length;

  var statusEl = document.getElementById('status');
  var lastMove = state.ply > 0 ? state.moves[state.ply - 1] : null;
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
  document.getElementById('btn-next').disabled = state.ply >= state.moves.length;
  document.getElementById('btn-last').disabled = state.ply >= state.moves.length;

  wireMoveButtons();
  updatePlayButtons();
}

function goTo(ply) {
  state.ply = Math.max(0, Math.min(state.moves.length, ply));
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
      if (state.ply >= state.moves.length) { stopPlay(); return; }
      stepNext();
      if (state.ply >= state.moves.length) { stopPlay(); }
    } else {
      if (state.ply <= 0) { stopPlay(); return; }
      stepPrev();
      if (state.ply <= 0) { stopPlay(); }
    }
  }, PLAY_INTERVAL_MS);
}

function loadGame(initialPosition, moves) {
  stopPlay();
  state.initial = initialPosition;
  state.moves = moves;
  state.positions = buildPositions(initialPosition, moves);
  state.ply = 0;
  render();
}

function loadFromKifuInput(autoPlay) {
  var errEl = document.getElementById('kifu-error');
  var text = document.getElementById('kifu-input').value;
  var selVal = document.getElementById('kifu-select').value;
  var startingPosition = selVal === 'tsume-17te' ? TSUME_INITIAL : (selVal === ENDGAME_2N.id ? ENDGAME_2N.initial : STANDARD_START);
  var parsed;
  try {
    parsed = parseGameText(text, startingPosition);
  } catch (e) {
    errEl.textContent = e.message;
    return false;
  }
  errEl.textContent = '';
  loadGame(startingPosition, parsed.moves);
  if (autoPlay) { startPlay(1); }
  return true;
}

function populateKifuSelect() {
  var sel = document.getElementById('kifu-select');
  var html = '<option value="tsume-17te">17手詰め(K+2R対裸玉)</option>';
  html += '<option value="' + esc(ENDGAME_2N.id) + '">' + esc(ENDGAME_2N.title) + '</option>';
  FAMOUS_GAMES.forEach(function(g) {
    html += '<option value="' + esc(g.id) + '">' + esc(g.title) + '(' + esc(g.players) + ', ' + esc(g.year) + ')</option>';
  });
  html += '<option value="custom">カスタム(棋譜を貼り付け)</option>';
  sel.innerHTML = html;
}

function findFamousGame(id) {
  for (var i = 0; i < FAMOUS_GAMES.length; i++) { if (FAMOUS_GAMES[i].id === id) return FAMOUS_GAMES[i]; }
  return null;
}

function updateKifuMeta(game) {
  var metaEl = document.getElementById('kifu-meta');
  if (!game) { metaEl.textContent = ''; return; }
  metaEl.textContent = (game.event ? game.event + ' / ' : '') + (game.note || '');
}

function onKifuSelectChange() {
  var errEl = document.getElementById('kifu-error');
  errEl.textContent = '';
  var val = document.getElementById('kifu-select').value;
  var inputEl = document.getElementById('kifu-input');
  if (val === 'tsume-17te') {
    inputEl.value = movesToText(TSUME_MOVES);
    updateKifuMeta(null);
    loadGame(TSUME_INITIAL, TSUME_MOVES);
    startPlay(1);
    return;
  }
  if (val === ENDGAME_2N.id) {
    inputEl.value = ENDGAME_2N.moveText;
    updateKifuMeta({ note: ENDGAME_2N.note });
    loadFromKifuInput(true);
    return;
  }
  if (val === 'custom') {
    updateKifuMeta(null);
    return;
  }
  var game = findFamousGame(val);
  if (!game) return;
  inputEl.value = game.moveText;
  updateKifuMeta(game);
  loadFromKifuInput(true);
}

document.getElementById('btn-first').addEventListener('click', function() { stopPlay(); goTo(0); });
document.getElementById('btn-last').addEventListener('click', function() { stopPlay(); goTo(state.moves.length); });
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

document.querySelectorAll('.size-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.documentElement.style.setProperty('--piece-scale', btn.getAttribute('data-scale'));
    document.querySelectorAll('.size-btn').forEach(function(b) { b.classList.toggle('active', b === btn); });
  });
});

document.querySelectorAll('.viz-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var key = btn.getAttribute('data-viz');
    state.viz[key] = !state.viz[key];
    btn.classList.toggle('active', state.viz[key]);
    render();
  });
});

document.getElementById('btn-kifu-clear').addEventListener('click', function() {
  document.getElementById('kifu-input').value = '';
  document.getElementById('kifu-error').textContent = '';
  document.getElementById('kifu-input').focus();
});
document.getElementById('btn-kifu-load').addEventListener('click', function() { loadFromKifuInput(true); });
document.getElementById('kifu-select').addEventListener('change', onKifuSelectChange);

populateKifuSelect();
document.getElementById('kifu-input').value = movesToText(TSUME_MOVES);
render();
</script>
</body>
</html>`;
}
