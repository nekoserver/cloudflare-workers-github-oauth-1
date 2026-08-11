function escH(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type MoondreamAnalyzeLogRow = {
  id: number;
  status: string;
  model: string;
  prompt_length: number;
  image_bytes: number;
  error_message: string | null;
  created_at: string;
  image_data_url: string | null;
};

export function buildMoondreamAnalyzeLogRowsHtml(rows: MoondreamAnalyzeLogRow[]): string {
  if (rows.length === 0) {
    return '<tr><td colspan="7" class="empty">ログがありません</td></tr>';
  }
  return rows.map((row) => {
    const statusClass = row.status === 'ok' ? 'status-ok' : 'status-error';
    const statusLabel = row.status === 'ok' ? 'OK' : 'ERROR';
    const errorCell = row.error_message ? escH(row.error_message) : '-';
    const imageCell = row.image_data_url
      ? `<a href="${escH(row.image_data_url)}" download="moondream-log-${row.id}.png" target="_blank" rel="noopener"><img class="thumb" src="${escH(row.image_data_url)}" alt="添付画像"></a>`
      : '-';
    return `<tr>
      <td>${escH(row.created_at)}</td>
      <td><span class="badge ${statusClass}">${statusLabel}</span></td>
      <td>${escH(row.model)}</td>
      <td>${row.prompt_length}</td>
      <td>${row.image_bytes}</td>
      <td>${imageCell}</td>
      <td class="error-cell">${errorCell}</td>
    </tr>`;
  }).join('\n');
}

export function getMoondreamAnalyzeLogPage(username: string, rows: MoondreamAnalyzeLogRow[]): string {
  const safeUser = escH(username);
  const rowsHtml = buildMoondreamAnalyzeLogRowsHtml(rows);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#000010">
<title>📋 Moondream 分析ログ</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000010; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; min-height:100vh; min-height:100svh; display:flex; flex-direction:column; }
.topbar { background:rgba(0,0,20,0.95); border-bottom:1px solid #1e2a40; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
.topbar a:hover { text-decoration:underline; }
h1 { font-size:15px; font-weight:700; flex:1; }
.wrap { max-width:960px; margin:0 auto; padding:24px 18px 60px; width:100%; overflow-x:auto; }
.hint { color:#8b949e; font-size:12px; margin-bottom:14px; }
table { width:100%; border-collapse:collapse; font-size:12px; }
th, td { border-bottom:1px solid #1e2a40; padding:6px 8px; text-align:left; vertical-align:top; white-space:nowrap; }
th { color:#8b949e; font-weight:600; background:rgba(20,25,45,0.6); }
td.error-cell { white-space:pre-wrap; color:#ff7b72; max-width:420px; }
td.empty { color:#8b949e; text-align:center; padding:20px; }
.thumb { max-width:80px; max-height:80px; border-radius:4px; display:block; border:1px solid #30363d; }
.badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; }
.status-ok { background:#0d2818; color:#3fb950; }
.status-error { background:#2a0f10; color:#ff7b72; }
</style>
</head>
<body>
<div class="topbar">
  <h1>📋 Moondream 分析ログ</h1>
  <a href="/">ホーム</a>
  <a href="/moondream-vlm">Moondream VLM</a>
</div>
<div class="wrap">
  <div class="hint">/api/moondream-analyze の呼び出し履歴(直近100件・新しい順)。${safeUser} さんの分析履歴を表示しています。サムネイルをクリックすると元画像を新しいタブで開けます。</div>
  <table>
    <thead>
      <tr>
        <th>日時</th>
        <th>結果</th>
        <th>モデル</th>
        <th>プロンプト長</th>
        <th>画像バイト数</th>
        <th>添付画像</th>
        <th>エラー内容</th>
      </tr>
    </thead>
    <tbody>
${rowsHtml}
    </tbody>
  </table>
</div>
</body>
</html>`;
}
