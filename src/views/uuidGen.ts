function escU(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getUuidGenPage(username: string): string {
  const safeUser = escU(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>UUID生成</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--bg,#0d1117); color:var(--fg,#e6edf3); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:14px; min-height:100vh; display:flex; flex-direction:column; }
@media (prefers-color-scheme:light) { :root { --bg:#f6f8fa; --fg:#24292f; --card:#fff; --border:#d0d7de; --label:#57606a; --btn-bg:#f3f4f6; --btn-border:#d0d7de; --btn-hover:#e9ecef; --code-bg:#f6f8fa; --accent:#0969da; --accent-fg:#fff; --badge-bg:#ddf4ff; --badge-fg:#0550ae; } }
@media (prefers-color-scheme:dark) { :root { --bg:#0d1117; --fg:#e6edf3; --card:#161b22; --border:#30363d; --label:#8b949e; --btn-bg:#21262d; --btn-border:#30363d; --btn-hover:#30363d; --code-bg:#161b22; --accent:#1f6feb; --accent-fg:#fff; --badge-bg:#1d3651; --badge-fg:#79c0ff; } }
.topbar { background:var(--card); border-bottom:1px solid var(--border); padding:10px 20px; display:flex; align-items:center; gap:12px; flex-shrink:0; }
.topbar h1 { font-size:16px; font-weight:700; flex:1; }
.topbar a { color:var(--accent); text-decoration:none; font-size:12px; }
.topbar a:hover { text-decoration:underline; }
.user-badge { font-size:11px; color:var(--label); background:var(--badge-bg); color:var(--badge-fg); border-radius:12px; padding:2px 10px; }
main { flex:1; max-width:820px; width:100%; margin:0 auto; padding:28px 20px; display:flex; flex-direction:column; gap:20px; }
.card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:20px 24px; }
.card h2 { font-size:14px; font-weight:600; margin-bottom:16px; color:var(--fg); }
.ctrl-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.ctrl-label { font-size:12px; color:var(--label); white-space:nowrap; }
select, input[type=number] { background:var(--btn-bg); border:1px solid var(--btn-border); border-radius:6px; color:var(--fg); font-size:13px; padding:6px 10px; outline:none; }
select:focus, input[type=number]:focus { border-color:var(--accent); }
input[type=number] { width:72px; }
.btn { background:var(--btn-bg); border:1px solid var(--btn-border); border-radius:6px; color:var(--fg); font-size:13px; padding:7px 16px; cursor:pointer; transition:background .12s,border-color .12s; white-space:nowrap; }
.btn:hover { background:var(--btn-hover); border-color:var(--accent); }
.btn.primary { background:var(--accent); border-color:var(--accent); color:var(--accent-fg); font-weight:600; }
.btn.primary:hover { opacity:.88; }
.btn.small { font-size:11px; padding:4px 10px; }
.btn.danger { border-color:#cf222e; color:#cf222e; }
.btn.danger:hover { background:rgba(207,34,46,.1); }
.result-area { display:flex; flex-direction:column; gap:0; }
.result-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
.result-count { font-size:12px; color:var(--label); flex:1; }
.uuid-list { display:flex; flex-direction:column; gap:6px; max-height:480px; overflow-y:auto; }
.uuid-row { display:flex; align-items:center; gap:8px; background:var(--code-bg); border:1px solid var(--border); border-radius:6px; padding:7px 12px; }
.uuid-text { font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:13px; flex:1; letter-spacing:.03em; word-break:break-all; color:var(--fg); }
.uuid-ver { font-size:10px; padding:2px 6px; border-radius:4px; background:var(--badge-bg); color:var(--badge-fg); white-space:nowrap; }
.copy-btn { background:transparent; border:1px solid var(--btn-border); border-radius:5px; color:var(--label); font-size:11px; padding:3px 8px; cursor:pointer; transition:all .12s; white-space:nowrap; }
.copy-btn:hover { background:var(--btn-hover); color:var(--fg); border-color:var(--accent); }
.copy-btn.copied { border-color:#2da44e; color:#2da44e; }
.empty-hint { color:var(--label); font-size:13px; text-align:center; padding:32px 0; }
.ver-badge-v4 { background:rgba(130,80,255,.15); color:#a371f7; }
.ver-badge-v7 { background:rgba(45,164,78,.15); color:#3fb950; }
.format-tabs { display:flex; gap:6px; margin-bottom:14px; }
.ftab { background:var(--btn-bg); border:1px solid var(--btn-border); border-radius:6px; color:var(--label); font-size:12px; padding:4px 12px; cursor:pointer; }
.ftab.active { background:var(--accent); border-color:var(--accent); color:var(--accent-fg); }
</style>
</head>
<body>
<div class="topbar">
  <h1>🔑 UUID生成</h1>
  <a href="/">ホーム</a>
  <span class="user-badge">${safeUser}</span>
</div>
<main>
  <div class="card">
    <h2>生成設定</h2>
    <div class="ctrl-row">
      <span class="ctrl-label">バージョン</span>
      <select id="verSel">
        <option value="v4">v4 (ランダム)</option>
        <option value="v7">v7 (時刻順)</option>
        <option value="both">v4 + v7 を交互</option>
      </select>
      <span class="ctrl-label">件数</span>
      <input type="number" id="countInput" min="1" max="100" value="5">
      <button class="btn primary" id="btnGen">生成</button>
      <button class="btn" id="btnClear" style="margin-left:auto">クリア</button>
    </div>
    <div class="ctrl-row" style="margin-top:12px">
      <span class="ctrl-label">フォーマット</span>
      <div class="format-tabs">
        <button class="ftab active" data-fmt="hyphen">ハイフンあり</button>
        <button class="ftab" data-fmt="no-hyphen">ハイフンなし</button>
        <button class="ftab" data-fmt="braces">波括弧 {}</button>
        <button class="ftab" data-fmt="upper">大文字</button>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="result-area">
      <div class="result-header">
        <span class="result-count" id="resultCount">0件</span>
        <button class="btn small" id="btnCopyAll" style="display:none">全てコピー</button>
      </div>
      <div class="uuid-list" id="uuidList">
        <div class="empty-hint">上の「生成」ボタンを押してください</div>
      </div>
    </div>
  </div>
</main>

<script>
(function() {
  var verSel = document.getElementById('verSel');
  var countInput = document.getElementById('countInput');
  var btnGen = document.getElementById('btnGen');
  var btnClear = document.getElementById('btnClear');
  var btnCopyAll = document.getElementById('btnCopyAll');
  var uuidList = document.getElementById('uuidList');
  var resultCount = document.getElementById('resultCount');
  var currentFmt = 'hyphen';
  var generatedUuids = [];

  document.querySelectorAll('.ftab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.ftab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentFmt = tab.getAttribute('data-fmt');
      if (generatedUuids.length > 0) renderList();
    });
  });

  function uuidV4() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.from(b).map(function(x) { return x.toString(16).padStart(2, '0'); });
    return h[0]+h[1]+h[2]+h[3]+'-'+h[4]+h[5]+'-'+h[6]+h[7]+'-'+h[8]+h[9]+'-'+h[10]+h[11]+h[12]+h[13]+h[14]+h[15];
  }

  function uuidV7() {
    var ms = Date.now();
    var msHi = Math.floor(ms / 0x1000);
    var msLo = ms & 0xfff;
    var b = new Uint8Array(10);
    crypto.getRandomValues(b);
    var hi32 = (msHi >>> 0);
    var lo16 = ((msLo << 4) | (b[0] & 0x0f)) & 0xffff;
    var ver = (0x7000 | (((b[1] << 8) | b[2]) & 0x0fff));
    var var1 = (0x8000 | (((b[3] << 8) | b[4]) & 0x3fff));
    var r = [];
    r.push(hi32.toString(16).padStart(8, '0'));
    r.push(lo16.toString(16).padStart(4, '0'));
    r.push(ver.toString(16).padStart(4, '0'));
    r.push(var1.toString(16).padStart(4, '0'));
    var tail = Array.from(b.slice(5)).map(function(x) { return x.toString(16).padStart(2, '0'); }).join('');
    r.push(tail);
    return r[0]+'-'+r[1]+'-'+r[2]+'-'+r[3]+'-'+r[4];
  }

  function applyFormat(uuid) {
    if (currentFmt === 'no-hyphen') return uuid.replace(/-/g, '');
    if (currentFmt === 'braces') return '{' + uuid + '}';
    if (currentFmt === 'upper') return uuid.toUpperCase();
    return uuid;
  }

  function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(function() {
      var orig = btn.textContent;
      btn.textContent = 'コピー済';
      btn.classList.add('copied');
      setTimeout(function() { btn.textContent = orig; btn.classList.remove('copied'); }, 1200);
    });
  }

  function renderList() {
    if (generatedUuids.length === 0) {
      uuidList.innerHTML = '<div class="empty-hint">上の「生成」ボタンを押してください</div>';
      resultCount.textContent = '0件';
      btnCopyAll.style.display = 'none';
      return;
    }
    resultCount.textContent = generatedUuids.length + '件';
    btnCopyAll.style.display = '';
    var html = '';
    for (var i = 0; i < generatedUuids.length; i++) {
      var item = generatedUuids[i];
      var disp = applyFormat(item.uuid);
      var verClass = item.ver === 'v7' ? 'ver-badge-v7' : 'ver-badge-v4';
      html += '<div class="uuid-row">';
      html += '<span class="uuid-ver ' + verClass + '">' + item.ver + '</span>';
      html += '<span class="uuid-text">' + disp + '</span>';
      html += '<button class="copy-btn" data-idx="' + i + '">コピー</button>';
      html += '</div>';
    }
    uuidList.innerHTML = html;
    uuidList.querySelectorAll('.copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.getAttribute('data-idx'));
        copyText(applyFormat(generatedUuids[idx].uuid), btn);
      });
    });
  }

  btnGen.addEventListener('click', function() {
    var count = Math.min(100, Math.max(1, parseInt(countInput.value) || 1));
    var ver = verSel.value;
    for (var i = 0; i < count; i++) {
      var v;
      if (ver === 'both') { v = i % 2 === 0 ? 'v4' : 'v7'; }
      else { v = ver; }
      var uuid = v === 'v7' ? uuidV7() : uuidV4();
      generatedUuids.unshift({ uuid: uuid, ver: v });
    }
    if (generatedUuids.length > 500) generatedUuids = generatedUuids.slice(0, 500);
    renderList();
  });

  btnClear.addEventListener('click', function() {
    generatedUuids = [];
    renderList();
  });

  btnCopyAll.addEventListener('click', function() {
    var text = generatedUuids.map(function(item) { return applyFormat(item.uuid); }).join('\\n');
    copyText(text, btnCopyAll);
  });

  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      btnGen.click();
    }
  });
})();
</script>
</body>
</html>`;
}
