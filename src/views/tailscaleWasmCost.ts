export function renderWorkerCostWidget(): string {
  return `<section aria-label="コストトラッカー"><h2>コストトラッカー</h2><button id="cost-refresh" type="button">Worker・DOの使用量を更新</button><p id="cost-status" role="status">未取得</p><pre id="cost-summary"></pre><svg id="cost-chart" viewBox="0 0 520 180" role="img" aria-label="日別のDurable Object使用量（GB秒）" style="width:100%;height:auto"></svg><p id="cost-note"></p><p><a href="https://developers.cloudflare.com/durable-objects/platform/pricing/" target="_blank" rel="noopener noreferrer">Cloudflareの料金・内包枠</a></p></section>`;
}

export function renderContainerFleetCostWidget(): string {
  return `<section aria-label="全コンテナの状態と費用"><h2>全コンテナの状態・費用</h2><button id="fleet-refresh" type="button">一覧と稼働台帳を更新</button><p id="fleet-status" role="status">未取得</p><div style="overflow-x:auto"><table><caption>Cloudflare APIから参照できる全コンテナ</caption><thead><tr><th>アプリ／端末</th><th>状態</th><th>観測日時</th></tr></thead><tbody id="fleet-rows"></tbody></table></div><p id="fleet-cost-summary"></p><svg id="fleet-cost-chart" viewBox="0 0 520 180" role="img" aria-label="コンテナ別の台帳に基づく累計概算（USD）" style="width:100%;height:auto"></svg><div style="overflow-x:auto"><table><caption>稼働台帳に記録された区間の費用（無料枠・通信等を含まない概算）</caption><thead><tr><th>コンテナ</th><th>累計時間</th><th>既知分の概算USD</th><th>費用不明の区間数</th></tr></thead><tbody id="fleet-cost-rows"></tbody></table></div><p>一覧の取得はコンテナを起動しません。台帳にない端末や区間の費用は不明で、0円とは扱いません。開いたままの区間は直近の停止記録がない前提での概算です。</p></section>`;
}

export function renderCostWidgets(options: { worker?: boolean; containers?: boolean } = {}): string {
  return `${options.worker === false ? '' : renderWorkerCostWidget()}${options.containers === false ? '' : renderContainerFleetCostWidget()}`;
}

const CHART_HELPERS = `
function drawCostBars(id,rows){const svg=$(id),ns='http://www.w3.org/2000/svg';svg.replaceChildren();if(!rows.length){const text=document.createElementNS(ns,'text');text.setAttribute('x','10');text.setAttribute('y','30');text.textContent='対象データなし';svg.append(text);return;}const max=Math.max(1,...rows.map(r=>r.value)),width=480/rows.length;for(let i=0;i<rows.length;i++){const row=rows[i],bar=document.createElementNS(ns,'rect'),label=document.createElementNS(ns,'text'),tip=document.createElementNS(ns,'title'),height=120*Math.max(0,row.value)/max;bar.setAttribute('x',String(30+i*width));bar.setAttribute('y',String(140-height));bar.setAttribute('width',String(Math.max(1,width-3)));bar.setAttribute('height',String(height));bar.setAttribute('fill','#16a34a');tip.textContent=row.label+': '+row.value.toLocaleString('ja-JP');bar.append(tip);svg.append(bar);if(rows.length<=12||i%Math.ceil(rows.length/10)===0){label.setAttribute('x',String(30+i*width));label.setAttribute('y','158');label.setAttribute('font-size','9');label.setAttribute('fill','currentColor');label.textContent=row.short||row.label.slice(0,8);svg.append(label);}}const scale=document.createElementNS(ns,'text');scale.setAttribute('x','5');scale.setAttribute('y','15');scale.setAttribute('font-size','10');scale.setAttribute('fill','currentColor');scale.textContent='最大 '+max.toLocaleString('ja-JP');svg.append(scale);}
function addCostRow(id,values){const tr=document.createElement('tr');for(const value of values){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}$(id).append(tr);}
`;

export function renderWorkerCostWidgetScript(): string {
  return `${CHART_HELPERS}
$('cost-refresh').onclick=async()=>{const button=$('cost-refresh');button.disabled=true;try{const d=await jsonRequest('cost'),p=d.paidPlanReference;$('cost-status').textContent='更新：'+d.fetchedAt+' ／ '+d.periodStart+' 以降（UTC）';$('cost-summary').textContent='本体Worker：'+d.workerRequests.toLocaleString('ja-JP')+' requests ／ errors '+d.workerErrors+'\\nアカウント全体DO：'+d.doRequests.toLocaleString('ja-JP')+' requests ／ '+d.doDurationGBSeconds.toLocaleString('ja-JP')+' GB秒\\n有料プラン月間40万GB秒に対して '+p.durationPercent.toFixed(2)+'%\\nDO超過分の概算：$'+(p.additionalComputeEstimateUsd+p.additionalRequestsEstimateUsd).toFixed(2)+'（その他の料金を含みません）';$('cost-note').textContent=d.note;drawCostBars('cost-chart',d.daily.map(r=>({label:r.date,short:r.date.slice(5),value:r.durationGBSeconds})));}catch(e){$('cost-status').textContent=e.message;}finally{button.disabled=false;}};`;
}

export function renderContainerFleetCostWidgetScript(): string {
  return `${CHART_HELPERS}
$('fleet-refresh').onclick=async()=>{const button=$('fleet-refresh');button.disabled=true;try{const d=await jsonRequest('fleet');$('fleet-rows').replaceChildren();$('fleet-cost-rows').replaceChildren();$('fleet-status').textContent='更新：'+d.fetchedAt+' ／ '+(d.snapshot?(d.snapshot.complete?'一覧取得完了':'一部未取得'):'一覧取得不可')+' '+(d.errors||[]).join(' / ');for(const target of d.snapshot?.targets||[])addCostRow('fleet-rows',[target.group+' / '+target.name,target.status,target.observedAt||'不明']);const costs=d.costs;$('fleet-cost-summary').textContent=costs?'台帳の既知分概算合計：$'+costs.totals.knownEstimateUsd.toFixed(4)+' ／ 費用不明 '+costs.totals.unknownCostSessions+'区間 ／ 帰属不明の記録 '+costs.unattributedEvents+'件':'稼働台帳の費用は取得できません。';const rows=costs?.byContainer||[];for(const row of rows)addCostRow('fleet-cost-rows',[row.label+' ('+row.key+')',(row.seconds/3600).toFixed(2)+'h',row.unknownCostSessions?'既知分 $'+row.knownEstimateUsd.toFixed(4):'$'+row.knownEstimateUsd.toFixed(4),row.unknownCostSessions]);drawCostBars('fleet-cost-chart',rows.filter(r=>r.knownEstimateUsd>0).map(r=>({label:r.label,value:r.knownEstimateUsd})));}catch(e){$('fleet-status').textContent=e.message;}finally{button.disabled=false;}};`;
}

export function renderCostWidgetsScript(options: { worker?: boolean; containers?: boolean } = {}): string {
  return `${options.worker === false ? '' : renderWorkerCostWidgetScript()}${options.containers === false ? '' : renderContainerFleetCostWidgetScript()}`;
}

export const TAILSCALE_COST_HTML = renderCostWidgets();
export const TAILSCALE_COST_SCRIPT = renderCostWidgetsScript();
