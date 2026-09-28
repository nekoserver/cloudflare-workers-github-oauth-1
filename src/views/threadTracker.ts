import { escapeHtml } from '../utils/html';

/** AI chat threads represented as an expandable repository-style tree. */
export function getThreadTrackerPage(username: string): string {
  const safeUsername = escapeHtml(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>スレッド追跡ツリー</title>
  <style>
    :root { color-scheme:dark; --bg:#0d1117; --panel:#161b22; --border:#30363d; --text:#e6edf3; --muted:#8b949e; --accent:#58a6ff; --selected:#1f6feb33; --positive:#3fb950; --negative:#f85149; }
    @media (prefers-color-scheme:light) { :root { color-scheme:light; --bg:#f6f8fa; --panel:#fff; --border:#d0d7de; --text:#24292f; --muted:#57606a; --accent:#0969da; --selected:#ddf4ff; --positive:#1a7f37; --negative:#cf222e; } }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    header { height:58px; padding:0 20px; display:flex; align-items:center; gap:14px; border-bottom:1px solid var(--border); background:var(--panel); }
    header h1 { margin:0; font-size:17px; flex:1; } header a { color:var(--accent); text-decoration:none; } .user { color:var(--muted); font-size:12px; }
    main { height:calc(100vh - 58px); display:grid; grid-template-columns:minmax(280px,36%) 1fr; }
    .sidebar { border-right:1px solid var(--border); overflow:auto; background:var(--panel); }
    .toolbar { position:sticky; top:0; z-index:2; padding:14px; border-bottom:1px solid var(--border); background:var(--panel); }
    .toolbar-row { display:flex; gap:8px; align-items:center; } .toolbar strong { flex:1; }
    .thread-search { width:100%; margin-top:10px; border:1px solid var(--border); border-radius:6px; padding:8px 10px; color:var(--text); background:var(--bg); outline:none; }
    .thread-search:focus { border-color:var(--accent); box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 25%,transparent); }
    button { border:1px solid var(--border); border-radius:6px; padding:6px 10px; color:var(--text); background:var(--bg); cursor:pointer; } button:hover { border-color:var(--accent); }
    .window { margin-top:6px; color:var(--muted); font-size:11px; }
    #tree { list-style:none; padding:8px; margin:0; } .thread { margin-bottom:2px; }
    .thread-button { width:100%; display:grid; grid-template-columns:18px 1fr auto; gap:6px; align-items:center; padding:7px 8px; border:0; text-align:left; background:transparent; }
    .thread-button.active { background:var(--selected); } .thread-label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:ui-monospace,SFMono-Regular,monospace; font-size:12px; }
    .badge { min-width:24px; border-radius:999px; padding:1px 7px; text-align:center; color:var(--positive); border:1px solid color-mix(in srgb,var(--positive) 45%,transparent); font-size:11px; }
    .turns { list-style:none; margin:0 0 5px 16px; padding:0 0 0 13px; border-left:1px solid var(--border); } .turns[hidden] { display:none; }
    .turn-button { width:100%; border:0; padding:5px 7px; display:flex; gap:7px; text-align:left; background:transparent; }
    .turn-button.active { color:var(--accent); background:var(--selected); } .turn-index { color:var(--muted); flex:none; } .turn-question { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .content { overflow:auto; padding:24px; } .empty { height:100%; display:grid; place-items:center; color:var(--muted); text-align:center; }
    .detail { max-width:900px; margin:auto; } .detail-head { margin-bottom:20px; padding-bottom:14px; border-bottom:1px solid var(--border); }
    .detail-head h2 { margin:0 0 8px; font-size:18px; } .meta { display:flex; flex-wrap:wrap; gap:8px 16px; color:var(--muted); font-size:12px; }
    .bubble { margin:14px 0; padding:16px 18px; border:1px solid var(--border); border-radius:10px; background:var(--panel); white-space:pre-wrap; overflow-wrap:anywhere; }
    .bubble.answer { border-left:3px solid var(--accent); } .bubble-label { margin-bottom:8px; color:var(--muted); font-size:11px; font-weight:700; letter-spacing:.08em; }
    .status { padding:20px; color:var(--muted); } .error { color:var(--negative); }
    @media (max-width:700px) { main { height:auto; min-height:calc(100vh - 58px); grid-template-columns:1fr; } .sidebar { max-height:46vh; border-right:0; border-bottom:1px solid var(--border); } .content { min-height:54vh; padding:16px; } .user { display:none; } }
  </style>
</head>
<body>
  <header><h1>🧵 スレッド追跡ツリー</h1><span class="user">${safeUsername}</span><a href="/aichat">AIチャット</a><a href="/welcome">ホーム</a></header>
  <main>
    <aside class="sidebar" aria-label="スレッドツリー">
      <div class="toolbar"><div class="toolbar-row"><strong>スレッド（全期間）</strong><button id="reload" type="button">↻ 更新</button></div><input id="threadSearch" class="thread-search" type="search" placeholder="質問・回答・スレッドIDを検索" aria-label="スレッドを検索" autocomplete="off"><div id="window" class="window">過去ログを読み込んでいます</div></div>
      <div id="treeStatus" class="status">読み込み中…</div><ul id="tree"></ul>
    </aside>
    <section id="content" class="content"><div class="empty">左のツリーからスレッドを選択してください。<br>各スレッドを展開すると、質問ターンを追跡できます。</div></section>
  </main>
  <script>
    var treeEl=document.getElementById('tree'), statusEl=document.getElementById('treeStatus'), contentEl=document.getElementById('content'), searchEl=document.getElementById('threadSearch'), allThreads=[];
    function esc(value){var d=document.createElement('div');d.textContent=String(value==null?'':value);return d.innerHTML;}
    function shortId(id){return id.slice(0,8)+'…'+id.slice(-4);}
    function fmt(date){try{return new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium',timeStyle:'short'}).format(new Date(date));}catch(_){return date;}}
    function showError(message){contentEl.innerHTML='<div class="empty error">'+esc(message)+'</div>';}
    async function fetchJson(url){var res=await fetch(url,{credentials:'include'});var data=await res.json().catch(function(){return {};});if(!res.ok)throw new Error(data.error||('HTTP '+res.status));return data;}
    async function loadThreads(){statusEl.hidden=false;statusEl.className='status';statusEl.textContent='過去ログを読み込み中…';treeEl.innerHTML='';try{var results=await Promise.all([fetchJson('/api/aichat/threads/seed'),fetchJson('/api/aichat/threads/growing?limit=50')]);var seed=results[0],growing=results[1],growthById={};growing.threads.forEach(function(x){growthById[x.threadId]=x;});allThreads=seed.threads.map(function(thread){return Object.assign(thread,growthById[thread.threadId]||{});});document.getElementById('window').textContent='全期間 '+allThreads.length+'スレッド（直近24時間に2ターン以上: '+growing.threads.length+'）';renderThreads();}catch(e){statusEl.className='status error';statusEl.textContent='取得失敗: '+e.message;}}
    function renderThreads(){var q=searchEl.value.trim().toLocaleLowerCase();treeEl.innerHTML='';var shown=allThreads.filter(function(thread){if(!q)return true;return thread.threadId.toLocaleLowerCase().includes(q)||thread.turns.some(function(turn){return String(turn.question||'').toLocaleLowerCase().includes(q)||String(turn.answer||'').toLocaleLowerCase().includes(q);});});statusEl.hidden=shown.length>0;statusEl.className='status';statusEl.textContent=allThreads.length?(q?'一致するスレッドはありません。':'過去ログにスレッドはありません。'):'過去ログにスレッドはありません。';shown.forEach(renderThread);}
    function renderThread(thread){var li=document.createElement('li');li.className='thread';var badge=thread.recentCount!=null?'<span class="badge" title="前期間 '+thread.previousCount+'件">+'+thread.growth+' / '+thread.recentCount+'</span>':'<span class="badge" title="全期間のターン数">'+thread.turns.length+'</span>';li.innerHTML='<button class="thread-button" type="button" aria-expanded="false"><span>▸</span><span class="thread-label" title="'+esc(thread.threadId)+'">'+esc(shortId(thread.threadId))+'</span>'+badge+'</button><ul class="turns" hidden></ul>';treeEl.appendChild(li);var button=li.querySelector('.thread-button'),turns=li.querySelector('.turns');button.addEventListener('click',function(){document.querySelectorAll('.thread-button').forEach(function(x){x.classList.remove('active');});button.classList.add('active');var opening=turns.hidden;turns.hidden=!opening;button.setAttribute('aria-expanded',String(opening));button.firstElementChild.textContent=opening?'▾':'▸';if(opening&&!turns.dataset.loaded)loadTurns(thread,turns);});}
    function loadTurns(thread,turns){turns.dataset.loaded='true';thread.turns.forEach(function(turn,index){var li=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='turn-button';button.innerHTML='<span class="turn-index">'+(index+1)+'</span><span class="turn-question">'+esc(turn.question)+'</span>';button.addEventListener('click',function(e){e.stopPropagation();document.querySelectorAll('.turn-button').forEach(function(x){x.classList.remove('active');});button.classList.add('active');renderTurn(thread.threadId,turn,index+1,thread.turns.length);});li.appendChild(button);turns.appendChild(li);});if(thread.turns[0])renderTurn(thread.threadId,thread.turns[0],1,thread.turns.length);}
    function renderTurn(threadId,turn,index,total){contentEl.innerHTML='<article class="detail"><div class="detail-head"><h2>ターン '+index+' / '+total+'</h2><div class="meta"><span>thread: '+esc(threadId)+'</span><span>'+esc(fmt(turn.createdAt))+'</span><span>'+esc(turn.model||'model不明')+'</span><span>'+esc(turn.source||'source不明')+'</span></div></div><div class="bubble"><div class="bubble-label">QUESTION</div>'+esc(turn.question)+'</div><div class="bubble answer"><div class="bubble-label">ANSWER</div>'+esc(turn.answer)+'</div></article>';}
    searchEl.addEventListener('input',renderThreads);document.getElementById('reload').addEventListener('click',loadThreads);loadThreads();
  </script>
</body>
</html>`;
}
