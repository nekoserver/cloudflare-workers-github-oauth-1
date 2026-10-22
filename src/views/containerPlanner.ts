import { calculateContainerPlan } from '../utils/containerPlan';
import { summarizeBuildTimings, type BuildTimingRecord } from '../utils/containerBuildTimings';

export function getContainerPlannerPage(records: BuildTimingRecord[] = [], warning = ''): string {
  const escape = (text: string) => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const measurements = records.map((record,index) => {
    const summary = summarizeBuildTimings(record.steps);
    return `<div data-measurement="${index}" ${index ? 'hidden' : ''}>
      <p>取得: ${escape(record.collectedAt)} / 結果: ${escape(record.status ?? '不明')} / ログ取得: ${record.logComplete ? '末尾まで' : '途中（未取得部分あり）'}</p>
      <p>計測済みステップ累計: ${summary.measuredSeconds.toFixed(2)} 秒 / 計測完了 ${summary.completed}件 / キャッシュ ${summary.cached}件 / 未完了・時間不明 ${summary.incomplete}件</p>
      <div class="scroll"><table><thead><tr><th>採用</th><th>ステップ</th><th>処理</th><th>状態</th><th>実測秒</th></tr></thead><tbody>
      ${record.steps.map(step=>`<tr><td><input type="checkbox" class="measured-step" aria-label="ステップ${step.id}を採用" data-plan-id="build-${escape(record.snapshotKey)}-${step.id}" data-seconds="${step.seconds ?? ''}" data-note="${escape('build=' + record.buildUuid + ' step=' + step.id + ' ' + step.label)}" ${step.state !== 'done' || step.seconds === null ? 'disabled' : ''}></td><td>#${step.id}</td><td>${escape(step.label)}</td><td>${escape(step.state)}</td><td>${step.seconds ?? '不明'}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }).join('');
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>コンテナ構成プランナー</title><style>
:root{color-scheme:light dark;font:15px/1.6 system-ui,sans-serif}body{max-width:1100px;margin:auto;padding:16px}h1{font-size:24px}a{color:light-dark(#0969da,#79c0ff)}fieldset,section{border:1px solid #8886;border-radius:8px;padding:16px;margin:16px 0}label{display:inline-block;margin:6px}input,button,textarea{font:inherit;padding:8px;max-width:100%;box-sizing:border-box}input[type=number]{width:130px}button{cursor:pointer;min-height:44px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px;border-bottom:1px solid #8886}td input{width:150px}td input[type=checkbox]{width:24px;height:24px}.scroll{overflow:auto}.muted{opacity:.75}#result{white-space:pre-wrap}textarea{width:100%;min-height:160px}#message{white-space:pre-wrap}#result[data-over=true]{border-left:4px solid #d44;padding-left:12px}
</style></head><body>
<a href="/cf-containers">← コンテナ管理</a><h1>コンテナ構成プランナー</h1>
<p>構成候補を選び、インストール後のイメージサイズとビルド時間を試算します。実測値または自分の見積値を入力してください。空欄は「不明」として扱います。</p>
<section><h2>ビルドステップの実測履歴</h2>
<p>既存のWorkers Buildsログを解析してD1に保存します。6時間ごとの自動収集・管理ページでのログ取得・下の更新ボタンで記録します。ページ表示時は保存済み記録を読み込みます。</p>
<p>ステップ累計は並列処理も足した作業時間で、実際の経過時間ではありません。キャッシュの時間は不明扱いでコールドビルドの見積もりには使いません。一つのRUN内の処理はまとめて一ステップです。</p>
<p role="status">${escape(warning)}</p>
<button id="refresh-measurements" type="button">最新ログから実測を収集</button>
${records.length ? `<label>比較対象のビルド<select id="measurement-build">${records.map((r,i)=>`<option value="${i}">${escape((r.createdOn ?? r.collectedAt) + ' ' + r.buildUuid)}</option>`).join('')}</select></label>` : '<p>保存された実測はありません。migration 0184適用後、ログを収集してください。</p>'}
${measurements}
<p id="selected-measurement" role="status"></p><button id="use-measurements" type="button" ${records.length ? '' : 'disabled'}>選択ステップを構成候補へ追加</button>
<p class="muted">追加容量はログから推定せず空欄にします。ベースや既存項目に含むステップを再追加すると二重計上になるため、対象を確認してください。各ステップの根拠にはビルドIDを残します。</p>
<p id="measurement-message" role="status"></p></section>
<fieldset><legend>ベースと制約</legend>
<label>ベースイメージ（MiB）<input id="baseMiB" type="number" min="0" step="any"></label>
<label>ベースのビルド時間（秒）<input id="baseSeconds" type="number" min="0" step="any"></label>
<label>イメージ容量上限（MiB）<input id="limitMiB" type="number" min="0" step="any"></label>
<label>ビルド時間上限（秒）<input id="limitSeconds" type="number" min="0" step="any"></label>
</fieldset>
<section><h2>構成候補</h2><p class="muted">容量は非圧縮の最終イメージへの追加量、時間はキャッシュなしで順番に実行した追加秒数です。ベースに含まれる分は重ねて入力しないでください。共有依存は別行にし、依存IDをカンマ区切りで指定すると一度だけ加算します。</p>
<div class="scroll"><table><thead><tr><th>採用</th><th>項目ID・名前</th><th>追加MiB</th><th>追加秒</th><th>依存ID</th><th>計測条件・根拠</th><th>操作</th></tr></thead><tbody id="packages"></tbody></table></div>
<button id="add" type="button">項目を追加</button></section>
<section><h2>試算結果</h2><div id="result" role="status" aria-live="polite"></div></section>
<section><h2>プランの保存・比較</h2><p>保存先はこのブラウザです。JSONを書き出して別環境へ引き継げます。各案を書き出して比較できます。</p>
<button id="save" type="button">ブラウザに保存</button> <button id="load" type="button">保存したプランを復元</button>
<button id="export" type="button">JSONを書き出す</button> <button id="import" type="button">JSONを読み込む</button>
<label for="json">プランJSON</label><textarea id="json" spellcheck="false"></textarea><p id="message" role="status"></p></section>
<p class="muted">これは入力値に基づく概算です。レイヤーに残る削除済みファイル、圧縮・転送、並列ビルド、キャッシュ、ネットワーク変動、ビルド中の一時容量・メモリは別途確認が必要です。実際のインストールやDockerビルドは実行しません。</p>
<script>
const calculate = ${calculateContainerPlan.toString()};
const keys = ['baseMiB','baseSeconds','limitMiB','limitSeconds'];
const storageKey = 'container-planner:v1';
const tbody = document.getElementById('packages');
function message(text) { document.getElementById('message').textContent = text; }
function addRow(item = {}) {
  const row = document.createElement('tr');
  [['selected','checkbox'],['id','text'],['sizeMiB','number'],['seconds','number'],['dependencies','text'],['note','text']].forEach(function(pair) {
    const cell = document.createElement('td'); const input = document.createElement('input');
    input.type = pair[1]; input.dataset.field = pair[0]; input.setAttribute('aria-label', pair[0]);
    if (pair[1] === 'checkbox') input.checked = !!item.selected;
    else input.value = pair[0] === 'dependencies' ? (item.dependencies || []).join(',') : (item[pair[0]] ?? '');
    if (pair[1] === 'number') { input.min = '0'; input.step = 'any'; }
    cell.append(input); row.append(cell);
  });
  const cell = document.createElement('td'); const remove = document.createElement('button');
  remove.type = 'button'; remove.textContent = '削除'; remove.addEventListener('click',function(){row.remove(); render();}); cell.append(remove);row.append(cell);tbody.append(row);
}
function readNumber(input) { return input.value.trim() === '' ? null : Number(input.value); }
function read() {
  const plan = { selected: [], packages: [] };
  keys.forEach(function(key){plan[key] = readNumber(document.getElementById(key));});
  tbody.querySelectorAll('tr').forEach(function(row) {
    const get = function(key){ return row.querySelector('[data-field="' + key + '"]'); };
    const item = { id:get('id').value.trim(),sizeMiB:readNumber(get('sizeMiB')),seconds:readNumber(get('seconds')),dependencies:get('dependencies').value.split(',').map(function(v){return v.trim();}).filter(Boolean),note:get('note').value };
    plan.packages.push(item); if(get('selected').checked) plan.selected.push(item.id);
  });
  return plan;
}
function render() {
  const el = document.getElementById('result');
  try {
    const r = calculate(read());
    const value = function(v,unit){return v === null ? '不明' : v.toLocaleString(undefined,{maximumFractionDigits:2}) + unit;};
    const status = {within:'上限内',over:'上限超過',unknown:'判定不可（値・上限が未入力）'};
    el.textContent = ['インストール後: ' + value(r.imageMiB,' MiB') + ' / ' + status[r.sizeStatus], 'ビルド時間: ' + value(r.buildSeconds,' 秒') + ' / ' + status[r.timeStatus], '容量の余裕: ' + value(r.remainingMiB,' MiB'), '時間の余裕: ' + value(r.remainingSeconds,' 秒'), '依存を含む採用項目: ' + (r.included.join(', ') || 'なし'), '未計測の追加項目: ' + (r.unknown.join(', ') || 'なし')].join(String.fromCharCode(10));
    el.dataset.over = String(r.sizeStatus === 'over' || r.timeStatus === 'over');
  } catch(e) {el.textContent = e.message;el.dataset.over='true';}
}
function apply(data) {
  if (!data || data.version !== 1 || !data.plan || !Array.isArray(data.plan.packages) || !Array.isArray(data.plan.selected)) throw new Error('対応するプランJSONではありません');
  const plan = data.plan;
  if (plan.packages.length > 200) throw new Error('項目は200件までです');
  if (!plan.selected.every(function(v){return typeof v === 'string';}) || !plan.packages.every(function(p){return p && typeof p.id === 'string' && Array.isArray(p.dependencies) && p.dependencies.every(function(v){return typeof v === 'string';}) && (p.note === undefined || typeof p.note === 'string');})) throw new Error('項目の形式が不正です');
  calculate(plan);
  keys.forEach(function(key){document.getElementById(key).value = plan[key] ?? '';});
  tbody.replaceChildren();plan.packages.forEach(function(item){addRow({...item,selected:plan.selected.includes(item.id)});});render();
}
function serialized() {const plan=read();calculate(plan);return JSON.stringify({version:1,savedAt:new Date().toISOString(),plan},null,2);}
function action(id,fn){document.getElementById(id).addEventListener('click',function(){try{fn();}catch(e){message('処理できません: ' + e.message);}});}
action('add',function(){addRow({id:'item-' + Date.now()});render();});
action('save',function(){localStorage.setItem(storageKey,serialized());message('このブラウザに保存しました');});
action('load',function(){const data=localStorage.getItem(storageKey);if(!data)throw new Error('保存したプランがありません');apply(JSON.parse(data));message('保存したプランを復元しました');});
action('export',function(){document.getElementById('json').value=serialized();message('JSONをコピーして保存できます');});
action('import',function(){apply(JSON.parse(document.getElementById('json').value));message('JSONを読み込みました');});
action('use-measurements',function(){
  const existing = new Set(read().packages.map(function(item){return item.id;}));
  let added=0;
  document.querySelectorAll('[data-measurement]:not([hidden]) .measured-step:checked').forEach(function(input){
    if(existing.has(input.dataset.planId))return;
    addRow({id:input.dataset.planId,seconds:Number(input.dataset.seconds),sizeMiB:null,selected:true,note:input.dataset.note});existing.add(input.dataset.planId);added++;
  });
  render();message(added + '件の実測を構成候補へ追加しました（同じ観測・ステップの重複は除外）');
});
const buildSelect=document.getElementById('measurement-build');
if(buildSelect)buildSelect.addEventListener('change',function(){
  document.querySelectorAll('[data-measurement]').forEach(function(el){el.hidden=el.dataset.measurement!==buildSelect.value;});
  document.querySelectorAll('.measured-step').forEach(function(input){input.checked=false;});
  document.getElementById('selected-measurement').textContent='';
});
document.getElementById('refresh-measurements').addEventListener('click',async function(){
  const button=this;button.disabled=true;const el=document.getElementById('measurement-message');el.textContent='ビルドログを収集中…';
  try {
    const response=await fetch('/api/cf-containers/build-timings/refresh',{method:'POST',headers:{'Accept':'application/json'}});
    const data=await response.json();if(!response.ok)throw new Error(data.error || '収集失敗');
    if(data.errors.length) {el.textContent=data.recordedBuilds+'ビルドを保存しました。一部の取得に失敗しました。ページを再表示して保存分を確認してください。';}
    else {el.textContent=data.recordedBuilds+'ビルドを保存しました。再読み込みして表示します。';window.location.reload();}
  } catch(e) {el.textContent=e.message;} finally {button.disabled=false;}
});
document.addEventListener('input',function(e){
  if(e.target.classList.contains('measured-step')) {
    let total=0;document.querySelectorAll('[data-measurement]:not([hidden]) .measured-step:checked').forEach(function(input){total+=Number(input.dataset.seconds);});
    document.getElementById('selected-measurement').textContent='選択ステップ累計: '+total.toFixed(2)+' 秒（経過時間ではありません）';
  } else if(e.target.id !== 'json')render();
});
['Node.js','Codex','Claude-Code','TypeScript','Vitest','Wrangler','Docker','Tailscale','GitHub-CLI','Jujutsu'].forEach(function(id){addRow({id});});
render();
</script></body></html>`;
}
