export function getAiSummaryViewerPage(): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI要約</title>
<style>
body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;background:#f8f9fa;color:#333}
h1{font-size:1.4rem}
pre{background:#1e1e1e;color:#d4d4d4;padding:1rem;border-radius:6px;overflow-x:auto;white-space:pre-wrap}
.meta{display:grid;grid-template-columns:auto 1fr;gap:0.25rem 1rem;margin:1rem 0}
.meta dt{font-weight:bold;color:#666;text-align:right;white-space:nowrap}
.meta dd{margin:0}
.error{color:#c00;padding:2rem;text-align:center}
a{color:#0969da}
</style>
</head><body>
<div id="content"><p class="error">データを読み込み中...</p></div>
<script>
(function(){
  try {
    var hash = location.hash.slice(1);
    if (!hash) { document.getElementById('content').innerHTML = '<p class="error">データがありません</p>'; return; }
    var binary = atob(hash);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var d = JSON.parse(new TextDecoder().decode(bytes));
    var esc = function(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
    var prLink = d.u ? '<a href="' + esc(d.u) + '">PR #' + d.p + '</a>' : 'PR #' + (d.p || '?');
    var summary = d.s || '(要約なし)';
    document.title = 'AI要約 #' + d.n + ' (' + esc(d.e) + ')';
    document.getElementById('content').innerHTML =
      '<h1>AI要約 #' + d.n + ' (' + esc(d.e) + ')</h1>' +
      '<dl class="meta">' +
      '<dt>リポジトリ</dt><dd>' + esc(d.r || '(不明)') + '</dd>' +
      '<dt>PR</dt><dd>' + prLink + '</dd>' +
      '<dt>モデル</dt><dd>' + esc(d.m || '(不明)') + '</dd>' +
      '<dt>Diff長</dt><dd>' + (d.d || 0) + ' 文字</dd>' +
      '<dt>日時</dt><dd>' + esc(d.c) + '</dd>' +
      '</dl>' +
      '<h2>要約</h2>' +
      '<pre>' + esc(summary) + '</pre>';
  } catch(e) {
    document.getElementById('content').innerHTML = '<p class="error">データの読み込みに失敗しました: ' + e.message + '</p>';
  }
})();
</script>
</body></html>`;
}
