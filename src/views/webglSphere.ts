function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getWebGLSpherePage(username: string): string {
  const safeUser = esc(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0d1117">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="地球儀">
<link rel="manifest" href="/manifest.json">
<title>WebGL 地球儀</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; height:100dvh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:#0d1117; border-bottom:1px solid #30363d; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
h1 { font-size:14px; font-weight:700; }
.badge { background:#0c2d4e; color:#58a6ff; font-size:10px; padding:2px 7px; border-radius:10px; font-weight:600; }
.body { display:grid; grid-template-columns:1fr 280px; grid-template-rows:1fr; flex:1; min-height:0; }
@media(max-width:900px){ .body{ grid-template-columns:1fr; } .side{ display:none; } }
.canvas-wrap { position:relative; background:#000010; overflow:hidden; }
canvas { position:absolute; inset:0; width:100%; height:100%; cursor:grab; touch-action:none; display:block; }
canvas:active { cursor:grabbing; }
.hud { position:absolute; bottom:10px; left:10px; background:rgba(0,0,0,.7); border:1px solid #30363d; border-radius:6px; padding:6px 10px; font-size:11px; font-family:monospace; color:#58a6ff; line-height:1.9; pointer-events:none; }
#markers { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden; }
.mk { position:absolute; transform:translate(-50%,-50%); line-height:1; font-size:18px; text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,0.9); pointer-events:auto; cursor:pointer; user-select:none; -webkit-user-select:none; }
.mk-ball { font-size:28px; }
#mk-tooltip { position:fixed; background:rgba(13,17,23,0.97); border:1px solid #58a6ff; border-radius:8px; padding:8px 14px; font-size:12px; color:#e6edf3; white-space:normal; max-width:320px; pointer-events:auto; opacity:0; transition:opacity .15s; z-index:60; transform:translate(-50%,-110%); line-height:1.7; text-align:center; }
#mk-tooltip.below { transform:translate(-50%, 14px); }
#mk-tooltip.tt-left-side { transform:translate(-100%, -50%); }
#mk-tooltip .tt-flag-lg { font-size:28px; line-height:1.3; display:block; }
#mk-tooltip .tt-name { font-weight:700; font-size:13px; }
#mk-tooltip .tt-code { font-size:11px; color:#8b949e; letter-spacing:1px; margin-bottom:4px; }
#mk-tooltip .tt-match { font-size:12px; margin-top:3px; }
#mk-tooltip .tt-flags { font-size:18px; letter-spacing:2px; }
#mk-tooltip .tt-time { color:#58a6ff; font-family:monospace; white-space:nowrap; font-size:11px; display:block; }
#mk-tooltip .tt-past { color:#555d68; }
#mk-tooltip .tt-mrow { margin-top:3px; font-size:12px; }
#mk-tooltip .tt-mrow-today { background:rgba(88,166,255,0.1); border-radius:4px; border-left:2px solid #58a6ff; padding-left:6px; margin-left:-6px; }
#mk-tooltip .tt-mrow.tt-past { color:#555d68; }
#mk-tooltip .tt-opp-tap { cursor:pointer; font-size:36px; line-height:1.2; }
#mk-tooltip .tt-opp-tap:hover { opacity:0.75; }
#mk-tooltip .tt-date-tap { cursor:pointer; text-decoration:none; }
#mk-tooltip .tt-date-tap:hover { opacity:0.75; }
.mk.elim { filter:grayscale(0.85) brightness(0.28) saturate(0.15); }
#schedule-panel { position:fixed; bottom:0; left:0; right:0; z-index:55; background:#0d1117; border-top:2px solid #58a6ff; border-radius:12px 12px 0 0; max-height:68vh; overflow-y:auto; transform:translateY(100%); transition:transform .3s ease; box-shadow:0 -4px 30px rgba(0,0,0,.8); }
#schedule-panel.open { transform:translateY(0); }
.sp-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 16px 8px; border-bottom:1px solid #30363d; position:sticky; top:0; background:#0d1117; z-index:1; }
.sp-title { font-size:13px; font-weight:700; color:#58a6ff; }
.sp-close { background:none; border:none; color:#8b949e; font-size:22px; line-height:1; cursor:pointer; padding:0 2px; }
.sp-date { padding:8px 16px 4px; font-size:10px; font-weight:700; color:#8b949e; text-transform:uppercase; letter-spacing:1px; }
.sp-match { display:flex; justify-content:space-between; align-items:center; padding:7px 16px; border-bottom:1px solid #21262d; }
.sp-match:last-child { border-bottom:none; }
.sp-flags { font-size:18px; letter-spacing:2px; }
.tm-code { font-size:10px; font-weight:700; letter-spacing:1px; color:#8b949e; font-family:'SFMono-Regular',Consolas,monospace; vertical-align:middle; }
.sp-time { font-family:monospace; font-size:12px; color:#58a6ff; }
.sp-match.sp-past { opacity:0.45; }
.sp-match.sp-today { background:rgba(88,166,255,0.07); }
.side { background:#0d1117; border-left:1px solid #30363d; overflow-y:auto; padding:16px; }
.side h2 { font-size:11px; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px; }
.item { margin-bottom:12px; }
.item-title { font-weight:600; font-size:12px; margin-bottom:3px; }
.item-desc { color:#8b949e; font-size:11px; line-height:1.6; }
code { background:#21262d; padding:1px 5px; border-radius:3px; font-family:monospace; font-size:10px; }
hr { border:none; border-top:1px solid #30363d; margin:12px 0; }
.tip { background:#0c2d4e; border-radius:6px; padding:8px 10px; font-size:11px; color:#8b949e; line-height:1.7; margin-bottom:12px; }
@media (display-mode: standalone) { .pwa-hide { display:none !important; } }
.mk-hw { font-size:15px; }
#btnHeritage.active { background:#0c2d1a; border-color:#3fb950; color:#3fb950; }
.ctrl-row { margin-bottom:10px; }
.ctrl-label { font-size:11px; color:#8b949e; margin-bottom:4px; }
.slider-row { display:flex; align-items:center; gap:8px; }
input[type=range] { flex:1; accent-color:#58a6ff; }
.sval { font-family:monospace; font-size:11px; color:#58a6ff; min-width:36px; }
.canvas-ctrl-btns { position:absolute; top:10px; right:10px; display:flex; flex-direction:row; gap:6px; z-index:5; }
.canvas-ctrl-btn { background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s,color .15s; text-align:left; }
.canvas-ctrl-btn:hover { background:rgba(13,17,23,1); border-color:#58a6ff; }
.canvas-ctrl-btn.active { background:#0c2d4e; border-color:#58a6ff; color:#58a6ff; }
#drawer-overlay { position:fixed; inset:0; z-index:68; background:rgba(0,0,0,.55); display:none; }
#drawer-overlay.open { display:block; }
#left-drawer { position:fixed; top:0; left:0; bottom:0; width:300px; max-width:90vw; z-index:69; background:#0d1117; border-right:2px solid #30363d; transform:translateX(-100%); transition:transform .3s ease; display:flex; flex-direction:column; }
#left-drawer.open { transform:translateX(0); }
.drw-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 14px 10px; border-bottom:1px solid #30363d; flex-shrink:0; background:#0d1117; }
.drw-title { font-size:13px; font-weight:700; color:#58a6ff; }
.drw-close { background:none; border:none; color:#8b949e; font-size:22px; line-height:1; cursor:pointer; padding:0 2px; }
#drw-body { overflow-y:auto; flex:1; }
.drw-row { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; border-bottom:1px solid #21262d; cursor:pointer; gap:8px; -webkit-tap-highlight-color:transparent; }
.drw-row:active { background:#21262d; }
.drw-left { display:flex; flex-direction:column; gap:2px; flex:1; min-width:0; }
.drw-flags { font-size:22px; letter-spacing:3px; }
.drw-venue { font-size:9px; color:#8b949e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.drw-meta { font-family:monospace; font-size:11px; color:#58a6ff; text-align:right; white-space:nowrap; flex-shrink:0; }
.drw-row.drw-past { opacity:0.38; }
.drw-row.drw-live { background:rgba(63,185,80,.08); border-left:3px solid #3fb950; }
#match-info { position:absolute; top:52px; left:50%; transform:translateX(-50%); z-index:6; background:rgba(13,17,23,0.93); border:1px solid #30363d; border-radius:12px; padding:14px 28px 12px; text-align:center; opacity:0; pointer-events:none; transition:opacity .2s; white-space:nowrap; box-shadow:0 4px 24px rgba(0,0,0,.7); }
#match-info.open { opacity:1; pointer-events:auto; }
.mi-flags { font-size:56px; letter-spacing:4px; line-height:1.1; display:flex; align-items:center; justify-content:center; gap:10px; }
.mi-vs { font-size:16px; color:#484f58; font-weight:700; }
.grp-section { margin-bottom:18px; }
.grp-section h2 { font-size:11px; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:.5px; margin-bottom:8px; }
.grp-row { display:flex; align-items:center; gap:4px; margin-bottom:4px; }
.grp-label { font-size:10px; font-weight:700; color:#58a6ff; background:rgba(88,166,255,0.1); border:1px solid rgba(88,166,255,0.2); border-radius:4px; padding:1px 4px; width:18px; text-align:center; flex-shrink:0; }
.grp-flags { display:flex; gap:1px; }
.grp-flag { display:inline-flex; width:30px; justify-content:center; align-items:center; border:2px solid #0d1117; border-radius:4px; padding:2px 0; line-height:1; font-size:16px; box-sizing:border-box; flex-shrink:0; cursor:pointer; }
.grp-flag-today { border-color:rgba(139,148,158,0.45); cursor:pointer; }
.grp-flag-today:hover { border-color:rgba(139,148,158,0.75); background:rgba(139,148,158,0.06); }
.grp-flag-active { border-color:rgba(255,200,0,0.9) !important; background:rgba(255,200,0,0.07); }
.grp-stadium-btn { background:none; border:none; cursor:pointer; font-size:16px; padding:0 2px 0 4px; line-height:1; opacity:0; pointer-events:none; transition:opacity .2s; flex-shrink:0; }
.grp-stadium-btn.active { opacity:0.85; pointer-events:auto; }
.grp-stadium-btn.active:hover { opacity:1; }
.drw-row.drw-highlight { background:rgba(255,240,60,0.12); border-left:3px solid rgba(255,240,60,0.7); }
.drw-section-body { display:none; }
.drw-section.open .drw-section-body { display:block; }
.drw-date { padding:8px 14px 4px; font-size:10px; font-weight:700; color:#8b949e; letter-spacing:1px; text-transform:uppercase; position:sticky; top:0; background:#0d1117; border-bottom:1px solid #21262d; cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none; -webkit-user-select:none; }
.drw-chevron { font-size:9px; opacity:0.5; transition:transform .2s; }
.drw-pin { font-size:11px; margin-right:4px; }
.drw-section.open .drw-chevron { transform:rotate(180deg); }
.cal-match { cursor:pointer; }
.cal-match:hover { filter:brightness(1.15); }
.cal-selected { outline:2px solid rgba(88,166,255,0.7); outline-offset:-1px; }
.cal-month-hdr { text-align:center; font-size:20px; padding:3px 0 4px; line-height:1; }
.cal-wrap { margin-bottom:14px; }
.cal-title { font-size:10px; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:.5px; margin-bottom:5px; }
.cal-legend { display:flex; flex-wrap:wrap; gap:3px; margin-bottom:5px; }
.cal-leg { font-size:8px; font-weight:700; padding:1px 4px; border-radius:3px; color:#e6edf3; }
.cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
.cal-cell { font-size:9px; text-align:center; padding:3px 0 2px; border-radius:3px; color:#484f58; line-height:1.3; }
.cal-hdr { font-weight:700; color:#30363d; font-size:8px; padding-bottom:3px; }
.cal-match { color:#e6edf3; }
.cal-today { outline:1.5px solid #58a6ff; outline-offset:-1px; }
.cal-rlabel { font-size:7px; font-weight:700; color:rgba(255,255,255,0.75); line-height:1; margin-top:1px; }
.drw-cal-wrap { padding:10px 14px 12px; border-bottom:1px solid #30363d; flex-shrink:0; }
.tnmt-grp-list { display:flex; flex-wrap:wrap; gap:6px; padding:10px 16px 12px; border-bottom:1px solid #30363d; }
.tnmt-grp-item { display:flex; align-items:center; gap:3px; }
.tnmt-grp-badge { font-size:9px; font-weight:700; color:#58a6ff; background:rgba(88,166,255,0.1); border:1px solid rgba(88,166,255,0.2); border-radius:3px; padding:1px 4px; flex-shrink:0; }
.tnmt-grp-flags { font-size:15px; letter-spacing:1px; }
@keyframes cal-blink { 0%,100%{box-shadow:none;background-color:transparent} 50%{box-shadow:0 0 0 2px rgba(255,200,0,0.9);background-color:rgba(255,200,0,0.28)} }
.cal-today-blink { animation:cal-blink 0.35s ease 7; }
.mi-time { font-size:13px; color:#58a6ff; font-family:monospace; margin-top:6px; }
.mi-date { font-size:11px; color:#8b949e; margin-top:3px; }
.mi-close { position:absolute; top:6px; right:10px; background:none; border:none; color:#8b949e; font-size:18px; line-height:1; cursor:pointer; padding:0; }
#drawer-open-btn { position:absolute; left:10px; top:10px; z-index:5; background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s; }
#drawer-open-btn:hover { background:rgba(13,17,23,1); border-color:#58a6ff; }
#tnmt-btn { position:absolute; left:10px; top:50px; z-index:5; background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s; }
#tnmt-btn:hover { background:rgba(13,17,23,1); border-color:#f0b429; color:#f0b429; }
#tnmt-overlay { position:fixed; inset:0; z-index:300; background:rgba(0,0,0,0.88); display:none; overflow-y:auto; }
#tnmt-overlay.open { display:block; }
.tnmt-modal { background:#0d1117; border:1px solid #30363d; border-radius:12px; margin:20px auto; max-width:980px; overflow:hidden; }
.tnmt-hdr { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid #30363d; position:sticky; top:0; background:#0d1117; z-index:1; }
.tnmt-title { font-size:14px; font-weight:700; color:#f0b429; }
.tnmt-close { background:none; border:none; color:#8b949e; font-size:22px; line-height:1; cursor:pointer; padding:0 4px; }
.tnmt-close:hover { color:#e6edf3; }
.tnmt-body { padding:16px; overflow-x:auto; }
.tnmt-bracket { display:flex; gap:10px; min-width:820px; align-items:flex-start; }
.tnmt-col { display:flex; flex-direction:column; flex:1; min-width:0; }
.tnmt-col-hdr { font-size:10px; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:.5px; text-align:center; padding:5px 4px 8px; border-bottom:1px solid #21262d; margin-bottom:8px; white-space:nowrap; }
.tnmt-col-final .tnmt-col-hdr { color:#f0b429; }
.tnmt-spacer { flex:1; }
.tnmt-match { background:#161b22; border:1px solid #30363d; border-radius:6px; padding:6px 8px; margin-bottom:6px; }
.tnmt-match-date { font-size:9px; color:#e6edf3; font-family:monospace; margin-bottom:4px; text-align:right; }
.tnmt-team { display:flex; align-items:center; gap:5px; padding:3px 2px; border-radius:3px; }
.tnmt-team + .tnmt-team { border-top:1px solid #21262d; margin-top:2px; padding-top:5px; }
.tnmt-team-flag { font-size:18px; line-height:1; }
.tnmt-team-code { font-size:10px; font-weight:700; color:#8b949e; font-family:'SFMono-Regular',Consolas,monospace; }
.tnmt-team-tbd { font-size:11px; color:#e6edf3; font-style:italic; }
.tnmt-winner { color:#f0b429; }
.tnmt-winner .tnmt-team-code { color:#f0b429; }
.tnmt-3rd { margin-top:16px; border-top:1px solid #30363d; padding-top:14px; }
.tnmt-3rd-label { font-size:11px; font-weight:700; color:#8b949e; text-align:center; margin-bottom:8px; }
#stadium-panel { position:fixed; top:0; right:0; bottom:0; width:280px; max-width:92vw; z-index:70; background:#0d1117; border-left:2px solid #f0b429; display:flex; flex-direction:column; transform:translateX(100%); transition:transform .3s ease; box-shadow:-4px 0 30px rgba(0,0,0,.8); }
#stadium-panel.open { transform:translateX(0); }
.sdp-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 14px 10px; border-bottom:1px solid #30363d; flex-shrink:0; background:#0d1117; }
.sdp-title { font-size:13px; font-weight:700; color:#f0b429; }
.sdp-close { background:none; border:none; color:#8b949e; font-size:22px; line-height:1; cursor:pointer; padding:0 2px; }
.sdp-mode-btn { background:none; border:none; cursor:pointer; font-size:18px; padding:0 4px; line-height:1; opacity:0.8; transition:opacity .15s; }
.sdp-mode-btn:hover { opacity:1; }
.grp-match-info { font-size:12px; color:#e6edf3; line-height:1; margin-left:2px; white-space:nowrap; flex-shrink:0; }
#mk-tooltip { position:fixed; }
#mk-tooltip .tt-close { position:absolute; top:4px; right:6px; background:none; border:none; color:#8b949e; font-size:16px; cursor:pointer; padding:0; line-height:1; z-index:1; }
#mk-tooltip .tt-close:hover { color:#e6edf3; }
.sdp-tour-btn { width:calc(100% - 28px); margin:10px 14px 8px; background:#0c2d4e; border:1px solid #58a6ff; border-radius:6px; color:#58a6ff; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:7px 12px; cursor:pointer; font-weight:600; transition:background .15s; }
.sdp-tour-btn:hover { background:#1a3d5e; }
.sdp-tour-btn.touring { background:#0c2d1a; border-color:#3fb950; color:#3fb950; }
#sdp-body { overflow-y:auto; flex:1; }
.sdp-row { display:flex; align-items:center; gap:8px; padding:9px 14px; border-bottom:1px solid #21262d; cursor:pointer; -webkit-tap-highlight-color:transparent; transition:background .1s; }
.sdp-row:hover { background:#161b22; }
.sdp-row.sdp-active { background:rgba(240,180,41,0.12); border-left:3px solid #f0b429; padding-left:11px; }
.sdp-num { font-size:10px; font-weight:700; color:#484f58; font-family:monospace; min-width:18px; }
.sdp-icon { font-size:20px; line-height:1; }
.sdp-info { flex:1; min-width:0; }
.sdp-name { font-size:12px; font-weight:600; color:#e6edf3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sdp-city { font-size:10px; color:#8b949e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sdp-coord { font-family:monospace; font-size:9px; color:#484f58; }
#btnStadiumTour { position:absolute; right:10px; top:50px; z-index:5; background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s,color .15s; }
#btnStadiumTour:hover { background:rgba(13,17,23,1); border-color:#f0b429; color:#f0b429; }
#btnStadiumTour.active { background:#1a1200; border-color:#f0b429; color:#f0b429; }
#btnSearch { position:absolute; right:10px; top:90px; z-index:5; background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s,color .15s; }
#btnSearch:hover { background:rgba(13,17,23,1); border-color:#58a6ff; color:#58a6ff; }
#btnSearch.active { background:#0c2d4e; border-color:#58a6ff; color:#58a6ff; }
#btnNight { position:absolute; right:10px; top:130px; z-index:5; background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s,color .15s; }
#btnNight:hover { background:rgba(13,17,23,1); border-color:#f0d070; color:#f0d070; }
#btnNight.active { background:#1a1800; border-color:#f0d070; color:#f0d070; }
#search-overlay { position:absolute; top:0; left:0; right:0; bottom:0; z-index:20; display:none; }
#search-overlay.open { display:block; }
.srch-wrap { position:absolute; top:10px; left:50%; transform:translateX(-50%); width:300px; max-width:80vw; }
#search-input { width:100%; background:rgba(13,17,23,0.97); border:1.5px solid #58a6ff; border-radius:8px; color:#e6edf3; font-size:13px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:8px 14px; outline:none; box-shadow:0 4px 20px rgba(0,0,0,.7); }
#search-results { background:rgba(13,17,23,0.97); border:1px solid #30363d; border-radius:0 0 8px 8px; max-height:280px; overflow-y:auto; margin-top:-2px; }
.srch-item { padding:9px 14px; cursor:pointer; font-size:12px; border-bottom:1px solid #21262d; display:flex; align-items:center; gap:6px; }
.srch-item:last-child { border-bottom:none; }
.srch-item:hover { background:#21262d; }
.srch-item-type { font-size:9px; font-weight:700; color:#8b949e; letter-spacing:1px; text-transform:uppercase; }
.cost-section { margin-top:4px; }
.cost-section h2 { font-size:11px; font-weight:700; color:#f0b429; text-transform:uppercase; letter-spacing:.5px; margin-bottom:8px; }
.cost-subtitle { font-size:10px; color:#8b949e; margin-bottom:10px; line-height:1.5; }
.cost-row { display:flex; align-items:center; gap:7px; padding:7px 0; border-bottom:1px solid #21262d; }
.cost-row:last-child { border-bottom:none; }
.cost-rank { font-size:13px; font-weight:700; color:#f0b429; font-family:monospace; min-width:20px; text-align:right; flex-shrink:0; }
.cost-icon { font-size:16px; flex-shrink:0; }
.cost-info { flex:1; min-width:0; }
.cost-name { font-size:11px; font-weight:600; color:#e6edf3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cost-meta { font-size:10px; color:#8b949e; margin-top:1px; }
.cost-val { font-size:11px; font-weight:700; color:#3fb950; white-space:nowrap; flex-shrink:0; text-align:right; }
.cost-bar-wrap { height:3px; background:#21262d; border-radius:2px; margin-top:3px; }
.cost-bar { height:3px; border-radius:2px; background:linear-gradient(90deg,#f0b429,#3fb950); }
.cost-tour-btn { width:100%; margin-bottom:10px; background:#0c1a0c; border:1px solid #3fb950; border-radius:6px; color:#3fb950; font-size:11px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 10px; cursor:pointer; font-weight:600; transition:background .15s,border-color .15s,color .15s; }
.cost-tour-btn:hover { background:#132813; }
.cost-tour-btn.touring { background:#0c2d1a; border-color:#f0b429; color:#f0b429; }
.cost-row.cost-active { background:rgba(240,180,41,0.12); border-left:3px solid #f0b429; padding-left:5px; }
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
uniform float uNight;
varying vec2 vUV;
varying float vDiff;
varying float vSpec;
varying float vRim;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  vec4 earth = texture2D(uTex, vUV);
  float isOcean = clamp((earth.b - earth.r * 0.8 - earth.g * 0.3) * 3.0, 0.0, 1.0);
  vec3 oceanColor = vec3(0.05, 0.18, 0.52);
  vec3 baseColor = mix(earth.rgb, oceanColor, isOcean);
  float night = clamp(1.0 - vDiff * 8.0, 0.0, 1.0) * uNight;
  float amb = mix(0.25, 0.03, night);
  vec3 col = baseColor * (amb + vDiff * (1.0 - amb));
  col += vec3(0.5, 0.8, 1.0) * vSpec * isOcean * 0.7;
  col += vec3(0.25, 0.55, 1.0) * vRim * 0.5;
  col += vec3(0.1,  0.3,  0.9) * vRim * vRim * 0.25;
  float isLand = 1.0 - isOcean;
  vec2 c1 = floor(vUV * 192.0);
  float city1 = step(0.955, hash(c1)) * isLand;
  vec2 c2 = floor(vUV * 512.0);
  float city2 = step(0.982, hash(c2 + vec2(17.0, 31.0))) * isLand;
  col += vec3(1.0, 0.75, 0.35) * (city1 * 0.7 + city2 * 0.3) * night;
  gl_FragColor = vec4(col, 1.0);
}
</script>

<div class="topbar">
  <h1>WebGL 地球儀</h1>
  <span class="badge">WebGL</span>
  <span style="flex:1"></span>
  <a href="/webgl-heritage">🏛️ 世界遺産</a>
  <a href="/mlb">⚾ MLB</a>
  <a href="/webgl-demo" class="pwa-hide">3D Cube</a>
  <a href="/htmlrewriter-demo" class="pwa-hide">HTMLRewriter</a>
  <a href="/settings" class="pwa-hide">&#9881;</a>
  <span class="pwa-hide" style="color:#8b949e;font-size:11px">${safeUser}</span>
</div>

<div class="body">
  <div class="canvas-wrap">
    <canvas id="c"></canvas>
    <div id="markers"></div>
    <div class="hud" id="hud">テクスチャ読み込み中...</div>
    <div class="canvas-ctrl-btns">
      <button class="canvas-ctrl-btn" id="btnAxisLock" title="地軸を画面に対して垂直に固定するモード">＋ 軸垂直固定</button>
      <button class="canvas-ctrl-btn" id="btnAutoRot" title="自転の停止/再開">⏸ 自転停止</button>
    </div>
    <button id="drawer-open-btn" title="試合一覧を開く">&#9776; 試合一覧</button>
    <button id="tnmt-btn" title="トーナメント表を開く">&#127942; トーナメント</button>
    <button id="btnStadiumTour" title="全16会場を巡回">&#127967; 会場巡回</button>
    <button id="btnSearch" title="国名・会場名で検索">&#128269; 検索</button>
    <button id="btnNight" title="夜景モードの切替">&#127769; 夜景</button>
    <div id="search-overlay">
      <div class="srch-wrap">
        <input type="text" id="search-input" placeholder="国名・会場名で検索..." autocomplete="off">
        <div id="search-results"></div>
      </div>
    </div>
    <div id="match-info">
      <button class="mi-close" id="miClose">&#10005;</button>
      <div class="mi-flags" id="mi-flags"></div>
      <div class="mi-time"  id="mi-time"></div>
      <div class="mi-date"  id="mi-date"></div>
    </div>
  </div>
  <div class="side">
    <div id="cal-section"></div>

    <div class="grp-section">
    <h2>グループ一覧</h2>
    <div id="grp-body"></div>
  </div>
  <h2>コントロール</h2>
    <div class="ctrl-row">
      <div class="ctrl-label">自転速度</div>
      <div class="slider-row">
        <input type="range" id="rotSpd" min="0" max="5" step="0.1" value="1">
        <span class="sval" id="rotSpdVal">1.0</span>
      </div>
    </div>

    <hr>
    <h2>実装ポイント</h2>

    <div class="item">
      <div class="item-title">テクスチャ（NASA Blue Marble）</div>
      <div class="item-desc">NASA が公開する Blue Marble 2048×1024 の正距円筒図法画像を Workers Static Assets で配信。<code>/earth.jpg</code> として同一オリジンから取得するため CORS 不要。</div>
    </div>
    <div class="item">
      <div class="item-title">海洋スペキュラー</div>
      <div class="item-desc">フラグメントシェーダーでテクスチャの B-R 差分から海陸を推定し、海面にのみブリン・フォン鏡面反射を適用。</div>
    </div>
    <div class="item">
      <div class="item-title">大気散乱グロー</div>
      <div class="item-desc">法線と視線内積の 3 乗から縁付近を検出。青を 2 段で加算し地球縁の大気発光を表現。</div>
    </div>
    <div class="item">
      <div class="item-title">Workers Static Assets</div>
      <div class="item-desc"><code>wrangler.toml</code> に <code>assets = &#123; directory = "./public" &#125;</code> を追記。<code>public/</code> 内のファイルが Worker を経由せず Cloudflare CDN から直配信される。</div>
    </div>

    <hr>
    <div class="cost-section">
      <h2>&#127942; FIFA W杯 建設費ランキング</h2>
      <div class="cost-subtitle">建設コスト上位10スタジアム</div>
      <button class="cost-tour-btn" id="costTourBtn">&#127968; 建設費順に自動巡回</button>

      <div class="cost-row" data-cidx="0">
        <span class="cost-rank">1</span>
        <span class="cost-icon">&#127967;</span>
        <div class="cost-info">
          <div class="cost-name">SoFi Stadium</div>
          <div class="cost-meta">&#127482;&#127480; USA &middot; W杯2026</div>
          <div class="cost-bar-wrap"><div class="cost-bar" style="width:100%"></div></div>
        </div>
        <div class="cost-val">$5.1B</div>
      </div>

      <div class="cost-row" data-cidx="1">
        <span class="cost-rank">2</span>
        <span class="cost-icon">&#127967;</span>
        <div class="cost-info">
          <div class="cost-name">MetLife Stadium</div>
          <div class="cost-meta">&#127482;&#127480; USA &middot; 2026決勝</div>
          <div class="cost-bar-wrap"><div class="cost-bar" style="width:29%"></div></div>
        </div>
        <div class="cost-val">$1.5B</div>
      </div>

      <div class="cost-row" data-cidx="2">
        <span class="cost-rank">3</span>
        <span class="cost-icon">&#127967;</span>
        <div class="cost-info">
          <div class="cost-name">Mercedes-Benz Stadium</div>
          <div class="cost-meta">&#127482;&#127480; USA &middot; W杯2026</div>
          <div class="cost-bar-wrap"><div class="cost-bar" style="width:29%"></div></div>
        </div>
        <div class="cost-val">$1.5B</div>
      </div>

      <div class="cost-row" data-cidx="3">
        <span class="cost-rank">4</span>
        <span class="cost-icon">&#127967;</span>
        <div class="cost-info">
          <div class="cost-name">Saint Petersburg Stadium</div>
          <div class="cost-meta">&#127479;&#127482; Russia &middot; W杯2018</div>
          <div class="cost-bar-wrap"><div class="cost-bar" style="width:25%"></div></div>
        </div>
        <div class="cost-val">$1.3B</div>
      </div>

      <div class="cost-row" data-cidx="4">
        <span class="cost-rank">5</span>
        <span class="cost-icon">&#127967;</span>
        <div class="cost-info">
          <div class="cost-name">AT&amp;T Stadium</div>
          <div class="cost-meta">&#127482;&#127480; USA &middot; W杯2026</div>
          <div class="cost-bar-wrap"><div class="cost-bar" style="width:24%"></div></div>
        </div>
        <div class="cost-val">$1.2B</div>
      </div>

      <div class="cost-row" data-cidx="5">
        <span class="cost-rank">6</span>
        <span class="cost-icon">&#127967;</span>
        <div class="cost-info">
          <div class="cost-name">Levi&#39;s Stadium</div>
          <div class="cost-meta">&#127482;&#127480; USA &middot; W杯2026</div>
          <div class="cost-bar-wrap"><div class="cost-bar" style="width:24%"></div></div>
        </div>
        <div class="cost-val">$1.2B</div>
      </div>

      <div class="cost-row" data-cidx="6">
        <span class="cost-rank">7</span>
        <span class="cost-icon">&#127967;</span>
        <div class="cost-info">
          <div class="cost-name">Al Bayt Stadium</div>
          <div class="cost-meta">&#127478;&#127462; Qatar &middot; W杯2022</div>
          <div class="cost-bar-wrap"><div class="cost-bar" style="width:15%"></div></div>
        </div>
        <div class="cost-val">$780M</div>
      </div>

      <div class="cost-row" data-cidx="7">
        <span class="cost-rank">8</span>
        <span class="cost-icon">&#127967;</span>
        <div class="cost-info">
          <div class="cost-name">Man&#233; Garrincha Stadium</div>
          <div class="cost-meta">&#127463;&#127479; Brazil &middot; W杯2014</div>
          <div class="cost-bar-wrap"><div class="cost-bar" style="width:15%"></div></div>
        </div>
        <div class="cost-val">$760M</div>
      </div>

      <div class="cost-row" data-cidx="8">
        <span class="cost-rank">9</span>
        <span class="cost-icon">&#127967;</span>
        <div class="cost-info">
          <div class="cost-name">Lusail Stadium</div>
          <div class="cost-meta">&#127478;&#127462; Qatar &middot; W杯2022</div>
          <div class="cost-bar-wrap"><div class="cost-bar" style="width:14%"></div></div>
        </div>
        <div class="cost-val">$710M</div>
      </div>

      <div class="cost-row" data-cidx="9">
        <span class="cost-rank">10</span>
        <span class="cost-icon">&#127967;</span>
        <div class="cost-info">
          <div class="cost-name">Cape Town Stadium</div>
          <div class="cost-meta">&#127487;&#127462; South Africa &middot; W杯2010</div>
          <div class="cost-bar-wrap"><div class="cost-bar" style="width:11%"></div></div>
        </div>
        <div class="cost-val">$540M</div>
      </div>
    </div>
  </div>
</div>

<div id="tnmt-overlay">
  <div class="tnmt-modal">
    <div class="tnmt-hdr">
      <span class="tnmt-title">&#127942; 2026 FIFA ワールドカップ トーナメント</span>
      <button class="tnmt-close" id="tnmtClose">&#10005;</button>
    </div>
    <div class="tnmt-body" id="tnmt-body"></div>
  </div>
</div>
<div id="mk-tooltip"></div>
<div id="drawer-overlay"></div>
<div id="left-drawer">
  <div class="drw-hdr">
    <span class="drw-title">&#9917; 2026 FIFA W杯 全104試合(72+32)</span>
    <button class="drw-close" id="drwClose">&#10005;</button>
  </div>
  <div id="drw-cal"></div>
  <div id="drw-body"></div>
</div>
<div id="stadium-panel">
  <div class="sdp-hdr">
    <span class="sdp-title">&#127967; 2026 W杯 全16会場</span>
    <button class="sdp-mode-btn" id="sdpModeBtn" title="全会場表示の切替">&#128193;</button>
    <button class="sdp-mode-btn" id="sdpDateFilterBtn" title="日付フィルター">&#128467;</button>
    <button class="sdp-close" id="sdpClose">&#10005;</button>
  </div>
  <button class="sdp-tour-btn" id="sdpTourBtn">東から順に自動巡回</button>
  <div id="sdp-body"></div>
</div>
<div id="schedule-panel">
  <div class="sp-hdr">
    <span class="sp-title">&#9917; 2026 FIFA W杯 試合スケジュール</span>
    <button class="sp-close" id="spClose">&#10005;</button>
  </div>
  <div id="sp-body"></div>
</div>

<script>
function getNextZ() {
  var max = 100;
  var els = document.querySelectorAll('*');
  for (var i = 0; i < els.length; i++) {
    var z = parseInt(window.getComputedStyle(els[i]).zIndex, 10);
    if (!isNaN(z) && z > max) max = z;
  }
  return max + 100;
}
</script>
<script>
(function() {
  var canvas = document.getElementById("c");
  var wrap   = canvas.parentElement;
  var hud    = document.getElementById("hud");
  var markersDiv = document.getElementById("markers");

  function resize() {
    var r = wrap.getBoundingClientRect();
    var w = Math.round(r.width);
    var h = Math.round(r.height);
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width  = w;
      canvas.height = h;
    }
  }
  resize();
  window.addEventListener("resize", resize);

  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) { hud.textContent = "WebGL が利用できません"; return; }

  function compileShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER,   document.getElementById("vs").textContent));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, document.getElementById("fs").textContent));
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
  var aPos  = gl.getAttribLocation(prog, "aPos");
  var aNorm = gl.getAttribLocation(prog, "aNorm");
  var aUV   = gl.getAttribLocation(prog, "aUV");
  gl.enableVertexAttribArray(aPos);  gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(aUV);   gl.vertexAttribPointer(aUV,   2, gl.FLOAT, false, stride, 24);

  var uMVP    = gl.getUniformLocation(prog, "uMVP");
  var uModel  = gl.getUniformLocation(prog, "uModel");
  var uLight  = gl.getUniformLocation(prog, "uLight");
  var uTex    = gl.getUniformLocation(prog, "uTex");
  var uNightL = gl.getUniformLocation(prog, "uNight");
  gl.uniform1i(uTex, 0);
  gl.uniform1f(uNightL, 0.0);

  function getSunDir() {
    var now = new Date();
    var utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    var sunLon = (utcH - 12) / 24 * 2 * Math.PI;
    var start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    var doy = Math.floor((now.getTime() - start.getTime()) / 86400000);
    var sunLat = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (doy - 80) / 365);
    return [
      Math.cos(sunLat) * Math.cos(sunLon),
      Math.sin(sunLat),
      Math.cos(sunLat) * Math.sin(sunLon)
    ];
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
  earthImg.onerror = function() {
    hud.textContent = "テクスチャ読み込み失敗 — /earth.jpg が見つかりません";
  };
  earthImg.src = "/earth.jpg";

  function m4()      { return new Float32Array(16); }
  function ident(m)  { for(var i=0;i<16;i++) m[i]=0; m[0]=m[5]=m[10]=m[15]=1; return m; }
  function mul(o,a,b){
    for(var i=0;i<4;i++) for(var j=0;j<4;j++){
      var s=0; for(var k=0;k<4;k++) s+=a[i+k*4]*b[k+j*4]; o[i+j*4]=s;
    } return o;
  }
  function persp(m,fov,asp,near,far){
    ident(m); var f=1/Math.tan(fov/2);
    m[0]=f/asp; m[5]=f; m[10]=(far+near)/(near-far); m[11]=-1;
    m[14]=2*far*near/(near-far); m[15]=0; return m;
  }
  function rotX(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[5]=c;m[6]=s;m[9]=-s;m[10]=c; return m; }
  function rotY(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[2]=-s;m[8]=s;m[10]=c; return m; }
  function rotZ(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[1]=s;m[4]=-s;m[5]=c; return m; }
  function trans(m,x,y,z){ ident(m); m[12]=x;m[13]=y;m[14]=z; return m; }

  var axialTilt = -23.4 * Math.PI / 180;
  var ELEV_MAX = Math.PI / 2 - 0.02;
  function clampElev(v){ return v < -ELEV_MAX ? -ELEV_MAX : (v > ELEV_MAX ? ELEV_MAX : v); }

  var proj=m4(),view=m4(),model=m4(),rx=m4(),ry=m4(),tz=m4(),tmp=m4(),tmp2=m4(),mvp=m4();
  var rotXv = 0.3, rotYv = 0.6, zoom = 3.2, zoomTarget = 3.2, autoRot = true;
  var drag = false, lx = 0, ly = 0, pinch0 = 0, touchMoved = false;

  var axisLocked = false;

  var btnAxisLock = document.getElementById("btnAxisLock");
  var btnAutoRot  = document.getElementById("btnAutoRot");

  btnAxisLock.addEventListener("click", function() {
    axisLocked = !axisLocked;
    if (axisLocked) {
      rotXv = 0;
      btnAxisLock.classList.add("active");
      btnAxisLock.textContent = "＋ 軸固定中";
    } else {
      btnAxisLock.classList.remove("active");
      btnAxisLock.textContent = "＋ 軸垂直固定";
    }
  });

  btnAutoRot.addEventListener("click", function() {
    autoRot = !autoRot;
    btnAutoRot.textContent = autoRot ? "⏸ 自転停止" : "▶ 回転";
    if (autoRot) { btnAutoRot.classList.remove("active"); } else { btnAutoRot.classList.add("active"); }
  });


  var rotSpdEl    = document.getElementById("rotSpd");
  var rotSpdValEl = document.getElementById("rotSpdVal");
  rotSpdEl.addEventListener("input", function(){ rotSpdValEl.textContent = parseFloat(rotSpdEl.value).toFixed(1); });

  var velY = 0, velX = 0, momentumY = 0, momentumX = 0;
  var MOMENTUM_DECAY = 0.92;

  canvas.addEventListener("mousedown",  function(e){ drag=true; lx=e.clientX; ly=e.clientY; momentumY=0; momentumX=0; velY=0; velX=0; });
  function applySpinBoost(v) {
    var spd = parseFloat(rotSpdEl.value);
    var factor = Math.random() * spd;
    return v * (1 + factor);
  }
  window.addEventListener("mouseup",    function(){ if(!drag)return; drag=false; momentumY=applySpinBoost(velY); momentumX=applySpinBoost(velX); velY=0; velX=0; });
  window.addEventListener("mousemove",  function(e){ if(!drag)return; var dy=(e.clientX-lx)*0.008; var dx=(e.clientY-ly)*0.008; rotYv+=dy; velY=velY*0.4+dy*0.6; if(!axisLocked){ rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6; } lx=e.clientX; ly=e.clientY; });
  canvas.addEventListener("wheel",      function(e){ e.preventDefault(); var delta = e.deltaMode === 1 ? e.deltaY * 18 : (e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY); zoomTarget=Math.max(1.6,Math.min(10,zoomTarget+delta*0.004)); },{passive:false});
  canvas.addEventListener("dblclick",   function(){ autoRot=!autoRot; btnAutoRot.textContent = autoRot ? "⏸ 自転停止" : "▶ 回転"; if(autoRot){btnAutoRot.classList.remove("active");}else{btnAutoRot.classList.add("active");} });
  canvas.addEventListener("touchstart", function(e){ e.preventDefault(); touchMoved=false; momentumY=0; momentumX=0; velY=0; velX=0; if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){pinch0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);} },{passive:false});
  canvas.addEventListener("touchmove",  function(e){ e.preventDefault(); touchMoved=true; if(e.touches.length===1&&drag){ var dy=(e.touches[0].clientX-lx)*0.008; var dx=(e.touches[0].clientY-ly)*0.008; rotYv+=dy; velY=velY*0.4+dy*0.6; if(!axisLocked){rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6;} lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);zoomTarget=Math.max(1.6,Math.min(10,zoomTarget-(d-pinch0)*0.015));pinch0=d;} },{passive:false});
  canvas.addEventListener("touchend", function(e){
    drag=false;
    momentumY=applySpinBoost(velY); momentumX=applySpinBoost(velX); velY=0; velX=0;
    if (!touchMoved && e.changedTouches.length === 1) {
      momentumY=0; momentumX=0;
      hideTooltip();
      schedulePanel.classList.remove("open");
      var ball = wc2026[0];
      activeMarkerIdx = 0;
      flyTo(ball.lat, ball.lon);
    }
  });

  // 2026 FIFA W杯 全16会場（東→西順）
  var wc2026Stadiums = [
    {num:1,  flag:"🏟️", ctry:"🇺🇸", name:"Gillette Stadium",              city:"フォックスボロ、MA",   lat:42.091, lon:-71.264},
    {num:2,  flag:"🏟️", ctry:"🇺🇸", name:"MetLife Stadium",               city:"イーストラザフォード、NJ", lat:40.814, lon:-74.074},
    {num:3,  flag:"🏟️", ctry:"🇺🇸", name:"Lincoln Financial Field",       city:"フィラデルフィア、PA", lat:39.901, lon:-75.168},
    {num:4,  flag:"🏟️", ctry:"🇨🇦", name:"BMO Field",                    city:"トロント、カナダ",     lat:43.633, lon:-79.419},
    {num:5,  flag:"🏟️", ctry:"🇺🇸", name:"Hard Rock Stadium",             city:"マイアミガーデンズ、FL",lat:25.958, lon:-80.239},
    {num:6,  flag:"🏟️", ctry:"🇺🇸", name:"Bank of America Stadium",       city:"シャーロット、NC",    lat:35.226, lon:-80.853},
    {num:7,  flag:"🏟️", ctry:"🇺🇸", name:"Arrowhead Stadium",             city:"カンザスシティ、MO",  lat:39.049, lon:-94.484},
    {num:8,  flag:"🏟️", ctry:"🇺🇸", name:"NRG Stadium",                  city:"ヒューストン、TX",    lat:29.685, lon:-95.411},
    {num:9,  flag:"🏟️", ctry:"🇺🇸", name:"AT&T Stadium",                 city:"アーリントン、TX",    lat:32.748, lon:-97.093},
    {num:10, flag:"🏟️", ctry:"🇲🇽", name:"Estadio Azteca",               city:"メキシコシティ、MX",  lat:19.303, lon:-99.150},
    {num:11, flag:"🏟️", ctry:"🇲🇽", name:"Estadio BBVA",                 city:"モンテレイ、MX",      lat:25.669, lon:-100.244},
    {num:12, flag:"🏟️", ctry:"🇲🇽", name:"Estadio Akron",                city:"グアダラハラ、MX",    lat:20.669, lon:-103.318},
    {num:13, flag:"🏟️", ctry:"🇺🇸", name:"SoFi Stadium",                 city:"イングルウッド、CA",  lat:33.954, lon:-118.339},
    {num:14, flag:"🏟️", ctry:"🇺🇸", name:"Levi's Stadium",               city:"サンタクララ、CA",    lat:37.403, lon:-121.970},
    {num:15, flag:"🏟️", ctry:"🇺🇸", name:"Lumen Field",                  city:"シアトル、WA",        lat:47.595, lon:-122.332},
    {num:16, flag:"🏟️", ctry:"🇨🇦", name:"BC Place",                     city:"バンクーバー、カナダ",  lat:49.277, lon:-123.112}
  ];

  // 2026 FIFAワールドカップ出場国（⚽=開催地マーカー）
  var wc2026 = [
    {flag:"⚽", name:"2026 FIFA W杯 開催地", lat:34, lon:-99, ball:true},
    {flag:"🇲🇽", name:"メキシコ", lat:23, lon:-102},
    {flag:"🇿🇦", name:"南アフリカ", lat:-29, lon:25},
    {flag:"🇰🇷", name:"韓国", lat:36, lon:128},
    {flag:"🇨🇿", name:"チェコ", lat:50, lon:15},
    {flag:"🇨🇦", name:"カナダ", lat:56, lon:-96},
    {flag:"🇧🇦", name:"ボスニア・ヘルツェゴビナ", lat:44, lon:17},
    {flag:"🇶🇦", name:"カタール", lat:25, lon:51},
    {flag:"🇨🇭", name:"スイス", lat:47, lon:8},
    {flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", name:"スコットランド", lat:57, lon:-4},
    {flag:"🇧🇷", name:"ブラジル", lat:-10, lon:-53},
    {flag:"🇲🇦", name:"モロッコ", lat:32, lon:-6},
    {flag:"🇭🇹", name:"ハイチ", lat:19, lon:-73},
    {flag:"🇺🇸", name:"アメリカ合衆国", lat:39, lon:-95},
    {flag:"🇦🇺", name:"オーストラリア", lat:-27, lon:133},
    {flag:"🇹🇷", name:"トルコ", lat:39, lon:35},
    {flag:"🇵🇾", name:"パラグアイ", lat:-23, lon:-58},
    {flag:"🇩🇪", name:"ドイツ", lat:51, lon:10},
    {flag:"🇨🇮", name:"コートジボワール", lat:7, lon:-5},
    {flag:"🇪🇨", name:"エクアドル", lat:-2, lon:-78},
    {flag:"🇨🇼", name:"キュラソー", lat:12, lon:-69},
    {flag:"🇸🇪", name:"スウェーデン", lat:60, lon:18},
    {flag:"🇯🇵", name:"日本", lat:36, lon:138},
    {flag:"🇳🇱", name:"オランダ", lat:52, lon:5},
    {flag:"🇹🇳", name:"チュニジア", lat:34, lon:9},
    {flag:"🇮🇷", name:"イラン", lat:32, lon:53},
    {flag:"🇳🇿", name:"ニュージーランド", lat:-41, lon:174},
    {flag:"🇧🇪", name:"ベルギー", lat:50, lon:4},
    {flag:"🇪🇬", name:"エジプト", lat:26, lon:30},
    {flag:"🇸🇦", name:"サウジアラビア", lat:24, lon:45},
    {flag:"🇺🇾", name:"ウルグアイ", lat:-33, lon:-56},
    {flag:"🇨🇻", name:"カーボベルデ", lat:16, lon:-24},
    {flag:"🇪🇸", name:"スペイン", lat:40, lon:-4},
    {flag:"🇫🇷", name:"フランス", lat:46, lon:2},
    {flag:"🇮🇶", name:"イラク", lat:33, lon:44},
    {flag:"🇳🇴", name:"ノルウェー", lat:61, lon:8},
    {flag:"🇸🇳", name:"セネガル", lat:14, lon:-14},
    {flag:"🇩🇿", name:"アルジェリア", lat:28, lon:3},
    {flag:"🇦🇷", name:"アルゼンチン", lat:-34, lon:-64},
    {flag:"🇦🇹", name:"オーストリア", lat:47, lon:14},
    {flag:"🇯🇴", name:"ヨルダン", lat:31, lon:36},
    {flag:"🇨🇴", name:"コロンビア", lat:4, lon:-72},
    {flag:"🇨🇩", name:"コンゴ民主共和国", lat:-4, lon:24},
    {flag:"🇵🇹", name:"ポルトガル", lat:39, lon:-8},
    {flag:"🇺🇿", name:"ウズベキスタン", lat:41, lon:64},
    {flag:"🇭🇷", name:"クロアチア", lat:45, lon:16},
    {flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", name:"イングランド", lat:52, lon:-1},
    {flag:"🇬🇭", name:"ガーナ", lat:8, lon:-1},
    {flag:"🇵🇦", name:"パナマ", lat:9, lon:-80}
  ];

  function latLonTo3D(lat, lon) {
    var latR = lat * Math.PI / 180;
    var lonR = lon * Math.PI / 180;
    return [
      Math.cos(latR) * Math.cos(lonR),
      Math.sin(latR),
      -Math.cos(latR) * Math.sin(lonR)
    ];
  }

  var MATCHES = [
    {a:"🇲🇽",b:"🇿🇦",date:"2026-06-11",time:"19:00"},
    {a:"🇰🇷",b:"🇨🇿",date:"2026-06-12",time:"02:00"},
    {a:"🇨🇦",b:"🇧🇦",date:"2026-06-12",time:"19:00"},
    {a:"🇺🇸",b:"🇵🇾",date:"2026-06-13",time:"01:00"},
    {a:"🇶🇦",b:"🇨🇭",date:"2026-06-13",time:"19:00"},
    {a:"🇧🇷",b:"🇲🇦",date:"2026-06-13",time:"22:00"},
    {a:"🇭🇹",b:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",date:"2026-06-14",time:"01:00"},
    {a:"🇦🇺",b:"🇹🇷",date:"2026-06-14",time:"04:00"},
    {a:"🇩🇪",b:"🇨🇼",date:"2026-06-14",time:"17:00"},
    {a:"🇳🇱",b:"🇯🇵",date:"2026-06-14",time:"20:00"},
    {a:"🇨🇮",b:"🇪🇨",date:"2026-06-14",time:"23:00"},
    {a:"🇸🇪",b:"🇹🇳",date:"2026-06-15",time:"02:00"},
    {a:"🇪🇸",b:"🇨🇻",date:"2026-06-15",time:"16:00"},
    {a:"🇧🇪",b:"🇪🇬",date:"2026-06-15",time:"19:00"},
    {a:"🇸🇦",b:"🇺🇾",date:"2026-06-15",time:"22:00"},
    {a:"🇮🇷",b:"🇳🇿",date:"2026-06-16",time:"01:00"},
    {a:"🇫🇷",b:"🇸🇳",date:"2026-06-16",time:"19:00"},
    {a:"🇮🇶",b:"🇳🇴",date:"2026-06-16",time:"22:00"},
    {a:"🇦🇷",b:"🇩🇿",date:"2026-06-17",time:"01:00"},
    {a:"🇦🇹",b:"🇯🇴",date:"2026-06-17",time:"04:00"},
    {a:"🇵🇹",b:"🇨🇩",date:"2026-06-17",time:"17:00"},
    {a:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",b:"🇭🇷",date:"2026-06-17",time:"20:00"},
    {a:"🇬🇭",b:"🇵🇦",date:"2026-06-17",time:"23:00"},
    {a:"🇺🇿",b:"🇨🇴",date:"2026-06-18",time:"02:00"},
    {a:"🇨🇿",b:"🇿🇦",date:"2026-06-18",time:"16:00"},
    {a:"🇨🇭",b:"🇧🇦",date:"2026-06-18",time:"19:00"},
    {a:"🇨🇦",b:"🇶🇦",date:"2026-06-18",time:"22:00"},
    {a:"🇲🇽",b:"🇰🇷",date:"2026-06-19",time:"01:00"},
    {a:"🇺🇸",b:"🇦🇺",date:"2026-06-19",time:"19:00"},
    {a:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",b:"🇲🇦",date:"2026-06-19",time:"22:00"},
    {a:"🇧🇷",b:"🇭🇹",date:"2026-06-20",time:"00:30"},
    {a:"🇹🇷",b:"🇵🇾",date:"2026-06-20",time:"03:00"},
    {a:"🇳🇱",b:"🇸🇪",date:"2026-06-20",time:"17:00"},
    {a:"🇩🇪",b:"🇨🇮",date:"2026-06-20",time:"20:00"},
    {a:"🇪🇨",b:"🇨🇼",date:"2026-06-21",time:"00:00"},
    {a:"🇹🇳",b:"🇯🇵",date:"2026-06-21",time:"04:00"},
    {a:"🇪🇸",b:"🇸🇦",date:"2026-06-21",time:"16:00"},
    {a:"🇧🇪",b:"🇮🇷",date:"2026-06-21",time:"19:00"},
    {a:"🇺🇾",b:"🇨🇻",date:"2026-06-21",time:"22:00"},
    {a:"🇳🇿",b:"🇪🇬",date:"2026-06-22",time:"01:00"},
    {a:"🇦🇷",b:"🇦🇹",date:"2026-06-22",time:"17:00"},
    {a:"🇫🇷",b:"🇮🇶",date:"2026-06-22",time:"21:00"},
    {a:"🇳🇴",b:"🇸🇳",date:"2026-06-23",time:"00:00"},
    {a:"🇯🇴",b:"🇩🇿",date:"2026-06-23",time:"03:00"},
    {a:"🇵🇹",b:"🇺🇿",date:"2026-06-23",time:"17:00"},
    {a:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",b:"🇬🇭",date:"2026-06-23",time:"20:00"},
    {a:"🇵🇦",b:"🇭🇷",date:"2026-06-23",time:"23:00"},
    {a:"🇨🇴",b:"🇨🇩",date:"2026-06-24",time:"02:00"},
    {a:"🇨🇭",b:"🇨🇦",date:"2026-06-24",time:"19:00"},
    {a:"🇧🇦",b:"🇶🇦",date:"2026-06-24",time:"19:00"},
    {a:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",b:"🇧🇷",date:"2026-06-24",time:"22:00"},
    {a:"🇲🇦",b:"🇭🇹",date:"2026-06-24",time:"22:00"},
    {a:"🇨🇿",b:"🇲🇽",date:"2026-06-25",time:"01:00"},
    {a:"🇿🇦",b:"🇰🇷",date:"2026-06-25",time:"01:00"},
    {a:"🇨🇼",b:"🇨🇮",date:"2026-06-25",time:"20:00"},
    {a:"🇪🇨",b:"🇩🇪",date:"2026-06-25",time:"20:00"},
    {a:"🇯🇵",b:"🇸🇪",date:"2026-06-25",time:"23:00"},
    {a:"🇹🇳",b:"🇳🇱",date:"2026-06-25",time:"23:00"},
    {a:"🇹🇷",b:"🇺🇸",date:"2026-06-26",time:"02:00"},
    {a:"🇵🇾",b:"🇦🇺",date:"2026-06-26",time:"02:00"},
    {a:"🇳🇴",b:"🇫🇷",date:"2026-06-26",time:"19:00"},
    {a:"🇸🇳",b:"🇮🇶",date:"2026-06-26",time:"19:00"},
    {a:"🇨🇻",b:"🇸🇦",date:"2026-06-27",time:"00:00"},
    {a:"🇺🇾",b:"🇪🇸",date:"2026-06-27",time:"00:00"},
    {a:"🇪🇬",b:"🇮🇷",date:"2026-06-27",time:"03:00"},
    {a:"🇳🇿",b:"🇧🇪",date:"2026-06-27",time:"03:00"},
    {a:"🇵🇦",b:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",date:"2026-06-27",time:"21:00"},
    {a:"🇭🇷",b:"🇬🇭",date:"2026-06-27",time:"21:00"},
    {a:"🇨🇴",b:"🇵🇹",date:"2026-06-27",time:"23:30"},
    {a:"🇨🇩",b:"🇺🇿",date:"2026-06-27",time:"23:30"},
    {a:"🇩🇿",b:"🇦🇹",date:"2026-06-28",time:"02:00"},
    {a:"🇯🇴",b:"🇦🇷",date:"2026-06-28",time:"02:00"}
  ];
  var MATCH_VENUE = [4,1,3,1,6,7,8,12,2,14,5,13,4,8,1,10,11,12,1,0,14,3,2,7,0,6,15,8,12,7,9,12,15,5,6,13,2,10,4,8,0,11,12,1,14,3,2,7,15,6,9,7,4,1,5,2,14,15,1,12,11,13,4,2,10,8,3,0,13,14,5,1];
  var stadiumMatches = {};
  for (var _vi = 0; _vi < 16; _vi++) stadiumMatches[_vi] = [];
  for (var _mi = 0; _mi < MATCHES.length && _mi < MATCH_VENUE.length; _mi++) stadiumMatches[MATCH_VENUE[_mi]].push(_mi);

  var FLAG_CODE = {
    '🇲🇽':'MEX','🇿🇦':'RSA','🇰🇷':'KOR','🇨🇿':'CZE','🇨🇦':'CAN','🇧🇦':'BIH',
    '🇺🇸':'USA','🇵🇾':'PAR','🇶🇦':'QAT','🇨🇭':'SUI','🇧🇷':'BRA','🇲🇦':'MAR',
    '🇭🇹':'HAI','🇦🇺':'AUS','🇹🇷':'TUR','🇩🇪':'GER','🇨🇼':'CUW','🇳🇱':'NED',
    '🇯🇵':'JPN','🇨🇮':'CIV','🇪🇨':'ECU','🇸🇪':'SWE','🇹🇳':'TUN','🇪🇸':'ESP',
    '🇨🇻':'CPV','🇧🇪':'BEL','🇪🇬':'EGY','🇸🇦':'KSA','🇺🇾':'URU','🇮🇷':'IRN',
    '🇳🇿':'NZL','🇫🇷':'FRA','🇸🇳':'SEN','🇮🇶':'IRQ','🇳🇴':'NOR','🇦🇷':'ARG',
    '🇩🇿':'ALG','🇦🇹':'AUT','🇯🇴':'JOR','🇵🇹':'POR','🇨🇩':'COD','🇭🇷':'CRO',
    '🇬🇭':'GHA','🇵🇦':'PAN','🇺🇿':'UZB','🇨🇴':'COL','🏴󠁧󠁢󠁳󠁣󠁴󠁿':'SCO','🏴󠁧󠁢󠁥󠁮󠁧󠁿':'ENG'
  };
  function flagCode(f) { return FLAG_CODE[f] || ''; }
  function fc(f) { var c = flagCode(f); return c ? '<span class="tm-code">' + c + '</span>' : ''; }

  var GROUPS = [
    {g:'A', f:['🇲🇽','🇿🇦','🇰🇷','🇨🇿']},
    {g:'B', f:['🇨🇦','🇧🇦','🇶🇦','🇨🇭']},
    {g:'C', f:['🇧🇷','🇲🇦','🇭🇹','🏴󠁧󠁢󠁳󠁣󠁴󠁿']},
    {g:'D', f:['🇺🇸','🇵🇾','🇦🇺','🇹🇷']},
    {g:'E', f:['🇩🇪','🇨🇼','🇨🇮','🇪🇨']},
    {g:'F', f:['🇳🇱','🇯🇵','🇸🇪','🇹🇳']},
    {g:'G', f:['🇧🇪','🇪🇬','🇮🇷','🇳🇿']},
    {g:'H', f:['🇪🇸','🇨🇻','🇸🇦','🇺🇾']},
    {g:'I', f:['🇫🇷','🇸🇳','🇮🇶','🇳🇴']},
    {g:'J', f:['🇦🇷','🇩🇿','🇦🇹','🇯🇴']},
    {g:'K', f:['🇵🇹','🇨🇩','🇺🇿','🇨🇴']},
    {g:'L', f:['🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇭🇷','🇬🇭','🇵🇦']}
  ];

  var flagToGroup = {};
  GROUPS.forEach(function(grp) { grp.f.forEach(function(f) { flagToGroup[f] = grp.g; }); });
  var flagToName = {};
  wc2026.forEach(function(d) { if (d.flag && d.name) flagToName[d.flag] = d.name; });

  var CAL_R32_BG = 'rgba(88,166,255,0.18)';
  var CAL_R16_BG = 'rgba(88,166,255,0.32)';
  var CAL_QF_BG  = 'rgba(88,166,255,0.50)';
  var CAL_SF_BG  = 'rgba(88,166,255,0.66)';
  var CAL_3RD_BG = 'rgba(88,166,255,0.50)';
  var CAL_FIN_BG = 'rgba(88,166,255,0.90)';
  var CAL_DAYS = {
    1:CAL_R32_BG,2:CAL_R32_BG,3:CAL_R32_BG,4:CAL_R32_BG,5:CAL_R32_BG,6:CAL_R32_BG,
    8:CAL_R16_BG,9:CAL_R16_BG,10:CAL_R16_BG,11:CAL_R16_BG,12:CAL_R16_BG,
    14:CAL_QF_BG,15:CAL_QF_BG,16:CAL_QF_BG,
    19:CAL_SF_BG,20:CAL_SF_BG,
    23:CAL_3RD_BG,
    26:CAL_FIN_BG
  };
  var CAL_LABELS = {1:'R32',8:'R16',14:'QF',19:'SF',23:'3位',26:'決勝'};
  var CAL_ICONS_JUL = {27:'🏆'};

  function buildCalendar() {
    var sec = document.getElementById('cal-section');
    if (!sec) return;
    var firstDow = new Date(2026, 6, 1).getDay();
    var todayStr = new Date().toISOString().slice(0, 10);
    var todayDay = todayStr.startsWith('2026-07-') ? parseInt(todayStr.slice(8), 10) : 0;
    var wdays = ['日','月','火','水','木','金','土'];
    var html = '<div class="cal-month-hdr">7️⃣</div>';
    html += '<div class="cal-wrap">';
    html += '<div class="cal-title">🏆 ノックアウトステージ (32)🏃‍♂️‍➡️</div>';
    html += '<div class="cal-legend">';
    html += '<span class="cal-leg" style="background:' + CAL_R32_BG + '">R32</span>';
    html += '<span class="cal-leg" style="background:' + CAL_R16_BG + '">R16</span>';
    html += '<span class="cal-leg" style="background:' + CAL_QF_BG  + '">QF</span>';
    html += '<span class="cal-leg" style="background:' + CAL_SF_BG  + '">SF</span>';
    html += '<span class="cal-leg" style="background:' + CAL_FIN_BG + ';color:#0d1117">決勝</span>';
    html += '</div><div class="cal-grid">';
    for (var wi = 0; wi < 7; wi++) { html += '<div class="cal-cell cal-hdr">' + wdays[wi] + '</div>'; }
    for (var ei = 0; ei < firstDow; ei++) { html += '<div class="cal-cell"></div>'; }
    for (var di = 1; di <= 31; di++) {
      var bg = CAL_DAYS[di] || '';
      var cls = 'cal-cell' + (bg ? ' cal-match' : '') + (di === todayDay ? ' cal-today' : '');
      var style = bg ? 'background:' + bg : '';
      var lbl = (CAL_LABELS[di] ? '<div class="cal-rlabel">' + CAL_LABELS[di] + '</div>' : '') +
                (CAL_ICONS_JUL[di] ? '<div class="cal-rlabel">' + CAL_ICONS_JUL[di] + '</div>' : '');
      var julDate = '2026-07-' + (di < 10 ? '0' + di : '' + di);
      html += '<div class="' + cls + '" data-date="' + julDate + '" style="' + style + '">' + di + lbl + '</div>';
    }
    html += '</div></div>';
    sec.innerHTML = html;
  }

  function buildDrawerCalendar() {
    var sec = document.getElementById('drw-cal');
    if (!sec) return;
    var juneDays = {};
    MATCHES.forEach(function(m) {
      if (m.date.startsWith('2026-06-')) juneDays[parseInt(m.date.slice(8), 10)] = true;
    });
    var firstDow = new Date(2026, 5, 1).getDay();
    var todayStr = new Date().toISOString().slice(0, 10);
    var todayDay = todayStr.startsWith('2026-06-') ? parseInt(todayStr.slice(8), 10) : 0;
    var GS_BG = 'rgba(88,166,255,0.18)';
    var wdays = ['日','月','火','水','木','金','土'];
    var html = '<div class="cal-month-hdr">6️⃣</div>';
    html += '<div class="cal-wrap drw-cal-wrap">';
    html += '<div class="cal-title">🏃‍♂️‍➡️ グループステージ (72)</div>';
    html += '<div class="cal-legend"><span class="cal-leg" style="background:' + GS_BG + '">グループステージ</span></div>';
    html += '<div class="cal-grid">';
    for (var wi = 0; wi < 7; wi++) { html += '<div class="cal-cell cal-hdr">' + wdays[wi] + '</div>'; }
    for (var ei = 0; ei < firstDow; ei++) { html += '<div class="cal-cell"></div>'; }
    for (var di = 1; di <= 30; di++) {
      var isMatch = juneDays[di] || false;
      var isToday = di === todayDay;
      var cls = 'cal-cell' + (isMatch ? ' cal-match' : '') + (isToday ? ' cal-today' : '');
      var style = isMatch ? 'background:' + GS_BG : '';
      var lbl = '';
      var dStr = '2026-06-' + (di < 10 ? '0' + di : '' + di);
      var dateAttr = isMatch ? ' data-date="' + dStr + '"' : '';
      html += '<div class="' + cls + '"' + dateAttr + ' style="' + style + '">' + di + lbl + '</div>';
    }
    html += '</div></div>';
    sec.innerHTML = html;
    sec.addEventListener('click', function(e) {
      var cell = e.target.closest('.cal-match');
      if (!cell || !cell.dataset.date) return;
      var ds = cell.dataset.date;
      sec.querySelectorAll('.cal-selected').forEach(function(el) { el.classList.remove('cal-selected'); });
      cell.classList.add('cal-selected');
      if (!drwBuilt) { buildDrawer(); drwBuilt = true; }
      openDateSection(ds);
      selectedDate = ds;
      updateActiveDateFlags(ds);
    });
  }

  function buildGroupsPanel() {
    var grpBody = document.getElementById('grp-body');
    if (!grpBody) return;
    var todayStr = new Date().toISOString().slice(0, 10);
    var todayFlags = {};
    MATCHES.forEach(function(m) {
      if (m.date === todayStr) { todayFlags[m.a] = true; todayFlags[m.b] = true; }
    });
    var html = '';
    GROUPS.forEach(function(grp) {
      html += '<div class="grp-row" data-g="' + grp.g + '"><span class="grp-label">' + grp.g + '</span><span class="grp-flags">';
      grp.f.forEach(function(flag) {
        var cls = 'grp-flag' + (todayFlags[flag] ? ' grp-flag-today' : '');
        var enc = flag.replace(/&/g, '&amp;');
        html += '<span class="' + cls + '" data-flag="' + enc + '">' + flag + '</span>';
      });
      html += '</span><button class="grp-stadium-btn" data-g="' + grp.g + '">&#127967;</button><span class="grp-match-info" data-g="' + grp.g + '"></span></div>';
    });
    grpBody.innerHTML = html;
    updateGroupStadiumIcons(selectedDate);
    grpBody.addEventListener('click', function(e) {
      var span = e.target.closest('.grp-flag');
      if (!span) return;
      var flag = span.dataset.flag;
      if (!flag) return;
      grpBody.querySelectorAll('.grp-flag').forEach(function(s) { s.classList.remove('grp-flag-active'); });
      span.classList.add('grp-flag-active');
      var now2 = Date.now();
      var nextMatch = null;
      var nextKo = Infinity;
      var fallback = null;
      var fallbackKo = -Infinity;
      for (var mi2 = 0; mi2 < MATCHES.length; mi2++) {
        var mm = MATCHES[mi2];
        if (mm.a !== flag && mm.b !== flag) continue;
        var ko2 = new Date(mm.date + 'T' + mm.time + ':00Z').getTime();
        if (ko2 > now2 - 110*60000) {
          if (ko2 < nextKo) { nextMatch = mm; nextKo = ko2; }
        } else {
          if (ko2 > fallbackKo) { fallback = mm; fallbackKo = ko2; }
        }
      }
      var match = nextMatch || fallback;
      var targetFlag = flag;
      if (match) {
        if (match.a === flag) { targetFlag = match.a; }
        else { targetFlag = match.b; }
      }
      openDrawer();
      blinkCalToday();
      document.querySelectorAll('.cal-pin, .drw-pin').forEach(function(p) { p.parentNode.removeChild(p); });
      blinkCalDate(match ? match.date : null, true);
      highlightDrawerFlag(targetFlag);
      if (match) { updateActiveDateFlags(match.date); }
      var tidx2 = findCountryByFlag(targetFlag);
      if (tidx2 >= 0) {
        var td2 = wc2026[tidx2];
        flyTo(td2.lat, td2.lon);
        setTimeout(function() {
          var mkEls = document.querySelectorAll('.mk');
          var el2 = mkEls[tidx2];
          var cx2 = el2 ? el2.getBoundingClientRect().left + el2.getBoundingClientRect().width/2 : canvasRect.left + canvasRect.width/2;
          var cy2 = el2 ? el2.getBoundingClientRect().top + el2.getBoundingClientRect().height/2 : canvasRect.top + canvasRect.height/2;
          tooltip.innerHTML = buildAllMatchesHtml(td2.flag, td2.name);
          positionTooltip(cx2, cy2);
          tooltip.style.opacity = '1';
          activeMarkerIdx = tidx2;
        }, 900);
      }
    });
  }

  function blinkCalToday() {
    var cell = document.querySelector('#drw-cal .cal-today');
    if (!cell) return;
    cell.classList.remove('cal-today-blink');
    void cell.offsetWidth;
    cell.classList.add('cal-today-blink');
    cell.addEventListener('animationend', function() { cell.classList.remove('cal-today-blink'); }, {once: true});
  }

  function blinkCalDate(dateStr, withPin) {
    if (!dateStr) return;
    var container = dateStr.startsWith('2026-06-') ? document.getElementById('drw-cal') : document.getElementById('cal-section');
    if (!container) return;
    var cell = container.querySelector('[data-date="' + dateStr + '"]');
    if (!cell) return;
    cell.classList.remove('cal-today-blink');
    void cell.offsetWidth;
    cell.classList.add('cal-today-blink');
    cell.addEventListener('animationend', function() {
      cell.classList.remove('cal-today-blink');
      if (withPin) {
        var p = document.createElement('div');
        p.className = 'cal-rlabel cal-pin';
        p.textContent = '⛳';
        cell.appendChild(p);
        var drwSec = document.querySelector('#drw-body .drw-section[data-date="' + dateStr + '"]');
        if (drwSec) {
          var chevron = drwSec.querySelector('.drw-chevron');
          if (chevron) {
            var dp = document.createElement('span');
            dp.className = 'drw-pin';
            dp.textContent = '⛳';
            chevron.parentNode.insertBefore(dp, chevron);
          }
        }
      }
    }, {once: true});
  }

  function highlightDrawerFlag(flag) {
    var rows = drwBody.querySelectorAll('.drw-row');
    var target = null;
    var pastFallback = null;
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.remove('drw-highlight');
      var ra = rows[i].dataset.a, rb = rows[i].dataset.b;
      if (ra === flag || rb === flag) {
        if (!rows[i].classList.contains('drw-past')) {
          if (!target) target = rows[i];
        } else {
          pastFallback = rows[i];
        }
      }
    }
    var chosen = target || pastFallback;
    if (chosen) {
      var sec = chosen.closest('.drw-section');
      if (sec) {
        drwBody.querySelectorAll('.drw-section').forEach(function(s) { s.classList.remove('open'); });
        sec.classList.add('open');
      }
      chosen.classList.add('drw-highlight');
      setTimeout(function() { chosen.scrollIntoView({behavior:'smooth', block:'center'}); }, 80);
    }
  }

  var TNMT_ROUNDS = [
    { label: 'ラウンド32', key: 'r32', matches: [
      {id:'r32-1', date:'7/1', a:null, b:null, slotA:'1A', slotB:'2C'},
      {id:'r32-2', date:'7/1', a:null, b:null, slotA:'1B', slotB:'2D'},
      {id:'r32-3', date:'7/2', a:null, b:null, slotA:'1C', slotB:'2A'},
      {id:'r32-4', date:'7/2', a:null, b:null, slotA:'1D', slotB:'2B'},
      {id:'r32-5', date:'7/3', a:null, b:null, slotA:'1E', slotB:'2G'},
      {id:'r32-6', date:'7/3', a:null, b:null, slotA:'1F', slotB:'2H'},
      {id:'r32-7', date:'7/4', a:null, b:null, slotA:'1G', slotB:'2E'},
      {id:'r32-8', date:'7/4', a:null, b:null, slotA:'1H', slotB:'2F'},
      {id:'r32-9', date:'7/5', a:null, b:null, slotA:'1I', slotB:'2K'},
      {id:'r32-10', date:'7/5', a:null, b:null, slotA:'1J', slotB:'2L'},
      {id:'r32-11', date:'7/6', a:null, b:null, slotA:'1K', slotB:'2I'},
      {id:'r32-12', date:'7/6', a:null, b:null, slotA:'1L', slotB:'2J'},
      {id:'r32-13', date:'7/1', a:null, b:null, slotA:'3位(ABCD)', slotB:'3位(EFGH)'},
      {id:'r32-14', date:'7/2', a:null, b:null, slotA:'3位(IJKL)', slotB:'3位(ABEF)'},
      {id:'r32-15', date:'7/3', a:null, b:null, slotA:'3位(CDIJ)', slotB:'3位(GHKL)'},
      {id:'r32-16', date:'7/4', a:null, b:null, slotA:'3位(ABCD)', slotB:'3位(IJKL)'}
    ]},
    { label: 'ベスト16', key: 'r16', matches: [
      {id:'r16-1', date:'7/8', a:null, b:null, slotA:'R32-M1勝者', slotB:'R32-M2勝者'},
      {id:'r16-2', date:'7/8', a:null, b:null, slotA:'R32-M3勝者', slotB:'R32-M4勝者'},
      {id:'r16-3', date:'7/9', a:null, b:null, slotA:'R32-M5勝者', slotB:'R32-M6勝者'},
      {id:'r16-4', date:'7/9', a:null, b:null, slotA:'R32-M7勝者', slotB:'R32-M8勝者'},
      {id:'r16-5', date:'7/10', a:null, b:null, slotA:'R32-M9勝者', slotB:'R32-M10勝者'},
      {id:'r16-6', date:'7/10', a:null, b:null, slotA:'R32-M11勝者', slotB:'R32-M12勝者'},
      {id:'r16-7', date:'7/11', a:null, b:null, slotA:'R32-M13勝者', slotB:'R32-M14勝者'},
      {id:'r16-8', date:'7/12', a:null, b:null, slotA:'R32-M15勝者', slotB:'R32-M16勝者'}
    ]},
    { label: '準々決勝', key: 'qf', matches: [
      {id:'qf-1', date:'7/14', a:null, b:null, slotA:'R16-M1勝者', slotB:'R16-M2勝者'},
      {id:'qf-2', date:'7/14', a:null, b:null, slotA:'R16-M3勝者', slotB:'R16-M4勝者'},
      {id:'qf-3', date:'7/15', a:null, b:null, slotA:'R16-M5勝者', slotB:'R16-M6勝者'},
      {id:'qf-4', date:'7/16', a:null, b:null, slotA:'R16-M7勝者', slotB:'R16-M8勝者'}
    ]},
    { label: '準決勝', key: 'sf', matches: [
      {id:'sf-1', date:'7/19', a:null, b:null, slotA:'QF1勝者', slotB:'QF2勝者'},
      {id:'sf-2', date:'7/20', a:null, b:null, slotA:'QF3勝者', slotB:'QF4勝者'}
    ]},
    { label: '決勝', key: 'final', matches: [
      {id:'final', date:'7/26', a:null, b:null, slotA:'SF1勝者', slotB:'SF2勝者'}
    ]}
  ];

  var TNMT_3RD = {id:'3rd', date:'7/23', a:null, b:null, slotA:'SF1負', slotB:'SF2負'};

  var DOW_JA = ['日','月','火','水','木','金','土'];
  function dateWithDow(ds) {
    var p = ds.split('/');
    if (p.length !== 2) return ds;
    var d = new Date(2026, parseInt(p[0], 10) - 1, parseInt(p[1], 10));
    return ds + '(' + DOW_JA[d.getDay()] + ')';
  }

  function buildTournamentModal() {
    var body = document.getElementById('tnmt-body');
    if (!body) return;
    var groupsHtml = '<div class="tnmt-grp-list">';
    GROUPS.forEach(function(grp) {
      groupsHtml += '<div class="tnmt-grp-item"><span class="tnmt-grp-badge">' + grp.g + '</span><span class="tnmt-grp-flags">' + grp.f.join('') + '</span></div>';
    });
    groupsHtml += '</div>';
    function teamSlot(flag, slot) {
      if (flag) {
        var code = flagCode(flag);
        return '<div class="tnmt-team"><span class="tnmt-team-flag">' + flag + '</span><span class="tnmt-team-code">' + code + '</span></div>';
      }
      return '<div class="tnmt-team"><span class="tnmt-team-tbd">' + slot + '</span></div>';
    }
    function matchCard(m) {
      return '<div class="tnmt-match"><div class="tnmt-match-date">' + dateWithDow(m.date) + '</div>' +
        teamSlot(m.a, m.slotA) + teamSlot(m.b, m.slotB) + '</div>';
    }
    var bracketHtml = '<div class="tnmt-bracket">';
    TNMT_ROUNDS.forEach(function(rnd) {
      var isFinal = rnd.key === 'final';
      bracketHtml += '<div class="tnmt-col' + (isFinal ? ' tnmt-col-final' : '') + '">';
      bracketHtml += '<div class="tnmt-col-hdr">' + rnd.label + '</div>';
      rnd.matches.forEach(function(m) { bracketHtml += matchCard(m); });
      bracketHtml += '</div>';
    });
    bracketHtml += '</div>';
    bracketHtml += '<div class="tnmt-3rd"><div class="tnmt-3rd-label">3位決定戦 (' + dateWithDow('7/23') + ')</div>' +
      matchCard(TNMT_3RD) + '</div>';
    body.innerHTML = groupsHtml + bracketHtml;
  }

  var tnmtOverlay = document.getElementById('tnmt-overlay');
  var tnmtBtn = document.getElementById('tnmt-btn');
  var tnmtClose = document.getElementById('tnmtClose');
  var tnmtBuilt = false;

  function openTournament() {
    if (!tnmtBuilt) { buildTournamentModal(); tnmtBuilt = true; }
    tnmtOverlay.style.zIndex = String(getNextZ());
    tnmtOverlay.classList.add('open');
  }
  function closeTournament() { tnmtOverlay.classList.remove('open'); }
  tnmtBtn.addEventListener('click', openTournament);
  tnmtClose.addEventListener('click', closeTournament);
  tnmtOverlay.addEventListener('click', function(e) {
    if (e.target === tnmtOverlay) closeTournament();
  });

  var teamMatches = {};
  var ELIMINATED = {};
  MATCHES.forEach(function(m) {
    if (!teamMatches[m.a]) teamMatches[m.a] = [];
    if (!teamMatches[m.b]) teamMatches[m.b] = [];
    teamMatches[m.a].push({opp:m.b, date:m.date, time:m.time});
    teamMatches[m.b].push({opp:m.a, date:m.date, time:m.time});
  });

  function getNextMatch(flag) {
    var ms = teamMatches[flag];
    if (!ms) return null;
    var now = Date.now();
    for (var i = 0; i < ms.length; i++) {
      var ko = new Date(ms[i].date + "T" + ms[i].time + ":00Z").getTime();
      if (ko > now - 110*60000) return {m: ms[i], past: ko < now, ko: ko};
    }
    return {m: ms[ms.length-1], past: true, ko: 0};
  }

  var flyTarget = null, flyFrom = null, flyStart = 0;
  var FLY_DUR = 2500;

  function toJST(utcTime) {
    var h = parseInt(utcTime.slice(0, 2)) + 9;
    var m = utcTime.slice(3, 5);
    var next = h >= 24;
    h = h % 24;
    return (next ? "翌" : "") + (h < 10 ? "0" : "") + h + ":" + m + " JST(UTC+9)";
  }

  function toET(utcTime) {
    var h = parseInt(utcTime.slice(0, 2)) - 4;
    var m = utcTime.slice(3, 5);
    var prev = h < 0;
    if (prev) h += 24;
    return (h < 10 ? "0" : "") + h + ":" + m + " ET(UTC-4)" + (prev ? " 前日" : "");
  }

  function findCountryByFlag(flag) {
    for (var i = 0; i < wc2026.length; i++) {
      if (wc2026[i].flag === flag) return i;
    }
    return -1;
  }

  function flyTo(lat, lon) {
    var latR = lat * Math.PI / 180;
    var lonR = lon * Math.PI / 180;
    var sinDy = Math.tan(axialTilt) * Math.tan(latR);
    sinDy = sinDy < -1 ? -1 : sinDy > 1 ? 1 : sinDy;
    var ty = -(Math.PI/2 + lonR) + Math.asin(sinDy);
    var tx = Math.atan(Math.cos(axialTilt) * Math.tan(latR));
    var dy = ty - rotYv;
    while (dy > Math.PI) dy -= 2*Math.PI;
    while (dy < -Math.PI) dy += 2*Math.PI;
    momentumY = 0; momentumX = 0;
    flyFrom = {ry: rotYv, rx: rotXv};
    flyTarget = {ry: rotYv + dy, rx: tx};
    flyStart = performance.now();
    autoRot = false;
    btnAutoRot.textContent = "▶ 回転";
    btnAutoRot.classList.add("active");
    if (axisLocked) {
      axisLocked = false;
      btnAxisLock.classList.remove("active");
      btnAxisLock.textContent = "＋ 軸垂直固定";
    }
  }

  var tooltip = document.getElementById("mk-tooltip");
  var schedulePanel = document.getElementById("schedule-panel");
  var spBody = schedulePanel.querySelector("#sp-body");
  var activeMarkerIdx = -1;
  var activeStadiumIdx = -1;
  var selectedDate = new Date().toISOString().slice(0, 10);
  var canvasRect = {left:0, top:0, width:0, height:0};

  function updateCanvasRect() { canvasRect = canvas.getBoundingClientRect(); }
  window.addEventListener("resize", updateCanvasRect);
  updateCanvasRect();

  var stadiumTooltipLeftMode = false;

  function hideTooltip() { tooltip.style.opacity = "0"; activeMarkerIdx = -1; activeStadiumIdx = -1; stadiumTooltipLeftMode = false; tooltip.classList.remove('tt-left-side'); }

  function navigateToFlag(flag) {
    var idx2 = findCountryByFlag(flag);
    if (idx2 < 0) return;
    var d2 = wc2026[idx2];
    hideTooltip();
    activeMarkerIdx = idx2;
    flyTo(d2.lat, d2.lon);
    setTimeout(function() {
      var r2 = document.querySelectorAll('.mk')[idx2];
      var cx = r2 ? r2.getBoundingClientRect().left + r2.getBoundingClientRect().width/2 : canvasRect.left + canvasRect.width/2;
      var cy = r2 ? r2.getBoundingClientRect().top + r2.getBoundingClientRect().height/2 : canvasRect.top + canvasRect.height/2;
      tooltip.innerHTML = buildAllMatchesHtml(d2.flag, d2.name);
      positionTooltip(cx, cy);
      tooltip.style.opacity = '1';
    }, 900);
  }

  tooltip.addEventListener('click', function(e) {
    e.stopPropagation();
    if (e.target.closest('.tt-close')) { hideTooltip(); return; }
    var oppSpan = e.target.closest('.tt-opp-tap');
    if (oppSpan) {
      var oppFlag = oppSpan.dataset.flag;
      if (oppFlag) { navigateToFlag(oppFlag); return; }
    }
    var dateTap = e.target.closest('.tt-date-tap');
    if (dateTap) {
      var dateStr2 = dateTap.dataset.date;
      if (dateStr2) {
        hideTooltip();
        openDrawer();
        openDateSection(dateStr2);
        updateActiveDateFlags(dateStr2);
      }
    }
  });

  function positionTooltip(vx, vy) {
    tooltip.style.left = vx + "px";
    tooltip.style.top  = vy + "px";
    if (stadiumTooltipLeftMode) {
      tooltip.classList.add("tt-left-side");
      tooltip.classList.remove("below");
    } else {
      tooltip.classList.remove("tt-left-side");
      var isNearTop = vy < canvasRect.top + 80;
      if (isNearTop) { tooltip.classList.add("below"); } else { tooltip.classList.remove("below"); }
    }
  }

  function buildAllMatchesHtml(flag, name) {
    var code = flagCode(flag);
    var hdr = '<button class="tt-close">&#10005;</button><span class="tt-flag-lg">' + flag + '</span><div class="tt-name">' + name + '</div>' + (code ? '<div class="tt-code">' + code + '</div>' : '');
    var ms = teamMatches[flag];
    if (!ms || ms.length === 0) return hdr;
    var now2 = Date.now();
    var sorted = ms.slice().sort(function(x, y) { return (x.date + x.time) < (y.date + y.time) ? -1 : 1; });
    var nearestFutureIdx = -1;
    for (var i = 0; i < sorted.length; i++) {
      var ko2 = new Date(sorted[i].date + 'T' + sorted[i].time + ':00Z').getTime();
      if (ko2 > now2 - 110*60000) { nearestFutureIdx = i; break; }
    }
    var html = hdr;
    for (var j = 0; j < sorted.length; j++) {
      var m2 = sorted[j];
      var md2 = m2.date.slice(5).replace('-', '/');
      var ko3 = new Date(m2.date + 'T' + m2.time + ':00Z').getTime();
      var isPast = ko3 <= now2 - 110*60000;
      var isNearest = (j === nearestFutureIdx);
      var oppCode = flagCode(m2.opp);
      var oppTap = '<span class="tt-opp-tap" data-flag="' + m2.opp + '">' + m2.opp + '</span>';
      var oppCodeSpan = oppCode ? '<span class="tt-opp-tap" data-flag="' + m2.opp + '">' + oppCode + '</span>' : '';
      var dateTap = '<span class="tt-date-tap" data-date="' + m2.date + '">' + md2 + '</span>';
      if (isPast) {
        html += '<div class="tt-mrow tt-past">' + oppTap + ' ' + oppCodeSpan + ' ' + dateTap + '</div>';
      } else if (isNearest) {
        html += '<div class="tt-mrow">' + oppTap + ' ' + oppCodeSpan + ' ' + dateTap + '<span class="tt-time">' + m2.time + ' UTC / ' + toET(m2.time) + ' / ' + toJST(m2.time) + '</span></div>';
      } else {
        html += '<div class="tt-mrow">' + oppTap + ' ' + oppCodeSpan + ' ' + dateTap + '</div>';
      }
    }
    return html;
  }

  function showTooltip(idx, vx, vy) {
    var d = wc2026[idx];
    if (d.ball) { showSchedulePanel(); return; }
    tooltip.innerHTML = buildAllMatchesHtml(d.flag, d.name);
    positionTooltip(vx, vy);
    tooltip.style.opacity = "1";
    activeMarkerIdx = idx;
    flyTo(d.lat, d.lon);
  }

  var leftDrawer = document.getElementById("left-drawer");
  var drwOverlay = document.getElementById("drawer-overlay");
  var drwBody    = document.getElementById("drw-body");
  var matchInfo  = document.getElementById("match-info");
  var miFlags    = document.getElementById("mi-flags");
  var miTime     = document.getElementById("mi-time");
  var miDate     = document.getElementById("mi-date");
  var drwBuilt = false;

  function openDrawer() {
    if (!drwBuilt) { buildDrawer(); drwBuilt = true; }
    leftDrawer.classList.add("open");
    drwOverlay.classList.add("open");
    hideTooltip();
    schedulePanel.classList.remove("open");
  }
  function closeDrawer() {
    leftDrawer.classList.remove("open");
    drwOverlay.classList.remove("open");
  }
  function showMatchDetail(a, b, date, time, doFly, keepDrawer) {
    miFlags.innerHTML = fc(a) + ' ' + a + '<span class="mi-vs">vs</span>' + b + ' ' + fc(b);
    miTime.textContent  = time + " UTC / " + toET(time) + " / " + toJST(time);
    miDate.textContent  = date.slice(5).replace("-", "/");
    matchInfo.classList.add("open");
    blinkCalDate(date);
    if (!keepDrawer) closeDrawer();
    schedulePanel.classList.remove("open");
    if (doFly) {
      var tidx = findCountryByFlag(a);
      if (tidx >= 0) {
        var td = wc2026[tidx];
        tooltip.innerHTML = buildAllMatchesHtml(td.flag, td.name);
        activeMarkerIdx = tidx;
        flyTo(td.lat, td.lon);
      }
    }
  }
  function closeMatchDetail() { matchInfo.classList.remove("open"); }
  var miCloseBtn = document.getElementById("miClose");
  miCloseBtn.addEventListener("click", function(e) { e.stopPropagation(); closeMatchDetail(); });
  var spCloseBtn = document.getElementById("spClose");
  spCloseBtn.addEventListener("click", function() { schedulePanel.classList.remove("open"); });

  function showSchedulePanel() {
    var todayStr = new Date().toISOString().slice(0, 10);
    var allMatches = MATCHES.filter(function(m) { return m.date >= todayStr; });
    allMatches.sort(function(a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
    var html = "";
    var lastDate = "";
    var nowMs = Date.now();
    allMatches.forEach(function(m) {
      if (m.date !== lastDate) {
        var label = m.date === todayStr ? "本日 " + m.date.slice(5).replace("-","/") : m.date.slice(5).replace("-","/");
        html += '<div class="sp-date">' + label + '</div>';
        lastDate = m.date;
      }
      var koMs = new Date(m.date + "T" + m.time + ":00Z").getTime();
      var isPast = koMs < nowMs - 110*60000;
      var isTod  = m.date === todayStr;
      var cls = "sp-match" + (isPast ? " sp-past" : "") + (isTod && !isPast ? " sp-today" : "");
      html += '<div class="' + cls + '" data-a="' + m.a + '" data-b="' + m.b + '" data-date="' + m.date + '" data-time="' + m.time + '" style="cursor:pointer"><span class="sp-flags">' + fc(m.a) + ' ' + m.a + ' <span style="color:#484f58">-</span> ' + m.b + ' ' + fc(m.b) + '</span><span class="sp-time">' + m.time + ' UTC<br>' + toET(m.time) + '<br>' + toJST(m.time) + '</span></div>';
    });
    spBody.innerHTML = html || '<div style="padding:16px;color:#8b949e">本日以降の試合はありません</div>';
    function spRowTap(row) {
      if (!row) return;
      var a = row.dataset.a, b = row.dataset.b;
      schedulePanel.classList.remove("open");
      showMatchDetail(a, b, row.dataset.date, row.dataset.time, true);
    }
    spBody.onclick = function(e) { spRowTap(e.target.closest(".sp-match")); };
    spBody.ontouchend = function(e) {
      var row = e.target.closest(".sp-match");
      if (row) { e.preventDefault(); spRowTap(row); }
    };
    schedulePanel.classList.add("open");
    hideTooltip();
  }

  function openDateSection(dateStr) {
    if (!drwBody) return;
    drwBody.querySelectorAll('.drw-section').forEach(function(s) { s.classList.remove('open'); });
    var target = drwBody.querySelector('.drw-section[data-date="' + dateStr + '"]');
    if (target) {
      target.classList.add('open');
      setTimeout(function() { target.scrollIntoView({behavior:'smooth', block:'start'}); }, 80);
    }
  }

  function updateActiveDateFlags(dateStr) {
    selectedDate = dateStr;
    var grpBody = document.getElementById('grp-body');
    if (!grpBody) return;
    var dateFlags = {};
    MATCHES.forEach(function(m) {
      if (m.date === dateStr) { dateFlags[m.a] = true; dateFlags[m.b] = true; }
    });
    grpBody.querySelectorAll('.grp-flag').forEach(function(span) {
      var flag = span.dataset.flag;
      span.classList.remove('grp-flag-today', 'grp-flag-active');
      if (dateFlags[flag]) span.classList.add('grp-flag-today');
    });
    updateGroupStadiumIcons(dateStr);
    refreshStadiumList();
  }

  function refreshStadiumList() {
    var rows = document.querySelectorAll('#sdp-body .sdp-row');
    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      var ridx = parseInt(row.dataset.idx, 10);
      if (!dateFilterMode) {
        row.style.display = '';
      } else {
        var rmidxs = stadiumMatches[ridx] || [];
        var hasOnDate = false;
        for (var rk = 0; rk < rmidxs.length; rk++) {
          if (MATCHES[rmidxs[rk]].date === selectedDate) { hasOnDate = true; break; }
        }
        row.style.display = hasOnDate ? '' : 'none';
      }
    }
  }

  function updateGroupStadiumIcons(dateStr) {
    var grpBody = document.getElementById('grp-body');
    if (!grpBody) return;
    var circledOrd = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'];
    var dayMatchList = [];
    for (var di = 0; di < MATCHES.length && di < MATCH_VENUE.length; di++) {
      if (MATCHES[di].date === dateStr) dayMatchList.push({mi: di, time: MATCHES[di].time});
    }
    dayMatchList.sort(function(a, b) { return a.time < b.time ? -1 : (a.time > b.time ? 1 : 0); });
    var timeOrder = {};
    for (var oi = 0; oi < dayMatchList.length; oi++) { timeOrder[dayMatchList[oi].mi] = oi + 1; }
    GROUPS.forEach(function(grp) {
      var btn = grpBody.querySelector('.grp-stadium-btn[data-g="' + grp.g + '"]');
      var infoSpan = grpBody.querySelector('.grp-match-info[data-g="' + grp.g + '"]');
      if (!btn) return;
      var matchIdx = -1;
      var venueIdx = -1;
      for (var i = 0; i < MATCHES.length && i < MATCH_VENUE.length; i++) {
        if (MATCHES[i].date !== dateStr) continue;
        if (grp.f.indexOf(MATCHES[i].a) >= 0 || grp.f.indexOf(MATCHES[i].b) >= 0) {
          matchIdx = i; venueIdx = MATCH_VENUE[i]; break;
        }
      }
      if (matchIdx < 0) {
        btn.classList.remove('active');
        btn.onclick = null;
        if (infoSpan) infoSpan.innerHTML = '';
      } else {
        btn.classList.add('active');
        var ord = timeOrder[matchIdx] || 0;
        var ordStr = ord > 0 && ord <= circledOrd.length ? circledOrd[ord - 1] : '' + ord;
        var sdCtry = wc2026Stadiums[venueIdx] ? wc2026Stadiums[venueIdx].ctry : '';
        if (infoSpan) infoSpan.innerHTML = sdCtry + ' ' + ordStr + ' <span style="font-size:10px;font-family:monospace;color:#58a6ff">' + MATCHES[matchIdx].time + '</span>';
        var capturedVenue = venueIdx;
        var capturedDate = dateStr;
        btn.onclick = function(e) {
          e.stopPropagation();
          showStadiumOnDate(capturedVenue, capturedDate);
        };
      }
    });
  }

  function buildStadiumDateTooltipHtml(venueIdx, dateStr) {
    var sd = wc2026Stadiums[venueIdx];
    var html = '<button class="tt-close">&#10005;</button><span class="tt-flag-lg">&#127967; ' + sd.ctry + '</span><div class="tt-name">' + sd.name + '</div><div class="tt-code">' + sd.city + '</div>';
    var midxs = stadiumMatches[venueIdx] || [];
    var dayMatches = [];
    for (var k = 0; k < midxs.length; k++) {
      if (MATCHES[midxs[k]].date === dateStr) dayMatches.push(MATCHES[midxs[k]]);
    }
    if (dayMatches.length === 0) return buildStadiumTooltipHtml(venueIdx);
    var md = dateStr.slice(5).replace('-', '/');
    html += '<div style="font-size:10px;font-weight:700;color:#f0b429;margin-top:5px">' + md + '</div>';
    for (var j = 0; j < dayMatches.length; j++) {
      var m = dayMatches[j];
      var grpA = flagToGroup[m.a] || '';
      var grpB = flagToGroup[m.b] || '';
      var grpStr = (grpA === grpB && grpA) ? 'グループ ' + grpA : (grpA && grpB ? 'グループ ' + grpA + '/' + grpB : '');
      var nameA = flagToName[m.a] || m.a;
      var nameB = flagToName[m.b] || m.b;
      if (grpStr) html += '<div style="font-size:10px;color:#8b949e">' + grpStr + '</div>';
      html += '<div class="tt-mrow">' + m.a + fc(m.a) + ' ' + nameA + '</div>';
      html += '<div class="tt-mrow">' + m.b + fc(m.b) + ' ' + nameB + '</div>';
      html += '<div class="tt-time">' + m.time + ' UTC</div><div class="tt-time">' + toET(m.time) + '</div><div class="tt-time">' + toJST(m.time) + '</div>';
      if (j < dayMatches.length - 1) html += '<hr style="border:none;border-top:1px solid #30363d;margin:4px 0">';
    }
    return html;
  }

  function showStadiumOnDate(venueIdx, dateStr) {
    hideTooltip();
    activeStadiumIdx = venueIdx;
    var sd = wc2026Stadiums[venueIdx];
    flyTo(sd.lat, sd.lon);
    setStadiumActive(venueIdx);
    setTimeout(function() {
      if (activeStadiumIdx !== venueIdx) return;
      var mel = stadiumMkEls[venueIdx] ? stadiumMkEls[venueIdx].el : null;
      var r = mel ? mel.getBoundingClientRect() : null;
      var cx = r ? r.left + r.width/2 : canvasRect.left + canvasRect.width/2;
      var cy = r ? r.top + r.height/2 : canvasRect.top + 100;
      tooltip.innerHTML = buildStadiumDateTooltipHtml(venueIdx, dateStr);
      positionTooltip(cx, cy);
      tooltip.style.opacity = '1';
    }, 900);
  }

  var matchVenueIdx = {};
  for (var _mvi = 0; _mvi < MATCHES.length && _mvi < MATCH_VENUE.length; _mvi++) {
    var _mk = MATCHES[_mvi].date + '|' + MATCHES[_mvi].a + '|' + MATCHES[_mvi].b;
    matchVenueIdx[_mk] = MATCH_VENUE[_mvi];
  }

  function buildDrawer() {
    if (!drwBody) return;
    var nowMs = Date.now();
    var todayStr = new Date().toISOString().slice(0, 10);
    var upcoming = MATCHES.filter(function(m) { return m.date >= todayStr; }).sort(function(x, y) { return (x.date + x.time) < (y.date + y.time) ? -1 : 1; });
    var past = MATCHES.filter(function(m) { return m.date < todayStr; }).sort(function(x, y) { return (x.date + x.time) < (y.date + y.time) ? -1 : 1; });
    var allM = upcoming.concat(past);
    var dateMap = {};
    var dateOrder = [];
    allM.forEach(function(m) {
      if (!dateMap[m.date]) { dateMap[m.date] = []; dateOrder.push(m.date); }
      dateMap[m.date].push(m);
    });
    var html = "";
    dateOrder.forEach(function(date) {
      var label = date === todayStr ? "TODAY  " + date.slice(5).replace("-","/") : date.slice(5).replace("-","/");
      html += '<div class="drw-section" data-date="' + date + '">';
      html += '<div class="drw-date"><span>' + label + '</span><span class="drw-chevron">&#9660;</span></div>';
      html += '<div class="drw-section-body">';
      dateMap[date].forEach(function(m) {
        var koMs = new Date(m.date + "T" + m.time + ":00Z").getTime();
        var isPast = koMs < nowMs - 110*60000;
        var isLive = !isPast && koMs <= nowMs + 110*60000 && koMs >= nowMs - 110*60000;
        var cls = "drw-row" + (isPast ? " drw-past" : "") + (isLive ? " drw-live" : "");
        var enc_a = m.a.replace(/&/g,"&amp;");
        var enc_b = m.b.replace(/&/g,"&amp;");
        var mk = m.date + '|' + m.a + '|' + m.b;
        var vidx = matchVenueIdx.hasOwnProperty(mk) ? matchVenueIdx[mk] : -1;
        var sd = (vidx >= 0 && wc2026Stadiums[vidx]) ? wc2026Stadiums[vidx] : null;
        var venueHtml = sd ? '<span class="drw-venue">' + sd.ctry + '&#127967;' + sd.name + '</span>' : '';
        html += '<div class="' + cls + '" data-a="' + enc_a + '" data-b="' + enc_b + '" data-date="' + m.date + '" data-time="' + m.time + '" data-vidx="' + vidx + '">';
        html += '<div class="drw-left"><span class="drw-flags">' + fc(m.a) + ' ' + m.a + '  ' + m.b + ' ' + fc(m.b) + '</span>' + venueHtml + '</div>';
        html += '<span class="drw-meta">' + m.date.slice(5).replace("-","/") + '<br>' + m.time + ' UTC<br>' + toET(m.time) + '<br>' + toJST(m.time) + '</span></div>';
      });
      html += '</div></div>';
    });
    drwBody.innerHTML = html;
    var todaySection = drwBody.querySelector('.drw-section[data-date="' + todayStr + '"]');
    if (todaySection) todaySection.classList.add('open');
    function onDrawerRowTap(row) {
      var vidx = parseInt(row.dataset.vidx, 10);
      closeDrawer();
      if (!isNaN(vidx) && vidx >= 0) {
        showStadiumOnDate(vidx, row.dataset.date);
      } else {
        showMatchDetail(row.dataset.a, row.dataset.b, row.dataset.date, row.dataset.time, true);
      }
    }
    drwBody.addEventListener("click", function(e) {
      var hdr = e.target.closest(".drw-date");
      if (hdr) {
        var sec = hdr.closest(".drw-section");
        if (sec) {
          var wasOpen = sec.classList.contains('open');
          drwBody.querySelectorAll('.drw-section').forEach(function(s) { s.classList.remove('open'); });
          if (!wasOpen) sec.classList.add('open');
        }
        return;
      }
      var row = e.target.closest(".drw-row");
      if (!row) return;
      onDrawerRowTap(row);
    });
    drwBody.addEventListener("touchend", function(e) {
      var hdr = e.target.closest(".drw-date");
      if (hdr) { return; }
      var row = e.target.closest(".drw-row");
      if (!row) return;
      e.preventDefault();
      onDrawerRowTap(row);
    });
  }

  var drawerOpenBtn = document.getElementById("drawer-open-btn");
  drawerOpenBtn.addEventListener("click", openDrawer);
  var drwCloseBtn = document.getElementById("drwClose");
  drwCloseBtn.addEventListener("click", closeDrawer);
  drwOverlay.addEventListener("click", closeDrawer);

  var mkEls = [];
  for (var mi = 0; mi < wc2026.length; mi++) {
    var mdata = wc2026[mi];
    var mel = document.createElement("div");
    mel.className = "mk" + (mdata.ball ? " mk-ball" : "") + (ELIMINATED[mdata.flag] ? " elim" : "");
    mel.textContent = mdata.flag;
    mel.style.opacity = "0";
    mel.dataset.name = mdata.name;
    (function(idx) {
      mel.addEventListener("click", function(e) {
        e.stopPropagation();
        var r = mel.getBoundingClientRect();
        showTooltip(idx, r.left + r.width/2, r.top + r.height/2);
      });
      mel.addEventListener("touchend", function(e) {
        e.preventDefault();
        e.stopPropagation();
        var r = mel.getBoundingClientRect();
        showTooltip(idx, r.left + r.width/2, r.top + r.height/2);
      });
    })(mi);
    markersDiv.appendChild(mel);
    mkEls.push({el: mel, pos3d: latLonTo3D(mdata.lat, mdata.lon)});
  }

  canvas.addEventListener("click", function() {
    hideTooltip();
    schedulePanel.classList.remove("open");
    var ball = wc2026[0];
    activeMarkerIdx = 0;
    flyTo(ball.lat, ball.lon);
  });

  var stadiumMkEls = [];
  for (var smi = 0; smi < wc2026Stadiums.length; smi++) {
    var sdata = wc2026Stadiums[smi];
    var smel = document.createElement("div");
    smel.className = "mk";
    smel.textContent = sdata.flag;
    smel.style.opacity = "0";
    smel.dataset.sidx = String(smi);
    (function(sidx) {
      function onStadiumTap(e) {
        e.stopPropagation();
        showStadiumTooltip(sidx);
      }
      smel.addEventListener("click", onStadiumTap);
      smel.addEventListener("touchend", function(e) { e.preventDefault(); onStadiumTap(e); });
    })(smi);
    markersDiv.appendChild(smel);
    stadiumMkEls.push({el: smel, pos3d: latLonTo3D(sdata.lat, sdata.lon)});
  }

  function buildStadiumTooltipHtml(sidx) {
    var sd = wc2026Stadiums[sidx];
    var html = '<button class="tt-close">&#10005;</button><span class="tt-flag-lg">&#127967; ' + sd.ctry + '</span><div class="tt-name">' + sd.name + '</div><div class="tt-code">' + sd.city + '</div>';
    var midxs = stadiumMatches[sidx] || [];
    if (midxs.length > 0) {
      var now2 = Date.now();
      var todayStr3 = new Date().toISOString().slice(0, 10);
      var items = [];
      for (var k = 0; k < midxs.length; k++) {
        var m = MATCHES[midxs[k]];
        var ko = new Date(m.date + 'T' + m.time + ':00Z').getTime();
        items.push({m: m, ko: ko, past: ko <= now2 - 110*60000, isToday: m.date === todayStr3});
      }
      items.sort(function(x, y) { return x.ko - y.ko; });
      var future = items.filter(function(it) { return !it.past; });
      var past2 = items.filter(function(it) { return it.past; });
      var show = future.concat(past2).slice(0, 8);
      for (var k2 = 0; k2 < show.length; k2++) {
        var it = show[k2];
        var md = it.m.date.slice(5).replace('-', '/');
        var grpA = flagToGroup[it.m.a] || '';
        var grpB = flagToGroup[it.m.b] || '';
        var grpStr = (grpA === grpB && grpA) ? 'G-' + grpA : (grpA && grpB ? 'G-' + grpA + '/' + grpB : '');
        var dateGrp = md + (grpStr ? '  ' + grpStr : '');
        var rowCls = 'tt-mrow' + (it.past && !it.isToday ? ' tt-past' : '') + (it.isToday ? ' tt-mrow-today' : '');
        var dateStyle = it.isToday ? 'font-size:10px;color:#58a6ff;font-weight:700' : (it.past ? 'font-size:10px' : 'font-size:10px;color:#f0b429');
        if (it.past && !it.isToday) {
          html += '<div class="' + rowCls + '"><span style="' + dateStyle + '">' + dateGrp + '</span><br>' + it.m.a + fc(it.m.a) + ' vs ' + it.m.b + fc(it.m.b) + '</div>';
        } else {
          html += '<div class="' + rowCls + '"><span style="' + dateStyle + '">' + dateGrp + '</span><br>' + it.m.a + fc(it.m.a) + ' vs ' + it.m.b + fc(it.m.b) + '<span class="tt-time">' + it.m.time + ' UTC</span><span class="tt-time">' + toET(it.m.time) + '</span><span class="tt-time">' + toJST(it.m.time) + '</span></div>';
        }
      }
    }
    return html;
  }

  function showStadiumTooltip(idx) {
    var sd = wc2026Stadiums[idx];
    hideTooltip();
    stadiumTooltipLeftMode = true;
    activeStadiumIdx = idx;
    flyTo(sd.lat, sd.lon);
    setStadiumActive(idx);
    setTimeout(function() {
      if (activeStadiumIdx !== idx) return;
      var mel = stadiumMkEls[idx] ? stadiumMkEls[idx].el : null;
      var r = mel ? mel.getBoundingClientRect() : null;
      var cx = r ? r.left : canvasRect.left + canvasRect.width/2;
      var cy = r ? r.top + r.height/2 : canvasRect.top + 100;
      tooltip.innerHTML = buildStadiumTooltipHtml(idx);
      positionTooltip(cx, cy);
      tooltip.style.opacity = "1";
    }, 900);
  }

  function setStadiumActive(idx) {
    var rows = document.querySelectorAll('.sdp-row');
    for (var ri = 0; ri < rows.length; ri++) {
      rows[ri].classList.toggle('sdp-active', ri === idx);
    }
    if (rows[idx]) rows[idx].scrollIntoView({block:'nearest'});
  }

  var showAllStadiums = false;
  var todayStadiumSet = (function() {
    var s = {};
    var today = new Date().toISOString().slice(0, 10);
    for (var i = 0; i < MATCHES.length && i < MATCH_VENUE.length; i++) {
      if (MATCHES[i].date === today) s[MATCH_VENUE[i]] = true;
    }
    return s;
  })();

  function stadiumVisible(sidx) {
    if (sidx === activeStadiumIdx) return true;
    if (tourActive) return sidx === tourIdx;
    if (showAllStadiums) return true;
    return todayStadiumSet[sidx] === true;
  }

  var tourActive = false;
  var tourIdx = 0;
  var tourTimer = null;

  function stopTour() {
    tourActive = false;
    if (tourTimer) { clearTimeout(tourTimer); tourTimer = null; }
    var tb = document.getElementById('sdpTourBtn');
    if (tb) { tb.textContent = '東から順に自動巡回'; tb.classList.remove('touring'); }
    var btn = document.getElementById('btnStadiumTour');
    if (btn) btn.classList.remove('active');
  }

  function doTourStep() {
    if (!tourActive || tourIdx >= wc2026Stadiums.length) { stopTour(); return; }
    var sd = wc2026Stadiums[tourIdx];
    hideTooltip();
    activeStadiumIdx = tourIdx;
    flyTo(sd.lat, sd.lon);
    setStadiumActive(tourIdx);
    var capturedIdx = tourIdx;
    setTimeout(function() {
      if (!tourActive || tourIdx !== capturedIdx) return;
      var mel = stadiumMkEls[capturedIdx] ? stadiumMkEls[capturedIdx].el : null;
      var r = mel ? mel.getBoundingClientRect() : null;
      var cx = r ? r.left + r.width/2 : canvasRect.left + canvasRect.width/2;
      var cy = r ? r.top + r.height/2 : canvasRect.top + 100;
      tooltip.innerHTML = buildStadiumTooltipHtml(capturedIdx);
      positionTooltip(cx, cy);
      tooltip.style.opacity = "1";
    }, 1800);
    tourTimer = setTimeout(function() {
      if (!tourActive) return;
      hideTooltip();
      tourIdx++;
      doTourStep();
    }, 3600);
  }

  function startTour() {
    if (tourActive) { stopTour(); return; }
    tourActive = true;
    tourIdx = 0;
    var tb = document.getElementById('sdpTourBtn');
    if (tb) { tb.textContent = '巡回停止'; tb.classList.add('touring'); }
    var btn = document.getElementById('btnStadiumTour');
    if (btn) btn.classList.add('active');
    document.getElementById('stadium-panel').classList.add('open');
    doTourStep();
  }

  function buildStadiumPanel() {
    var body = document.getElementById('sdp-body');
    if (!body) return;
    var html = '';
    for (var i = 0; i < wc2026Stadiums.length; i++) {
      var sd = wc2026Stadiums[i];
      var latStr = sd.lat.toFixed(3) + 'N';
      var lonStr = (-sd.lon).toFixed(3) + 'W';
      html += '<div class="sdp-row" data-idx="' + i + '">';
      html += '<span class="sdp-num">' + sd.num + '</span>';
      html += '<span class="sdp-icon">' + sd.ctry + '</span>';
      html += '<div class="sdp-info">';
      html += '<div class="sdp-name">' + sd.name.replace(/&/g,'&amp;') + '</div>';
      html += '<div class="sdp-city">' + sd.city + '</div>';
      html += '<div class="sdp-coord">' + latStr + ' / ' + lonStr + '</div>';
      html += '</div></div>';
    }
    body.innerHTML = html;
    body.addEventListener('click', function(e) {
      var row = e.target.closest('.sdp-row');
      if (!row) return;
      stopTour();
      var idx = parseInt(row.dataset.idx, 10);
      if (dateFilterMode) { showStadiumOnDate(idx, selectedDate); } else { showStadiumTooltip(idx); }
    });
    body.addEventListener('touchend', function(e) {
      var row = e.target.closest('.sdp-row');
      if (!row) return;
      e.preventDefault();
      stopTour();
      var idx = parseInt(row.dataset.idx, 10);
      if (dateFilterMode) { showStadiumOnDate(idx, selectedDate); } else { showStadiumTooltip(idx); }
    });
  }

  var stadiumPanel = document.getElementById('stadium-panel');
  document.getElementById('sdpClose').addEventListener('click', function() {
    stadiumPanel.classList.remove('open');
    stopTour();
  });
  document.getElementById('sdpTourBtn').addEventListener('click', function() {
    if (tourActive) { stopTour(); } else { startTour(); }
  });
  document.getElementById('btnStadiumTour').addEventListener('click', function() {
    stadiumPanel.classList.toggle('open');
    if (!stadiumPanel.classList.contains('open')) stopTour();
  });
  document.getElementById('sdpModeBtn').addEventListener('click', function() {
    showAllStadiums = !showAllStadiums;
    this.innerHTML = showAllStadiums ? '&#127967;' : '&#128193;';
    if (!showAllStadiums && activeStadiumIdx >= 0 && !todayStadiumSet[activeStadiumIdx]) {
      hideTooltip();
    }
  });

  var dateFilterMode = false;
  document.getElementById('sdpDateFilterBtn').addEventListener('click', function() {
    dateFilterMode = !dateFilterMode;
    this.innerHTML = dateFilterMode ? '&#128197;' : '&#128467;';
    refreshStadiumList();
  });
  buildStadiumPanel();

  gl.enable(gl.DEPTH_TEST);

  var startTime = performance.now();
  var frames = 0, lastFps = startTime;

  function frame(now) {
    requestAnimationFrame(frame);
    resize();
    canvasRect = canvas.getBoundingClientRect();
    var W = canvas.width, H = canvas.height;
    if (W === 0 || H === 0) return;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0.02, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var t = (now - startTime) * 0.001;
    zoom += (zoomTarget - zoom) * 0.15;
    var spd = parseFloat(rotSpdEl.value);
    if (flyTarget !== null) {
      var fp = Math.min((now - flyStart) / FLY_DUR, 1);
      var fe = fp * fp * (3 - 2 * fp);
      rotYv = flyFrom.ry + (flyTarget.ry - flyFrom.ry) * fe;
      rotXv = flyFrom.rx + (flyTarget.rx - flyFrom.rx) * fe;
      if (fp >= 1) flyTarget = null;
    } else {
      if (autoRot) rotYv += 0.003 * spd;
      var wasSpinning = Math.abs(momentumY) > 0.0002 || Math.abs(momentumX) > 0.0002;
      if (Math.abs(momentumY) > 0.0002) { rotYv += momentumY; momentumY *= MOMENTUM_DECAY; } else { momentumY = 0; }
      if (!axisLocked && Math.abs(momentumX) > 0.0002) { rotXv = clampElev(rotXv + momentumX); momentumX *= MOMENTUM_DECAY; } else { momentumX = 0; }
      if (axisLocked) rotXv = 0;
      var nowSpinning = Math.abs(momentumY) > 0.0002 || Math.abs(momentumX) > 0.0002;
      if (wasSpinning && !nowSpinning && !autoRot) {
        var bestIdx = -1, bestMz = -1;
        for (var si = 0; si < wc2026.length; si++) {
          if (wc2026[si].ball) continue;
          var sp = mkEls[si] ? mkEls[si].pos3d : null;
          if (!sp) continue;
          var smz = model[2]*sp[0] + model[6]*sp[1] + model[10]*sp[2];
          if (smz > bestMz) { bestMz = smz; bestIdx = si; }
        }
        if (bestIdx >= 0) {
          var bd = wc2026[bestIdx];
          tooltip.innerHTML = buildAllMatchesHtml(bd.flag, bd.name);
          activeMarkerIdx = bestIdx;
          flyTo(bd.lat, bd.lon);
        }
      }
    }

    persp(proj, Math.PI / 4, W / H, 0.1, 100);
    trans(view, 0, 0, -zoom);
    rotY(ry, rotYv); rotZ(tz, axialTilt); rotX(rx, rotXv);
    mul(tmp2, tz, ry);
    mul(model, rx, tmp2);
    mul(tmp, view, model);
    mul(mvp, proj, tmp);

    var sd = getSunDir();
    gl.uniform3f(uLight, sd[0], sd[1], sd[2]);
    gl.uniform1f(uNightL, nightMode ? 1.0 : 0.0);
    gl.uniformMatrix4fv(uMVP,   false, mvp);
    gl.uniformMatrix4fv(uModel, false, model);

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texEarth);
    gl.drawElements(gl.TRIANGLES, idxs.length, gl.UNSIGNED_SHORT, 0);

    for (var mi = 0; mi < mkEls.length; mi++) {
      var mk = mkEls[mi];
      mk.el.style.display = "";
      var mp = mk.pos3d;
      var mz = model[2]*mp[0] + model[6]*mp[1] + model[10]*mp[2];
      if (mz > 0.12) {
        var mcx = mvp[0]*mp[0] + mvp[4]*mp[1] + mvp[8]*mp[2]  + mvp[12];
        var mcy = mvp[1]*mp[0] + mvp[5]*mp[1] + mvp[9]*mp[2]  + mvp[13];
        var mcw = mvp[3]*mp[0] + mvp[7]*mp[1] + mvp[11]*mp[2] + mvp[15];
        if (mcw > 0) {
          var px = (mcx/mcw+1)*0.5*W;
          var py = (1-mcy/mcw)*0.5*H;
          mk.el.style.left = px + "px";
          mk.el.style.top  = py + "px";
          mk.el.style.opacity = "1";
          if (mi === activeMarkerIdx) {
            positionTooltip(canvasRect.left + px, canvasRect.top + py);
            tooltip.style.opacity = "1";
          }
        } else {
          mk.el.style.opacity = "0";
          if (mi === activeMarkerIdx) hideTooltip();
        }
      } else {
        mk.el.style.opacity = "0";
        if (mi === activeMarkerIdx) hideTooltip();
      }
    }
    for (var smi2 = 0; smi2 < stadiumMkEls.length; smi2++) {
      var smk = stadiumMkEls[smi2];
      if (!stadiumVisible(smi2)) {
        smk.el.style.opacity = "0";
        if (smi2 === activeStadiumIdx) hideTooltip();
        continue;
      }
      var smp = smk.pos3d;
      var smz = model[2]*smp[0] + model[6]*smp[1] + model[10]*smp[2];
      if (smz > 0.12) {
        var smcx = mvp[0]*smp[0] + mvp[4]*smp[1] + mvp[8]*smp[2]  + mvp[12];
        var smcy = mvp[1]*smp[0] + mvp[5]*smp[1] + mvp[9]*smp[2]  + mvp[13];
        var smcw = mvp[3]*smp[0] + mvp[7]*smp[1] + mvp[11]*smp[2] + mvp[15];
        if (smcw > 0) {
          var spx = (smcx/smcw+1)*0.5*W;
          var spy = (1-smcy/smcw)*0.5*H;
          smk.el.style.left = spx + "px";
          smk.el.style.top  = spy + "px";
          smk.el.style.opacity = "1";
          if (smi2 === activeStadiumIdx) {
            var ttx, tty;
            if (stadiumTooltipLeftMode) {
              var MK_HALF_W = 11;
              ttx = canvasRect.left + spx - MK_HALF_W;
              tty = canvasRect.top + spy;
            } else {
              ttx = canvasRect.left + spx;
              tty = canvasRect.top + spy;
            }
            positionTooltip(ttx, tty);
            tooltip.style.opacity = "1";
          }
        } else {
          smk.el.style.opacity = "0";
          if (smi2 === activeStadiumIdx) hideTooltip();
        }
      } else {
        smk.el.style.opacity = "0";
        if (smi2 === activeStadiumIdx) hideTooltip();
      }
    }

    for (var cmi2 = 0; cmi2 < costMkEls.length; cmi2++) {
      var cmk = costMkEls[cmi2];
      if (cmi2 !== activeCostMkIdx) { cmk.el.style.opacity = "0"; continue; }
      var cmp = cmk.pos3d;
      var cmz = model[2]*cmp[0] + model[6]*cmp[1] + model[10]*cmp[2];
      if (cmz > 0.12) {
        var cmcx = mvp[0]*cmp[0] + mvp[4]*cmp[1] + mvp[8]*cmp[2]  + mvp[12];
        var cmcy = mvp[1]*cmp[0] + mvp[5]*cmp[1] + mvp[9]*cmp[2]  + mvp[13];
        var cmcw = mvp[3]*cmp[0] + mvp[7]*cmp[1] + mvp[11]*cmp[2] + mvp[15];
        if (cmcw > 0) {
          var cpx = (cmcx/cmcw+1)*0.5*W;
          var cpy = (1-cmcy/cmcw)*0.5*H;
          cmk.el.style.left = cpx + "px";
          cmk.el.style.top  = cpy + "px";
          cmk.el.style.opacity = "1";
        } else { cmk.el.style.opacity = "0"; }
      } else { cmk.el.style.opacity = "0"; }
    }

    frames++;
    var dt = now - lastFps;
    if (dt >= 600) {
      var fps = Math.round(frames * 1000 / dt);
      var clock = new Date();
      var utcH = clock.getUTCHours() + clock.getUTCMinutes() / 60;
      var sunLonDeg = Math.round((12 - utcH) * 15);
      var ew = sunLonDeg >= 0 ? "E" : "W";
      var label = earthImg.complete && earthImg.naturalWidth > 0 ? "" : "テクスチャ読込中 | ";
      hud.textContent = label + "FPS: " + fps + "  |  太陽: " + Math.abs(sunLonDeg) + "°" + ew + "  |  " + (autoRot ? "自動回転 ON" : "自動回転 OFF");
      frames = 0; lastFps = now;
    }
  }
  var nightMode = false;
  var btnNight = document.getElementById('btnNight');
  btnNight.addEventListener('click', function() {
    nightMode = !nightMode;
    if (nightMode) {
      btnNight.classList.add('active');
      btnNight.textContent = '☀ 夜景 ON';
    } else {
      btnNight.classList.remove('active');
      btnNight.textContent = '🌙 夜景';
    }
  });

  var searchActive = false;
  var btnSearch = document.getElementById('btnSearch');
  var searchOverlay = document.getElementById('search-overlay');
  var searchInput = document.getElementById('search-input');
  var searchResultsEl = document.getElementById('search-results');
  var _lastResults = [];

  function openSearch() {
    searchActive = true;
    searchOverlay.style.zIndex = String(getNextZ());
    searchOverlay.classList.add('open');
    btnSearch.classList.add('active');
    searchInput.value = '';
    searchResultsEl.innerHTML = '';
    setTimeout(function() { searchInput.focus(); }, 50);
  }
  function closeSearch() {
    searchActive = false;
    searchOverlay.classList.remove('open');
    btnSearch.classList.remove('active');
  }

  function renderSearchResults(q) {
    var lq = q.toLowerCase();
    if (!lq) { searchResultsEl.innerHTML = ''; _lastResults = []; return; }
    var results = [];
    for (var i = 0; i < wc2026.length; i++) {
      var d = wc2026[i];
      if (d.ball) continue;
      if (d.name.toLowerCase().indexOf(lq) >= 0) {
        results.push({type:'country', idx:i, flag:d.flag, label:d.name, lat:d.lat, lon:d.lon});
      }
    }
    for (var j = 0; j < wc2026Stadiums.length; j++) {
      var s = wc2026Stadiums[j];
      if (s.name.toLowerCase().indexOf(lq) >= 0 || s.city.toLowerCase().indexOf(lq) >= 0) {
        results.push({type:'stadium', idx:j, flag:s.ctry, label:s.name + ' — ' + s.city, lat:s.lat, lon:s.lon});
      }
    }
    _lastResults = results;
    if (results.length === 0) {
      searchResultsEl.innerHTML = '<div class="srch-item" style="color:#8b949e">見つかりません</div>';
      return;
    }
    var html = '';
    for (var k = 0; k < results.length && k < 10; k++) {
      var r = results[k];
      html += '<div class="srch-item" data-k="' + k + '">' + r.flag + ' <span>' + r.label + '</span> <span class="srch-item-type">' + (r.type === 'stadium' ? '会場' : '国') + '</span></div>';
    }
    searchResultsEl.innerHTML = html;
  }

  searchResultsEl.addEventListener('click', function(e) {
    var item = e.target.closest('.srch-item');
    if (!item || item.dataset.k === undefined) return;
    var ki = parseInt(item.dataset.k, 10);
    var res = _lastResults[ki];
    if (!res) return;
    closeSearch();
    if (res.type === 'stadium') {
      showStadiumTooltip(res.idx);
    } else {
      hideTooltip();
      flyTo(res.lat, res.lon);
      var fidx = res.idx;
      setTimeout(function() {
        var mkEl = document.querySelectorAll('.mk')[fidx];
        var cx = mkEl ? mkEl.getBoundingClientRect().left + mkEl.getBoundingClientRect().width/2 : canvasRect.left + canvasRect.width/2;
        var cy = mkEl ? mkEl.getBoundingClientRect().top + mkEl.getBoundingClientRect().height/2 : canvasRect.top + canvasRect.height/2;
        tooltip.innerHTML = buildAllMatchesHtml(wc2026[fidx].flag, wc2026[fidx].name);
        positionTooltip(cx, cy);
        tooltip.style.opacity = '1';
        activeMarkerIdx = fidx;
      }, 900);
    }
  });
  searchInput.addEventListener('input', function() { renderSearchResults(searchInput.value); });
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeSearch();
  });
  btnSearch.addEventListener('click', function() {
    if (searchActive) closeSearch(); else openSearch();
  });
  searchOverlay.addEventListener('click', function(e) {
    if (e.target === searchOverlay) closeSearch();
  });

  var costStadiums = [
    {rank:1,  name:"SoFi Stadium",              cost:"$5.1B", ctry:"&#127482;&#127480; USA &middot; W杯2026",   lat:33.954, lon:-118.339},
    {rank:2,  name:"MetLife Stadium",            cost:"$1.5B", ctry:"&#127482;&#127480; USA &middot; 2026決勝",  lat:40.814, lon:-74.074},
    {rank:3,  name:"Mercedes-Benz Stadium",      cost:"$1.5B", ctry:"&#127482;&#127480; USA &middot; W杯2026",   lat:33.755, lon:-84.401},
    {rank:4,  name:"Saint Petersburg Stadium",   cost:"$1.3B", ctry:"&#127479;&#127482; Russia &middot; W杯2018",lat:59.972, lon:30.221},
    {rank:5,  name:"AT&amp;T Stadium",           cost:"$1.2B", ctry:"&#127482;&#127480; USA &middot; W杯2026",   lat:32.748, lon:-97.093},
    {rank:6,  name:"Levi&#39;s Stadium",         cost:"$1.2B", ctry:"&#127482;&#127480; USA &middot; W杯2026",   lat:37.403, lon:-121.970},
    {rank:7,  name:"Al Bayt Stadium",            cost:"$780M", ctry:"&#127478;&#127462; Qatar &middot; W杯2022", lat:25.667, lon:51.490},
    {rank:8,  name:"Mané Garrincha Stadium",cost:"$760M", ctry:"&#127463;&#127479; Brazil &middot; W杯2014",lat:-15.783, lon:-47.899},
    {rank:9,  name:"Lusail Stadium",             cost:"$710M", ctry:"&#127478;&#127462; Qatar &middot; W杯2022", lat:25.428, lon:51.489},
    {rank:10, name:"Cape Town Stadium",          cost:"$540M", ctry:"&#127487;&#127462; South Africa &middot; W杯2010",lat:-33.904, lon:18.411}
  ];
  var activeCostMkIdx = -1;
  var costMkEls = [];
  for (var cmi = 0; cmi < costStadiums.length; cmi++) {
    var cmel = document.createElement("div");
    cmel.className = "mk";
    cmel.textContent = "🏟️";
    cmel.style.opacity = "0";
    markersDiv.appendChild(cmel);
    costMkEls.push({el: cmel, pos3d: latLonTo3D(costStadiums[cmi].lat, costStadiums[cmi].lon)});
  }
  var costTourActive = false;
  var costTourIdx = 0;
  var costTourTimer = null;
  function setCostRowActive(idx) {
    activeCostMkIdx = idx;
    var rows = document.querySelectorAll('.cost-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('cost-active', parseInt(rows[i].dataset.cidx, 10) === idx);
    }
    if (idx >= 0) {
      var activeRow = document.querySelector('.cost-row[data-cidx="' + idx + '"]');
      if (activeRow) activeRow.scrollIntoView({block:'nearest', behavior:'smooth'});
    }
  }
  function stopCostTour() {
    activeCostMkIdx = -1;
    costTourActive = false;
    if (costTourTimer) { clearTimeout(costTourTimer); costTourTimer = null; }
    hideTooltip();
    var btn = document.getElementById('costTourBtn');
    if (btn) { btn.innerHTML = '&#127968; 建設費順に自動巡回'; btn.classList.remove('touring'); }
    setCostRowActive(-1);
  }
  function doCostTourStep() {
    if (!costTourActive || costTourIdx >= costStadiums.length) { stopCostTour(); return; }
    var sd = costStadiums[costTourIdx];
    var capturedIdx = costTourIdx;
    hideTooltip();
    zoomTarget = 3.2;
    flyTo(sd.lat, sd.lon);
    setCostRowActive(capturedIdx);
    costTourTimer = setTimeout(function() {
      if (!costTourActive || costTourIdx !== capturedIdx) return;
      var cmk = costMkEls[capturedIdx];
      var cx = canvasRect.left + canvasRect.width / 2;
      var cy = canvasRect.top + canvasRect.height / 2;
      if (cmk && parseFloat(cmk.el.style.opacity) > 0.5) {
        var r = cmk.el.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
      }
      tooltip.innerHTML = '<div class="tt-stadium">&#127967; #' + sd.rank + ' ' + sd.name + '</div>'
        + '<div class="tt-city">' + sd.ctry + '</div>'
        + '<div style="color:#3fb950;font-weight:700;font-size:14px;margin-top:6px">' + sd.cost + '</div>';
      positionTooltip(cx, cy);
      tooltip.style.opacity = '1';
      costTourTimer = setTimeout(function() {
        if (!costTourActive) return;
        hideTooltip();
        costTourIdx++;
        doCostTourStep();
      }, 3000);
    }, 900);
  }
  function startCostTour() {
    if (costTourActive) { stopCostTour(); return; }
    stopTour();
    costTourActive = true;
    costTourIdx = 0;
    var btn = document.getElementById('costTourBtn');
    if (btn) { btn.innerHTML = '&#9646;&#9646; 巡回停止'; btn.classList.add('touring'); }
    doCostTourStep();
  }
  document.getElementById('costTourBtn').addEventListener('click', function() {
    if (costTourActive) { stopCostTour(); } else { startCostTour(); }
  });
  document.querySelectorAll('.cost-row').forEach(function(row) {
    row.style.cursor = 'pointer';
    row.addEventListener('click', function() {
      var idx = parseInt(row.dataset.cidx, 10);
      if (!isNaN(idx) && costStadiums[idx]) {
        stopCostTour();
        flyTo(costStadiums[idx].lat, costStadiums[idx].lon);
        setCostRowActive(idx);
      }
    });
  });

  buildCalendar();
  buildDrawerCalendar();
  buildGroupsPanel();
  requestAnimationFrame(frame);
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
