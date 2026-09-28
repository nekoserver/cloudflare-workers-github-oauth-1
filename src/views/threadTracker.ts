import { escapeHtml } from '../utils/html';

/** Search and continue AI responses that belong to a persistent re-question thread. */
export function getThreadTrackerPage(username: string): string {
  const safeUsername = escapeHtml(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>再質問スレッド検索</title>
  <style>
    :root{color-scheme:dark;--bg:#0d1117;--panel:#161b22;--border:#30363d;--text:#e6edf3;--muted:#8b949e;--accent:#58a6ff;--accent-bg:#1f6feb22;--danger:#f85149}
    @media(prefers-color-scheme:light){:root{color-scheme:light;--bg:#f6f8fa;--panel:#fff;--border:#d0d7de;--text:#24292f;--muted:#57606a;--accent:#0969da;--accent-bg:#ddf4ff;--danger:#cf222e}}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    header{height:58px;padding:0 24px;display:flex;align-items:center;gap:16px;border-bottom:1px solid var(--border);background:var(--panel)}header h1{margin:0;font-size:17px;flex:1}a{color:var(--accent);text-decoration:none}.user{color:var(--muted);font-size:12px}
    main{max-width:1120px;margin:auto;padding:30px 24px 60px}.intro h2{margin:0 0 5px;font-size:24px}.intro p{margin:0;color:var(--muted)}
    .search-panel{margin:22px 0 14px;padding:16px;border:1px solid var(--border);border-radius:12px;background:var(--panel)}.search-row{display:flex;gap:8px}.search{flex:1;min-width:0;padding:11px 13px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:15px;outline:none}.search:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-bg)}
    button,.button{border:1px solid var(--border);border-radius:7px;padding:8px 12px;background:var(--bg);color:var(--text);cursor:pointer;font:inherit}.primary{border-color:var(--accent);background:var(--accent);color:#fff}.hint,.summary{color:var(--muted);font-size:12px}.hint{margin-top:8px}.summary{margin:0 2px 10px}
    .results{display:grid;gap:12px}.response-card{border:1px solid var(--border);border-radius:11px;background:var(--panel);overflow:hidden}.card-main{width:100%;display:block;padding:16px 18px;border:0;border-radius:0;background:transparent;text-align:left}.card-main:hover{background:var(--accent-bg)}.card-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}.id{font:12px ui-monospace,SFMono-Regular,monospace;color:var(--accent)}.model{margin-left:auto;color:var(--muted);font-size:11px}.question{font-weight:650;margin-bottom:5px}.answer-preview{color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.detail{padding:0 18px 18px;border-top:1px solid var(--border)}.detail[hidden]{display:none}.label{margin:15px 0 5px;color:var(--muted);font-size:10px;font-weight:700;letter-spacing:.08em}.body{white-space:pre-wrap;overflow-wrap:anywhere}.answer{padding:13px;border-left:3px solid var(--accent);background:var(--bg)}
    .actions{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-top:16px}.followup{flex:1 1 380px}.followup label{display:block;margin-bottom:5px;font-size:12px;font-weight:600}.followup textarea{width:100%;min-height:70px;resize:vertical;padding:9px 10px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);font:inherit}.continue{margin-bottom:1px}.empty{padding:54px 20px;border:1px dashed var(--border);border-radius:11px;color:var(--muted);text-align:center}.error{color:var(--danger)}
    @media(max-width:650px){header{padding:0 14px}.user{display:none}main{padding:22px 14px}.intro h2{font-size:20px}.search-row{align-items:stretch}.search-row button{padding:8px}.card-top{align-items:flex-start}.model{max-width:35%;text-align:right}}
  </style>
</head>
<body>
  <header><h1>🧵 再質問スレッド検索</h1><span class="user">${safeUsername}</span><a href="/aichat">AIチャット</a><a href="/welcome">ホーム</a></header>
  <main>
    <section class="intro"><h2>AI応答を探して、続きを質問</h2><p>再質問IDが付いた過去のAI応答を、質問・回答・IDから検索できます。</p></section>
    <section class="search-panel" aria-label="AI応答検索"><div class="search-row"><input id="responseSearch" class="search" type="search" placeholder="質問、回答、再質問IDを検索" aria-label="AI応答を検索" autocomplete="off"><button id="reload" type="button">↻ 更新</button></div><div class="hint">検索結果を開くと回答全文を閲覧し、そのスレッドへ追加質問できます。</div></section>
    <p id="summary" class="summary" aria-live="polite">再質問IDのある応答を読み込んでいます…</p><div id="results" class="results"></div>
  </main>
  <script>
    var searchEl=document.getElementById('responseSearch'),resultsEl=document.getElementById('results'),summaryEl=document.getElementById('summary'),allResponses=[];
    function esc(value){var d=document.createElement('div');d.textContent=String(value==null?'':value);return d.innerHTML;}
    function fmt(value){try{return new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch(_){return value||'';}}
    function shortId(id){return id.length>18?id.slice(0,10)+'…'+id.slice(-6):id;}
    async function fetchJson(url){var res=await fetch(url,{credentials:'include'}),data=await res.json().catch(function(){return {};});if(!res.ok)throw new Error(data.error||('HTTP '+res.status));return data;}
    async function loadResponses(){summaryEl.textContent='再質問IDのある応答を読み込んでいます…';resultsEl.innerHTML='';try{var data=await fetchJson('/api/aichat/threads/seed');allResponses=[];(data.threads||[]).forEach(function(thread){(thread.turns||[]).forEach(function(turn,index){allResponses.push({threadId:thread.threadId,turn:turn,index:index+1,total:thread.turns.length});});});allResponses.sort(function(a,b){return String(b.turn.createdAt).localeCompare(String(a.turn.createdAt));});renderResponses();}catch(e){summaryEl.textContent='取得に失敗しました';resultsEl.innerHTML='<div class="empty error">'+esc(e.message)+'</div>';}}
    function renderResponses(){var q=searchEl.value.trim().toLocaleLowerCase();var shown=allResponses.filter(function(item){return !q||[item.threadId,item.turn.question,item.turn.answer,item.turn.model].some(function(v){return String(v||'').toLocaleLowerCase().includes(q);});});summaryEl.textContent=(q?'検索結果 ':'再質問IDのあるAI応答 ')+shown.length+'件';resultsEl.innerHTML='';if(!shown.length){resultsEl.innerHTML='<div class="empty">該当するAI応答はありません。<br>別のキーワードまたは再質問IDをお試しください。</div>';return;}shown.forEach(renderResponse);}
    function renderResponse(item){var t=item.turn,card=document.createElement('article');card.className='response-card';card.innerHTML='<button class="card-main" type="button" aria-expanded="false"><div class="card-top"><span class="id" title="'+esc(item.threadId)+'">再質問ID '+esc(shortId(item.threadId))+'</span><span class="model">'+esc(t.model||'model不明')+' · '+esc(fmt(t.createdAt))+'</span></div><div class="question">'+esc(t.question||'(質問なし)')+'</div><div class="answer-preview">'+esc(t.answer||'(応答なし)')+'</div></button><div class="detail" hidden><div class="label">QUESTION · '+item.index+' / '+item.total+'</div><div class="body">'+esc(t.question)+'</div><div class="label">AI RESPONSE</div><div class="body answer">'+esc(t.answer)+'</div><div class="actions"><div class="followup"><label>この応答への追加質問</label><textarea placeholder="続けて質問したい内容を入力"></textarea></div><button class="continue primary" type="button">AIチャットで質問する →</button><a class="button" href="/aichat?threadId='+encodeURIComponent(item.threadId)+'">このスレッドを開く</a></div></div>';resultsEl.appendChild(card);var main=card.querySelector('.card-main'),detail=card.querySelector('.detail'),textarea=card.querySelector('textarea');main.addEventListener('click',function(){var opening=detail.hidden;detail.hidden=!opening;main.setAttribute('aria-expanded',String(opening));if(opening)textarea.focus();});card.querySelector('.continue').addEventListener('click',function(){var draft=textarea.value.trim();var url='/aichat?threadId='+encodeURIComponent(item.threadId);if(draft)url+='&draft='+encodeURIComponent(draft);location.href=url;});}
    searchEl.addEventListener('input',renderResponses);document.getElementById('reload').addEventListener('click',loadResponses);loadResponses();
  </script>
</body>
</html>`;
}
