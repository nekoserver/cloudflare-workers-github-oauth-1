export function getFetchTextStreamDemoPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fetch API textStream サンプル</title>
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
.page { max-width: 900px; margin: 0 auto; padding: 24px 20px; }
h1 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
.desc { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; line-height: 1.7; color: var(--muted); }
.desc strong { color: var(--text); }
.section-title { font-size: 13px; font-weight: 700; margin: 20px 0 8px; color: var(--text); }
pre { background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; padding: 14px; font-family: monospace; font-size: 12px; line-height: 1.6; overflow-x: auto; white-space: pre; }
.controls { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
input[type=text] { flex: 1; padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 12px; }
button { padding: 7px 16px; border: 1px solid var(--border); border-radius: 6px; background: var(--blue-bg); color: var(--blue); font-weight: 600; font-size: 12px; cursor: pointer; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.output { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 14px; font-family: monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; min-height: 120px; max-height: 400px; overflow-y: auto; }
.status { font-size: 11px; color: var(--muted); margin-top: 6px; }
.badge { background: var(--blue-bg); color: var(--blue); font-size: 10px; padding: 2px 7px; border-radius: 10px; font-weight: 600; margin-left: 6px; }
</style>
</head>
<body>
<div class="page">
<h1>Fetch API — textStream サンプル<span class="badge">demo</span></h1>
<div class="desc">
Fetch APIの標準仕様には <code>textStream()</code> という専用メソッドは存在しないため、
<code>response.body</code>(<code>ReadableStream&lt;Uint8Array&gt;</code>) を
<code>TextDecoderStream</code> にパイプして文字列チャンクのストリームとして読み取るのが
標準的な「textStream相当」の実装パターンです。下のフォームで実際に動作を確認できます。
</div>

<div class="section-title">サンプルコード</div>
<pre>async function fetchAsTextStream(url, onChunk) {
  const response = await fetch(url);
  if (!response.body) throw new Error('レスポンスボディが空です');

  const textStream = response.body.pipeThrough(new TextDecoderStream());
  const reader = textStream.getReader();

  let fullText = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fullText += value;
    onChunk(value);
  }
  return fullText;
}</pre>

<div class="section-title">実行してみる</div>
<div class="controls">
  <input type="text" id="url-input" value="/health" />
  <button id="run-btn">実行</button>
</div>
<div class="output" id="output"></div>
<div class="status" id="status"></div>
</div>

<script>
async function fetchAsTextStream(url, onChunk) {
  const response = await fetch(url);
  if (!response.body) throw new Error('レスポンスボディが空です');

  const textStream = response.body.pipeThrough(new TextDecoderStream());
  const reader = textStream.getReader();

  let fullText = '';
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    fullText += result.value;
    onChunk(result.value);
  }
  return fullText;
}

var runBtn = document.getElementById('run-btn');
var urlInput = document.getElementById('url-input');
var outputEl = document.getElementById('output');
var statusEl = document.getElementById('status');

runBtn.addEventListener('click', function () {
  var url = urlInput.value.trim();
  if (!url) return;

  runBtn.disabled = true;
  outputEl.textContent = '';
  statusEl.textContent = '実行中...';

  var chunkCount = 0;
  var startedAt = performance.now();

  fetchAsTextStream(url, function (chunk) {
    chunkCount += 1;
    outputEl.textContent += chunk;
  }).then(function (fullText) {
    var elapsed = Math.round(performance.now() - startedAt);
    statusEl.textContent = '完了: ' + chunkCount + ' チャンク受信 / 全長 ' + fullText.length + ' 文字 / ' + elapsed + 'ms';
  }).catch(function (err) {
    statusEl.textContent = 'エラー: ' + err.message;
  }).finally(function () {
    runBtn.disabled = false;
  });
});
</script>
</body>
</html>`;
}
