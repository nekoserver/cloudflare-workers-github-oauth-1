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
    criteria: '質問の条件が state の内容から成立すると判断できる',
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
    criteria: ['authentication', 'authorization', 'data-processing', 'observability', 'user-interface'],
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
    const body = {
      model: 'jev-latest',
      state,
      questions: { [template.type === 'noul' ? 'condition' : template.type === 'choice' ? 'category' : 'quality']: {
        type: template.type, question, criteria: template.criteria,
      } },
    };
    const options = template.samples.map((sample, index) => `<option value="${index}">${escapeHtml(sample[0])} — ${escapeHtml(sample[1])}</option>`).join('');
    return `
    <section class="card" data-type="${template.type}">
      <div class="card-heading"><div><h2>${template.title}</h2><p>${template.help}</p></div><span>${template.type}</span></div>
      <label for="state-${template.type}">state</label>
      <select id="state-${template.type}" class="state-select">${options}</select>
      <label for="request-${template.type}">リクエスト JSON</label>
      <textarea id="request-${template.type}" spellcheck="false">${escapeJsonForHtml(body)}</textarea>
      <div class="actions"><button type="button" class="run">Run</button><span class="status" aria-live="polite">未実行</span></div>
      <label for="response-${template.type}">レスポンス</label>
      <pre id="response-${template.type}">Run を押すと結果を表示します。</pre>
    </section>`;
  }).join('');

  const samples = Object.fromEntries(TEMPLATES.map((template) => [template.type, template.samples.map(([, state, question]) => ({ state, question }))]));
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jev API Playground</title>
<style>
:root{color-scheme:light dark;--bg:#f6f8fa;--panel:#fff;--text:#1f2328;--muted:#59636e;--border:#d0d7de;--accent:#8250df;--code:#f0f3f6} @media(prefers-color-scheme:dark){:root{--bg:#0d1117;--panel:#161b22;--text:#e6edf3;--muted:#9198a1;--border:#30363d;--accent:#a371f7;--code:#0d1117}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 system-ui,sans-serif}.page{max-width:1180px;margin:auto;padding:32px 20px 64px}h1{margin:0 0 20px;font-size:28px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}.card{min-width:0;padding:18px;border:1px solid var(--border);border-radius:12px;background:var(--panel)}.card-heading{display:flex;justify-content:space-between;gap:12px;min-height:90px}.card-heading h2{font-size:17px;margin:0 0 5px}.card-heading p{margin:0;color:var(--muted)}.card-heading span{height:25px;padding:2px 9px;border-radius:999px;background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent);font:600 12px/21px ui-monospace,monospace}label{display:block;margin:13px 0 6px;font-weight:650}select,textarea,pre{width:100%;border:1px solid var(--border);border-radius:7px;background:var(--code);color:var(--text)}select{padding:9px 10px;font:inherit}textarea,pre{min-height:310px;margin:0;padding:12px;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow:auto}textarea{resize:vertical}.actions{display:flex;align-items:center;gap:12px;margin:12px 0}button{border:0;border-radius:7px;padding:8px 22px;background:var(--accent);color:#fff;font-weight:700;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.status{color:var(--muted);font-size:12px}pre{min-height:170px;max-height:420px}.back{color:var(--accent)}
</style></head><body><main class="page"><a class="back" href="/">← Home</a><h1>Jev API Playground</h1>
<div class="grid">${cards}</div></main>
<script>
var samples=${escapeJsonForHtml(samples)};
document.querySelectorAll('.card').forEach(function(card){
  var type=card.dataset.type, select=card.querySelector('.state-select'), button=card.querySelector('.run'), textarea=card.querySelector('textarea'), output=card.querySelector('pre'), status=card.querySelector('.status');
  select.addEventListener('change',function(){
    var sample=samples[type][Number(select.value)], body;
    try{body=JSON.parse(textarea.value)}catch(_){body={model:'jev-latest',questions:{}}}
    body.state=sample.state;
    var questionKey=Object.keys(body.questions)[0];
    if(questionKey){body.questions[questionKey].question=sample.question}
    textarea.value=JSON.stringify(body,null,2);
  });
  button.addEventListener('click',async function(){
    var body; try{body=JSON.parse(textarea.value)}catch(error){status.textContent='JSONエラー';output.textContent=error.message;return}
    var started=performance.now();button.disabled=true;status.textContent='実行中…';output.textContent='';
    try{var response=await fetch('/api/jev-playground',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var text=await response.text();try{output.textContent=JSON.stringify(JSON.parse(text),null,2)}catch(_){output.textContent=text}status.textContent=(response.ok?'完了':'失敗')+' ('+response.status+') · '+Math.round(performance.now()-started)+' ms'}catch(error){status.textContent='通信エラー · '+Math.round(performance.now()-started)+' ms';output.textContent=error.message}finally{button.disabled=false}
  });
});
</script></body></html>`;
}
