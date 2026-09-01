function escKimi(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getKimiCodePage(username: string): string {
  const safeUser = escKimi(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kimi K2.7 Code</title>
<style>
:root {
  color-scheme: light dark;
  --bg:          light-dark(#f6f8fa, #0d1117);
  --panel:       light-dark(#ffffff, #161b22);
  --border:      light-dark(#d0d7de, #30363d);
  --text:        light-dark(#1f2328, #c9d1d9);
  --text-muted:  light-dark(#636c76, #8b949e);
  --text-strong: light-dark(#1f2328, #f0f6fc);
  --accent:      light-dark(#0969da, #58a6ff);
  --accent-fg:   light-dark(#ffffff, #0d1117);
  --input-bg:    light-dark(#ffffff, #0d1117);
  --danger:      light-dark(#cf222e, #f85149);
  --danger-bg:   light-dark(#fff0ee, #2d0e0a);
  --warn:        light-dark(#9a6700, #d29922);
  --warn-bg:     light-dark(#fff8c5, #2b2111);
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px;
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px; line-height: 1.5;
  max-width: 900px; margin-left: auto; margin-right: auto;
}
h1 { color: var(--text-strong); font-size: 20px; margin: 0 0 4px; }
.subtitle { color: var(--text-muted); font-size: 12px; margin-bottom: 12px; }
.user-badge { font-size: 11px; color: var(--text-muted); }
.cost-note {
  background: var(--warn-bg); color: var(--warn); border-radius: 6px;
  padding: 8px 12px; font-size: 11px; margin-bottom: 14px;
}
.panel {
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  padding: 14px 16px; margin-bottom: 14px;
}
.panel-label { font-size: 12px; color: var(--text-muted); font-weight: 600; margin-bottom: 8px; }
textarea {
  width: 100%; resize: vertical;
  background: var(--input-bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 10px; font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  outline: none;
}
textarea:focus { border-color: var(--accent); }
#kimiSystemPrompt { min-height: 60px; }
#kimiPrompt { min-height: 130px; }
.toolbar { display: flex; align-items: center; gap: 10px; margin: 14px 0; flex-wrap: wrap; }
.btn {
  background: var(--accent); border: 1px solid var(--accent); border-radius: 6px;
  color: var(--accent-fg); font-size: 13px; padding: 7px 16px; cursor: pointer;
  font-weight: 600;
}
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn.sm { font-size: 11px; padding: 4px 10px; font-weight: normal; background: var(--panel); color: var(--text); border-color: var(--border); }
.error-msg {
  display: none; margin-top: 8px; padding: 8px 12px; border-radius: 6px;
  background: var(--danger-bg); color: var(--danger); font-size: 12px; white-space: pre-wrap;
}
.error-msg.show { display: block; }
#kimiOutput {
  white-space: pre-wrap; word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12.5px; min-height: 40px;
}
.copy-btn.copied { border-color: var(--accent); color: var(--accent); }
</style>
</head>
<body>
<h1>🌙 Kimi K2.7 Code</h1>
<p class="subtitle">@cf/moonshotai/kimi-k2.7-code にプロンプトを送ってコードを生成します <span class="user-badge">${safeUser}</span></p>
<div class="cost-note">⚠️ このモデルは従量課金です(入力 $0.95/1Mトークン・出力 $4.00/1Mトークン)。多用するとコストがかかります。</div>

<div class="panel">
  <div class="panel-label">システムプロンプト(任意)</div>
  <textarea id="kimiSystemPrompt" placeholder="例: あなたは熟練のTypeScriptエンジニアです"></textarea>
</div>

<div class="panel">
  <div class="panel-label">プロンプト</div>
  <textarea id="kimiPrompt" placeholder="生成してほしいコードの内容を入力..."></textarea>
</div>

<div class="toolbar">
  <button class="btn" id="kimiGenerateBtn">生成する</button>
  <span id="kimiStatus" style="font-size:11px;color:var(--text-muted);"></span>
</div>

<div class="panel">
  <div class="panel-label">
    生成結果
    <button class="btn sm copy-btn" id="kimiCopyBtn" style="float:right;">コピー</button>
  </div>
  <div id="kimiOutput"></div>
  <div class="error-msg" id="kimiErrorMsg"></div>
</div>

<div class="toolbar" id="kimiGemmaToolbar" style="display:none;">
  <button class="btn sm" id="kimiGemmaBtn">🔎 Gemmaにレビューさせる</button>
  <span id="kimiGemmaStatus" style="font-size:11px;color:var(--text-muted);"></span>
</div>

<div class="panel" id="kimiGemmaPanel" style="display:none;">
  <div class="panel-label">gemma-4-26b-a4b-it のレビュー結果 <span style="font-weight:normal;color:var(--text-muted);">(保存済み。左サイドパネルの検索対象で「kimi-gemma」を選ぶと後で検索できます)</span></div>
  <div id="kimiGemmaOutput"></div>
  <div class="error-msg" id="kimiGemmaErrorMsg"></div>
</div>

<script>
(function() {
  var systemPromptEl = document.getElementById('kimiSystemPrompt');
  var promptEl = document.getElementById('kimiPrompt');
  var generateBtn = document.getElementById('kimiGenerateBtn');
  var statusEl = document.getElementById('kimiStatus');
  var outputEl = document.getElementById('kimiOutput');
  var errorEl = document.getElementById('kimiErrorMsg');
  var copyBtn = document.getElementById('kimiCopyBtn');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('show');
  }
  function clearError() {
    errorEl.textContent = '';
    errorEl.classList.remove('show');
  }

  generateBtn.addEventListener('click', function() {
    var prompt = promptEl.value.trim();
    if (!prompt) {
      showError('プロンプトを入力してください');
      return;
    }
    clearError();
    outputEl.textContent = '';
    generateBtn.disabled = true;
    statusEl.textContent = '生成中...';
    fetch('/api/kimi-code/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ prompt: prompt, systemPrompt: systemPromptEl.value.trim() })
    })
      .then(function(r) { return r.text().then(function(t) { return { status: r.status, text: t }; }); })
      .then(function(res) {
        var d = null;
        try { d = JSON.parse(res.text); } catch (e) { d = null; }
        if (d && d.error) {
          showError('生成に失敗しました: ' + d.error);
          return;
        }
        if (!d || typeof d.code !== 'string') {
          showError('生成に失敗しました: HTTP ' + res.status + ' / ' + String(res.text).slice(0, 200));
          return;
        }
        outputEl.textContent = d.code;
        gemmaToolbar.style.display = 'flex';
        gemmaPanel.style.display = 'none';
        clearGemmaError();
        gemmaOutputEl.textContent = '';
      })
      .catch(function(err) {
        showError('通信エラー: ' + ((err && err.message) || '不明'));
      })
      .then(function() {
        generateBtn.disabled = false;
        statusEl.textContent = '';
      });
  });

  var gemmaToolbar = document.getElementById('kimiGemmaToolbar');
  var gemmaBtn = document.getElementById('kimiGemmaBtn');
  var gemmaStatusEl = document.getElementById('kimiGemmaStatus');
  var gemmaPanel = document.getElementById('kimiGemmaPanel');
  var gemmaOutputEl = document.getElementById('kimiGemmaOutput');
  var gemmaErrorEl = document.getElementById('kimiGemmaErrorMsg');

  function showGemmaError(msg) {
    gemmaErrorEl.textContent = msg;
    gemmaErrorEl.classList.add('show');
  }
  function clearGemmaError() {
    gemmaErrorEl.textContent = '';
    gemmaErrorEl.classList.remove('show');
  }

  gemmaBtn.addEventListener('click', function() {
    var code = outputEl.textContent || '';
    if (!code.trim()) {
      showGemmaError('先にコードを生成してください');
      return;
    }
    clearGemmaError();
    gemmaPanel.style.display = 'none';
    gemmaBtn.disabled = true;
    gemmaStatusEl.textContent = 'Gemmaに問い合わせ中...';
    fetch('/api/kimi-code/gemma-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ kimiPrompt: promptEl.value.trim(), code: code })
    })
      .then(function(r) { return r.text().then(function(t) { return { status: r.status, text: t }; }); })
      .then(function(res) {
        var d = null;
        try { d = JSON.parse(res.text); } catch (e) { d = null; }
        if (d && d.error) {
          showGemmaError('レビューに失敗しました: ' + d.error);
          return;
        }
        if (!d || typeof d.review !== 'string') {
          showGemmaError('レビューに失敗しました: HTTP ' + res.status + ' / ' + String(res.text).slice(0, 200));
          return;
        }
        gemmaOutputEl.textContent = d.review;
        gemmaPanel.style.display = 'block';
      })
      .catch(function(err) {
        showGemmaError('通信エラー: ' + ((err && err.message) || '不明'));
      })
      .then(function() {
        gemmaBtn.disabled = false;
        gemmaStatusEl.textContent = '';
      });
  });

  copyBtn.addEventListener('click', function() {
    navigator.clipboard.writeText(outputEl.textContent || '').then(function() {
      var orig = copyBtn.textContent;
      copyBtn.textContent = 'コピー済';
      copyBtn.classList.add('copied');
      setTimeout(function() { copyBtn.textContent = orig; copyBtn.classList.remove('copied'); }, 1200);
    });
  });
})();
</script>
</body>
</html>`;
}
