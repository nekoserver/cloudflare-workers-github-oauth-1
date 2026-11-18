/** Same-origin view of the current AI chat, including partial answers. No extra model request. */
export function getWorkerConversationStreamPage(): string {
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Worker 会話ストリーム</title>
<style>body{font:14px system-ui;margin:12px;background:#fff;color:#17212b}html[data-theme="dark"] body{background:#15191e;color:#eee}article{border-bottom:1px solid #8885;padding:12px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:5px 0}#status{color:#16a34a}</style>
<p id="status" role="status">このAIチャットの会話を待っています。</p><main id="turns" aria-label="会話内容"></main>
<script>
(function(){
 var running=true;
 function state(){parent.postMessage({type:'conversation-state',busy:running},location.origin);}
 window.addEventListener('message',function(event){
  if(event.source!==parent||event.origin!==location.origin||!event.data)return;
  var data=event.data;
  if(data.type==='conversation-stop'){running=false;document.getElementById('status').textContent='表示を停止しました。';state();return;}
  if(data.type==='conversation-start'){running=true;state();parent.postMessage({type:'conversation-ready'},location.origin);return;}
  if(data.type==='conversation-controls'){state();parent.postMessage({type:'conversation-ready'},location.origin);return;}
  if(data.type==='conversation-theme'){document.documentElement.setAttribute('data-theme',data.theme==='dark'?'dark':'light');return;}
  if(data.type!=='conversation-snapshot'||!running||!Array.isArray(data.turns))return;
  var root=document.getElementById('turns'),fragment=document.createDocumentFragment();
  data.turns.slice(-200).forEach(function(turn){
   if(!turn||typeof turn.text!=='string')return;
   var item=document.createElement('article'),label=document.createElement('strong'),text=document.createElement('pre');
   label.textContent=turn.role==='user'?'あなた':turn.role==='thinking'?'応答中':'回答';
   text.textContent=turn.text;item.append(label,text);fragment.appendChild(item);
  });
  root.replaceChildren(fragment);document.getElementById('status').textContent=root.children.length?'Worker：会話を表示中':'このAIチャットの会話を待っています。';
 });
 parent.postMessage({type:'conversation-ready'},location.origin);
})();
</script></html>`;
}
