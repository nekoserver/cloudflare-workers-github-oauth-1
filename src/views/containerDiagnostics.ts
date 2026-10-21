export function getContainerDiagnosticsPage(): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>コンテナ診断</title><style>
:root{color-scheme:light dark;--bg:#f4f6f8;--panel:#fff;--line:#dbe1e8;--ink:#182b40;--muted:#617186;--accent:#12645b;--good:#207642;--bad:#b63036}
@media(prefers-color-scheme:dark){:root{--bg:#101820;--panel:#18242f;--line:#334251;--ink:#e4edf5;--muted:#a6b5c5;--accent:#7bddc8;--good:#8bdfa5;--bad:#ff9a9e}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 system-ui,sans-serif}main{max-width:1160px;margin:auto;padding:28px 20px 60px}header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:24px}h1{font-size:28px;letter-spacing:-.04em;margin:0}h2{font-size:18px;margin:0 0 14px}h3{font-size:15px;margin:20px 0 8px}a{color:var(--accent)}p{margin:6px 0;color:var(--muted)}section{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px;margin:16px 0}.bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.bar h2{margin:0;margin-right:auto}button,input,select{font:inherit;color:inherit;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:7px 10px}button{cursor:pointer}button:disabled{opacity:.5;cursor:wait}button.primary{color:var(--panel);background:var(--ink)}label{display:flex;align-items:center;gap:6px}.health{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:16px 0}.metric{border:1px solid var(--line);padding:12px;border-radius:8px}.metric strong{display:block;font-size:16px}.ok{color:var(--good)}.bad{color:var(--bad)}.scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th,td{border-bottom:1px solid var(--line);padding:9px 10px;text-align:left;vertical-align:top}th{font-size:12px;color:var(--muted);white-space:nowrap}td{overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 ui-monospace,monospace}details{margin-top:12px}summary{cursor:pointer;color:var(--accent)}[hidden]{display:none!important}.status{min-height:24px;margin-top:10px}.hint{font-size:12px}footer{margin-top:20px;color:var(--muted)}
</style></head><body><main>
<header><div><h1>コンテナ診断</h1><p>稼働状態と通信の記録</p></div><a href="/cf-containers">コンテナ管理へ戻る</a></header>
<section><div class="bar"><h2>現在の状態</h2><button id="refresh-live" class="primary">状態を確認</button></div>
<div id="live-status" class="status" role="status" aria-live="polite">確認ボタンで稼働中コンテナの状態を取得します。</div>
<div id="health" class="health"></div><div id="live-firewall"></div></section>
<section><div class="bar"><h2>保存履歴</h2><label>期間<select id="period"><option value="1">過去24時間</option><option value="7">過去7日</option><option value="30">過去30日</option></select></label><button id="refresh-history">履歴を取得</button></div>
<p class="hint">約1時間ごとの累積カウンターです。再起動やルール更新でリセットされるため、各行の件数を足して流量にはできません。</p>
<div id="history-status" class="status" role="status" aria-live="polite"></div><div id="history" class="scroll"></div><button id="more" hidden>さらに読み込む</button></section>
<section id="detail" hidden><h2 id="detail-title">記録の詳細</h2><div id="detail-body"></div></section>
<footer>取得できなかった記録は、通信0件と区別して表示します。</footer>
</main><script>
(function(){
'use strict';
var el=function(id){return document.getElementById(id);};
var nextBefore=null,range=null,busyHistory=false;
function text(tag,value){var n=document.createElement(tag);n.textContent=value==null?'—':String(value);return n;}
function number(value){return typeof value==='number'?value.toLocaleString():'—';}
function mode(value){return value==='rate-limited-log'?'ログとカウンター計測':value==='counters-only'?'カウンター計測':'計測方式未確認';}
function date(value){var d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString();}
async function request(url){var response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});var data=await response.json();if(!response.ok)throw new Error(data.error||'取得に失敗しました');return data;}
function table(headers,rows){var wrap=text('div','');wrap.className='scroll';var t=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');headers.forEach(function(h){tr.appendChild(text('th',h));});head.appendChild(tr);t.appendChild(head);var body=document.createElement('tbody');rows.forEach(function(cells){var row=document.createElement('tr');cells.forEach(function(value){var td=document.createElement('td');td.appendChild(value instanceof Node?value:text('span',value));row.appendChild(td);});body.appendChild(row);});t.appendChild(body);wrap.appendChild(t);return wrap;}
function rows(value){return Array.isArray(value)?value:[];}
function firewall(target,data){target.replaceChildren();if(!data||data.available!==true){target.appendChild(text('p',data&&data.error?'統計を取得できません: '+data.error:'統計を取得できません'));return;}
 target.appendChild(text('p','送信元 '+number(data.sourceCount)+' 件 ／ '+mode(data.mode)));
 if(data.counterEpoch)target.appendChild(text('p','カウンター開始: '+date(data.counterEpoch)));
 target.appendChild(text('h3','CIDR別集計（IPv4 /24・IPv6 /64）'));
 target.appendChild(table(['CIDR','送信元数','パケット','バイト'],rows(data.prefixTotals).map(function(r){return[r.cidr,number(r.sources),number(r.packets),number(r.bytes)];})));
 target.appendChild(text('h3','WHOISのネットワーク別集計'));
 target.appendChild(text('p','名前・WHOISの照会は件数上位の最大10送信元。照会できなかった送信元も上の集計に含みます。'));
 target.appendChild(table(['ネットワーク','送信元数','パケット','バイト'],rows(data.allocationTotals).map(function(r){return[r.cidr,number(r.sources),number(r.packets),number(r.bytes)];})));
 target.appendChild(text('h3','送信元と名前解決'));
 target.appendChild(table(['IP','逆引き名','ネットワーク','パケット','バイト','WHOIS'],rows(data.sources).map(function(r){var detail=document.createElement('details');detail.appendChild(text('summary','照会結果'));detail.appendChild(text('pre',r.whois||'照会結果なし'));return[r.ip,rows(r.hostname).join(', ')||'—',rows(r.allocationCidrs).join(', ')||'—',number(r.packets),number(r.bytes),detail];})));
 if(!rows(data.sources).length)target.appendChild(text('p','記録された送信元はありません。'));
}
el('refresh-live').addEventListener('click',async function(){var button=this;button.disabled=true;el('live-status').textContent='確認中…';el('health').replaceChildren();el('live-firewall').replaceChildren();try{var data=await request('/api/cf-containers/diagnostics');el('live-status').textContent=data.running?'稼働中 ／ '+date(data.checkedAt):data.error||data.label||'コンテナの状態を確認できません';['apache','sshd','cloudflared','tailscale','docker'].forEach(function(name){var n=text('div','');n.className='metric';n.appendChild(text('span',name));var value=data.health&&data.health[name];var label=text('strong',value===true?'応答あり':value===false?'応答なし':'未確認');label.className=value===true?'ok':value===false?'bad':'';n.appendChild(label);el('health').appendChild(n);});if(data.healthError)el('live-status').appendChild(text('p',data.healthError));firewall(el('live-firewall'),data.firewall);}catch(error){el('live-status').textContent=error.message;}finally{button.disabled=false;}});
async function detail(id){el('detail').hidden=false;el('detail-title').textContent='記録の詳細';el('detail-body').replaceChildren(text('p','取得中…'));try{var data=await request('/api/cf-containers/firewall/history/'+encodeURIComponent(id));el('detail-title').textContent=date(data.collectedAt)+' の記録';firewall(el('detail-body'),data.snapshot);}catch(error){el('detail-body').replaceChildren(text('p',error.message));}}
async function history(append){if(busyHistory)return;busyHistory=true;el('refresh-history').disabled=true;el('more').disabled=true;el('history-status').textContent='取得中…';try{if(!append){var to=new Date();range={from:new Date(to.getTime()-Number(el('period').value)*86400000).toISOString(),to:to.toISOString()};nextBefore=null;el('history').replaceChildren();}var params=new URLSearchParams({from:range.from,to:range.to,limit:'168'});if(nextBefore)params.set('before',String(nextBefore));var data=await request('/api/cf-containers/firewall/history?'+params);var records=rows(data.rows);if(!append&&records.length===0)el('history-status').textContent='この期間の保存履歴はありません。';else{el('history-status').textContent='取得した記録: '+records.length+' 件';el('history').appendChild(table(['取得日時','計測状態','送信元数','累積パケット','累積バイト','詳細'],records.map(function(r){var button=text('button','開く');button.addEventListener('click',function(){detail(r.id);});return[date(r.collected_at),r.available===1?mode(r.mode):r.error||'取得不可',r.available===1?number(r.source_count):'—',r.available===1?number(r.packets):'—',r.available===1?number(r.bytes):'—',button];})));}nextBefore=data.nextBefore;el('more').hidden=!nextBefore;}catch(error){el('history-status').textContent=error.message;el('more').hidden=true;}finally{busyHistory=false;el('refresh-history').disabled=false;el('more').disabled=false;}}
el('refresh-history').addEventListener('click',function(){history(false);});el('period').addEventListener('change',function(){history(false);});el('more').addEventListener('click',function(){history(true);});history(false);
})();
</script></body></html>`;
}
