export function getCfDashboardPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cloudflare D1 ダッシュボード</title>
<style>
:root {
  --bg: #f6f8fa; --surface: #fff; --border: #d0d7de;
  --text: #1f2328; --muted: #656d76; --link: #0969da;
  --accent: #0969da; --accent-bg: #ddf4ff;
  --ok: #1a7f37; --ok-bg: #dafbe1;
  --err: #cf222e; --err-bg: #ffebe9;
  --warn: #9a6700; --warn-bg: #fff8c5;
  --radius: 8px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #30363d;
    --text: #e6edf3; --muted: #8b949e; --link: #58a6ff;
    --accent: #58a6ff; --accent-bg: #0c2d6b;
    --ok: #3fb950; --ok-bg: #0f2b18;
    --err: #f85149; --err-bg: #300a0a;
    --warn: #e3b341; --warn-bg: #2d1f00;
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font: 14px/1.6 system-ui, sans-serif; padding: 24px; }
h1 { font-size: 20px; margin-bottom: 4px; }
.subtitle { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;
}
.chip-ok { background: var(--ok-bg); color: var(--ok); }
.chip-err { background: var(--err-bg); color: var(--err); }
.chip-warn { background: var(--warn-bg); color: var(--warn); }

.notice {
  background: var(--warn-bg); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px 20px; margin-bottom: 24px; font-size: 13px; line-height: 1.7;
}
.notice code { background: var(--border); padding: 1px 5px; border-radius: 4px; font-family: monospace; }

.db-grid { display: grid; gap: 16px; }
.db-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  overflow: hidden;
}
.db-header {
  display: flex; align-items: center; gap: 10px; padding: 12px 16px;
  cursor: pointer; user-select: none;
  border-bottom: 1px solid transparent; transition: border-color 0.15s;
}
.db-card.open .db-header { border-bottom-color: var(--border); }
.db-name { font-weight: 600; flex: 1; }
.db-meta { color: var(--muted); font-size: 12px; }
.toggle-icon { color: var(--muted); font-size: 16px; transition: transform 0.2s; }
.db-card.open .toggle-icon { transform: rotate(90deg); }

.db-body { display: none; padding: 0; }
.db-card.open .db-body { display: block; }

.table-list { width: 100%; border-collapse: collapse; font-size: 13px; }
.table-list th { background: var(--bg); color: var(--muted); font-weight: 600; text-align: left; padding: 6px 16px; border-bottom: 1px solid var(--border); }
.table-list td { padding: 6px 16px; border-bottom: 1px solid var(--border); }
.table-list tr:last-child td { border-bottom: none; }
.row-count { text-align: right; font-variant-numeric: tabular-nums; }
.loading { color: var(--muted); font-style: italic; padding: 12px 16px; font-size: 13px; }
.error-row td { color: var(--err); }

.refresh-btn {
  background: var(--accent); color: #fff; border: none; border-radius: 6px;
  padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
  margin-bottom: 20px;
}
.refresh-btn:hover { opacity: 0.85; }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.summary-bar {
  display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 20px;
}
.stat-box {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 12px 20px; min-width: 120px;
}
.stat-label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
.stat-value { font-size: 24px; font-weight: 700; margin-top: 2px; }
</style>
</head>
<body>
<h1>Cloudflare D1 ダッシュボード</h1>
<p class="subtitle">このWorkerが使っているD1データベースのテーブル一覧と行数を表示します</p>

<div id="main">
  <p class="loading">読み込み中…</p>
</div>

<script>
const API = '/api/cf-dashboard/d1';

async function loadDatabases() {
  const main = document.getElementById('main');
  main.innerHTML = '<p class="loading">読み込み中…</p>';
  let data;
  try {
    const res = await fetch(API);
    data = await res.json();
  } catch (e) {
    main.innerHTML = \`<p style="color:var(--err)">ネットワークエラー: \${e.message}</p>\`;
    return;
  }

  if (!data.configured) {
    main.innerHTML = \`
      <div class="notice">
        <strong>D1データベースが未設定です</strong><br>
        wrangler.tomlの[[d1_databases]]設定とデプロイ環境のバインディングを確認してください。
      </div>\`;
    return;
  }

  if (data.error) {
    main.innerHTML = \`<p style="color:var(--err)">エラー: \${data.error}</p>\`;
    return;
  }

  const dbs = data.databases ?? [];
  const totalTables = dbs.reduce((s, d) => s + (d.num_tables ?? 0), 0);
  const totalSize = dbs.reduce((s, d) => s + (d.file_size ?? 0), 0);

  const html = \`
    <div class="summary-bar">
      <div class="stat-box"><div class="stat-label">データベース数</div><div class="stat-value">\${dbs.length}</div></div>
      <div class="stat-box"><div class="stat-label">総テーブル数</div><div class="stat-value">\${totalTables || '–'}</div></div>
      <div class="stat-box"><div class="stat-label">合計サイズ</div><div class="stat-value">\${formatBytes(totalSize)}</div></div>
    </div>
    <button class="refresh-btn" id="refreshBtn" onclick="loadDatabases()">再読み込み</button>
    <div class="db-grid">
      \${dbs.map(db => renderDbCard(db)).join('')}
    </div>\`;
  main.innerHTML = html;
}

function renderDbCard(db) {
  const size = db.file_size != null ? formatBytes(db.file_size) : '–';
  const tables = db.num_tables != null ? \`テーブル \${db.num_tables}\` : '';
  const created = db.created_at ? db.created_at.slice(0, 10) : '';
  return \`
    <div class="db-card" id="db-\${db.uuid}">
      <div class="db-header" onclick="toggleDb('\${db.uuid}')">
        <span class="toggle-icon">▶</span>
        <span class="db-name">\${esc(db.name)}</span>
        <span class="db-meta">\${tables}\${tables && size !== '–' ? ' · ' : ''}\${size !== '–' ? size : ''}\${created ? ' · ' + created : ''}</span>
      </div>
      <div class="db-body" id="body-\${db.uuid}">
        <p class="loading">クリックして展開</p>
      </div>
    </div>\`;
}

async function toggleDb(uuid) {
  const card = document.getElementById('db-' + uuid);
  const body = document.getElementById('body-' + uuid);
  const wasOpen = card.classList.contains('open');
  card.classList.toggle('open');
  if (!wasOpen && !card.dataset.loaded) {
    card.dataset.loaded = '1';
    await loadTables(uuid, body);
  }
}

async function loadTables(uuid, body) {
  body.innerHTML = '<p class="loading">テーブル情報を取得中…</p>';
  let data;
  try {
    const res = await fetch(\`\${API}/\${uuid}/tables\`);
    data = await res.json();
  } catch (e) {
    body.innerHTML = \`<p class="loading" style="color:var(--err)">エラー: \${e.message}</p>\`;
    return;
  }
  if (data.error) {
    body.innerHTML = \`<p class="loading" style="color:var(--err)">エラー: \${data.error}</p>\`;
    return;
  }
  const tables = data.tables ?? [];
  if (tables.length === 0) {
    body.innerHTML = '<p class="loading">テーブルなし</p>';
    return;
  }
  body.innerHTML = \`
    <table class="table-list">
      <thead><tr><th>テーブル名</th><th class="row-count">行数</th></tr></thead>
      <tbody>
        \${tables.map(t => \`
          <tr>
            <td>\${esc(t.name)}</td>
            <td class="row-count">\${t.row_count != null ? t.row_count.toLocaleString() : '–'}</td>
          </tr>\`).join('')}
      </tbody>
    </table>\`;
}

function formatBytes(bytes) {
  if (!bytes) return '–';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

loadDatabases();
</script>
</body>
</html>`;
}
