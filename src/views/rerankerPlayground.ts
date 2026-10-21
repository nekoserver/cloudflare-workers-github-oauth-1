const SAMPLE_QUERY = 'Cloudflare Tunnel で HTTP 530 / error code 1033 が出る原因は？';
const SAMPLE_CONTEXTS = [
  { label: 'Tunnel connector', text: 'Cloudflare Tunnel の error 1033 は、Cloudflare のエッジが稼働中の cloudflared コネクターへ接続できないときに発生します。コネクターが起動中か、正しい Tunnel ID とトークンを使っているか、接続状態が Healthy か確認します。' },
  { label: 'DNS record', text: '公開ホスト名の DNS レコードが対象 Tunnel の UUID.cfargotunnel.com を指しているか確認します。別 Tunnel の CNAME や古い DNS レコードは接続先の誤りにつながります。' },
  { label: 'Origin service', text: 'Tunnel が Healthy なのに 502 が出る場合は、cloudflared からオリジンサービスへ到達できるか、Service URL のホスト・ポート・HTTP/HTTPS と証明書設定を確認します。' },
  { label: 'Worker authentication', text: 'Worker が 401 を返す場合は、ログインセッションや認証トークンの期限を確認します。ページの入力フォームと認証状態が正しく表示されるかも確認します。' },
  { label: 'WebSocket upgrade', text: 'WebSocket が接続できない場合は、リクエストが正しいパスへ届き、WebSocket Upgrade ヘッダーがプロキシを通過することを確認します。通常のHTTP応答とWebSocketの疎通は別々に確認します。' },
];

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/&/g, '\\u0026').replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

export function getRerankerPlaygroundPage(): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cross-Encoder Reranker Playground</title>
<style>
:root{color-scheme:light dark;--bg:#f6f8fa;--panel:#fff;--text:#1f2328;--muted:#59636e;--border:#d0d7de;--accent:#f38020;--code:#f0f3f6}@media(prefers-color-scheme:dark){:root{--bg:#0d1117;--panel:#161b22;--text:#e6edf3;--muted:#9198a1;--border:#30363d;--accent:#ff9933;--code:#0d1117}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 system-ui,sans-serif}.page{max-width:1080px;margin:auto;padding:24px 20px 64px}h1{margin:0;font-size:26px}.intro{max-width:850px;color:var(--muted)}.card{margin-top:18px;padding:18px;border:1px solid var(--border);border-radius:12px;background:var(--panel)}label{display:block;margin:0 0 6px;font-weight:650}textarea{width:100%;min-height:92px;padding:10px;border:1px solid var(--border);border-radius:7px;background:var(--code);color:var(--text);font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;resize:vertical}.field{margin-top:14px}#contexts{min-height:310px}.toolbar{display:flex;align-items:center;gap:12px;margin-top:14px}button{border:0;border-radius:7px;padding:9px 20px;background:var(--accent);color:#fff;font-weight:700;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.status{color:var(--muted);font-size:12px}.results{display:grid;gap:10px;margin-top:14px}.result{padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--code)}.result-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:5px}.score{font:700 12px ui-monospace,monospace;color:var(--accent)}.result p{margin:0;white-space:pre-wrap}.hint{font-size:12px;color:var(--muted)}@media(max-width:600px){.page{padding:16px 12px 40px}.card{padding:12px}.toolbar{align-items:flex-start;flex-direction:column}}
</style></head><body><main class="page">
<div style="display:flex;align-items:center;justify-content:space-between;gap:16px"><h1>Cross-Encoder型リランカー</h1><a href="/clef-playground">Clef Playground</a></div>
<p class="intro">質問と候補文を同時に評価し、関連度順に並べ替えるサンプルです。検索や回答生成は行いません。候補を先に検索で絞り、その後に上位候補を選ぶ段階で使います。</p>
<section class="card"><div class="field"><label for="query">質問</label><textarea id="query" maxlength="500">${SAMPLE_QUERY}</textarea></div>
<div class="field"><label for="contexts">候補文 (JSON配列、2〜8件)</label><textarea id="contexts" spellcheck="false">${escapeJsonForHtml(SAMPLE_CONTEXTS)}</textarea></div>
<p class="hint">実行すると質問と候補文をCloudflare Workers AIの @cf/baai/bge-reranker-base に送信します。機密情報は入力しないでください。</p>
<div class="toolbar"><button id="run" type="button">順位を評価</button><span class="status" id="status" role="status" aria-live="polite">未実行</span></div>
<div class="results" id="results"></div></section></main>
<script>
(function(){var query=document.getElementById('query'),contexts=document.getElementById('contexts'),run=document.getElementById('run'),status=document.getElementById('status'),results=document.getElementById('results');
run.addEventListener('click',async function(){run.disabled=true;status.textContent='評価中…';results.replaceChildren();var started=performance.now();try{var parsed=JSON.parse(contexts.value);var response=await fetch('/api/reranker-playground',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:query.value,contexts:parsed})});var data=await response.json();if(!response.ok)throw new Error(data.error||'リクエストに失敗しました');(data.results||[]).forEach(function(item,index){var card=document.createElement('article');card.className='result';var head=document.createElement('div');head.className='result-head';var label=document.createElement('strong');label.textContent=(index+1)+'. '+item.label+' (元 '+(item.originalIndex+1)+'位)';var score=document.createElement('span');score.className='score';score.textContent='score '+Number(item.score).toFixed(4);head.append(label,score);var text=document.createElement('p');text.textContent=item.text;card.append(head,text);results.append(card)});status.textContent='完了 · '+Math.round(performance.now()-started)+' ms'}catch(error){status.textContent='失敗 · '+Math.round(performance.now()-started)+' ms';var message=document.createElement('p');message.className='hint';message.textContent=error instanceof Error?error.message:String(error);results.append(message)}finally{run.disabled=false}})
})();
</script></body></html>`;
}
