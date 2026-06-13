export function getKwArchitecturePage(): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>キーワード分類 アーキテクチャ図</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0d1117; color: #e6edf3; font-family: 'Segoe UI', system-ui, sans-serif; overflow: hidden; }
canvas { display: block; cursor: grab; }
canvas.dragging { cursor: grabbing; }

#legend {
  position: fixed; top: 12px; left: 12px; z-index: 10;
  background: #161b22cc; border: 1px solid #30363d; border-radius: 8px;
  padding: 10px 14px; font-size: 12px;
}
#legend h3 { font-size: 12px; color: #8b949e; margin-bottom: 8px; font-weight: normal; letter-spacing: 0.05em; }
.lg { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
.lg-dot { width: 14px; height: 14px; border-radius: 3px; flex-shrink: 0; }
.lg-line { width: 28px; height: 2px; flex-shrink: 0; }

#info {
  position: fixed; top: 12px; right: 12px; z-index: 10;
  background: #161b22; border: 1px solid #30363d; border-radius: 8px;
  padding: 12px 16px; max-width: 300px; font-size: 12px; display: none;
}
#info h3 { font-size: 13px; color: #58a6ff; margin-bottom: 6px; word-break: break-all; }
#info .desc { color: #8b949e; line-height: 1.6; }
#info .conns { margin-top: 8px; }
#info .conn-label { font-size: 11px; color: #6e7681; margin-bottom: 3px; }
#info .conn-item { font-size: 11px; color: #e6edf3; padding: 2px 0; cursor: pointer; }
#info .conn-item:hover { color: #58a6ff; }
#info-open-table {
  display: none; margin-top: 10px; width: 100%;
  background: #21262d; border: 1px solid #388bfd66; color: #58a6ff;
  border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 12px;
}
#info-open-table:hover { background: #388bfd22; }

#controls {
  position: fixed; bottom: 16px; right: 16px; z-index: 10;
  display: flex; gap: 6px;
}
button {
  background: #21262d; border: 1px solid #30363d; color: #e6edf3;
  border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px;
}
button:hover { background: #30363d; }

#tooltip {
  position: fixed; pointer-events: none; z-index: 20;
  background: #1c2128; border: 1px solid #30363d; border-radius: 6px;
  padding: 6px 10px; font-size: 12px; color: #e6edf3;
  display: none; max-width: 260px; line-height: 1.5;
}

/* ── テーブルデータモーダル ── */
#table-modal {
  display: none; position: fixed; inset: 0; z-index: 200;
  background: #0d111799; overflow: auto;
}
#table-modal-inner {
  margin: 48px auto 48px; max-width: 960px;
  background: #161b22; border: 1px solid #30363d; border-radius: 12px;
  padding: 20px; min-height: 200px;
}
#table-modal-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
}
#table-modal-title {
  font-size: 14px; font-family: monospace; color: #58a6ff; flex: 1;
}
#table-modal-desc {
  font-size: 11px; color: #8b949e; margin-bottom: 12px;
}
#table-modal-close {
  background: transparent; border: 1px solid #30363d; color: #8b949e;
  border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 13px;
}
#table-modal-close:hover { background: #30363d; color: #e6edf3; }
#table-modal-body { overflow-x: auto; }
#table-modal-body table {
  width: 100%; border-collapse: collapse; font-size: 11px;
}
#table-modal-body th {
  background: #21262d; color: #8b949e; padding: 6px 8px;
  border: 1px solid #30363d; text-align: left; font-weight: normal;
  white-space: nowrap; position: sticky; top: 0;
}
#table-modal-body td {
  padding: 5px 8px; border: 1px solid #21262d; color: #c9d1d9;
  max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
#table-modal-body tr:hover td { background: #1c2128; }
.key-badge {
  display: inline-block; font-size: 9px; padding: 1px 4px; border-radius: 3px;
  margin-left: 4px; vertical-align: middle; font-weight: bold;
}
.key-PK  { background:#ffebe9; color:#cf222e; }
.key-FK  { background:#ddf4ff; color:#0969da; }
.key-UK  { background:#fff8c5; color:#9a6700; }
.key-IDX { background:#f0f0f0; color:#656d76; }
#table-modal-meta {
  font-size: 11px; color: #6e7681; margin-top: 10px;
}
</style>
</head>
<body>
<canvas id="canvas"></canvas>

<div id="legend">
  <h3>凡例</h3>
  <div class="lg"><div class="lg-dot" style="background:#388bfd22;border:1.5px solid #388bfd"></div>D1 テーブル</div>
  <div class="lg"><div class="lg-dot" style="background:#3fb95022;border:1.5px solid #3fb950"></div>API エンドポイント</div>
  <div class="lg"><div class="lg-dot" style="background:#a371f722;border:1.5px solid #a371f7"></div>UI モーダル / パネル</div>
  <div class="lg"><div class="lg-dot" style="background:#f7811622;border:1.5px solid #f78116"></div>配色 Cookie / CSS 変数</div>
  <hr style="border-color:#30363d;margin:8px 0">
  <div class="lg"><div class="lg-line" style="background:#58a6ff"></div>データ取得 (READ)</div>
  <div class="lg"><div class="lg-line" style="background:#3fb950"></div>データ書込 (WRITE)</div>
  <div class="lg"><div class="lg-line" style="background:#f78166"></div>配色反映</div>
  <div class="lg"><div class="lg-line" style="background:#8b949e;height:1px;border-top:2px dashed #8b949e;background:none"></div>経由なし / 補足</div>
</div>

<div id="info">
  <h3 id="info-name"></h3>
  <div class="desc" id="info-desc"></div>
  <div class="conns" id="info-conns"></div>
  <button id="info-open-table">テーブルデータを表示 →</button>
</div>

<div id="tooltip"></div>

<div id="controls">
  <button id="btn-fit">全体表示</button>
  <button id="btn-reset">リセット</button>
</div>

<!-- テーブルデータモーダル -->
<div id="table-modal">
  <div id="table-modal-inner">
    <div id="table-modal-header">
      <span id="table-modal-title"></span>
      <button id="table-modal-close">✕ 閉じる</button>
    </div>
    <div id="table-modal-desc"></div>
    <div id="table-modal-body"></div>
    <div id="table-modal-meta"></div>
  </div>
</div>

<script>
// ─────────────────────────────────────────────────────────
// NODE & EDGE DATA
// ─────────────────────────────────────────────────────────
// fx, fy = 画面幅・高さに対する割合 (0.0〜1.0)
// レイアウト設計:
//   y=0.80  → D1 テーブル（下段）
//   y=0.55  → API エンドポイント（中段）
//   y=0.37  → CSS変数（パレット系・中上）← UI層と分離することでオレンジ矢印が貫通しない
//   y=0.20  → UI モーダル（上段）
//   x=0.88  → Cookie / CSS変数（右端列）
const TYPES = {
  table:   { color: '#388bfd', fill: '#388bfd18', label: 'TABLE' },
  api:     { color: '#3fb950', fill: '#3fb95018', label: 'API' },
  ui:      { color: '#a371f7', fill: '#a371f718', label: 'UI' },
  palette: { color: '#f78116', fill: '#f7811618', label: 'CONFIG' },
};

const NODES = [
  // ── D1 Tables (y=0.80) ── 5ノードを均等に配置
  { id: 'tbl_search_log',
    label: 'aichat_search_log',
    tableName: 'aichat_search_log',
    type: 'table',
    desc: 'ユーザーがAIチャット結果をキーワード検索するたびに記録。keyword, share_id, select_count, user_id などを保持。share-keywords APIの主テーブル。',
    fx: 0.14, fy: 0.80 },
  { id: 'tbl_cat_map',
    label: 'aichat_keyword_category_map',
    tableName: 'aichat_keyword_category_map',
    type: 'table',
    desc: 'キーワードとカテゴリの多対多紐付けテーブル。分類済み判定の根拠 (is_classified = COUNT(category_id) > 0)。',
    fx: 0.28, fy: 0.80 },
  { id: 'tbl_categories',
    label: 'aichat_keyword_categories',
    tableName: 'aichat_keyword_categories',
    type: 'table',
    desc: 'ユーザーが作成したキーワードカテゴリ。id, name, color を保持。',
    fx: 0.42, fy: 0.80 },
  { id: 'tbl_chat_shares',
    label: 'ai_chat_shares',
    tableName: 'ai_chat_shares',
    type: 'table',
    desc: 'AIチャットの回答記録。share_id, question, answer, model などを保持。詳細プレビューモーダルの表示元。',
    fx: 0.56, fy: 0.80 },
  { id: 'tbl_multi_labels',
    label: 'keyword_multi_labels',
    tableName: 'keyword_multi_labels',
    type: 'table',
    desc: '別システム: キーワードの複数ラベル分類 (JSON配列)。share-keywords APIでは現在使用していない（aichat_keyword_category_mapに統一済み）。',
    fx: 0.70, fy: 0.80 },

  // ── API Endpoints (y=0.55) ── 4ノードを左寄り
  { id: 'api_share_kw',
    label: '/api/aichat/share-keywords',
    type: 'api',
    desc: '特定shareIdに紐づくキーワードを取得。aichat_search_log + aichat_keyword_category_mapをJOINし、keyword・count・is_classifiedを返す。',
    fx: 0.16, fy: 0.55 },
  { id: 'api_all_kw',
    label: '/api/aichat/all-keywords',
    type: 'api',
    desc: 'ユーザーの全キーワードを取得。category_map・categoriesをJOINしis_classified・category_color・category_pairsを返す。分類モーダルの主データソース。',
    fx: 0.32, fy: 0.55 },
  { id: 'api_cat_summary',
    label: '/api/aichat/keyword-categories-summary',
    type: 'api',
    desc: 'カテゴリ一覧とkw_countを返す。分類モーダルのカテゴリバッジ描画に使用。',
    fx: 0.48, fy: 0.55 },
  { id: 'api_cat_groups',
    label: '/api/aichat/category-groups',
    type: 'api',
    desc: 'カテゴリグループ一覧を返す。グループ単位での絞り込みに使用。',
    fx: 0.62, fy: 0.55 },

  // ── Palette nodes（右端列）──
  { id: 'pal_cookie',
    label: 'Cookie: kw_pal_*',
    type: 'palette',
    desc: 'ブラウザCookieに保存された配色設定。kw_pal_cls / kw_pal_unc / kw_pal_act / kw_pal_cat の4値。最大1年保持。D1には書き込まれない。',
    fx: 0.88, fy: 0.55 },
  { id: 'pal_css',
    label: 'CSS変数: --kw-pal-*',
    type: 'palette',
    desc: ':rootに設定されるCSS変数。--kw-pal-cls (分類済み色) / --kw-pal-unc-bg・fg (未分類色) / --kw-pal-act (選択中色)。applyKwPaletteToDom() でCookieから読み込み反映。',
    fx: 0.88, fy: 0.37 },

  // ── UI Modals (y=0.20) ──
  { id: 'ui_history_modal',
    label: '詳細プレビューモーダル',
    type: 'ui',
    desc: 'AIチャット回答の詳細表示モーダル。ai_chat_shares から回答内容を表示。キーワードチップパネルを内包する。🔑ボタンで全キーワードハイライト。',
    fx: 0.12, fy: 0.20 },
  { id: 'ui_chip_panel',
    label: 'キーワードチップパネル',
    type: 'ui',
    desc: '詳細プレビューモーダル下部のキーワード一覧。share-keywords APIから取得したkeyword(count)バッジを表示。is_classifiedによりhist-kw-chip-cls/uncクラスで色分け。タップでハイライト＋スクロール。',
    fx: 0.28, fy: 0.20 },
  { id: 'ui_classify_modal',
    label: 'キーワード分類モーダル',
    type: 'ui',
    desc: '全キーワードとカテゴリを管理するモーダル。all-keywords・keyword-categories-summary・category-groupsの3APIからデータ取得。分類登録するとaichat_keyword_category_mapに書き込む。',
    fx: 0.48, fy: 0.20 },
  { id: 'ui_palette_modal',
    label: '配色カスタマイズモーダル (🎨)',
    type: 'ui',
    desc: 'cls・unc・act・catの4色を設定するモーダル。決定するとCookieに保存（D1には保存しない）し、applyKwPaletteToDom()でCSS変数に即時反映。全モーダルのバッジ色に影響する。',
    fx: 0.68, fy: 0.20 },
];

const EDGE_TYPES = {
  read:    { color: '#58a6ff', dash: [] },
  write:   { color: '#3fb950', dash: [] },
  color:   { color: '#f78166', dash: [] },
  note:    { color: '#6e7681', dash: [5, 4] },
};

const EDGES = [
  // Tables → APIs
  { from: 'tbl_search_log',   to: 'api_share_kw',    type: 'read',  label: 'SUM(select_count) GROUP BY keyword' },
  { from: 'tbl_cat_map',      to: 'api_share_kw',    type: 'read',  label: 'LEFT JOIN → is_classified' },
  { from: 'tbl_search_log',   to: 'api_all_kw',      type: 'read',  label: 'SUM(select_count)' },
  { from: 'tbl_cat_map',      to: 'api_all_kw',      type: 'read',  label: 'LEFT JOIN → is_classified, pairs' },
  { from: 'tbl_categories',   to: 'api_all_kw',      type: 'read',  label: 'LEFT JOIN → category_color' },
  { from: 'tbl_cat_map',      to: 'api_cat_summary', type: 'read',  label: 'kw_count集計' },
  { from: 'tbl_categories',   to: 'api_cat_summary', type: 'read',  label: 'id, name, color' },
  { from: 'tbl_categories',   to: 'api_cat_groups',  type: 'read',  label: 'グループ＋カテゴリ' },

  // Tables → UI (direct)
  { from: 'tbl_chat_shares',  to: 'ui_history_modal',   type: 'read',  label: 'question, answer, model' },

  // APIs → UI
  { from: 'ui_history_modal', to: 'api_share_kw',        type: 'read',  label: 'shareId でキーワード取得' },
  { from: 'api_share_kw',     to: 'ui_chip_panel',       type: 'read',  label: 'keyword, count, is_classified' },
  { from: 'api_all_kw',       to: 'ui_classify_modal',   type: 'read',  label: 'keywords[]' },
  { from: 'api_cat_summary',  to: 'ui_classify_modal',   type: 'read',  label: 'categories[]' },
  { from: 'api_cat_groups',   to: 'ui_classify_modal',   type: 'read',  label: 'groups[]' },

  // UI → UI containment
  { from: 'ui_history_modal', to: 'ui_chip_panel',       type: 'note',  label: '内包' },

  // UI → Table (write)
  { from: 'ui_classify_modal', to: 'tbl_cat_map',        type: 'write', label: '分類登録・削除' },

  // Palette flow
  { from: 'ui_palette_modal', to: 'pal_cookie',          type: 'color', label: '保存 (max-age 1年)' },
  { from: 'pal_cookie',       to: 'pal_css',             type: 'color', label: 'applyKwPaletteToDom()' },
  { from: 'pal_css',          to: 'ui_chip_panel',       type: 'color', label: '.hist-kw-chip-cls/unc/active' },
  { from: 'pal_css',          to: 'ui_classify_modal',   type: 'color', label: '.kw-kw-classified / sq-kw-badge-active' },

  // Unused table note
  { from: 'tbl_multi_labels', to: 'api_share_kw',        type: 'note',  label: '旧実装（現在未使用）' },
];

// ─────────────────────────────────────────────────────────
// CANVAS & LAYOUT
// ─────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = window.innerWidth, H = window.innerHeight;
canvas.width = W; canvas.height = H;

function nodeW() { return Math.min(155, W * 0.115); }
const NODE_H = 44;

function layoutNodes() {
  const nw = nodeW();
  NODES.forEach(n => {
    n.x = n.fx * W;
    n.y = n.fy * H;
    n.w = nw;
    n.h = NODE_H;
  });
}
layoutNodes();

const nodeMap = {};
NODES.forEach(n => nodeMap[n.id] = n);

const edgesFrom = {}, edgesTo = {};
NODES.forEach(n => { edgesFrom[n.id] = []; edgesTo[n.id] = []; });
EDGES.forEach(e => { edgesFrom[e.from].push(e); edgesTo[e.to].push(e); });

// ─────────────────────────────────────────────────────────
// CAMERA
// ─────────────────────────────────────────────────────────
const T = { x: 0, y: 0, k: 1 };
function s2w(x, y) { return { x: (x - T.x) / T.k, y: (y - T.y) / T.k }; }

// ─────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────
let highlightId = null;

function hitNode(wx, wy) {
  for (let i = NODES.length - 1; i >= 0; i--) {
    const n = NODES[i];
    if (wx >= n.x - n.w/2 && wx <= n.x + n.w/2 &&
        wy >= n.y - n.h/2 && wy <= n.y + n.h/2) return n;
  }
  return null;
}

function getHighlightedIds() {
  if (!highlightId) return null;
  const ids = new Set([highlightId]);
  EDGES.forEach(e => {
    if (e.from === highlightId) ids.add(e.to);
    if (e.to   === highlightId) ids.add(e.from);
  });
  return ids;
}

function drawRoundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function edgeEndpoints(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  const ux = dx/len, uy = dy/len;
  function clip(n, ux, uy, inset) {
    const scaleX = ux !== 0 ? (n.w/2 + inset) / Math.abs(ux) : Infinity;
    const scaleY = uy !== 0 ? (n.h/2 + inset) / Math.abs(uy) : Infinity;
    const s = Math.min(scaleX, scaleY);
    return { x: n.x + ux * s, y: n.y + uy * s };
  }
  const ap = clip(a,  ux,  uy, 0);
  const bp = clip(b, -ux, -uy, 6);
  return { ax: ap.x, ay: ap.y, bx: bp.x, by: bp.y, ux, uy };
}

const edgeBundles = new Map();
EDGES.forEach((e, i) => {
  const key = [e.from, e.to].sort().join('|');
  if (!edgeBundles.has(key)) edgeBundles.set(key, []);
  edgeBundles.get(key).push(i);
});
const edgeOffsets = {};
EDGES.forEach((e, i) => {
  const key = [e.from, e.to].sort().join('|');
  const arr = edgeBundles.get(key);
  const pos = arr.indexOf(i);
  edgeOffsets[i] = (pos - (arr.length - 1) / 2) * 12;
});

function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(T.x, T.y);
  ctx.scale(T.k, T.k);

  const hlIds = getHighlightedIds();

  const bands = [
    { fy: 0.80, color: '#388bfd08', label: 'D1 テーブル' },
    { fy: 0.55, color: '#3fb95008', label: 'API / 配色設定' },
    { fy: 0.20, color: '#a371f708', label: 'UI モーダル・パネル' },
  ];
  bands.forEach(b => {
    const cy = b.fy * H;
    ctx.fillStyle = b.color;
    ctx.fillRect(-2000, cy - NODE_H/2 - 24, 6000, NODE_H + 48);
    if (T.k > 0.3) {
      ctx.font = '11px system-ui';
      ctx.fillStyle = '#ffffff12';
      ctx.textAlign = 'left';
      ctx.fillText(b.label, 20 / T.k, cy + 5);
    }
  });

  EDGES.forEach((e, i) => {
    const a = nodeMap[e.from], b = nodeMap[e.to];
    if (!a || !b) return;
    const et = EDGE_TYPES[e.type];
    const isHl = hlIds && (hlIds.has(e.from) || hlIds.has(e.to));
    const dimmed = hlIds && !isHl;

    ctx.globalAlpha = dimmed ? 0.07 : (isHl ? 1 : 0.50);
    ctx.strokeStyle = et.color;
    ctx.lineWidth = isHl ? 2 : 1.5;
    ctx.setLineDash(et.dash);

    const { ax, ay, bx, by, ux, uy } = edgeEndpoints(a, b);
    const perp = edgeOffsets[i];
    const mx = (ax + bx) / 2 + uy * perp;
    const my = (ay + by) / 2 - ux * perp;

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(mx, my, bx, by);
    ctx.stroke();

    if (e.type !== 'note') {
      const angle = Math.atan2(by - my, bx - mx);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - 9 * Math.cos(angle - 0.38), by - 9 * Math.sin(angle - 0.38));
      ctx.lineTo(bx - 9 * Math.cos(angle + 0.38), by - 9 * Math.sin(angle + 0.38));
      ctx.closePath();
      ctx.fillStyle = et.color;
      ctx.fill();
    }

    if (T.k > 0.5 && (isHl || !hlIds)) {
      const lx = mx;
      const ly = my - 6;
      ctx.save();
      ctx.font = Math.max(8, 9 / T.k * 0.6) + 'px system-ui';
      ctx.fillStyle = isHl ? et.color : '#6e7681';
      ctx.globalAlpha = isHl ? 0.9 : 0.50;
      ctx.textAlign = 'center';
      const words = (e.label || '').split(' ');
      if (words.length <= 3 || T.k > 0.85) {
        ctx.fillText(e.label || '', lx, ly);
      } else {
        const mid = Math.ceil(words.length / 2);
        ctx.fillText(words.slice(0, mid).join(' '), lx, ly - 6);
        ctx.fillText(words.slice(mid).join(' '), lx, ly + 6);
      }
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  });

  NODES.forEach(n => {
    const t = TYPES[n.type];
    const isHl = hlIds ? hlIds.has(n.id) : false;
    const dimmed = hlIds && !isHl;
    const isSel = n.id === highlightId;

    ctx.globalAlpha = dimmed ? 0.18 : 1;

    if (isSel) { ctx.shadowColor = t.color; ctx.shadowBlur = 18; }

    drawRoundRect(n.x - n.w/2, n.y - n.h/2, n.w, n.h, 8);
    ctx.fillStyle = isHl ? t.color + '30' : t.fill;
    ctx.fill();
    ctx.strokeStyle = isSel ? t.color : (isHl ? t.color + 'cc' : t.color + '66');
    ctx.lineWidth = isSel ? 2 : 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (T.k > 0.25) {
      const badgeSz = Math.max(7, 8.5 / T.k * 0.6);
      ctx.font = 'bold ' + badgeSz + 'px system-ui';
      ctx.fillStyle = t.color + 'aa';
      ctx.textAlign = 'left';
      ctx.fillText(t.label, n.x - n.w/2 + 6, n.y - n.h/2 + badgeSz + 3);

      const fontSize = Math.max(9, 11 / T.k * 0.6);
      ctx.font = fontSize + "px 'Consolas', monospace";
      ctx.fillStyle = isHl ? '#e6edf3' : (dimmed ? '#6e7681' : '#c9d1d9');
      ctx.textAlign = 'center';
      let txt = n.label;
      const maxW = n.w - 12;
      while (ctx.measureText(txt).width > maxW && txt.length > 4) {
        txt = txt.slice(0, -4) + '…';
      }
      ctx.fillText(txt, n.x, n.y + 5);
    }

    ctx.globalAlpha = 1;
  });

  ctx.restore();
}

function loop() { render(); requestAnimationFrame(loop); }
loop();

// ─────────────────────────────────────────────────────────
// INTERACTION
// ─────────────────────────────────────────────────────────
let isPanning = false, panStart = null, panMoved = false;

canvas.addEventListener('mousedown', e => {
  isPanning = true; panMoved = false;
  panStart = { x: e.clientX - T.x, y: e.clientY - T.y };
  canvas.classList.add('dragging');
});
canvas.addEventListener('mousemove', e => {
  if (isPanning && panStart) {
    const nx = e.clientX - panStart.x, ny = e.clientY - panStart.y;
    if (Math.abs(nx - T.x) > 3 || Math.abs(ny - T.y) > 3) panMoved = true;
    T.x = nx; T.y = ny;
  }
  const { x: wx, y: wy } = s2w(e.clientX, e.clientY);
  const hit = hitNode(wx, wy);
  const tip = document.getElementById('tooltip');
  if (hit) {
    tip.style.display = 'block';
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top  = (e.clientY - 10) + 'px';
    tip.innerHTML  = '<strong>' + hit.label + '</strong><br><span style="color:#8b949e;font-size:11px">' +
                     (hit.desc || '').slice(0, 120) + '…</span>';
  } else {
    tip.style.display = 'none';
  }
});
canvas.addEventListener('mouseup', e => {
  isPanning = false; panStart = null;
  canvas.classList.remove('dragging');
  if (!panMoved) {
    const { x: wx, y: wy } = s2w(e.clientX, e.clientY);
    const hit = hitNode(wx, wy);
    if (hit) {
      highlightId = highlightId === hit.id ? null : hit.id;
      showInfoPanel(highlightId ? hit : null);
      if (highlightId && hit.type === 'table' && hit.tableName) {
        openTableModal(hit);
      }
    } else {
      highlightId = null; showInfoPanel(null);
    }
  }
});
canvas.addEventListener('mouseleave', () => { isPanning = false; panStart = null; });

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const f = e.deltaY > 0 ? 0.85 : 1.18;
  T.x = e.clientX - (e.clientX - T.x) * f;
  T.y = e.clientY - (e.clientY - T.y) * f;
  T.k = Math.min(4, Math.max(0.15, T.k * f));
}, { passive: false });

let touchPanStart = null, pinchDist0 = null, touchStartPos = null, touchMoved = false;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (e.touches.length === 1) {
    touchPanStart = { x: e.touches[0].clientX - T.x, y: e.touches[0].clientY - T.y };
    touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchMoved = false;
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    pinchDist0 = Math.sqrt(dx*dx + dy*dy);
    touchStartPos = null;
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 1 && touchPanStart) {
    const nx = e.touches[0].clientX - touchPanStart.x;
    const ny = e.touches[0].clientY - touchPanStart.y;
    if (touchStartPos && (Math.abs(nx - T.x) > 5 || Math.abs(ny - T.y) > 5)) touchMoved = true;
    T.x = nx; T.y = ny;
  } else if (e.touches.length === 2 && pinchDist0) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const d = Math.sqrt(dx*dx + dy*dy);
    const f = d / pinchDist0; pinchDist0 = d;
    const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    T.x = mx - (mx - T.x) * f;
    T.y = my - (my - T.y) * f;
    T.k = Math.min(4, Math.max(0.15, T.k * f));
  }
}, { passive: false });
canvas.addEventListener('touchend', e => {
  if (!touchMoved && touchStartPos && e.changedTouches.length === 1) {
    const t = e.changedTouches[0];
    const { x: wx, y: wy } = s2w(t.clientX, t.clientY);
    const hit = hitNode(wx, wy);
    if (hit) {
      highlightId = highlightId === hit.id ? null : hit.id;
      showInfoPanel(highlightId ? hit : null);
      if (highlightId && hit.type === 'table' && hit.tableName) {
        openTableModal(hit);
      }
    } else {
      highlightId = null; showInfoPanel(null);
    }
  }
  touchPanStart = null; pinchDist0 = null; touchStartPos = null; touchMoved = false;
});

// ─────────────────────────────────────────────────────────
// INFO PANEL
// ─────────────────────────────────────────────────────────
let currentTableNode = null;

function showInfoPanel(node) {
  const panel = document.getElementById('info');
  const openBtn = document.getElementById('info-open-table');
  if (!node) {
    panel.style.display = 'none';
    currentTableNode = null;
    return;
  }
  panel.style.display = 'block';
  document.getElementById('info-name').textContent = node.label;
  document.getElementById('info-desc').textContent = node.desc || '';

  if (node.type === 'table' && node.tableName) {
    currentTableNode = node;
    openBtn.style.display = 'block';
    openBtn.textContent = 'テーブルデータを表示 → ' + node.tableName;
  } else {
    currentTableNode = null;
    openBtn.style.display = 'none';
  }

  const conns = document.getElementById('info-conns');
  conns.innerHTML = '';
  const to   = edgesTo[node.id]   || [];
  const from = edgesFrom[node.id] || [];
  if (to.length > 0) {
    const h = document.createElement('div');
    h.className = 'conn-label'; h.textContent = '← 参照元:';
    conns.appendChild(h);
    to.forEach(e => {
      const d = document.createElement('div');
      d.className = 'conn-item';
      d.textContent = '  ' + e.from + (e.label ? '  (' + e.label + ')' : '');
      d.addEventListener('click', () => { const n = nodeMap[e.from]; if (n) { highlightId = n.id; showInfoPanel(n); } });
      conns.appendChild(d);
    });
  }
  if (from.length > 0) {
    const h = document.createElement('div');
    h.className = 'conn-label'; h.style.marginTop = '6px'; h.textContent = '→ 参照先:';
    conns.appendChild(h);
    from.forEach(e => {
      const d = document.createElement('div');
      d.className = 'conn-item';
      d.textContent = '  ' + e.to + (e.label ? '  (' + e.label + ')' : '');
      d.addEventListener('click', () => { const n = nodeMap[e.to]; if (n) { highlightId = n.id; showInfoPanel(n); } });
      conns.appendChild(d);
    });
  }
}

document.getElementById('info-open-table').addEventListener('click', () => {
  if (currentTableNode) openTableModal(currentTableNode);
});

// ─────────────────────────────────────────────────────────
// TABLE DATA MODAL
// ─────────────────────────────────────────────────────────
const tableModal    = document.getElementById('table-modal');
const tableModalInner = document.getElementById('table-modal-inner');

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function openTableModal(node) {
  tableModal.style.display = 'block';
  document.getElementById('table-modal-title').textContent = node.tableName;
  document.getElementById('table-modal-desc').textContent = '';
  document.getElementById('table-modal-body').innerHTML = '<p style="color:#8b949e;padding:20px 0">読み込み中…</p>';
  document.getElementById('table-modal-meta').textContent = '';

  let data;
  try {
    const res = await fetch('/api/status/tables/' + encodeURIComponent(node.tableName) + '/rows');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (err) {
    document.getElementById('table-modal-body').innerHTML =
      '<p style="color:#f85149;padding:20px 0">取得失敗: ' + escHtml(err.message) +
      '<br><span style="color:#8b949e;font-size:11px">このページが /kw-architecture ルートとして配信されていない場合、' +
      'fetch は認証を通過できません。Worker へのデプロイ後にご利用ください。</span></p>';
    return;
  }

  if (data.error) {
    document.getElementById('table-modal-body').innerHTML =
      '<p style="color:#f85149;padding:20px 0">エラー: ' + escHtml(data.error) + '</p>';
    return;
  }

  document.getElementById('table-modal-desc').textContent = data.description || '';

  const cols = data.columns || [];
  const rows = data.rows || [];
  const keyInfo = data.columnKeyInfo || {};

  if (cols.length === 0) {
    document.getElementById('table-modal-body').innerHTML =
      '<p style="color:#8b949e;padding:20px 0">カラム情報が取得できませんでした。</p>';
    return;
  }

  const KEY_LABELS = { PK:'PK', FK:'FK', UK:'UK', IDX:'IDX' };
  let html = '<table><thead><tr>';
  cols.forEach(col => {
    const k = keyInfo[col];
    const badge = k ? ' <span class="key-badge key-' + escHtml(k) + '">' + escHtml(KEY_LABELS[k] || k) + '</span>' : '';
    html += '<th>' + escHtml(col) + badge + '</th>';
  });
  html += '</tr></thead><tbody>';

  if (rows.length === 0) {
    html += '<tr><td colspan="' + cols.length + '" style="color:#6e7681;text-align:center;padding:16px">データなし</td></tr>';
  } else {
    rows.forEach(row => {
      html += '<tr>';
      cols.forEach(col => {
        const v = row[col];
        html += '<td title="' + escHtml(String(v ?? '')) + '">' + escHtml(String(v ?? '')) + '</td>';
      });
      html += '</tr>';
    });
  }
  html += '</tbody></table>';

  document.getElementById('table-modal-body').innerHTML = html;
  document.getElementById('table-modal-meta').textContent =
    rows.length + ' 件表示（最大 ' + (data.limit || '?') + ' 件）';
}

document.getElementById('table-modal-close').addEventListener('click', () => {
  tableModal.style.display = 'none';
});
tableModal.addEventListener('click', e => {
  if (e.target === tableModal) tableModal.style.display = 'none';
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') tableModal.style.display = 'none';
});

// ─────────────────────────────────────────────────────────
// CONTROLS
// ─────────────────────────────────────────────────────────
function fitAll() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  NODES.forEach(n => {
    minX = Math.min(minX, n.x - n.w/2);
    minY = Math.min(minY, n.y - n.h/2);
    maxX = Math.max(maxX, n.x + n.w/2);
    maxY = Math.max(maxY, n.y + n.h/2);
  });
  const pw = maxX - minX + 120, ph = maxY - minY + 120;
  const k = Math.min(W / pw, H / ph, 2);
  T.k = k;
  T.x = W/2 - ((minX + maxX)/2) * k;
  T.y = H/2 - ((minY + maxY)/2) * k;
}

document.getElementById('btn-fit').addEventListener('click', fitAll);
document.getElementById('btn-reset').addEventListener('click', () => {
  highlightId = null; showInfoPanel(null); fitAll();
});

window.addEventListener('resize', () => {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  layoutNodes();
  fitAll();
});

fitAll();
</script>
</body>
</html>
`;
}
