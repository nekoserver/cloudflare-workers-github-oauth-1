import { escapeHtml } from '../utils/html';

export interface CronExecutionRow {
  id: number;
  repo_name: string;
  update_source: 'scheduled' | 'manual';
  changed: number;
  executed_at: string;
}

export interface CronSnapshotRow {
  repo_name: string;
  updated_at: string;
}

export interface CronStatusPageInput {
  executions: CronExecutionRow[];
  snapshots: CronSnapshotRow[];
  generatedAt: string;
  dataAvailable: boolean;
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const STALE_AFTER_MS = 7 * 60 * 60 * 1000;

export function getNextTreeViewCronAt(now: Date): Date {
  return new Date(Math.floor(now.getTime() / SIX_HOURS_MS) * SIX_HOURS_MS + SIX_HOURS_MS);
}

function formatUtc(value: string | null): string {
  if (!value) return '実行履歴なし';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

export function getCronStatusPage(input: CronStatusPageInput): string {
  const now = new Date(input.generatedAt);
  const scheduledExecutions = input.executions.filter((row) => row.update_source === 'scheduled');
  const latestScheduledAt = scheduledExecutions[0]?.executed_at ?? null;
  const latestTime = latestScheduledAt ? new Date(latestScheduledAt).getTime() : Number.NaN;
  const age = now.getTime() - latestTime;
  const healthy = input.dataAvailable && Number.isFinite(age) && age >= 0 && age <= STALE_AFTER_MS;
  const state = !input.dataAvailable ? 'unknown' : healthy ? 'healthy' : 'warning';
  const stateLabel = !input.dataAvailable ? '確認できません' : healthy ? '正常稼働' : latestScheduledAt ? '実行遅延' : '実行待ち';
  const nextAt = getNextTreeViewCronAt(now).toISOString();

  const snapshotRows = input.snapshots.map((row) => `
    <tr data-snapshot-repo="${escapeHtml(row.repo_name)}">
      <td class="snapshot-select-cell"><input class="snapshot-checkbox" type="checkbox" aria-label="${escapeHtml(row.repo_name)}をチェック"></td>
      <td><code>${escapeHtml(row.repo_name)}</code></td><td>${escapeHtml(formatUtc(row.updated_at))}</td>
    </tr>`).join('');
  const historyRows = input.executions.map((row) => `
    <tr>
      <td>${escapeHtml(formatUtc(row.executed_at))}</td>
      <td><code>${escapeHtml(row.repo_name)}</code></td>
      <td><span class="source source-${row.update_source}">${row.update_source === 'scheduled' ? 'cron' : '手動'}</span></td>
      <td><span class="change change-${row.changed ? 'yes' : 'no'}">${row.changed ? '更新あり' : '変更なし'}</span></td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cronスケジューラ稼働状況</title>
  <style>
    :root { color-scheme: light dark; --bg:light-dark(#f6f8fa,#0d1117); --panel:light-dark(#fff,#161b22); --border:light-dark(#d0d7de,#30363d); --text:light-dark(#1f2328,#e6edf3); --muted:light-dark(#636c76,#8b949e); --accent:light-dark(#0969da,#58a6ff); --ok:light-dark(#1a7f37,#3fb950); --ok-bg:light-dark(#dafbe1,#102a19); --warn:light-dark(#9a6700,#d29922); --warn-bg:light-dark(#fff8c5,#2b2308); }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    header { border-bottom:1px solid var(--border); background:var(--panel); }
    .header-inner,.container { width:min(1100px,calc(100% - 32px)); margin:auto; }
    .header-inner { min-height:58px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .brand { font-weight:700; letter-spacing:.01em; } a { color:var(--accent); text-decoration:none; } a:hover { text-decoration:underline; }
    .container { padding:32px 0 56px; }
    h1 { margin:0 0 6px; font-size:28px; } h2 { font-size:16px; margin:0 0 14px; }
    .lead,.muted { color:var(--muted); } .lead { margin:0 0 26px; }
    .grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; margin-bottom:22px; }
    .card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:18px; box-shadow:0 1px 2px rgba(0,0,0,.04); }
    .metric-label { color:var(--muted); font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
    .metric-value { display:block; margin-top:7px; font-size:19px; font-weight:700; font-variant-numeric:tabular-nums; }
    .status { display:inline-flex; align-items:center; gap:8px; padding:5px 10px; border-radius:999px; font-size:14px; }
    .status::before { content:""; width:8px; height:8px; border-radius:50%; background:currentColor; }
    .status-healthy { color:var(--ok); background:var(--ok-bg); } .status-warning,.status-unknown { color:var(--warn); background:var(--warn-bg); }
    .job { margin-bottom:22px; } .job-grid { display:grid; grid-template-columns:160px 1fr; gap:9px 18px; margin:0; }
    dt { color:var(--muted); } dd { margin:0; } code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
    .section { margin-top:22px; } .section-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; } .section-heading h2 { margin:0; }
    .snapshot-toggle { width:32px; height:32px; padding:0; border:1px solid var(--border); border-radius:7px; color:var(--muted); background:var(--panel); cursor:pointer; font:700 17px/1 sans-serif; } .snapshot-toggle:hover { color:var(--accent); border-color:var(--accent); } .snapshot-toggle[aria-pressed="true"] { color:var(--ok); background:var(--ok-bg); }
    .table-wrap { overflow:auto; border:1px solid var(--border); border-radius:10px; }
    table { width:100%; border-collapse:collapse; min-width:640px; background:var(--panel); } th,td { text-align:left; padding:10px 13px; border-bottom:1px solid var(--border); } th { color:var(--muted); font-size:12px; background:color-mix(in srgb,var(--panel) 88%,var(--border)); } tr:last-child td { border-bottom:0; }
    .snapshot-select-cell { display:none; width:42px; padding-right:0; } .snapshot-table.is-selecting .snapshot-select-cell { display:table-cell; } .snapshot-checkbox { width:16px; height:16px; margin:0; accent-color:var(--ok); cursor:pointer; } .snapshot-table tbody tr { transition:opacity .15s ease,background-color .15s ease; } .snapshot-table tbody tr.is-checked { opacity:.5; background:color-mix(in srgb,var(--panel) 72%,var(--border)); }
    .source,.change { display:inline-block; border-radius:999px; padding:2px 8px; font-size:12px; background:var(--bg); } .change-yes { color:var(--ok); }
    .empty { padding:28px; text-align:center; color:var(--muted); background:var(--panel); }
    .notice { border-left:4px solid var(--warn); margin-bottom:20px; }
    @media(max-width:760px) { .grid { grid-template-columns:1fr; } .job-grid { grid-template-columns:1fr; gap:2px; } dd { margin-bottom:10px; } h1 { font-size:23px; } }
  </style>
</head>
<body>
  <header><div class="header-inner"><span class="brand">⏱️ Cronスケジューラ</span><a href="/">ホームへ戻る</a></div></header>
  <main class="container">
    <h1>Cronスケジューラ稼働状況</h1>
    <p class="lead">定期ジョブの設定内容、次回予定、直近の実行結果をまとめて確認できます。</p>
    ${input.dataAvailable ? '' : '<div class="card notice"><strong>D1の稼働データを取得できませんでした。</strong><div class="muted">設定内容は確認できますが、実行履歴とスナップショット時刻は表示できません。</div></div>'}
    <section class="grid" aria-label="稼働状況サマリー">
      <div class="card"><span class="metric-label">ステータス</span><span class="metric-value"><span class="status status-${state}">${stateLabel}</span></span></div>
      <div class="card"><span class="metric-label">直近のcron実行</span><span class="metric-value">${escapeHtml(formatUtc(latestScheduledAt))}</span></div>
      <div class="card"><span class="metric-label">次回実行予定</span><span class="metric-value" id="next-run" data-next-at="${nextAt}">${escapeHtml(formatUtc(nextAt))}</span><span class="muted" id="countdown">計算中…</span></div>
    </section>
    <section class="card job">
      <h2>ジョブ内容</h2>
      <dl class="job-grid">
        <dt>ジョブ名</dt><dd>tree-view snapshot sync</dd>
        <dt>スケジュール</dt><dd><code>0 */6 * * *</code>（UTC 00:00 / 06:00 / 12:00 / 18:00）</dd>
        <dt>実行ハンドラ</dt><dd><code>src/worker-entry.ts scheduled()</code></dd>
        <dt>処理内容</dt><dd>GitHub Trees APIから対象リポジトリのツリーを取得し、D1の <code>tree_view_snapshots</code> を差分更新します。全ユーザーの次回更新カウントダウンも登録します。</dd>
        <dt>正常判定</dt><dd>直近7時間以内にcron由来の実行履歴があること</dd>
      </dl>
    </section>
    <section class="section" id="snapshot-section"><div class="section-heading"><h2>対象スナップショット</h2>${input.snapshots.length ? '<button class="snapshot-toggle" id="snapshot-toggle" type="button" aria-label="スナップショットのチェック欄を切り替える" aria-controls="snapshot-table" aria-pressed="false">✔︎</button>' : ''}</div>${input.snapshots.length ? `<div class="table-wrap"><table class="snapshot-table" id="snapshot-table"><thead><tr><th class="snapshot-select-cell" aria-label="チェック"></th><th>リポジトリ</th><th>最終更新</th></tr></thead><tbody>${snapshotRows}</tbody></table></div>` : '<div class="empty">スナップショット情報がありません。</div>'}</section>
    <section class="section"><h2>直近の実行履歴（最大50件）</h2>${input.executions.length ? `<div class="table-wrap"><table><thead><tr><th>実行日時</th><th>リポジトリ</th><th>実行元</th><th>結果</th></tr></thead><tbody>${historyRows}</tbody></table></div>` : '<div class="empty">実行履歴がありません。</div>'}</section>
  </main>
  <script>
    (function(){var el=document.getElementById('next-run'),out=document.getElementById('countdown');if(!el||!out)return;var target=new Date(el.dataset.nextAt).getTime();function tick(){var d=Math.max(0,target-Date.now()),h=Math.floor(d/3600000),m=Math.floor(d%3600000/60000),s=Math.floor(d%60000/1000);out.textContent='あと '+h+'時間 '+m+'分 '+s+'秒';}tick();setInterval(tick,1000);})();
    (function(){
      var COOKIE_NAME='cron_snapshot_check_state',table=document.getElementById('snapshot-table'),toggle=document.getElementById('snapshot-toggle');
      if(!table||!toggle)return;
      var body=table.tBodies[0],rows=Array.prototype.slice.call(body.rows);
      function readState(){
        var prefix=COOKIE_NAME+'=',parts=document.cookie.split(';');
        for(var i=0;i<parts.length;i++){var part=parts[i].trim();if(part.indexOf(prefix)===0){try{var value=JSON.parse(decodeURIComponent(part.slice(prefix.length)));return value&&Array.isArray(value.checked)?value:null;}catch(_error){return null;}}}
        return null;
      }
      function currentState(){return {selecting:table.classList.contains('is-selecting'),checked:rows.filter(function(row){return row.querySelector('.snapshot-checkbox').checked;}).map(function(row){return row.dataset.snapshotRepo;})};}
      function saveState(){document.cookie=COOKIE_NAME+'='+encodeURIComponent(JSON.stringify(currentState()))+'; Max-Age=31536000; Path=/cron-status; Secure; SameSite=Lax';}
      function setSelecting(enabled){table.classList.toggle('is-selecting',enabled);toggle.setAttribute('aria-pressed',enabled?'true':'false');}
      function sortRows(){rows.filter(function(row){return row.querySelector('.snapshot-checkbox').checked;}).concat(rows.filter(function(row){return !row.querySelector('.snapshot-checkbox').checked;})).forEach(function(row){body.appendChild(row);});}
      var saved=readState(),checked=saved?saved.checked:[];
      rows.forEach(function(row){var checkbox=row.querySelector('.snapshot-checkbox'),isChecked=checked.indexOf(row.dataset.snapshotRepo)>=0;checkbox.checked=isChecked;row.classList.toggle('is-checked',isChecked);checkbox.addEventListener('change',function(){row.classList.toggle('is-checked',checkbox.checked);sortRows();saveState();});});
      setSelecting(!!(saved&&saved.selecting));sortRows();
      toggle.addEventListener('click',function(){setSelecting(!table.classList.contains('is-selecting'));saveState();});
    })();
  </script>
</body>
</html>`;
}
