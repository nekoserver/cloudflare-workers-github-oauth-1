function escB64(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getBase64Page(username: string): string {
  const safeUser = escB64(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Base64エンコード/デコード</title>
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
<h1>🔡 Base64エンコード/デコード</h1>
<p class="subtitle">UTF-8対応。テキストとBase64を相互変換します <span class="user-badge">${safeUser}</span></p>

<div class="panel">
  <div class="panel-label">
    <span>平文</span>
    <button class="btn sm copy-btn" id="copyPlain">コピー</button>
  </div>
  <textarea id="plainText" placeholder="ここにテキストを入力..."></textarea>
</div>

<div class="toolbar">
  <button class="btn primary" id="btnEncode">↓ エンコード</button>
  <button class="btn primary" id="btnDecode">↑ デコード</button>
  <button class="btn" id="btnSwap">⇅ 入れ替え</button>
  <button class="btn" id="btnClear">クリア</button>
  <label class="opt"><input type="checkbox" id="urlSafe"> URLセーフ(-_、パディングなし)</label>
</div>

<div class="panel">
  <div class="panel-label">
    <span>Base64</span>
    <button class="btn sm copy-btn" id="copyB64">コピー</button>
  </div>
  <textarea id="b64Text" placeholder="ここにBase64文字列を入力..."></textarea>
  <div class="error-msg" id="errorMsg"></div>
</div>

<script>
(function() {
  var plainText = document.getElementById('plainText');
  var b64Text = document.getElementById('b64Text');
  var urlSafe = document.getElementById('urlSafe');
  var errorMsg = document.getElementById('errorMsg');

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.add('show');
  }
  function clearError() {
    errorMsg.textContent = '';
    errorMsg.classList.remove('show');
  }

  function toBase64(str) {
    var bytes = new TextEncoder().encode(str);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    var b64 = btoa(binary);
    if (urlSafe.checked) b64 = b64.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
    return b64;
  }

  function fromBase64(b64) {
    var normalized = b64.trim();
    if (urlSafe.checked || normalized.indexOf('-') !== -1 || normalized.indexOf('_') !== -1) {
      normalized = normalized.replace(/-/g, '+').replace(/_/g, '/');
    }
    while (normalized.length % 4 !== 0) normalized += '=';
    var binary = atob(normalized);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  document.getElementById('btnEncode').addEventListener('click', function() {
    clearError();
    try {
      b64Text.value = toBase64(plainText.value);
    } catch (e) {
      showError('エンコードに失敗しました: ' + (e && e.message ? e.message : e));
    }
  });

  document.getElementById('btnDecode').addEventListener('click', function() {
    clearError();
    try {
      plainText.value = fromBase64(b64Text.value);
    } catch (e) {
      showError('デコードに失敗しました(不正なBase64、またはUTF-8として解釈できません): ' + (e && e.message ? e.message : e));
    }
  });

  document.getElementById('btnSwap').addEventListener('click', function() {
    var tmp = plainText.value;
    plainText.value = b64Text.value;
    b64Text.value = tmp;
  });

  document.getElementById('btnClear').addEventListener('click', function() {
    plainText.value = '';
    b64Text.value = '';
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

  document.getElementById('copyPlain').addEventListener('click', function(e) {
    copyText(plainText.value, e.currentTarget);
  });
  document.getElementById('copyB64').addEventListener('click', function(e) {
    copyText(b64Text.value, e.currentTarget);
  });
})();
</script>
</body>
</html>`;
}
