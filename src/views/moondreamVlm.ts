function escH(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getMoondreamVlmPage(username: string): string {
  const safeUser = escH(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#000010">
<title>🖼️ Moondream VLM</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000010; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; min-height:100vh; min-height:100svh; display:flex; flex-direction:column; }
.topbar { background:rgba(0,0,20,0.95); border-bottom:1px solid #1e2a40; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
.topbar a:hover { text-decoration:underline; }
h1 { font-size:15px; font-weight:700; flex:1; }
.wrap { max-width:640px; margin:0 auto; padding:24px 18px 60px; width:100%; }
.panel { background:rgba(20,25,45,0.6); border:1px solid #1e2a40; border-radius:10px; padding:18px; margin-bottom:16px; }
.field-label { font-size:12px; color:#8b949e; margin-bottom:6px; display:block; }
#dropZone { border:2px dashed #30363d; border-radius:8px; padding:24px; text-align:center; cursor:pointer; transition:border-color .15s,background .15s; }
#dropZone:hover, #dropZone.dragover { border-color:#fdb813; background:rgba(253,184,19,0.06); }
#dropZone .hint { color:#8b949e; font-size:12px; }
#previewImg { max-width:100%; max-height:320px; border-radius:6px; display:none; margin-top:12px; }
#promptInput { width:100%; background:#0d1117; border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:13px; padding:8px 10px; margin-top:6px; resize:vertical; min-height:60px; font-family:inherit; }
.btn { background:rgba(30,42,64,0.8); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:13px; padding:8px 18px; cursor:pointer; transition:background .15s,border-color .15s,color .15s; }
.btn:hover:not(:disabled) { background:rgba(30,42,64,1); border-color:#fdb813; }
.btn:disabled { opacity:0.5; cursor:not-allowed; }
.btn-primary { background:#2a2000; border-color:#fdb813; color:#fdb813; margin-top:12px; }
.btn-primary:hover:not(:disabled) { background:#3a2c00; }
#resultBox { white-space:pre-wrap; line-height:1.7; font-size:13px; color:#c9d1d9; }
#errorBox { color:#ff7b72; font-size:12px; margin-top:8px; display:none; }
.spinner { display:none; color:#8b949e; font-size:12px; margin-top:10px; }
</style>
</head>
<body>
<div class="topbar">
  <h1>🖼️ Moondream VLM</h1>
  <a href="/">ホーム</a>
  <a href="/aichat">AIチャット</a>
</div>
<div class="wrap">
  <div class="panel">
    <span class="field-label">画像</span>
    <div id="dropZone">
      <div class="hint">クリックまたはドラッグ&ドロップで画像を選択(png/jpeg/webp/gif)</div>
      <img id="previewImg" alt="プレビュー">
    </div>
    <input type="file" id="fileInput" accept="image/*" style="display:none">
    <span class="field-label" style="margin-top:14px;">質問(空欄なら画像の内容を説明します)</span>
    <textarea id="promptInput" placeholder="例: この画像に写っている動物の種類は?"></textarea>
    <button class="btn btn-primary" id="analyzeBtn" disabled>🔍 分析する</button>
    <div class="spinner" id="spinner">分析中…</div>
    <div id="errorBox"></div>
  </div>
  <div class="panel" id="resultPanel" style="display:none;">
    <span class="field-label">分析結果</span>
    <div id="resultBox"></div>
  </div>
</div>

<script>
(function() {
  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('fileInput');
  var previewImg = document.getElementById('previewImg');
  var promptInput = document.getElementById('promptInput');
  var analyzeBtn = document.getElementById('analyzeBtn');
  var spinner = document.getElementById('spinner');
  var errorBox = document.getElementById('errorBox');
  var resultPanel = document.getElementById('resultPanel');
  var resultBox = document.getElementById('resultBox');

  var pendingImageDataUrl = null;

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }
  function clearError() {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }

  function handleFile(file) {
    clearError();
    if (!file || file.type.indexOf('image/') !== 0) {
      showError('画像ファイルを選択してください');
      return;
    }
    var reader = new FileReader();
    reader.onload = function() {
      pendingImageDataUrl = reader.result;
      previewImg.src = pendingImageDataUrl;
      previewImg.style.display = 'block';
      analyzeBtn.disabled = false;
    };
    reader.onerror = function() {
      showError('画像の読み込みに失敗しました');
    };
    reader.readAsDataURL(file);
  }

  dropZone.addEventListener('click', function() { fileInput.click(); });
  fileInput.addEventListener('change', function() {
    if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
  });
  dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', function() {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  analyzeBtn.addEventListener('click', function() {
    if (!pendingImageDataUrl) return;
    clearError();
    resultPanel.style.display = 'none';
    analyzeBtn.disabled = true;
    spinner.style.display = 'block';
    fetch('/api/moondream-analyze', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: pendingImageDataUrl, prompt: promptInput.value })
    }).then(function(res) {
      return res.json().then(function(data) { return { ok: res.ok, data: data }; });
    }).then(function(result) {
      spinner.style.display = 'none';
      analyzeBtn.disabled = false;
      if (!result.ok || !result.data || !result.data.analysis) {
        showError((result.data && result.data.error) || '分析に失敗しました');
        return;
      }
      resultBox.textContent = result.data.analysis;
      resultPanel.style.display = 'block';
    }).catch(function() {
      spinner.style.display = 'none';
      analyzeBtn.disabled = false;
      showError('通信に失敗しました');
    });
  });
})();
</script>
</body>
</html>`;
}
