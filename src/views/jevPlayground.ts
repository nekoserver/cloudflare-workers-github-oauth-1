function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/&/g, '\\u0026').replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

const TEMPLATES = [
  {
    type: 'noul',
    title: 'noul — Yes / No 判定',
    help: '条件が成立する確率を 0〜1 で返します。ゲート判定に向いています。',
    body: {
      model: 'jev-latest',
      state: 'この変更では、認証エラー時に処理を停止し、エラーを利用者へ返します。',
      questions: {
        condition: { type: 'noul', question: 'この変更はフェイルクローズになっているか？' },
      },
    },
  },
  {
    type: 'choice',
    title: 'choice — 選択肢から分類',
    help: '候補から最も適切なものを選びます。分類や処理の振り分けに向いています。',
    body: {
      model: 'jev-latest',
      state: 'ログインしていない利用者が管理画面を開くと、ログインページへ移動します。',
      questions: {
        category: {
          type: 'choice',
          question: 'この動作を最もよく表すカテゴリは？',
          choices: ['authentication', 'authorization', 'data-processing'],
        },
      },
    },
  },
  {
    type: 'score',
    title: 'score — 程度を評価',
    help: '両端の基準の間で程度を数値化します。品質やリスクの評価に向いています。',
    body: {
      model: 'jev-latest',
      state: '回答には一次資料へのリンクがあり、主張ごとに根拠が示されています。',
      questions: {
        quality: {
          type: 'score',
          question: '回答の検証可能性はどの程度高いか？',
          criteria: ['根拠がなく検証できない', '根拠が明確で容易に検証できる'],
        },
      },
    },
  },
] as const;

export function getJevPlaygroundPage(): string {
  const cards = TEMPLATES.map((template) => `
    <section class="card" data-type="${template.type}">
      <div class="card-heading"><div><h2>${template.title}</h2><p>${template.help}</p></div><span>${template.type}</span></div>
      <label for="request-${template.type}">リクエスト JSON</label>
      <textarea id="request-${template.type}" spellcheck="false">${escapeJsonForHtml(template.body)}</textarea>
      <div class="actions"><button type="button" class="run">Run</button><span class="status" aria-live="polite">未実行</span></div>
      <label for="response-${template.type}">レスポンス</label>
      <pre id="response-${template.type}">Run を押すと結果を表示します。</pre>
    </section>`).join('');

  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jev API Playground</title>
<style>
:root{color-scheme:light dark;--bg:#f6f8fa;--panel:#fff;--text:#1f2328;--muted:#59636e;--border:#d0d7de;--accent:#8250df;--code:#f0f3f6} @media(prefers-color-scheme:dark){:root{--bg:#0d1117;--panel:#161b22;--text:#e6edf3;--muted:#9198a1;--border:#30363d;--accent:#a371f7;--code:#0d1117}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 system-ui,sans-serif}.page{max-width:1180px;margin:auto;padding:32px 20px 64px}h1{margin:0 0 8px;font-size:28px}.lead{max-width:800px;margin:0 0 12px;color:var(--muted)}.notice{padding:12px 16px;margin:20px 0;border:1px solid var(--border);border-radius:8px;background:var(--panel)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}.card{min-width:0;padding:18px;border:1px solid var(--border);border-radius:12px;background:var(--panel)}.card-heading{display:flex;justify-content:space-between;gap:12px;min-height:90px}.card-heading h2{font-size:17px;margin:0 0 5px}.card-heading p{margin:0;color:var(--muted)}.card-heading span{height:25px;padding:2px 9px;border-radius:999px;background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent);font:600 12px/21px ui-monospace,monospace}label{display:block;margin:13px 0 6px;font-weight:650}textarea,pre{width:100%;min-height:310px;margin:0;padding:12px;border:1px solid var(--border);border-radius:7px;background:var(--code);color:var(--text);font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow:auto}textarea{resize:vertical}.actions{display:flex;align-items:center;gap:12px;margin:12px 0}button{border:0;border-radius:7px;padding:8px 22px;background:var(--accent);color:#fff;font-weight:700;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.status{color:var(--muted);font-size:12px}pre{min-height:170px;max-height:420px}.back{color:var(--accent)}code{font-family:ui-monospace,monospace}
</style></head><body><main class="page"><a class="back" href="/">← Home</a><h1>Jev API Playground</h1>
<p class="lead">Worker に設定済みの <code>JEV_API_KEY</code> をサーバー側だけで使用し、Jev (TypeSafe AI System One Model) を試せるサンプルです。ブラウザーへトークンを公開しません。</p>
<div class="notice"><strong>使い方:</strong> 各テンプレートの <code>state</code> と質問を編集して Run を押してください。3つの質問タイプは同時に独立して試せます。</div>
<div class="grid">${cards}</div></main>
<script>
document.querySelectorAll('.card').forEach(function(card){
  var button=card.querySelector('.run'), textarea=card.querySelector('textarea'), output=card.querySelector('pre'), status=card.querySelector('.status');
  button.addEventListener('click',async function(){
    var body; try{body=JSON.parse(textarea.value)}catch(error){status.textContent='JSONエラー';output.textContent=error.message;return}
    button.disabled=true;status.textContent='実行中…';output.textContent='';
    try{var response=await fetch('/api/jev-playground',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var text=await response.text();try{output.textContent=JSON.stringify(JSON.parse(text),null,2)}catch(_){output.textContent=text}status.textContent=response.ok?'完了 ('+response.status+')':'失敗 ('+response.status+')'}catch(error){status.textContent='通信エラー';output.textContent=error.message}finally{button.disabled=false}
  });
});
</script></body></html>`;
}
