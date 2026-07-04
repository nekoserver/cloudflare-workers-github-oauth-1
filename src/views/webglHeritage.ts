import { CITY_TO_KANA } from './webglHeritageUtils';
import { HERITAGE_LIST } from '../data/heritageList';
import { RAIL_LINES } from '../data/railLines';
import { VOLCANOES } from '../data/volcanoes';
import { FAULTS } from '../data/faults';
import { getMarkdownParserScript } from '../utils/markdownRenderer';

function escH(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getWebGLHeritagePage(username: string): string {
  const safeUser = escH(username);
  const cityToKanaJson = JSON.stringify(CITY_TO_KANA);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0d1117">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="世界遺産地球儀">
<link rel="manifest" href="/manifest.json">
<title>世界遺産 地球儀</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; height:100dvh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:#0d1117; border-bottom:1px solid #30363d; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
h1 { font-size:14px; font-weight:700; }
.badge { background:#0c2d1a; color:#3fb950; font-size:10px; padding:2px 7px; border-radius:10px; font-weight:600; }
.body { position:relative; display:grid; grid-template-columns:1fr 260px; grid-template-rows:1fr; flex:1; min-height:0; }
@media(max-width:800px){ .body{ grid-template-columns:1fr; } .side{ display:none; } }
.canvas-wrap { position:relative; background:#000010; overflow:hidden; }
canvas { position:absolute; inset:0; width:100%; height:100%; cursor:grab; touch-action:none; display:block; }
canvas:active { cursor:grabbing; }
.hud { position:absolute; bottom:10px; left:10px; background:rgba(0,0,0,.7); border:1px solid #30363d; border-radius:6px; padding:6px 10px; font-size:11px; font-family:monospace; color:#58a6ff; line-height:1.9; pointer-events:none; }
#markers { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden; }
.mk { position:absolute; transform:translate(-50%,-50%); line-height:1; font-size:16px; text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,0.9); pointer-events:auto; cursor:pointer; user-select:none; -webkit-user-select:none; }
#mk-tooltip { position:fixed; background:rgba(13,17,23,0.97); border:1px solid #3fb950; border-radius:8px; padding:7px 12px; font-size:12px; color:#e6edf3; white-space:normal; min-width:180px; pointer-events:auto; opacity:0; transition:opacity .15s; z-index:60; transform:translate(-50%,-110%); line-height:1.7; }
.tt-name { white-space:nowrap; font-weight:700; font-size:13px; }
.tt-sub { white-space:nowrap; font-size:12px; margin-top:3px; }
#mk-tooltip.below { transform:translate(-50%, 14px); }
.side { background:#0d1117; border-left:1px solid #30363d; display:flex; flex-direction:column; overflow:hidden; }
.side-header { padding:10px 10px 8px; border-bottom:1px solid #21262d; flex-shrink:0; }
.side-title { font-size:10px; font-weight:700; color:#3fb950; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
.search-wrap { position:relative; }
.search-wrap input { width:100%; background:#161b22; border:1px solid #30363d; border-radius:6px; padding:6px 10px 6px 28px; color:#e6edf3; font-size:12px; outline:none; }
.search-wrap input:focus { border-color:#3fb950; }
.search-wrap input::placeholder { color:#484f58; }
.search-icon { position:absolute; left:9px; top:50%; transform:translateY(-50%); color:#484f58; font-size:12px; pointer-events:none; }
#result-count { font-size:10px; color:#484f58; margin-top:5px; text-align:right; }
.list-scroll { flex:1; overflow-y:auto; overflow-x:hidden; }
.list-scroll::-webkit-scrollbar { width:4px; }
.list-scroll::-webkit-scrollbar-track { background:#0d1117; }
.list-scroll::-webkit-scrollbar-thumb { background:#30363d; border-radius:2px; }
.site-item { display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid #161b22; cursor:pointer; transition:background .1s; border-left:3px solid transparent; }
.site-item:hover { background:#161b22; }
.site-item.active { background:rgba(255,240,30,0.09); border-left-color:#c8960a; }
.spd-row { padding:8px 10px 6px; border-bottom:1px solid #21262d; flex-shrink:0; }
.spd-row .ctrl-label { font-size:10px; font-weight:700; color:#3fb950; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; }
.site-thumb { width:48px; height:36px; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; border:1px solid #21262d; }
.site-body { flex:1; min-width:0; }
.site-top { display:flex; align-items:center; gap:4px; margin-bottom:2px; }
.site-flag { font-size:13px; flex-shrink:0; }
.site-name { font-size:11px; font-weight:600; color:#e6edf3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.site-meta { font-size:10px; color:#484f58; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.type-label { font-weight:600; }
.canvas-ctrl-btns { position:absolute; top:10px; right:10px; display:flex; flex-direction:row; gap:6px; z-index:5; }
.canvas-ctrl-btn { background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s,color .15s; }
.canvas-ctrl-btn:hover { background:rgba(13,17,23,1); border-color:#3fb950; }
.canvas-ctrl-btn.active { background:#0c2d1a; border-color:#3fb950; color:#3fb950; }
.dbg-rect { position:absolute; pointer-events:none; box-sizing:border-box; }
#dbg-globe-rect { border:1px dashed #3fb950; }
#dbg-zoom-rect { border:1px dashed #58a6ff; }
#box-select-overlay { position:absolute; border:2px dashed rgba(63,185,80,0.9); background:rgba(63,185,80,0.08); pointer-events:none; display:none; z-index:60; }
#dbg-info { position:absolute; bottom:10px; left:10px; background:rgba(0,0,0,.75); border:1px solid #21262d; border-radius:5px; padding:5px 9px; font-size:10px; font-family:monospace; color:#8b949e; line-height:1.7; pointer-events:none; z-index:6; }
.panel-tabs { display:flex; border-bottom:1px solid #21262d; flex-shrink:0; }
.panel-tab { flex:1; padding:8px 4px; font-size:11px; font-weight:600; color:#484f58; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; transition:color .15s,border-color .15s; }
.panel-tab:hover { color:#8b949e; }
.panel-tab.active { color:#3fb950; border-bottom-color:#3fb950; }
.panel-body { display:none; flex:1; flex-direction:column; overflow:hidden; }
.panel-body.visible { display:flex; }
.ctrl-panel { padding:14px 12px; display:flex; flex-direction:column; gap:14px; }
.ctrl-row { display:flex; flex-direction:column; gap:5px; }
.ctrl-label { font-size:11px; color:#8b949e; font-weight:600; }
.slider-row { display:flex; align-items:center; gap:8px; }
.slider-row input[type=range] { flex:1; accent-color:#3fb950; }
.sval { font-family:monospace; font-size:11px; color:#3fb950; min-width:36px; }
.ctrl-sep { border:none; border-top:1px solid #21262d; margin:0; }
.legend { display:flex; flex-direction:column; gap:7px; }
.legend-row { display:flex; align-items:center; gap:8px; font-size:12px; }
.legend-dot { font-size:16px; }
@media (display-mode: standalone) { .pwa-hide { display:none !important; } }
.tour-panel { display:none; flex-direction:column; flex:1; overflow:hidden; }
.tour-panel.visible { display:flex; }
.tour-panel-header { padding:8px 12px; background:#0d1117; border-bottom:1px solid #21262d; flex-shrink:0; display:flex; align-items:center; gap:8px; }
.tour-panel-title { font-size:12px; font-weight:700; color:#3fb950; flex:1; }
.tour-panel-count { font-size:11px; color:#484f58; }
.tour-list-scroll { flex:1; overflow-y:auto; }
.tour-item { display:flex; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid #161b22; cursor:pointer; transition:background .12s; }
.tour-item:hover { background:#161b22; }
.tour-item.active { background:#0c2d1a; border-left:3px solid #3fb950; padding-left:9px; }
.tour-item-num { font-size:10px; color:#484f58; font-variant-numeric:tabular-nums; min-width:22px; text-align:right; flex-shrink:0; }
.tour-item-body { flex:1; min-width:0; }
.tour-item-name { font-size:11px; font-weight:600; color:#e6edf3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tour-item-meta { font-size:10px; color:#484f58; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tour-item.active .tour-item-name { color:#3fb950; }
.stats-tab { flex:1; padding:9px 4px; font-size:12px; font-weight:600; color:#484f58; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; transition:color .15s,border-color .15s; }
.stats-tab:hover { color:#8b949e; }
.stats-tab.active { color:#3fb950; border-bottom-color:#3fb950; }
.stats-bar-row { display:flex; align-items:center; gap:8px; margin-bottom:9px; font-size:12px; }
.stats-bar-label { width:160px; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#e6edf3; }
.stats-bar-track { flex:1; height:12px; background:#161b22; border-radius:6px; overflow:hidden; }
.stats-bar-fill { height:100%; border-radius:6px; transition:width .4s; }
.stats-bar-num { width:56px; text-align:right; color:#8b949e; font-variant-numeric:tabular-nums; flex-shrink:0; }
.stats-section-title { font-size:11px; font-weight:700; color:#3fb950; text-transform:uppercase; letter-spacing:.5px; margin:12px 0 8px; }
.stats-type-card { display:flex; align-items:center; gap:12px; padding:10px 14px; background:#161b22; border-radius:8px; margin-bottom:8px; }
.stats-donut-wrap { position:relative; }
.stats-legend-list { display:flex; flex-direction:column; gap:7px; margin-top:4px; }
.stats-legend-item { display:flex; align-items:center; gap:7px; font-size:12px; }
.stats-legend-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.landing-overlay { display:none; position:fixed; inset:0; z-index:150; pointer-events:none; align-items:center; justify-content:flex-end; padding:0 0 40px; flex-direction:column; }
.landing-overlay.active { display:flex; }
.landing-card { background:rgba(13,17,23,0.97); border:1px solid #3fb950; border-radius:12px; padding:18px 28px; text-align:center; pointer-events:auto; min-width:300px; box-shadow:0 4px 32px rgba(63,185,80,0.2); }
.landing-site-name { font-size:16px; font-weight:700; color:#e6edf3; margin-bottom:4px; }
.landing-site-sub { font-size:12px; color:#8b949e; margin-bottom:10px; }
.landing-status-txt { font-size:13px; color:#3fb950; margin-bottom:8px; font-weight:600; }
.landing-prog-track { width:100%; height:6px; background:#21262d; border-radius:3px; overflow:hidden; margin-bottom:16px; }
.landing-prog-fill { height:100%; background:linear-gradient(90deg,#3fb950,#58a6ff); border-radius:3px; width:0%; transition:width 0.15s linear; }
.landing-exit-btn { background:#161b22; border:1px solid #3fb950; border-radius:6px; color:#3fb950; font-size:13px; padding:7px 20px; cursor:pointer; font-family:inherit; }
.landing-exit-btn:hover { background:#0c2d1a; }
.landing-btn-row { display:flex; gap:6px; align-items:center; justify-content:center; }
.landing-spin-btn { background:#161b22; border:1px solid #30363d; border-radius:6px; color:#8b949e; font-size:11px; padding:6px 10px; cursor:pointer; font-family:inherit; white-space:nowrap; }
.landing-spin-btn.active { border-color:#3fb950; color:#3fb950; }
.landing-spin-btn:hover { border-color:#58a6ff; color:#58a6ff; }
.landing-city-list { font-size:10px; color:#8b949e; margin-top:8px; text-align:left; max-height:90px; overflow-y:auto; border-top:1px solid #21262d; padding-top:6px; }
.landing-city-item { display:flex; justify-content:space-between; gap:8px; padding:1px 0; color:#c9d1d9; }
.landing-city-dist { color:#58a6ff; flex-shrink:0; }
.landing-city-loading { color:#8b949e; text-align:center; padding:4px; }
.landing-station-hdr { color:#58a6ff; font-weight:700; margin-bottom:2px; }
.rail-line-details { border-bottom:1px solid #21262d; padding:6px 0; }
.rail-line-details:last-child { border-bottom:none; }
.rail-line-summary { cursor:pointer; font-size:13px; font-weight:700; color:#e6edf3; display:flex; align-items:center; gap:8px; padding:4px 0; }
.rail-line-total { color:#58a6ff; font-size:11px; font-weight:600; margin-left:auto; flex-shrink:0; }
.rail-line-stations { padding:4px 0 4px 8px; }
.rail-station-coord { display:none; color:#8b949e; font-size:10px; font-family:monospace; flex-shrink:0; margin:0 8px; }
.rail-station-row { cursor:pointer; }
.rail-station-row:hover { background:#161b22; }
.rail-station-row:active { background:#1c2530; }
.rail-tour-btn { background:#161b22; border:1px solid #30363d; border-radius:6px; color:#8b949e; font-size:10px; padding:3px 8px; cursor:pointer; font-family:inherit; white-space:nowrap; margin-left:8px; }
.rail-tour-btn:hover { border-color:#58a6ff; color:#58a6ff; }
.rail-tour-btn.active { border-color:#3fb950; color:#3fb950; }
.rail-station-row.rail-tour-active { background:#0c2d1a; }
#rail-station-pin-route { font-size:10px; color:#8b949e; margin-top:2px; line-height:1.5; }
#rail-station-alight-btn { display:none; margin-top:6px; background:#0c2d1a; border:1px solid #3fb950; border-radius:6px; color:#3fb950; font-size:11px; padding:4px 12px; cursor:pointer; font-family:inherit; pointer-events:auto; }
.pin-label-close-btn { position:absolute; top:-9px; right:-9px; width:26px; height:26px; border-radius:50%; background:#21262d; border:1px solid #388bfd; color:#c9d1d9; font-size:12px; line-height:1; cursor:pointer; pointer-events:auto; padding:0; display:flex; align-items:center; justify-content:center; }
.pin-label-close-btn:hover { background:#30363d; color:#fff; }
.f1-side { display:none; position:absolute; left:0; top:0; bottom:0; width:min(85vw,280px); background:#0d1117; border-right:1px solid #30363d; z-index:90; flex-direction:column; box-shadow:4px 0 24px rgba(0,0,0,.7); }
.f1-side.open { display:flex; }
.f1-side-head { padding:12px 16px; border-bottom:1px solid #21262d; display:flex; align-items:center; gap:8px; flex-shrink:0; }
.f1-side-title { font-size:13px; font-weight:700; flex:1; color:#e6edf3; }
.f1-side-close { background:none; border:none; color:#8b949e; font-size:18px; cursor:pointer; padding:2px 6px; line-height:1; }
.f1-side-body { overflow-y:auto; flex:1; padding:6px 0; }
.f1-side-item { display:flex; align-items:center; gap:8px; padding:8px 14px; cursor:pointer; border-left:3px solid transparent; }
.f1-side-item:hover { background:#161b22; }
.f1-side-item.active { background:#0c2d1a; border-left-color:#3fb950; }
.f1-side-flag { font-size:16px; flex-shrink:0; }
.f1-side-info { flex:1; min-width:0; overflow:hidden; }
.f1-side-circuit { display:block; font-size:12px; font-weight:600; color:#e6edf3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.f1-side-date { display:block; font-size:10px; color:#8b949e; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px; }
@keyframes f1-flash { 0%,100%{outline:2px solid transparent} 50%{outline:2px solid #ffd700} }
.f1-side-item.f1-flash { animation:f1-flash 0.5s ease-in-out 3; }
@keyframes area-tour-flash { 0%,100%{outline:2px solid transparent} 40%{outline:2px solid #ffd700} 70%{outline:2px solid rgba(255,215,0,0.4)} }
.f1-side-item.area-tour-flash { animation:area-tour-flash 0.65s ease-in-out 2; }
.f1-cal { padding:10px 12px; border-bottom:1px solid #21262d; flex-shrink:0; }
.f1-cal-head { font-size:12px; font-weight:700; color:#e6edf3; text-align:center; margin-bottom:6px; }
.f1-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
.f1-cal-dow { font-size:9px; color:#8b949e; text-align:center; padding:2px 0; }
.f1-cal-cell { font-size:10px; color:#c9d1d9; text-align:center; padding:3px 0; border-radius:4px; outline:2px solid transparent; }
.f1-cal-empty { visibility:hidden; }
.f1-cal-target { background:#0c2d1a; color:#3fb950; font-weight:700; }
.f1-cal-cell.f1-cal-flash { animation:f1-flash 0.5s ease-in-out 3; }
#f1-tour-btn { pointer-events:auto; margin-top:6px; background:#0c2d1a; border:1px solid #3fb950; border-radius:6px; color:#3fb950; font-size:11px; padding:4px 12px; cursor:pointer; font-family:inherit; display:block; width:100%; }
#f1-tour-btn:hover { background:#0f3a22; }
.city-mk { position:absolute; transform:translate(-50%,-50%); background:rgba(13,17,23,0.92); border:1px solid #388bfd; border-radius:10px; color:#c9d1d9; font-size:9px; padding:2px 6px; white-space:nowrap; pointer-events:none; opacity:0; transition:opacity .3s; display:flex; align-items:center; gap:3px; }
.city-mk-dot { width:5px; height:5px; border-radius:50%; background:#388bfd; flex-shrink:0; }
.city-icon-btn { background:none; border:none; cursor:pointer; font-size:13px; line-height:1; padding:0 0 0 4px; opacity:.85; vertical-align:middle; }
.city-icon-btn:hover { opacity:1; }
.cities-modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.72); z-index:250; align-items:center; justify-content:center; }
.cities-modal-overlay.open { display:flex; }
.cities-modal { background:#0d1117; border:1px solid #30363d; border-radius:10px; width:min(90vw,480px); max-height:80vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 8px 40px rgba(0,0,0,.85); }
.cities-modal-head { padding:12px 16px; border-bottom:1px solid #21262d; display:flex; align-items:center; gap:8px; flex-shrink:0; }
.cities-modal-title { font-size:14px; font-weight:700; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cities-modal-close { background:none; border:none; color:#8b949e; font-size:18px; cursor:pointer; padding:2px 6px; line-height:1; }
.cities-modal-body { overflow-y:auto; padding:10px 16px 14px; }
.cities-modal-row { display:flex; align-items:center; gap:8px; padding:5px 0; border-bottom:1px solid #21262d; font-size:12px; }
.cities-modal-row:last-child { border-bottom:none; }
.cities-modal-flag { font-size:16px; flex-shrink:0; }
.cities-modal-name { flex:1; color:#c9d1d9; }
.cities-modal-pop { color:#8b949e; font-size:11px; flex-shrink:0; }
.cities-modal-dist { color:#58a6ff; font-size:11px; font-weight:600; flex-shrink:0; min-width:48px; text-align:right; }
.city-stats-row-btn { background:none; border:none; cursor:pointer; width:100%; text-align:left; padding:0; display:flex; align-items:center; gap:10px; border-radius:4px; transition:background .12s; }
.city-stats-row-btn:hover { background:rgba(56,139,253,.08); }
.ch-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.8); z-index:300; align-items:flex-start; justify-content:center; padding-top:40px; }
.ch-overlay.open { display:flex; }
.ch-panel { background:#0d1117; border:1px solid #30363d; border-radius:10px; width:min(92vw,560px); max-height:80vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 8px 48px rgba(0,0,0,.9); }
.ch-head { padding:12px 16px; border-bottom:1px solid #21262d; display:flex; align-items:center; gap:8px; flex-shrink:0; }
.ch-title { font-size:15px; font-weight:700; flex:1; }
.ch-badge { background:#0c2d1a; color:#3fb950; font-size:11px; padding:2px 8px; border-radius:10px; font-weight:600; }
.ch-close { background:none; border:none; color:#8b949e; font-size:18px; cursor:pointer; padding:2px 6px; line-height:1; }
.ch-body { overflow-y:auto; padding:8px 12px 14px; }
.ch-item { display:flex; align-items:center; gap:8px; padding:6px 6px; border-bottom:1px solid #21262d; cursor:pointer; border-radius:4px; transition:background .12s; }
.ch-item:last-child { border-bottom:none; }
.ch-item:hover { background:rgba(56,139,253,.08); }
.ch-item-emoji { font-size:18px; flex-shrink:0; width:28px; text-align:center; }
.ch-item-name { flex:1; font-size:12px; color:#c9d1d9; }
.ch-item-meta { font-size:10px; color:#8b949e; flex-shrink:0; }
.ch-item-year { font-size:10px; color:#8b949e; flex-shrink:0; min-width:36px; text-align:right; }
.ch-item-citycount { font-size:11px; color:#58a6ff; flex-shrink:0; min-width:44px; text-align:right; font-weight:600; }
.ch-item-total-btn { background:none; border:none; padding:0; cursor:pointer; color:#58a6ff; font-size:11px; font-weight:700; text-decoration:underline; text-decoration-style:dotted; }
.ch-item-total-btn:hover { color:#79c0ff; }
.cl-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:400; align-items:flex-start; justify-content:center; padding-top:40px; }
.cl-overlay.open { display:flex; }
.cl-panel { background:#0d1117; border:1px solid #30363d; border-radius:10px; width:min(92vw,520px); max-height:80vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 8px 48px rgba(0,0,0,.95); }
.cl-head { padding:12px 16px; border-bottom:1px solid #21262d; display:flex; align-items:center; gap:8px; flex-shrink:0; }
.cl-title { font-size:14px; font-weight:700; flex:1; }
.cl-badge { background:#0c2d1a; color:#3fb950; font-size:11px; padding:2px 8px; border-radius:10px; font-weight:600; }
.cl-close { background:none; border:none; color:#8b949e; font-size:18px; cursor:pointer; padding:2px 6px; line-height:1; }
.cl-body { overflow-y:auto; padding:8px 12px 14px; }
.cl-item { display:flex; align-items:center; gap:8px; padding:6px; border-bottom:1px solid #21262d; cursor:pointer; border-radius:4px; transition:background .12s; }
.cl-item:last-child { border-bottom:none; }
.cl-item:hover { background:rgba(56,139,253,.08); }
.cl-item-flag { font-size:15px; flex-shrink:0; }
.cl-item-name { flex:1; font-size:12px; color:#58a6ff; text-decoration:underline; text-underline-offset:2px; cursor:pointer; }
.cl-item-name:hover { color:#79c0ff; }
.cl-item-kana { font-size:11px; color:#8b949e; text-decoration:none; margin-left:4px; }
.cl-item-count { font-size:11px; color:#8b949e; font-weight:600; flex-shrink:0; min-width:44px; text-align:right; }
.ch2-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.9); z-index:500; align-items:flex-start; justify-content:center; padding-top:40px; }
.ch2-overlay.open { display:flex; }
.ch2-panel { background:#0d1117; border:1px solid #30363d; border-radius:10px; width:min(92vw,540px); max-height:80vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 8px 48px rgba(0,0,0,.98); }
.ch2-head { padding:12px 16px; border-bottom:1px solid #21262d; display:flex; align-items:center; gap:8px; flex-shrink:0; }
.ch2-title { font-size:14px; font-weight:700; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ch2-close { background:none; border:none; color:#8b949e; font-size:18px; cursor:pointer; padding:2px 6px; line-height:1; }
.ch2-body { overflow-y:auto; padding:8px 12px 14px; }
.ch2-item { display:flex; align-items:center; gap:8px; padding:7px 6px; border-bottom:1px solid #21262d; border-radius:4px; cursor:pointer; transition:background .12s; }
.ch2-item:last-child { border-bottom:none; }
.ch2-item:hover { background:rgba(56,139,253,.08); }
.ch2-item-emoji { font-size:16px; flex-shrink:0; width:24px; text-align:center; }
.ch2-item-name { flex:1; font-size:12px; color:#c9d1d9; }
.ch2-item-dist { font-size:11px; color:#58a6ff; font-weight:600; flex-shrink:0; min-width:56px; text-align:right; }
.city-fly-panel { display:none; position:fixed; width:min(88vw,300px); height:320px; min-width:180px; min-height:120px; background:#161b22; border:1px solid #30363d; border-radius:10px; z-index:300; flex-direction:column; box-shadow:0 6px 28px rgba(0,0,0,.85); overflow:hidden; resize:both; }
.city-fly-panel.open { display:flex; }
.city-fly-head { display:flex; align-items:center; gap:6px; padding:9px 12px; border-bottom:1px solid #21262d; flex-shrink:0; background:#0d1117; cursor:grab; user-select:none; -webkit-user-select:none; }
.city-fly-head.dragging { cursor:grabbing; }
.city-fly-city { flex:1; font-size:12px; font-weight:700; color:#e6edf3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.city-fly-count { font-size:10px; color:#3fb950; font-weight:600; flex-shrink:0; }
.city-fly-close { background:none; border:none; color:#8b949e; font-size:16px; cursor:pointer; padding:2px 4px; line-height:1; flex-shrink:0; }
.city-fly-body { flex:1; overflow-y:scroll; padding:6px 8px 10px; min-height:0; }
.city-fly-row { display:flex; align-items:center; gap:6px; padding:5px 4px; border-radius:4px; cursor:pointer; transition:background .12s; }
.city-fly-row:hover { background:rgba(56,139,253,.1); }
.city-fly-row-emoji { font-size:13px; flex-shrink:0; width:20px; text-align:center; }
.city-fly-row-flag { font-size:13px; flex-shrink:0; }
.city-fly-row-name { flex:1; font-size:11px; color:#c9d1d9; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.city-fly-row-dist { font-size:10px; color:#58a6ff; flex-shrink:0; font-weight:600; }
.mitokoro-md h1,.mitokoro-md h2,.mitokoro-md h3,.mitokoro-md h4,.mitokoro-md h5,.mitokoro-md h6 { color:#e6edf3; font-weight:700; margin:12px 0 6px; }
.mitokoro-md h1 { font-size:1.3em; } .mitokoro-md h2 { font-size:1.18em; } .mitokoro-md h3 { font-size:1.08em; }
.mitokoro-md p { margin:0 0 10px; }
.mitokoro-md ul,.mitokoro-md ol { margin:0 0 10px; padding-left:1.6em; }
.mitokoro-md li { margin:3px 0; }
.mitokoro-md blockquote { border-left:3px solid #388bfd; padding:6px 12px; margin:0 0 10px; background:rgba(56,139,253,0.08); border-radius:0 6px 6px 0; color:#8b949e; }
.mitokoro-md code { background:#161b22; padding:2px 5px; border-radius:4px; font-family:Monaco,Menlo,'Courier New',monospace; font-size:0.9em; }
.mitokoro-md pre { background:#161b22; padding:10px; border-radius:6px; overflow-x:auto; margin:0 0 10px; }
.mitokoro-md pre code { background:none; padding:0; }
.mitokoro-md a { color:#58a6ff; text-decoration:none; }
.mitokoro-md a:hover { text-decoration:underline; }
.mitokoro-md hr { border:none; border-top:1px solid #21262d; margin:12px 0; }
.mitokoro-md table { border-collapse:collapse; width:100%; margin:0 0 10px; font-size:0.95em; }
.mitokoro-md th,.mitokoro-md td { border:1px solid #21262d; padding:5px 8px; text-align:left; }
.mitokoro-md th { background:#161b22; }
</style>
</head>
<body>

<script id="vs" type="x-shader/x-vertex">
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec2 aUV;
uniform mat4 uMVP;
uniform mat4 uModel;
uniform vec3 uLight;
varying vec2 vUV;
varying float vDiff;
varying float vSpec;
varying float vRim;
void main() {
  vec3 wn = normalize((uModel * vec4(aNorm, 0.0)).xyz);
  vec3 wl = normalize(uLight);
  vDiff = max(dot(wn, wl), 0.0);
  vec3 toEye = normalize(vec3(0.0, 0.0, 1.0));
  vec3 halfv = normalize(wl + toEye);
  vSpec = pow(max(dot(wn, halfv), 0.0), 64.0);
  vRim  = pow(1.0 - abs(dot(wn, toEye)), 3.0);
  vUV = aUV;
  gl_Position = uMVP * vec4(aPos, 1.0);
}
</script>

<script id="fs" type="x-shader/x-fragment">
precision mediump float;
uniform sampler2D uTex;
varying vec2 vUV;
varying float vDiff;
varying float vSpec;
varying float vRim;
void main() {
  vec4 earth = texture2D(uTex, vUV);
  float isOcean = clamp((earth.b - earth.r * 0.8 - earth.g * 0.3) * 3.0, 0.0, 1.0);
  vec3 oceanColor = vec3(0.05, 0.18, 0.52);
  vec3 baseColor = mix(earth.rgb, oceanColor, isOcean);
  float amb = 0.25;
  vec3 col = baseColor * (amb + vDiff * (1.0 - amb));
  col += vec3(0.5, 0.8, 1.0) * vSpec * isOcean * 0.7;
  col += vec3(0.25, 0.55, 1.0) * vRim * 0.5;
  col += vec3(0.1,  0.3,  0.9) * vRim * vRim * 0.25;
  gl_FragColor = vec4(col, 1.0);
}
</script>

<div class="topbar">
  <h1>世界遺産 地球儀</h1>
  <span class="badge">世界遺産</span>
  <span style="flex:1"></span>
  <a href="/webgl-sphere" class="pwa-hide">&#9917; W杯</a>
  <a href="/webgl-lv-sphere" class="pwa-hide">🔮 LV Sphere</a>
  <a href="/webgl-faults" class="pwa-hide">🌐 活断層</a>
  <a href="/settings" class="pwa-hide">&#9881;</a>
  <span class="pwa-hide" style="color:#8b949e;font-size:11px">${safeUser}</span>
</div>

<div class="body">
  <div id="f1-side" class="f1-side">
    <div class="f1-side-head">
      <span class="f1-side-title">📅 F1 日程 2026 🏎️</span>
      <button class="f1-side-close" id="f1-side-close">✕</button>
    </div>
    <div class="f1-cal" id="f1-cal"></div>
    <div class="f1-side-body" id="f1-side-body"></div>
  </div>
  <div id="rail-side" class="f1-side">
    <div class="f1-side-head">
      <span class="f1-side-title">🚉 世界の鉄道路線</span>
      <button class="f1-side-close" id="rail-side-close">✕</button>
    </div>
    <div class="f1-side-body" id="rail-side-body"></div>
  </div>
  <div id="area-tour-side" class="f1-side">
    <div class="f1-side-head">
      <span class="f1-side-title" id="area-tour-side-title">📍 エリア巡回</span>
      <button class="f1-side-close" id="area-tour-side-close">✕</button>
    </div>
    <div class="f1-side-body" id="area-tour-side-body"></div>
  </div>
  <div class="canvas-wrap">
    <canvas id="c"></canvas>
    <div id="markers"></div>
    <div id="box-select-overlay"></div>
    <div class="hud" id="hud">テクスチャ読み込み中...</div>
    <div id="dbg-info"></div>
    <div class="dbg-rect" id="dbg-globe-rect"></div>
    <div class="dbg-rect" id="dbg-zoom-rect"></div>
    <div class="canvas-ctrl-btns">
      <button class="canvas-ctrl-btn" id="btnAxisLock">＋ 軸垂直固定</button>
      <button class="canvas-ctrl-btn" id="btnAutoRot">⏸ 自転停止</button>
      <button class="canvas-ctrl-btn" id="btnJapanTour">🗾 日本巡回</button>
      <button class="canvas-ctrl-btn" id="btnAmericaTour">🌎 アメリカ巡回</button>
      <button class="canvas-ctrl-btn" id="btnEuropeTour">🏰 ヨーロッパ巡回</button>
      <button class="canvas-ctrl-btn" id="btnAfricaTour">🌍 アフリカ巡回</button>
      <button class="canvas-ctrl-btn" id="btnStats">📊 内訳</button>
      <button class="canvas-ctrl-btn" id="btnCityStats">🌇 都市統計</button>
      <button class="canvas-ctrl-btn" id="btnBoxZoom">🔲 エリアズーム</button>
      <button class="canvas-ctrl-btn" id="btnRail">🚉 鉄道</button>
      <button class="canvas-ctrl-btn" id="btnF1">🏎️ F1</button>
    </div>
  </div>
  <div class="side">
    <div class="panel-tabs">
      <button class="panel-tab active" id="tabList">▼ 近接リスト</button>
      <button class="panel-tab" id="tabCtrl">⚙ コントロール</button>
    </div>

    <div class="panel-body visible" id="panelList">
      <div class="spd-row">
        <div class="ctrl-label">自転速度</div>
        <div class="slider-row">
          <input type="range" id="rotSpd" min="0" max="5" step="0.1" value="1">
          <span class="sval" id="rotSpdVal">1.0</span>
        </div>
      </div>
      <div class="side-header">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input type="search" id="searchInput" placeholder="遺産名・国・種別で検索...">
        </div>
        <div id="result-count"></div>
      </div>
      <div class="list-scroll" id="siteList"></div>
      <div class="tour-panel" id="tourPanel">
        <div class="tour-panel-header">
          <span class="tour-panel-title" id="tourPanelTitle">巡回リスト</span>
          <span class="tour-panel-count" id="tourPanelCount"></span>
        </div>
        <div class="tour-list-scroll" id="tourListScroll"></div>
      </div>
    </div>

    <div class="panel-body" id="panelCtrl">
      <div class="ctrl-panel">
        <div class="ctrl-row">
          <div class="ctrl-label">スピンブースト</div>
          <div class="slider-row">
            <input type="range" id="spinBoost" min="1" max="4" step="0.1" value="2">
            <span class="sval" id="spinBoostVal">2.0</span>
          </div>
        </div>
        <hr class="ctrl-sep">
        <div class="ctrl-row">
          <div class="ctrl-label">凡例</div>
          <div class="legend">
            <div class="legend-row"><span class="legend-dot">🏛️</span><span style="color:#e3a838;font-weight:600">文化遺産</span></div>
            <div class="legend-row"><span class="legend-dot">🌿</span><span style="color:#3fb950;font-weight:600">自然遺産</span></div>
            <div class="legend-row"><span class="legend-dot">⭐</span><span style="color:#a371f7;font-weight:600">複合遺産</span></div>
          </div>
        </div>
        <hr class="ctrl-sep">
        <div style="font-size:11px;color:#484f58;line-height:1.7">
          ドラッグ: 回転<br>
          ホイール: ズーム<br>
          フリック: 慣性スピン → 最寄り遺産スナップ<br>
          ダブルクリック: 自動回転 ON/OFF
        </div>
      </div>
    </div>
  </div>
</div>

<div id="mk-tooltip"></div>

<div class="landing-overlay" id="landing-overlay">
  <div class="landing-card">
    <div class="landing-site-name" id="landing-title"></div>
    <div class="landing-site-sub" id="landing-sub"></div>
    <div class="landing-status-txt" id="landing-status">着陸中...</div>
    <div class="landing-prog-track"><div class="landing-prog-fill" id="landing-prog"></div></div>
    <div class="landing-btn-row">
      <button class="landing-exit-btn" id="landing-exit">🚀 宇宙に戻る</button>
      <button class="landing-spin-btn" id="landing-spin-toggle">🔄 360°スイープ</button>
      <button class="landing-spin-btn" id="landing-wait-btn" style="user-select:none;-webkit-user-select:none">⏸ 待機</button>
    </div>
    <div class="landing-city-list" id="landing-city-list"></div>
    <div class="landing-city-list" id="landing-station-list"></div>
  </div>
</div>

<div id="city-markers-div" style="position:absolute;inset:0;pointer-events:none;display:none;overflow:hidden;"></div>

<div id="stats-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;align-items:center;justify-content:center;">
  <div id="stats-modal" style="background:#0d1117;border:1px solid #30363d;border-radius:10px;width:min(92vw,680px);max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.8);">
    <div style="padding:14px 18px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:10px;flex-shrink:0;">
      <span style="font-size:15px;font-weight:700;">📊 世界遺産 内訳統計</span>
      <span id="stats-total-badge" style="background:#0c2d1a;color:#3fb950;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;"></span>
      <span style="flex:1"></span>
      <button id="btnStatsClose" style="background:none;border:none;color:#8b949e;font-size:18px;cursor:pointer;line-height:1;padding:2px 6px;">✕</button>
    </div>
    <div style="display:flex;border-bottom:1px solid #21262d;flex-shrink:0;">
      <button class="stats-tab active" data-tab="region">🌐 地域別</button>
      <button class="stats-tab" data-tab="country">🏳️ 国別 Top30</button>
      <button class="stats-tab" data-tab="type">🏷️ 種別</button>
      <button class="stats-tab" data-tab="decade">📅 登録年代</button>
    </div>
    <div id="stats-body" style="flex:1;overflow-y:auto;padding:16px 18px;"></div>
  </div>
</div>

<div id="cities-modal-overlay" class="cities-modal-overlay">
  <div class="cities-modal">
    <div class="cities-modal-head">
      <span class="cities-modal-title" id="cities-modal-title">近隣都市</span>
      <button class="cities-modal-close" id="cities-modal-close">✕</button>
    </div>
    <div class="cities-modal-body" id="cities-modal-body"></div>
  </div>
</div>

<div id="city-stats-overlay" class="cities-modal-overlay">
  <div class="cities-modal" style="width:min(90vw,520px)">
    <div class="cities-modal-head">
      <span class="cities-modal-title">🌇 近隣都市データ 国別集計</span>
      <span id="city-stats-badge" style="background:#0c2d1a;color:#3fb950;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;"></span>
      <button class="cities-modal-close" id="city-stats-close">✕</button>
    </div>
    <div class="cities-modal-body" id="city-stats-body"></div>
  </div>
</div>

<div id="ch-overlay" class="ch-overlay">
  <div class="ch-panel">
    <div class="ch-head">
      <span class="ch-title" id="ch-title"></span>
      <span class="ch-badge" id="ch-badge"></span>
      <button class="ch-close" id="ch-close">✕</button>
    </div>
    <div class="ch-body" id="ch-body"></div>
  </div>
</div>

<div id="cl-overlay" class="cl-overlay">
  <div class="cl-panel">
    <div class="cl-head">
      <span class="cl-title" id="cl-title">都市一覧</span>
      <span class="cl-badge" id="cl-badge"></span>
      <button class="cl-close" id="cl-close">✕</button>
    </div>
    <div class="cl-body" id="cl-body"></div>
  </div>
</div>

<div id="ch2-overlay" class="ch2-overlay">
  <div class="ch2-panel">
    <div class="ch2-head">
      <span class="ch2-title" id="ch2-title"></span>
      <button class="ch2-close" id="ch2-close">✕</button>
    </div>
    <div class="ch2-body" id="ch2-body"></div>
  </div>
</div>

<div id="city-fly-panel" class="city-fly-panel">
  <div class="city-fly-head" id="city-fly-head">
    <span id="city-fly-flag" style="font-size:18px;flex-shrink:0"></span>
    <span id="city-fly-city" class="city-fly-city"></span>
    <span id="city-fly-count" class="city-fly-count"></span>
    <button id="city-fly-close" class="city-fly-close">✕</button>
  </div>
  <div id="city-fly-body" class="city-fly-body"></div>
</div>
<div id="city-fly-pin" style="display:none;position:fixed;font-size:22px;z-index:295;pointer-events:none;transform:translate(-50%,-100%);line-height:1">📍</div>
<div id="f1-circuit-pin" style="display:none;position:fixed;font-size:22px;z-index:295;pointer-events:none;transform:translate(-50%,-100%);line-height:1">🏎️</div>
<div id="f1-circuit-pin-label" style="display:none;position:fixed;z-index:296;pointer-events:none;background:rgba(13,17,23,0.92);border:1px solid #388bfd;border-radius:8px;color:#c9d1d9;padding:4px 9px;white-space:nowrap;text-align:center;line-height:1.4;transform:translate(-50%,calc(-100% - 30px))">
  <button id="f1-circuit-pin-close-btn" class="pin-label-close-btn" aria-label="閉じる">✕</button>
  <div id="f1-circuit-pin-name" style="font-weight:700;font-size:12px;pointer-events:auto;cursor:pointer;color:#58a6ff;text-decoration:none;"></div>
  <div id="f1-circuit-pin-date" style="opacity:.75;font-size:10px"></div>
  <button id="f1-tour-btn">🏁 巡回</button>
</div>
<div id="rail-station-pin" style="display:none;position:fixed;font-size:22px;z-index:295;pointer-events:none;transform:translate(-50%,-100%);line-height:1">🚉</div>
<div id="rail-station-pin-label" style="display:none;position:fixed;z-index:296;pointer-events:none;background:rgba(13,17,23,0.92);border:1px solid #388bfd;border-radius:8px;color:#c9d1d9;padding:4px 9px;white-space:nowrap;text-align:center;line-height:1.4;transform:translate(-50%,calc(-100% - 30px))">
  <button id="rail-station-pin-close-btn" class="pin-label-close-btn" aria-label="閉じる">✕</button>
  <div id="rail-station-pin-line" style="opacity:.75;font-size:10px"></div>
  <div id="rail-station-pin-name" style="font-weight:700;font-size:12px;pointer-events:auto;cursor:pointer;color:#58a6ff;text-decoration:none;"></div>
  <div id="rail-station-pin-route"></div>
  <button id="rail-station-alight-btn">🚶 途中下車</button>
</div>

<script>
(function() {
  var canvas = document.getElementById('c');
  var wrap   = canvas.parentElement;
  var hud         = document.getElementById('hud');
  var dbgInfo     = document.getElementById('dbg-info');
  var dbgGlobeRect = document.getElementById('dbg-globe-rect');
  var dbgZoomRect  = document.getElementById('dbg-zoom-rect');
  var markersDiv = document.getElementById('markers');
  var siteList = document.getElementById('siteList');
  var searchInput = document.getElementById('searchInput');
  var resultCount = document.getElementById('result-count');
  var tourPanel = document.getElementById('tourPanel');
  var tourListScroll = document.getElementById('tourListScroll');
  var tourPanelTitle = document.getElementById('tourPanelTitle');
  var tourPanelCount = document.getElementById('tourPanelCount');
  var tabList = document.getElementById('tabList');
  var tabCtrl = document.getElementById('tabCtrl');
  var panelList = document.getElementById('panelList');
  var panelCtrl = document.getElementById('panelCtrl');
  var rotSpdEl = document.getElementById('rotSpd');
  var rotSpdValEl = document.getElementById('rotSpdVal');
  var spinBoostEl = document.getElementById('spinBoost');
  var spinBoostValEl = document.getElementById('spinBoostVal');
  var btnAmericaTour = document.getElementById('btnAmericaTour');

  var isListMode = true;

  tabList.addEventListener('click', function() {
    isListMode = true;
    tabList.classList.add('active'); tabCtrl.classList.remove('active');
    panelList.classList.add('visible'); panelCtrl.classList.remove('visible');
  });
  tabCtrl.addEventListener('click', function() {
    isListMode = false;
    tabCtrl.classList.add('active'); tabList.classList.remove('active');
    panelCtrl.classList.add('visible'); panelList.classList.remove('visible');
  });
  rotSpdEl.addEventListener('input', function() { rotSpdValEl.textContent = parseFloat(rotSpdEl.value).toFixed(1); });
  spinBoostEl.addEventListener('input', function() {
    SPIN_BOOST = parseFloat(spinBoostEl.value);
    spinBoostValEl.textContent = SPIN_BOOST.toFixed(1);
  });

  function resize() {
    var r = wrap.getBoundingClientRect();
    var w = Math.round(r.width), h = Math.round(r.height);
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w; canvas.height = h;
    }
  }
  resize();
  window.addEventListener('resize', resize);

  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) { hud.textContent = 'WebGL が利用できません'; return; }

  function compileShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER,   document.getElementById('vs').textContent));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, document.getElementById('fs').textContent));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  var LAT = 64, LON = 128;
  var verts = [], idxs = [];
  for (var i = 0; i <= LAT; i++) {
    var theta = i / LAT * Math.PI;
    var sinT = Math.sin(theta), cosT = Math.cos(theta);
    for (var j = 0; j <= LON; j++) {
      var phi = j / LON * 2 * Math.PI;
      var x = -sinT * Math.cos(phi), y = cosT, z = sinT * Math.sin(phi);
      verts.push(x, y, z, x, y, z, j / LON, i / LAT);
    }
  }
  for (var i = 0; i < LAT; i++) {
    for (var j = 0; j < LON; j++) {
      var a = i * (LON + 1) + j, b = a + (LON + 1);
      idxs.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  var vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  var ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idxs), gl.STATIC_DRAW);

  var stride = 8 * 4;
  var aPos  = gl.getAttribLocation(prog, 'aPos');
  var aNorm = gl.getAttribLocation(prog, 'aNorm');
  var aUV   = gl.getAttribLocation(prog, 'aUV');
  gl.enableVertexAttribArray(aPos);  gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(aUV);   gl.vertexAttribPointer(aUV,   2, gl.FLOAT, false, stride, 24);

  var uMVP   = gl.getUniformLocation(prog, 'uMVP');
  var uModel = gl.getUniformLocation(prog, 'uModel');
  var uLight = gl.getUniformLocation(prog, 'uLight');
  var uTex   = gl.getUniformLocation(prog, 'uTex');
  gl.uniform1i(uTex, 0);

  function getSunDir() {
    var now = new Date();
    var utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    var sunLon = (utcH - 12) / 24 * 2 * Math.PI;
    var start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    var doy = Math.floor((now.getTime() - start.getTime()) / 86400000);
    var sunLat = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (doy - 80) / 365);
    return [Math.cos(sunLat) * Math.cos(sunLon), Math.sin(sunLat), Math.cos(sunLat) * Math.sin(sunLon)];
  }

  var texEarth = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texEarth);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 30, 70, 255]));
  var earthImg = new Image();
  earthImg.onload = function() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texEarth);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, earthImg);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };
  earthImg.onerror = function() { hud.textContent = 'テクスチャ読み込み失敗'; };
  earthImg.src = '/earth.jpg';

  function m4()      { return new Float32Array(16); }
  function ident(m)  { for(var i=0;i<16;i++) m[i]=0; m[0]=m[5]=m[10]=m[15]=1; return m; }
  function mul(o,a,b){ for(var i=0;i<4;i++) for(var j=0;j<4;j++){ var s=0; for(var k=0;k<4;k++) s+=a[i+k*4]*b[k+j*4]; o[i+j*4]=s; } return o; }
  function persp(m,fov,asp,near,far){ ident(m); var f=1/Math.tan(fov/2); m[0]=f/asp; m[5]=f; m[10]=(far+near)/(near-far); m[11]=-1; m[14]=2*far*near/(near-far); m[15]=0; return m; }
  function rotX(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[5]=c;m[6]=s;m[9]=-s;m[10]=c; return m; }
  function rotY(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[2]=-s;m[8]=s;m[10]=c; return m; }
  function rotZ(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[1]=s;m[4]=-s;m[5]=c; return m; }
  function rotAround(m,ax,ay,az,angle){ ident(m); var c=Math.cos(angle),s=Math.sin(angle),t=1-c; m[0]=t*ax*ax+c; m[4]=t*ax*ay-s*az; m[8]=t*ax*az+s*ay; m[1]=t*ax*ay+s*az; m[5]=t*ay*ay+c; m[9]=t*ay*az-s*ax; m[2]=t*ax*az-s*ay; m[6]=t*ay*az+s*ax; m[10]=t*az*az+c; return m; }
  function trans(m,x,y,z){ ident(m); m[12]=x;m[13]=y;m[14]=z; return m; }

  var axialTilt = -23.4 * Math.PI / 180;
  var ELEV_MAX = Math.PI / 2 - 0.02;
  function clampElev(v){ return v < -ELEV_MAX ? -ELEV_MAX : (v > ELEV_MAX ? ELEV_MAX : v); }

  var proj=m4(),view=m4(),model=m4(),rx=m4(),ry=m4(),tz=m4(),tmp=m4(),tmp2=m4(),mvp=m4(),landSpin=m4();
  var landingSpinAngle = 0;
  var rotXv = 0.3, rotYv = 0.6, zoom = 3.2, autoRot = true;
  var drag = false, lx = 0, ly = 0, pinch0 = 0, touchMoved = false;
  var axisLocked = false;

  var btnAxisLock = document.getElementById('btnAxisLock');
  var btnAutoRot  = document.getElementById('btnAutoRot');

  btnAxisLock.addEventListener('click', function() {
    axisLocked = !axisLocked;
    if (axisLocked) { rotXv = 0; btnAxisLock.classList.add('active'); btnAxisLock.textContent = '＋ 軸固定中'; }
    else { btnAxisLock.classList.remove('active'); btnAxisLock.textContent = '＋ 軸垂直固定'; }
  });
  btnAutoRot.addEventListener('click', function() {
    autoRot = !autoRot;
    btnAutoRot.textContent = autoRot ? '⏸ 自転停止' : '▶ 回転';
    if (autoRot) { btnAutoRot.classList.remove('active'); } else { btnAutoRot.classList.add('active'); }
  });

  var velY = 0, velX = 0, momentumY = 0, momentumX = 0;
  var MOMENTUM_DECAY = 0.94;
  var SPIN_BOOST = 2.0;
  var rotSpd = 1.0;

  function applyMomentum(vy, vx) {
    momentumY = vy * SPIN_BOOST;
    momentumX = axisLocked ? 0 : (vx * SPIN_BOOST);
  }

  var boxZoomMode = false;
  var boxZoomOverlay = document.getElementById('box-select-overlay');
  var bx0 = 0, by0 = 0, bxCur = 0, byCur = 0, boxDragging = false;
  var btnBoxZoom = document.getElementById('btnBoxZoom');
  var lastBoxBounds = null, areaMenuEl = null, areaTourTimer = null, areaTourIdx = 0, areaTourRunning = false, areaTourKind = null;

  btnBoxZoom.addEventListener('click', function() {
    boxZoomMode = !boxZoomMode;
    btnBoxZoom.classList.toggle('active', boxZoomMode);
    btnBoxZoom.textContent = boxZoomMode ? '🔲 選択中…' : '🔲 エリアズーム';
    canvas.style.cursor = boxZoomMode ? 'crosshair' : '';
  });

  function updateBoxOverlay() {
    var rect = canvas.getBoundingClientRect();
    var x1 = Math.min(bx0, bxCur) - rect.left, y1 = Math.min(by0, byCur) - rect.top;
    var x2 = Math.max(bx0, bxCur) - rect.left, y2 = Math.max(by0, byCur) - rect.top;
    boxZoomOverlay.style.left = x1 + 'px'; boxZoomOverlay.style.top = y1 + 'px';
    boxZoomOverlay.style.width = (x2 - x1) + 'px'; boxZoomOverlay.style.height = (y2 - y1) + 'px';
    boxZoomOverlay.style.display = 'block';
  }
  function mulMat3Vec3(m, x, y, z) { return [m[0]*x+m[1]*y+m[2]*z, m[3]*x+m[4]*y+m[5]*z, m[6]*x+m[7]*y+m[8]*z]; }
  function screenToLatLon(px, py, rect) {
    var ndcX = (px - rect.left) / rect.width * 2 - 1;
    var ndcY = -((py - rect.top) / rect.height * 2 - 1);
    var tanHF = Math.tan(Math.PI / 8), aspect = rect.width / rect.height;
    var rdx = ndcX * tanHF * aspect, rdy = ndcY * tanHF, rdz = -1;
    var rlen = Math.sqrt(rdx*rdx + rdy*rdy + rdz*rdz); rdx/=rlen; rdy/=rlen; rdz/=rlen;
    var mi = [model[0],model[1],model[2], model[4],model[5],model[6], model[8],model[9],model[10]];
    var ro = mulMat3Vec3(mi, 0, 0, zoom), rd = mulMat3Vec3(mi, rdx, rdy, rdz);
    var b2 = 2*(ro[0]*rd[0]+ro[1]*rd[1]+ro[2]*rd[2]);
    var cval = ro[0]*ro[0]+ro[1]*ro[1]+ro[2]*ro[2] - 1;
    var disc = b2*b2 - 4*cval;
    if (disc < 0) return null;
    var t = (-b2 - Math.sqrt(disc)) / 2;
    var hx = ro[0]+t*rd[0], hy = ro[1]+t*rd[1], hz = ro[2]+t*rd[2];
    return { lat: Math.asin(Math.max(-1, Math.min(1, hy))) * 180 / Math.PI, lon: Math.atan2(-hz, hx) * 180 / Math.PI };
  }

  // エリア内絞り込み・巡回ロジックの汎用化: アイコン種別ごとに個別実装せず、
  // AREA_KINDS の設定（データ取得・座標取得・ツールチップ描画）を areaTourStep 等の共通関数へ渡す方式にする。
  function inAreaBounds(lat, lon, b) {
    if (b.lonCross) return lat >= b.latMin && lat <= b.latMax && (lon >= b.lonMin || lon <= b.lonMax);
    return lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax;
  }
  function filterInBounds(list, getLatLon) {
    if (!lastBoxBounds) return [];
    var b = lastBoxBounds;
    return list.filter(function(item) { var p = getLatLon(item); return inAreaBounds(p[0], p[1], b); });
  }
  function getHeritagesInBounds() { return filterInBounds(HERITAGE, function(d) { return [d.lat, d.lon]; }); }
  function getStationsInBounds() {
    if (!lastBoxBounds) return [];
    var b = lastBoxBounds, result = [], seenNames = {};
    RAIL_LINES.forEach(function(line) {
      line.stations.forEach(function(st) {
        if (seenNames[st.name]) return;
        if (inAreaBounds(st.lat, st.lon, b)) { result.push({ st: st, line: line }); seenNames[st.name] = true; }
      });
    });
    return result;
  }
  function getF1InBounds() { return filterInBounds(F1_CIRCUITS, function(r) { return [r.lat, r.lon]; }); }
  function getVolcanoesInBounds() { return filterInBounds(VOLCANOES, function(v) { return [v.lat, v.lon]; }); }
  function getFaultsInBounds() { return filterInBounds(FAULTS, function(f) { return [f.lat, f.lon]; }); }

  function showGenericAreaTooltip(html) {
    tooltip.innerHTML = html;
    var cx = canvasRect.left + canvasRect.width / 2;
    var cy = canvasRect.top + canvasRect.height / 2;
    positionTooltip(cx, cy);
    tooltip.style.opacity = '1';
  }

  var AREA_KINDS = [
    {
      key: 'heritage', icon: '🏛️', label: '世界遺産', color: '#3fb950', bg: '#0c2d1a',
      getItems: function() { return getHeritagesInBounds(); },
      locate: function(d) { return [d.lat, d.lon]; },
      itemLabel: function(d) { return d.f + ' ' + d.n; },
      showTooltip: function(d) { showMarkerTooltip(HERITAGE.indexOf(d), 0, 0); }
    },
    {
      key: 'station', icon: '🚉', label: '駅', color: '#58a6ff', bg: '#0c2233',
      getItems: function() { return getStationsInBounds(); },
      locate: function(item) { return [item.st.lat, item.st.lon]; },
      itemLabel: function(item) { return item.line.flag + ' ' + item.st.name; },
      showTooltip: function(item) {
        railStationPin.style.display = 'block';
        railStationPinLabel.style.display = 'block';
        showRailStationPin(item.line, item.st, item.line.stations.indexOf(item.st));
      },
      hideExtra: function() {
        railStationPin.style.display = 'none';
        railStationPinLabel.style.display = 'none';
        railStationPin3d = null;
      }
    },
    {
      key: 'f1', icon: '🏎️', label: 'F1会場', color: '#f0883e', bg: '#2d1c0c',
      getItems: function() { return getF1InBounds(); },
      locate: function(r) { return [r.lat, r.lon]; },
      itemLabel: function(r) { return r.flag + ' ' + r.circuit; },
      showTooltip: function(r) {
        showGenericAreaTooltip('<div class="tt-name">🏎️ ' + r.flag + ' ' + r.circuit + '</div><div class="tt-sub">' + r.gp + '　' + r.date + '</div>');
      }
    },
    {
      key: 'volcano', icon: '🌋', label: '活火山', color: '#ff9500', bg: '#2d1a0c',
      getItems: function() { return getVolcanoesInBounds(); },
      locate: function(v) { return [v.lat, v.lon]; },
      itemLabel: function(v) { return v.n; },
      showTooltip: function(v) {
        showGenericAreaTooltip('<div class="tt-name">🌋 ' + v.n + '</div><div class="tt-sub">' + v.c + '　標高' + v.elev + 'm　最終噴火: ' + v.lastErupt + '</div>');
      }
    },
    {
      key: 'fault', icon: '🌐', label: '活断層', color: '#f85149', bg: '#2d0c0c',
      getItems: function() { return getFaultsInBounds(); },
      locate: function(f) { return [f.lat, f.lon]; },
      itemLabel: function(f) { return f.n; },
      showTooltip: function(f) {
        showGenericAreaTooltip('<div class="tt-name">🌐 ' + f.n + '</div><div class="tt-sub">' + f.region + '　' + f.country + '　M' + f.maxMag + '</div>');
      }
    }
  ];

  function findAreaKind(key) {
    for (var i = 0; i < AREA_KINDS.length; i++) { if (AREA_KINDS[i].key === key) return AREA_KINDS[i]; }
    return null;
  }

  function fitAreaTourSideWidth(kind, items) {
    if (!areaTourSide) return;
    if (items.length === 0) { areaTourSide.style.width = ''; return; }
    var probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;';
    probe.className = 'f1-side-body';
    items.forEach(function(item) {
      var row = document.createElement('div');
      row.className = 'f1-side-item';
      row.innerHTML = '<span class="f1-side-flag">' + kind.icon + '</span><span class="f1-side-info" style="overflow:visible"><span class="f1-side-circuit" style="white-space:nowrap;overflow:visible;display:inline-block">' + kind.itemLabel(item) + '</span></span>';
      probe.appendChild(row);
    });
    document.body.appendChild(probe);
    var rows = probe.querySelectorAll('.f1-side-item'), maxWidth = 0;
    for (var i = 0; i < rows.length; i++) { maxWidth = Math.max(maxWidth, rows[i].getBoundingClientRect().width); }
    document.body.removeChild(probe);
    // 一番長い駅名(等)を基準にパネル幅を決めることで、行内の左右パディングが均等になるようにする
    var width = Math.max(180, Math.min(window.innerWidth * 0.85, Math.ceil(maxWidth) + 2));
    areaTourSide.style.width = width + 'px';
  }

  function renderAreaTourSide(kind, items) {
    if (!areaTourSide) return;
    areaTourSideTitle.textContent = kind.icon + ' ' + kind.label + ' 巡回先';
    areaTourSideBody.innerHTML = items.map(function(item, i) {
      return '<div class="f1-side-item" data-idx="' + i + '"><span class="f1-side-flag">' + kind.icon + '</span><span class="f1-side-info"><span class="f1-side-circuit">' + kind.itemLabel(item) + '</span></span></div>';
    }).join('');
    areaTourSide.classList.add('open');
    fitAreaTourSideWidth(kind, items);
  }

  var AREA_TOUR_FLASH_MS = 1300;

  function flashAreaTourSideItem(idx) {
    if (!areaTourSideBody) return;
    // F1側パネル(focusF1Circuit)と同じ .active クラスを使い、現在の巡回先の行の背景色を
    // 薄緑にして行頭に緑のアクセント枠を表示する(.f1-side-item.active を再利用)
    areaTourSideBody.querySelectorAll('.f1-side-item').forEach(function(row) {
      row.classList.toggle('active', parseInt(row.getAttribute('data-idx'), 10) === idx);
    });
    var el = areaTourSideBody.querySelector('.f1-side-item[data-idx="' + idx + '"]');
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('area-tour-flash');
    void el.offsetWidth;
    el.classList.add('area-tour-flash');
    setTimeout(function() { el.classList.remove('area-tour-flash'); }, AREA_TOUR_FLASH_MS);
  }

  function renderAreaMenu() {
    if (!areaMenuEl) return;
    var entries = AREA_KINDS.map(function(k) { return { kind: k, items: k.getItems() }; });
    var hasAny = entries.some(function(e) { return e.items.length >= 2; });
    var buttonsHtml = entries.map(function(e) {
      if (e.items.length < 2) return '';
      var isActive = areaTourRunning && areaTourKind === e.kind;
      var disabled = areaTourRunning && !isActive;
      var label = isActive
        ? '⏹ 停止 (' + (areaTourIdx + 1) + '/' + e.items.length + ')'
        : e.kind.icon + ' ' + e.kind.label + '(' + e.items.length + ')';
      return '<button class="area-kind-btn" data-kind="' + e.kind.key + '" style="width:100%;background:' + e.kind.bg + ';border:1px solid ' + e.kind.color + ';border-radius:6px;color:' + e.kind.color + ';font-size:11px;padding:6px 8px;margin-top:6px;cursor:pointer;opacity:' + (disabled ? '0.4' : '1') + '" ' + (disabled ? 'disabled' : '') + '>' + label + '</button>';
    }).join('');
    areaMenuEl.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px"><span style="font-size:11px;font-weight:700;color:#3fb950">📍 エリアメニュー</span><span id="areaMenuClose" style="cursor:pointer;color:#8b949e;font-size:14px;padding:0 3px;line-height:1">✕</span></div>' +
      (hasAny ? buttonsHtml : '<div style="font-size:10px;color:#8b949e">エリア内に2件以上のアイコンがありません</div>') +
      '<div id="areaTourProg" style="font-size:10px;color:#8b949e;text-align:center;margin-top:6px;min-height:14px"></div>';
    document.getElementById('areaMenuClose').addEventListener('click', function(){ stopAreaTour(true); });
    var kindBtns = areaMenuEl.querySelectorAll('.area-kind-btn');
    for (var bi = 0; bi < kindBtns.length; bi++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          var kind = findAreaKind(btn.getAttribute('data-kind'));
          if (!kind) return;
          if (areaTourRunning && areaTourKind === kind) { stopAreaTour(false); }
          else if (!areaTourRunning) { startAreaTour(kind); }
        });
      })(kindBtns[bi]);
    }
  }

  function stopAreaTour(completed) {
    areaTourRunning = false;
    if (areaTourTimer) { clearTimeout(areaTourTimer); areaTourTimer = null; }
    hideTooltip();
    if (areaTourKind && areaTourKind.hideExtra) areaTourKind.hideExtra();
    areaTourKind = null;
    renderAreaMenu();
    var prog = document.getElementById('areaTourProg');
    if (prog) prog.textContent = '';
    if (completed) {
      lastBoxBounds = null;
      if (areaMenuEl) areaMenuEl.style.display = 'none';
      if (areaTourSide) areaTourSide.classList.remove('open');
      boxZoomOverlay.style.display = 'none';
      boxZoomMode = false; btnBoxZoom.classList.remove('active'); btnBoxZoom.textContent = '🔲 エリアズーム'; canvas.style.cursor = '';
    }
  }
  function showAreaMenu() {
    if (!areaMenuEl) { areaMenuEl = document.createElement('div'); areaMenuEl.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:rgba(13,17,23,0.94);border:1px solid #30363d;border-radius:9px;padding:10px 12px;z-index:55;width:190px;box-shadow:0 4px 16px rgba(0,0,0,0.6);'; wrap.appendChild(areaMenuEl); }
    areaMenuEl.style.display = 'block';
    renderAreaMenu();
  }
  function startAreaTour(kind) {
    var items = kind.getItems();
    if (items.length === 0) return;
    areaTourRunning = true;
    areaTourKind = kind;
    areaTourIdx = 0;
    renderAreaTourSide(kind, items);
    areaTourStep(kind, items);
  }
  function areaTourStep(kind, items) {
    // 巡回が自然に終わった場合は completed=false 扱いにし、エリア選択枠・エリアメニューを
    // 消さずに残す（巡回後の作業のため、明示的な✕クリック以外では枠を消さない）
    if (!areaTourRunning || areaTourIdx >= items.length) { stopAreaTour(false); return; }
    var d = items[areaTourIdx], pos = kind.locate(d);
    renderAreaMenu();
    flashAreaTourSideItem(areaTourIdx);
    var prog = document.getElementById('areaTourProg');
    if (prog) prog.textContent = (areaTourIdx + 1) + ' / ' + items.length;
    flyTo(pos[0], pos[1]);
    areaTourTimer = setTimeout(function() {
      if (!areaTourRunning) return;
      kind.showTooltip(d);
      areaTourTimer = setTimeout(function() {
        if (!areaTourRunning) return;
        hideTooltip();
        if (kind.hideExtra) kind.hideExtra();
        areaTourIdx++;
        areaTourStep(kind, items);
      }, 5000);
    }, FLY_DUR + 100);
  }
  function applyBoxZoom(ex, ey) {
    var rect = canvas.getBoundingClientRect();
    var bw = Math.abs(ex - bx0), bh = Math.abs(ey - by0);
    if (bw < 10 || bh < 10) { boxZoomOverlay.style.display = 'none'; return; }
    var ctr = screenToLatLon((bx0 + ex) / 2, (by0 + ey) / 2, rect);
    if (!ctr) { boxZoomOverlay.style.display = 'none'; return; }
    bxCur = ex; byCur = ey;
    updateBoxOverlay();
    var c0 = screenToLatLon(Math.min(bx0, ex), Math.min(by0, ey), rect);
    var c1 = screenToLatLon(Math.max(bx0, ex), Math.max(by0, ey), rect);
    if (c0 && c1) {
      var lonCross = c0.lon > c1.lon;
      lastBoxBounds = {
        latMin: Math.min(c0.lat, c1.lat), latMax: Math.max(c0.lat, c1.lat),
        lonMin: lonCross ? c0.lon : Math.min(c0.lon, c1.lon), lonMax: lonCross ? c1.lon : Math.max(c0.lon, c1.lon),
        lonCross: lonCross,
        center: { lat: ctr.lat, lon: ctr.lon },
        corner0: { lat: c0.lat, lon: c0.lon },
        corner1: { lat: c1.lat, lon: c1.lon }
      };
    }
    stopAreaTour(false);
    if (areaMenuEl) areaMenuEl.style.display = 'none';
    var fraction = Math.min(bw / rect.width, bh / rect.height);
    var newZoom = Math.max(1.2, Math.min(10, zoom * Math.max(0.18, fraction)));
    flyTo(ctr.lat, ctr.lon);
    setTimeout(function() {
      zoom = newZoom;
      if (lastBoxBounds) showAreaMenu();
    }, FLY_DUR + 100);
  }

  canvas.addEventListener('mousedown',  function(e){ if(boxZoomMode){ boxDragging=true; bx0=e.clientX; by0=e.clientY; bxCur=bx0; byCur=by0; return; } drag=true; lx=e.clientX; ly=e.clientY; momentumY=0; momentumX=0; velY=0; velX=0; });
  window.addEventListener('mouseup',    function(e){ if(boxDragging){ boxDragging=false; applyBoxZoom(e.clientX, e.clientY); return; } if(!drag)return; drag=false; applyMomentum(velY, velX); velY=0; velX=0; });
  window.addEventListener('mousemove',  function(e){ if(boxDragging){ bxCur=e.clientX; byCur=e.clientY; updateBoxOverlay(); return; } if(!drag)return; var dy=(e.clientX-lx)*0.008; var dx=(e.clientY-ly)*0.008; rotYv+=dy; velY=velY*0.4+dy*0.6; if(!axisLocked){rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6;} lx=e.clientX; ly=e.clientY; });
  canvas.addEventListener('wheel',      function(e){ e.preventDefault(); zoom=Math.max(1.2,Math.min(10,zoom+e.deltaY*0.01)); },{passive:false});
  canvas.addEventListener('dblclick',   function(){ autoRot=!autoRot; btnAutoRot.textContent=autoRot?'⏸ 自転停止':'▶ 回転'; if(autoRot){btnAutoRot.classList.remove('active');}else{btnAutoRot.classList.add('active');} });
  canvas.addEventListener('touchstart', function(e){ e.preventDefault(); touchMoved=false; momentumY=0; momentumX=0; velY=0; velX=0; if(e.touches.length===1){ if(boxZoomMode){ boxDragging=true; bx0=e.touches[0].clientX; by0=e.touches[0].clientY; bxCur=bx0; byCur=by0; return; } drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){pinch0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);} },{passive:false});
  canvas.addEventListener('touchmove',  function(e){ e.preventDefault(); touchMoved=true; if(e.touches.length===1&&boxDragging){ bxCur=e.touches[0].clientX; byCur=e.touches[0].clientY; updateBoxOverlay(); return; } if(e.touches.length===1&&drag){var dy=(e.touches[0].clientX-lx)*0.008; var dx=(e.touches[0].clientY-ly)*0.008; rotYv+=dy; velY=velY*0.4+dy*0.6; if(!axisLocked){rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6;} lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);zoom=Math.max(1.2,Math.min(10,zoom-(d-pinch0)*0.02));pinch0=d;} },{passive:false});
  canvas.addEventListener('touchend', function(e){
    if (boxDragging && e.changedTouches.length === 1) { boxDragging=false; applyBoxZoom(e.changedTouches[0].clientX, e.changedTouches[0].clientY); return; }
    drag=false;
    applyMomentum(velY, velX); velY=0; velX=0;
    if (!touchMoved && e.changedTouches.length === 1) { momentumY=0; momentumX=0; hideTooltip(); }
  });

  var HERITAGE = ${JSON.stringify(HERITAGE_LIST)};

  var RAIL_LINES = ${JSON.stringify(RAIL_LINES)};

  var F1_CIRCUITS = [
    { gp:'オーストラリアGP', circuit:'アルバートパーク・サーキット', flag:'🇦🇺', country:'オーストラリア', date:'2026-03-08', lat:-37.8497, lon:144.9680 },
    { gp:'中国GP', circuit:'上海国際サーキット', flag:'🇨🇳', country:'中国', date:'2026-03-15', lat:31.3389, lon:121.2200 },
    { gp:'日本GP', circuit:'鈴鹿サーキット', flag:'🇯🇵', country:'日本', date:'2026-03-29', lat:34.8431, lon:136.5410 },
    { gp:'マイアミGP', circuit:'マイアミ・インターナショナル・オートドローム', flag:'🇺🇸', country:'アメリカ', date:'2026-05-03', lat:25.9581, lon:-80.2389 },
    { gp:'カナダGP', circuit:'ジル・ヴィルヌーヴ・サーキット', flag:'🇨🇦', country:'カナダ', date:'2026-05-24', lat:45.5000, lon:-73.5228 },
    { gp:'モナコGP', circuit:'モンテカルロ市街地サーキット', flag:'🇲🇨', country:'モナコ', date:'2026-06-07', lat:43.7347, lon:7.4206 },
    { gp:'バルセロナ・カタルーニャGP', circuit:'カタルーニャ・サーキット', flag:'🇪🇸', country:'スペイン', date:'2026-06-14', lat:41.5700, lon:2.2611 },
    { gp:'オーストリアGP', circuit:'レッドブル・リンク', flag:'🇦🇹', country:'オーストリア', date:'2026-06-28', lat:47.2197, lon:14.7647 },
    { gp:'イギリスGP', circuit:'シルバーストン・サーキット', flag:'🇬🇧', country:'イギリス', date:'2026-07-05', lat:52.0786, lon:-1.0169 },
    { gp:'ベルギーGP', circuit:'スパ・フランコルシャン・サーキット', flag:'🇧🇪', country:'ベルギー', date:'2026-07-19', lat:50.4372, lon:5.9714 },
    { gp:'ハンガリーGP', circuit:'ハンガロリンク', flag:'🇭🇺', country:'ハンガリー', date:'2026-07-26', lat:47.5789, lon:19.2486 },
    { gp:'オランダGP', circuit:'ザントフォールト・サーキット', flag:'🇳🇱', country:'オランダ', date:'2026-08-23', lat:52.3888, lon:4.5409 },
    { gp:'イタリアGP', circuit:'モンツァ・サーキット', flag:'🇮🇹', country:'イタリア', date:'2026-09-06', lat:45.6156, lon:9.2811 },
    { gp:'スペイン(マドリード)GP', circuit:'マドリング市街地サーキット', flag:'🇪🇸', country:'スペイン', date:'2026-09-13', lat:40.4650, lon:-3.6089 },
    { gp:'アゼルバイジャンGP', circuit:'バクー市街地サーキット', flag:'🇦🇿', country:'アゼルバイジャン', date:'2026-09-27', lat:40.3725, lon:49.8533 },
    { gp:'シンガポールGP', circuit:'マリーナベイ市街地サーキット', flag:'🇸🇬', country:'シンガポール', date:'2026-10-11', lat:1.2914, lon:103.8640 },
    { gp:'アメリカGP', circuit:'サーキット・オブ・ジ・アメリカズ', flag:'🇺🇸', country:'アメリカ', date:'2026-10-25', lat:30.1328, lon:-97.6411 },
    { gp:'メキシコGP', circuit:'エルマノス・ロドリゲス・サーキット', flag:'🇲🇽', country:'メキシコ', date:'2026-11-01', lat:19.4042, lon:-99.0907 },
    { gp:'ブラジルGP', circuit:'インテルラゴス・サーキット', flag:'🇧🇷', country:'ブラジル', date:'2026-11-08', lat:-23.7036, lon:-46.6997 },
    { gp:'ラスベガスGP', circuit:'ラスベガス・ストリップ・サーキット', flag:'🇺🇸', country:'アメリカ', date:'2026-11-21', lat:36.1147, lon:-115.1728 },
    { gp:'カタールGP', circuit:'ロサイル・インターナショナル・サーキット', flag:'🇶🇦', country:'カタール', date:'2026-11-29', lat:25.4900, lon:51.4542 },
    { gp:'アブダビGP', circuit:'ヤス・マリーナ・サーキット', flag:'🇦🇪', country:'アラブ首長国連邦', date:'2026-12-06', lat:24.4672, lon:54.6031 }
  ];

  var VOLCANOES = ${JSON.stringify(VOLCANOES)};

  var FAULTS = ${JSON.stringify(FAULTS.map(function(f) { return { id: f.id, n: f.n, t: f.t, region: f.region, country: f.country, maxMag: f.maxMag, lastMajor: f.lastMajor, lat: f.center[0], lon: f.center[1] }; }))};

  function typeColor(t) {
    return t === '文化遺産' ? '#e3a838' : (t === '自然遺産' ? '#3fb950' : '#a371f7');
  }
  function thumbBg(t) {
    return t === '文化遺産' ? '#1a0d00' : (t === '自然遺産' ? '#0a1e0a' : '#100a20');
  }

  function latLonTo3D(lat, lon) {
    var latR = lat * Math.PI / 180;
    var lonR = lon * Math.PI / 180;
    return [Math.cos(latR) * Math.cos(lonR), Math.sin(latR), -Math.cos(latR) * Math.sin(lonR)];
  }

  var flyTarget = null, flyFrom = null, flyStart = 0;
  var FLY_DUR = 2500;

  var landingMode = false;
  var landingIdx = -1;
  var landingPhase = 0;
  var landingPhaseStart = 0;
  var landingZoomFrom = 3.2;
  var landingRotStart = 0;
  var landingRotXFrom = 0;
  var landingZoomOutFrom = 1.12;
  var LANDING_ZOOM_TARGET = 1.12;
  var LANDING_ZOOM_RETURN = 3.5;
  var LANDING_ZOOM_IN_DUR = 1750;
  var LANDING_ROT_DUR = 4667;
  var LANDING_ZOOM_OUT_DUR = 2500;
  var landingOverlayEl = null;
  var landingTitleEl = null;
  var landingSubEl = null;
  var landingStatusEl = null;
  var landingProgEl = null;
  var landingCityListEl = null;
  var landingStationListEl = null;
  var landingSpinToggleEl = null;
  var landingWaitBtnEl = null;
  var spin360Enabled = false;
  var landingWaiting = false;
  var landingLastFrameTime = 0;
  var landingCities = [];
  var cityMkEls = [];
  var cityMarkersDiv = null;
  var hasCityDataSet = {};
  var hasStationDataSet = {};
  var heritageMitokoroGemmaShareId = {};
  var heritageMitokoroLlamaShareId = {};

  fetch('/api/heritage-city-fetched-list').then(function(r){ return r.json(); }).then(function(d){
    if(d && d.names) { d.names.forEach(function(n){ hasCityDataSet[n] = true; }); updateCityIcons(); }
  }).catch(function(){});

  fetch('/api/rail-station-fetched-list').then(function(r){ return r.json(); }).then(function(d){
    if(d && d.names) { d.names.forEach(function(n){ hasStationDataSet[n] = true; }); }
  }).catch(function(){});

  fetch('/api/aichat/check-heritage-mitokoro-gemma-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ heritages: HERITAGE.map(function(d) { return d.n; }) })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d && d.cached) heritageMitokoroGemmaShareId = d.cached;
  }).catch(function(){});

  fetch('/api/aichat/check-heritage-mitokoro-llama-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ heritages: HERITAGE.map(function(d) { return d.n; }) })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d && d.cached) heritageMitokoroLlamaShareId = d.cached;
  }).catch(function(){});

  function cacheStationCities(name, lat, lon) {
    fetch('/api/rail-station-cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, lat: lat, lon: lon })
    }).then(function(r){ return r.json(); }).then(function(d){
      if(d && d.fetched && d.cities && d.cities.length > 0) { hasStationDataSet[name] = true; }
    }).catch(function(){});
  }

  function haversineKm(la1, lo1, la2, lo2) {
    var R = 6371;
    var dLa = (la2 - la1) * Math.PI / 180;
    var dLo = (lo2 - lo1) * Math.PI / 180;
    var a = Math.sin(dLa/2)*Math.sin(dLa/2) + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)*Math.sin(dLo/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function railLineTotalKm(line) {
    var total = 0;
    for (var i = 1; i < line.stations.length; i++) {
      total += haversineKm(line.stations[i-1].lat, line.stations[i-1].lon, line.stations[i].lat, line.stations[i].lon);
    }
    return total;
  }

  function railLineCumulativeKm(line) {
    var cum = [0];
    for (var i = 1; i < line.stations.length; i++) {
      cum.push(cum[i-1] + haversineKm(line.stations[i-1].lat, line.stations[i-1].lon, line.stations[i].lat, line.stations[i].lon));
    }
    return cum;
  }

  function renderRailSideBody() {
    var html = '';
    RAIL_LINES.forEach(function(line, li) {
      var total = railLineTotalKm(line);
      html += '<div class="rail-line-details">' +
        '<div class="rail-line-summary">' + line.flag + ' ' + line.name +
          '<span class="rail-line-total">全長 ' + total.toFixed(1) + ' km</span>' +
          '<button class="rail-tour-btn" data-line-idx="' + li + '">🚉 巡回</button>' +
        '</div>' +
        '<div class="rail-line-stations">';
      line.stations.forEach(function(st, si) {
        var segStr = si === 0 ? '起点' : ('+' + haversineKm(line.stations[si-1].lat, line.stations[si-1].lon, st.lat, st.lon).toFixed(1) + ' km');
        var cacheIcon = hasStationDataSet[st.name] ? '🚉 ' : '';
        html += '<div class="cities-modal-row rail-station-row" data-line-idx="' + li + '" data-station-idx="' + si + '" data-name="' + st.name + '" data-line="' + line.flag + ' ' + line.name + '" data-lat="' + st.lat + '" data-lon="' + st.lon + '">' +
          '<span class="cities-modal-name">' + cacheIcon + (si + 1) + '. ' + st.name + '</span>' +
          '<span class="rail-station-coord">' + st.lat.toFixed(3) + ', ' + st.lon.toFixed(3) + '</span>' +
          '<span class="cities-modal-dist">' + segStr + '</span>' +
          '</div>';
      });
      html += '</div></div>';
    });
    return html;
  }

  function showRailStationPin(line, station, stationIdx) {
    var cum = railLineCumulativeKm(line);
    var total = cum[cum.length - 1];
    var originName = line.stations[0].name;
    var terminalName = line.stations[line.stations.length - 1].name;
    var fromOrigin = cum[stationIdx];
    var toTerminal = total - cum[stationIdx];
    railStationPin3d = latLonTo3D(station.lat, station.lon);
    railStationPinLine.textContent = line.flag + ' ' + line.name;
    railStationPinName.textContent = station.name;
    railStationPinName.onclick = function(e) {
      e.stopPropagation();
      flyTo(station.lat, station.lon);
      zoom = 1.2;
    };
    railStationPinRoute.innerHTML =
      originName + '-' + station.name + ' (' + fromOrigin.toFixed(1) + 'km)<br>' +
      station.name + '-' + terminalName + ' (' + toTerminal.toFixed(1) + 'km)';
    if (railStationAlightBtn) {
      railStationAlightBtn.style.display = 'inline-block';
      railStationAlightBtn.onclick = function(e) {
        e.stopPropagation();
        startStationLanding(station.name, line.flag + ' ' + line.name, station.lat, station.lon,
          originName + '-' + station.name + ' (' + fromOrigin.toFixed(1) + 'km)',
          station.name + '-' + terminalName + ' (' + toTerminal.toFixed(1) + 'km)');
      };
    }
  }

  function updateRailTourBtnText() {
    railSideBody.querySelectorAll('.rail-tour-btn').forEach(function(btn) {
      var idx = parseInt(btn.getAttribute('data-line-idx'), 10);
      if (railTourRunning && idx === railTourLineIdx) {
        btn.textContent = '⏹ 停止';
        btn.classList.add('active');
      } else {
        btn.textContent = '🚉 巡回';
        btn.classList.remove('active');
      }
    });
  }

  function highlightRailTourRow(lineIdx, stationIdx) {
    railSideBody.querySelectorAll('.rail-station-row').forEach(function(el) {
      var isActive = parseInt(el.getAttribute('data-line-idx'), 10) === lineIdx && parseInt(el.getAttribute('data-station-idx'), 10) === stationIdx;
      el.classList.toggle('rail-tour-active', isActive);
      if (isActive) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  function railTourStep() {
    if (!railTourRunning) return;
    var line = RAIL_LINES[railTourLineIdx];
    if (!line) { stopRailTour(); return; }
    var nextIdx = railTourStationIdx + 1;
    if (nextIdx >= line.stations.length) { stopRailTour(); return; }
    railTourStationIdx = nextIdx;
    var station = line.stations[nextIdx];
    flyTo(station.lat, station.lon);
    zoom = 1.2;
    highlightRailTourRow(railTourLineIdx, nextIdx);
    setTimeout(function() {
      if (!railTourRunning || railTourLineIdx < 0) return;
      railStationPin.style.display = 'block';
      railStationPinLabel.style.display = 'block';
      showRailStationPin(line, station, nextIdx);
    }, FLY_DUR + 100);
    railTourTimer = setTimeout(railTourStep, FLY_DUR + RAIL_TOUR_DWELL_MS);
  }

  function startRailTour(lineIdx) {
    stopRailTour();
    stopF1Tour();
    railTourLineIdx = lineIdx;
    railTourStationIdx = -1;
    railTourRunning = true;
    updateRailTourBtnText();
    railTourStep();
  }

  function stopRailTour() {
    railTourRunning = false;
    railTourLineIdx = -1;
    railTourStationIdx = -1;
    if (railTourTimer) { clearTimeout(railTourTimer); railTourTimer = null; }
    if (railSideBody) updateRailTourBtnText();
  }

  function formatF1Date(dateStr) {
    var parts = dateStr.split('-');
    return parts[0] + '/' + parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10);
  }

  var F1_SORTED = F1_CIRCUITS.slice().sort(function(a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });

  function renderF1SidePanel() {
    var html = '';
    F1_SORTED.forEach(function(race, i) {
      html += '<div class="f1-side-item" data-idx="' + i + '">' +
        '<span class="f1-side-flag">' + race.flag + '</span>' +
        '<span class="f1-side-info">' +
          '<span class="f1-side-circuit">' + race.circuit + '</span>' +
          '<span class="f1-side-date">' + formatF1Date(race.date) + '　' + race.country + '</span>' +
        '</span>' +
        '</div>';
    });
    f1SideBody.innerHTML = html;
    f1SideBody.querySelectorAll('.f1-side-item').forEach(function(el) {
      el.addEventListener('click', function() {
        stopF1Tour();
        focusF1Circuit(parseInt(el.getAttribute('data-idx'), 10), true);
      });
    });
  }

  function findUpcomingF1Idx() {
    var todayStr = new Date().toISOString().slice(0, 10);
    for (var i = 0; i < F1_SORTED.length; i++) {
      if (F1_SORTED[i].date >= todayStr) return i;
    }
    return 0;
  }

  function focusF1Circuit(idx, smooth) {
    f1TourIdx = idx;
    var race = F1_SORTED[idx];
    flyTo(race.lat, race.lon);
    zoom = 1.2;
    f1CircuitPin3d = latLonTo3D(race.lat, race.lon);
    f1CircuitPinName.textContent = race.flag + ' ' + race.circuit;
    f1CircuitPinName.onclick = function(e) {
      e.stopPropagation();
      flyTo(race.lat, race.lon);
    };
    f1CircuitPinDate.textContent = formatF1Date(race.date);
    f1SideBody.querySelectorAll('.f1-side-item').forEach(function(el) {
      el.classList.toggle('active', parseInt(el.getAttribute('data-idx'), 10) === idx);
    });
    var activeEl = f1SideBody.querySelector('.f1-side-item[data-idx="' + idx + '"]');
    if (activeEl) activeEl.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
  }

  function flashF1SideItem(idx) {
    var el = f1SideBody.querySelector('.f1-side-item[data-idx="' + idx + '"]');
    if (!el) return;
    el.classList.remove('f1-flash');
    void el.offsetWidth;
    el.classList.add('f1-flash');
    setTimeout(function() { el.classList.remove('f1-flash'); }, 1500);
  }

  function renderF1Calendar(year, month, blinkDay) {
    if (year !== f1CalYear || month !== f1CalMonth) {
      f1CalYear = year;
      f1CalMonth = month;
      f1CalMarkedDays = [];
    }
    if (blinkDay && f1CalMarkedDays.indexOf(blinkDay) === -1) f1CalMarkedDays.push(blinkDay);
    var first = new Date(year, month - 1, 1);
    var startWeekday = first.getDay();
    var daysInMonth = new Date(year, month, 0).getDate();
    var html = '<div class="f1-cal-head">' + year + '年' + month + '月</div><div class="f1-cal-grid">';
    ['日', '月', '火', '水', '木', '金', '土'].forEach(function(w) { html += '<div class="f1-cal-dow">' + w + '</div>'; });
    for (var i = 0; i < startWeekday; i++) html += '<div class="f1-cal-cell f1-cal-empty"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      html += '<div class="f1-cal-cell' + (f1CalMarkedDays.indexOf(d) !== -1 ? ' f1-cal-target' : '') + '" data-day="' + d + '">' + d + '</div>';
    }
    html += '</div>';
    f1CalEl.innerHTML = html;
    if (blinkDay) {
      var cell = f1CalEl.querySelector('.f1-cal-cell[data-day="' + blinkDay + '"]');
      if (cell) {
        cell.classList.add('f1-cal-flash');
        setTimeout(function() { cell.classList.remove('f1-cal-flash'); }, 1500);
      }
    }
  }

  function updateF1TourBtnText() {
    var btn = document.getElementById('f1-tour-btn');
    if (btn) btn.textContent = f1TourRunning ? '⏹ 停止' : '🏁 巡回';
  }

  function f1TourStep() {
    if (!f1TourRunning) return;
    var nextIdx = f1TourIdx + 1;
    if (nextIdx >= F1_SORTED.length) { stopF1Tour(); return; }
    var race = F1_SORTED[nextIdx];
    var raceDate = new Date(race.date + 'T00:00:00');
    flashF1SideItem(nextIdx);
    renderF1Calendar(raceDate.getFullYear(), raceDate.getMonth() + 1, raceDate.getDate());
    focusF1Circuit(nextIdx, true);
    f1TourTimer = setTimeout(f1TourStep, FLY_DUR + 5000);
  }

  function startF1Tour() {
    if (f1TourIdx < 0) return;
    f1TourRunning = true;
    updateF1TourBtnText();
    f1TourStep();
  }

  function stopF1Tour() {
    f1TourRunning = false;
    if (f1TourTimer) { clearTimeout(f1TourTimer); f1TourTimer = null; }
    updateF1TourBtnText();
  }

  function nearestStations(lat, lon, limit) {
    var all = [];
    RAIL_LINES.forEach(function(line) {
      line.stations.forEach(function(st) {
        all.push({
          name: st.name, lat: st.lat, lon: st.lon, line: line.name, flag: line.flag,
          distance_km: haversineKm(lat, lon, st.lat, st.lon)
        });
      });
    });
    all.sort(function(a, b) { return a.distance_km - b.distance_km; });
    return all.slice(0, limit || 5);
  }

  function renderStationList(lat, lon) {
    if (!landingStationListEl) return;
    var stations = nearestStations(lat, lon, 5);
    if (stations.length === 0) { landingStationListEl.innerHTML = ''; return; }
    var html = '<div class="landing-station-hdr">🚉 近隣駅</div>';
    stations.forEach(function(st) {
      html += '<div class="landing-city-item"><span>' + st.flag + ' ' + st.name +
        ' <span style="color:#8b949e;font-family:monospace">(' + st.lat.toFixed(3) + ', ' + st.lon.toFixed(3) + ')</span></span>' +
        '<span class="landing-city-dist">' + st.distance_km.toFixed(1) + 'km</span></div>';
    });
    landingStationListEl.innerHTML = html;
  }

  function clearCityMarkers() {
    cityMkEls.forEach(function(el){ if(el.parentNode) el.parentNode.removeChild(el); });
    cityMkEls = [];
    if(cityMarkersDiv) cityMarkersDiv.style.display = 'none';
  }

  function formatPop(p) {
    if(!p) return '';
    if(p >= 1000000) return (p/1000000).toFixed(1) + 'M';
    if(p >= 1000) return Math.round(p/1000) + 'k';
    return String(p);
  }

  function ccToFlag(cc) {
    if(!cc || cc.length !== 2) return '';
    var a = cc.toUpperCase().charCodeAt(0) - 65 + 0x1F1E6;
    var b = cc.toUpperCase().charCodeAt(1) - 65 + 0x1F1E6;
    return String.fromCodePoint(a) + String.fromCodePoint(b);
  }

  var CC_TO_JP = {
    AF:'アフガニスタン',AL:'アルバニア',DZ:'アルジェリア',AD:'アンドラ',
    AO:'アンゴラ',AG:'アンティグア・バーブーダ',AR:'アルゼンチン',AM:'アルメニア',
    AU:'オーストラリア',AT:'オーストリア',AZ:'アゼルバイジャン',BS:'バハマ',
    BH:'バーレーン',BD:'バングラデシュ',BB:'バルバドス',BY:'ベラルーシ',
    BE:'ベルギー',BZ:'ベリーズ',BJ:'ベナン',BT:'ブータン',
    BO:'ボリビア',BA:'ボスニア・ヘルツェゴビナ',BW:'ボツワナ',BR:'ブラジル',
    BN:'ブルネイ',BG:'ブルガリア',BF:'ブルキナファソ',BI:'ブルンジ',
    CV:'カーボベルデ',KH:'カンボジア',CM:'カメルーン',CA:'カナダ',
    CF:'中央アフリカ',TD:'チャド',CL:'チリ',CN:'中国',
    CO:'コロンビア',KM:'コモロ',CD:'コンゴ民主共和国',CG:'コンゴ共和国',
    CR:'コスタリカ',CI:'コートジボワール',HR:'クロアチア',CU:'キューバ',
    CY:'キプロス',CZ:'チェコ',DK:'デンマーク',DJ:'ジブチ',
    DM:'ドミニカ',DO:'ドミニカ共和国',EC:'エクアドル',EG:'エジプト',
    SV:'エルサルバドル',GQ:'赤道ギニア',ER:'エリトリア',EE:'エストニア',
    SZ:'エスワティニ',ET:'エチオピア',FJ:'フィジー',FI:'フィンランド',
    FR:'フランス',GA:'ガボン',GM:'ガンビア',GE:'ジョージア',
    DE:'ドイツ',GH:'ガーナ',GR:'ギリシャ',GD:'グレナダ',
    GT:'グアテマラ',GN:'ギニア',GW:'ギニアビサウ',GY:'ガイアナ',
    HT:'ハイチ',HN:'ホンジュラス',HU:'ハンガリー',IS:'アイスランド',
    IN:'インド',ID:'インドネシア',IR:'イラン',IQ:'イラク',
    IE:'アイルランド',IL:'イスラエル',IT:'イタリア',JM:'ジャマイカ',
    JP:'日本',JO:'ヨルダン',KZ:'カザフスタン',KE:'ケニア',
    KI:'キリバス',KP:'北朝鮮',KR:'韓国',KW:'クウェート',
    KG:'キルギス',LA:'ラオス',LV:'ラトビア',LB:'レバノン',
    LS:'レソト',LR:'リベリア',LY:'リビア',LI:'リヒテンシュタイン',
    LT:'リトアニア',LU:'ルクセンブルク',MG:'マダガスカル',MW:'マラウイ',
    MY:'マレーシア',MV:'モルディブ',ML:'マリ',MT:'マルタ',
    MH:'マーシャル諸島',MR:'モーリタニア',MU:'モーリシャス',MX:'メキシコ',
    FM:'ミクロネシア',MD:'モルドバ',MC:'モナコ',MN:'モンゴル',
    ME:'モンテネグロ',MA:'モロッコ',MZ:'モザンビーク',MM:'ミャンマー',
    NA:'ナミビア',NR:'ナウル',NP:'ネパール',NL:'オランダ',
    NZ:'ニュージーランド',NI:'ニカラグア',NE:'ニジェール',NG:'ナイジェリア',
    MK:'北マケドニア',NO:'ノルウェー',OM:'オマーン',PK:'パキスタン',
    PW:'パラオ',PA:'パナマ',PG:'パプアニューギニア',PY:'パラグアイ',
    PE:'ペルー',PH:'フィリピン',PL:'ポーランド',PT:'ポルトガル',
    QA:'カタール',RO:'ルーマニア',RU:'ロシア',RW:'ルワンダ',
    KN:'セントクリストファー・ネイビス',LC:'セントルシア',VC:'セントビンセント・グレナディーン',
    WS:'サモア',SM:'サンマリノ',ST:'サントメ・プリンシペ',SA:'サウジアラビア',
    SN:'セネガル',RS:'セルビア',SC:'セーシェル',SL:'シエラレオネ',
    SG:'シンガポール',SK:'スロバキア',SI:'スロベニア',SB:'ソロモン諸島',
    SO:'ソマリア',ZA:'南アフリカ',SS:'南スーダン',ES:'スペイン',
    LK:'スリランカ',SD:'スーダン',SR:'スリナム',SE:'スウェーデン',
    CH:'スイス',SY:'シリア',TW:'台湾',TJ:'タジキスタン',
    TZ:'タンザニア',TH:'タイ',TL:'東ティモール',TG:'トーゴ',
    TO:'トンガ',TT:'トリニダード・トバゴ',TN:'チュニジア',TR:'トルコ',
    TM:'トルクメニスタン',TV:'ツバル',UG:'ウガンダ',UA:'ウクライナ',
    AE:'アラブ首長国連邦',GB:'イギリス',US:'アメリカ',UY:'ウルグアイ',
    UZ:'ウズベキスタン',VU:'バヌアツ',VE:'ベネズエラ',VN:'ベトナム',
    YE:'イエメン',ZM:'ザンビア',ZW:'ジンバブエ'
  };

  function ccToJp(cc) {
    if(!cc) return cc;
    return CC_TO_JP[cc.toUpperCase()] || cc;
  }

  var CITY_TO_KANA = ${cityToKanaJson};
  function cityToKana(name) {
    return CITY_TO_KANA[name] || '';
  }

  var citiesModalOverlay = null;
  var citiesModalTitle = null;
  var citiesModalBody = null;

  function renderCitiesModalRows(cities) {
    var html = '';
    cities.forEach(function(city) {
      var flag = city.country_code ? (ccToFlag(city.country_code) + ' ') : '';
      var pop = city.population ? formatPop(city.population) : '';
      html += '<div class="cities-modal-row">' +
        '<span class="cities-modal-name">' + flag + city.city_name + '</span>' +
        (pop ? '<span class="cities-modal-pop">\u4eba\u53e3 ' + pop + '</span>' : '') +
        '<span class="cities-modal-dist">' + city.distance_km + ' km</span>' +
        '</div>';
    });
    return html;
  }

  function loadCitiesIntoModal(hidx, force) {
    var d = HERITAGE[hidx];
    if(!d) return;
    citiesModalBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:16px">\u8aad\u307f\u8fbc\u307f\u4e2d...</div>';
    var req = force
      ? fetch('/api/heritage-cities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: d.n, lat: d.lat, lon: d.lon, force: true }) })
      : fetch('/api/heritage-cities?name=' + encodeURIComponent(d.n));
    req.then(function(r){ return r.json(); })
      .then(function(data) {
        if(!data.fetched || !data.cities || data.cities.length === 0) {
          citiesModalBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:16px">\u90fd\u5e02\u30c7\u30fc\u30bf\u306a\u3057</div>';
          return;
        }
        var stale = data.cities.some(function(c){ return !c.country_code; });
        var html = renderCitiesModalRows(data.cities);
        if(stale) {
          html += '<div style="text-align:center;padding:8px 0 4px">' +
            '<button id="cities-modal-refresh" style="background:#21262d;border:1px solid #30363d;color:#c9d1d9;border-radius:6px;padding:4px 14px;font-size:11px;cursor:pointer;">\ud83d\udd04 \u56fd\u65d7\u60c5\u5831\u3092\u66f4\u65b0</button>' +
            '</div>';
        }
        citiesModalBody.innerHTML = html;
        if(stale) {
          var refreshBtn = document.getElementById('cities-modal-refresh');
          if(refreshBtn) refreshBtn.addEventListener('click', function() { loadCitiesIntoModal(hidx, true); });
        }
      })
      .catch(function() {
        citiesModalBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:16px">\u53d6\u5f97\u30a8\u30e9\u30fc</div>';
      });
  }

  function showCitiesModal(hidx) {
    var d = HERITAGE[hidx];
    if(!d) return;
    citiesModalTitle.textContent = d.f + ' ' + d.n + ' \u8fd1\u9130\u90fd\u5e02';
    citiesModalOverlay.classList.add('open');
    loadCitiesIntoModal(hidx, false);
  }


  function updateCityIcons() {
    if(typeof listItemEls === 'undefined') return;
    HERITAGE.forEach(function(d, i) {
      var el = listItemEls[i];
      if(!el) return;
      var existing = el.querySelector('.city-icon-btn');
      if(hasCityDataSet[d.n]) {
        if(!existing) {
          var btn = document.createElement('button');
          btn.className = 'city-icon-btn';
          btn.title = '近隣都市を表示';
          btn.textContent = '🌇';
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            showCitiesModal(i);
          });
          var nameEl = el.querySelector('.site-name');
          if(nameEl) nameEl.parentNode.insertBefore(btn, nameEl.nextSibling);
          else el.querySelector('.site-body').appendChild(btn);
        }
      } else {
        if(existing) existing.parentNode.removeChild(existing);
      }
      var tourEl = document.getElementById('tour-item-' + i);
      if(tourEl) {
        var tourNameEl = tourEl.querySelector('.tour-item-name');
        if(tourNameEl) {
          var existingTourIcon = tourNameEl.querySelector('.tour-city-icon');
          if(hasCityDataSet[d.n]) {
            if(!existingTourIcon) {
              var span = document.createElement('span');
              span.className = 'tour-city-icon';
              span.textContent = ' 🌆';
              tourNameEl.appendChild(span);
            }
          } else {
            if(existingTourIcon) existingTourIcon.parentNode.removeChild(existingTourIcon);
          }
        }
      }
    });
  }

  function buildCityMarkers(cities) {
    clearCityMarkers();
    if(!cityMarkersDiv || !cities || cities.length === 0) return;
    cityMarkersDiv.style.display = '';
    cities.forEach(function(city) {
      var el = document.createElement('div');
      el.className = 'city-mk';
      var pop = city.population ? (' ' + formatPop(city.population)) : '';
      var flag = city.country_code ? (ccToFlag(city.country_code) + ' ') : '';
      el.innerHTML = '<span class="city-mk-dot"></span>' + flag + city.city_name + pop;
      cityMarkersDiv.appendChild(el);
      cityMkEls.push({ el: el, pos3d: latLonTo3D(city.city_lat, city.city_lon) });
    });
  }

  function renderCityList(cities) {
    if(!landingCityListEl) return;
    if(!cities || cities.length === 0) { landingCityListEl.innerHTML = ''; return; }
    var html = '';
    cities.forEach(function(city) {
      var pop = city.population ? (' <span style="color:#8b949e">(' + formatPop(city.population) + ')</span>') : '';
      var flag = city.country_code ? (ccToFlag(city.country_code) + ' ') : '';
      html += '<div class="landing-city-item"><span>' + flag + city.city_name + pop + '</span><span class="landing-city-dist">' + city.distance_km + 'km</span></div>';
    });
    landingCityListEl.innerHTML = html;
  }

  function loadLandingCities(hidx) {
    var ld = HERITAGE[hidx];
    if(!ld) return;
    if(landingCityListEl) landingCityListEl.innerHTML = '<div class="landing-city-loading">🌆 周辺都市を検索中...</div>';
    fetch('/api/heritage-cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ld.n, lat: ld.lat, lon: ld.lon })
    })
      .then(function(r){ return r.json(); })
      .then(function(d) {
        landingCities = d.cities || [];
        if(landingCities.length > 0) { hasCityDataSet[ld.n] = true; updateCityIcons(); }
        buildCityMarkers(landingCities);
        renderCityList(landingCities);
      })
      .catch(function() {
        if(landingCityListEl) landingCityListEl.innerHTML = '';
      });
  }

  function flyTo(lat, lon) {
    var latR = lat * Math.PI / 180;
    var lonR = lon * Math.PI / 180;
    var a = axialTilt;
    var tanA = Math.tan(a);
    var tanL = Math.tan(latR);
    var cosVal = Math.max(-1, Math.min(1, tanA * tanL));
    var ty = -Math.acos(cosVal) - lonR;
    var sinSq = 1 - cosVal * cosVal;
    var denom = Math.cos(a) * Math.sqrt(Math.max(0, sinSq));
    var tx = denom < 1e-6 ? (latR >= 0 ? Math.PI / 2 : -Math.PI / 2) : Math.atan(tanL / denom);
    var dy = ty - rotYv;
    while (dy > Math.PI) dy -= 2*Math.PI;
    while (dy < -Math.PI) dy += 2*Math.PI;
    momentumY = 0; momentumX = 0;
    flyFrom = {ry: rotYv, rx: rotXv};
    flyTarget = {ry: rotYv + dy, rx: tx};
    flyStart = performance.now();
    autoRot = false;
    btnAutoRot.textContent = '▶ 回転';
    btnAutoRot.classList.add('active');
    if (axisLocked) {
      axisLocked = false;
      btnAxisLock.classList.remove('active');
      btnAxisLock.textContent = '＋ 軸垂直固定';
    }
  }

  function startLanding(hidx) {
    if (landingMode) return;
    landingIdx = hidx;
    var ld = HERITAGE[hidx];
    flyTo(ld.lat, ld.lon);
    stopAmericaTour(); stopEuropeTour(); stopAfricaTour(); stopJapanTour();
    setTimeout(function() {
      flyTarget = null;
      landingMode = true;
      landingPhase = 1;
      landingPhaseStart = performance.now();
      landingZoomFrom = zoom;
      landingRotXFrom = rotXv;
      markersDiv.style.display = 'none';
      tooltip.style.opacity = '0';
      if (landingTitleEl) landingTitleEl.textContent = ld.e + ' ' + ld.f + ' ' + ld.n;
      if (landingSubEl) landingSubEl.textContent = ld.t + '  ' + ld.c + '  ' + ld.y + '年登録';
      if (landingStatusEl) landingStatusEl.textContent = '着陸中...';
      if (landingProgEl) landingProgEl.style.width = '0%';
      if (landingCityListEl) landingCityListEl.innerHTML = '';
      if (landingStationListEl) landingStationListEl.innerHTML = '';
      if (landingOverlayEl) landingOverlayEl.classList.add('active');
      loadLandingCities(hidx);
      renderStationList(ld.lat, ld.lon);
    }, FLY_DUR + 100);
  }

  function stopLanding() {
    landingMode = false;
    landingPhase = 0;
    landingCities = [];
    clearCityMarkers();
    markersDiv.style.display = '';
    if (landingOverlayEl) landingOverlayEl.classList.remove('active');
    if (landingCityListEl) landingCityListEl.innerHTML = '';
    if (landingStationListEl) landingStationListEl.innerHTML = '';
    zoom = LANDING_ZOOM_RETURN;
    rotXv = 0.3;
    autoRot = true;
    btnAutoRot.textContent = '⏸ 自転停止';
    btnAutoRot.classList.remove('active');
    stopRailTour();
  }

  function dedupeNearbyPointsForDisplay(points) {
    var seen = {}, result = [];
    points.forEach(function(p) {
      var key = p.point_type + '|' + p.point_name;
      if (seen[key]) return;
      seen[key] = true;
      result.push(p);
    });
    return result;
  }

  function renderNearbyPointsList(points) {
    if (!landingStationListEl) return;
    if (!points || points.length === 0) { landingStationListEl.innerHTML = ''; return; }
    var deduped = dedupeNearbyPointsForDisplay(points);
    var html = '<div class="landing-station-hdr">🚉🏛️ 半径100km圏内の駅・世界遺産</div>';
    deduped.forEach(function(p) {
      var icon = p.point_type === 'heritage' ? '🏛️' : '🚉';
      html += '<div class="landing-city-item"><span>' + icon + ' ' + p.point_name + '</span>' +
        '<span class="landing-city-dist">' + p.distance_km.toFixed(1) + 'km</span></div>';
    });
    landingStationListEl.innerHTML = html;
  }

  function loadNearbyPoints(name, lat, lon) {
    if (landingStationListEl) landingStationListEl.innerHTML = '<div class="landing-city-loading">🚉🏛️ 周辺の駅・世界遺産を検索中...</div>';
    fetch('/api/rail-station-nearby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, lat: lat, lon: lon })
    }).then(function(r) { return r.json(); }).then(function(d) {
      renderNearbyPointsList(d.points || []);
    }).catch(function() {
      if (landingStationListEl) landingStationListEl.innerHTML = '';
    });
  }

  function loadLandingStationCities(name, lat, lon) {
    if (landingCityListEl) landingCityListEl.innerHTML = '<div class="landing-city-loading">🌆 周辺都市を検索中...</div>';
    fetch('/api/rail-station-cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, lat: lat, lon: lon })
    }).then(function(r) { return r.json(); }).then(function(d) {
      landingCities = d.cities || [];
      if (landingCities.length > 0) { hasStationDataSet[name] = true; }
      buildCityMarkers(landingCities);
      renderCityList(landingCities);
    }).catch(function() {
      if (landingCityListEl) landingCityListEl.innerHTML = '';
    });
  }

  function startStationLanding(stationName, lineLabel, lat, lon, routeLine1, routeLine2) {
    if (landingMode) return;
    flyTo(lat, lon);
    stopAmericaTour(); stopEuropeTour(); stopAfricaTour(); stopJapanTour(); stopRailTour(); stopF1Tour();
    setTimeout(function() {
      flyTarget = null;
      landingMode = true;
      landingIdx = -1;
      landingPhase = 1;
      landingPhaseStart = performance.now();
      landingZoomFrom = zoom;
      landingRotXFrom = rotXv;
      markersDiv.style.display = 'none';
      tooltip.style.opacity = '0';
      if (landingTitleEl) landingTitleEl.textContent = lineLabel + ' ' + stationName;
      if (landingSubEl) landingSubEl.innerHTML = routeLine1 + '<br>' + routeLine2;
      if (landingStatusEl) landingStatusEl.textContent = '途中下車中...';
      if (landingProgEl) landingProgEl.style.width = '0%';
      if (landingCityListEl) landingCityListEl.innerHTML = '';
      if (landingStationListEl) landingStationListEl.innerHTML = '';
      if (landingOverlayEl) landingOverlayEl.classList.add('active');
      loadLandingStationCities(stationName, lat, lon);
      loadNearbyPoints(stationName, lat, lon);
    }, FLY_DUR + 100);
  }

  var sideHeader = document.querySelector('.side-header');

  var AMERICAS_IDXS = [];
  for (var ai = 0; ai < HERITAGE.length; ai++) {
    if (HERITAGE[ai].lon < -30) AMERICAS_IDXS.push(ai);
  }
  AMERICAS_IDXS.sort(function(a, b) { return HERITAGE[b].lon - HERITAGE[a].lon; });

  var americaTourActive = false;
  var americaTourPos = 0;
  var americaTourTimer = null;
  var AMERICAS_INTERVAL = 5000;

  function stopAmericaTour() {
    americaTourActive = false;
    if (americaTourTimer !== null) { clearTimeout(americaTourTimer); americaTourTimer = null; }
    btnAmericaTour.classList.remove('active');
    btnAmericaTour.textContent = '🌎 アメリカ巡回';
    hideTourPanel();
  }

  function nextAmericaSite() {
    if (!americaTourActive) return;
    if (AMERICAS_IDXS.length === 0) { stopAmericaTour(); return; }
    var idx = AMERICAS_IDXS[americaTourPos % AMERICAS_IDXS.length];
    americaTourPos++;
    showMarkerTooltip(idx, 0, 0);
    highlightTourItem(idx);
    americaTourTimer = setTimeout(nextAmericaSite, AMERICAS_INTERVAL);
  }

  function startAmericaTour() {
    stopEuropeTour();
    stopAfricaTour();
    stopJapanTour();
    americaTourActive = true;
    americaTourPos = 0;
    btnAmericaTour.classList.add('active');
    btnAmericaTour.textContent = '⏹ 巡回停止';
    autoRot = false;
    btnAutoRot.textContent = '▶ 回転';
    btnAutoRot.classList.add('active');
    showTourPanel(AMERICAS_IDXS, '🌎 アメリカ巡回');
    nextAmericaSite();
  }

  btnAmericaTour.addEventListener('click', function() {
    if (americaTourActive) { stopAmericaTour(); } else { startAmericaTour(); }
  });

  var btnEuropeTour = document.getElementById('btnEuropeTour');
  var btnAfricaTour = document.getElementById('btnAfricaTour');

  var REGION_MAP = {
    '🇨🇳':'アジア','🇯🇵':'アジア','🇮🇳':'アジア','🇰🇷':'アジア','🇮🇩':'アジア','🇰🇭':'アジア','🇻🇳':'アジア','🇹🇭':'アジア','🇲🇾':'アジア','🇵🇰':'アジア','🇧🇩':'アジア','🇲🇳':'アジア','🇳🇵':'アジア','🇱🇰':'アジア','🇵🇭':'アジア','🇲🇲':'アジア','🇰🇿':'アジア','🇺🇿':'アジア','🇹🇲':'アジア','🇰🇬':'アジア','🇹🇯':'アジア','🇦🇫':'アジア',
    '🇫🇷':'ヨーロッパ','🇩🇪':'ヨーロッパ','🇬🇧':'ヨーロッパ','🇮🇹':'ヨーロッパ','🇪🇸':'ヨーロッパ','🇵🇹':'ヨーロッパ','🇬🇷':'ヨーロッパ','🇭🇷':'ヨーロッパ','🇨🇿':'ヨーロッパ','🇵🇱':'ヨーロッパ','🇷🇺':'ヨーロッパ','🇹🇷':'ヨーロッパ','🇦🇹':'ヨーロッパ','🇨🇭':'ヨーロッパ','🇧🇪':'ヨーロッパ','🇳🇱':'ヨーロッパ','🇸🇪':'ヨーロッパ','🇳🇴':'ヨーロッパ','🇩🇰':'ヨーロッパ','🇫🇮':'ヨーロッパ','🇮🇸':'ヨーロッパ','🇮🇪':'ヨーロッパ','🇭🇺':'ヨーロッパ','🇷🇴':'ヨーロッパ','🇧🇬':'ヨーロッパ','🇸🇰':'ヨーロッパ','🇸🇮':'ヨーロッパ','🇱🇻':'ヨーロッパ','🇱🇹':'ヨーロッパ','🇪🇪':'ヨーロッパ','🇺🇦':'ヨーロッパ','🇲🇹':'ヨーロッパ','🇱🇺':'ヨーロッパ','🇲🇪':'ヨーロッパ','🇷🇸':'ヨーロッパ','🇲🇰':'ヨーロッパ','🇧🇦':'ヨーロッパ','🇦🇱':'ヨーロッパ','🇦🇿':'コーカサス・中央アジア','🇬🇪':'コーカサス・中央アジア','🇦🇲':'コーカサス・中央アジア',
    '🇺🇸':'北アメリカ','🇨🇦':'北アメリカ','🇲🇽':'北アメリカ',
    '🇧🇷':'南アメリカ','🇵🇪':'南アメリカ','🇦🇷':'南アメリカ','🇨🇱':'南アメリカ','🇧🇴':'南アメリカ','🇨🇴':'南アメリカ','🇪🇨':'南アメリカ','🇵🇾':'南アメリカ','🇺🇾':'南アメリカ','🇻🇪':'南アメリカ','🇬🇾':'南アメリカ','🇸🇷':'南アメリカ',
    '🇬🇹':'中米・カリブ','🇲🇽':'中米・カリブ','🇨🇺':'中米・カリブ','🇩🇴':'中米・カリブ','🇯🇲':'中米・カリブ','🇭🇳':'中米・カリブ','🇵🇦':'中米・カリブ','🇨🇷':'中米・カリブ','🇸🇻':'中米・カリブ','🇳🇮':'中米・カリブ','🇧🇿':'中米・カリブ','🇹🇹':'中米・カリブ',
    '🇪🇬':'アフリカ・北アフリカ','🇲🇦':'アフリカ・北アフリカ','🇹🇳':'アフリカ・北アフリカ','🇩🇿':'アフリカ・北アフリカ','🇱🇾':'アフリカ・北アフリカ','🇸🇩':'アフリカ・北アフリカ',
    '🇪🇹':'アフリカ・サブサハラ','🇿🇼':'アフリカ・サブサハラ','🇿🇦':'アフリカ・サブサハラ','🇳🇦':'アフリカ・サブサハラ','🇸🇳':'アフリカ・サブサハラ','🇹🇿':'アフリカ・サブサハラ','🇰🇪':'アフリカ・サブサハラ','🇺🇬':'アフリカ・サブサハラ','🇷🇼':'アフリカ・サブサハラ','🇲🇿':'アフリカ・サブサハラ','🇲🇼':'アフリカ・サブサハラ','🇿🇲':'アフリカ・サブサハラ','🇲🇬':'アフリカ・サブサハラ','🇬🇭':'アフリカ・サブサハラ','🇨🇲':'アフリカ・サブサハラ','🇨🇩':'アフリカ・サブサハラ','🇨🇬':'アフリカ・サブサハラ','🇬🇦':'アフリカ・サブサハラ','🇧🇯':'アフリカ・サブサハラ','🇨🇮':'アフリカ・サブサハラ','🇲🇱':'アフリカ・サブサハラ','🇳🇪':'アフリカ・サブサハラ','🇸🇱':'アフリカ・サブサハラ','🇩🇯':'アフリカ・サブサハラ','🇸🇴':'アフリカ・サブサハラ','🇧🇼':'アフリカ・サブサハラ','🇲🇺':'アフリカ・サブサハラ','🇸🇿':'アフリカ・サブサハラ','🇱🇸':'アフリカ・サブサハラ','🇪🇷':'アフリカ・サブサハラ','🇳🇬':'アフリカ・サブサハラ',
    '🇮🇱':'中東','🇯🇴':'中東','🇱🇧':'中東','🇸🇾':'中東','🇮🇶':'中東','🇮🇷':'中東','🇸🇦':'中東','🇾🇪':'中東','🇴🇲':'中東','🇦🇪':'中東','🇶🇦':'中東','🇧🇭':'中東','🇰🇼':'中東',
    '🇦🇺':'オセアニア','🇳🇿':'オセアニア','🇵🇬':'オセアニア','🇫🇯':'オセアニア','🇸🇧':'オセアニア','🇻🇺':'オセアニア',
    '🇺🇿':'コーカサス・中央アジア'
  };
  var REGION_ORDER = ['アジア','ヨーロッパ','アフリカ・サブサハラ','アフリカ・北アフリカ','中東','北アメリカ','南アメリカ','中米・カリブ','コーカサス・中央アジア','オセアニア','その他'];
  var REGION_COLORS = {'アジア':'#e3a838','ヨーロッパ':'#58a6ff','アフリカ・サブサハラ':'#3fb950','アフリカ・北アフリカ':'#7ee787','中東':'#f0883e','北アメリカ':'#a371f7','南アメリカ':'#79c0ff','中米・カリブ':'#d2a8ff','コーカサス・中央アジア':'#ffa657','オセアニア':'#39d353','その他':'#484f58'};
  var TYPE_COLORS = {'文化遺産':'#e3a838','自然遺産':'#3fb950','複合遺産':'#a371f7'};

  var EUROPE_IDXS = [];
  var AFRICA_IDXS = [];
  var JAPAN_IDXS = [];
  for (var ri = 0; ri < HERITAGE.length; ri++) {
    var rg = REGION_MAP[HERITAGE[ri].f] || '';
    if (rg === 'ヨーロッパ') EUROPE_IDXS.push(ri);
    if (rg === 'アフリカ・サブサハラ' || rg === 'アフリカ・北アフリカ') AFRICA_IDXS.push(ri);
    if (HERITAGE[ri].f === '🇯🇵') JAPAN_IDXS.push(ri);
  }
  EUROPE_IDXS.sort(function(a, b) { return HERITAGE[b].lon - HERITAGE[a].lon; });
  AFRICA_IDXS.sort(function(a, b) { return HERITAGE[b].lon - HERITAGE[a].lon; });
  var JAPAN_PANEL_IDXS = JAPAN_IDXS.slice().sort(function(a, b) { return HERITAGE[b].y - HERITAGE[a].y; });
  var JAPAN_TOUR_IDXS  = JAPAN_IDXS.slice().sort(function(a, b) { return HERITAGE[a].y - HERITAGE[b].y; });

  function showTourPanel(idxs, title) {
    tourPanelTitle.textContent = title;
    tourPanelCount.textContent = idxs.length + '件';
    var html = '';
    for (var ti = 0; ti < idxs.length; ti++) {
      var h = HERITAGE[idxs[ti]];
      var col = typeColor(h.t);
      var cityIcon = hasCityDataSet[h.n] ? ' <span class="tour-city-icon">🌆</span>' : '';
      html += '<div class="tour-item" id="tour-item-' + idxs[ti] + '" data-hidx="' + idxs[ti] + '">' +
        '<span class="tour-item-num">' + (ti + 1) + '</span>' +
        '<span style="font-size:16px;flex-shrink:0">' + h.e + '</span>' +
        '<div class="tour-item-body">' +
          '<div class="tour-item-name">' + h.f + ' ' + h.n + cityIcon + '</div>' +
          '<div class="tour-item-meta" style="color:' + col + '">' + h.t + ' · ' + h.c + ' ' + h.y + '年</div>' +
        '</div>' +
        '</div>';
    }
    tourListScroll.innerHTML = html;
    var tourItems = tourListScroll.querySelectorAll('.tour-item');
    tourItems.forEach(function(el) {
      el.addEventListener('click', function() {
        var hidx = parseInt(el.getAttribute('data-hidx'));
        showMarkerTooltip(hidx, 0, 0);
      });
    });
    if (sideHeader) sideHeader.style.display = 'none';
    siteList.style.display = 'none';
    tourPanel.classList.add('visible');
  }

  function hideTourPanel() {
    tourPanel.classList.remove('visible');
    siteList.style.display = '';
    if (sideHeader) sideHeader.style.display = '';
    tourListScroll.innerHTML = '';
  }

  function highlightTourItem(idx) {
    var prev = tourListScroll.querySelector('.tour-item.active');
    if (prev) prev.classList.remove('active');
    var el = document.getElementById('tour-item-' + idx);
    if (el) {
      el.classList.add('active');
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  var europeTourActive = false;
  var europeTourPos = 0;
  var europeTourTimer = null;
  var TOUR_INTERVAL = 5000;

  function stopEuropeTour() {
    europeTourActive = false;
    if (europeTourTimer !== null) { clearTimeout(europeTourTimer); europeTourTimer = null; }
    if (btnEuropeTour) { btnEuropeTour.classList.remove('active'); btnEuropeTour.textContent = '🏰 ヨーロッパ巡回'; }
    hideTourPanel();
  }

  function nextEuropeSite() {
    if (!europeTourActive) return;
    if (EUROPE_IDXS.length === 0) { stopEuropeTour(); return; }
    var idx = EUROPE_IDXS[europeTourPos % EUROPE_IDXS.length];
    europeTourPos++;
    showMarkerTooltip(idx, 0, 0);
    highlightTourItem(idx);
    europeTourTimer = setTimeout(nextEuropeSite, TOUR_INTERVAL);
  }

  function startEuropeTour() {
    stopAmericaTour();
    stopAfricaTour();
    stopJapanTour();
    europeTourActive = true;
    europeTourPos = 0;
    if (btnEuropeTour) { btnEuropeTour.classList.add('active'); btnEuropeTour.textContent = '⏹ 巡回停止'; }
    autoRot = false;
    btnAutoRot.textContent = '▶ 回転';
    btnAutoRot.classList.add('active');
    showTourPanel(EUROPE_IDXS, '🏰 ヨーロッパ巡回');
    nextEuropeSite();
  }

  if (btnEuropeTour) {
    btnEuropeTour.addEventListener('click', function() {
      if (europeTourActive) { stopEuropeTour(); } else { startEuropeTour(); }
    });
  }

  var africaTourActive = false;
  var africaTourPos = 0;
  var africaTourTimer = null;

  function stopAfricaTour() {
    africaTourActive = false;
    if (africaTourTimer !== null) { clearTimeout(africaTourTimer); africaTourTimer = null; }
    if (btnAfricaTour) { btnAfricaTour.classList.remove('active'); btnAfricaTour.textContent = '🌍 アフリカ巡回'; }
    hideTourPanel();
  }

  function nextAfricaSite() {
    if (!africaTourActive) return;
    if (AFRICA_IDXS.length === 0) { stopAfricaTour(); return; }
    var idx = AFRICA_IDXS[africaTourPos % AFRICA_IDXS.length];
    africaTourPos++;
    showMarkerTooltip(idx, 0, 0);
    highlightTourItem(idx);
    africaTourTimer = setTimeout(nextAfricaSite, TOUR_INTERVAL);
  }

  function startAfricaTour() {
    stopAmericaTour();
    stopEuropeTour();
    stopJapanTour();
    africaTourActive = true;
    africaTourPos = 0;
    if (btnAfricaTour) { btnAfricaTour.classList.add('active'); btnAfricaTour.textContent = '⏹ 巡回停止'; }
    autoRot = false;
    btnAutoRot.textContent = '▶ 回転';
    btnAutoRot.classList.add('active');
    showTourPanel(AFRICA_IDXS, '🌍 アフリカ巡回');
    nextAfricaSite();
  }

  if (btnAfricaTour) {
    btnAfricaTour.addEventListener('click', function() {
      if (africaTourActive) { stopAfricaTour(); } else { startAfricaTour(); }
    });
  }

  var btnJapanTour = document.getElementById('btnJapanTour');
  var japanTourActive = false;
  var japanTourPos = 0;
  var japanTourTimer = null;

  function stopJapanTour() {
    japanTourActive = false;
    if (japanTourTimer !== null) { clearTimeout(japanTourTimer); japanTourTimer = null; }
    if (btnJapanTour) { btnJapanTour.classList.remove('active'); btnJapanTour.textContent = '🗾 日本巡回'; }
    hideTourPanel();
  }

  function nextJapanSite() {
    if (!japanTourActive) return;
    if (JAPAN_TOUR_IDXS.length === 0) { stopJapanTour(); return; }
    var idx = JAPAN_TOUR_IDXS[japanTourPos % JAPAN_TOUR_IDXS.length];
    japanTourPos++;
    showMarkerTooltip(idx, 0, 0);
    highlightTourItem(idx);
    japanTourTimer = setTimeout(nextJapanSite, TOUR_INTERVAL);
  }

  function startJapanTour() {
    stopAmericaTour();
    stopEuropeTour();
    stopAfricaTour();
    japanTourActive = true;
    japanTourPos = 0;
    if (btnJapanTour) { btnJapanTour.classList.add('active'); btnJapanTour.textContent = '⏹ 巡回停止'; }
    autoRot = false;
    btnAutoRot.textContent = '▶ 回転';
    btnAutoRot.classList.add('active');
    showTourPanel(JAPAN_PANEL_IDXS, '🗾 日本巡回');
    nextJapanSite();
  }

  if (btnJapanTour) {
    btnJapanTour.addEventListener('click', function() {
      if (japanTourActive) { stopJapanTour(); } else { startJapanTour(); }
    });
  }

  function buildStats() {
    var regionMap = {}, countryMap = {}, typeMap = {}, decadeMap = {};
    var total = HERITAGE.length;
    for (var i = 0; i < HERITAGE.length; i++) {
      var h = HERITAGE[i];
      var region = REGION_MAP[h.f] || 'その他';
      regionMap[region] = (regionMap[region] || 0) + 1;
      var ckey = h.f + ' ' + h.c;
      countryMap[ckey] = (countryMap[ckey] || 0) + 1;
      typeMap[h.t] = (typeMap[h.t] || 0) + 1;
      var decade = Math.floor(h.y / 10) * 10 + 's';
      decadeMap[decade] = (decadeMap[decade] || 0) + 1;
    }
    return {total:total, region:regionMap, country:countryMap, type:typeMap, decade:decadeMap};
  }

  function makeBars(data, maxVal, colors, order, total) {
    var keys = order ? order.filter(function(k){ return data[k]; }) : Object.keys(data).sort(function(a,b){ return data[b]-data[a]; });
    var html = '';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]; var v = data[k]; if (!v) continue;
      var pct = Math.round(v/total*100);
      var barW = Math.round(v/maxVal*100);
      var col = (colors && colors[k]) ? colors[k] : '#58a6ff';
      html += '<div class="stats-bar-row">';
      html += '<div class="stats-bar-label" title="' + k + '">' + k + '</div>';
      html += '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + barW + '%;background:' + col + ';"></div></div>';
      html += '<div class="stats-bar-num">' + v + ' <span style="color:#484f58;font-size:10px;">(' + pct + '%)</span></div>';
      html += '</div>';
    }
    return html;
  }

  function renderStatsTab(tab, stats) {
    var body = document.getElementById('stats-body');
    var html = '';
    if (tab === 'region') {
      var maxV = 0;
      for (var k in stats.region) { if (stats.region[k] > maxV) maxV = stats.region[k]; }
      html += '<div class="stats-section-title">地域別件数（全' + stats.total + '件）</div>';
      html += makeBars(stats.region, maxV, REGION_COLORS, REGION_ORDER, stats.total);
    } else if (tab === 'country') {
      var pairs = [];
      for (var k in stats.country) { pairs.push([k, stats.country[k]]); }
      pairs.sort(function(a,b){ return b[1]-a[1]; });
      pairs = pairs.slice(0,30);
      var maxV = pairs[0] ? pairs[0][1] : 1;
      html += '<div class="stats-section-title">国別件数 Top30（全' + stats.total + '件）</div>';
      for (var i = 0; i < pairs.length; i++) {
        var k = pairs[i][0]; var v = pairs[i][1];
        var pct = Math.round(v/stats.total*100);
        var barW = Math.round(v/maxV*100);
        html += '<div class="stats-bar-row">';
        html += '<div class="stats-bar-label" title="' + k + '">' + (i+1) + '. ' + k + '</div>';
        html += '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + barW + '%;background:#58a6ff;"></div></div>';
        html += '<div class="stats-bar-num">' + v + ' <span style="color:#484f58;font-size:10px;">(' + pct + '%)</span></div>';
        html += '</div>';
      }
    } else if (tab === 'type') {
      var total = stats.total;
      var cvs = document.createElement('canvas'); cvs.width = 160; cvs.height = 160;
      var ctx = cvs.getContext('2d');
      var types = Object.keys(TYPE_COLORS); var startA = -Math.PI/2;
      for (var i = 0; i < types.length; i++) {
        var v = stats.type[types[i]] || 0;
        var sweep = (v/total) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(80,80); ctx.arc(80,80,72,startA,startA+sweep);
        ctx.closePath(); ctx.fillStyle = TYPE_COLORS[types[i]]; ctx.fill();
        startA += sweep;
      }
      ctx.beginPath(); ctx.arc(80,80,36,0,Math.PI*2); ctx.fillStyle='#0d1117'; ctx.fill();
      html += '<div class="stats-section-title">種別内訳</div>';
      html += '<div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;">';
      html += '<div class="stats-donut-wrap">' + cvs.outerHTML + '</div>';
      html += '<div style="flex:1;min-width:160px;padding-top:8px;">';
      for (var i = 0; i < types.length; i++) {
        var v = stats.type[types[i]] || 0;
        var pct = Math.round(v/total*100);
        html += '<div class="stats-legend-item">';
        html += '<div class="stats-legend-dot" style="background:' + TYPE_COLORS[types[i]] + ';"></div>';
        html += '<span style="font-weight:600;color:' + TYPE_COLORS[types[i]] + ';">' + types[i] + '</span>';
        html += '<span style="color:#8b949e;margin-left:auto;">' + v + '件 (' + pct + '%)</span>';
        html += '</div>';
      }
      html += '</div></div>';
    } else if (tab === 'decade') {
      var decades = Object.keys(stats.decade).sort();
      var maxV = 0;
      for (var i = 0; i < decades.length; i++) { if (stats.decade[decades[i]] > maxV) maxV = stats.decade[decades[i]]; }
      html += '<div class="stats-section-title">登録年代別（全' + stats.total + '件）</div>';
      for (var i = 0; i < decades.length; i++) {
        var d = decades[i]; var v = stats.decade[d];
        var pct = Math.round(v/stats.total*100);
        var barW = Math.round(v/maxV*100);
        html += '<div class="stats-bar-row">';
        html += '<div class="stats-bar-label">' + d + '</div>';
        html += '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + barW + '%;background:#f0883e;"></div></div>';
        html += '<div class="stats-bar-num">' + v + ' <span style="color:#484f58;font-size:10px;">(' + pct + '%)</span></div>';
        html += '</div>';
      }
    }
    body.innerHTML = html;
  }

  var statsOverlay = document.getElementById('stats-overlay');
  var currentStatsTab = 'region';
  var cachedStats = null;

  document.getElementById('btnStats').addEventListener('click', function() {
    if (!cachedStats) cachedStats = buildStats();
    document.getElementById('stats-total-badge').textContent = '全' + cachedStats.total + '件';
    statsOverlay.style.display = 'flex';
    renderStatsTab(currentStatsTab, cachedStats);
  });

  document.getElementById('btnStatsClose').addEventListener('click', function() {
    statsOverlay.style.display = 'none';
  });

  statsOverlay.addEventListener('click', function(e) {
    if (e.target === statsOverlay) statsOverlay.style.display = 'none';
  });

  var statsTabs = document.querySelectorAll('.stats-tab');
  for (var sti = 0; sti < statsTabs.length; sti++) {
    statsTabs[sti].addEventListener('click', function() {
      for (var j = 0; j < statsTabs.length; j++) statsTabs[j].classList.remove('active');
      this.classList.add('active');
      currentStatsTab = this.getAttribute('data-tab');
      if (!cachedStats) cachedStats = buildStats();
      renderStatsTab(currentStatsTab, cachedStats);
    });
  }

  var tooltip = document.getElementById('mk-tooltip');
  var activeIdx = -1;
  var canvasRect = {left:0, top:0, width:0, height:0};

  function updateCanvasRect() { canvasRect = canvas.getBoundingClientRect(); }
  window.addEventListener('resize', updateCanvasRect);
  updateCanvasRect();

  landingOverlayEl = document.getElementById('landing-overlay');
  landingTitleEl   = document.getElementById('landing-title');
  landingSubEl     = document.getElementById('landing-sub');
  landingStatusEl  = document.getElementById('landing-status');
  landingProgEl    = document.getElementById('landing-prog');
  landingCityListEl = document.getElementById('landing-city-list');
  landingStationListEl = document.getElementById('landing-station-list');
  landingSpinToggleEl = document.getElementById('landing-spin-toggle');
  landingWaitBtnEl = document.getElementById('landing-wait-btn');
  if (landingWaitBtnEl) {
    function setWaiting(on) {
      landingWaiting = on;
      if (on) {
        landingWaitBtnEl.classList.add('active');
        landingWaitBtnEl.textContent = '⏸ 待機中';
      } else {
        landingWaitBtnEl.classList.remove('active');
        landingWaitBtnEl.textContent = '⏸ 待機';
      }
    }
    landingWaitBtnEl.addEventListener('mousedown', function(e) { e.preventDefault(); setWaiting(true); });
    landingWaitBtnEl.addEventListener('mouseup', function() { setWaiting(false); });
    landingWaitBtnEl.addEventListener('mouseleave', function() { setWaiting(false); });
    landingWaitBtnEl.addEventListener('touchstart', function(e) { e.preventDefault(); setWaiting(true); }, { passive: false });
    landingWaitBtnEl.addEventListener('touchend', function() { setWaiting(false); });
    landingWaitBtnEl.addEventListener('touchcancel', function() { setWaiting(false); });
  }
  cityMarkersDiv = document.getElementById('city-markers-div');
  citiesModalOverlay = document.getElementById('cities-modal-overlay');
  citiesModalTitle = document.getElementById('cities-modal-title');
  citiesModalBody = document.getElementById('cities-modal-body');
  document.getElementById('cities-modal-close').addEventListener('click', function() {
    citiesModalOverlay.classList.remove('open');
  });
  citiesModalOverlay.addEventListener('click', function(e) {
    if(e.target === citiesModalOverlay) citiesModalOverlay.classList.remove('open');
  });

  var chOverlay = document.getElementById('ch-overlay');
  var chTitle = document.getElementById('ch-title');
  var chBadge = document.getElementById('ch-badge');
  var chBody = document.getElementById('ch-body');
  document.getElementById('ch-close').addEventListener('click', function() { chOverlay.classList.remove('open'); });
  chOverlay.addEventListener('click', function(e) { if(e.target === chOverlay) chOverlay.classList.remove('open'); });

  var currentCountryNames = [];

  function bindChBodyHandlers(matches) {
    chBody.querySelectorAll('.ch-item:not(.ch-item-total)').forEach(function(el) {
      el.addEventListener('click', function() {
        chOverlay.classList.remove('open');
        cityStatsOverlay.classList.remove('open');
        showMarkerTooltip(parseInt(el.getAttribute('data-idx')), 0, 0);
      });
    });
    var totalBtn = chBody.querySelector('.ch-item-total-btn');
    if (totalBtn) {
      totalBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openCityListModal(currentCountryNames, chTitle.textContent || '');
      });
    }
  }

  function renderCountryHeritageRows(matches, cityCounts, uniqueTotal) {
    var sorted = matches.slice().sort(function(a, b) { return b.y - a.y; });
    var html = '';
    sorted.forEach(function(d) {
      var idx = HERITAGE.indexOf(d);
      var count = cityCounts[d.n];
      var countStr = count != null ? String(count) : '-';
      html += '<div class="ch-item" data-idx="' + idx + '">' +
        '<span class="ch-item-emoji">' + d.e + '</span>' +
        '<span class="ch-item-name">' + d.n + '</span>' +
        '<span class="ch-item-year">' + d.y + '年</span>' +
        '<span class="ch-item-citycount" title="近隣都市数">' + countStr + '🏙️</span>' +
        '</div>';
    });
    var totalInner = uniqueTotal > 0
      ? '<button class="ch-item-total-btn">' + uniqueTotal + '🏙️</button>'
      : '<span style="font-weight:700;color:#58a6ff">' + uniqueTotal + '🏙️</span>';
    html += '<div class="ch-item ch-item-total" style="border-top:1px solid #30363d;margin-top:6px;padding-top:6px;cursor:default">' +
      '<span class="ch-item-emoji"></span>' +
      '<span class="ch-item-name" style="color:#8b949e;font-size:11px">合計（重複なし都市数）</span>' +
      '<span class="ch-item-year"></span>' +
      '<span class="ch-item-citycount">' + totalInner + '</span>' +
      '</div>';
    return html;
  }

  function showCountryHeritagePanel(cc) {
    var flag = ccToFlag(cc);
    var jpName = ccToJp(cc);
    var matches = HERITAGE.filter(function(d) { return d.f === flag; });
    chTitle.textContent = flag + ' ' + jpName + ' の世界遺産';
    chBadge.textContent = matches.length + ' 件';
    currentCountryNames = matches.map(function(d) { return d.n; });
    if(matches.length === 0) {
      chBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:20px">該当なし</div>';
      chOverlay.classList.add('open');
      return;
    }
    chBody.innerHTML = renderCountryHeritageRows(matches, {}, 0);
    bindChBodyHandlers(matches);
    chOverlay.classList.add('open');
    var names = currentCountryNames;
    fetch('/api/heritage-country-city-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: names })
    }).then(function(r) { return r.json(); }).then(function(data) {
      var html = renderCountryHeritageRows(matches, data.counts || {}, data.uniqueTotal || 0);
      chBody.innerHTML = html;
      bindChBodyHandlers(matches);
    }).catch(function() {});
  }

  var clOverlay = document.getElementById('cl-overlay');
  var clTitle = document.getElementById('cl-title');
  var clBadge = document.getElementById('cl-badge');
  var clBody = document.getElementById('cl-body');
  document.getElementById('cl-close').addEventListener('click', function() { clOverlay.classList.remove('open'); });
  clOverlay.addEventListener('click', function(e) { if(e.target === clOverlay) clOverlay.classList.remove('open'); });

  var ch2Overlay = document.getElementById('ch2-overlay');
  var ch2Title = document.getElementById('ch2-title');
  var ch2Body = document.getElementById('ch2-body');
  document.getElementById('ch2-close').addEventListener('click', function() { ch2Overlay.classList.remove('open'); });

  var cityFlyPanel = document.getElementById('city-fly-panel');
  var cityFlyFlag = document.getElementById('city-fly-flag');
  var cityFlyCity = document.getElementById('city-fly-city');
  var cityFlyCount = document.getElementById('city-fly-count');
  var cityFlyBody = document.getElementById('city-fly-body');
  var cityFlyHead = document.getElementById('city-fly-head');
  var cityFlyPin = document.getElementById('city-fly-pin');
  var cityFlyPos3d = null;
  var cityFlyJustOpened = false;
  var f1CircuitPin = document.getElementById('f1-circuit-pin');
  var f1CircuitPinLabel = document.getElementById('f1-circuit-pin-label');
  var f1CircuitPinName = document.getElementById('f1-circuit-pin-name');
  var f1CircuitPinDate = document.getElementById('f1-circuit-pin-date');
  var f1CircuitPin3d = null;
  var f1Side = document.getElementById('f1-side');
  var f1SideBody = document.getElementById('f1-side-body');
  var f1CalEl = document.getElementById('f1-cal');
  var f1CalYear = null;
  var f1CalMonth = null;
  var f1CalMarkedDays = [];
  var f1TourIdx = -1;
  var f1TourRunning = false;
  var f1TourTimer = null;
  var railStationPin = document.getElementById('rail-station-pin');
  var railStationPinLabel = document.getElementById('rail-station-pin-label');
  var railStationPinLine = document.getElementById('rail-station-pin-line');
  var railStationPinName = document.getElementById('rail-station-pin-name');
  var railStationPinRoute = document.getElementById('rail-station-pin-route');
  var railStationAlightBtn = document.getElementById('rail-station-alight-btn');
  var railStationPin3d = null;
  var railSide = document.getElementById('rail-side');
  var railSideBody = document.getElementById('rail-side-body');
  var areaTourSide = document.getElementById('area-tour-side');
  var areaTourSideBody = document.getElementById('area-tour-side-body');
  var areaTourSideTitle = document.getElementById('area-tour-side-title');
  document.getElementById('area-tour-side-close').addEventListener('click', function() { areaTourSide.classList.remove('open'); });
  var railTourLineIdx = -1;
  var railTourStationIdx = -1;
  var railTourRunning = false;
  var railTourTimer = null;
  var RAIL_TOUR_DWELL_MS = 4500;
  var cfDragging = false, cfDragOx = 0, cfDragOy = 0;
  cityFlyHead.addEventListener('mousedown', function(e) {
    if (e.target.tagName === 'BUTTON') return;
    cfDragging = true;
    var r = cityFlyPanel.getBoundingClientRect();
    cfDragOx = e.clientX - r.left;
    cfDragOy = e.clientY - r.top;
    cityFlyHead.classList.add('dragging');
    e.preventDefault();
  });
  cityFlyHead.addEventListener('touchstart', function(e) {
    if (e.target.tagName === 'BUTTON') return;
    if (e.touches.length !== 1) return;
    cfDragging = true;
    var r = cityFlyPanel.getBoundingClientRect();
    cfDragOx = e.touches[0].clientX - r.left;
    cfDragOy = e.touches[0].clientY - r.top;
    cityFlyHead.classList.add('dragging');
    e.preventDefault();
  }, {passive: false});
  document.addEventListener('mousemove', function(e) {
    if (!cfDragging) return;
    cityFlyPanel.style.left = (e.clientX - cfDragOx) + 'px';
    cityFlyPanel.style.top = (e.clientY - cfDragOy) + 'px';
    cityFlyPanel.style.right = 'auto';
    cityFlyPanel.style.bottom = 'auto';
  });
  document.addEventListener('touchmove', function(e) {
    if (!cfDragging) return;
    if (e.touches.length !== 1) return;
    cityFlyPanel.style.left = (e.touches[0].clientX - cfDragOx) + 'px';
    cityFlyPanel.style.top = (e.touches[0].clientY - cfDragOy) + 'px';
    cityFlyPanel.style.right = 'auto';
    cityFlyPanel.style.bottom = 'auto';
    e.preventDefault();
  }, {passive: false});
  document.addEventListener('mouseup', function() {
    if (cfDragging) { cfDragging = false; cityFlyHead.classList.remove('dragging'); }
  });
  document.addEventListener('touchend', function() {
    if (cfDragging) { cfDragging = false; cityFlyHead.classList.remove('dragging'); }
  });
  document.getElementById('city-fly-close').addEventListener('click', function() {
    cityFlyPanel.classList.remove('open');
    cityFlyPin.style.display = 'none';
    cityFlyPos3d = null;
  });

  function closeAllHeritageModals() {
    ch2Overlay.classList.remove('open');
    clOverlay.classList.remove('open');
    chOverlay.classList.remove('open');
    citiesModalOverlay.classList.remove('open');
    cityStatsOverlay.classList.remove('open');
  }

  function openCityFlyPanel(cityName, cc, lat, lon) {
    cityFlyPos3d = latLonTo3D(lat, lon);
    cityFlyJustOpened = true;
    cityFlyFlag.textContent = cc ? ccToFlag(cc) : '';
    cityFlyCity.textContent = cityName;
    cityFlyCount.textContent = '';
    cityFlyBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:16px;font-size:12px">読み込み中...</div>';
    cityFlyPin.style.display = '';
    cityFlyPanel.classList.add('open');
    fetch('/api/city-all-heritages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city_name: cityName, lat: lat, lon: lon })
    }).then(function(r) { return r.json(); }).then(function(data) {
      var heritages = data.heritages || [];
      cityFlyCount.textContent = '(' + heritages.length + '件)';
      if(heritages.length === 0) {
        cityFlyBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:16px;font-size:12px">近隣の世界遺産なし</div>';
        return;
      }
      var html = '';
      heritages.forEach(function(h) {
        var hd = HERITAGE.filter(function(d){ return d.n === h.heritage_name; })[0];
        var emoji = hd ? hd.e : '🏛️';
        var hFlag = hd ? hd.f : '';
        var safeName = h.heritage_name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        var distStr = h.distance_km < 10 ? h.distance_km.toFixed(1) + 'km' : Math.round(h.distance_km) + 'km';
        var idx = hd ? HERITAGE.indexOf(hd) : -1;
        html += '<div class="city-fly-row"' + (idx >= 0 ? ' data-idx="' + idx + '"' : '') + '>' +
          '<span class="city-fly-row-emoji">' + emoji + '</span>' +
          '<span class="city-fly-row-flag">' + hFlag + '</span>' +
          '<span class="city-fly-row-name">' + safeName + '</span>' +
          '<span class="city-fly-row-dist">' + distStr + '</span>' +
          '</div>';
      });
      cityFlyBody.innerHTML = html;
      cityFlyBody.querySelectorAll('.city-fly-row[data-idx]').forEach(function(el) {
        el.addEventListener('click', function() {
          showMarkerTooltip(parseInt(el.getAttribute('data-idx')), 0, 0);
        });
      });
    }).catch(function() {
      cityFlyBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:16px;font-size:12px">取得エラー</div>';
    });
  }

  function openCityListModal(names, countryLabel) {
    clTitle.textContent = countryLabel + ' 都市一覧';
    clBadge.textContent = '';
    clBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:20px">読み込み中...</div>';
    clOverlay.classList.add('open');
    fetch('/api/heritage-country-unique-cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: names })
    }).then(function(r) { return r.json(); }).then(function(data) {
      var cities = data.cities || [];
      clBadge.textContent = cities.length + ' 都市';
      if(cities.length === 0) {
        clBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:20px">データなし</div>';
        return;
      }
      var html = '';
      cities.forEach(function(city) {
        var safeCity = city.city_name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        var flagEmoji = city.country_code ? ccToFlag(city.country_code) : '🏙️';
        var kana = cityToKana(city.city_name);
        var kanaHtml = kana ? ' <span class="cl-item-kana">' + kana + '</span>' : '';
        html += '<div class="cl-item" data-city="' + safeCity + '" data-lat="' + city.lat + '" data-lon="' + city.lon + '" data-cc="' + (city.country_code || '') + '">' +
          '<span class="cl-item-flag">' + flagEmoji + '</span>' +
          '<span class="cl-item-name">' + safeCity + kanaHtml + '</span>' +
          '<span class="cl-item-count">' + city.near_count + '遺産地</span>' +
          '</div>';
      });
      clBody.innerHTML = html;
      clBody.querySelectorAll('.cl-item').forEach(function(el) {
        el.addEventListener('click', function() {
          var cityName = el.getAttribute('data-city');
          var lat = parseFloat(el.getAttribute('data-lat'));
          var lon = parseFloat(el.getAttribute('data-lon'));
          openCityHeritageModal(cityName, lat, lon, names);
        });
        var nameEl = el.querySelector('.cl-item-name');
        if(nameEl) {
          nameEl.addEventListener('click', function(e) {
            e.stopPropagation();
            var cityName = el.getAttribute('data-city');
            var lat = parseFloat(el.getAttribute('data-lat'));
            var lon = parseFloat(el.getAttribute('data-lon'));
            var cc = el.getAttribute('data-cc');
            closeAllHeritageModals();
            flyTo(lat, lon);
            openCityFlyPanel(cityName, cc, lat, lon);
          });
        }
      });
    }).catch(function() {
      clBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:20px">取得エラー</div>';
    });
  }

  function openCityHeritageModal(cityName, lat, lon, names) {
    ch2Title.textContent = '🏙️ ' + cityName + ' から近い順の世界遺産';
    ch2Body.innerHTML = '<div style="color:#8b949e;text-align:center;padding:20px">読み込み中...</div>';
    ch2Overlay.classList.add('open');
    fetch('/api/heritage-city-heritages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city_name: cityName, lat: lat, lon: lon, names: names })
    }).then(function(r) { return r.json(); }).then(function(data) {
      var heritages = data.heritages || [];
      if(heritages.length === 0) {
        ch2Body.innerHTML = '<div style="color:#8b949e;text-align:center;padding:20px">データなし</div>';
        return;
      }
      var html = '';
      heritages.forEach(function(h) {
        var hd = HERITAGE.filter(function(d){ return d.n === h.heritage_name; })[0];
        var emoji = hd ? hd.e : '🏛️';
        var safeName = h.heritage_name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        var distStr = h.distance_km < 10 ? h.distance_km.toFixed(1) + 'km' : Math.round(h.distance_km) + 'km';
        var idx = hd ? HERITAGE.indexOf(hd) : -1;
        html += '<div class="ch2-item"' + (idx >= 0 ? ' data-idx="' + idx + '"' : '') + '>' +
          '<span class="ch2-item-emoji">' + emoji + '</span>' +
          '<span class="ch2-item-name">' + safeName + '</span>' +
          '<span class="ch2-item-dist">' + distStr + '</span>' +
          '</div>';
      });
      ch2Body.innerHTML = html;
      ch2Body.querySelectorAll('.ch2-item[data-idx]').forEach(function(el) {
        el.addEventListener('click', function() {
          showMarkerTooltip(parseInt(el.getAttribute('data-idx')), 0, 0);
        });
      });
    }).catch(function() {
      ch2Body.innerHTML = '<div style="color:#8b949e;text-align:center;padding:20px">取得エラー</div>';
    });
  }

  document.getElementById('rail-side-close').addEventListener('click', function() {
    railSide.classList.remove('open');
    stopRailTour();
  });
  function bindRailSideRows() {
    railSideBody.querySelectorAll('.rail-station-row').forEach(function(el) {
      el.addEventListener('click', function() {
        stopRailTour();
        var lineIdx = parseInt(el.getAttribute('data-line-idx'), 10);
        var stationIdx = parseInt(el.getAttribute('data-station-idx'), 10);
        var line = RAIL_LINES[lineIdx];
        var station = line.stations[stationIdx];
        flyTo(station.lat, station.lon);
        zoom = 1.2;
        cacheStationCities(station.name, station.lat, station.lon);
        setTimeout(function() {
          railStationPin.style.display = 'block';
          railStationPinLabel.style.display = 'block';
          showRailStationPin(line, station, stationIdx);
        }, FLY_DUR + 100);
      });
    });
    railSideBody.querySelectorAll('.rail-tour-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var lineIdx = parseInt(btn.getAttribute('data-line-idx'), 10);
        if (railTourRunning && railTourLineIdx === lineIdx) stopRailTour();
        else startRailTour(lineIdx);
      });
    });
  }
  document.getElementById('btnRail').addEventListener('click', function() {
    if (railSide.classList.contains('open')) {
      railSide.classList.remove('open');
      stopRailTour();
      return;
    }
    railSideBody.innerHTML = renderRailSideBody();
    bindRailSideRows();
    railSide.classList.add('open');
  });

  document.getElementById('f1-side-close').addEventListener('click', function() {
    f1Side.classList.remove('open');
    stopF1Tour();
  });
  document.getElementById('f1-tour-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    if (f1TourRunning) stopF1Tour();
    else startF1Tour();
  });
  document.getElementById('f1-circuit-pin-close-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    stopF1Tour();
    f1CircuitPin3d = null;
    f1CircuitPin.style.display = 'none';
    f1CircuitPinLabel.style.display = 'none';
  });
  document.getElementById('rail-station-pin-close-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    stopRailTour();
    railStationPin3d = null;
    railStationPin.style.display = 'none';
    railStationPinLabel.style.display = 'none';
  });
  document.getElementById('btnF1').addEventListener('click', function() {
    if (f1Side.classList.contains('open')) {
      f1Side.classList.remove('open');
      stopF1Tour();
      return;
    }
    f1Side.classList.add('open');
    renderF1SidePanel();
    stopF1Tour();
    focusF1Circuit(findUpcomingF1Idx(), true);
    var today = new Date();
    renderF1Calendar(today.getFullYear(), today.getMonth() + 1, today.getDate());
  });

  var cityStatsOverlay = document.getElementById('city-stats-overlay');
  var cityStatsBody = document.getElementById('city-stats-body');
  var cityStatsBadge = document.getElementById('city-stats-badge');
  document.getElementById('city-stats-close').addEventListener('click', function() {
    cityStatsOverlay.classList.remove('open');
  });
  cityStatsOverlay.addEventListener('click', function(e) {
    if(e.target === cityStatsOverlay) cityStatsOverlay.classList.remove('open');
  });

  document.getElementById('btnCityStats').addEventListener('click', function() {
    cityStatsBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:20px">読み込み中...</div>';
    cityStatsBadge.textContent = '';
    cityStatsOverlay.classList.add('open');
    fetch('/api/heritage-country-stats')
      .then(function(r){ return r.json(); })
      .then(function(data) {
        var rows = data.rows || [];
        if(rows.length === 0) {
          cityStatsBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:20px">データなし</div>';
          return;
        }
        var total = 0;
        rows.forEach(function(r){ total += r.heritage_count; });
        cityStatsBadge.textContent = '計 ' + total + ' 件';
        var max = rows[0].heritage_count;
        var html = '';
        rows.forEach(function(r) {
          var flag = ccToFlag(r.country_code);
          var barW = Math.round(r.heritage_count / max * 100);
          var cc = r.country_code;
          html += '<div class="cities-modal-row" style="padding:3px 0">' +
            '<button class="city-stats-row-btn" data-cc="' + cc + '">' +
              '<span class="cities-modal-flag">' + flag + '</span>' +
              '<span style="color:#8b949e;font-size:10px;min-width:28px">' + cc + '</span>' +
              '<div style="flex:1;background:#161b22;border-radius:4px;height:10px;overflow:hidden">' +
                '<div style="background:#388bfd;height:100%;width:' + barW + '%"></div>' +
              '</div>' +
              '<span style="color:#c9d1d9;font-size:12px;font-weight:600;min-width:28px;text-align:right">' + r.heritage_count + '</span>' +
            '</button>' +
            '</div>';
        });
        cityStatsBody.innerHTML = html;
        cityStatsBody.querySelectorAll('.city-stats-row-btn').forEach(function(btn) {
          btn.addEventListener('click', function() { showCountryHeritagePanel(btn.getAttribute('data-cc')); });
        });
      })
      .catch(function() {
        cityStatsBody.innerHTML = '<div style="color:#8b949e;text-align:center;padding:20px">取得エラー</div>';
      });
  });

  var landingExitBtn = document.getElementById('landing-exit');
  if (landingExitBtn) landingExitBtn.addEventListener('click', stopLanding);
  if (landingSpinToggleEl) {
    landingSpinToggleEl.addEventListener('click', function() {
      spin360Enabled = !spin360Enabled;
      if(spin360Enabled) {
        landingSpinToggleEl.classList.add('active');
        landingSpinToggleEl.textContent = '🔄 360°スイープ ON';
      } else {
        landingSpinToggleEl.classList.remove('active');
        landingSpinToggleEl.textContent = '🔄 360°スイープ';
        landingSpinAngle = 0;
      }
    });
  }

  function hideTooltip() { tooltip.style.opacity = '0'; activeIdx = -1; }

  function avoidPinLabelOverlap() {
    var otherMinTop = null;
    [railStationPinLabel, f1CircuitPinLabel].forEach(function(el) {
      if (!el || el.style.display === 'none') return;
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (otherMinTop === null || r.top < otherMinTop) otherMinTop = r.top;
    });
    if (otherMinTop === null) return;
    var tRect = tooltip.getBoundingClientRect();
    var GAP = 10;
    if (tRect.bottom > otherMinTop) {
      var shift = tRect.bottom - otherMinTop + GAP;
      var currentTop = parseFloat(tooltip.style.top) || 0;
      tooltip.style.top = (currentTop - shift) + 'px';
    }
  }

  function positionTooltip(vx, vy) {
    var isNearTop = vy < canvasRect.top + 80;
    tooltip.style.left = vx + 'px';
    tooltip.style.top  = vy + 'px';
    if (isNearTop) { tooltip.classList.add('below'); } else { tooltip.classList.remove('below'); }
    avoidPinLabelOverlap();
  }

  function showMarkerTooltip(idx, vx, vy) {
    var d = HERITAGE[idx];
    var col = typeColor(d.t);
    var cityIcon = hasCityDataSet[d.n] ? ' 🌆' : '';
    var gemmaShareId = heritageMitokoroGemmaShareId[d.n];
    var llamaShareId = heritageMitokoroLlamaShareId[d.n];
    var gemmaIcon = gemmaShareId ? ' <span id="tt-mitokoro-gemma-btn" style="cursor:pointer;" title="見どころ(gemma-4-26b-a4b-it)の説明を表示">👀</span>' : '';
    var llamaIcon = llamaShareId ? ' <span id="tt-mitokoro-llama-btn" style="cursor:pointer;" title="見どころ(llama-3.3-70b-instruct-fp8-fast)の説明を表示">👁️</span>' : '';
    tooltip.innerHTML = '<div class="tt-name">' + d.e + ' ' + d.f + ' ' + d.n + cityIcon + gemmaIcon + llamaIcon + '</div><div class="tt-sub"><span style="color:' + col + ';font-weight:600">' + d.t + '</span>  ' + d.c + '  ' + d.y + '年登録</div><div style="margin-top:7px;text-align:center;"><button id="tt-land-btn" style="background:#0c2d1a;border:1px solid #3fb950;border-radius:6px;color:#3fb950;font-size:11px;padding:4px 12px;cursor:pointer;font-family:inherit;">🚶 地表に降り立つ</button></div>';
    var landBtn = document.getElementById('tt-land-btn');
    if (landBtn) {
      (function(ci) {
        landBtn.addEventListener('click', function(e) { e.stopPropagation(); startLanding(ci); });
      })(idx);
    }
    var mitokoroGemmaBtn = document.getElementById('tt-mitokoro-gemma-btn');
    if (mitokoroGemmaBtn) {
      (function(name, shareId) {
        mitokoroGemmaBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          openHeritageMitokoroCacheModal('👀', name, shareId);
        });
      })(d.n, gemmaShareId);
    }
    var mitokoroLlamaBtn = document.getElementById('tt-mitokoro-llama-btn');
    if (mitokoroLlamaBtn) {
      (function(name, shareId) {
        mitokoroLlamaBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          openHeritageMitokoroCacheModal('👁️', name, shareId);
        });
      })(d.n, llamaShareId);
    }
    if (vx === 0 && vy === 0) {
      var cx = canvasRect.left + canvasRect.width / 2;
      var cy = canvasRect.top + canvasRect.height / 2;
      positionTooltip(cx, cy);
    } else {
      positionTooltip(vx, vy);
    }
    tooltip.style.opacity = '1';
    activeIdx = idx;
    flyTo(d.lat, d.lon);
  }

  function getNextZ() {
    var max = 500;
    document.querySelectorAll('div[data-overlay]').forEach(function(el) {
      var z = parseInt(el.style.zIndex, 10) || 0;
      if (z > max && z < 9000) max = z;
    });
    return max + 100;
  }

  ${getMarkdownParserScript()}

  function openHeritageMitokoroCacheModal(icon, heritageName, shareId) {
    var overlay = document.createElement('div');
    overlay.setAttribute('data-overlay', '');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:' + getNextZ() + ';display:flex;align-items:center;justify-content:center;padding:20px;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#0d1117;border:1px solid #388bfd;border-radius:12px;width:min(560px,94vw);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #21262d;flex-shrink:0;gap:10px;';
    var titleEl = document.createElement('span');
    titleEl.textContent = icon + ' ' + heritageName + ' — 見どころ';
    titleEl.style.cssText = 'font-weight:700;font-size:13px;color:#e6edf3;';
    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', '閉じる');
    closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;color:#8b949e;padding:4px 8px;flex-shrink:0;';
    closeBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
    head.appendChild(titleEl);
    head.appendChild(closeBtn);
    box.appendChild(head);

    var body = document.createElement('div');
    body.className = 'mitokoro-md';
    body.style.cssText = 'padding:16px 18px;overflow-y:auto;flex:1;font-size:13px;color:#c9d1d9;line-height:1.7;';
    body.textContent = '読み込み中...';
    box.appendChild(body);

    overlay.appendChild(box);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
    document.body.appendChild(overlay);

    fetch('/api/aichat/shares/' + encodeURIComponent(shareId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.answer) {
          body.innerHTML = parseMd(data.answer);
        } else {
          body.textContent = data.error || '（応答なし）';
        }
      })
      .catch(function() {
        body.textContent = '通信エラーが発生しました。';
      });
  }

  // Build marker DOM elements
  var mkEls = [];
  for (var i = 0; i < HERITAGE.length; i++) {
    var d = HERITAGE[i];
    var el = document.createElement('div');
    el.className = 'mk';
    el.textContent = d.e;
    el.style.opacity = '0';
    (function(idx) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var r = el.getBoundingClientRect();
        showMarkerTooltip(idx, r.left + r.width/2, r.top + r.height/2);
      });
      el.addEventListener('touchend', function(e) {
        e.preventDefault(); e.stopPropagation();
        var r = el.getBoundingClientRect();
        showMarkerTooltip(idx, r.left + r.width/2, r.top + r.height/2);
      });
    })(i);
    markersDiv.appendChild(el);
    mkEls.push({el: el, pos3d: latLonTo3D(d.lat, d.lon)});
  }

  // Build proximity list DOM (pre-create all items)
  var listItemEls = HERITAGE.map(function(d, i) {
    var col = typeColor(d.t);
    var bg = thumbBg(d.t);
    var el = document.createElement('div');
    el.className = 'site-item';
    el.innerHTML =
      '<div class="site-thumb" style="background:' + bg + '">' + d.e + '</div>' +
      '<div class="site-body">' +
        '<div class="site-top">' +
          '<span class="site-flag">' + d.f + '</span>' +
          '<span class="site-name">' + d.n + '</span>' +
        '</div>' +
        '<div class="site-meta"><span class="type-label" style="color:' + col + '">' + d.t + '</span> · ' + d.c + ' ' + d.y + '年</div>' +
      '</div>';
    el.addEventListener('click', function() { showMarkerTooltip(i, 0, 0); });
    siteList.appendChild(el);
    return el;
  });

  var searchText = '';
  var listUpdateTick = 0;

  function updateProximityList() {
    var order = HERITAGE.map(function(d, i) {
      var p = mkEls[i].pos3d;
      var mz = model[2]*p[0] + model[6]*p[1] + model[10]*p[2];
      return {i: i, mz: mz};
    });
    order.sort(function(a, b) { return b.mz - a.mz; });

    var q = searchText.toLowerCase();
    var visible = 0;
    var frag = document.createDocumentFragment();
    var hidden = [];
    order.forEach(function(item) {
      var d = HERITAGE[item.i];
      var show = !q || d.n.indexOf(q) >= 0 || d.c.indexOf(q) >= 0 || d.t.indexOf(q) >= 0;
      if (show) { frag.appendChild(listItemEls[item.i]); visible++; }
      else { hidden.push(listItemEls[item.i]); }
    });
    hidden.forEach(function(el) { frag.appendChild(el); });
    siteList.appendChild(frag);

    // Toggle visibility
    order.forEach(function(item) {
      var d = HERITAGE[item.i];
      var show = !q || d.n.indexOf(q) >= 0 || d.c.indexOf(q) >= 0 || d.t.indexOf(q) >= 0;
      listItemEls[item.i].style.display = show ? '' : 'none';
    });

    // Highlight active
    listItemEls.forEach(function(el, i) { el.classList.toggle('active', i === activeIdx); });
    resultCount.textContent = q ? (visible + ' / ' + HERITAGE.length + ' 件') : (HERITAGE.length + ' 件');
  }

  searchInput.addEventListener('input', function() {
    searchText = searchInput.value;
    updateProximityList();
  });

  canvas.addEventListener('click', function() { hideTooltip(); stopAmericaTour(); stopEuropeTour(); stopAfricaTour(); });

  gl.enable(gl.DEPTH_TEST);

  var startTime = performance.now();
  var frames = 0, lastFps = startTime;

  function frame(now) {
    requestAnimationFrame(frame);
    resize();
    var W = canvas.width, H = canvas.height;
    if (W === 0 || H === 0) return;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0.02, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (landingMode && landingPhase > 0) {
      if (landingWaiting && landingLastFrameTime > 0) {
        landingPhaseStart += (now - landingLastFrameTime);
      }
      if (landingPhase === 1) {
        var lp1 = Math.min((now - landingPhaseStart) / LANDING_ZOOM_IN_DUR, 1);
        var le1 = lp1 * lp1 * (3 - 2 * lp1);
        zoom = landingZoomFrom + (LANDING_ZOOM_TARGET - landingZoomFrom) * le1;
        if (landingStatusEl) landingStatusEl.textContent = '降下中...';
        if (landingProgEl) landingProgEl.style.width = Math.round(le1 * 35) + '%';
        if (lp1 >= 1) {
          landingPhase = 2;
          landingPhaseStart = now;
          landingSpinAngle = 0;
          zoom = LANDING_ZOOM_TARGET;
        }
      } else if (landingPhase === 2) {
        var lp2 = Math.min((now - landingPhaseStart) / LANDING_ROT_DUR, 1);
        if (spin360Enabled) {
          landingSpinAngle = lp2 * Math.PI * 2;
          var deg2 = Math.round(lp2 * 360);
          if (landingStatusEl) landingStatusEl.textContent = '地表を見渡し中... ' + deg2 + '°';
        } else {
          landingSpinAngle = 0;
          if (landingStatusEl) landingStatusEl.textContent = '地表を見渡し中';
        }
        if (landingProgEl) landingProgEl.style.width = Math.round(35 + lp2 * 40) + '%';
        if (lp2 >= 1 && !landingWaiting) {
          landingPhase = 3;
          landingPhaseStart = now;
          landingZoomOutFrom = zoom;
        }
      } else if (landingPhase === 3) {
        var lp3 = Math.min((now - landingPhaseStart) / LANDING_ZOOM_OUT_DUR, 1);
        var le3 = lp3 * lp3 * (3 - 2 * lp3);
        zoom = landingZoomOutFrom + (LANDING_ZOOM_RETURN - landingZoomOutFrom) * le3;
        rotXv = landingRotXFrom + (0.3 - landingRotXFrom) * le3;
        if (landingStatusEl) landingStatusEl.textContent = '帰還中...';
        if (landingProgEl) landingProgEl.style.width = Math.round(75 + le3 * 25) + '%';
        if (lp3 >= 1 && !landingWaiting) { landingSpinAngle = 0; stopLanding(); }
      }
    } else if (flyTarget !== null) {
      var fp = Math.min((now - flyStart) / FLY_DUR, 1);
      var fe = fp * fp * (3 - 2 * fp);
      rotYv = flyFrom.ry + (flyTarget.ry - flyFrom.ry) * fe;
      rotXv = flyFrom.rx + (flyTarget.rx - flyFrom.rx) * fe;
      if (fp >= 1) flyTarget = null;
    } else {
      rotSpd = parseFloat(rotSpdEl.value);
      if (autoRot) rotYv += 0.003 * rotSpd;
      var wasSpinning = Math.abs(momentumY) > 0.0002 || Math.abs(momentumX) > 0.0002;
      if (Math.abs(momentumY) > 0.0002) { rotYv += momentumY; momentumY *= MOMENTUM_DECAY; } else { momentumY = 0; }
      if (!axisLocked && Math.abs(momentumX) > 0.0002) { rotXv = clampElev(rotXv + momentumX); momentumX *= MOMENTUM_DECAY; } else { momentumX = 0; }
      if (axisLocked) rotXv = 0;
      var nowSpinning = Math.abs(momentumY) > 0.0002 || Math.abs(momentumX) > 0.0002;
      if (wasSpinning && !nowSpinning && !autoRot) {
        var bestIdx = -1, bestMz = -1;
        for (var si = 0; si < HERITAGE.length; si++) {
          var sp = mkEls[si] ? mkEls[si].pos3d : null;
          if (!sp) continue;
          var smz = model[2]*sp[0] + model[6]*sp[1] + model[10]*sp[2];
          if (smz > bestMz) { bestMz = smz; bestIdx = si; }
        }
        if (bestIdx >= 0) {
          var bd = HERITAGE[bestIdx];
          showMarkerTooltip(bestIdx, 0, 0);
        }
      }
    }

    var landFov = landingMode ? Math.PI / 2.8 : Math.PI / 4;
    var landNear = landingMode ? 0.02 : 0.1;
    persp(proj, landFov, W / H, landNear, 100);
    trans(view, 0, 0, -zoom);
    rotY(ry, rotYv); rotZ(tz, axialTilt); rotX(rx, rotXv);
    mul(tmp2, tz, ry);
    mul(model, rx, tmp2);
    if (landingMode && landingPhase === 2 && landingIdx >= 0) {
      var lsite = HERITAGE[landingIdx];
      var lsp = latLonTo3D(lsite.lat, lsite.lon);
      rotAround(landSpin, lsp[0], lsp[1], lsp[2], landingSpinAngle);
      mul(tmp2, model, landSpin);
      model.set(tmp2);
    }
    mul(tmp, view, model);
    mul(mvp, proj, tmp);

    if (autoRot && isListMode && flyTarget === null) {
      var nearestIdx2 = -1, nearestMz2 = -1;
      for (var si2 = 0; si2 < HERITAGE.length; si2++) {
        var sp2 = mkEls[si2] ? mkEls[si2].pos3d : null;
        if (!sp2) continue;
        var smz2 = model[2]*sp2[0] + model[6]*sp2[1] + model[10]*sp2[2];
        if (smz2 > nearestMz2) { nearestMz2 = smz2; nearestIdx2 = si2; }
      }
      if (nearestIdx2 >= 0 && nearestIdx2 !== activeIdx) {
        activeIdx = nearestIdx2;
        var nd = HERITAGE[nearestIdx2];
        var nc = typeColor(nd.t);
        tooltip.innerHTML = '<div class="tt-name">' + nd.e + ' ' + nd.f + ' ' + nd.n + '</div><div class="tt-sub"><span style="color:' + nc + ';font-weight:600">' + nd.t + '</span>  ' + nd.c + '  ' + nd.y + '年登録</div>';
        tooltip.style.opacity = '1';
      }
    }

    var sd = getSunDir();
    gl.uniform3f(uLight, sd[0], sd[1], sd[2]);
    gl.uniformMatrix4fv(uMVP,   false, mvp);
    gl.uniformMatrix4fv(uModel, false, model);

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texEarth);
    gl.drawElements(gl.TRIANGLES, idxs.length, gl.UNSIGNED_SHORT, 0);

    for (var mi = 0; mi < mkEls.length; mi++) {
      var mk = mkEls[mi];
      var mp = mk.pos3d;
      var mz = model[2]*mp[0] + model[6]*mp[1] + model[10]*mp[2];
      if (mz > 0.12) {
        var mcx = mvp[0]*mp[0] + mvp[4]*mp[1] + mvp[8]*mp[2]  + mvp[12];
        var mcy = mvp[1]*mp[0] + mvp[5]*mp[1] + mvp[9]*mp[2]  + mvp[13];
        var mcw = mvp[3]*mp[0] + mvp[7]*mp[1] + mvp[11]*mp[2] + mvp[15];
        if (mcw > 0) {
          var px = (mcx/mcw+1)*0.5*W;
          var py = (1-mcy/mcw)*0.5*H;
          mk.el.style.left = px + 'px';
          mk.el.style.top  = py + 'px';
          mk.el.style.opacity = '1';
          if (mi === activeIdx) {
            positionTooltip(canvasRect.left + px, canvasRect.top + py);
            tooltip.style.opacity = '1';
          }
        } else {
          mk.el.style.opacity = '0';
          if (mi === activeIdx) hideTooltip();
        }
      } else {
        mk.el.style.opacity = '0';
        if (mi === activeIdx) hideTooltip();
      }
    }

    for (var ci = 0; ci < cityMkEls.length; ci++) {
      var cmk = cityMkEls[ci];
      var cp = cmk.pos3d;
      var cmz = model[2]*cp[0] + model[6]*cp[1] + model[10]*cp[2];
      if (cmz > 0.05) {
        var ccx = mvp[0]*cp[0] + mvp[4]*cp[1] + mvp[8]*cp[2]  + mvp[12];
        var ccy = mvp[1]*cp[0] + mvp[5]*cp[1] + mvp[9]*cp[2]  + mvp[13];
        var ccw = mvp[3]*cp[0] + mvp[7]*cp[1] + mvp[11]*cp[2] + mvp[15];
        if (ccw > 0) {
          var cpx = (ccx/ccw+1)*0.5*W;
          var cpy = (1-ccy/ccw)*0.5*H;
          cmk.el.style.left = cpx + 'px';
          cmk.el.style.top  = cpy + 'px';
          cmk.el.style.opacity = '1';
        } else {
          cmk.el.style.opacity = '0';
        }
      } else {
        cmk.el.style.opacity = '0';
      }
    }

    function updateWorldPin(pos3d, pinEl, labelEl) {
      if (!pos3d) return;
      var mz = model[2]*pos3d[0] + model[6]*pos3d[1] + model[10]*pos3d[2];
      if (mz > 0.05) {
        var cx = mvp[0]*pos3d[0] + mvp[4]*pos3d[1] + mvp[8]*pos3d[2]  + mvp[12];
        var cy = mvp[1]*pos3d[0] + mvp[5]*pos3d[1] + mvp[9]*pos3d[2]  + mvp[13];
        var cw = mvp[3]*pos3d[0] + mvp[7]*pos3d[1] + mvp[11]*pos3d[2] + mvp[15];
        if (cw > 0) {
          var sx = canvasRect.left + (cx/cw+1)*0.5*W;
          var sy = canvasRect.top + (1-cy/cw)*0.5*H;
          pinEl.style.left = sx + 'px';
          pinEl.style.top = sy + 'px';
          pinEl.style.display = '';
          if (labelEl) { labelEl.style.left = sx + 'px'; labelEl.style.top = sy + 'px'; labelEl.style.display = ''; }
          return;
        }
      }
      pinEl.style.display = 'none';
      if (labelEl) labelEl.style.display = 'none';
    }

    function projectLatLonToScreen(lat, lon) {
      var p = latLonTo3D(lat, lon);
      var mz = model[2]*p[0] + model[6]*p[1] + model[10]*p[2];
      if (mz <= 0.05) return null;
      var cx = mvp[0]*p[0] + mvp[4]*p[1] + mvp[8]*p[2]  + mvp[12];
      var cy = mvp[1]*p[0] + mvp[5]*p[1] + mvp[9]*p[2]  + mvp[13];
      var cw = mvp[3]*p[0] + mvp[7]*p[1] + mvp[11]*p[2] + mvp[15];
      if (cw <= 0) return null;
      return { x: canvasRect.left + (cx/cw+1)*0.5*W, y: canvasRect.top + (1-cy/cw)*0.5*H };
    }

    // ドラッグ中は生の画面座標で描く updateBoxOverlay() が優先される。ドラッグ完了後は
    // 選択時の中心・左上・右下座標(lastBoxBounds.corner0/corner1)を毎フレーム再投影し、
    // ズームやドラッグ回転で見え方が変わっても選択エリアの枠が正しい位置・大きさで
    // 地球儀に追従し続けるようにする（枠自体は明示的な✕クリックまで消さない）。
    function updateBoxOverlayFromBounds() {
      if (boxDragging || !lastBoxBounds || !lastBoxBounds.corner0 || !lastBoxBounds.corner1) return;
      var s0 = projectLatLonToScreen(lastBoxBounds.corner0.lat, lastBoxBounds.corner0.lon);
      var s1 = projectLatLonToScreen(lastBoxBounds.corner1.lat, lastBoxBounds.corner1.lon);
      if (!s0 || !s1) { boxZoomOverlay.style.display = 'none'; return; }
      var left = Math.min(s0.x, s1.x) - canvasRect.left, top = Math.min(s0.y, s1.y) - canvasRect.top;
      boxZoomOverlay.style.left = left + 'px';
      boxZoomOverlay.style.top = top + 'px';
      boxZoomOverlay.style.width = Math.abs(s1.x - s0.x) + 'px';
      boxZoomOverlay.style.height = Math.abs(s1.y - s0.y) + 'px';
      boxZoomOverlay.style.display = 'block';
    }
    updateBoxOverlayFromBounds();

    if (cityFlyPos3d) {
      var cfp = cityFlyPos3d;
      var cfmz = model[2]*cfp[0] + model[6]*cfp[1] + model[10]*cfp[2];
      if (cfmz > 0.05) {
        var cfcx = mvp[0]*cfp[0] + mvp[4]*cfp[1] + mvp[8]*cfp[2]  + mvp[12];
        var cfcy = mvp[1]*cfp[0] + mvp[5]*cfp[1] + mvp[9]*cfp[2]  + mvp[13];
        var cfcw = mvp[3]*cfp[0] + mvp[7]*cfp[1] + mvp[11]*cfp[2] + mvp[15];
        if (cfcw > 0) {
          var cfsx = canvasRect.left + (cfcx/cfcw+1)*0.5*W;
          var cfsy = canvasRect.top + (1-cfcy/cfcw)*0.5*H;
          cityFlyPin.style.left = cfsx + 'px';
          cityFlyPin.style.top = cfsy + 'px';
          cityFlyPin.style.display = '';
          if (cityFlyJustOpened && cityFlyPanel.classList.contains('open')) {
            cityFlyJustOpened = false;
            var panW = cityFlyPanel.offsetWidth || 300;
            var panH = cityFlyPanel.offsetHeight || 320;
            var cfLx = Math.max(4, cfsx - panW - 20);
            var cfLy = Math.max(4, Math.min(window.innerHeight - panH - 4, cfsy - panH / 2));
            cityFlyPanel.style.left = cfLx + 'px';
            cityFlyPanel.style.top = cfLy + 'px';
            cityFlyPanel.style.right = 'auto';
            cityFlyPanel.style.bottom = 'auto';
          }
        } else {
          cityFlyPin.style.display = 'none';
        }
      } else {
        cityFlyPin.style.display = 'none';
      }
    }

    updateWorldPin(f1CircuitPin3d, f1CircuitPin, f1CircuitPinLabel);
    updateWorldPin(railStationPin3d, railStationPin, railStationPinLabel);

    // Update proximity list every 30 frames
    listUpdateTick++;
    if (listUpdateTick >= 30) {
      listUpdateTick = 0;
      updateProximityList();
    }

    var tanHalfFov = Math.tan(Math.PI / 8);
    var sinAlpha = 1 / zoom;
    var cosAlpha = Math.sqrt(1 - sinAlpha * sinAlpha);
    var tanAlpha = sinAlpha / cosAlpha;
    var globeR = Math.round((H / 2) * tanAlpha / tanHalfFov);
    var gcx = Math.round(W / 2);
    var gcy = Math.round(H / 2);
    dbgGlobeRect.style.left = (gcx - globeR) + 'px';
    dbgGlobeRect.style.top  = (gcy - globeR) + 'px';
    dbgGlobeRect.style.width  = (globeR * 2) + 'px';
    dbgGlobeRect.style.height = (globeR * 2) + 'px';
    var visHalfDeg = Math.round(Math.asin(sinAlpha) * 180 / Math.PI);
    var zoomR = Math.round(globeR / zoom);
    dbgZoomRect.style.left = (gcx - zoomR) + 'px';
    dbgZoomRect.style.top  = (gcy - zoomR) + 'px';
    dbgZoomRect.style.width  = (zoomR * 2) + 'px';
    dbgZoomRect.style.height = (zoomR * 2) + 'px';
    dbgInfo.innerHTML =
      'Canvas: ' + W + ' x ' + H + '<br>' +
      'Globe: (' + (gcx - globeR) + ', ' + (gcy - globeR) + ') - (' + (gcx + globeR) + ', ' + (gcy + globeR) + ') r=' + globeR + '<br>' +
      'Zoom: ' + zoom.toFixed(2) + 'x  |  Visible: +/-' + visHalfDeg + 'deg';

    landingLastFrameTime = now;
    frames++;
    var dt = now - lastFps;
    if (dt >= 600) {
      var fps = Math.round(frames * 1000 / dt);
      var clock = new Date();
      var utcH = clock.getUTCHours() + clock.getUTCMinutes() / 60;
      var sunLonDeg = Math.round((12 - utcH) * 15);
      var ew = sunLonDeg >= 0 ? 'E' : 'W';
      var label = earthImg.complete && earthImg.naturalWidth > 0 ? '' : 'テクスチャ読込中 | ';
      hud.textContent = label + 'FPS: ' + fps + '  |  太陽: ' + Math.abs(sunLonDeg) + '°' + ew + '  |  ' + (autoRot ? '自転回転 ON' : '自転回転 OFF');
      frames = 0; lastFps = now;
    }
  }

  updateProximityList();
  requestAnimationFrame(frame);

  (function() {
    var sp = new URLSearchParams(window.location.search);
    var cityName = sp.get('city');
    var lat = parseFloat(sp.get('lat') || '');
    var lon = parseFloat(sp.get('lon') || '');
    var cc = sp.get('cc') || '';
    if (cityName && !isNaN(lat) && !isNaN(lon)) {
      openCityFlyPanel(cityName, cc, lat, lon);
    }
  })();
})();
</script>
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(function(){});
}
</script>
</body>
</html>`;
}
