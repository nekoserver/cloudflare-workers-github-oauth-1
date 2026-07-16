import { HERITAGE_LIST } from '../data/heritageList';
import { RAIL_LINES } from '../data/railLines';
import { AIRPORT_LIST } from '../data/airports';
import {
  renderKeywordClassifyPanelCss,
  renderKeywordClassifyPanelJs,
  renderKeywordChipsContainerHtml,
  renderKeywordEditToggleButtonHtml,
  renderHighlightToggleButtonHtml,
} from '../utils/keywordClassifyPanel';

const HIST_DETAIL_KW_TOGGLE_BTN_ID = 'hist-detail-kw-edit-btn';
const HIST_DETAIL_KW_HIGHLIGHT_BTN_ID = 'hist-detail-kw-highlight-btn';
const HIST_DETAIL_KW_CHIPS_CONTAINER_ID = 'hist-detail-keyword-chips';

export function getHeritageAccessPage(userId: string): string {
  void userId;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>世界遺産アクセスランキング</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d1117;color:#c9d1d9;min-height:100vh}
header{background:#161b22;border-bottom:1px solid #30363d;padding:12px 20px;display:flex;align-items:center;gap:12px}
header h1{font-size:16px;font-weight:700;color:#e6edf3}
header a{color:#58a6ff;font-size:12px;text-decoration:none;margin-left:auto}
.controls{padding:14px 20px;background:#161b22;border-bottom:1px solid #21262d;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.ctrl-label{font-size:12px;color:#8b949e}
select,input[type=number]{background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#c9d1d9;font-size:12px;padding:5px 8px;outline:none}
select:focus,input:focus{border-color:#58a6ff}
button{background:#1f6feb;border:none;border-radius:6px;color:#fff;font-size:12px;padding:6px 14px;cursor:pointer;font-family:inherit}
button:hover{background:#388bfd}
button:disabled{background:#21262d;color:#484f58;cursor:default}
.summary{padding:10px 20px;font-size:12px;color:#8b949e}
.summary strong{color:#c9d1d9}
table{width:100%;border-collapse:collapse;font-size:12px}
thead th{background:#161b22;color:#8b949e;font-weight:600;padding:8px 10px;border-bottom:1px solid #30363d;white-space:nowrap;position:sticky;top:0;z-index:2}
thead th.num{text-align:right}
tbody tr{border-bottom:1px solid #21262d;transition:background .1s}
tbody tr:not(.accordion-row):not(.group-head-tr){cursor:pointer}
tbody tr:not(.accordion-row):not(.group-head-tr):hover{background:#161b22}
tbody tr.row-open{background:#1a2030}
td{padding:7px 10px;vertical-align:middle}
td.rank{color:#484f58;font-size:11px;text-align:right;width:36px}
td.flag{font-size:16px;text-align:center;width:28px}
td.city{font-weight:600;color:#e6edf3}
td.country{color:#8b949e;font-size:11px}
td.bar-cell{width:160px}
td.count{text-align:right;font-weight:700;color:#3fb950;min-width:44px}
td.nearest{text-align:right;color:#8b949e;font-size:11px;min-width:56px}
td.pop{text-align:right;color:#8b949e;font-size:11px;min-width:64px}
.bar{height:8px;background:#1f6feb;border-radius:3px;min-width:2px}
.tbl-wrap{overflow-x:auto;overflow-y:auto;max-height:calc(100vh - 160px)}
.dist-badge{display:inline-block;background:#1f3a5c;color:#58a6ff;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700}
.group-head{background:#161b22;color:#8b949e;font-size:11px;padding:6px 10px;border-bottom:1px solid #21262d;font-weight:600}
.spinner{text-align:center;padding:40px;color:#484f58}
.top1 td.city{color:#f0c040}
.top2 td.city{color:#b0c4de}
.top3 td.city{color:#cd7f32}
.mode-tabs{display:flex;gap:0;margin-left:8px}
.mode-tab{background:#0d1117;border:1px solid #30363d;color:#8b949e;font-size:11px;padding:5px 10px;cursor:pointer;font-family:inherit}
.mode-tab:first-child{border-radius:6px 0 0 6px}
.mode-tab:last-child{border-radius:0 6px 6px 0;border-left:none}
.mode-tab.active{background:#1f6feb;border-color:#1f6feb;color:#fff}
#sel-country{max-width:160px}
.accordion-row td{padding:0;border-bottom:1px solid #30363d}
.accordion-inner{padding:10px 16px 14px 48px;background:#0d1117}
.acc-heritage-list{display:flex;flex-direction:column;gap:4px;max-height:320px;overflow-y:auto}
.acc-row{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #21262d;font-size:12px}
.acc-row:last-child{border-bottom:none}
.acc-num{color:#484f58;font-size:10px;width:22px;text-align:right;flex-shrink:0}
.acc-country-flag{font-size:14px;flex-shrink:0;width:20px;text-align:center}
.acc-emoji{font-size:14px;flex-shrink:0;width:20px;text-align:center}
.acc-name{flex:1;color:#c9d1d9}
.acc-name-wrap{display:flex;align-items:center;gap:4px;flex:1;min-width:0}
.acc-topic-badge{display:inline-block;font-size:10px;padding:1px 5px;border-radius:10px;background:rgba(46,160,67,.18);color:#3fb950;border:1px solid rgba(63,185,80,.3);white-space:nowrap;flex-shrink:0;cursor:pointer}
.acc-topic-badge:hover{background:rgba(46,160,67,.35)}
.acc-dist{color:#58a6ff;font-size:11px;font-weight:600;white-space:nowrap;min-width:56px;text-align:right;margin-left:auto}
.acc-loading{color:#484f58;font-size:12px;padding:8px 0}
.acc-toggle{font-size:10px;color:#484f58;margin-left:4px;flex-shrink:0}
.acc-ai-panel{margin-top:6px;padding:8px 0 4px;border-top:1px solid #21262d}
.acc-ai-label{font-size:11px;color:#8b949e;margin-bottom:6px}
.acc-ai-btns{display:flex;flex-wrap:wrap;gap:6px}
.acc-ai-btn{background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#c9d1d9;font-size:11px;padding:4px 10px;cursor:pointer;font-family:inherit;transition:border-color .15s,color .15s,background .15s}
.acc-ai-btn:hover{border-color:#58a6ff;color:#58a6ff}
.acc-ai-btn:disabled{color:#484f58;cursor:default;border-color:#21262d}
.acc-ai-btn.answered{background:#0e2a1a;border-color:#2ea043;color:#3fb950}
.ai-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);align-items:center;justify-content:center}
.ai-modal-overlay.open{display:flex}
.ai-modal{background:#0d1117;border:1px solid #30363d;border-radius:10px;width:min(92vw,560px);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.9)}
.ai-modal-head{padding:12px 16px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:8px;flex-shrink:0}
.ai-modal-title{font-size:13px;font-weight:700;flex:1;color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ai-modal-close{background:none;border:none;color:#8b949e;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1}
.ai-modal-body{overflow-y:auto;padding:16px;font-size:13px;line-height:1.7;color:#c9d1d9;white-space:pre-wrap;word-break:break-word}
.hist-detail-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);align-items:center;justify-content:center}
.hist-detail-overlay.open{display:flex}
.hist-detail-modal{background:#0d1117;border:1px solid #30363d;border-radius:10px;width:min(92vw,640px);max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.9)}
.hist-detail-head{padding:12px 16px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:8px;flex-shrink:0}
.hist-detail-title{font-size:13px;font-weight:700;flex:1;color:#e6edf3}
.hist-detail-close{background:none;border:none;color:#8b949e;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1}
.hist-detail-chat{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.hist-detail-bubble{max-width:88%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.hist-detail-bubble.user{align-self:flex-start;background:#161b22;border:1px solid #30363d;color:#c9d1d9;border-bottom-left-radius:3px}
.hist-detail-bubble.assistant{align-self:flex-end;background:#1f3a5c;color:#e6edf3;border-bottom-right-radius:3px}
.hist-detail-foot{flex-shrink:0;padding:9px 16px;border-top:1px solid #21262d;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px;color:#8b949e}
${renderKeywordClassifyPanelCss()}
.acc-name-link{color:#58a6ff;text-decoration:none;cursor:pointer;background:none;border:none;font:inherit;padding:0;text-align:left}
.acc-name-link:hover{color:#79c0ff}
.acc-kw-badge{display:inline-block;font-size:10px;padding:1px 6px;border-radius:10px;background:transparent;color:#a371f7;border:1px solid #a371f7;white-space:nowrap;flex-shrink:0;cursor:pointer}
.acc-kw-badge:hover{background:rgba(163,113,247,.15)}
.kw-panel-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);align-items:center;justify-content:center}
.kw-panel-overlay.open{display:flex}
.kw-panel{background:#0d1117;border:1px solid #30363d;border-radius:10px;width:min(92vw,480px);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.9)}
.kw-panel-head{padding:12px 16px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:8px;flex-shrink:0}
.kw-panel-title{font-size:13px;font-weight:700;flex:1;color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kw-panel-close{background:none;border:none;color:#8b949e;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1}
.kw-panel-body{overflow-y:auto;padding:12px 16px;line-height:1}
.kw-panel-item{display:inline-block;cursor:pointer;background:#161b22;border:1px solid #21262d;border-radius:10px;font-size:11px;padding:3px 11px;margin:2px;white-space:nowrap;color:#c9d1d9}
.kw-panel-item:hover{background:#21262d;border-color:#a371f7;color:#a371f7}
.kw-panel-empty{color:#484f58;font-size:12px;padding:16px 0;text-align:center}
.hcl-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);align-items:center;justify-content:center}
.hcl-modal-overlay.open{display:flex}
.hcl-modal{background:#0d1117;border:1px solid #30363d;border-radius:10px;width:min(92vw,860px);max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.9)}
.hcl-modal-head{padding:12px 16px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:8px;flex-shrink:0}
.hcl-modal-flag{font-size:18px;flex-shrink:0;line-height:1}
.hcl-modal-title{font-size:13px;font-weight:700;flex:1;color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hcl-modal-close{background:none;border:none;color:#8b949e;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1}
.hcl-tabs{display:flex;gap:0;border-bottom:1px solid #30363d;flex-shrink:0;overflow-x:auto}
.hcl-tab{background:none;border:none;border-bottom:2px solid transparent;color:#8b949e;font-size:11px;padding:7px 14px;cursor:pointer;white-space:nowrap;font-family:inherit;transition:color .15s,border-color .15s;display:flex;align-items:center;gap:5px}
.hcl-tab:hover{color:#c9d1d9}
.hcl-tab.active{color:#58a6ff;border-bottom-color:#58a6ff}
.hcl-modal-body{overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px}
.hcl-entry{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.hcl-entry-q{font-size:12px;color:#8b949e;line-height:1.5}
.hcl-entry-a{font-size:12px;color:#c9d1d9;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:160px;overflow-y:auto}
.hcl-entry-meta{font-size:11px;color:#484f58;display:flex;gap:8px}
.hcl-empty{color:#484f58;font-size:12px;padding:16px 0;text-align:center}
.cap-dist-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);align-items:center;justify-content:center}
.cap-dist-overlay.open{display:flex}
.cap-dist-modal{background:#0d1117;border:1px solid #30363d;border-radius:10px;width:min(96vw,860px);max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.9)}
.cap-dist-head{padding:12px 16px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:8px;flex-shrink:0}
.cap-dist-title{font-size:14px;font-weight:700;flex:1;color:#e6edf3}
.cap-dist-close{background:none;border:none;color:#8b949e;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1}
.cap-dist-tabs{display:flex;gap:0;border-bottom:1px solid #30363d;flex-shrink:0}
.cap-dist-tab{background:none;border:none;border-bottom:2px solid transparent;color:#8b949e;font-size:12px;padding:8px 16px;cursor:pointer;font-family:inherit;transition:color .15s,border-color .15s}
.cap-dist-tab.active{color:#58a6ff;border-bottom-color:#58a6ff}
.cap-dist-body{overflow:auto;padding:16px;flex:1}
.cap-matrix{border-collapse:collapse;font-size:11px;white-space:nowrap}
.cap-matrix th{background:#161b22;padding:6px 8px;color:#8b949e;font-weight:600;position:sticky;top:0;z-index:1;border:1px solid #21262d}
.cap-matrix th.row-h{position:sticky;left:0;z-index:2;background:#161b22}
.cap-matrix td{padding:5px 8px;text-align:right;border:1px solid #21262d}
.cap-matrix td.self{background:#1a1a1a;color:#484f58;text-align:center}
.cap-matrix td.row-head{font-weight:600;color:#e6edf3;text-align:left;position:sticky;left:0;background:#161b22;border-right:2px solid #30363d;z-index:1}
.dist-near{color:#3fb950}
.dist-mid{color:#d4a017}
.dist-far{color:#f85149}
.rail-hr-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);align-items:center;justify-content:center}
.rail-hr-overlay.open{display:flex}
.rail-hr-modal{background:#0d1117;border:1px solid #30363d;border-radius:10px;width:min(96vw,720px);max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.9)}
.rail-hr-head{padding:12px 16px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:8px;flex-shrink:0}
.rail-hr-title{font-size:14px;font-weight:700;flex:1;color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rail-hr-close{background:none;border:none;color:#8b949e;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1}
.rail-hr-body{overflow:auto;padding:12px 16px;flex:1}
.rail-hr-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #21262d;cursor:pointer}
.rail-hr-row:last-child{border-bottom:none}
.rail-hr-row:hover{background:#161b22}
.rail-hr-rank{color:#484f58;font-size:11px;width:24px;flex-shrink:0;text-align:right}
.rail-hr-flag{font-size:16px;flex-shrink:0}
.rail-hr-names{flex:1;min-width:0;overflow:hidden}
.rail-hr-line-primary{font-size:13px;font-weight:600;color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rail-hr-station-sub{font-size:11px;color:#8b949e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rail-hr-count-wrap{display:flex;align-items:center;gap:6px;flex-shrink:0}
.rail-hr-count{color:#3fb950;font-weight:700;font-size:13px;min-width:20px;text-align:right}
.rail-hr-acc{padding:2px 0 8px 32px}
.rail-hr-h-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #21262d;font-size:12px}
.rail-hr-h-row:last-child{border-bottom:none}
.rail-hr-h-name{flex:1;color:#c9d1d9}
.rail-hr-h-flag,.rail-hr-h-icon{font-size:13px}
.rail-hr-h-dist{color:#58a6ff;font-size:11px;font-weight:600;flex-shrink:0}
.eu-from-wrap{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.eu-from-label{font-size:12px;color:#8b949e}
.eu-from-select{background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#c9d1d9;font-size:12px;padding:5px 8px;outline:none}
.eu-dist-list{display:flex;flex-direction:column;gap:3px}
.eu-dist-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:5px;border:1px solid #21262d;font-size:12px}
.eu-dist-row:hover{background:#161b22}
.eu-dist-rank{color:#484f58;font-size:10px;width:24px;text-align:right;flex-shrink:0}
.eu-dist-flag{font-size:14px;flex-shrink:0}
.eu-dist-name{flex:1;color:#e6edf3}
.eu-dist-bar-wrap{width:80px;flex-shrink:0}
.eu-dist-bar{height:6px;border-radius:3px;background:#1f6feb;min-width:2px}
.eu-dist-km{font-weight:700;min-width:72px;text-align:right;font-size:11px}
.summary-row{display:flex;align-items:center;gap:8px;padding:0 20px}
.summary-row .summary{padding:10px 0}
.hist-side-toggle-btn{background:#21262d;border:1px solid #30363d;color:#8b949e;border-radius:6px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;flex-shrink:0;font-family:inherit}
.hist-side-toggle-btn:hover{color:#c9d1d9;border-color:#58a6ff}
.hist-side-toggle-btn.active{background:#1f6feb;border-color:#1f6feb;color:#fff}
.ranking-body{position:relative;min-height:calc(100vh - 160px)}
.hist-side{display:none;position:absolute;left:0;top:0;bottom:0;width:min(85vw,300px);background:#0d1117;border-right:1px solid #30363d;flex-direction:column;box-shadow:4px 0 24px rgba(0,0,0,.7)}
.hist-side.open{display:flex}
.hist-side-head{padding:10px 12px;border-bottom:1px solid #21262d;flex-shrink:0}
.hist-side-search-wrap{position:relative}
.hist-side-search{width:100%;padding:7px 28px 7px 9px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;font-size:12px;font-family:inherit;outline:none}
.hist-side-search:focus{border-color:#58a6ff}
.hist-side-search-clear{position:absolute;right:7px;top:50%;transform:translateY(-50%);background:none;border:none;color:#8b949e;cursor:pointer;font-size:13px;display:none;padding:0 2px;line-height:1}
.hist-side-search-clear.visible{display:block}
.hist-side-status{font-size:11px;color:#8b949e;padding:6px 12px 4px;flex-shrink:0}
.hist-side-results{flex:1;overflow-y:auto}
.hist-side-item{padding:8px 12px;cursor:pointer;border-bottom:1px solid #21262d;border-left:3px solid transparent}
.hist-side-item:hover{background:#161b22}
.hist-side-num{font-size:10px;color:#484f58;font-weight:600}
.hist-side-q{font-size:12px;color:#c9d1d9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:2px 0}
.hist-side-meta{font-size:10px;color:#8b949e}
.city-dist-menu-btn{background:var(--btn-bg,#21262d);border:1px solid var(--border,#30363d);color:var(--fg,#e6edf3);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit}
.city-dist-candidates{display:none;position:fixed;background:#161b22;border:1px solid #30363d;border-radius:6px;max-height:240px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.city-dist-candidates.open{display:block}
.city-dist-candidate-row{padding:6px 10px;font-size:12px;color:#c9d1d9;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.city-dist-candidate-row:hover{background:#21262d}
.city-dist-menu{display:none;position:fixed;background:#161b22;border:1px solid #30363d;border-radius:6px;min-width:170px;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.city-dist-menu.open{display:block}
.city-dist-menu-item{padding:8px 12px;font-size:12px;color:#c9d1d9;cursor:pointer;white-space:nowrap;display:block;text-decoration:none;font-family:inherit;background:none;border:none;width:100%;text-align:left}
.city-dist-menu-item:hover{background:#21262d}
</style>
</head>
<body>
<header>
  <span style="font-size:20px">🗺️</span>
  <h1>世界遺産アクセスランキング</h1>
  <a href="/webgl-heritage">← 世界遺産地球儀</a>
</header>
<div class="controls">
  <span class="ctrl-label">距離上限</span>
  <select id="sel-dist">
    <option value="300">300 km</option>
    <option value="500">500 km</option>
    <option value="800">800 km</option>
    <option value="1000">1000 km</option>
    <option value="1500">1500 km</option>
    <option value="2000" selected>2000 km</option>
  </select>
  <select id="sel-limit" style="display:none">
    <option value="500" selected>500件</option>
  </select>
  <div class="mode-tabs">
    <button class="mode-tab active" id="tab-all">全都市</button>
    <button class="mode-tab" id="tab-country">国別グループ</button>
  </div>
  <button id="btn-cap-dist" style="margin-left:8px;background:var(--btn-bg,#21262d);border:1px solid var(--border,#30363d);color:var(--fg,#e6edf3);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px">🌍 首都間距離</button>
  <button id="btn-rail-hr" style="margin-left:8px;background:var(--btn-bg,#21262d);border:1px solid var(--border,#30363d);color:var(--fg,#e6edf3);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px">🚉 駅周辺の世界遺産</button>
  <button id="btn-airport-hr" style="margin-left:8px;background:var(--btn-bg,#21262d);border:1px solid var(--border,#30363d);color:var(--fg,#e6edf3);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px">🛬 周辺の世界遺産</button>
  <input type="text" id="city-dist-search" placeholder="世界遺産名 または 緯度,経度" autocomplete="off" style="margin-left:auto;background:var(--btn-bg,#21262d);border:1px solid var(--border,#30363d);color:var(--fg,#e6edf3);padding:6px 10px;border-radius:6px;font-size:13px;width:220px">
  <button type="button" class="city-dist-menu-btn" id="city-dist-menu-btn" style="display:none">🌆🔍</button>
</div>
<div class="city-dist-candidates" id="city-dist-candidates"></div>
<div class="city-dist-menu" id="city-dist-menu"></div>
<div id="ai-modal-overlay" class="ai-modal-overlay">
  <div class="ai-modal">
    <div class="ai-modal-head">
      <span class="ai-modal-title" id="ai-modal-title">AI回答</span>
      <span id="ai-modal-cache-badge" style="display:none;background:#0e2a1a;border:1px solid #2ea043;border-radius:4px;color:#3fb950;font-size:10px;padding:1px 7px;flex-shrink:0">キャッシュ</span>
      <button class="ai-modal-close" id="ai-modal-close">✕</button>
    </div>
    <div class="ai-modal-body" id="ai-modal-body"></div>
  </div>
</div>
<div id="hist-detail-overlay" class="hist-detail-overlay">
  <div class="hist-detail-modal">
    <div class="hist-detail-head">
      ${renderKeywordEditToggleButtonHtml(HIST_DETAIL_KW_TOGGLE_BTN_ID)}
      <span class="hist-detail-title" id="hist-detail-title">AIチャットの詳細プレビュー</span>
      <button class="hist-detail-close" id="hist-detail-close">✕</button>
    </div>
    <div class="hist-detail-chat" id="hist-detail-chat"></div>
    ${renderKeywordChipsContainerHtml(HIST_DETAIL_KW_CHIPS_CONTAINER_ID)}
    <div class="hist-detail-foot">
      <span style="display:flex;align-items:center;gap:6px;">
        ${renderHighlightToggleButtonHtml(HIST_DETAIL_KW_HIGHLIGHT_BTN_ID)}
        <span id="hist-detail-model"></span>
      </span>
      <span id="hist-detail-meta"></span>
    </div>
  </div>
</div>
<div id="heritage-chatlog-modal-overlay" class="hcl-modal-overlay">
  <div class="hcl-modal" id="heritage-chatlog-modal">
    <div class="hcl-modal-head">
      <span class="hcl-modal-flag" id="heritage-chatlog-modal-flag"></span>
      <span class="hcl-modal-title" id="heritage-chatlog-modal-title">AIチャット過去ログ</span>
      <button class="hcl-modal-close" id="heritage-chatlog-close">✕</button>
    </div>
    <div class="hcl-tabs" id="hcl-modal-tabs" style="display:none;"></div>
    <div class="hcl-modal-body" id="heritage-chatlog-modal-body"></div>
  </div>
</div>
<div id="heritage-kw-panel-overlay" class="kw-panel-overlay">
  <div class="kw-panel" id="heritage-kw-panel">
    <div class="kw-panel-head">
      <span class="kw-panel-title" id="heritage-kw-panel-title">キーワード</span>
      <button class="kw-panel-close" id="heritage-kw-panel-close">✕</button>
    </div>
    <div class="kw-panel-body" id="heritage-kw-panel-body"></div>
  </div>
</div>
<div id="cap-dist-overlay" class="cap-dist-overlay">
  <div class="cap-dist-modal">
    <div class="cap-dist-head">
      <span class="cap-dist-title">🌍 首都間距離</span>
      <button class="cap-dist-close" id="cap-dist-close">✕</button>
    </div>
    <div class="cap-dist-tabs">
      <button class="cap-dist-tab active" id="cap-tab-g7">G7（7カ国）</button>
      <button class="cap-dist-tab" id="cap-tab-europe">ヨーロッパ（45都市）</button>
    </div>
    <div class="cap-dist-body" id="cap-dist-body"></div>
  </div>
</div>
<div id="rail-hr-overlay" class="rail-hr-overlay">
  <div class="rail-hr-modal">
    <div class="rail-hr-head">
      <span class="rail-hr-title" id="rail-hr-title">🚉 駅周辺100km以内の世界遺産数ランキング</span>
      <button class="rail-hr-close" id="rail-hr-close">✕</button>
    </div>
    <div class="rail-hr-body" id="rail-hr-body"></div>
  </div>
</div>
<div id="airport-hr-overlay" class="rail-hr-overlay">
  <div class="rail-hr-modal">
    <div class="rail-hr-head">
      <span class="rail-hr-title" id="airport-hr-title">🛬 空港周辺300km以内の世界遺産数ランキング</span>
      <button class="rail-hr-close" id="airport-hr-close">✕</button>
    </div>
    <div class="rail-hr-body" id="airport-hr-body"></div>
  </div>
</div>
<div id="city-dist-overlay" class="rail-hr-overlay">
  <div class="rail-hr-modal">
    <div class="rail-hr-head">
      <span class="rail-hr-title" id="city-dist-title">📍 半径500km以内の都市</span>
      <button class="rail-hr-close" id="city-dist-close">✕</button>
    </div>
    <div class="rail-hr-body" id="city-dist-body"></div>
  </div>
</div>
<div class="summary-row">
  <button class="hist-side-toggle-btn" id="hist-side-toggle" title="AIチャット履歴を検索">📑</button>
  <div class="summary" id="summary"></div>
</div>
<div class="ranking-body" id="ranking-body">
  <div class="hist-side" id="hist-side">
    <div class="hist-side-head">
      <div class="hist-side-search-wrap">
        <input class="hist-side-search" id="hist-side-search" type="search" placeholder="AIチャット履歴を検索..." autocomplete="off">
        <button class="hist-side-search-clear" id="hist-side-clear">✕</button>
      </div>
    </div>
    <div class="hist-side-status" id="hist-side-status"></div>
    <div class="hist-side-results" id="hist-side-results"></div>
  </div>
  <div class="tbl-wrap" id="tbl-wrap">
    <div class="spinner">読み込み中...</div>
  </div>
</div>

<script>
var CC_FLAG = {
  AF:'🇦🇫',AL:'🇦🇱',DZ:'🇩🇿',AD:'🇦🇩',AO:'🇦🇴',AG:'🇦🇬',AR:'🇦🇷',AM:'🇦🇲',
  AU:'🇦🇺',AT:'🇦🇹',AZ:'🇦🇿',BS:'🇧🇸',BH:'🇧🇭',BD:'🇧🇩',BB:'🇧🇧',BY:'🇧🇾',
  BE:'🇧🇪',BZ:'🇧🇿',BJ:'🇧🇯',BT:'🇧🇹',BO:'🇧🇴',BA:'🇧🇦',BW:'🇧🇼',BR:'🇧🇷',
  BN:'🇧🇳',BG:'🇧🇬',BF:'🇧🇫',BI:'🇧🇮',CV:'🇨🇻',KH:'🇰🇭',CM:'🇨🇲',CA:'🇨🇦',
  CF:'🇨🇫',TD:'🇹🇩',CL:'🇨🇱',CN:'🇨🇳',CO:'🇨🇴',KM:'🇰🇲',CG:'🇨🇬',CD:'🇨🇩',
  CR:'🇨🇷',CI:'🇨🇮',HR:'🇭🇷',CU:'🇨🇺',CY:'🇨🇾',CZ:'🇨🇿',DK:'🇩🇰',DJ:'🇩🇯',
  DM:'🇩🇲',DO:'🇩🇴',EC:'🇪🇨',EG:'🇪🇬',SV:'🇸🇻',GQ:'🇬🇶',ER:'🇪🇷',EE:'🇪🇪',
  SZ:'🇸🇿',ET:'🇪🇹',FJ:'🇫🇯',FI:'🇫🇮',FR:'🇫🇷',GA:'🇬🇦',GM:'🇬🇲',GE:'🇬🇪',
  DE:'🇩🇪',GH:'🇬🇭',GR:'🇬🇷',GD:'🇬🇩',GT:'🇬🇹',GN:'🇬🇳',GW:'🇬🇼',GY:'🇬🇾',
  HT:'🇭🇹',HN:'🇭🇳',HU:'🇭🇺',IS:'🇮🇸',IN:'🇮🇳',ID:'🇮🇩',IR:'🇮🇷',IQ:'🇮🇶',
  IE:'🇮🇪',IL:'🇮🇱',IT:'🇮🇹',JM:'🇯🇲',JP:'🇯🇵',JO:'🇯🇴',KZ:'🇰🇿',KE:'🇰🇪',
  KI:'🇰🇮',KW:'🇰🇼',KG:'🇰🇬',LA:'🇱🇦',LV:'🇱🇻',LB:'🇱🇧',LS:'🇱🇸',LR:'🇱🇷',
  LY:'🇱🇾',LI:'🇱🇮',LT:'🇱🇹',LU:'🇱🇺',MG:'🇲🇬',MW:'🇲🇼',MY:'🇲🇾',MV:'🇲🇻',
  ML:'🇲🇱',MT:'🇲🇹',MH:'🇲🇭',MR:'🇲🇷',MU:'🇲🇺',MX:'🇲🇽',FM:'🇫🇲',MD:'🇲🇩',
  MC:'🇲🇨',MN:'🇲🇳',ME:'🇲🇪',MA:'🇲🇦',MZ:'🇲🇿',MM:'🇲🇲',NA:'🇳🇦',NR:'🇳🇷',
  NP:'🇳🇵',NL:'🇳🇱',NZ:'🇳🇿',NI:'🇳🇮',NE:'🇳🇪',NG:'🇳🇬',NO:'🇳🇴',OM:'🇴🇲',
  PK:'🇵🇰',PW:'🇵🇼',PS:'🇵🇸',PA:'🇵🇦',PG:'🇵🇬',PY:'🇵🇾',PE:'🇵🇪',PH:'🇵🇭',
  PL:'🇵🇱',PT:'🇵🇹',QA:'🇶🇦',RO:'🇷🇴',RU:'🇷🇺',RW:'🇷🇼',KN:'🇰🇳',LC:'🇱🇨',
  VC:'🇻🇨',WS:'🇼🇸',SM:'🇸🇲',ST:'🇸🇹',SA:'🇸🇦',SN:'🇸🇳',RS:'🇷🇸',SC:'🇸🇨',
  SL:'🇸🇱',SG:'🇸🇬',SK:'🇸🇰',SI:'🇸🇮',SB:'🇸🇧',SO:'🇸🇴',ZA:'🇿🇦',SS:'🇸🇸',
  ES:'🇪🇸',LK:'🇱🇰',SD:'🇸🇩',SR:'🇸🇷',SE:'🇸🇪',CH:'🇨🇭',SY:'🇸🇾',TW:'🇹🇼',
  TJ:'🇹🇯',TZ:'🇹🇿',TH:'🇹🇭',TL:'🇹🇱',TG:'🇹🇬',TO:'🇹🇴',TT:'🇹🇹',TN:'🇹🇳',
  TR:'🇹🇷',TM:'🇹🇲',TV:'🇹🇻',UG:'🇺🇬',UA:'🇺🇦',AE:'🇦🇪',GB:'🇬🇧',US:'🇺🇸',
  UY:'🇺🇾',UZ:'🇺🇿',VU:'🇻🇺',VE:'🇻🇪',VN:'🇻🇳',YE:'🇾🇪',ZM:'🇿🇲',ZW:'🇿🇼'
};
var CC_JP = {
  AF:'アフガニスタン',AL:'アルバニア',DZ:'アルジェリア',AD:'アンドラ',AO:'アンゴラ',
  AR:'アルゼンチン',AM:'アルメニア',AU:'オーストラリア',AT:'オーストリア',AZ:'アゼルバイジャン',
  BE:'ベルギー',BZ:'ベリーズ',BJ:'ベナン',BT:'ブータン',BO:'ボリビア',BA:'ボスニア・ヘルツェゴビナ',
  BW:'ボツワナ',BR:'ブラジル',BN:'ブルネイ',BG:'ブルガリア',BF:'ブルキナファソ',BI:'ブルンジ',
  KH:'カンボジア',CM:'カメルーン',CA:'カナダ',CF:'中央アフリカ',TD:'チャド',CL:'チリ',
  CN:'中国',CO:'コロンビア',CG:'コンゴ',CD:'コンゴ民主',CR:'コスタリカ',CI:'コートジボワール',
  HR:'クロアチア',CU:'キューバ',CY:'キプロス',CZ:'チェコ',DK:'デンマーク',DJ:'ジブチ',
  DO:'ドミニカ',EC:'エクアドル',EG:'エジプト',SV:'エルサルバドル',GQ:'赤道ギニア',
  ER:'エリトリア',EE:'エストニア',ET:'エチオピア',FI:'フィンランド',FR:'フランス',
  GA:'ガボン',GM:'ガンビア',GE:'ジョージア',DE:'ドイツ',GH:'ガーナ',GR:'ギリシャ',
  GT:'グアテマラ',GN:'ギニア',GW:'ギニアビサウ',GY:'ガイアナ',HT:'ハイチ',HN:'ホンジュラス',
  HU:'ハンガリー',IS:'アイスランド',IN:'インド',ID:'インドネシア',IR:'イラン',IQ:'イラク',
  IE:'アイルランド',IL:'イスラエル',IT:'イタリア',JM:'ジャマイカ',JP:'日本',JO:'ヨルダン',
  KZ:'カザフスタン',KE:'ケニア',KW:'クウェート',KG:'キルギス',LA:'ラオス',LV:'ラトビア',
  LB:'レバノン',LS:'レソト',LY:'リビア',LT:'リトアニア',LU:'ルクセンブルク',MG:'マダガスカル',
  MW:'マラウイ',MY:'マレーシア',MV:'モルディブ',ML:'マリ',MT:'マルタ',MR:'モーリタニア',
  MU:'モーリシャス',MX:'メキシコ',MD:'モルドバ',MC:'モナコ',MN:'モンゴル',ME:'モンテネグロ',
  MA:'モロッコ',MZ:'モザンビーク',MM:'ミャンマー',NA:'ナミビア',NP:'ネパール',NL:'オランダ',
  NZ:'ニュージーランド',NI:'ニカラグア',NE:'ニジェール',NG:'ナイジェリア',NO:'ノルウェー',
  OM:'オマーン',PK:'パキスタン',PA:'パナマ',PG:'パプアニューギニア',PY:'パラグアイ',
  PE:'ペルー',PH:'フィリピン',PL:'ポーランド',PT:'ポルトガル',QA:'カタール',RO:'ルーマニア',
  RU:'ロシア',RW:'ルワンダ',SA:'サウジアラビア',SN:'セネガル',RS:'セルビア',SC:'セーシェル',
  SL:'シエラレオネ',SG:'シンガポール',SK:'スロバキア',SI:'スロベニア',SB:'ソロモン諸島',
  SO:'ソマリア',ZA:'南アフリカ',SS:'南スーダン',ES:'スペイン',LK:'スリランカ',SD:'スーダン',
  SR:'スリナム',SE:'スウェーデン',CH:'スイス',SY:'シリア',TW:'台湾',TJ:'タジキスタン',
  TZ:'タンザニア',TH:'タイ',TL:'東ティモール',TG:'トーゴ',TT:'トリニダード・トバゴ',
  TN:'チュニジア',TR:'トルコ',TM:'トルクメニスタン',UG:'ウガンダ',UA:'ウクライナ',
  AE:'アラブ首長国連邦',GB:'イギリス',US:'アメリカ',UY:'ウルグアイ',UZ:'ウズベキスタン',
  VU:'バヌアツ',VE:'ベネズエラ',VN:'ベトナム',YE:'イエメン',ZM:'ザンビア',ZW:'ジンバブエ'
};

function ccToFlag(cc) {
  if (!cc) return '🌐';
  return CC_FLAG[cc] || '🌐';
}
function ccToJp(cc) {
  if (!cc) return '不明';
  return CC_JP[cc] || cc;
}
function fmtPop(n) {
  if (!n) return '-';
  if (n >= 1000000) return Math.round(n / 100000) / 10 + '百万';
  if (n >= 10000) return Math.round(n / 1000) + '千';
  return n.toLocaleString();
}

function cityLink(r) {
  var url = '/webgl-heritage?city=' + encodeURIComponent(r.city_name) +
    '&lat=' + r.city_lat + '&lon=' + r.city_lon +
    (r.country_code ? '&cc=' + encodeURIComponent(r.country_code) : '');
  return '<a href="' + url + '" style="color:inherit;text-decoration:none;border-bottom:1px dotted #444">' + r.city_name + '</a>';
}

function airportLink(code) {
  var url = '/webgl-heritage?airport=' + encodeURIComponent(code);
  return '<a href="' + url + '" onclick="event.stopPropagation()" style="color:inherit;text-decoration:none;border-bottom:1px dotted #444">(' + code + ')</a>';
}

function buildCountryStats(rows) {
  var map = {};
  rows.forEach(function(r) {
    var cc = r.country_code || '__';
    map[cc] = (map[cc] || 0) + 1;
  });
  return Object.keys(map).map(function(cc) {
    return { cc: cc, count: map[cc] };
  }).sort(function(a, b) { return b.count - a.count; });
}

function buildCityThHtml(ccStats) {
  var opts = '<option value="">すべて</option>';
  ccStats.forEach(function(s) {
    var flag = ccToFlag(s.cc === '__' ? null : s.cc);
    opts += '<option value="' + s.cc + '">' + s.count + ' ' + flag + '</option>';
  });
  return '都市 <select id="sel-country" style="font-size:11px;padding:3px 6px;margin-left:4px">' + opts + '</select>';
}

var allRows = [];
var cityCache = {};
var viewMode = 'all';
document.getElementById('tab-all').addEventListener('click', function() {
  viewMode = 'all';
  document.getElementById('tab-all').className = 'mode-tab active';
  document.getElementById('tab-country').className = 'mode-tab';
  if (allRows.length) renderAll(filteredRows());
});
document.getElementById('tab-country').addEventListener('click', function() {
  viewMode = 'country';
  document.getElementById('tab-all').className = 'mode-tab';
  document.getElementById('tab-country').className = 'mode-tab active';
  if (allRows.length) renderCountry(filteredRows());
});
document.getElementById('sel-dist').addEventListener('change', loadData);
function getSelCountry() {
  var el = document.getElementById('sel-country');
  return el ? el.value : '';
}

function filteredRows() {
  var cc = getSelCountry();
  if (!cc) return allRows;
  return allRows.filter(function(r) { return (r.country_code || '__') === cc; });
}

function onCountryChange() {
  if (!allRows.length) return;
  if (viewMode === 'country') renderCountry(filteredRows());
  else renderAll(filteredRows());
}

function bindCountrySelect() {
  var el = document.getElementById('sel-country');
  if (el) el.addEventListener('change', onCountryChange);
}

var aiModalOverlay = document.getElementById('ai-modal-overlay');
var aiModalTitle = document.getElementById('ai-modal-title');
var aiModalBody = document.getElementById('ai-modal-body');
var aiModalCacheBadge = document.getElementById('ai-modal-cache-badge');
document.getElementById('ai-modal-close').addEventListener('click', function() {
  aiModalOverlay.classList.remove('open');
});
aiModalOverlay.addEventListener('click', function(e) {
  if (e.target === aiModalOverlay) aiModalOverlay.classList.remove('open');
});

function getNextZ() {
  var els = document.querySelectorAll('[style*="z-index"]');
  var max = 100;
  for (var i = 0; i < els.length; i++) {
    var z = parseInt(els[i].style.zIndex, 10);
    if (!isNaN(z) && z > max) max = z;
  }
  return max + 100;
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== AIチャット履歴検索サイドバー =====
var histSideToggle = document.getElementById('hist-side-toggle');
var histSide = document.getElementById('hist-side');
var histSideSearch = document.getElementById('hist-side-search');
var histSideClear = document.getElementById('hist-side-clear');
var histSideStatus = document.getElementById('hist-side-status');
var histSideResults = document.getElementById('hist-side-results');
var histSideTimer = null;
var histSideCurrentResults = [];

function openHistSide() {
  histSide.style.zIndex = String(getNextZ());
  histSide.classList.add('open');
  histSideToggle.classList.add('active');
}

function closeHistSide() {
  histSide.classList.remove('open');
  histSideToggle.classList.remove('active');
}

histSideToggle.addEventListener('click', function() {
  if (histSide.classList.contains('open')) {
    closeHistSide();
  } else {
    openHistSide();
    histSideSearch.focus();
  }
});

var histDetailOverlay = document.getElementById('hist-detail-overlay');
var histDetailChat = document.getElementById('hist-detail-chat');
var histDetailModel = document.getElementById('hist-detail-model');
var histDetailMeta = document.getElementById('hist-detail-meta');
document.getElementById('hist-detail-close').addEventListener('click', function() {
  histDetailOverlay.classList.remove('open');
});
histDetailOverlay.addEventListener('click', function(e) {
  if (e.target === histDetailOverlay) histDetailOverlay.classList.remove('open');
});

${renderKeywordClassifyPanelJs({
  toggleBtnId: HIST_DETAIL_KW_TOGGLE_BTN_ID,
  highlightToggleBtnId: HIST_DETAIL_KW_HIGHLIGHT_BTN_ID,
  chipsContainerId: HIST_DETAIL_KW_CHIPS_CONTAINER_ID,
  chatElExpr: 'histDetailChat',
  instanceName: 'histDetailKwPanel',
})}

function showHistoryDetailModal(r) {
  histDetailChat.innerHTML = '';
  var qEl = document.createElement('div');
  qEl.className = 'hist-detail-bubble user';
  qEl.textContent = r.question;
  var aEl = document.createElement('div');
  aEl.className = 'hist-detail-bubble assistant';
  aEl.textContent = r.answer;
  histDetailChat.appendChild(qEl);
  histDetailChat.appendChild(aEl);
  histDetailModel.textContent = r.model ? r.model.split('/').pop() : '';
  var dateStr = (r.created_at || '').slice(0, 16).replace('T', ' ');
  histDetailMeta.textContent = dateStr + (r.access_count != null ? '　👁 ' + r.access_count : '');
  histDetailOverlay.style.zIndex = String(getNextZ());
  histDetailOverlay.classList.add('open');
  histDetailKwPanel.reset();
  if (r.id) histDetailKwPanel.loadForShare(r.id);
}

function renderHistSideResults(results) {
  var html = '';
  results.forEach(function(r, i) {
    var dateStr = (r.created_at || '').slice(0, 16).replace('T', ' ');
    var modelShort = r.model ? r.model.split('/').pop() : '';
    html += '<div class="hist-side-item" data-idx="' + i + '">' +
      '<div class="hist-side-num">' + (i + 1) + '.</div>' +
      '<div class="hist-side-q">' + escHtml(r.question) + '</div>' +
      '<div class="hist-side-meta">' + (modelShort ? escHtml(modelShort) + '　' : '') + escHtml(dateStr) + '</div>' +
      '</div>';
  });
  histSideResults.innerHTML = html;
  histSideResults.querySelectorAll('.hist-side-item').forEach(function(el) {
    el.addEventListener('click', function() {
      var idx = parseInt(el.getAttribute('data-idx'), 10);
      var r = histSideCurrentResults[idx];
      if (r) showHistoryDetailModal(r);
    });
  });
}

function doHistSideSearch(q) {
  fetch('/api/aichat/shares/search?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      histSideCurrentResults = data.results || [];
      renderHistSideResults(histSideCurrentResults);
      histSideStatus.textContent = histSideCurrentResults.length > 0 ? histSideCurrentResults.length + ' 件ヒット' : '一致なし';
    })
    .catch(function() { histSideStatus.textContent = '検索エラー'; });
}

histSideSearch.addEventListener('input', function() {
  var q = histSideSearch.value.trim();
  histSideClear.classList.toggle('visible', q.length > 0);
  clearTimeout(histSideTimer);
  if (!q) {
    histSideStatus.textContent = '';
    histSideResults.innerHTML = '';
    histSideCurrentResults = [];
    return;
  }
  histSideStatus.textContent = '検索中...';
  histSideTimer = setTimeout(function() { doHistSideSearch(q); }, 350);
});

histSideClear.addEventListener('click', function() {
  histSideSearch.value = '';
  histSideClear.classList.remove('visible');
  histSideStatus.textContent = '';
  histSideResults.innerHTML = '';
  histSideCurrentResults = [];
  histSideSearch.focus();
});

function openHeritageInHistorySidebar(name) {
  openHistSide();
  histSideSearch.value = name;
  histSideClear.classList.add('visible');
  histSideStatus.textContent = '検索中...';
  clearTimeout(histSideTimer);
  doHistSideSearch(name);
}

var kwPanelOverlay = document.getElementById('heritage-kw-panel-overlay');
var kwPanelTitle = document.getElementById('heritage-kw-panel-title');
var kwPanelBody = document.getElementById('heritage-kw-panel-body');
document.getElementById('heritage-kw-panel-close').addEventListener('click', function() {
  kwPanelOverlay.classList.remove('open');
});
kwPanelOverlay.addEventListener('click', function(e) {
  if (e.target === kwPanelOverlay) kwPanelOverlay.classList.remove('open');
});

function openHeritageKwPanel(heritageName) {
  kwPanelTitle.textContent = heritageName + ' — キーワード';
  kwPanelBody.innerHTML = '<div class="kw-panel-empty">読み込み中...</div>';
  kwPanelOverlay.style.zIndex = String(getNextZ());
  kwPanelOverlay.classList.add('open');
  fetch('/api/aichat/heritage-search-keyword-counts?heritage=' + encodeURIComponent(heritageName))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var items = data.keywords || [];
      if (!items.length) {
        kwPanelBody.innerHTML = '<div class="kw-panel-empty">キーワードが見つかりませんでした</div>';
        return;
      }
      var html = '';
      items.forEach(function(item) {
        var kwEsc = escHtml(item.keyword || '');
        html += '<span class="kw-panel-item" data-keyword="' + kwEsc + '">' + kwEsc + ' (' + item.count + ')</span>';
      });
      kwPanelBody.innerHTML = html;
      kwPanelBody.querySelectorAll('.kw-panel-item').forEach(function(el) {
        el.addEventListener('click', function() {
          var kw = el.getAttribute('data-keyword');
          kwPanelOverlay.classList.remove('open');
          openHeritageInHistorySidebar(kw);
        });
      });
    })
    .catch(function() {
      kwPanelBody.innerHTML = '<div class="kw-panel-empty">取得エラーが発生しました</div>';
    });
}

var hclOverlay = document.getElementById('heritage-chatlog-modal-overlay');
var hclTitle = document.getElementById('heritage-chatlog-modal-title');
var hclFlag = document.getElementById('heritage-chatlog-modal-flag');
var hclTabs = document.getElementById('hcl-modal-tabs');
var hclBody = document.getElementById('heritage-chatlog-modal-body');
var heritageCountryFlags = {};
document.getElementById('heritage-chatlog-close').addEventListener('click', function() {
  hclOverlay.classList.remove('open');
});
hclOverlay.addEventListener('click', function(e) {
  if (e.target === hclOverlay) hclOverlay.classList.remove('open');
});

function hclShortModel(model) {
  return model ? (model.split('/').pop() || model) : '(不明)';
}

function hclRenderTabs(resultsByModel, models, activeModel) {
  if (models.length <= 1) {
    hclTabs.style.display = 'none';
    return;
  }
  hclTabs.style.display = 'flex';
  hclTabs.innerHTML = models.map(function(m) {
    var isActive = m === activeModel;
    return '<button class="hcl-tab' + (isActive ? ' active' : '') + '" data-model="' + m.replace(/"/g, '&quot;') + '">' +
      hclShortModel(m) +
      '<span style="background:#30363d;color:#8b949e;border-radius:8px;font-size:10px;padding:0 5px;min-width:16px;text-align:center">' + resultsByModel[m].length + '</span>' +
      '</button>';
  }).join('');
}

function hclRenderBody(items) {
  if (!items.length) {
    hclBody.innerHTML = '<div class="hcl-empty">該当する過去ログが見つかりませんでした</div>';
    return;
  }
  var html = '';
  items.forEach(function(item) {
    var date = item.created_at ? item.created_at.slice(0, 10) : '';
    var q = item.question || '';
    var a = item.answer || '';
    var qEsc = q.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    var aEsc = a.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html += '<div class="hcl-entry">' +
      '<div class="hcl-entry-q">Q: ' + qEsc + '</div>' +
      '<div class="hcl-entry-a">' + aEsc + '</div>' +
      '<div class="hcl-entry-meta"><span>' + date + '</span></div>' +
      '</div>';
  });
  hclBody.innerHTML = html;
}

function openHeritageChatlogModal(heritageName, topic) {
  hclTitle.textContent = (topic ? heritageName + ' — ' + topic : heritageName) + ' — AIチャット過去ログ';
  var countryFlag = heritageCountryFlags[heritageName] || '';
  hclFlag.textContent = countryFlag ? countryFlag + ' 🏛️' : '🏛️';
  hclTabs.style.display = 'none';
  hclTabs.innerHTML = '';
  hclBody.innerHTML = '<div class="hcl-empty">読み込み中...</div>';
  hclOverlay.style.zIndex = String(getNextZ());
  hclOverlay.classList.add('open');
  var byKwUrl = '/api/aichat/shares/by-keyword?keyword=' + encodeURIComponent(heritageName) +
    (topic ? '&topic=' + encodeURIComponent(topic) : '');
  fetch(byKwUrl)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var results = data.results || [];
      if (!results.length) {
        hclBody.innerHTML = '<div class="hcl-empty">該当する過去ログが見つかりませんでした</div>';
        return;
      }
      var resultsByModel = {};
      var models = [];
      results.forEach(function(item) {
        var m = item.model || '';
        if (!resultsByModel[m]) { resultsByModel[m] = []; models.push(m); }
        resultsByModel[m].push(item);
      });
      var activeModel = models[0];
      hclRenderTabs(resultsByModel, models, activeModel);
      hclRenderBody(resultsByModel[activeModel]);
      hclTabs.addEventListener('click', function(e) {
        var btn = e.target.closest('.hcl-tab');
        if (!btn) return;
        var m = btn.getAttribute('data-model');
        if (!m || !resultsByModel[m]) return;
        activeModel = m;
        hclTabs.querySelectorAll('.hcl-tab').forEach(function(b) {
          b.className = 'hcl-tab' + (b.getAttribute('data-model') === m ? ' active' : '');
        });
        hclRenderBody(resultsByModel[m]);
      });
    })
    .catch(function() {
      hclBody.innerHTML = '<div class="hcl-empty">取得エラーが発生しました</div>';
    });
}

function fetchHeritageKeywordData(keywords) {
  return fetch('/api/aichat/heritage-keywords-check?keywords=' + encodeURIComponent(keywords.join(',')))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var hits = data.hits || {};
      return fetch('/api/aichat/heritage-search-keywords-check?keywords=' + encodeURIComponent(keywords.join(',')))
        .then(function(r2) { return r2.json(); })
        .then(function(kwData) { return { hits: hits, kwCounts: kwData.keywordCounts || {} }; })
        .catch(function() { return { hits: hits, kwCounts: {} }; });
    })
    .catch(function() { return { hits: {}, kwCounts: {} }; });
}

function applyKeywordData(inner, hits, kwCounts) {
  inner.querySelectorAll('.acc-name[data-heritage]').forEach(function(span) {
    var name = span.getAttribute('data-heritage');
    var topics = name ? (hits[name] || []) : [];
    if (!name || !topics.length) return;
    var btn = document.createElement('button');
    btn.className = 'acc-name-link';
    btn.setAttribute('data-heritage', name);
    btn.textContent = span.textContent;
    btn.addEventListener('click', function(e) { e.stopPropagation(); openHeritageInHistorySidebar(name); });
    var wrap = document.createElement('span');
    wrap.className = 'acc-name-wrap';
    wrap.appendChild(btn);
    for (var ti = 0; ti < topics.length; ti++) {
      (function(badgeTopic) {
        var badge = document.createElement('span');
        badge.className = 'acc-topic-badge';
        badge.textContent = badgeTopic;
        badge.addEventListener('click', function(e) { e.stopPropagation(); openHeritageChatlogModal(name, badgeTopic); });
        wrap.appendChild(badge);
      })(topics[ti]);
    }
    span.parentNode.replaceChild(wrap, span);
  });
  inner.querySelectorAll('.acc-name-wrap').forEach(function(wrap) {
    var nameBtn = wrap.querySelector('.acc-name-link[data-heritage]');
    if (!nameBtn) return;
    var wName = nameBtn.getAttribute('data-heritage');
    var wTopics = wName ? (hits[wName] || []) : [];
    if (!wTopics.length) return;
    var existingTopics = {};
    wrap.querySelectorAll('.acc-topic-badge').forEach(function(b) { existingTopics[b.textContent] = true; });
    wTopics.forEach(function(wTopic) {
      if (existingTopics[wTopic]) return;
      (function(badgeTopic) {
        var newBadge = document.createElement('span');
        newBadge.className = 'acc-topic-badge';
        newBadge.textContent = badgeTopic;
        newBadge.addEventListener('click', function(e) { e.stopPropagation(); openHeritageChatlogModal(wName, badgeTopic); });
        wrap.appendChild(newBadge);
      })(wTopic);
    });
  });
  Object.keys(kwCounts).forEach(function(name) {
    var count = kwCounts[name];
    if (!count) return;
    var found = false;
    inner.querySelectorAll('.acc-name-wrap').forEach(function(wrap) {
      var nameBtn = wrap.querySelector('.acc-name-link[data-heritage]');
      if (!nameBtn || nameBtn.getAttribute('data-heritage') !== name) return;
      found = true;
      var existingKwBadge = wrap.querySelector('.acc-kw-badge');
      if (existingKwBadge) {
        existingKwBadge.textContent = 'キーワード (' + count + ')';
      } else {
        var kwBadge = document.createElement('span');
        kwBadge.className = 'acc-kw-badge';
        kwBadge.textContent = 'キーワード (' + count + ')';
        (function(kwName) {
          kwBadge.addEventListener('click', function(e) { e.stopPropagation(); openHeritageKwPanel(kwName); });
        })(name);
        wrap.appendChild(kwBadge);
      }
    });
    if (found) return;
    inner.querySelectorAll('.acc-name[data-heritage]').forEach(function(span) {
      if (span.getAttribute('data-heritage') !== name) return;
      var btn = document.createElement('button');
      btn.className = 'acc-name-link';
      btn.setAttribute('data-heritage', name);
      btn.textContent = span.textContent;
      (function(linkName) {
        btn.addEventListener('click', function(e) { e.stopPropagation(); openHeritageInHistorySidebar(linkName); });
      })(name);
      var wrap2 = document.createElement('span');
      wrap2.className = 'acc-name-wrap';
      wrap2.appendChild(btn);
      var kwBadge = document.createElement('span');
      kwBadge.className = 'acc-kw-badge';
      kwBadge.textContent = 'キーワード (' + count + ')';
      (function(kwName) {
        kwBadge.addEventListener('click', function(e) { e.stopPropagation(); openHeritageKwPanel(kwName); });
      })(name);
      wrap2.appendChild(kwBadge);
      span.parentNode.replaceChild(wrap2, span);
    });
  });
}

function applyAnsweredData(inner, allAnswered) {
  Object.keys(allAnswered).forEach(function(name) {
    var nameAnswered = allAnswered[name] || {};
    AI_TOPICS.forEach(function(t) {
      if (nameAnswered[t]) ensureTopicBadge(inner, name, t);
    });
  });
}

function openAiModal(title, bodyText, isCached) {
  aiModalTitle.textContent = title;
  aiModalBody.textContent = bodyText;
  aiModalCacheBadge.style.display = isCached ? '' : 'none';
  aiModalOverlay.style.zIndex = getNextZ();
  aiModalOverlay.classList.add('open');
}

var AI_TOPICS = ['交通手段', '見どころ', '最寄り空港', '鉄道でのアクセス', '宿泊施設', 'スポーツ施設'];

var HERITAGE_MITOKORO_TOPIC = '見どころ';
var HERITAGE_MITOKORO_MODEL = '@cf/google/gemma-4-26b-a4b-it';

function askAI(heritageName, topic, onComplete) {
  var prompt = '「' + heritageName + '」の「' + topic + '」について説明してください';
  openAiModal(heritageName + ' — ' + topic, '読み込み中...', false);
  var requestBody = { message: prompt, source: 'api' };
  // 「見どころ」は世界遺産ツールチップの👀アイコン判定（gemma-4-26b-a4b-it固定）が
  // 参照するキャッシュのため、必ず同じモデルで生成してキャッシュ判定と一致させる。
  if (topic === HERITAGE_MITOKORO_TOPIC) requestBody.model = HERITAGE_MITOKORO_MODEL;
  fetch('/api/aichat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  }).then(function(r) { return r.json(); }).then(function(data) {
    aiModalBody.textContent = data.response || data.error || '（応答なし）';
    if (data.response && data.id) {
      aiModalCacheBadge.style.display = 'none';
    }
    if (onComplete) onComplete(data.shareId || data.id || null);
  }).catch(function() {
    aiModalBody.textContent = '通信エラーが発生しました。';
  });
}

function askAICached(heritageName, topic, shareId) {
  openAiModal(heritageName + ' — ' + topic, '読み込み中...', true);
  fetch('/api/aichat/shares/' + encodeURIComponent(shareId))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      aiModalBody.textContent = data.answer || data.error || '（応答なし）';
    })
    .catch(function() {
      aiModalBody.textContent = '通信エラーが発生しました。';
    });
}

function buildAiPanel(heritageName) {
  var html = '<div class="acc-ai-panel">' +
    '<div class="acc-ai-label">AIに何を質問しますか</div>' +
    '<div class="acc-ai-btns">';
  AI_TOPICS.forEach(function(topic) {
    html += '<button class="acc-ai-btn" data-topic="' + topic + '" data-heritage="' +
      heritageName.replace(/"/g, '&quot;') + '">' + topic + '</button>';
  });
  html += '</div></div>';
  return html;
}

function ensureTopicBadge(inner, heritageName, topic) {
  var found = false;
  inner.querySelectorAll('.acc-name-wrap').forEach(function(wrap) {
    var nameBtn = wrap.querySelector('.acc-name-link[data-heritage]');
    if (!nameBtn || nameBtn.getAttribute('data-heritage') !== heritageName) return;
    found = true;
    var exists = false;
    wrap.querySelectorAll('.acc-topic-badge').forEach(function(b) {
      if (b.textContent === topic) exists = true;
    });
    if (!exists) {
      var badge = document.createElement('span');
      badge.className = 'acc-topic-badge';
      badge.textContent = topic;
      badge.addEventListener('click', function(e) {
        e.stopPropagation();
        openHeritageChatlogModal(heritageName, topic);
      });
      wrap.appendChild(badge);
    }
  });
  if (found) return;
  inner.querySelectorAll('.acc-name[data-heritage]').forEach(function(span) {
    if (span.getAttribute('data-heritage') !== heritageName) return;
    var btn = document.createElement('button');
    btn.className = 'acc-name-link';
    btn.setAttribute('data-heritage', heritageName);
    btn.textContent = span.textContent;
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      openHeritageInHistorySidebar(heritageName);
    });
    var wrap = document.createElement('span');
    wrap.className = 'acc-name-wrap';
    wrap.appendChild(btn);
    var badge = document.createElement('span');
    badge.className = 'acc-topic-badge';
    badge.textContent = topic;
    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      openHeritageChatlogModal(heritageName, topic);
    });
    wrap.appendChild(badge);
    span.parentNode.replaceChild(wrap, span);
  });
}

function closeAllAccordions() {
  var rows = document.querySelectorAll('.accordion-row');
  for (var i = 0; i < rows.length; i++) rows[i].parentNode.removeChild(rows[i]);
  var opens = document.querySelectorAll('.row-open');
  for (var j = 0; j < opens.length; j++) opens[j].classList.remove('row-open');
}

function renderHeritageInner(inner, accTr, heritages, hits, kwCounts, answered) {
  var html = '<div class="acc-heritage-list">';
  heritages.forEach(function(h, idx) {
    var dist = h.distance_km < 10 ? h.distance_km.toFixed(1) : Math.round(h.distance_km);
    var safeName = h.heritage_name.replace(/&/g,'&amp;').replace(/</g,'&lt;');
    var flagSpan = h.country_flag ? '<span class="acc-country-flag">' + h.country_flag + '</span>' : '';
    if (h.heritage_name) heritageCountryFlags[h.heritage_name] = h.country_flag || '';
    var emoji = HERITAGE_EMOJI_BY_NAME[h.heritage_name] || '🏛️';
    html += '<div class="acc-row" data-heritage="' + h.heritage_name.replace(/"/g,'&quot;') + '">' +
      '<span class="acc-num">' + (idx + 1) + '</span>' +
      flagSpan +
      '<span class="acc-emoji">' + emoji + '</span>' +
      '<span class="acc-name" data-heritage="' + h.heritage_name.replace(/"/g,'&quot;') + '">' + safeName + '</span>' +
      '<span class="acc-dist">' + dist + ' km</span>' +
      '</div>' +
      '<div class="acc-ai-wrap" id="acc-ai-' + Math.random().toString(36).slice(2) + '" style="display:none">' +
      buildAiPanel(h.heritage_name) +
      '</div>';
  });
  html += '</div>';
  inner.innerHTML = html;
  applyKeywordData(inner, hits, kwCounts);
  applyAnsweredData(inner, answered);
  inner.querySelectorAll('.acc-row[data-heritage]').forEach(function(rowEl) {
    rowEl.style.cursor = 'pointer';
    rowEl.addEventListener('click', function() {
      var wrap = rowEl.nextSibling;
      if (!wrap || !wrap.classList || !wrap.classList.contains('acc-ai-wrap')) return;
      var isOpen = wrap.style.display !== 'none';
      inner.querySelectorAll('.acc-ai-wrap').forEach(function(w) { w.style.display = 'none'; });
      if (!isOpen) {
        wrap.style.display = '';
        var hName = rowEl.getAttribute('data-heritage') || '';
        if (hName) {
          var cityTr = accTr.previousElementSibling;
          var _cc = cityTr ? cityTr.getAttribute('data-cc') : '';
          var _cName = _cc ? ccToJp(_cc) : '';
          var localAnswered = {};
          wrap.querySelectorAll('.acc-ai-btn.answered').forEach(function(b) {
            var t = b.getAttribute('data-topic');
            var sid = b.getAttribute('data-share-id');
            if (t && sid) localAnswered[t] = sid;
          });
          fetch('/api/aichat/check-heritage-questions?heritage=' + encodeURIComponent(hName) + '&country_name=' + encodeURIComponent(_cName))
            .then(function(r) { return r.json(); })
            .then(function(data) {
              var serverAnswered = data.answered || {};
              wrap.querySelectorAll('.acc-ai-btn').forEach(function(btn) {
                var topic = btn.getAttribute('data-topic');
                var shareId = topic ? (localAnswered[topic] || serverAnswered[topic]) : null;
                if (shareId) {
                  btn.classList.add('answered');
                  btn.setAttribute('data-share-id', shareId);
                } else {
                  btn.classList.remove('answered');
                  btn.removeAttribute('data-share-id');
                }
              });
              AI_TOPICS.forEach(function(t) {
                if (localAnswered[t] || serverAnswered[t]) ensureTopicBadge(inner, hName, t);
              });
            })
            .catch(function() {});
        }
      }
    });
  });
  inner.querySelectorAll('.acc-ai-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var topic = btn.getAttribute('data-topic');
      var name = btn.getAttribute('data-heritage');
      var shareId = btn.getAttribute('data-share-id');
      if (shareId) {
        askAICached(name, topic, shareId);
      } else {
        askAI(name, topic, function(newShareId) {
          if (newShareId) {
            btn.classList.add('answered');
            btn.setAttribute('data-share-id', newShareId);
            ensureTopicBadge(inner, name, topic);
          }
        });
      }
    });
  });
}

function openAccordion(tr) {
  var cityName = tr.getAttribute('data-city');
  var lat = parseFloat(tr.getAttribute('data-lat'));
  var lon = parseFloat(tr.getAttribute('data-lon'));
  var accTr = document.createElement('tr');
  accTr.className = 'accordion-row';
  var colCount = tr.cells.length;
  accTr.innerHTML = '<td colspan="' + colCount + '"><div class="accordion-inner"><div class="acc-loading">読み込み中...</div></div></td>';
  tr.parentNode.insertBefore(accTr, tr.nextSibling);
  tr.classList.add('row-open');

  var cached = cityCache[cityName];
  if (cached) {
    var innerC = accTr.querySelector('.accordion-inner');
    if (!innerC) return;
    renderHeritageInner(innerC, accTr, cached.heritages, cached.hits, cached.kwCounts, cached.answered);
    fetch('/api/aichat/check-heritage-questions-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heritages: cached.heritages.map(function(h) { return h.heritage_name; }) })
    }).then(function(r) { return r.json(); })
      .then(function(batchData) {
        var allAnswered = batchData.answered || {};
        cityCache[cityName].answered = allAnswered;
        applyAnsweredData(innerC, allAnswered);
      })
      .catch(function() {});
    return;
  }

  fetch('/api/city-all-heritages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city_name: cityName, lat: lat, lon: lon })
  }).then(function(r) { return r.json(); }).then(function(data) {
    var heritages = data.heritages || [];
    var inner = accTr.querySelector('.accordion-inner');
    if (!inner) return;
    var filtered = heritages.filter(function(h) { return h.distance_km <= 2000; });
    if (filtered.length === 0) {
      inner.innerHTML = '<div class="acc-loading">近隣の世界遺産データなし（2000km以内）</div>';
      return;
    }
    var allHeritageNames = filtered.map(function(h) { return h.heritage_name; });
    return Promise.all([
      fetchHeritageKeywordData(allHeritageNames),
      fetch('/api/aichat/check-heritage-questions-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heritages: allHeritageNames })
      }).then(function(r) { return r.json(); }).catch(function() { return { answered: {} }; })
    ]).then(function(results) {
      var kwData = results[0];
      var batchData = results[1];
      var answered = batchData.answered || {};
      cityCache[cityName] = { heritages: filtered, hits: kwData.hits, kwCounts: kwData.kwCounts, answered: answered };
      var innerNow = accTr.querySelector('.accordion-inner');
      if (!innerNow) return;
      renderHeritageInner(innerNow, accTr, filtered, kwData.hits, kwData.kwCounts, answered);
    });
  }).catch(function() {
    var inner = accTr.querySelector('.accordion-inner');
    if (inner) inner.innerHTML = '<div class="acc-loading">取得エラー</div>';
  });
}

function bindRowAccordion() {
  var tbody = document.querySelector('#tbl-wrap tbody');
  if (!tbody) return;
  tbody.addEventListener('click', function(e) {
    var target = e.target;
    if (target.tagName === 'A' || target.closest('a') || target.tagName === 'SELECT' || target.closest('select')) return;
    var tr = target.closest('tr');
    if (!tr || tr.classList.contains('accordion-row') || tr.classList.contains('group-head-tr')) return;
    if (tr.classList.contains('row-open')) {
      var next = tr.nextSibling;
      if (next && next.classList && next.classList.contains('accordion-row')) {
        next.parentNode.removeChild(next);
      }
      tr.classList.remove('row-open');
      return;
    }
    closeAllAccordions();
    openAccordion(tr);
  });
}

function summaryHtml(rows, ccStats, dist) {
  var countryCount = ccStats.length;
  var badge = '<span class="dist-badge">' + dist + ' km</span>';
  return '<strong>' + countryCount + 'ヶ国</strong> <strong>' + rows.length + '</strong>都市 · 距離上限 ' + badge;
}

function loadData() {
  var dist = document.getElementById('sel-dist').value;
  var limit = document.getElementById('sel-limit').value;
  document.getElementById('tbl-wrap').innerHTML = '<div class="spinner">読み込み中...</div>';
  document.getElementById('summary').textContent = '';
  fetch('/api/heritage-access-ranking?max_dist=' + dist + '&limit=' + limit)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      allRows = data.rows || [];
      if (!allRows.length) {
        document.getElementById('tbl-wrap').innerHTML = '<div class="spinner">データなし（都市データを先に取得してください）</div>';
        return;
      }
      if (viewMode === 'country') renderCountry(filteredRows());
      else renderAll(filteredRows());
    })
    .catch(function() {
      document.getElementById('tbl-wrap').innerHTML = '<div class="spinner">取得エラー</div>';
    });
}

function tableHead(ccStats) {
  return '<table><thead><tr>' +
    '<th style="text-align:right">#</th>' +
    '<th></th>' +
    '<th>' + buildCityThHtml(ccStats) + '</th>' +
    '<th>国</th>' +
    '<th>世界遺産数</th>' +
    '<th class="num">最近距離</th>' +
    '<th class="num">人口</th>' +
    '</tr></thead><tbody>';
}

function renderAll(rows) {
  var dist = document.getElementById('sel-dist').value;
  var ccStats = buildCountryStats(allRows);
  document.getElementById('summary').innerHTML = summaryHtml(allRows, ccStats, dist);
  var maxCount = allRows[0] ? allRows[0].heritage_count : 1;
  var html = tableHead(ccStats);
  rows.forEach(function(r, i) {
    var rowClass = i === 0 ? ' class="top1"' : i === 1 ? ' class="top2"' : i === 2 ? ' class="top3"' : '';
    var barW = Math.round((r.heritage_count / maxCount) * 140);
    html += '<tr' + rowClass +
      ' data-city="' + r.city_name.replace(/"/g, '&quot;') + '"' +
      ' data-lat="' + r.city_lat + '"' +
      ' data-lon="' + r.city_lon + '"' +
      ' data-cc="' + (r.country_code || '') + '">' +
      '<td class="rank">' + (i + 1) + '</td>' +
      '<td class="flag">' + ccToFlag(r.country_code) + '</td>' +
      '<td class="city">' + cityLink(r) + '</td>' +
      '<td class="country">' + ccToJp(r.country_code) + '</td>' +
      '<td><div style="display:flex;align-items:center;gap:6px">' +
        '<div class="bar" style="width:' + barW + 'px"></div>' +
        '<span style="color:#3fb950;font-weight:700;font-size:13px">' + r.heritage_count + '</span>' +
      '</div></td>' +
      '<td class="nearest">' + r.nearest_km + ' km</td>' +
      '<td class="pop">' + fmtPop(r.population) + '</td>' +
      '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('tbl-wrap').innerHTML = html;
  var selCC = getSelCountry();
  bindCountrySelect();
  bindRowAccordion();
  if (selCC) {
    var el = document.getElementById('sel-country');
    if (el) el.value = selCC;
  }
}

var G7_CAPS = [
  {n:"ワシントンD.C.",cc:"US",lat:38.8951,lon:-77.0369},
  {n:"ロンドン",cc:"GB",lat:51.5074,lon:-0.1278},
  {n:"パリ",cc:"FR",lat:48.8566,lon:2.3522},
  {n:"ベルリン",cc:"DE",lat:52.5200,lon:13.4050},
  {n:"ローマ",cc:"IT",lat:41.9028,lon:12.4964},
  {n:"東京",cc:"JP",lat:35.6762,lon:139.6503},
  {n:"オタワ",cc:"CA",lat:45.4215,lon:-75.6972}
];
var EU_CAPS = [
  {n:"アムステルダム",cc:"NL",lat:52.3676,lon:4.9041},
  {n:"アンカラ",cc:"TR",lat:39.9334,lon:32.8597},
  {n:"アンドラ・ラ・ベリャ",cc:"AD",lat:42.5063,lon:1.5218},
  {n:"アテネ",cc:"GR",lat:37.9838,lon:23.7275},
  {n:"ベオグラード",cc:"RS",lat:44.7866,lon:20.4489},
  {n:"ベルリン",cc:"DE",lat:52.5200,lon:13.4050},
  {n:"ベルン",cc:"CH",lat:46.9481,lon:7.4474},
  {n:"ブラチスラバ",cc:"SK",lat:48.1486,lon:17.1077},
  {n:"ブリュッセル",cc:"BE",lat:50.8503,lon:4.3517},
  {n:"ブカレスト",cc:"RO",lat:44.4268,lon:26.1025},
  {n:"ブダペスト",cc:"HU",lat:47.4979,lon:19.0402},
  {n:"キシナウ",cc:"MD",lat:47.0105,lon:28.8638},
  {n:"コペンハーゲン",cc:"DK",lat:55.6761,lon:12.5683},
  {n:"ダブリン",cc:"IE",lat:53.3498,lon:-6.2603},
  {n:"ヘルシンキ",cc:"FI",lat:60.1699,lon:24.9384},
  {n:"キーウ",cc:"UA",lat:50.4501,lon:30.5234},
  {n:"リスボン",cc:"PT",lat:38.7223,lon:-9.1393},
  {n:"リュブリャナ",cc:"SI",lat:46.0569,lon:14.5058},
  {n:"ロンドン",cc:"GB",lat:51.5074,lon:-0.1278},
  {n:"ルクセンブルク",cc:"LU",lat:49.6117,lon:6.1319},
  {n:"マドリード",cc:"ES",lat:40.4168,lon:-3.7038},
  {n:"ミンスク",cc:"BY",lat:53.9045,lon:27.5615},
  {n:"モナコ",cc:"MC",lat:43.7384,lon:7.4246},
  {n:"モスクワ",cc:"RU",lat:55.7558,lon:37.6173},
  {n:"ニコシア",cc:"CY",lat:35.1856,lon:33.3823},
  {n:"オスロ",cc:"NO",lat:59.9139,lon:10.7522},
  {n:"パリ",cc:"FR",lat:48.8566,lon:2.3522},
  {n:"ポドゴリツァ",cc:"ME",lat:42.4304,lon:19.2594},
  {n:"プラハ",cc:"CZ",lat:50.0755,lon:14.4378},
  {n:"プリシュティナ",cc:"XK",lat:42.6629,lon:21.1655},
  {n:"レイキャビク",cc:"IS",lat:64.1355,lon:-21.8954},
  {n:"リガ",cc:"LV",lat:56.9496,lon:24.1052},
  {n:"ローマ",cc:"IT",lat:41.9028,lon:12.4964},
  {n:"サラエボ",cc:"BA",lat:43.8519,lon:18.3866},
  {n:"スコピエ",cc:"MK",lat:41.9965,lon:21.4314},
  {n:"ソフィア",cc:"BG",lat:42.6977,lon:23.3219},
  {n:"ストックホルム",cc:"SE",lat:59.3293,lon:18.0686},
  {n:"タリン",cc:"EE",lat:59.4370,lon:24.7536},
  {n:"ティラナ",cc:"AL",lat:41.3275,lon:19.8187},
  {n:"ヴァレッタ",cc:"MT",lat:35.8997,lon:14.5147},
  {n:"ファドゥーツ",cc:"LI",lat:47.1410,lon:9.5209},
  {n:"ウィーン",cc:"AT",lat:48.2082,lon:16.3738},
  {n:"ビリニュス",cc:"LT",lat:54.6872,lon:25.2797},
  {n:"ワルシャワ",cc:"PL",lat:52.2297,lon:21.0122},
  {n:"ザグレブ",cc:"HR",lat:45.8150,lon:15.9819}
];
function hvKm(lat1,lon1,lat2,lon2) {
  var R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  var sl = Math.sin(dLat/2), sn = Math.sin(dLon/2);
  var a = sl*sl + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*sn*sn;
  return Math.round(R*2*Math.asin(Math.sqrt(a)));
}
function distCls(d) { return d < 800 ? "dist-near" : d < 3000 ? "dist-mid" : "dist-far"; }
var capOverlay = document.getElementById("cap-dist-overlay");
var capActiveTab = "g7";
document.getElementById("btn-cap-dist").addEventListener("click", function() {
  capOverlay.style.zIndex = String(getNextZ());
  capOverlay.classList.add("open");
  renderCapTab(capActiveTab);
});
document.getElementById("cap-dist-close").addEventListener("click", function() {
  capOverlay.classList.remove("open");
});
capOverlay.addEventListener("click", function(e) {
  if(e.target === capOverlay) capOverlay.classList.remove("open");
});
document.getElementById("cap-tab-g7").addEventListener("click", function() { renderCapTab("g7"); });
document.getElementById("cap-tab-europe").addEventListener("click", function() { renderCapTab("europe"); });
function renderCapTab(tab) {
  capActiveTab = tab;
  document.getElementById("cap-tab-g7").classList.toggle("active", tab === "g7");
  document.getElementById("cap-tab-europe").classList.toggle("active", tab === "europe");
  if(tab === "g7") renderG7Matrix();
  else renderEuropePanel();
}
function renderG7Matrix() {
  var h = '<div style="overflow-x:auto"><table class="cap-matrix"><thead><tr><th class="row-h"></th>';
  G7_CAPS.forEach(function(c) { h += '<th>' + (CC_FLAG[c.cc]||'') + ' ' + c.n + '</th>'; });
  h += '</tr></thead><tbody>';
  G7_CAPS.forEach(function(r) {
    h += '<tr><td class="row-head">' + (CC_FLAG[r.cc]||'') + ' ' + r.n + '</td>';
    G7_CAPS.forEach(function(col) {
      if(r === col) { h += '<td class="self">-</td>'; }
      else { var d = hvKm(r.lat,r.lon,col.lat,col.lon); h += '<td class="' + distCls(d) + '">' + d.toLocaleString() + '</td>'; }
    });
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  h += '<p style="margin-top:10px;font-size:11px;color:#484f58">大圏距離（km）。<span style="color:#3fb950">緑</span>=800km未満、<span style="color:#d4a017">黄</span>=3000km未満、<span style="color:#f85149">赤</span>=3000km以上</p>';
  document.getElementById("cap-dist-body").innerHTML = h;
}
var euFromIdx = 0;
function renderEuropePanel() {
  var selH = '<div class="eu-from-wrap"><span class="eu-from-label">起点都市:</span><select class="eu-from-select" id="eu-from-sel">';
  EU_CAPS.forEach(function(c, i) {
    selH += '<option value="' + i + '"' + (i===euFromIdx?' selected':'') + '>' + (CC_FLAG[c.cc]||'') + ' ' + c.n + '</option>';
  });
  selH += '</select></div><div class="eu-dist-list" id="eu-dist-list"></div>';
  document.getElementById("cap-dist-body").innerHTML = selH;
  document.getElementById("eu-from-sel").addEventListener("change", function(e) {
    euFromIdx = parseInt(e.target.value, 10);
    renderEuList();
  });
  renderEuList();
}
function initAutoLoad() {
  loadData();
}
function renderEuList() {
  var from = EU_CAPS[euFromIdx];
  var dists = [];
  EU_CAPS.forEach(function(c, i) { if(i !== euFromIdx) dists.push({c:c, d:hvKm(from.lat,from.lon,c.lat,c.lon)}); });
  dists.sort(function(a,b){ return a.d-b.d; });
  var maxD = dists[dists.length-1].d;
  var h = '';
  dists.forEach(function(x, rank) {
    var barW = Math.max(2, Math.round((x.d/maxD)*80));
    h += '<div class="eu-dist-row">' +
      '<span class="eu-dist-rank">' + (rank+1) + '</span>' +
      '<span class="eu-dist-flag">' + (CC_FLAG[x.c.cc]||'') + '</span>' +
      '<span class="eu-dist-name">' + x.c.n + '</span>' +
      '<div class="eu-dist-bar-wrap"><div class="eu-dist-bar" style="width:' + barW + 'px"></div></div>' +
      '<span class="eu-dist-km ' + distCls(x.d) + '">' + x.d.toLocaleString() + ' km</span>' +
      '</div>';
  });
  document.getElementById("eu-dist-list").innerHTML = h;
}

var RAIL_LINES = ${JSON.stringify(RAIL_LINES)};
var HERITAGE_ALL = ${JSON.stringify(HERITAGE_LIST)};
var HERITAGE_EMOJI_BY_NAME = {};
HERITAGE_ALL.forEach(function(h) { HERITAGE_EMOJI_BY_NAME[h.n] = h.e; });

var railHrOverlay = document.getElementById('rail-hr-overlay');
var railHrTitle = document.getElementById('rail-hr-title');
var railHrBody = document.getElementById('rail-hr-body');
document.getElementById('rail-hr-close').addEventListener('click', function() {
  railHrOverlay.classList.remove('open');
});
railHrOverlay.addEventListener('click', function(e) {
  if(e.target === railHrOverlay) railHrOverlay.classList.remove('open');
});

function buildRailStationRanking() {
  var rows = [];
  RAIL_LINES.forEach(function(line) {
    line.stations.forEach(function(st) {
      var count = 0;
      HERITAGE_ALL.forEach(function(h) {
        if (hvKm(st.lat, st.lon, h.lat, h.lon) <= 100) count++;
      });
      rows.push({
        station: st.name,
        line: line.name,
        flag: st.flag || line.flag,
        country: st.country || line.country,
        lat: st.lat, lon: st.lon, count: count
      });
    });
  });
  rows.sort(function(a, b) { return b.count - a.count; });
  return rows;
}

function buildRailHrNearbyHtml(lat, lon) {
  var nearby = [];
  HERITAGE_ALL.forEach(function(h) {
    var d = hvKm(lat, lon, h.lat, h.lon);
    if (d <= 100) nearby.push({ h: h, d: d });
  });
  nearby.sort(function(a, b) { return a.d - b.d; });
  if (nearby.length === 0) {
    return '<div style="color:#8b949e;text-align:center;padding:10px 0">100km以内の世界遺産なし</div>';
  }
  var html = '';
  nearby.forEach(function(x) {
    html += '<div class="rail-hr-h-row">' +
      '<span class="rail-hr-h-name">' +
      '<span class="rail-hr-h-flag">' + x.h.f + '</span> ' +
      '<span class="rail-hr-h-icon">' + x.h.e + '</span> ' +
      '<span class="rail-hr-h-site-name">' + x.h.n + '</span>' +
      '</span>' +
      '<span class="rail-hr-h-dist">' + x.d + ' km</span>' +
      '</div>';
  });
  return html;
}

function renderRailHrRanking() {
  railHrTitle.textContent = '🚉 駅周辺100km以内の世界遺産数ランキング';
  var rows = buildRailStationRanking();
  var maxCount = (rows.length && rows[0].count > 0) ? rows[0].count : 1;
  var html = '';
  rows.forEach(function(r, i) {
    var barW = Math.round((r.count / maxCount) * 100);
    html += '<div class="rail-hr-row" data-station="' + r.station.replace(/"/g,'&quot;') + '" data-lat="' + r.lat + '" data-lon="' + r.lon + '">' +
      '<span class="rail-hr-rank">' + (i + 1) + '</span>' +
      '<span class="rail-hr-flag">' + r.flag + '</span>' +
      '<span class="rail-hr-names"><span class="rail-hr-line-primary">' + r.line + '</span><span class="rail-hr-station-sub">' + r.station + '</span></span>' +
      '<div class="rail-hr-count-wrap"><div class="bar" style="width:' + barW + 'px"></div><span class="rail-hr-count">' + r.count + '</span></div>' +
      '</div>';
  });
  railHrBody.innerHTML = html;
  railHrBody.querySelectorAll('.rail-hr-row').forEach(function(el) {
    el.addEventListener('click', function() {
      var next = el.nextSibling;
      if (next && next.classList && next.classList.contains('rail-hr-acc')) {
        next.parentNode.removeChild(next);
        return;
      }
      railHrBody.querySelectorAll('.rail-hr-acc').forEach(function(acc) { acc.parentNode.removeChild(acc); });
      var lat = parseFloat(el.getAttribute('data-lat'));
      var lon = parseFloat(el.getAttribute('data-lon'));
      var acc = document.createElement('div');
      acc.className = 'rail-hr-acc';
      acc.innerHTML = buildRailHrNearbyHtml(lat, lon);
      el.parentNode.insertBefore(acc, el.nextSibling);
    });
  });
}

document.getElementById('btn-rail-hr').addEventListener('click', function() {
  railHrOverlay.style.zIndex = String(getNextZ());
  railHrOverlay.classList.add('open');
  renderRailHrRanking();
});

var AIRPORT_LIST_ALL = ${JSON.stringify(AIRPORT_LIST)};
var AIRPORT_BY_NAME = {};
AIRPORT_LIST_ALL.forEach(function(a) { AIRPORT_BY_NAME[a.name] = a; });

var airportHrOverlay = document.getElementById('airport-hr-overlay');
var airportHrTitle = document.getElementById('airport-hr-title');
var airportHrBody = document.getElementById('airport-hr-body');
var airportHrRows = null;
document.getElementById('airport-hr-close').addEventListener('click', function() {
  airportHrOverlay.classList.remove('open');
});
airportHrOverlay.addEventListener('click', function(e) {
  if (e.target === airportHrOverlay) airportHrOverlay.classList.remove('open');
});

function buildAirportHrRanking(rows) {
  var counts = {};
  rows.forEach(function(r) {
    counts[r.airport_name] = (counts[r.airport_name] || 0) + 1;
  });
  var result = Object.keys(counts).map(function(name) { return { airport: name, count: counts[name] }; });
  result.sort(function(a, b) { return b.count - a.count; });
  return result;
}

function buildAirportHrNearbyHtml(airportName) {
  var nearby = (airportHrRows || []).filter(function(r) { return r.airport_name === airportName; });
  nearby.sort(function(a, b) { return a.distance_km - b.distance_km; });
  if (nearby.length === 0) {
    return '<div style="color:#8b949e;text-align:center;padding:10px 0">300km以内の世界遺産の記録なし</div>';
  }
  var html = '';
  nearby.forEach(function(x) {
    var emoji = HERITAGE_EMOJI_BY_NAME[x.heritage_name] || '🏛️';
    html += '<div class="rail-hr-h-row">' +
      '<span class="rail-hr-h-name">' + emoji + ' ' + x.heritage_name + '</span>' +
      '<span class="rail-hr-h-dist">' + x.distance_km.toFixed(1) + ' km</span>' +
      '</div>';
  });
  return html;
}

function renderAirportHrRanking() {
  airportHrTitle.textContent = '🛬 空港周辺300km以内の世界遺産数ランキング';
  airportHrBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:16px 0">読み込み中...</div>';
  fetch('/api/airport-nearby-heritage-ranking').then(function(r) { return r.json(); }).then(function(d) {
    if (d && d.error) {
      airportHrBody.innerHTML = '<div style="color:#f85149;text-align:center;padding:16px 0">取得に失敗: ' + escHtml(d.error) + '</div>';
      return;
    }
    airportHrRows = d.rows || [];
    var rows = buildAirportHrRanking(airportHrRows);
    if (rows.length === 0) {
      airportHrBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:16px 0">まだデータベースに記録された空港がありません（空港ツールチップの⛳️🏌️‍♀️🏌️‍♂️ボタンで記録できます）</div>';
      return;
    }
    var maxCount = rows[0].count > 0 ? rows[0].count : 1;
    var html = '';
    rows.forEach(function(r, i) {
      var apt = AIRPORT_BY_NAME[r.airport] || {};
      var barW = Math.round((r.count / maxCount) * 100);
      var cityParts = (apt.city || '').split(' ');
      var flag = cityParts[0] || '';
      var countryCity = cityParts.slice(1).join(' ');
      html += '<div class="rail-hr-row" data-airport="' + r.airport.replace(/"/g,'&quot;') + '">' +
        '<span class="rail-hr-rank">' + (i + 1) + '</span>' +
        '<span class="rail-hr-flag">🛬</span>' +
        '<span class="rail-hr-names"><span class="rail-hr-line-primary">' + flag + ' ' + (apt.code ? airportLink(apt.code) + ' ' : '') + r.airport + '</span><span class="rail-hr-station-sub">' + countryCity + '</span></span>' +
        '<div class="rail-hr-count-wrap"><div class="bar" style="width:' + barW + 'px"></div><span class="rail-hr-count">' + r.count + '</span></div>' +
        '</div>';
    });
    airportHrBody.innerHTML = html;
    airportHrBody.querySelectorAll('.rail-hr-row').forEach(function(el) {
      el.addEventListener('click', function() {
        var next = el.nextSibling;
        if (next && next.classList && next.classList.contains('rail-hr-acc')) {
          next.parentNode.removeChild(next);
          return;
        }
        airportHrBody.querySelectorAll('.rail-hr-acc').forEach(function(acc) { acc.parentNode.removeChild(acc); });
        var acc = document.createElement('div');
        acc.className = 'rail-hr-acc';
        acc.innerHTML = buildAirportHrNearbyHtml(el.getAttribute('data-airport'));
        el.parentNode.insertBefore(acc, el.nextSibling);
      });
    });
  }).catch(function() {
    airportHrBody.innerHTML = '<div style="color:#f85149;text-align:center;padding:16px 0">取得に失敗しました</div>';
  });
}

document.getElementById('btn-airport-hr').addEventListener('click', function() {
  airportHrOverlay.style.zIndex = String(getNextZ());
  airportHrOverlay.classList.add('open');
  renderAirportHrRanking();
});

// ===== 距離上限行の検索窓: 世界遺産名/座標を起点とした半径500km以内の都市検索 =====
var cityDistOverlay = document.getElementById('city-dist-overlay');
var cityDistTitle = document.getElementById('city-dist-title');
var cityDistBody = document.getElementById('city-dist-body');
document.getElementById('city-dist-close').addEventListener('click', function() {
  cityDistOverlay.classList.remove('open');
});
cityDistOverlay.addEventListener('click', function(e) {
  if (e.target === cityDistOverlay) cityDistOverlay.classList.remove('open');
});

function normalizeCityDistQuery(value) {
  return String(value || '').trim().replace(/[・･]/g, '・');
}

function parseCityDistCoord(trimmed) {
  var commaIdx = trimmed.indexOf(',');
  if (commaIdx === -1) commaIdx = trimmed.indexOf('、');
  if (commaIdx === -1) return null;
  var latStr = trimmed.slice(0, commaIdx).trim();
  var lonStr = trimmed.slice(commaIdx + 1).trim();
  if (!latStr || !lonStr) return null;
  var lat = Number(latStr);
  var lon = Number(lonStr);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat: lat, lon: lon };
}

function resolveCityDistPoint(query) {
  var trimmed = String(query || '').trim();
  var coord = parseCityDistCoord(trimmed);
  if (coord) return { lat: coord.lat, lon: coord.lon, label: coord.lat + ', ' + coord.lon };
  var normalized = normalizeCityDistQuery(trimmed);
  var hit = HERITAGE_ALL.filter(function(h) { return normalizeCityDistQuery(h.n) === normalized; })[0];
  if (hit) return { lat: hit.lat, lon: hit.lon, label: hit.f + ' ' + hit.n };
  return null;
}

function renderCityDistResult(point) {
  cityDistTitle.textContent = '📍 ' + point.label + ' から半径500km以内の都市';
  cityDistBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:16px 0">読み込み中...</div>';
  fetch('/api/heritage-access/nearby-cities?lat=' + encodeURIComponent(point.lat) + '&lon=' + encodeURIComponent(point.lon))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d && d.error) {
        cityDistBody.innerHTML = '<div style="color:#f85149;text-align:center;padding:16px 0">取得に失敗: ' + escHtml(d.error) + '</div>';
        return;
      }
      var cities = d.cities || [];
      cityDistTitle.textContent = '📍 ' + point.label + ' から半径500km以内の都市 (' + cities.length + ')';
      if (cities.length === 0) {
        cityDistBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:16px 0">半径500km以内の都市データがありません</div>';
        return;
      }
      var html = '';
      cities.forEach(function(c) {
        html += '<div class="rail-hr-h-row">' +
          '<span class="rail-hr-h-name">' + ccToFlag(c.country_code) + ' ' + escHtml(c.city_name) + '</span>' +
          '<span class="rail-hr-h-dist">' + c.distance_km.toFixed(1) + ' km</span>' +
          '</div>';
      });
      cityDistBody.innerHTML = html;
    })
    .catch(function() {
      cityDistBody.innerHTML = '<div style="color:#f85149;text-align:center;padding:16px 0">取得に失敗しました</div>';
    });
}

var cityDistSearchInput = document.getElementById('city-dist-search');
cityDistSearchInput.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  var query = cityDistSearchInput.value;
  var point = resolveCityDistPoint(query);
  cityDistOverlay.style.zIndex = String(getNextZ());
  cityDistOverlay.classList.add('open');
  if (!point) {
    cityDistTitle.textContent = '📍 半径500km以内の都市';
    cityDistBody.innerHTML = '<div style="color:#f85149;text-align:center;padding:16px 0">「' + escHtml(query) + '」が見つかりません(世界遺産名または「緯度,経度」で入力してください)</div>';
    return;
  }
  renderCityDistResult(point);
});

var cityDistMenuBtn = document.getElementById('city-dist-menu-btn');
var cityDistCandidates = document.getElementById('city-dist-candidates');
var cityDistMenu = document.getElementById('city-dist-menu');

function closeCityDistCandidates() {
  cityDistCandidates.classList.remove('open');
  cityDistCandidates.innerHTML = '';
}

function closeCityDistMenu() {
  cityDistMenu.classList.remove('open');
  cityDistMenu.innerHTML = '';
}

function positionCityDistPanel(panel, anchorEl, align) {
  var r = anchorEl.getBoundingClientRect();
  panel.style.top = (r.bottom + 4) + 'px';
  if (align === 'right') {
    panel.style.left = 'auto';
    panel.style.right = (window.innerWidth - r.right) + 'px';
  } else {
    panel.style.left = r.left + 'px';
    panel.style.right = 'auto';
    panel.style.width = r.width + 'px';
  }
}

function renderCityDistCandidates() {
  var normalized = normalizeCityDistQuery(cityDistSearchInput.value);
  if (!normalized) { closeCityDistCandidates(); return; }
  var matches = HERITAGE_ALL.filter(function(h) {
    return normalizeCityDistQuery(h.n).indexOf(normalized) !== -1;
  }).slice(0, 20);
  if (!matches.length) { closeCityDistCandidates(); return; }
  cityDistCandidates.innerHTML = matches.map(function(h) {
    return '<div class="city-dist-candidate-row" data-name="' + h.n.replace(/"/g, '&quot;') + '">' + h.f + ' ' + escHtml(h.n) + '</div>';
  }).join('');
  positionCityDistPanel(cityDistCandidates, cityDistSearchInput, 'left');
  cityDistCandidates.style.zIndex = String(getNextZ());
  cityDistCandidates.classList.add('open');
  cityDistCandidates.querySelectorAll('.city-dist-candidate-row').forEach(function(row) {
    row.addEventListener('click', function() {
      cityDistSearchInput.value = row.getAttribute('data-name');
      closeCityDistCandidates();
      updateCityDistMenuBtn();
      cityDistSearchInput.focus();
    });
  });
}

function updateCityDistMenuBtn() {
  var normalized = normalizeCityDistQuery(cityDistSearchInput.value);
  var hit = normalized ? HERITAGE_ALL.filter(function(h) { return normalizeCityDistQuery(h.n) === normalized; })[0] : null;
  if (hit) {
    cityDistMenuBtn.style.display = '';
    cityDistMenuBtn.setAttribute('data-heritage-name', hit.n);
  } else {
    cityDistMenuBtn.style.display = 'none';
    cityDistMenuBtn.removeAttribute('data-heritage-name');
    closeCityDistMenu();
  }
}

cityDistSearchInput.addEventListener('input', function() {
  renderCityDistCandidates();
  updateCityDistMenuBtn();
});

cityDistMenuBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  var willOpen = !cityDistMenu.classList.contains('open');
  closeCityDistMenu();
  if (!willOpen) return;
  var name = cityDistMenuBtn.getAttribute('data-heritage-name');
  if (!name) return;
  cityDistMenu.innerHTML =
    '<button type="button" class="city-dist-menu-item" id="city-dist-menu-cities">🌆 周辺都市を見る</button>' +
    '<a class="city-dist-menu-item" id="city-dist-menu-globe" href="/webgl-heritage?heritage=' + encodeURIComponent(name) + '">🌍 地球儀で見る</a>';
  positionCityDistPanel(cityDistMenu, cityDistMenuBtn, 'right');
  cityDistMenu.style.zIndex = String(getNextZ());
  cityDistMenu.classList.add('open');
  document.getElementById('city-dist-menu-cities').addEventListener('click', function() {
    closeCityDistMenu();
    var point = resolveCityDistPoint(name);
    if (!point) return;
    cityDistOverlay.style.zIndex = String(getNextZ());
    cityDistOverlay.classList.add('open');
    renderCityDistResult(point);
  });
});

document.addEventListener('click', function(e) {
  if (e.target !== cityDistSearchInput && !cityDistCandidates.contains(e.target)) closeCityDistCandidates();
  if (e.target !== cityDistMenuBtn && !cityDistMenu.contains(e.target)) closeCityDistMenu();
});

initAutoLoad();

function renderCountry(rows) {
  var dist = document.getElementById('sel-dist').value;
  var ccStats = buildCountryStats(allRows);
  document.getElementById('summary').innerHTML = summaryHtml(allRows, ccStats, dist);
  var byCountry = {};
  rows.forEach(function(r) {
    var cc = r.country_code || '__';
    if (!byCountry[cc]) byCountry[cc] = [];
    byCountry[cc].push(r);
  });
  var ccList = Object.keys(byCountry).sort(function(a, b) {
    return byCountry[b][0].heritage_count - byCountry[a][0].heritage_count;
  });
  var maxCount = allRows[0] ? allRows[0].heritage_count : 1;
  var html = tableHead(ccStats);
  var globalRank = 0;
  ccList.forEach(function(cc) {
    var cities = byCountry[cc];
    var flag = ccToFlag(cc === '__' ? null : cc);
    var jpName = ccToJp(cc === '__' ? null : cc);
    html += '<tr class="group-head-tr"><td colspan="7" class="group-head">' + flag + ' ' + jpName +
      ' <span style="color:#484f58;margin-left:6px">' + cities.length + '都市</span></td></tr>';
    cities.forEach(function(r) {
      globalRank++;
      var barW = Math.round((r.heritage_count / maxCount) * 140);
      html += '<tr' +
        ' data-city="' + r.city_name.replace(/"/g, '&quot;') + '"' +
        ' data-lat="' + r.city_lat + '"' +
        ' data-lon="' + r.city_lon + '"' +
        ' data-cc="' + (r.country_code || '') + '">' +
        '<td class="rank">' + globalRank + '</td>' +
        '<td class="flag">' + ccToFlag(r.country_code) + '</td>' +
        '<td class="city">' + cityLink(r) + '</td>' +
        '<td class="country">' + ccToJp(r.country_code) + '</td>' +
        '<td><div style="display:flex;align-items:center;gap:6px">' +
          '<div class="bar" style="width:' + barW + 'px"></div>' +
          '<span style="color:#3fb950;font-weight:700;font-size:13px">' + r.heritage_count + '</span>' +
        '</div></td>' +
        '<td class="nearest">' + r.nearest_km + ' km</td>' +
        '<td class="pop">' + fmtPop(r.population) + '</td>' +
        '</tr>';
    });
  });
  html += '</tbody></table>';
  document.getElementById('tbl-wrap').innerHTML = html;
  var selCC = getSelCountry();
  bindCountrySelect();
  bindRowAccordion();
  if (selCC) {
    var el = document.getElementById('sel-country');
    if (el) el.value = selCC;
  }
}
</script>
</body>
</html>`;
}
