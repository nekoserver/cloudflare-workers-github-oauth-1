function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/&/g, '\\u0026').replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TEMPLATES = [
  {
    type: 'noul',
    title: 'noul — Yes / No 判定',
    help: '条件が成立する確率を 0〜1 で返します。ゲート判定に向いています。',
    instructions: 'state の内容を根拠に、質問の条件が成立するなら yes、成立しないなら no と判定する',
    samples: [
      ['認証エラーで停止', 'この変更では、認証エラー時に処理を停止し、エラーを利用者へ返します。', 'この変更はフェイルクローズになっているか？'],
      ['テスト成功', '全 328 件の自動テストが成功し、失敗とスキップは 0 件でした。', 'すべての自動テストは成功したか？'],
      ['個人情報をマスク', 'ログへ出力する前に、メールアドレスと電話番号を伏せ字へ置換します。', '個人情報はログでマスクされているか？'],
      ['期限内の申請', '申請の受信日時は 9 月 18 日 14:20、締切は 9 月 20 日 17:00 です。', 'この申請は期限内に受信されたか？'],
      ['HTTPS を強制', 'HTTP で届いたリクエストは HTTPS の同じ URL へ 301 リダイレクトします。', '通信に HTTPS が強制されているか？'],
      ['バックアップ完了', '日次バックアップは完了し、復元テストにも成功しました。', '利用可能なバックアップが作成されたか？'],
      ['承認なしの公開', '担当者が下書きを保存すると、承認工程を経ずに即時公開されます。', '公開前に承認が必須になっているか？'],
      ['在庫の有無', '注文数は 12 個で、現在庫は 20 個です。', '現在庫だけで注文数を満たせるか？'],
    ],
  },
  {
    type: 'choice',
    title: 'choice — 選択肢から分類',
    help: '候補から最も適切なものを選びます。分類や処理の振り分けに向いています。',
    criteria: {
      authentication: '利用者が誰であるかを確認する処理',
      authorization: '利用者に操作の権限があるかを確認する処理',
      'data-processing': 'データの変換、集計、または加工を行う処理',
      observability: 'システムの状態を計測、記録、または通知する機能',
      'user-interface': '利用者が直接操作する画面や入力体験の変更',
    },
    samples: [
      ['未ログイン時の遷移', 'ログインしていない利用者が管理画面を開くと、ログインページへ移動します。', 'この動作を最もよく表すカテゴリは？'],
      ['権限不足を拒否', 'ログイン済みでも管理者権限がない利用者には、設定変更 API が 403 を返します。', 'この制御を最もよく表すカテゴリは？'],
      ['CSV の集計', 'アップロードされた CSV を読み込み、部署別の売上合計を計算します。', 'この処理を最もよく表すカテゴリは？'],
      ['エラー率の監視', '5 分間の API エラー率を計測し、しきい値を超えると通知します。', 'この機能を最もよく表すカテゴリは？'],
      ['入力フォーム改善', '入力欄の横にエラー理由を表示し、キーボード操作時はフォーカス枠を示します。', 'この変更を最もよく表すカテゴリは？'],
      ['多要素ログイン', 'パスワード確認後、登録済み端末へ送ったワンタイムコードを検証します。', 'この機能を最もよく表すカテゴリは？'],
      ['監査ログ記録', '設定を変更した利用者、時刻、変更前後の値を監査ログへ記録します。', 'この機能を最もよく表すカテゴリは？'],
      ['画像のリサイズ', '投稿された画像を読み込み、縦横比を維持してサムネイルを生成します。', 'この処理を最もよく表すカテゴリは？'],
    ],
  },
  {
    type: 'score',
    title: 'score — 程度を評価',
    help: '両端の基準の間で程度を数値化します。品質やリスクの評価に向いています。',
    criteria: ['まったく満たしていない', '十分に満たしている'],
    samples: [
      ['根拠付きの回答', '回答には一次資料へのリンクがあり、主張ごとに根拠が示されています。', '回答の検証可能性はどの程度高いか？'],
      ['テストカバレッジ', '主要経路と異常系にはテストがありますが、境界値の一部は未検証です。', 'テストの網羅性はどの程度高いか？'],
      ['操作の分かりやすさ', '主要操作にはラベルと説明があり、初回利用者 10 人中 9 人が補助なく完了しました。', '操作の分かりやすさはどの程度高いか？'],
      ['障害リスク', '単一リージョンで稼働し、バックアップからの復旧手順はまだテストされていません。', 'サービス停止のリスクはどの程度高いか？'],
      ['文章の簡潔さ', '結論を冒頭に示し、重複を避けて 3 つの短い段落にまとめています。', '文章はどの程度簡潔か？'],
      ['アクセシビリティ', 'フォームにはラベルがありキーボード操作も可能ですが、色のコントラストは未検証です。', 'アクセシビリティ対応の程度はどのくらいか？'],
      ['移行準備', '移行手順、ロールバック、担当者が文書化され、ステージングでリハーサル済みです。', '本番移行の準備はどの程度整っているか？'],
      ['回答の具体性', '回答は「改善が必要」とだけ述べ、対象箇所や改善方法を示していません。', '回答はどの程度具体的か？'],
    ],
  },
] as const;

export function getJevPlaygroundPage(): string {
  const cards = TEMPLATES.map((template) => {
    const [, state, question] = template.samples[0];
    const questionId = template.type === 'noul' ? 'condition' : template.type === 'choice' ? 'category' : 'quality';
    const body = {
      model: 'jev-latest',
      state,
      questions: { [questionId]: {
        type: template.type, question,
        ...(template.type === 'noul' ? { instructions: template.instructions } : { criteria: template.criteria }),
      } },
    };
    const options = template.samples.map((sample, index) => `<button type="button" class="state-option" data-index="${index}"><strong>${escapeHtml(sample[0])}</strong><span>${escapeHtml(sample[1])}</span></button>`).join('');
    return `
    <section id="${template.type}" class="card" data-type="${template.type}">
      <div class="card-heading"><div><h2>${template.title}</h2><p>${template.help}</p></div><span>${template.type}</span></div>
      <div class="state-picker">
        <label id="state-label-${template.type}" for="state-${template.type}">state</label>
        <button id="state-${template.type}" type="button" class="state-select" aria-haspopup="dialog"><span>${escapeHtml(template.samples[0][0])}</span><b aria-hidden="true">⌄</b></button>
      </div>
      <dialog class="state-dialog" aria-labelledby="state-title-${template.type}"><div class="dialog-head"><h3 id="state-title-${template.type}">state を選択</h3><button type="button" class="dialog-close" aria-label="閉じる">×</button></div><div class="state-options">${options}</div></dialog>
      <div class="io-grid">
        <div class="io-panel input-panel"><div class="io-heading"><span>IN <label for="request-${template.type}">リクエスト JSON</label></span></div>
          <div class="request-editor"><textarea id="request-${template.type}" spellcheck="false">${escapeJsonForHtml(body)}</textarea><span class="state-value-flash" aria-hidden="true"></span></div>
        </div>
        <div class="io-panel output-panel"><div class="io-heading"><span>OUT</span><div class="actions"><span class="status" aria-live="polite"><span class="status-text">未実行</span><span class="response-status-badge" hidden></span></span><button type="button" class="run">Run</button></div></div>
          <pre id="response-${template.type}">Run を押すと結果を表示します。</pre>
        </div>
      </div>
    </section>`;
  }).join('');

  const samples = Object.fromEntries(TEMPLATES.map((template) => [template.type, template.samples.map(([, state, question]) => ({ state, question }))]));
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jev API Playground</title>
<style>
:root{color-scheme:light dark;--bg:#f6f8fa;--panel:#fff;--text:#1f2328;--muted:#59636e;--border:#d0d7de;--accent:#8250df;--code:#f0f3f6} @media(prefers-color-scheme:dark){:root{--bg:#0d1117;--panel:#161b22;--text:#e6edf3;--muted:#9198a1;--border:#30363d;--accent:#a371f7;--code:#0d1117}}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:84px}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 system-ui,sans-serif}.page{max-width:1180px;margin:auto;padding:0 20px 64px}.page-header{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:22px 0 16px;background:var(--bg);border-bottom:1px solid var(--border)}h1{margin:0;font-size:28px;white-space:nowrap}.jump-links{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.jump-links a{padding:3px 10px;border:1px solid color-mix(in srgb,var(--accent) 45%,var(--border));border-radius:999px;background:color-mix(in srgb,var(--accent) 13%,transparent);color:var(--accent);font-weight:650;text-decoration:none}.jump-links a:hover,.jump-links a:focus-visible{background:color-mix(in srgb,var(--accent) 22%,transparent);text-decoration:none}.grid{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;padding-top:20px}.card{width:100%;min-width:0;padding:18px;border:1px solid var(--border);border-radius:12px;background:var(--panel);scroll-margin-top:84px}.card-heading{display:flex;justify-content:space-between;gap:12px}.card-heading h2{font-size:17px;margin:0 0 5px}.card-heading p{margin:0;color:var(--muted)}.card-heading>span{height:25px;padding:2px 9px;border-radius:999px;background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent);font:600 12px/21px ui-monospace,monospace}.state-picker{margin-top:16px}.state-picker label{margin-top:0;scroll-margin-top:84px}.io-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:stretch;gap:16px;margin-top:10px}.io-panel{min-width:0;display:flex;flex-direction:column}.io-heading{min-height:40px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px}.io-heading>span{display:flex;align-items:center;gap:1ch;font:700 12px/1 ui-monospace,monospace;letter-spacing:.08em;color:var(--muted)}.io-heading label{margin:0;font:650 14px/1.55 system-ui,sans-serif;letter-spacing:normal;color:var(--text)}label,.field-label{display:block;margin:13px 0 6px;font-weight:650}.request-editor{position:relative;display:flex;flex:1;min-height:390px}.request-editor textarea,pre{width:100%;height:390px;border:1px solid var(--border);border-radius:7px;background:var(--code);color:var(--text)}textarea,pre{min-height:300px;margin:0;padding:12px;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow:auto}textarea{resize:vertical}.state-value-flash{position:absolute;top:calc(12px + 2 * 1.55em);left:calc(12px + 11ch);max-width:calc(100% - 24px - 11ch);overflow:hidden;white-space:pre;color:var(--text);font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;pointer-events:none;opacity:0}.state-value-flash.is-flashing{animation:state-value-flash .35s ease-in-out 3}@keyframes state-value-flash{0%,100%{opacity:0}50%{opacity:1;background:#ffd33d;color:#1f2328}}.actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin:0}button{border:0;border-radius:7px;padding:8px 22px;background:var(--accent);color:#fff;font-weight:700;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.status{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:12px}.response-status-badge{min-width:3ch;padding:2px 7px;border-radius:999px;color:#fff;font:700 11px/1.4 ui-monospace,monospace;text-align:center}.response-status-badge.is-success{background:#1a7f37}.response-status-badge.is-error{background:#cf222e}pre{flex:1;max-height:none}.state-select{width:100%;display:flex;align-items:center;justify-content:space-between;text-align:left;background:var(--code);color:var(--text);border:1px solid var(--border);font:inherit}.state-select b{color:var(--muted);font-size:18px}.state-dialog{width:min(720px,calc(100vw - 32px));max-height:min(720px,calc(100vh - 32px));padding:0;border:1px solid var(--border);border-radius:12px;background:var(--panel);color:var(--text);box-shadow:0 24px 80px #0008}.state-dialog::backdrop{background:#05070ab8;backdrop-filter:blur(2px)}.dialog-head{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border);background:var(--panel)}.dialog-head h3{margin:0;font-size:17px}.dialog-close{padding:3px 11px;background:transparent;color:var(--muted);font-size:24px}.state-options{display:grid;gap:8px;padding:12px}.state-option{display:grid;gap:3px;width:100%;padding:12px 14px;text-align:left;background:var(--code);color:var(--text);border:1px solid var(--border)}.state-option:hover,.state-option:focus-visible{border-color:var(--accent)}.state-option span{color:var(--muted);font-weight:400}@media(max-width:760px){.page-header{align-items:flex-start;flex-direction:column;gap:8px}.jump-links{justify-content:flex-start}.io-grid{grid-template-columns:minmax(0,1fr)}pre{min-height:240px}}
</style></head><body><main class="page"><header class="page-header"><h1>Jev API Playground</h1><nav class="jump-links" aria-label="質問タイプへ移動"><a href="#state-label-noul">noul — Yes / No 判定</a><a href="#state-label-choice">choice — 選択肢から分類</a><a href="#state-label-score">score — 程度を評価</a></nav></header>
<div class="grid">${cards}</div></main>
<script>
var samples=${escapeJsonForHtml(samples)};
document.querySelectorAll('.card').forEach(function(card){
  var type=card.dataset.type, select=card.querySelector('.state-select'), dialog=card.querySelector('.state-dialog'), button=card.querySelector('.run'), textarea=card.querySelector('textarea'), flash=card.querySelector('.state-value-flash'), output=card.querySelector('pre'), statusText=card.querySelector('.status-text'), statusBadge=card.querySelector('.response-status-badge');
  select.addEventListener('click',function(){dialog.showModal()});
  dialog.querySelector('.dialog-close').addEventListener('click',function(){dialog.close()});
  dialog.addEventListener('click',function(event){if(event.target===dialog)dialog.close()});
  dialog.querySelectorAll('.state-option').forEach(function(option){option.addEventListener('click',function(){
    var sample=samples[type][Number(option.dataset.index)], body;
    try{body=JSON.parse(textarea.value)}catch(_){body={model:'jev-latest',questions:{}}}
    body.state=sample.state;
    var questionKey=Object.keys(body.questions)[0];
    if(questionKey){body.questions[questionKey].question=sample.question}
    textarea.value=JSON.stringify(body,null,2);
    flash.textContent=JSON.stringify(sample.state);
    flash.classList.remove('is-flashing');
    void flash.offsetWidth;
    flash.classList.add('is-flashing');
    select.querySelector('span').textContent=option.querySelector('strong').textContent;
    dialog.close();
  })});
  button.addEventListener('click',async function(){
    var body; try{body=JSON.parse(textarea.value)}catch(error){statusText.textContent='JSONエラー';statusBadge.hidden=true;output.textContent=error.message;return}
    var started=performance.now();button.disabled=true;statusText.textContent='実行中…';statusBadge.hidden=true;output.textContent='';
    try{var response=await fetch('/api/jev-playground',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var text=await response.text();try{output.textContent=JSON.stringify(JSON.parse(text),null,2)}catch(_){output.textContent=text}statusText.textContent=(response.ok?'完了':'失敗')+' · '+Math.round(performance.now()-started)+' ms';statusBadge.textContent=String(response.status);statusBadge.className='response-status-badge '+(response.status===200?'is-success':'is-error');statusBadge.hidden=false}catch(error){statusText.textContent='通信エラー · '+Math.round(performance.now()-started)+' ms';statusBadge.hidden=true;output.textContent=error.message}finally{button.disabled=false}
  });
});
</script></body></html>`;
}
