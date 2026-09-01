function escBinHex(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getBinHexPage(username: string): string {
  const safeUser = escBinHex(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>2進数/16進数変換</title>
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
  --ok:          light-dark(#1a7f37, #3fb950);
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
.subtitle { color: var(--text-muted); font-size: 12px; margin-bottom: 18px; }
.user-badge { font-size: 11px; color: var(--text-muted); }
.panel {
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  padding: 14px 16px; margin-bottom: 14px;
}
.panel-label {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px; font-size: 12px; color: var(--text-muted); font-weight: 600;
}
textarea {
  width: 100%; min-height: 130px; resize: vertical;
  background: var(--input-bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 10px; font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  outline: none;
}
textarea:focus { border-color: var(--accent); }
.toolbar { display: flex; align-items: center; gap: 10px; margin: 14px 0; flex-wrap: wrap; }
.btn {
  background: var(--panel); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text); font-size: 13px; padding: 7px 14px; cursor: pointer;
  transition: background .12s, border-color .12s;
}
.btn:hover { background: var(--bg); border-color: var(--accent); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); font-weight: 600; }
.btn.primary:hover { opacity: .88; }
.btn.sm { font-size: 11px; padding: 4px 10px; }
label.opt { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); cursor: pointer; }
.error-msg {
  display: none; margin-top: 8px; padding: 8px 12px; border-radius: 6px;
  background: var(--danger-bg); color: var(--danger); font-size: 12px;
}
.error-msg.show { display: block; }
.copy-btn.copied { border-color: var(--ok); color: var(--ok); }
</style>
</head>
<body>
<h1>🔢 2進数/16進数変換</h1>
<p class="subtitle">空白・改行区切りで複数値もまとめて変換します <span class="user-badge">${safeUser}</span></p>

<div class="panel">
  <div class="panel-label">
    <span>2進数(例: 1010 1111)</span>
    <button class="btn sm copy-btn" id="copyBin">コピー</button>
  </div>
  <textarea id="binText" placeholder="ここに2進数を入力... (0と1のみ、空白・改行区切りで複数可)"></textarea>
</div>

<div class="toolbar">
  <button class="btn primary" id="btnToHex">↓ 16進数に変換</button>
  <button class="btn primary" id="btnToBin">↑ 2進数に変換</button>
  <button class="btn" id="btnSwap">⇅ 入れ替え</button>
  <button class="btn" id="btnClear">クリア</button>
  <label class="opt"><input type="checkbox" id="upperCase" checked> 16進数は大文字</label>
  <label class="opt"><input type="checkbox" id="withPrefix"> 0x / 0b プレフィックスを付ける</label>
</div>

<div class="panel">
  <div class="panel-label">
    <span>16進数(例: A 2F)</span>
    <button class="btn sm copy-btn" id="copyHex">コピー</button>
  </div>
  <textarea id="hexText" placeholder="ここに16進数を入力... (0-9,A-Fのみ、空白・改行区切りで複数可)"></textarea>
  <div class="error-msg" id="errorMsg"></div>
</div>

<script>
(function() {
  var binText = document.getElementById('binText');
  var hexText = document.getElementById('hexText');
  var upperCase = document.getElementById('upperCase');
  var withPrefix = document.getElementById('withPrefix');
  var errorMsg = document.getElementById('errorMsg');

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.add('show');
  }
  function clearError() {
    errorMsg.textContent = '';
    errorMsg.classList.remove('show');
  }

  function splitTokens(str) {
    return str.split(/[\\s,]+/).map(function(t) { return t.trim(); }).filter(function(t) { return t.length > 0; });
  }

  function stripPrefix(t, prefixRe) {
    return t.replace(prefixRe, '');
  }

  function binToHex(str) {
    var tokens = splitTokens(str);
    if (tokens.length === 0) throw new Error('2進数を入力してください');
    var results = tokens.map(function(t) {
      var body = stripPrefix(t, /^0[bB]/);
      if (!/^[01]+$/.test(body)) throw new Error('不正な2進数です: "' + t + '"（0と1のみ使用できます）');
      var hex = BigInt('0b' + body).toString(16);
      if (upperCase.checked) hex = hex.toUpperCase();
      return (withPrefix.checked ? '0x' : '') + hex;
    });
    return results.join(tokens.length > 1 ? '\\n' : '');
  }

  function hexToBin(str) {
    var tokens = splitTokens(str);
    if (tokens.length === 0) throw new Error('16進数を入力してください');
    var results = tokens.map(function(t) {
      var body = stripPrefix(t, /^0[xX]/);
      if (!/^[0-9a-fA-F]+$/.test(body)) throw new Error('不正な16進数です: "' + t + '"（0-9,A-Fのみ使用できます）');
      var bin = BigInt('0x' + body).toString(2);
      return (withPrefix.checked ? '0b' : '') + bin;
    });
    return results.join(tokens.length > 1 ? '\\n' : '');
  }

  document.getElementById('btnToHex').addEventListener('click', function() {
    clearError();
    try {
      hexText.value = binToHex(binText.value);
    } catch (e) {
      showError(e && e.message ? e.message : String(e));
    }
  });

  document.getElementById('btnToBin').addEventListener('click', function() {
    clearError();
    try {
      binText.value = hexToBin(hexText.value);
    } catch (e) {
      showError(e && e.message ? e.message : String(e));
    }
  });

  document.getElementById('btnSwap').addEventListener('click', function() {
    var tmp = binText.value;
    binText.value = hexText.value;
    hexText.value = tmp;
  });

  document.getElementById('btnClear').addEventListener('click', function() {
    binText.value = '';
    hexText.value = '';
    clearError();
  });

  function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(function() {
      var orig = btn.textContent;
      btn.textContent = 'コピー済';
      btn.classList.add('copied');
      setTimeout(function() { btn.textContent = orig; btn.classList.remove('copied'); }, 1200);
    });
  }

  document.getElementById('copyBin').addEventListener('click', function(e) {
    copyText(binText.value, e.currentTarget);
  });
  document.getElementById('copyHex').addEventListener('click', function(e) {
    copyText(hexText.value, e.currentTarget);
  });
})();
</script>
</body>
</html>`;
}
