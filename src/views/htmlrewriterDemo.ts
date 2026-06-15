function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getHtmlRewriterDemoPage(opts: {
  username: string;
  sourceHtml: string;
  transformedHtml: string;
  rules: { selector: string; action: string; description: string }[];
}): string {
  const { username, sourceHtml, transformedHtml, rules } = opts;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>HTMLRewriter デモ</title>
<style>
:root {
  --bg: #f6f8fa; --surface: #fff; --border: #d0d7de; --text: #1f2328;
  --muted: #57606a; --ok: #1a7f37; --ok-bg: #dafbe1; --blue: #0969da;
  --blue-bg: #ddf4ff; --code-bg: #f0f0f0;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #30363d; --text: #e6edf3;
    --muted: #8b949e; --ok: #3fb950; --ok-bg: #0f2d1a; --blue: #58a6ff;
    --blue-bg: #0c2d4e; --code-bg: #21262d;
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; }
.topbar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 12px 20px; display: flex; align-items: center; gap: 12px; }
.topbar a { color: var(--blue); text-decoration: none; font-size: 12px; }
h1 { font-size: 16px; font-weight: 700; }
.badge { background: var(--blue-bg); color: var(--blue); font-size: 10px; padding: 2px 7px; border-radius: 10px; font-weight: 600; }
.page { max-width: 1200px; margin: 0 auto; padding: 24px 20px; }
.desc { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; line-height: 1.7; color: var(--muted); }
.desc strong { color: var(--text); }
.section-title { font-size: 13px; font-weight: 700; margin-bottom: 10px; color: var(--text); }
.rules-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 12px; }
.rules-table th { background: var(--code-bg); text-align: left; padding: 7px 10px; border: 1px solid var(--border); font-weight: 600; }
.rules-table td { padding: 7px 10px; border: 1px solid var(--border); vertical-align: top; }
.rules-table td:first-child { font-family: monospace; color: var(--blue); white-space: nowrap; }
.rules-table td:nth-child(2) { font-family: monospace; color: var(--ok); white-space: nowrap; }
.diff-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; }
@media (max-width: 800px) { .diff-wrap { grid-template-columns: 1fr; } }
.diff-panel { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.diff-panel-header { background: var(--code-bg); padding: 8px 14px; font-size: 12px; font-weight: 600; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
.diff-panel-body { overflow: auto; max-height: 480px; }
.diff-panel-body pre { padding: 14px; font-family: monospace; font-size: 11px; line-height: 1.6; white-space: pre; background: var(--surface); }
.preview-panel { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 28px; }
.preview-header { background: var(--code-bg); padding: 8px 14px; font-size: 12px; font-weight: 600; border-bottom: 1px solid var(--border); }
.preview-body iframe { width: 100%; height: 400px; border: none; display: block; background: #fff; }
.tag-before { background: #ffebe9; color: #cf222e; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
.tag-after { background: var(--ok-bg); color: var(--ok); padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
</style>
</head>
<body>
<div class="topbar">
  <h1>HTMLRewriter デモ</h1>
  <span class="badge">Cloudflare Workers</span>
  <span style="flex:1"></span>
  <a href="/settings">⚙ 設定</a>
  <span style="color:var(--muted);font-size:11px">${esc(username)}</span>
</div>
<div class="page">

<div class="desc">
  <strong>HTMLRewriter</strong> は Cloudflare Workers 固有の API です。<br>
  HTML レスポンスをストリーミングしながら DOM を書き換えられます。<br>
  通常の DOM 操作と違い <strong>パース済みオブジェクトを持たない</strong> ため、メモリ効率が高く大きなページにも対応できます。<br>
  用途例: 外部ページのプロキシ・A/Bテスト・テンプレート注入・SSR の後処理など。
</div>

<p class="section-title">適用したルール</p>
<table class="rules-table">
  <thead><tr><th>セレクタ</th><th>アクション</th><th>説明</th></tr></thead>
  <tbody>
    ${rules.map(r => `<tr><td>${esc(r.selector)}</td><td>${esc(r.action)}</td><td>${esc(r.description)}</td></tr>`).join('')}
  </tbody>
</table>

<p class="section-title">変換前後の HTML</p>
<div class="diff-wrap">
  <div class="diff-panel">
    <div class="diff-panel-header"><span class="tag-before">BEFORE</span> 入力HTML（変換前）</div>
    <div class="diff-panel-body"><pre>${esc(sourceHtml)}</pre></div>
  </div>
  <div class="diff-panel">
    <div class="diff-panel-header"><span class="tag-after">AFTER</span> HTMLRewriter 適用後</div>
    <div class="diff-panel-body"><pre>${esc(transformedHtml)}</pre></div>
  </div>
</div>

<p class="section-title">変換後ページのプレビュー</p>
<div class="preview-panel">
  <div class="preview-header">iframe プレビュー（変換後HTMLをそのまま表示）</div>
  <div class="preview-body">
    <iframe srcdoc="${transformedHtml.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" sandbox="allow-same-origin"></iframe>
  </div>
</div>

</div>
</body>
</html>`;
}
