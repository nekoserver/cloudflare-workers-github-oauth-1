import { DEFAULT_AICHAT_MODELS } from './aichat';

export function getApisPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>API テスター</title>
<style>
:root{
  --bg:#f6f8fa;--surface:#fff;--border:#d0d7de;--text:#1f2328;--muted:#656d76;
  --link:#0969da;--nav-h:40px;--radius:6px;--hl:#fff8e1;
  --get:#1a7f37;--get-bg:#dafbe1;--post:#0969da;--post-bg:#ddf4ff;
  --put:#9a6700;--put-bg:#fff8c5;--delete:#cf222e;--delete-bg:#ffebe9;
  --patch:#6639ba;--patch-bg:#fbefff;--hl:#ddf4ff;
  --query:#116329;--query-bg:#d3f2dd;
  --search-hl:#ffe066;--search-hl-text:#1f2328;
}
@media(prefers-color-scheme:dark){
  :root{--bg:#0d1117;--surface:#161b22;--border:#30363d;--text:#e6edf3;--muted:#8b949e;
  --link:#58a6ff;--hl:#0c2d6b;
  --get:#3fb950;--get-bg:#0f2b18;--post:#58a6ff;--post-bg:#0c2d6b;
  --put:#e3b341;--put-bg:#2d1f00;--delete:#f85149;--delete-bg:#300a0a;
  --patch:#bc8cff;--patch-bg:#1d0f33;--query:#56d364;--query-bg:#0d2818;--search-hl:#6b5000;--search-hl-text:#e6edf3;}
}
*{box-sizing:border-box;margin:0;padding:0;}
body{display:flex;flex-direction:column;height:100vh;height:100dvh;overflow:hidden;background:var(--bg);color:var(--text);font:13px/1.5 system-ui,sans-serif;}

/* ── top nav ── */
#topnav{
  height:var(--nav-h);min-height:var(--nav-h);flex-shrink:0;
  background:var(--surface);border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:1px;padding:0 8px;overflow-x:auto;
  scrollbar-width:none;
}
#topnav::-webkit-scrollbar{display:none;}
.nav-home{
  display:flex;align-items:center;gap:6px;flex-shrink:0;padding-right:8px;margin-right:5px;
  border-right:1px solid var(--border);color:var(--text);font-size:12px;font-weight:700;
}
.nav-home-count{padding:1px 5px;border-radius:999px;background:var(--bg);color:var(--muted);font-size:10px;font-weight:600;}
.workflow-browser-link{
  display:inline-flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;
  margin-left:auto;padding:3px 8px;border:1px solid var(--border);border-radius:4px;
  color:var(--link);background:var(--surface);font-size:11px;font-weight:600;text-decoration:none;
}
.workflow-browser-link:hover{background:var(--bg);border-color:var(--link);}
.nav-btn{
  white-space:nowrap;padding:3px 9px;border-radius:4px;border:none;
  font-size:11px;font-weight:600;cursor:pointer;background:none;color:var(--muted);
  transition:background .1s,color .1s;flex-shrink:0;
}
.nav-btn:hover{background:var(--bg);color:var(--text);}
.nav-btn.active{background:var(--link);color:#fff;}
.nav-btn.has-match{background:none;color:var(--link);box-shadow:inset 0 0 0 1.5px var(--link);}
.nav-btn.active.has-match{background:var(--link);color:#fff;box-shadow:none;}
.nav-btn.nav-flash{box-shadow:inset 0 0 0 2px #e8833a;color:#e8833a;}

/* ── body row ── */
#body-row{display:flex;flex:1;overflow:hidden;position:relative;}

/* ── sidebar ── */
#sidebar{
  width:220px;min-width:220px;border-right:1px solid var(--border);
  overflow:hidden;background:var(--surface);display:flex;flex-direction:column;
}
#sidebar-search{padding:7px 8px;border-bottom:1px solid var(--border);flex-shrink:0;}
#sidebar-search-row{display:flex;align-items:center;gap:4px;}
#search-input-wrap{position:relative;flex:1;min-width:0;}
#search-input{width:100%;padding:4px 22px 4px 8px;border:1px solid var(--border);border-radius:var(--radius);
  background:var(--bg);color:var(--text);font-size:11px;box-sizing:border-box;}
#search-clear-btn{position:absolute;right:4px;top:50%;transform:translateY(-50%);display:none;background:none;border:none;cursor:pointer;font-size:12px;color:var(--muted);padding:0;line-height:1;}
#search-save-btn,#search-history-btn{
  flex-shrink:0;background:none;border:none;cursor:pointer;
  font-size:14px;padding:2px 3px;line-height:1;border-radius:3px;
  transition:background .1s;
}
#search-save-btn{visibility:hidden;position:absolute;}
#search-history-btn{visibility:visible;}
#search-save-btn:hover,#search-history-btn:hover{background:var(--bg);}
#search-btn-wrap{position:relative;flex-shrink:0;width:22px;height:22px;display:flex;align-items:center;justify-content:center;}
.hist-row{position:relative;overflow:hidden;border-bottom:1px solid var(--border);}
.hist-row-inner{display:grid;grid-template-columns:1fr auto auto auto;align-items:center;gap:0;background:var(--surface);position:relative;z-index:1;transition:transform 0.2s ease;will-change:transform;cursor:pointer;}
.hist-row-inner:hover{background:var(--bg);}
.hist-row-kw{padding:6px 8px;color:var(--link);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.hist-row-cnt{padding:6px 8px;text-align:right;font-size:12px;color:var(--text);}
.hist-row-sec{padding:6px 8px;text-align:right;font-size:12px;color:var(--text);}
.hist-row-dt{padding:6px 8px;text-align:right;font-size:11px;color:var(--muted);}
.hist-row-del{position:absolute;right:0;top:0;bottom:0;width:68px;background:#e53e3e;color:#fff;border:none;font-size:12px;font-weight:700;cursor:pointer;z-index:0;display:flex;align-items:center;justify-content:center;opacity:0;}
.hist-row.swipe-open .hist-row-del{opacity:1;}
.hist-row-del:active{background:#c53030;}
#search-save-modal-overlay{
  display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;
  align-items:center;justify-content:center;
}
#search-save-modal-overlay.open{display:flex;}
#search-save-modal{
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:20px 24px;min-width:300px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.18);
}
#search-save-modal h3{margin:0 0 14px;font-size:14px;color:var(--text);}
#search-save-modal input{
  width:100%;box-sizing:border-box;padding:6px 10px;font-size:13px;
  border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);
  margin-bottom:12px;
}
#search-save-stats{font-size:12px;color:var(--muted);margin-bottom:16px;line-height:1.7;}
#search-save-modal-btns{display:flex;gap:8px;justify-content:flex-end;}
#search-save-modal-btns button{
  padding:6px 16px;font-size:12px;border-radius:var(--radius);cursor:pointer;border:none;
}
#search-save-cancel{background:var(--bg);color:var(--text);border:1px solid var(--border) !important;}
#search-save-submit{background:var(--link);color:#fff;}
#groups{flex:1;overflow-y:auto;}
.group-block{border-bottom:1px solid var(--border);}
.group-label{
  padding:6px 8px 6px 10px;font-size:11px;font-weight:700;color:var(--muted);
  text-transform:uppercase;letter-spacing:.4px;display:flex;align-items:center;
  position:sticky;top:0;z-index:1;background:var(--surface);
}
.group-label-text{flex:1;cursor:pointer;user-select:none;padding-right:4px;}
/* 折りたたみ三角 (左側) */
.toggle-arrow{font-size:9px;margin-right:5px;transition:transform .15s;display:inline-block;}
.group-label.collapsed .toggle-arrow{transform:rotate(-90deg);}
/* 説明パネル展開ボタン (右端) */
.expand-btn{
  font-size:11px;cursor:pointer;padding:2px 5px;border-radius:3px;
  color:var(--muted);background:none;border:none;flex-shrink:0;
  transition:background .1s,color .1s;
}
.expand-btn:hover{background:var(--border);color:var(--text);}
.expand-btn.open{color:#fff !important;background:var(--link) !important;}

.group-endpoints{}
.ep-item{
  display:flex;align-items:center;gap:5px;padding:4px 8px 4px 12px;
  cursor:pointer;border-left:3px solid transparent;overflow:hidden;
}
.ep-item:hover{background:var(--bg);}
.ep-item.active{background:var(--bg);border-left-color:var(--link);}
.badge{
  font-size:10px;font-weight:700;padding:1px 4px;border-radius:3px;
  min-width:42px;text-align:center;flex-shrink:0;
}
.badge-GET{background:var(--get-bg);color:var(--get);}
.badge-POST{background:var(--post-bg);color:var(--post);}
.badge-PUT{background:var(--put-bg);color:var(--put);}
.badge-DELETE{background:var(--delete-bg);color:var(--delete);}
.badge-PATCH{background:var(--patch-bg);color:var(--patch);}
.badge-QUERY{background:var(--query-bg);color:var(--query);}
.ep-path{
  font-size:11px;color:var(--text);flex:1;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  direction:rtl;text-align:left;
}
mark.hl-match{
  background:var(--search-hl);color:var(--search-hl-text);
  border-radius:2px;padding:0 1px;font-style:normal;font-weight:700;
}

/* ── desc panel (絶対位置フロートパネル) ── */
#desc-panel{
  position:absolute;left:220px;top:0;z-index:5;
  width:0;overflow:hidden;
  background:var(--surface);border:1px solid var(--border);
  box-shadow:2px 4px 12px rgba(0,0,0,.12);border-radius:0 var(--radius) var(--radius) 0;
  transition:width .2s;
  display:flex;flex-direction:column;
  max-height:100%;
}
#desc-panel.open{width:220px;}
#desc-panel-header{
  padding:6px 8px 6px 10px;font-size:11px;font-weight:700;color:var(--muted);
  text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;flex-shrink:0;
}
#desc-panel-close{cursor:pointer;font-size:14px;color:var(--muted);background:none;border:none;line-height:1;padding:0 2px;}
#desc-panel-close:hover{color:var(--text);}
#desc-panel-list{overflow-y:auto;flex:1;}
.desc-item{
  display:flex;align-items:center;gap:5px;padding:4px 8px 4px 12px;
  border-bottom:1px solid var(--border);cursor:pointer;overflow:hidden;
}
.desc-item:hover{background:var(--bg);}
.desc-item:last-child{border-bottom:none;}
.desc-text{font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left;}

/* ── main ── */
#main{flex:1;overflow-y:auto;display:flex;flex-direction:column;}
#welcome{display:flex;align-items:center;justify-content:center;flex:1;color:var(--muted);font-size:14px;}
#detail{display:none;flex-direction:column;padding:20px 24px;gap:14px;max-width:820px;width:100%;}
.ep-header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.ep-title{font-size:15px;font-weight:600;font-family:monospace;word-break:break-all;}
.ep-desc{color:var(--muted);font-size:13px;}
.section-title{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;}
.param-table{width:100%;border-collapse:collapse;font-size:12px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;}
.param-table th{background:var(--bg);text-align:left;padding:5px 10px;border-bottom:1px solid var(--border);font-weight:600;}
.param-table td{padding:4px 8px;border-bottom:1px solid var(--border);}
.param-table tr:last-child td{border-bottom:none;}
.param-table input{width:100%;padding:3px 7px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font-size:12px;}
.req-badge{background:var(--delete-bg);color:var(--delete);font-size:10px;padding:1px 4px;border-radius:3px;font-weight:600;}
.body-area{font-family:monospace;font-size:12px;width:100%;min-height:110px;padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text);resize:vertical;}
.model-select{width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text);font-size:12px;cursor:pointer;}
.send-btn{background:var(--link);color:#fff;border:none;border-radius:var(--radius);padding:6px 16px;font-size:13px;font-weight:600;cursor:pointer;}
.send-btn:hover{opacity:.85;}
.send-btn:disabled{opacity:.5;cursor:not-allowed;}
.response-box{border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;}
.res-header{display:flex;align-items:center;gap:10px;padding:6px 12px;background:var(--bg);border-bottom:1px solid var(--border);font-size:12px;}
.status-ok{color:var(--get);font-weight:700;}
.status-err{color:var(--delete);font-weight:700;}
.res-body{font-family:monospace;font-size:12px;padding:12px;white-space:pre-wrap;word-break:break-all;max-height:360px;overflow-y:auto;background:var(--surface);}
.example-code{font-family:monospace;font-size:11px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:9px 11px;overflow-x:auto;white-space:pre;margin:0;line-height:1.55;}
.req-note-list{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px;}
.req-note{font-size:10px;padding:1px 6px;border-radius:3px;font-weight:600;}
.req-note-auth{background:#ddf4ff;color:#0969da;}
.req-note-null{background:#ffebe9;color:#cf222e;}
.type-badge{color:var(--muted);font-size:10px;font-weight:normal;}
</style>
</head>
<body>

<div id="topnav" aria-label="APIカテゴリーナビゲーション"></div>

<div id="body-row">
  <div id="sidebar">
    <div id="sidebar-search">
      <div id="sidebar-search-row">
        <span id="search-input-wrap">
          <input id="search-input" placeholder="エンドポイントを検索…" oninput="filterEndpoints(this.value)">
          <button id="search-clear-btn" title="クリア" onclick="clearSearchInput()">✕</button>
        </span>
        <span id="search-btn-wrap">
          <button id="search-save-btn" title="検索キーワードを登録" onclick="openSearchSaveModal()">✍️</button>
          <button id="search-history-btn" title="登録キーワード履歴" onclick="openSearchHistoryModal()">🗒️</button>
        </span>
      </div>
    </div>
    <div id="groups"></div>
  </div>

  <div id="desc-panel">
    <div id="desc-panel-header">
      <span id="desc-panel-title"></span>
      <button id="desc-panel-close" onclick="closeDescPanel()">✕</button>
    </div>
    <div id="desc-panel-list"></div>
  </div>

  <div id="main">
    <div id="welcome">← エンドポイントを選択してください</div>
    <div id="detail">
      <div class="ep-header">
        <span class="badge" id="d-badge"></span>
        <span class="ep-title" id="d-path"></span>
      </div>
      <div class="ep-desc" id="d-desc"></div>
      <div id="path-params-sec" style="display:none">
        <div class="section-title">パスパラメータ</div>
        <table class="param-table"><thead><tr><th>名前</th><th>値</th></tr></thead><tbody id="path-params-body"></tbody></table>
      </div>
      <div id="query-params-sec" style="display:none">
        <div class="section-title">クエリパラメータ</div>
        <table class="param-table"><thead><tr><th>名前</th><th style="width:60px">必須</th><th>値</th></tr></thead><tbody id="query-params-body"></tbody></table>
      </div>
      <div id="model-select-sec" style="display:none">
        <div class="section-title">モデル選択</div>
        <select id="model-select-dropdown" class="model-select" onchange="onModelSelectChange(this.value)"></select>
      </div>
      <div id="body-sec" style="display:none">
        <div class="section-title">リクエストボディ (JSON)</div>
        <textarea class="body-area" id="body-area" spellcheck="false"></textarea>
      </div>
      <div id="req-example-sec" style="display:none">
        <div class="section-title">リクエスト例</div>
        <div id="req-note-list" class="req-note-list"></div>
        <pre id="req-example-code" class="example-code"></pre>
      </div>
      <div id="res-example-sec" style="display:none">
        <div class="section-title">レスポンス例</div>
        <pre id="res-example-code" class="example-code"></pre>
      </div>
      <div><button class="send-btn" id="send-btn" onclick="sendRequest()">送信</button></div>
      <div id="response-sec" style="display:none">
        <div class="section-title">レスポンス</div>
        <div class="response-box">
          <div class="res-header">
            <span id="res-status"></span>
            <span id="res-time" style="color:var(--muted)"></span>
          </div>
          <div class="res-body" id="res-body"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
const APIS = [
  { group: 'AI チャット', endpoints: [
    { method:'POST', path:'/api/aichat', desc:'AI にメッセージを送信（message が "/neko" で始まるサブコマンドの場合はAIを呼ばずローカルで応答する。一覧は "/neko help" で確認可能）',
      modelSelect:${JSON.stringify(DEFAULT_AICHAT_MODELS)},
      body:[{n:'message',req:true,s:'Cloudflare Workersについて教えてください'},{n:'model',s:${JSON.stringify(DEFAULT_AICHAT_MODELS[0]?.value ?? '')}},{n:'systemPromptMode',s:'a'}],
      res:{response:'Cloudflare Workers はエッジで動くサーバーレス実行環境です。',usedModel:'@cf/google/gemma-4-26b-a4b-it',systemPromptMode:'a',input_tokens:20,output_tokens:80,total_tokens:100,shareId:'a1b2c3d4',userHash:'e5f6a7b8'} },
    { method:'GET',  path:'/api/aichat/shares/search', desc:'AIチャット全文検索', query:[{n:'q',req:true,s:'cloudflare'}],
      res:{results:[{id:'a1b2c3d4',question:'Cloudflare Workersとは？',answer_preview:'エッジで動くサーバーレス実行環境です。',model:'@cf/google/gemma-4-26b-a4b-it',created_at:'2026-06-15T00:00:00.000Z'}],total:1} },
    { method:'GET',  path:'/api/aichat/shares/calendar', desc:'月別カレンダー', query:[{n:'month',s:'2026-06'}],
      res:{month:'2026-06',days:[{date:'2026-06-15',count:3}]} },
    { method:'GET',  path:'/api/aichat/daily-stats', desc:'日別統計（キーワード・モデル）', query:[{n:'month',s:'2026-06'}],
      res:{stats:[{date:'2026-06-15',keyword_count:5,model_count:2}]} },
    { method:'GET',  path:'/api/aichat/shares/by-date', desc:'日付別共有一覧', query:[{n:'date',req:true,s:'2026-06-15'}],
      res:{shares:[{id:'a1b2c3d4',question:'Cloudflare Workersとは？',model:'@cf/google/gemma-4-26b-a4b-it',created_at:'2026-06-15T00:00:00.000Z'}]} },
    { method:'GET',  path:'/api/aichat/shares/by-keyword', desc:'キーワード一致共有一覧', query:[{n:'keyword',req:true,s:'cloudflare'}],
      res:{shares:[{id:'a1b2c3d4',question:'Cloudflare Workersとは？',model:'@cf/google/gemma-4-26b-a4b-it',created_at:'2026-06-15T00:00:00.000Z'}]} },
    { method:'GET',  path:'/api/aichat/keywords/monthly', desc:'月別キーワード集計', query:[{n:'month',s:'2026-06'}],
      res:{month:'2026-06',keywords:[{keyword:'cloudflare',count:10},{keyword:'workers',count:5}]} },
    { method:'GET',  path:'/api/aichat/search-log', desc:'検索ログ一覧',
      res:{rows:[{keyword:'cloudflare',share_id:'a1b2c3d4',first_searched_at:'2026-06-01T00:00:00.000Z',last_searched_at:'2026-06-15T00:00:00.000Z',select_count:3,question:'Cloudflare Workersとは？'}]} },
    { method:'GET',  path:'/api/aichat/search-history', desc:'検索履歴一覧',
      res:{history:[{keyword:'cloudflare',searched_at:'2026-06-15T12:00:00.000Z'}]} },
    { method:'GET',  path:'/api/aichat/search-keyword-analysis', desc:'キーワード分析',
      res:{analysis:[{keyword:'cloudflare',total_count:10,share_count:3,avg_results:5}]} },
    { method:'POST', path:'/api/aichat/search-log/open-modal', desc:'検索ログモーダル準備', body:[{n:'keyword',req:true,s:'cloudflare'},{n:'shareIds',req:true,s:[1]}],
      res:{ok:true,shares:[{id:'a1b2c3d4',question:'Cloudflare Workersとは？',answer_preview:'エッジで動くサーバーレス実行環境です。'}]} },
    { method:'POST', path:'/api/aichat/search-log/approve', desc:'検索ログ承認登録', body:[{n:'keyword',req:true,s:'cloudflare'},{n:'shareIds',req:true,s:[1]}],
      res:{ok:true,inserted:1} },
    { method:'POST', path:'/api/aichat/search-log', desc:'検索ログ記録', body:[{n:'keyword',req:true,s:'cloudflare'},{n:'shareId',req:true,s:1},{n:'resultCount',s:5}],
      res:{ok:true} },
    { method:'GET',  path:'/api/aichat/search-impressions', desc:'検索露出統計',
      res:{stats:[{share_id:'a1b2c3d4',impression_count:15,last_shown_at:'2026-06-15T00:00:00.000Z'}]} },
    { method:'POST', path:'/api/aichat/search-impressions', desc:'検索露出記録', body:[{n:'shareIds',req:true,s:[1]},{n:'resultCount',s:5}],
      res:{ok:true} },
    { method:'GET',  path:'/api/aichat/subqueries', desc:'サブクエリ一覧',
      res:{items:[{id:1,query:'Workers KVの使い方',link_count:2,keywords:[{keyword:'cloudflare',cnt:3}]}]} },
    { method:'POST', path:'/api/aichat/subqueries', desc:'サブクエリ登録', body:[{n:'query',req:true,s:'Workers KVの使い方'}],
      res:{ok:true,id:1,query:'Workers KVの使い方'} },
    { method:'GET',  path:'/api/aichat/subquery-keyword-questions', desc:'サブクエリ×キーワード質問一覧', query:[{n:'subquery_id',req:true,s:'1'},{n:'keyword',req:true,s:'cloudflare'}] },
    { method:'GET',  path:'/api/aichat/share-subquery-links', desc:'質問のサブクエリリンク一覧', query:[{n:'question',req:true,s:'Cloudflare Workersとは'}] },
    { method:'GET',  path:'/api/aichat/share-subquery-links/all', desc:'全サブクエリリンク（質問別）' },
    { method:'POST', path:'/api/aichat/share-subquery-links', desc:'サブクエリリンク登録', body:[{n:'question',req:true,s:'Cloudflare Workersとは'},{n:'subquery_id',req:true,s:1},{n:'url',s:''}],
      res:{ok:true} },
    { method:'GET',  path:'/api/aichat/share-keywords', desc:'共有のキーワード一覧', query:[{n:'shareId',req:true,s:'1'}],
      res:{keywords:[{keyword:'cloudflare',count:3},{keyword:'workers',count:2}]} },
    { method:'GET',  path:'/api/aichat/shares-by-question', desc:'質問テキストで共有検索', query:[{n:'question',req:true,s:'Cloudflare Workers'}] },
    { method:'GET',  path:'/api/aichat/shares-by-question-hash', desc:'質問ハッシュで共有検索', query:[{n:'hash',req:true,s:'abc123'}] },
    { method:'GET',  path:'/api/aichat/all-keywords', desc:'全キーワード一覧（分類状況付き）',
      res:{keywords:[{keyword:'cloudflare',cnt:10,is_classified:1,category_id:1,category_color:'#0969da',category_pairs:'[["インフラ",1]]'}]} },
    { method:'GET',  path:'/api/aichat/keyword-categories', desc:'キーワードのカテゴリ一覧', query:[{n:'keyword',s:'cloudflare'}],
      res:{categories:[{id:1,name:'インフラ',color:'#0969da',keyword_count:5}]} },
    { method:'POST', path:'/api/aichat/keyword-categories', desc:'カテゴリ新規作成', body:[{n:'name',req:true,s:'インフラ'},{n:'color',req:true,s:'#0969da'}],
      res:{ok:true,id:1,name:'インフラ',color:'#0969da'} },
    { method:'POST', path:'/api/aichat/keyword-category-map', desc:'キーワードとカテゴリのマッピング保存', body:[{n:'keyword',req:true,s:'cloudflare'},{n:'category_ids',req:true,s:[1]}],
      res:{ok:true} },
    { method:'GET',  path:'/api/aichat/keyword-categories-summary', desc:'カテゴリ別キーワード数サマリ',
      res:{summary:[{id:1,name:'インフラ',color:'#0969da',count:5}]} },
    { method:'GET',  path:'/api/aichat/token-usage', desc:'トークン使用量統計', query:[{n:'months',s:'3'}],
      res:{usage:[{month:'2026-06',model:'@cf/google/gemma-4-26b-a4b-it',total_tokens:15000,prompt_tokens:10000,completion_tokens:5000,count:10}]} },
    { method:'GET',  path:'/api/aichat/category-groups', desc:'カテゴリグループ一覧',
      res:{groups:[{id:1,group_name:'インフラ系',category_ids:[1,2],kw_count:5}]} },
    { method:'POST', path:'/api/aichat/category-groups', desc:'カテゴリグループ作成', body:[{n:'group_name',req:true,s:'インフラ系'},{n:'category_ids',req:true,s:[1]}],
      res:{ok:true,id:1} },
    { method:'POST', path:'/api/aichat/category-groups/:id/add-category', desc:'グループにカテゴリ追加', path_params:['id'], pp:{id:'1'}, body:[{n:'category_id',req:true,s:2}],
      res:{ok:true} },
    { method:'POST', path:'/api/aichat/category-groups/:id/remove-category', desc:'グループからカテゴリ除去', path_params:['id'], pp:{id:'1'}, body:[{n:'category_id',req:true,s:2}],
      res:{ok:true} },
    { method:'DELETE', path:'/api/aichat/category-groups/:id', desc:'カテゴリグループ削除', path_params:['id'], pp:{id:'1'},
      res:{ok:true} },
    { method:'GET',  path:'/api/aichat/shares/:id', desc:'共有詳細取得', path_params:['id'], pp:{id:'1'},
      res:{ok:true,share:{id:'a1b2c3d4',question:'Cloudflare Workersとは？',answer:'エッジで動くサーバーレス実行環境です。',model:'@cf/google/gemma-4-26b-a4b-it',created_at:'2026-06-15T00:00:00.000Z',is_deleted:0}} },
    { method:'DELETE', path:'/api/aichat/shares/:id', desc:'共有を論理削除', path_params:['id'], pp:{id:'1'},
      res:{ok:true} },
    { method:'POST', path:'/api/aichat/share', desc:'共有リンク作成', body:[{n:'question',req:true,s:'Cloudflare Workersとは？'},{n:'answer',req:true,s:'エッジで動くサーバーレス実行環境です。'},{n:'model',req:true,s:'@cf/google/gemma-4-26b-a4b-it'}],
      res:{ok:true,shareId:'a1b2c3d4',url:'/s/a1b2c3d4'} },
    { method:'GET',  path:'/api/aichat/check-heritage-questions', desc:'世界遺産質問キャッシュ確認', query:[{n:'heritage',req:true,s:'富士山'},{n:'country_name',s:'日本'}],
      res:{results:[{id:'a1b2c3d4',question:'富士山の歴史は？',answer_preview:'富士山は...',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast',created_at:'2026-06-15T00:00:00.000Z'}]} },
    { method:'POST', path:'/api/aichat/check-heritage-questions-batch', desc:'複数世界遺産の質問キャッシュ一括確認', body:[{n:'heritages',req:true,s:['富士山','厳島神社']}],
      res:{answered:{'富士山':{'交通手段':'a1b2c3d4'},'厳島神社':{}}} },
    { method:'GET',  path:'/api/aichat/heritage-keywords-check', desc:'世界遺産キーワードヒット確認', query:[{n:'keywords',req:true,s:'富士山,京都'}],
      res:{results:[{keyword:'富士山',count:5},{keyword:'京都',count:3}]} },
    { method:'GET',  path:'/api/aichat/heritage-search-keywords-check', desc:'世界遺産検索キーワード確認', query:[{n:'keywords',req:true,s:'富士山,京都'}],
      res:{results:[{keyword:'富士山',registered:true},{keyword:'京都',registered:false}]} },
    { method:'GET',  path:'/api/aichat/heritage-search-keyword-counts', desc:'世界遺産検索キーワード件数一覧',
      res:{counts:[{keyword:'富士山',count:12},{keyword:'京都',count:8}]} },
    { method:'GET',  path:'/api/aichat/heritage-mitokoro-keyword-hits', desc:'世界遺産見どころキーワードヒット確認', query:[{n:'heritage',req:true,s:'富士山'},{n:'model',req:true,s:'@cf/google/gemma-4-26b-a4b-it'}],
      res:{keywords:['信仰','噴火'],hitCount:2} },
    { method:'POST', path:'/api/aichat/check-heritage-mitokoro-gemma-batch', desc:'見どころキャッシュ一括確認(gemma)', body:[{n:'heritages',req:true,s:['富士山','厳島神社']}],
      res:{cached:{'富士山':true,'厳島神社':false}} },
    { method:'POST', path:'/api/aichat/check-heritage-mitokoro-llama-batch', desc:'見どころキャッシュ一括確認(llama)', body:[{n:'heritages',req:true,s:['富士山','厳島神社']}],
      res:{cached:{'富士山':true,'厳島神社':false}} },
    { method:'GET',  path:'/api/aichat/answer-keywords', desc:'回答文からベクタ化時に抽出した予備知識キーワード一覧', query:[{n:'shareId',req:true,s:'a1b2c3d4'}],
      res:{shareId:'a1b2c3d4',keywords:['cloudflare','workers'],keywordOccurrences:[{keyword:'cloudflare',count:10,classified:true,categoryColor:'#0969da'}]} },
    { method:'POST', path:'/api/aichat/vectorize-answer', desc:'回答文をベクタ化し予備知識キーワードを抽出', body:[{n:'shareId',req:true,s:'a1b2c3d4'},{n:'model',s:'pfnet/plamo-embedding-1b'}],
      res:{ok:true,keywords:['cloudflare','workers']} },
    { method:'POST', path:'/api/aichat/answer-propagation-graph', desc:'回答文の伝播関係グラフ構築(キーワード色分け付き)', body:[{n:'shareId',req:true,s:'a1b2c3d4'}],
      res:{nodes:[{id:'a1b2c3d4',depth:0}],edges:[]} },
    { method:'PATCH', path:'/api/aichat/keyword-categories/:id', desc:'キーワードカテゴリの色更新', path_params:['id'], pp:{id:'1'}, body:[{n:'color',req:true,s:'#0969da'}],
      res:{ok:true} },
    { method:'POST', path:'/api/aichat/keyword-category-suggest', desc:'キーワードのカテゴリ候補をベクタ類似度から提案', body:[{n:'keyword',req:true,s:'cloudflare'}],
      res:{suggestion:{categoryId:1,name:'インフラ',similarity:0.92}} },
    { method:'GET',  path:'/api/aichat/keyword-embeddings/lookup', desc:'キーワードの埋め込みキャッシュ確認', query:[{n:'keyword',req:true,s:'cloudflare'}],
      res:{cached:true,embedding:{model:'bge-m3',dim:1024}} },
    { method:'GET',  path:'/api/aichat/keyword-embeddings/list', desc:'埋め込みキャッシュ済みキーワード一覧',
      res:{items:[{keyword:'cloudflare',model:'bge-m3',created_at:'2026-06-15T00:00:00.000Z'}]} },
    { method:'GET',  path:'/api/aichat/keyword-embeddings/model-counts', desc:'埋め込みモデル別キャッシュ件数',
      res:{bge:120,plamo:30,gemma:5} },
    { method:'GET',  path:'/api/aichat/keyword-embeddings/similar', desc:'類似キーワード検索(中分類グルーピング付き)', query:[{n:'keyword',req:true,s:'cloudflare'},{n:'threshold',s:'0.85'}],
      res:{target:'cloudflare',groups:[{categoryName:'インフラ',keywords:[{keyword:'workers',similarity:0.91}]}]} },
    { method:'POST', path:'/api/aichat/keyword-embeddings/register', desc:'テキストを埋め込みモデルへ問い合わせキャッシュ登録', body:[{n:'texts',req:true,s:['cloudflare']},{n:'model',s:'bge-m3'}],
      res:{ok:true,model:'bge-m3',registered:1,failed:0,results:[{text:'cloudflare',ok:true}]} },
    { method:'GET',  path:'/api/aichat/image-gallery-search', desc:'画像添付会話をキーワード検索(質問文/回答文またはmoondream分析結果)', query:[{n:'q',req:true,s:'猫'},{n:'target',s:'moondream3.1'}],
      res:{results:[{id:'a1b2c3d4',question:'この画像は何ですか',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast',created_at:'2026-06-15T00:00:00.000Z'}]} },
    { method:'POST', path:'/api/aichat/moondream-analysis', desc:'Moondream画像分析結果をD1へ保存', body:[{n:'shareId',req:true,s:'a1b2c3d4'},{n:'analysisText',req:true,s:'猫が写っています'},{n:'model',s:'@cf/moondream/moondream3.1-9B-A2B'}],
      res:{ok:true} },
  ]},
  { group: 'AI サマリー', endpoints: [
    { method:'GET',    path:'/api/ai-summary/:id', desc:'AI サマリー詳細取得', path_params:['id'], pp:{id:'1'},
      res:{id:1,repo:'nekoserver/cloudflare-workers-github-oauth-1',summary:'バグ修正: Cookie セキュリティ属性の修正',status:'open',created_at:'2026-06-15T00:00:00.000Z'} },
    { method:'POST',   path:'/api/ai-summary/:id/feedback', desc:'サマリーフィードバック投稿', path_params:['id'], pp:{id:'1'}, body:[{n:'rating',s:5},{n:'reviewer_type',s:'human'},{n:'reviewer_name',s:'test'},{n:'review_model',s:''},{n:'comment',s:'LGTM'}],
      res:{ok:true} },
    { method:'POST',   path:'/api/ai-summary/:id/resolve', desc:'解決ステータス更新', path_params:['id'], pp:{id:'1'}, body:[{n:'resolved',req:true,s:true},{n:'resolution_note',s:'対応済み'}],
      res:{ok:true} },
  ]},
  { group: 'リポジトリ', endpoints: [
    { method:'POST',   path:'/api/repositories', desc:'リポジトリ作成', body:[{n:'name',req:true,s:'my-test-repo'},{n:'isPrivate',s:false},{n:'description',s:'テスト用リポジトリ'}],
      res:{ok:true,id:'nekoserver/my-test-repo',url:'https://github.com/nekoserver/my-test-repo'} },
    { method:'GET',    path:'/api/repositories/:owner/:repo/issues-count', desc:'オープン Issue 数', path_params:['owner','repo'], pp:{owner:'nekoserver',repo:'cloudflare-workers-github-oauth-1'},
      res:{count:5} },
    { method:'GET',    path:'/api/repositories/:owner/:repo/commits', desc:'最近のコミット一覧', path_params:['owner','repo'], pp:{owner:'nekoserver',repo:'cloudflare-workers-github-oauth-1'}, query:[{n:'per_page',s:'5'}],
      res:{commits:[{sha:'abc1234',message:'fix: バグ修正',date:'2026-06-15T00:00:00.000Z',author:'nekoserver',url:'https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/abc1234'}],total:1,cached:false} },
    { method:'GET',    path:'/api/repositories/:owner/:repo/commit-stats', desc:'コミット統計（著者別）', path_params:['owner','repo'], pp:{owner:'nekoserver',repo:'cloudflare-workers-github-oauth-1'}, query:[{n:'period',s:'30d'}],
      res:{period:'30d',rows:[{author:'nekoserver',count:42}],cached:false} },
    { method:'GET',    path:'/api/repositories/:owner/:repo/commit-months', desc:'コミット月一覧', path_params:['owner','repo'], pp:{owner:'nekoserver',repo:'cloudflare-workers-github-oauth-1'},
      res:{months:['2026-06','2026-05'],currentMonth:'2026-06',details:[{month:'2026-06',count:20}],cachedRepoCount:1} },
    { method:'GET',    path:'/api/repositories/:owner/:repo/commits-by-month', desc:'月別コミット一覧', path_params:['owner','repo'], pp:{owner:'nekoserver',repo:'cloudflare-workers-github-oauth-1'}, query:[{n:'period',s:'2026-06'}],
      res:{period:'2026-06',commits:[{sha:'abc1234',message:'fix: バグ修正',date:'2026-06-15T00:00:00.000Z',author:'nekoserver'}],cached:false} },
    { method:'GET',    path:'/api/repositories/:owner/:repo/commits-calendar', desc:'月カレンダー（コミット数）', path_params:['owner','repo'], pp:{owner:'nekoserver',repo:'cloudflare-workers-github-oauth-1'}, query:[{n:'year',s:'2026'},{n:'month',s:'6'}],
      res:{year:2026,month:6,counts:{15:3,14:1},cached:false} },
    { method:'GET',    path:'/api/repositories/:owner/:repo/commits-by-date', desc:'日付別コミット一覧', path_params:['owner','repo'], pp:{owner:'nekoserver',repo:'cloudflare-workers-github-oauth-1'}, query:[{n:'date',s:'2026-06-15'}],
      res:{commits:[{sha:'abc1234',message:'fix: バグ修正',date:'2026-06-15T00:00:00.000Z',author:'nekoserver'}]} },
    { method:'GET',    path:'/api/repositories/this-month-commits', desc:'今月コミットのあるリポジトリ',
      res:{repos:[{owner:'nekoserver',repo:'cloudflare-workers-github-oauth-1',latestDate:'2026-06-15'}]} },
    { method:'GET',    path:'/api/repositories/search/commits', desc:'コミット全文検索', query:[{n:'q',req:true,s:'fix'}],
      res:{results:[{repo:'nekoserver/cloudflare-workers-github-oauth-1',sha:'abc1234',message:'fix: バグ修正',date:'2026-06-15T00:00:00.000Z',author:'nekoserver'}],total:1} },
    { method:'GET',    path:'/api/repositories/search/keyword-classify-check', desc:'キーワード分類状況確認', query:[{n:'q',req:true,s:'cloudflare'}],
      res:{keyword:'cloudflare',classified:true,labels:['インフラ'],categories:[{id:1,name:'インフラ',color:'#0969da'}]} },
    { method:'POST',   path:'/api/repositories/search/keyword-label', desc:'キーワードラベル保存', body:[{n:'search_query',req:true,s:'cloudflare'},{n:'label',req:true,s:'インフラ'}],
      res:{ok:true} },
    { method:'GET',    path:'/api/repositories/search/category-group', desc:'一致カテゴリグループ取得', query:[{n:'labels',req:true,s:'インフラ'}],
      res:{groups:[{id:1,group_name:'インフラ系',categories:['インフラ','ネットワーク']}]} },
    { method:'GET',    path:'/api/repositories/search/category-groups', desc:'カテゴリグループ一覧',
      res:{groups:[{id:1,group_name:'インフラ系',description:'インフラ関連',categories:['cloudflare','workers']}]} },
    { method:'GET',    path:'/api/repositories/search/category-group/check-name', desc:'グループ名存在確認', query:[{n:'name',req:true,s:'インフラ系'}],
      res:{exists:false} },
    { method:'POST',   path:'/api/repositories/search/category-group', desc:'カテゴリグループ作成', body:[{n:'group_name',req:true,s:'インフラ系'},{n:'description',s:'インフラ関連'},{n:'categories',req:true,s:['cloudflare']}],
      res:{ok:true,id:1} },
    { method:'PUT',    path:'/api/repositories/search/category-group/:id', desc:'カテゴリグループ更新', path_params:['id'], pp:{id:'1'}, body:[{n:'group_name',s:'インフラ系（更新）'},{n:'description',s:''},{n:'categories',s:['cloudflare']}],
      res:{ok:true} },
    { method:'DELETE', path:'/api/repositories/search/category-group/:id', desc:'カテゴリグループ削除', path_params:['id'], pp:{id:'1'},
      res:{ok:true} },
    { method:'GET',    path:'/api/repositories/search/repo-keywords', desc:'リポジトリ別キーワード', query:[{n:'repo',req:true,s:'cloudflare-workers-github-oauth-1'}],
      res:{repo:'cloudflare-workers-github-oauth-1',keywords:[{keyword:'cloudflare',count:10},{keyword:'workers',count:5}]} },
    { method:'GET',    path:'/api/repositories/search/repo-list', desc:'検索ヒットのあるリポジトリ一覧',
      res:{repos:['cloudflare-workers-github-oauth-1','another-repo']} },
    { method:'GET',    path:'/api/repositories/search/history', desc:'検索履歴一覧',
      res:{history:[{id:1,query:'fix',repo:'cloudflare-workers-github-oauth-1',result_count:5,searched_at:'2026-06-15T00:00:00.000Z'}]} },
    { method:'GET',    path:'/api/repositories/search/history/:id', desc:'検索履歴詳細', path_params:['id'], pp:{id:'1'},
      res:{id:1,query:'fix',repo:'cloudflare-workers-github-oauth-1',result_count:5,searched_at:'2026-06-15T00:00:00.000Z',results:[{sha:'abc1234',message:'fix: バグ修正'}]} },
    { method:'GET',    path:'/api/repositories/search/keyword-stats', desc:'キーワード統計', query:[{n:'q',req:true,s:'cloudflare'},{n:'repo',s:'cloudflare-workers-github-oauth-1'}],
      res:{keyword:'cloudflare',total_count:10,repo_count:2,repos:[{repo:'cloudflare-workers-github-oauth-1',count:8}]} },
    { method:'GET',    path:'/api/repositories/search/keyword-multi-labels', desc:'キーワードのマルチラベル', query:[{n:'q',req:true,s:'cloudflare'}],
      res:{keyword:'cloudflare',categories:['インフラ','ネットワーク']} },
    { method:'POST',   path:'/api/repositories/search/keyword-multi-labels', desc:'マルチラベル保存', body:[{n:'search_query',req:true,s:'cloudflare'},{n:'categories',req:true,s:['インフラ']}],
      res:{ok:true} },
    { method:'GET',    path:'/api/repositories/search/keyword-multi-labels-all', desc:'全マルチラベル割り当て',
      res:{assignments:[{keyword:'cloudflare',categories:['インフラ']}]} },
    { method:'GET',    path:'/api/repo-permissions', desc:'インストール権限一覧',
      res:{permissions:[{repo:'cloudflare-workers-github-oauth-1',owner:'nekoserver',permission:'write'}]} },
  ]},
  { group: 'リポジトリ色・グループ', endpoints: [
    { method:'GET',    path:'/api/repo-colors', desc:'リポジトリカラー設定一覧',
      res:{colors:[{repoName:'cloudflare-workers-github-oauth-1',colorCode:'#0969da',displayOrder:0,tags:'',isVisible:true}]} },
    { method:'POST',   path:'/api/repo-colors/sync', desc:'コミットキャッシュからカラー同期',
      res:{ok:true,synced:3} },
    { method:'PATCH',  path:'/api/repo-colors/:repoName', desc:'リポジトリカラー更新', path_params:['repoName'], pp:{repoName:'cloudflare-workers-github-oauth-1'}, body:[{n:'colorCode',s:'#0969da'},{n:'tags',s:[]},{n:'isVisible',s:true},{n:'displayOrder',s:0}],
      res:{ok:true} },
    { method:'GET',    path:'/api/repo-groups', desc:'リポジトリグループ一覧',
      res:{groups:[{id:1,name:'メインプロジェクト',description:'テスト用グループ',colorCode:'#0969da',icon:'🚀',slackChannelId:'',displayOrder:0,repos:['cloudflare-workers-github-oauth-1']}]} },
    { method:'POST',   path:'/api/repo-groups', desc:'リポジトリグループ作成', body:[{n:'name',req:true,s:'メインプロジェクト'},{n:'description',s:'テスト用グループ'},{n:'colorCode',s:'#0969da'},{n:'icon',s:'🚀'},{n:'slackChannelId',s:''},{n:'repos',s:[]}],
      res:{ok:true,id:1} },
    { method:'PATCH',  path:'/api/repo-groups/:id', desc:'リポジトリグループ更新', path_params:['id'], pp:{id:'1'}, body:[{n:'name',s:'メインプロジェクト（更新）'},{n:'description',s:''},{n:'colorCode',s:''},{n:'icon',s:''},{n:'slackChannelId',s:''},{n:'displayOrder',s:0},{n:'repos',s:[]}],
      res:{ok:true} },
    { method:'DELETE', path:'/api/repo-groups/:id', desc:'リポジトリグループ削除', path_params:['id'], pp:{id:'1'},
      res:{ok:true} },
    { method:'GET',    path:'/api/repo-groups/:id/oauth-apps', desc:'グループの OAuth アプリ一覧', path_params:['id'], pp:{id:'1'},
      res:{apps:[{appName:'my-oauth-app',appNote:'テスト用',createdAt:'2026-06-15T00:00:00.000Z'}]} },
    { method:'POST',   path:'/api/repo-groups/:id/oauth-apps', desc:'OAuth アプリ追加', path_params:['id'], pp:{id:'1'}, body:[{n:'appName',req:true,s:'my-oauth-app'},{n:'appNote',s:'テスト用'}],
      res:{ok:true} },
    { method:'DELETE', path:'/api/repo-groups/:id/oauth-apps/:appName', desc:'OAuth アプリ削除', path_params:['id','appName'], pp:{id:'1',appName:'my-oauth-app'},
      res:{ok:true} },
    { method:'GET',    path:'/api/repo-oauth-apps', desc:'リポジトリ別 OAuth アプリ',
      res:{apps:[{repo:'cloudflare-workers-github-oauth-1',appName:'my-oauth-app',appNote:'テスト用'}]} },
  ]},
  { group: 'ステータス・スキーマ', endpoints: [
    { method:'GET',  path:'/api/status/schema', desc:'全テーブル定義・カラム・リレーション',
      res:{tables:[{name:'user_sessions',cols:[{name:'id',type:'INTEGER',keys:['PK']},{name:'user_id',type:'TEXT',keys:['IDX']}]}],relations:[['ai_summary_reviews','log_id','ai_summary_log','id','FK']]} },
    { method:'GET',  path:'/api/status/tables/:table/rows', desc:'テーブル行プレビュー', path_params:['table'], pp:{table:'user_sessions'},
      res:{table:'user_sessions',migration:'0001',description:'ユーザーセッション',columns:['id','user_id','created_at'],columnKeyInfo:{id:'PK',user_id:'IDX'},filterableColumns:['user_id'],rows:[{id:1,user_id:'nekoserver',created_at:'2026-06-15T00:00:00.000Z'}],limit:20} },
    { method:'GET',  path:'/api/status/tables/:table/ym-summary', desc:'年月別サマリ', path_params:['table'], pp:{table:'ai_summary_log'},
      res:{table:'ai_summary_log',rows:[{ym:'2026-06',count:15}]} },
    { method:'GET',  path:'/api/status/tables/:table/calendar', desc:'日別カレンダー', path_params:['table'], pp:{table:'ai_summary_log'}, query:[{n:'ym',s:'2026-06'}],
      res:{table:'ai_summary_log',ym:'2026-06',days:[{date:'2026-06-15',count:3}]} },
    { method:'GET',  path:'/api/status/tables/:table/migration-details', desc:'マイグレーション詳細', path_params:['table'], pp:{table:'user_sessions'},
      res:{table:'user_sessions',migration:'0001',cols:[{name:'id',type:'INTEGER'},{name:'user_id',type:'TEXT'}]} },
    { method:'GET',  path:'/api/status/tables/:table/group-er', desc:'テーブルグループ ER 図', path_params:['table'], pp:{table:'user_sessions'},
      res:{tables:['user_sessions'],relations:[]} },
    { method:'GET',  path:'/api/status/migrations/:migration/sql', desc:'マイグレーション SQL 取得', path_params:['migration'], pp:{migration:'0001'},
      res:{migration:'0001',sql:'CREATE TABLE IF NOT EXISTS user_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL);'} },
    { method:'GET',  path:'/api/status/column-stats/verify', desc:'カラム FK 統計検証',
      res:{ok:true,verified:5,issues:[]} },
    { method:'POST', path:'/api/status/fk-verify', desc:'FK サンプルデータ検証', body:[{n:'fromTable',req:true,s:'ai_summary_reviews'},{n:'fromCol',req:true,s:'log_id'},{n:'toTable',req:true,s:'ai_summary_log'},{n:'toCol',req:true,s:'id'}],
      res:{ok:true,fromTable:'ai_summary_reviews',fromCol:'log_id',toTable:'ai_summary_log',toCol:'id',sampleRows:[{log_id:1,id:1}]} },
  ]},
  { group: 'Cloudflare', endpoints: [
    { method:'GET',  path:'/api/cf-dashboard/d1', desc:'D1 データベース一覧',
      res:{databases:[{id:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',name:'cloudflare-workers-github-oauth-1-db',created_at:'2026-01-01T00:00:00.000Z'}]} },
    { method:'GET',  path:'/api/cf-dashboard/d1/:dbId/tables', desc:'D1 テーブル行数一覧', path_params:['dbId'],
      res:{tables:[{name:'user_sessions',row_count:1},{name:'ai_summary_log',row_count:42}]} },
    { method:'GET',  path:'/api/debug/d1', desc:'D1 接続診断',
      res:{ok:true,binding:'DB',tables:[{name:'user_sessions',count:1}]} },
    { method:'GET',  path:'/api/debug/installations', desc:'GitHub App インストール診断',
      res:{ok:true,installations:[{id:12345678,account:'nekoserver',repos:['cloudflare-workers-github-oauth-1']}]} },
    { method:'GET',  path:'/api/cloudflare-setup-pending', desc:'セットアップ待ち通知一覧',
      res:{notifications:[{id:1,type:'worker_not_deployed',message:'Worker がデプロイされていません',created_at:'2026-06-15T00:00:00.000Z'}]} },
    { method:'POST', path:'/api/cloudflare-setup-pending/:id/dismiss', desc:'通知を個別却下', path_params:['id'], pp:{id:'1'},
      res:{ok:true} },
    { method:'POST', path:'/api/cloudflare-setup-pending/dismiss-all', desc:'通知を一括却下',
      res:{ok:true,dismissed:3} },
  ]},
  { group: 'プロフィール・設定', endpoints: [
    { method:'GET',  path:'/api/profile', desc:'ユーザープロフィール取得',
      res:{profile:{username:'nekoserver',name:'Neko Server',email:'okiraku.cloud@gmail.com',issuedAt:'2026-06-15T00:00:00.000Z',expiresAt:'2026-06-16T00:00:00.000Z'}} },
    { method:'PUT',  path:'/api/profile', desc:'プロフィール更新', body:[{n:'name',s:'テストユーザー'}],
      res:{ok:true,name:'テストユーザー'} },
    { method:'POST', path:'/api/settings/timezone', desc:'タイムゾーン設定', body:[{n:'timezone',req:true,s:'Asia/Tokyo'}],
      res:{ok:true,timezone:'Asia/Tokyo'} },
    { method:'POST', path:'/api/settings/session-duration', desc:'セッション期間設定', body:[{n:'sessionDuration',req:true,s:'24h'}],
      res:{ok:true,sessionDuration:'24h'} },
    { method:'POST', path:'/api/settings/theme', desc:'テーマ設定', body:[{n:'theme',req:true,s:'dark'}],
      res:{ok:true,theme:'dark'} },
    { method:'POST', path:'/api/settings/recent-commits-count', desc:'最近のコミット表示件数設定', body:[{n:'count',req:true,s:10}],
      res:{ok:true,count:10} },
    { method:'POST', path:'/api/settings/toast-duration', desc:'トースト表示時間設定', body:[{n:'duration',req:true,s:3000}],
      res:{ok:true,duration:3000} },
    { method:'POST', path:'/api/settings/status-commit-cache-sort-mode', desc:'キャッシュソートモード設定', body:[{n:'mode',req:true,s:'date'}],
      res:{ok:true,mode:'date'} },
    { method:'POST', path:'/api/settings/status-chart-mode', desc:'チャートモード設定', body:[{n:'mode',req:true,s:'bar'}],
      res:{ok:true,mode:'bar'} },
    { method:'POST', path:'/api/settings/status-chart-sort-order', desc:'チャートソート順設定', body:[{n:'order',req:true,s:'desc'}],
      res:{ok:true,order:'desc'} },
    { method:'POST', path:'/api/settings/status-table-autodetect', desc:'テーブル自動検出設定', body:[{n:'mode',req:true,s:'on'}],
      res:{ok:true,mode:'on'} },
    { method:'POST', path:'/api/settings/status-show-autodetected-tables', desc:'自動検出テーブル表示設定', body:[{n:'mode',req:true,s:'on'}],
      res:{ok:true,mode:'on'} },
    { method:'POST', path:'/api/settings/status-ignore-unknown-unclassified-warning', desc:'未分類警告抑制設定', body:[{n:'mode',req:true,s:'off'}],
      res:{ok:true,mode:'off'} },
    { method:'POST', path:'/api/settings/search-label-mode', desc:'検索ラベルモード設定', body:[{n:'mode',req:true,s:'on'}],
      res:{ok:true,mode:'on'} },
    { method:'POST', path:'/api/settings/idle-timeout', desc:'アイドルタイムアウト設定', body:[{n:'timeout',req:true,s:30}],
      res:{ok:true,timeout:30} },
    { method:'POST', path:'/api/settings/apis-sidebar-open', desc:'APIサイドバー開閉状態設定', body:[{n:'open',req:true,s:true}],
      res:{ok:true,open:true} },
    { method:'POST', path:'/api/settings/apis-sidebar-accordion', desc:'APIサイドバーアコーディオンモード設定', body:[{n:'mode',req:true,s:'on'}],
      res:{ok:true,mode:'on'} },
    { method:'POST', path:'/api/settings/apis-desc-mode', desc:'API説明表示モード設定', body:[{n:'mode',req:true,s:'on'}],
      res:{ok:true,mode:'on'} },
    { method:'POST', path:'/api/settings/apis-nav-flash', desc:'APIナビフラッシュ設定', body:[{n:'mode',req:true,s:'on'}],
      res:{ok:true,mode:'on'} },
    { method:'GET',  path:'/api/email-verify-test', desc:'ログインユーザー宛にテストメール送信(RESEND_API_KEY未設定時は無効)',
      res:{enabled:true,sent:true,to:'okiraku.cloud@gmail.com'} },
    { method:'POST', path:'/api/settings/aichat-auto-vectorize-enabled', desc:'キーワード自動ベクタ化ON/OFF設定', body:[{n:'mode',req:true,s:'on'}],
      res:{message:'キーワードの自動ベクタ化設定を変更しました',mode:'on'} },
    { method:'POST', path:'/api/settings/aichat-auto-vectorize-model', desc:'自動ベクタ化で使う埋め込みモデル設定', body:[{n:'model',req:true,s:'pfnet/plamo-embedding-1b'}],
      res:{message:'自動ベクタ化に使う埋め込みモデルを変更しました',model:'pfnet/plamo-embedding-1b'} },
    { method:'POST', path:'/api/settings/aichat-prefer-moondream', desc:'画像添付時にmoondreamを優先する設定', body:[{n:'mode',req:true,s:'on'}],
      res:{message:'画像添付時にmoondreamを優先する設定を変更しました',mode:'on'} },
    { method:'POST', path:'/api/settings/answer-graph-hide-empty-rows', desc:'answer-graphの空行非表示設定', body:[{n:'mode',req:true,s:'on'}],
      res:{message:'answer-graphの空行非表示設定を変更しました',mode:'on'} },
    { method:'POST', path:'/api/settings/answer-graph-trail-session-storage', desc:'answer-graphのパン屑リストのsessionStorage保存設定', body:[{n:'mode',req:true,s:'on'}],
      res:{message:'answer-graphのパン屑リストのsessionStorage保存設定を変更しました',mode:'on'} },
    { method:'POST', path:'/api/settings/wasm-modules-view-mode', desc:'WASMモジュール一覧の表示モード設定(panel/list)', body:[{n:'mode',req:true,s:'list'}],
      res:{message:'WASMモジュール一覧の表示モードを変更しました',mode:'list'} },
    { method:'POST', path:'/api/settings/email-confirm-login', desc:'ログイン確認メールゲートON/OFF設定', body:[{n:'enabled',req:true,s:true}],
      res:{ok:true,enabled:true} },
    { method:'GET',  path:'/api/preferences/:key', desc:'ユーザー設定値をキー単位で取得(D1のuser_preferences。USER_PREFERENCE_KEYSの許可リストに無いキーは400)', path_params:['key'], pp:{key:'d1_query_catalog_sort'},
      res:{key:'d1_query_catalog_sort',value:'count',updatedAt:'2026-06-15 00:00:00'} },
    { method:'POST', path:'/api/preferences/:key', desc:'ユーザー設定値をキー単位で保存(UPSERT)。個別Cookie乱立の解消先', path_params:['key'], pp:{key:'d1_query_catalog_sort'}, body:[{n:'value',req:true,s:'count'}],
      res:{message:'設定を保存しました',key:'d1_query_catalog_sort',value:'count'} },
  ]},
  { group: 'APIキー管理', endpoints: [
    { method:'GET',  path:'/api/api-keys', desc:'🔑キー管理ページ(/api-keys)用のAPIキー一覧取得(生キー・ハッシュ値は含まない)',
      res:{keys:[{id:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',label:'監視用',key_prefix:'nkapi_ab12cd34********',created_at:'2026-08-15T00:00:00.000Z',expires_at:'2026-09-14T00:00:00.000Z',revoked_at:null,last_used_at:null}]} },
    { method:'POST', path:'/api/api-keys', desc:'APIキー発行(生キーはこのレスポンスでのみ返し、以降は再表示不可)', body:[{n:'label',req:true,s:'監視用'},{n:'expiresInDays',s:30}],
      res:{key:{id:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',label:'監視用',keyPrefix:'nkapi_ab12cd34********',createdAt:'2026-08-15T00:00:00.000Z',expiresAt:'2026-09-14T00:00:00.000Z'},rawKey:'nkapi_ab12cd34ef56gh78ij90kl12mn34op56...'} },
    { method:'POST', path:'/api/api-keys/:id/revoke', desc:'APIキー失効(自分が発行したキーのみ)', path_params:['id'], pp:{id:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'},
      res:{message:'APIキーを失効しました'} },
  ]},
  { group: 'ワークスペース・関数', endpoints: [
    { method:'GET',  path:'/api/workspaces', desc:'ワークスペース一覧',
      res:{workspaces:[{workspaceId:'ws_1',workspaceName:'メインワークスペース',teamId:'team_1',teamName:'Neko Team'}],current:{workspaceId:'ws_1',workspaceName:'メインワークスペース',teamId:'team_1',teamName:'Neko Team'}} },
    { method:'POST', path:'/api/workspaces/switch', desc:'ワークスペース切り替え', body:[{n:'workspaceId',req:true,s:1}],
      res:{ok:true,workspaceId:1} },
    { method:'GET',  path:'/api/function-file-history', desc:'関数ファイル変更履歴', query:[{n:'repo_id',req:true,s:'1'},{n:'function_name',req:true,s:'recordApiAccess'},{n:'file_path',req:true,s:'src/index.ts'}],
      res:{function_name:'recordApiAccess',file_path:'src/index.ts',history:[{commit_hash:'abc1234',commit_message:'feat: API集計追加',committed_at:'2026-06-15T00:00:00.000Z',start_line:100,end_line:130}]} },
    { method:'GET',  path:'/api/function-source', desc:'関数ソースコード取得', query:[{n:'repo_id',req:true,s:'1'},{n:'function_name',req:true,s:'recordApiAccess'},{n:'file_path',req:true,s:'src/index.ts'},{n:'max_lines',s:'50'}],
      res:{function_name:'recordApiAccess',file_path:'src/index.ts',start_line:100,end_line:130,source:'async function recordApiAccess(...) { ... }'} },
  ]},
  { group: 'UUID', endpoints: [
    { method:'POST', path:'/api/uuid/save', desc:'UUID を D1 に保存（最大100件）',
      body:[{n:'uuids',req:true,s:[{uuid:'550e8400-e29b-41d4-a716-446655440000',version:'v4'}]}],
      res:{saved:1} },
    { method:'GET', path:'/api/uuid/search', desc:'UUID 履歴を検索（新しい順）',
      query:[{n:'q',s:'550e84'},{n:'limit',s:'50'}],
      res:{results:[{id:1,uuid:'550e8400-e29b-41d4-a716-446655440000',version:'v4',created_at:'2026-06-22T03:00:00'}],query:'550e84'} },
    { method:'GET', path:'/api/uuid/count', desc:'D1 に登録済みの UUID 総件数',
      res:{count:42} },
    { method:'DELETE', path:'/api/uuid/history', desc:'自分の UUID 履歴を全件削除',
      res:{ok:true} },
  ]},
  { group: 'MLB', endpoints: [
    { method:'GET', path:'/api/mlb-schedule', desc:'MLB 試合スケジュール取得（MLB Stats API プロキシ）',
      query:[{n:'date',s:'2026-06-22'},{n:'startDate',s:''},{n:'endDate',s:''}],
      res:{totalItems:15,dates:[{date:'2026-06-22',games:[{gamePk:12345,gameDate:'2026-06-22T18:10:00Z',status:{abstractGameState:'Live'},teams:{home:{team:{id:147,name:'New York Yankees'},score:3},away:{team:{id:117,name:'Houston Astros'},score:1}},venue:{name:'Yankee Stadium'}}]}]} },
    { method:'GET', path:'/api/mlb-boxscore', desc:'試合のボックススコア取得',
      query:[{n:'gamePk',req:true,s:'12345'}],
      res:{teams:{home:{teamStats:{batting:{runs:3,hits:7}},players:{}},away:{teamStats:{batting:{runs:1,hits:4}},players:{}}}} },
    { method:'GET', path:'/api/mlb-player-stats', desc:'選手の打撃または投球成績取得（当年シーズン）',
      query:[{n:'playerId',req:true,s:'808959'},{n:'group',s:'hitting'}],
      res:{stats:[{group:{displayName:'hitting'},splits:[{stat:{avg:'.285',homeRuns:12,rbi:40}}]}]} },
    { method:'GET', path:'/api/mlb-next-start', desc:'チームの次回先発投手スケジュール取得（20日以内）',
      query:[{n:'teamId',req:true,s:'147'}],
      res:{dates:[{date:'2026-06-24',games:[{gamePk:12346,teams:{home:{team:{name:'New York Yankees'}},away:{team:{name:'Boston Red Sox'}}},probablePitcher:{fullName:'Gerrit Cole'}}]}]} },
  ]},
  { group: '世界遺産', endpoints: [
    { method:'GET',  path:'/api/heritage-access-ranking', desc:'世界遺産アクセスランキング取得', query:[{n:'max_dist',s:'50'},{n:'limit',s:'20'}],
      res:{ranking:[{heritage_name:'富士山',country_name:'日本',country_flag:'🇯🇵',access_count:120,city_name:'富士宮市',distance_km:15}]} },
    { method:'GET',  path:'/api/heritage-cities', desc:'世界遺産の近隣都市一覧取得', query:[{n:'name',req:true,s:'富士山'}],
      res:{cities:[{city_name:'富士宮市',distance_km:15,lat:35.2,lon:138.6}]} },
    { method:'POST', path:'/api/heritage-cities', desc:'世界遺産の近隣都市を検索・保存', body:[{n:'name',req:true,s:'富士山'},{n:'lat',req:true,s:35.36},{n:'lon',req:true,s:138.73},{n:'force',s:false}],
      res:{ok:true,cities:[{city_name:'富士宮市',distance_km:15}]} },
    { method:'GET',  path:'/api/heritage-city-fetched-list', desc:'近隣都市取得済みの世界遺産名一覧',
      res:{names:['富士山','厳島神社']} },
    { method:'POST', path:'/api/city-all-heritages', desc:'都市近隣の全世界遺産取得', body:[{n:'city_name',req:true,s:'富士宮市'},{n:'lat',req:true,s:35.2},{n:'lon',req:true,s:138.6}],
      res:{heritages:[{heritage_name:'富士山',distance_km:15,country_flag:'🇯🇵'}]} },
    { method:'POST', path:'/api/heritage-city-heritages', desc:'都市と世界遺産の距離取得', body:[{n:'city_name',req:true,s:'富士宮市'},{n:'lat',req:true,s:35.2},{n:'lon',req:true,s:138.6},{n:'names',req:true,s:['富士山']}],
      res:{results:[{heritage_name:'富士山',distance_km:15}]} },
    { method:'GET',  path:'/api/flight-status', desc:'空港発着フライト状況取得（OpenSky）', query:[{n:'code',req:true,s:'HND'}],
      res:{code:'HND',icao:'RJTT',flights:[{callsign:'ANA001',estDepartureAirport:'RJTT',estArrivalAirport:'RJOO',firstSeen:1750000000,lastSeen:1750003600}],fetchedAt:1750000000} },
    { method:'GET',  path:'/api/heritage-country-stats', desc:'国別世界遺産数統計',
      res:{stats:[{country_name:'日本',country_flag:'🇯🇵',count:25}]} },
    { method:'POST', path:'/api/heritage-country-city-stats', desc:'世界遺産別の都市数・ユニーク都市数集計', body:[{n:'names',req:true,s:['富士山','厳島神社']}],
      res:{stats:[{heritage_name:'富士山',city_count:5,unique_city_count:3}]} },
    { method:'POST', path:'/api/heritage-country-unique-cities', desc:'重複除去済みの近隣都市一覧取得', body:[{n:'names',req:true,s:['富士山','厳島神社']}],
      res:{cities:[{city_name:'富士宮市',heritage_name:'富士山',distance_km:15}]} },
    { method:'POST', path:'/api/heritage-area/search', desc:'世界遺産の検索露出ログ検索(キーワード最大20件)', body:[{n:'keywords',req:true,s:['姫路城']}],
      res:{items:[{item_name:'姫路城',impression_count:3}],distance_origin:{name:'姫路城',flag:'🇯🇵',country:'日本',lat:34.84,lon:134.69}} },
    { method:'QUERY', path:'/api/heritage-area/search', desc:'世界遺産の検索露出ログ検索(HTTP QUERY版・POSTと同一ハンドラ)', body:[{n:'keywords',req:true,s:['姫路城']}],
      res:{items:[{item_name:'姫路城',impression_count:3}],distance_origin:{name:'姫路城',flag:'🇯🇵',country:'日本',lat:34.84,lon:134.69}} },
    { method:'GET',  path:'/api/rail-station-cities', desc:'鉄道駅の近隣都市一覧取得', query:[{n:'name',req:true,s:'東京駅'}],
      res:{fetched:true,cities:[{city_name:'川崎市',distance_km:20,lat:35.5,lon:139.7}]} },
    { method:'POST', path:'/api/rail-station-cities', desc:'鉄道駅の近隣都市を検索・保存', body:[{n:'name',req:true,s:'東京駅'},{n:'lat',req:true,s:35.681},{n:'lon',req:true,s:139.767},{n:'force',s:false}],
      res:{fetched:true,cities:[{city_name:'川崎市',distance_km:20}]} },
    { method:'GET',  path:'/api/rail-station-fetched-list', desc:'近隣都市取得済みの駅名一覧',
      res:{names:['東京駅','新大阪駅']} },
    { method:'POST', path:'/api/airport-nearby-heritage', desc:'空港周辺300km以内の世界遺産を検索・差分記録', body:[{n:'name',req:true,s:'成田国際空港'},{n:'lat',req:true,s:35.77},{n:'lon',req:true,s:140.39}],
      res:{heritage:[{heritage_name:'日光の社寺',distance_km:95.2}],recordedCount:1} },
    { method:'POST', path:'/api/airport-nearby-airports', desc:'空港周辺1500km以内の他空港を検索・差分記録', body:[{n:'name',req:true,s:'成田国際空港'},{n:'code',req:true,s:'NRT'},{n:'lat',req:true,s:35.77},{n:'lon',req:true,s:140.39}],
      res:{airports:[{other_airport_name:'仁川国際空港',distance_km:1288.4}],recordedCount:1} },
    { method:'GET',  path:'/api/airport-nearby-heritage-airports', desc:'世界遺産が記録済みの空港名一覧',
      res:{names:['成田国際空港','羽田空港']} },
    { method:'GET',  path:'/api/airport-nearby-heritage-ranking', desc:'空港周辺世界遺産数ランキング用の記録済みデータ取得',
      res:{rows:[{airport_name:'成田国際空港',heritage_name:'日光の社寺',distance_km:95.2}]} },
    { method:'GET',  path:'/api/heritage-access/nearby-cities', desc:'指定緯度経度から500km以内の都市一覧', query:[{n:'lat',req:true,s:'35.36'},{n:'lon',req:true,s:'138.73'}],
      res:{cities:[{city_name:'富士宮市',country_code:'JP',city_lat:35.22,city_lon:138.62,population:130000,distance_km:15.3}],count:1,radius_km:500} },
    { method:'GET',  path:'/api/heritage-area-boxes', desc:'保存済みエリア枠(緯度経度矩形)一覧取得',
      res:{ok:true,areas:[{areaSeq:1,box:'box',topLeftLat:36.0,topLeftLon:138.0,bottomRightLat:35.0,bottomRightLon:139.0,createdAt:'2026-06-15T00:00:00.000Z',items:[{category:'other',name:'富士山',lat:35.36,lon:138.73}]}]} },
    { method:'POST', path:'/api/heritage-area-boxes', desc:'エリア枠(緯度経度矩形)を新規保存', body:[{n:'box',s:'box'},{n:'topLeft',req:true,s:{lat:36.0,lon:138.0}},{n:'bottomRight',req:true,s:{lat:35.0,lon:139.0}},{n:'items',s:[{category:'other',name:'富士山',lat:35.36,lon:138.73}]}],
      res:{ok:true,areaSeq:1,itemCount:1} },
    { method:'DELETE', path:'/api/heritage-area-boxes/:areaSeq', desc:'エリア枠を削除', path_params:['areaSeq'], pp:{areaSeq:'1'},
      res:{ok:true} },
    { method:'GET',  path:'/api/heritage-area/max-area-seq', desc:'エリア枠の最大エリア番号取得',
      res:{max:5} },
    { method:'GET',  path:'/api/heritage-area/areas/:areaSeq/items', desc:'エリア内保存済みアイテム名一覧(該当エリア番号付き)', path_params:['areaSeq'], pp:{areaSeq:'1'},
      res:{items:[{item_name:'富士山',category:'other',area_matches:[{key:'富士山',areas:'エリア#1'}]}]} },
    { method:'GET',  path:'/api/heritage-area/travel-categories', desc:'カテゴリグループ「Travel」に属するカテゴリ一覧',
      res:{categories:[{id:1,name:'観光地',color:'#6366f1',kw_count:12}]} },
    { method:'GET',  path:'/api/heritage-area/travel-categories/:id/keywords', desc:'Travelカテゴリ内キーワード一覧(検索露出件数付き)', path_params:['id'], pp:{id:'1'},
      res:{keywords:[{keyword:'富士山',count:5,heritage_point:{lat:35.36,lon:138.73}}]} },
    { method:'GET',  path:'/api/rail-station-nearby', desc:'鉄道駅の近隣地点(空港・世界遺産等)取得済みキャッシュ確認', query:[{n:'name',req:true,s:'東京駅'}],
      res:{fetched:true,points:[{point_type:'heritage',point_name:'皇居',point_lat:35.685,point_lon:139.753,distance_km:1.2}]} },
    { method:'POST', path:'/api/rail-station-nearby', desc:'鉄道駅の近隣地点(空港・世界遺産等)を検索・保存', body:[{n:'name',req:true,s:'東京駅'},{n:'lat',req:true,s:35.681},{n:'lon',req:true,s:139.767},{n:'force',s:false}],
      res:{fetched:true,points:[{point_type:'heritage',point_name:'皇居',point_lat:35.685,point_lon:139.753,distance_km:1.2}]} },
  ]},
  { group: '検索キーワード管理', endpoints: [
    { method:'GET',    path:'/api/search-keywords', desc:'登録済み検索キーワード一覧',
      res:{keywords:[{id:1,keyword:'cloudflare',totalCount:10,sections:'インフラ',created_at:'2026-06-15T00:00:00.000Z'}]} },
    { method:'POST',   path:'/api/search-keywords', desc:'検索キーワード登録', body:[{n:'keyword',req:true,s:'cloudflare'},{n:'totalCount',s:10},{n:'sections',s:'インフラ'}],
      res:{ok:true,id:1} },
    { method:'DELETE', path:'/api/search-keywords/:id', desc:'検索キーワード削除', path_params:['id'], pp:{id:'1'},
      res:{ok:true} },
  ]},
  { group: '管理', endpoints: [
    { method:'POST', path:'/api/admin/revoke-session', desc:'セッション強制無効化（管理者専用）', body:[{n:'userId',req:true,s:'nekoserver'}],
      res:{ok:true,revoked:1} },
  ]},
  { group: 'WASM モジュール', endpoints: [
    { method:'GET',  path:'/api/wasm-modules', desc:'WASMモジュール一覧(有効状態・最終コミット日時付き)',
      res:{modules:[{moduleId:'sha256',enabled:true,sourceFile:'src/wasm/sha256.rs',wasmPath:'public/wasm/sha256.wasm',sourceUpdatedAt:'2026-06-15T00:00:00.000Z',wasmBuiltAt:'2026-06-15T00:00:00.000Z'}]} },
    { method:'POST', path:'/api/wasm-modules', desc:'WASMモジュールの有効/無効設定', body:[{n:'moduleId',req:true,s:'sha256'},{n:'enabled',req:true,s:true}],
      res:{ok:true} },
    { method:'GET',  path:'/api/wasm-modules/source', desc:'WASMモジュールのソースコード取得(GitHub経由)', query:[{n:'id',req:true,s:'sha256'}],
      res:{path:'src/wasm/sha256.rs',content:'pub fn sha256(...) { ... }',githubUrl:'https://github.com/nekoserver/cloudflare-workers-github-oauth-1/blob/main/src/wasm/sha256.rs'} },
    { method:'POST', path:'/api/moondream-analyze', desc:'画像をMoondream VLM(@cf/moondream/moondream3.1-9B-A2B)で分析', body:[{n:'image',req:true,s:'data:image/png;base64,iVBORw0KGgo...'},{n:'prompt',s:'この画像に何が写っていますか'}],
      res:{analysis:'猫が写っています',usedModel:'@cf/moondream/moondream3.1-9B-A2B'} },
    { method:'DELETE', path:'/api/moondream-analyze-log/:id', desc:'Moondream分析呼び出しログを1件削除', path_params:['id'], pp:{id:'1'},
      res:{ok:true} },
    { method:'GET', path:'/api/gh/pr-list', desc:'gh-wasm(Rust実装)でリポジトリのプルリクエスト一覧をMarkdownテーブルへ整形して取得(/neko gh pr listと同じロジック)', query:[{n:'repo',req:true,s:'nekoserver/cloudflare-workers-github-oauth-1'}],
      res:{markdown:'## nekoserver/cloudflare-workers-github-oauth-1 のプルリクエスト一覧\\n| # | タイトル | 作成者 | 状態 | URL |\\n|---|---|---|---|---|\\n| 1600 | ... | nekoserver | open | https://github.com/... |'} },
  ]},
  { group: 'GitHub Issue添付 (/gh-attach, WASM)', endpoints: [
    { method:'POST', path:'/api/gh-attach/upload', desc:'画像をGitHubへアップロード(gh issue create --attachのWASM移植、実アップロードは専用のclassic PAT=GH_ATTACH_UPLOAD_TOKEN経由)', body:[{n:'owner',req:true,s:'nekoserver'},{n:'repo',req:true,s:'cloudflare-workers-github-oauth-1'},{n:'filename',req:true,s:'login.png'},{n:'dataUrl',req:true,s:'data:image/png;base64,iVBORw0KGgo...'}],
      res:{url:'https://github.com/user-attachments/assets/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'} },
    { method:'POST', path:'/api/gh-attach/create-issue', desc:'画像添付済みMarkdown本文でGitHub Issueを作成', body:[{n:'owner',req:true,s:'nekoserver'},{n:'repo',req:true,s:'cloudflare-workers-github-oauth-1'},{n:'title',req:true,s:'ログイン画面のバグ'},{n:'body',s:'![ログイン画面](https://github.com/user-attachments/assets/xxxxxxxx)'}],
      res:{url:'https://github.com/nekoserver/cloudflare-workers-github-oauth-1/issues/123',number:123} },
  ]},
  { group: 'その他', endpoints: [
    { method:'GET', path:'/api', desc:'API 情報・ルート一覧',
      res:{message:'Cloudflare Workers GitHub OAuth API',version:'1.0.0',authentication:{github_oauth:'GET /auth/github',logout:'GET /auth/logout'},endpoints:{public:['GET /api','GET /api/public'],protected:['GET /api/protected','GET /api/profile']}} },
    { method:'GET', path:'/api/public', desc:'認証不要テストエンドポイント',
      res:{message:'Public endpoint - no authentication required'} },
    { method:'GET', path:'/api/protected', desc:'認証テストエンドポイント',
      res:{message:'Protected endpoint - authenticated',user:'nekoserver'} },
    { method:'GET', path:'/api/cheese-fr', desc:'フランスチーズ一覧(名称・読み仮名の部分一致検索可)', query:[{n:'q',s:'コンテ'}],
      res:{items:[{seq_no:1,name_fr:'Comté',reading:'コンテ',ingredient:'牛乳',producer:'フランス東部',method:'非加熱圧搾',hardness:'ハード',notes:'ナッツのような風味',pairing:'白ワイン'}]} },
    { method:'GET', path:'/api/file-deps', desc:'TypeScriptファイル間の依存関係グラフ(ts_file_dependencies)',
      res:{nodes:['src/index.ts','src/views/aichat.ts'],edges:[{source:'src/index.ts',target:'src/views/aichat.ts'}]} },
    { method:'GET', path:'/api/file-history', desc:'TypeScriptファイルのコミット変更履歴', query:[{n:'file_path',req:true,s:'src/index.ts'},{n:'repo_id',s:'1'}],
      res:{ok:true,repo_id:1,file_path:'src/index.ts',history:[{commit_hash:'abc1234',commit_at:'2026-08-26T00:00:00Z',subject:'変更内容',lines_added:10,lines_deleted:2,functions_touched:2,function_names:['fetchHandler','renderPage']}],total:1} },
  ]},
  { group: 'Slack', endpoints: [
    { method:'GET',  path:'/api/settings/slack-notify', desc:'Slack通知設定の現在値取得(CF_AUTH_WEBHOOK_SECRETのBearer認証が必要。cf-auth等の外部サービスからの参照用で、このテスターのCookie認証では401になる)',
      res:{enabled:true} },
    { method:'POST', path:'/api/settings/slack-notify', desc:'Slack通知ON/OFF設定(ログイン失敗・PR要約・cf-auth通知等8箇所すべてに影響、既定OFF)', body:[{n:'enabled',req:true,s:true}],
      res:{ok:true,enabled:true} },
    { method:'POST', path:'/api/tsubuyaki', desc:'つぶやきをSlackへ通知投稿(Slackスラッシュコマンド /pts と同じ検証ロジックを共有)', body:[{n:'text',req:true,s:'今日は良い天気です'}],
      res:{ok:true} },
  ]},
];

let currentEp = null;
let openDescGi = -1; // 説明パネルが開いているグループ index
let _accordionMode = false; // アコーディオンモード: ONのとき非フォーカスセクションを自動で閉じる
let _currentFilter = ''; // 現在の検索キーワード（descパネルのハイライトに使用）
let _descMode = true; // trueのとき日本語説明を表示（▶ボタン非表示）
let _searchHits = { total: 0, sections: [] }; // 現在の検索ヒット情報
var _historyRows = []; // 履歴モーダルに読み込んだキーワード行
var _registeredKeywords = new Set(); // 登録済みキーワードのSet（✍️/🚫判定用）
var _histSwipeOpenItem = null, _histSwipeOpenInner = null; // 履歴スワイプ状態

// ── 他グループを閉じるヘルパー ────────────────────────
function collapseOtherGroups(openGi) {
  document.querySelectorAll('.group-block').forEach(bl => {
    if (bl.id === 'grp-' + openGi) return;
    const lbl = bl.querySelector('.group-label');
    const ep  = bl.querySelector('.group-endpoints');
    if (lbl && ep && !lbl.classList.contains('collapsed')) {
      lbl.classList.add('collapsed');
      ep.style.display = 'none';
    }
  });
}

// ── top nav ──────────────────────────────────────────
function renderTopNav() {
  const nav = document.getElementById('topnav');
  const endpointCount = APIS.reduce((sum, g) => sum + g.endpoints.length, 0);
  nav.innerHTML =
    '<span class="nav-home" title="APIテスター"><span>API</span><span class="nav-home-count">' + endpointCount + ' endpoints</span></span>' +
    APIS.map((g, i) =>
    \`<button class="nav-btn" id="navbtn-\${i}" onclick="jumpGroup(\${i})">\${esc(g.group)}</button>\`
    ).join('') +
    '<a class="workflow-browser-link" href="/wf-browser" title="ワークフローから参照されているAPIを確認">↗ 利用状況</a>';
}

function jumpGroup(gi) {
  // 1. descパネルが開いていたら内容を新しいグループに切り替える（閉じない）
  if (openDescGi >= 0) {
    updateDescPanelContent(gi);
  }

  // 2. ナビボタンのアクティブ切り替え
  document.querySelectorAll('.nav-btn').forEach((b, i) => b.classList.toggle('active', i === gi));

  const block = document.getElementById('grp-' + gi);
  if (!block) return;

  // 3. 対象以外のセクションを閉じる（ナビ選択時は常に）
  collapseOtherGroups(gi);

  // 4. 対象セクションを開く
  const label = block.querySelector('.group-label');
  const eps   = block.querySelector('.group-endpoints');
  if (label && eps) {
    label.classList.remove('collapsed');
    eps.style.display = '';
  }

  // 5. ハイライト
  if (label) {
    label.style.transition = 'background 0s';
    label.style.background = 'var(--hl)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      label.style.transition = 'background 1.5s ease';
      label.style.background = '';
    }));
  }

  // 6. #groups 内をスクロール（window をスクロールさせない）
  const groups = document.getElementById('groups');
  const relTop = block.getBoundingClientRect().top - groups.getBoundingClientRect().top + groups.scrollTop;
  groups.scrollTo({ top: relTop, behavior: 'smooth' });
}

// ── sidebar ──────────────────────────────────────────
function renderSidebar(filter, sectionsOpen) {
  const fl = (filter || '').toLowerCase();
  const container = document.getElementById('groups');
  container.innerHTML = '';
  APIS.forEach((g, gi) => {
    const filtered = g.endpoints.filter(ep =>
      !fl ||
      ep.path.toLowerCase().includes(fl) ||
      ep.method.toLowerCase().includes(fl) ||
      ep.desc.toLowerCase().includes(fl)
    );
    if (!filtered.length) return;

    const block = document.createElement('div');
    block.className = 'group-block';
    block.id = 'grp-' + gi;

    // グループラベル行
    const label = document.createElement('div');
    label.className = 'group-label';
    label.id = 'lbl-' + gi;

    // 左側: 折りたたみ三角 + グループ名テキスト
    const textWrap = document.createElement('span');
    textWrap.className = 'group-label-text';
    textWrap.innerHTML = \`<span class="toggle-arrow">▾</span>\${esc(g.group)}\`;
    textWrap.onclick = () => {
      const collapsed = !label.classList.contains('collapsed');
      if (!collapsed && _accordionMode) collapseOtherGroups(gi);
      label.classList.toggle('collapsed', collapsed);
      eps.style.display = collapsed ? 'none' : '';
    };

    label.appendChild(textWrap);

    // 右端: 説明パネル展開ボタン ▶（descModeのときは非表示）
    if (!_descMode) {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'expand-btn';
      expandBtn.title = '説明パネルを開く';
      expandBtn.textContent = '▶';
      expandBtn.onclick = (e) => {
        e.stopPropagation();
        toggleDescPanel(gi, g, expandBtn);
      };
      label.appendChild(expandBtn);
    }

    const eps = document.createElement('div');
    eps.className = 'group-endpoints';
    if (!sectionsOpen) {
      label.classList.add('collapsed');
      eps.style.display = 'none';
    }

    filtered.forEach(ep => {
      const item = document.createElement('div');
      item.className = 'ep-item';
      if (_descMode) {
        item.innerHTML =
          \`<span class="badge badge-\${ep.method}">\${highlight(ep.method, fl)}</span>\` +
          \`<span class="ep-path" title="\${esc(ep.path)}">\${highlight(ep.desc, fl)}</span>\`;
      } else {
        item.innerHTML =
          \`<span class="badge badge-\${ep.method}">\${highlight(ep.method, fl)}</span>\` +
          \`<span class="ep-path" title="\${esc(ep.path)}">\${highlight(ep.path, fl)}</span>\`;
      }
      item.onclick = () => selectEndpoint(ep, item);
      eps.appendChild(item);
    });

    block.appendChild(label);
    block.appendChild(eps);
    container.appendChild(block);
  });
}

function filterEndpoints(v) {
  _currentFilter = v || '';
  renderSidebar(v, true); // フィルタ中は展開して表示
  if (v) document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  // descパネルが開いていたらハイライトを更新
  if (openDescGi >= 0) updateDescPanelContent(openDescGi);
  // ナビバーのヒットセクションを中抜き表示 & ヒット情報を集計
  const fl = (v || '').toLowerCase();
  var total = 0;
  var sections = [];
  APIS.forEach(function(g, i) {
    const btn = document.getElementById('navbtn-' + i);
    var cnt = 0;
    if (fl) {
      g.endpoints.forEach(function(ep) {
        if (ep.path.toLowerCase().includes(fl) ||
            ep.method.toLowerCase().includes(fl) ||
            ep.desc.toLowerCase().includes(fl)) cnt++;
      });
    }
    if (btn) btn.classList.toggle('has-match', cnt > 0);
    if (cnt > 0) { total += cnt; sections.push({ name: g.group, count: cnt }); }
  });
  _searchHits = { total: total, sections: sections };
  setSearchBtnMode(fl && total > 0 ? 'save' : 'history');
  var clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.style.display = fl ? 'block' : 'none';
}

function clearSearchInput() {
  var inp = document.getElementById('search-input');
  if (inp) { inp.value = ''; inp.focus(); }
  filterEndpoints('');
}

function setSearchBtnMode(mode) {
  var saveBtn = document.getElementById('search-save-btn');
  var histBtn = document.getElementById('search-history-btn');
  if (!saveBtn || !histBtn) return;
  if (mode === 'save') {
    var alreadyRegistered = _registeredKeywords.has((_currentFilter || '').trim().toLowerCase());
    saveBtn.textContent = alreadyRegistered ? '🚫' : '✍️';
    saveBtn.title = alreadyRegistered ? '登録済みのキーワードです' : '検索キーワードを登録';
    saveBtn.style.visibility = 'visible';
    histBtn.style.visibility = 'hidden';
  } else {
    saveBtn.style.visibility = 'hidden';
    histBtn.style.visibility = 'visible';
  }
}

function resetSearch() {
  var inp = document.getElementById('search-input');
  if (inp) { inp.value = ''; filterEndpoints(''); }
}

function openSearchSaveModal() {
  var overlay = document.getElementById('search-save-modal-overlay');
  var input = document.getElementById('search-save-input');
  var stats = document.getElementById('search-save-stats');
  if (!overlay) return;
  input.value = _currentFilter;
  var lines = _currentFilter
    ? [_currentFilter + ' の検索結果: ' + _searchHits.total + '件（' + _searchHits.sections.length + 'セクション）']
    : [];
  _searchHits.sections.forEach(function(s) {
    lines.push('・' + s.name + ': ' + s.count + '件');
  });
  stats.textContent = lines.join('\\n');
  stats.style.whiteSpace = 'pre-line';
  overlay.classList.add('open');
  setTimeout(function() { input.focus(); input.select(); }, 50);
}

function closeSearchSaveModal(e) {
  if (e && e.target !== document.getElementById('search-save-modal-overlay')) return;
  document.getElementById('search-save-modal-overlay').classList.remove('open');
  resetSearch();
}

async function submitSearchKeyword() {
  var input = document.getElementById('search-save-input');
  var kw = (input.value || '').trim();
  if (!kw) { input.focus(); return; }
  var btn = document.getElementById('search-save-submit');
  btn.disabled = true;
  btn.textContent = '登録中…';
  try {
    var res = await fetch('/api/search-keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ keyword: kw, totalCount: _searchHits.total, sections: _searchHits.sections })
    });
    if (!res.ok) throw new Error('failed');
    _registeredKeywords.add(kw.toLowerCase());
    btn.textContent = '登録済み ✓';
    setTimeout(function() {
      document.getElementById('search-save-modal-overlay').classList.remove('open');
      btn.disabled = false;
      btn.textContent = '登録する';
      resetSearch();
    }, 1000);
  } catch(e) {
    alert('登録に失敗しました');
    btn.disabled = false;
    btn.textContent = '登録する';
  }
}

async function openSearchHistoryModal() {
  var overlay = document.getElementById('search-history-modal-overlay');
  var body = document.getElementById('search-history-body');
  var histSearchInp = document.getElementById('history-search-input');
  if (!overlay || !body) return;
  body.innerHTML = '<div style="color:var(--muted);padding:12px 0;">読み込み中…</div>';
  if (histSearchInp) histSearchInp.value = '';
  setHistoryRegisterBtn('');
  overlay.style.display = 'flex';
  try {
    var res = await fetch('/api/search-keywords', { credentials: 'include' });
    if (!res.ok) throw new Error('failed');
    var data = await res.json();
    _historyRows = data.keywords || [];
    _registeredKeywords = new Set(_historyRows.map(function(r) { return r.keyword.toLowerCase(); }));
    setSearchBtnMode(_currentFilter && _searchHits.total > 0 ? 'save' : 'history');
    renderHistoryTable('');
  } catch(e) {
    body.innerHTML = '<div style="color:var(--danger,#cf222e);padding:12px 0;">読み込みに失敗しました</div>';
  }
}

function closeHistSwipeOpen() {
  if (_histSwipeOpenInner) {
    _histSwipeOpenInner.style.transition = 'transform 0.2s ease';
    _histSwipeOpenInner.style.transform = 'translateX(0)';
  }
  if (_histSwipeOpenItem) _histSwipeOpenItem.classList.remove('swipe-open');
  _histSwipeOpenItem = null; _histSwipeOpenInner = null;
}

function addHistSwipeBehavior(item, inner, onDelete) {
  var startX = 0, dragging = false, moved = false;
  var THRESHOLD = 50, BTN_W = 68;
  function isOpen() { return _histSwipeOpenItem === item; }
  function onStart(x) { startX = x; dragging = true; moved = false; }
  function onMove(x) {
    if (!dragging) return;
    var dx = x - startX;
    if (Math.abs(dx) < 4) return;
    moved = true;
    var base = isOpen() ? -BTN_W : 0;
    var tx = Math.max(-BTN_W, Math.min(0, base + dx));
    inner.style.transition = 'none';
    inner.style.transform = 'translateX(' + tx + 'px)';
  }
  function onEnd(x) {
    if (!dragging) return;
    dragging = false;
    var dx = x - startX;
    inner.style.transition = 'transform 0.2s ease';
    if (!moved) { if (!isOpen()) { onDelete(); } return; }
    if (isOpen()) {
      if (dx > BTN_W / 2) { closeHistSwipeOpen(); }
      else { inner.style.transform = 'translateX(-' + BTN_W + 'px)'; }
    } else {
      if (-dx > THRESHOLD) {
        if (_histSwipeOpenItem && _histSwipeOpenItem !== item) closeHistSwipeOpen();
        inner.style.transform = 'translateX(-' + BTN_W + 'px)';
        item.classList.add('swipe-open');
        _histSwipeOpenItem = item; _histSwipeOpenInner = inner;
      } else {
        inner.style.transform = 'translateX(0)';
      }
    }
  }
  item.addEventListener('touchstart', function(e) { onStart(e.touches[0].clientX); }, { passive: true });
  item.addEventListener('touchmove', function(e) { onMove(e.touches[0].clientX); }, { passive: true });
  item.addEventListener('touchend', function(e) { onEnd(e.changedTouches[0].clientX); });
  var mouseDown = false;
  inner.addEventListener('mousedown', function(e) { if (e.button !== 0) return; mouseDown = true; onStart(e.clientX); });
  document.addEventListener('mousemove', function(e) { if (!mouseDown) return; onMove(e.clientX); });
  document.addEventListener('mouseup', function(e) { if (!mouseDown) return; mouseDown = false; onEnd(e.clientX); });
}

function deleteHistoryRow(id, keyword, item) {
  fetch('/api/search-keywords/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'include' })
    .then(function(res) { if (!res.ok) throw new Error('failed'); })
    .then(function() {
      item.style.overflow = 'hidden';
      item.style.height = item.offsetHeight + 'px';
      item.style.transition = 'opacity 0.2s';
      item.style.opacity = '0';
      setTimeout(function() {
        item.style.transition = 'height 0.25s, padding 0.25s, border 0.25s';
        item.style.height = '0';
        item.style.borderBottomWidth = '0';
        setTimeout(function() {
          item.remove();
          _historyRows = _historyRows.filter(function(r) { return r.id !== id; });
          _registeredKeywords.delete(keyword.toLowerCase());
          setSearchBtnMode(_currentFilter && _searchHits.total > 0 ? 'save' : 'history');
          var body = document.getElementById('search-history-body');
          if (body && !body.querySelector('.hist-row')) {
            body.innerHTML = '<div style="color:var(--muted);padding:12px 0;">登録キーワードはありません</div>';
          }
        }, 260);
      }, 220);
    })
    .catch(function() { alert('削除に失敗しました'); });
}

function renderHistoryTable(filter) {
  var body = document.getElementById('search-history-body');
  if (!body) return;
  closeHistSwipeOpen();
  var fl = (filter || '').trim().toLowerCase();
  var rows = _historyRows.filter(function(r) {
    return !fl || r.keyword.toLowerCase().indexOf(fl) !== -1;
  });
  if (!_historyRows.length) {
    body.innerHTML = '<div style="color:var(--muted);padding:12px 0;">登録キーワードはありません</div>';
    return;
  }
  if (!rows.length) {
    body.innerHTML = '<div style="color:var(--muted);padding:12px 0;">一致するキーワードはありません</div>';
    return;
  }
  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:grid;grid-template-columns:1fr auto auto auto;border-bottom:2px solid var(--border);';
  ['キーワード','件数','セクション数','登録日時'].forEach(function(t, i) {
    var th = document.createElement('div');
    th.textContent = t;
    th.style.cssText = 'padding:4px 8px;color:var(--muted);font-weight:600;font-size:11px;' + (i > 0 ? 'text-align:right;' : '');
    hdr.appendChild(th);
  });
  var frag = document.createDocumentFragment();
  frag.appendChild(hdr);
  rows.forEach(function(r) {
    var dt = r.recorded_at ? r.recorded_at.replace('T', ' ').slice(0, 16) : '';
    var item = document.createElement('div');
    item.className = 'hist-row';
    var delBtn = document.createElement('button');
    delBtn.className = 'hist-row-del';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', function(e) { e.stopPropagation(); deleteHistoryRow(r.id, r.keyword, item); });
    var inner = document.createElement('div');
    inner.className = 'hist-row-inner';
    var kw = document.createElement('div');
    kw.className = 'hist-row-kw';
    kw.textContent = r.keyword;
    kw.addEventListener('click', function() { applyHistoryKeyword(r.keyword); });
    var cnt = document.createElement('div');
    cnt.className = 'hist-row-cnt';
    cnt.textContent = r.total_count;
    var sec = document.createElement('div');
    sec.className = 'hist-row-sec';
    sec.textContent = r.section_count;
    var dtEl = document.createElement('div');
    dtEl.className = 'hist-row-dt';
    dtEl.textContent = dt;
    inner.appendChild(kw);
    inner.appendChild(cnt);
    inner.appendChild(sec);
    inner.appendChild(dtEl);
    item.appendChild(delBtn);
    item.appendChild(inner);
    addHistSwipeBehavior(item, inner, function() { applyHistoryKeyword(r.keyword); });
    frag.appendChild(item);
  });
  body.innerHTML = '';
  body.appendChild(frag);
}

function filterHistoryList(v) {
  var fl = (v || '').trim().toLowerCase();
  var hasMatch = _historyRows.some(function(r) { return r.keyword.toLowerCase().indexOf(fl) !== -1; });
  setHistoryRegisterBtn(fl && !hasMatch ? fl : '');
  renderHistoryTable(v);
}

function setHistoryRegisterBtn(keyword) {
  var btn = document.getElementById('history-register-btn');
  if (!btn) return;
  if (keyword) {
    btn.textContent = '登録';
    btn.setAttribute('data-kw', keyword);
    btn.style.display = 'inline-block';
  } else {
    btn.style.display = 'none';
  }
}

async function registerFromHistorySearch() {
  var btn = document.getElementById('history-register-btn');
  var kw = btn ? btn.getAttribute('data-kw') : '';
  if (!kw) return;
  btn.disabled = true;
  btn.textContent = '登録中…';
  try {
    var res = await fetch('/api/search-keywords', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: kw, totalCount: 0, sections: [] })
    });
    if (!res.ok) throw new Error('failed');
    var histSearchInp = document.getElementById('history-search-input');
    if (histSearchInp) histSearchInp.value = '';
    btn.style.display = 'none';
    var freshRes = await fetch('/api/search-keywords', { credentials: 'include' });
    if (freshRes.ok) {
      var data = await freshRes.json();
      _historyRows = data.keywords || [];
      _registeredKeywords = new Set(_historyRows.map(function(r) { return r.keyword.toLowerCase(); }));
      setSearchBtnMode(_currentFilter && _searchHits.total > 0 ? 'save' : 'history');
      renderHistoryTable('');
    }
  } catch(e) {
    btn.textContent = '登録';
    btn.disabled = false;
  }
}

function closeSearchHistoryModal(e) {
  if (e && e.target !== document.getElementById('search-history-modal-overlay')) return;
  document.getElementById('search-history-modal-overlay').style.display = 'none';
}

function applyHistoryKeyword(kw) {
  document.getElementById('search-history-modal-overlay').style.display = 'none';
  var inp = document.getElementById('search-input');
  if (inp) { inp.value = kw; filterEndpoints(kw); }
}

// ── 説明パネル ────────────────────────────────────────
function setDescPanelCookie(gi) {
  const val = gi >= 0 ? String(gi) : 'off';
  document.cookie = 'apis_desc_panel_gi=' + val + ';path=/;max-age=31536000;SameSite=Lax';
}

function updateDescPanelPosition(gi) {
  const panel = document.getElementById('desc-panel');
  const bodyRow = document.getElementById('body-row');
  if (!panel || !bodyRow) return;
  const lbl = document.getElementById('lbl-' + gi);
  const btnEl = lbl ? lbl.querySelector('.expand-btn') : null;
  const rowRect = bodyRow.getBoundingClientRect();
  let topOffset = 0;
  if (btnEl) {
    const btnRect = btnEl.getBoundingClientRect();
    topOffset = Math.max(0, btnRect.top - rowRect.top);
  }
  panel.style.top = topOffset + 'px';
  panel.style.maxHeight = (rowRect.height - topOffset) + 'px';
}

function updateDescPanelContent(gi) {
  const g = APIS[gi];
  if (!g) return;
  openDescGi = gi;
  setDescPanelCookie(gi);

  updateDescPanelPosition(gi);

  document.querySelectorAll('.expand-btn').forEach(b => b.classList.remove('open'));
  const lbl = document.getElementById('lbl-' + gi);
  if (lbl) lbl.querySelector('.expand-btn').classList.add('open');

  document.getElementById('desc-panel-title').textContent = g.group;
  const list = document.getElementById('desc-panel-list');
  list.innerHTML = g.endpoints.map((ep, ei) =>
    \`<div class="desc-item" onclick="selectFromDesc(\${gi},\${ei})">
      <span class="badge badge-\${ep.method}">\${highlight(ep.method, _currentFilter)}</span>
      <span class="desc-text">\${highlight(ep.desc, _currentFilter)}</span>
    </div>\`
  ).join('');
}

function toggleDescPanel(gi, g, btnEl) {
  const panel = document.getElementById('desc-panel');
  // 同じボタンを押したら閉じる
  if (openDescGi === gi && panel.classList.contains('open')) {
    closeDescPanel();
    return;
  }

  updateDescPanelContent(gi);
  panel.classList.add('open');
}

function closeDescPanel() {
  document.getElementById('desc-panel').classList.remove('open');
  document.querySelectorAll('.expand-btn').forEach(b => b.classList.remove('open'));
  openDescGi = -1;
  setDescPanelCookie(-1);
}

function selectFromDesc(gi, ei) {
  const ep = APIS[gi].endpoints[ei];
  if (!ep) return;
  // サイドバーの対応アイテムを探してクリック状態にする
  const block = document.getElementById('grp-' + gi);
  if (block) {
    const items = block.querySelectorAll('.ep-item');
    if (items[ei]) {
      document.querySelectorAll('.ep-item').forEach(el => el.classList.remove('active'));
      items[ei].classList.add('active');
    }
  }
  selectEndpoint(ep, document.createElement('div'));
}

// ── endpoint detail ───────────────────────────────────
function selectEndpoint(ep, item) {
  document.querySelectorAll('.ep-item').forEach(el => el.classList.remove('active'));
  item.classList.add('active');
  currentEp = ep;
  document.getElementById('welcome').style.display = 'none';
  const d = document.getElementById('detail');
  d.style.display = 'flex';
  document.getElementById('d-badge').textContent = ep.method;
  document.getElementById('d-badge').className = 'badge badge-' + ep.method;
  document.getElementById('d-path').textContent = ep.path;
  document.getElementById('d-desc').textContent = ep.desc || '';
  document.getElementById('response-sec').style.display = 'none';

  const pathParams = ep.path_params || [];
  const pathSec  = document.getElementById('path-params-sec');
  const pathBody = document.getElementById('path-params-body');
  if (pathParams.length) {
    pathBody.innerHTML = pathParams.map(p =>
      \`<tr><td><code>:\${esc(p)}</code></td><td><input type="text" id="pp-\${esc(p)}" placeholder="\${esc(p)}" value="\${ep.pp && ep.pp[p] !== undefined ? esc(String(ep.pp[p])) : ''}"></td></tr>\`
    ).join('');
    pathSec.style.display = '';
  } else { pathSec.style.display = 'none'; }

  const queryParams = ep.query || [];
  const qSec  = document.getElementById('query-params-sec');
  const qBody = document.getElementById('query-params-body');
  if (queryParams.length) {
    qBody.innerHTML = queryParams.map(p =>
      \`<tr><td><code>\${esc(p.n)}</code></td><td>\${p.req?'<span class="req-badge">必須</span>':''}</td><td><input type="text" id="qp-\${esc(p.n)}" placeholder="\${esc(p.n)}" value="\${p.s !== undefined ? esc(String(p.s)) : ''}"></td></tr>\`
    ).join('');
    qSec.style.display = '';
  } else { qSec.style.display = 'none'; }

  const bodyFields = ep.body || [];
  const bSec  = document.getElementById('body-sec');
  const bArea = document.getElementById('body-area');
  if (bodyFields.length) {
    const obj = {};
    bodyFields.forEach(f => { obj[f.n] = f.s !== undefined ? f.s : ''; });
    bArea.value = JSON.stringify(obj, null, 2);
    bSec.style.display = '';
  } else { bSec.style.display = 'none'; }

  // ── モデル選択 ──────────────────────────────────────
  var msEl = document.getElementById('model-select-sec');
  var msDd = document.getElementById('model-select-dropdown');
  if (ep.modelSelect && ep.modelSelect.length) {
    var curModel = '';
    try { curModel = JSON.parse(bArea.value).model || ''; } catch(e) {}
    msDd.innerHTML = ep.modelSelect.map(function(m) {
      return '<option value="' + esc(m.value) + '"' + (m.value === curModel ? ' selected' : '') + '>' + esc(m.label) + '</option>';
    }).join('');
    msEl.style.display = '';
  } else {
    msEl.style.display = 'none';
  }

  // ── リクエスト例 ──────────────────────────────────────
  var reqExSec = document.getElementById('req-example-sec');
  var reqNoteList = document.getElementById('req-note-list');
  var reqExCode = document.getElementById('req-example-code');
  var curlLines = [];
  var resolvedPath = ep.path;
  (ep.path_params || []).forEach(function(p) {
    var val = ep.pp && ep.pp[p] !== undefined ? String(ep.pp[p]) : ':' + p;
    resolvedPath = resolvedPath.split(':' + p).join(encodeURIComponent(val));
  });
  var qParts = (ep.query || []).filter(function(p) { return p.s !== undefined; }).map(function(p) {
    return encodeURIComponent(p.n) + '=' + encodeURIComponent(String(p.s));
  });
  if (qParts.length) resolvedPath += '?' + qParts.join('&');
  var BSLNL = String.fromCharCode(32, 92, 10) + '  ';
  var SQ = String.fromCharCode(39);
  curlLines.push('curl -X ' + ep.method + ' ' + SQ + window.location.origin + resolvedPath + SQ);
  curlLines.push('-H ' + SQ + 'Cookie: auth_token=<JWT_TOKEN>' + SQ);
  if (ep.body && ep.body.length) {
    var sampleObj = {};
    ep.body.forEach(function(f) { sampleObj[f.n] = f.s !== undefined ? f.s : (f.req ? '<必須>' : null); });
    curlLines.push('-H ' + SQ + 'Content-Type: application/json' + SQ);
    curlLines.push('-d ' + SQ + JSON.stringify(sampleObj) + SQ);
  }
  reqExCode.textContent = curlLines.join(BSLNL);
  var isPublic = ep.path === '/api/public' || ep.path === '/api';
  var noteHtml = '';
  if (!isPublic) noteHtml += '<span class="req-note req-note-auth">認証必須</span>';
  (ep.body || []).filter(function(f) { return f.req; }).forEach(function(f) {
    noteHtml += '<span class="req-note req-note-null">' + esc(f.n) + ': null 不可</span>';
  });
  (ep.query || []).filter(function(q) { return q.req; }).forEach(function(q) {
    noteHtml += '<span class="req-note req-note-null">?' + esc(q.n) + ': null 不可</span>';
  });
  reqNoteList.innerHTML = noteHtml;
  reqExSec.style.display = '';

  // ── レスポンス例 ──────────────────────────────────────
  var resExSec = document.getElementById('res-example-sec');
  var resExCode = document.getElementById('res-example-code');
  if (ep.res !== undefined) {
    resExCode.innerHTML = renderResAnnotated(ep.res, 0);
    resExSec.style.display = '';
  } else {
    resExSec.style.display = 'none';
  }
}

function renderResAnnotated(val, depth) {
  var pad = '';
  var pad1 = '';
  for (var i = 0; i < depth; i++) pad += '  ';
  for (var i = 0; i <= depth; i++) pad1 += '  ';
  if (val === null) return '<span style="color:var(--muted)">null</span><span class="type-badge"> // null</span>';
  if (typeof val === 'boolean') return '<span style="color:#0969da">' + val + '</span><span class="type-badge"> // boolean</span>';
  if (typeof val === 'number') return '<span style="color:#0969da">' + val + '</span><span class="type-badge"> // number</span>';
  if (typeof val === 'string') return '<span style="color:#1a7f37">"' + esc(val) + '"</span><span class="type-badge"> // string</span>';
  if (Array.isArray(val)) {
    if (!val.length) return '<span style="color:var(--muted)">[]</span><span class="type-badge"> // array</span>';
    var items = val.map(function(item) { return pad1 + renderResAnnotated(item, depth + 1); });
    return '[' + String.fromCharCode(10) + items.join(',' + String.fromCharCode(10)) + String.fromCharCode(10) + pad + ']<span class="type-badge"> // array(' + val.length + ')</span>';
  }
  if (typeof val === 'object') {
    var keys = Object.keys(val);
    if (!keys.length) return '{}';
    var lines = keys.map(function(k) {
      return pad1 + '<span style="color:var(--text)">"' + esc(k) + '"</span>: ' + renderResAnnotated(val[k], depth + 1);
    });
    return '{' + String.fromCharCode(10) + lines.join(',' + String.fromCharCode(10)) + String.fromCharCode(10) + pad + '}';
  }
  return esc(String(val));
}

// ── モデル選択変更 ─────────────────────────────────────
function onModelSelectChange(modelValue) {
  var bArea = document.getElementById('body-area');
  if (!bArea) return;
  try {
    var obj = JSON.parse(bArea.value);
    obj.model = modelValue;
    bArea.value = JSON.stringify(obj, null, 2);
  } catch(e) {}
  rebuildCurlFromBody();
}

function rebuildCurlFromBody() {
  if (!currentEp) return;
  var reqExCode = document.getElementById('req-example-code');
  if (!reqExCode) return;
  var curlLines = [];
  var resolvedPath = currentEp.path;
  (currentEp.path_params || []).forEach(function(p) {
    var val = currentEp.pp && currentEp.pp[p] !== undefined ? String(currentEp.pp[p]) : ':' + p;
    resolvedPath = resolvedPath.split(':' + p).join(encodeURIComponent(val));
  });
  var qParts = (currentEp.query || []).filter(function(p) { return p.s !== undefined; }).map(function(p) {
    return encodeURIComponent(p.n) + '=' + encodeURIComponent(String(p.s));
  });
  if (qParts.length) resolvedPath += '?' + qParts.join('&');
  var BSLNL = String.fromCharCode(32, 92, 10) + '  ';
  var SQ = String.fromCharCode(39);
  curlLines.push('curl -X ' + currentEp.method + ' ' + SQ + window.location.origin + resolvedPath + SQ);
  curlLines.push('-H ' + SQ + 'Cookie: auth_token=<JWT_TOKEN>' + SQ);
  if (currentEp.body && currentEp.body.length) {
    var bArea = document.getElementById('body-area');
    var bodyText = bArea ? bArea.value : '';
    curlLines.push('-H ' + SQ + 'Content-Type: application/json' + SQ);
    try {
      curlLines.push('-d ' + SQ + JSON.stringify(JSON.parse(bodyText)) + SQ);
    } catch(e) {
      curlLines.push('-d ' + SQ + bodyText + SQ);
    }
  }
  reqExCode.textContent = curlLines.join(BSLNL);
}

// ── send ─────────────────────────────────────────────
async function sendRequest() {
  if (!currentEp) return;
  const btn = document.getElementById('send-btn');
  btn.disabled = true;
  btn.textContent = '送信中…';
  try {
    let path = currentEp.path;
    (currentEp.path_params || []).forEach(p => {
      const v = document.getElementById('pp-' + p)?.value ?? '';
      path = path.replace(':' + p, encodeURIComponent(v));
    });
    const qps = [];
    (currentEp.query || []).forEach(p => {
      const v = document.getElementById('qp-' + p.n)?.value ?? '';
      if (v) qps.push(encodeURIComponent(p.n) + '=' + encodeURIComponent(v));
    });
    if (qps.length) path += '?' + qps.join('&');

    const opts = { method: currentEp.method, headers: { 'Content-Type': 'application/json' } };
    if (['POST','PUT','PATCH','DELETE','QUERY'].includes(currentEp.method) && currentEp.body?.length) {
      opts.body = document.getElementById('body-area').value;
    }

    const t0 = Date.now();
    const res = await fetch(path, opts);
    const elapsed = Date.now() - t0;
    const text = await res.text();
    let pretty = text;
    try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch {}

    const statusEl = document.getElementById('res-status');
    statusEl.textContent = res.status + ' ' + res.statusText;
    statusEl.className = res.ok ? 'status-ok' : 'status-err';
    document.getElementById('res-time').textContent = elapsed + ' ms';
    document.getElementById('res-body').textContent = pretty;
    document.getElementById('response-sec').style.display = '';
  } finally {
    btn.disabled = false;
    btn.textContent = '送信';
  }
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function highlight(text, query) {
  const escaped = esc(text);
  if (!query) return escaped;
  const q = esc(query).toLowerCase();
  if (!q) return escaped;
  const lower = escaped.toLowerCase();
  let result = '';
  let i = 0;
  while (i < escaped.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) { result += escaped.slice(i); break; }
    result += escaped.slice(i, idx) +
      '<mark class="hl-match">' + escaped.slice(idx, idx + q.length) + '</mark>';
    i = idx + q.length;
  }
  return result;
}

function flashNavBtns(count) {
  var btns = Array.from(document.querySelectorAll('.nav-btn'));
  if (!btns.length) return;
  // フェーズ1: 全ボタンを count 回同時点滅（500ms以内に収める）
  var p1Step = Math.max(20, Math.floor(500 / (count * 2)));
  var i = 0;
  var iv1 = setInterval(function() {
    if (i >= count * 2) {
      clearInterval(iv1);
      btns.forEach(function(b) { b.classList.remove('nav-flash'); });
      // フェーズ2: 左端から右端へ1つずつ点灯（残り500ms以内）
      var p2Step = Math.max(20, Math.floor(500 / btns.length));
      var j = 0;
      var iv2 = setInterval(function() {
        btns.forEach(function(b) { b.classList.remove('nav-flash'); });
        if (j >= btns.length) { clearInterval(iv2); return; }
        btns[j].classList.add('nav-flash');
        j++;
      }, p2Step);
      return;
    }
    btns.forEach(function(b) { b.classList.toggle('nav-flash', i % 2 === 0); });
    i++;
  }, p1Step);
}

renderTopNav();
const _sidebarOpen = (document.cookie.split(';').find(c => c.trim().startsWith('user_apis_sidebar_open='))?.split('=')[1] ?? 'off').trim();
_accordionMode = (document.cookie.split(';').find(c => c.trim().startsWith('user_apis_sidebar_accordion='))?.split('=')[1] ?? 'off').trim() === 'on';
_descMode = (document.cookie.split(';').find(c => c.trim().startsWith('user_apis_desc_mode='))?.split('=')[1] ?? 'on').trim() !== 'off';
renderSidebar(null, _sidebarOpen === 'on');
(function initNavFlash() {
  var raw = (document.cookie.split(';').find(function(c) { return c.trim().startsWith('user_apis_nav_flash='); })?.split('=')[1] ?? '7').trim();
  if (raw === 'off') return;
  var n = parseInt(raw, 10);
  if (isNaN(n) || n <= 0) n = 7;
  flashNavBtns(n);
})();
(function restoreDescPanel() {
  const raw = (document.cookie.split(';').find(c => c.trim().startsWith('apis_desc_panel_gi='))?.split('=')[1] ?? 'off').trim();
  const gi = parseInt(raw, 10);
  if (!isNaN(gi) && gi >= 0 && APIS[gi]) {
    updateDescPanelContent(gi);
    const panel = document.getElementById('desc-panel');
    if (panel) panel.classList.add('open');
  }
})();
</script>
<div id="search-history-modal-overlay" onclick="closeSearchHistoryModal(event)" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1001;align-items:center;justify-content:center;">
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;min-width:360px;max-width:560px;width:92%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.18);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <h3 style="margin:0;font-size:14px;color:var(--text);">登録キーワード履歴（最新20件）</h3>
      <button onclick="closeSearchHistoryModal()" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--muted);padding:2px 6px;">✕</button>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;">
      <input id="history-search-input" type="text" placeholder="キーワードを検索…" oninput="filterHistoryList(this.value)" style="flex:1;padding:5px 8px;font-size:12px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);outline:none;">
      <button id="history-register-btn" onclick="registerFromHistorySearch()" style="display:none;padding:4px 10px;font-size:12px;background:var(--link);color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;">登録</button>
    </div>
    <div id="search-history-body" style="overflow-y:auto;flex:1;font-size:12px;"></div>
  </div>
</div>
<div id="search-save-modal-overlay" onclick="closeSearchSaveModal(event)">
  <div id="search-save-modal">
    <h3>検索キーワードを登録</h3>
    <input id="search-save-input" type="text" placeholder="キーワード">
    <div id="search-save-stats"></div>
    <div id="search-save-modal-btns">
      <button id="search-save-cancel" onclick="closeSearchSaveModal()">キャンセル</button>
      <button id="search-save-submit" onclick="submitSearchKeyword()">登録する</button>
    </div>
  </div>
</div>
</body>
</html>`;
}
