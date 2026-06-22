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
@media (prefers-color-scheme:light) { :root { --bg:#f6f8fa; --fg:#24292f; --card:#fff; --border:#d0d7de; --label:#57606a; --btn-bg:#f3f4f6; --btn-border:#d0d7de; --btn-hover:#e9ecef; --code-bg:#f6f8fa; --accent:#0969da; --accent-fg:#fff; --badge-v4-bg:rgba(130,80,255,.12); --badge-v4-fg:#6f3fd6; --badge-v7-bg:rgba(45,164,78,.12); --badge-v7-fg:#1a7f37; --danger:#cf222e; } }
@media (prefers-color-scheme:dark) { :root { --bg:#0d1117; --fg:#e6edf3; --card:#161b22; --border:#30363d; --label:#8b949e; --btn-bg:#21262d; --btn-border:#30363d; --btn-hover:#30363d; --code-bg:#0d1117; --accent:#1f6feb; --accent-fg:#fff; --badge-v4-bg:rgba(130,80,255,.18); --badge-v4-fg:#a371f7; --badge-v7-bg:rgba(45,164,78,.18); --badge-v7-fg:#3fb950; --danger:#f85149; } }
.topbar { background:var(--card); border-bottom:1px solid var(--border); padding:10px 20px; display:flex; align-items:center; gap:12px; flex-shrink:0; }
.topbar h1 { font-size:16px; font-weight:700; flex:1; }
.topbar a { color:var(--accent); text-decoration:none; font-size:12px; }
.topbar a:hover { text-decoration:underline; }
.user-badge { font-size:11px; background:rgba(31,111,235,.15); color:var(--accent); border-radius:12px; padding:2px 10px; }
main { flex:1; max-width:860px; width:100%; margin:0 auto; padding:24px 16px; display:flex; flex-direction:column; gap:16px; }
.card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:18px 20px; }
.card-title { font-size:13px; font-weight:600; color:var(--label); margin-bottom:14px; text-transform:uppercase; letter-spacing:.04em; }
.row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
label { font-size:12px; color:var(--label); white-space:nowrap; }
select, input[type=number], input[type=text] { background:var(--btn-bg); border:1px solid var(--btn-border); border-radius:6px; color:var(--fg); font-size:13px; padding:6px 10px; outline:none; }
select:focus, input:focus { border-color:var(--accent); }
input[type=number] { width:72px; }
input[type=text] { flex:1; min-width:160px; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; }
.btn { background:var(--btn-bg); border:1px solid var(--btn-border); border-radius:6px; color:var(--fg); font-size:13px; padding:7px 14px; cursor:pointer; transition:background .12s,border-color .12s; white-space:nowrap; }
.btn:hover { background:var(--btn-hover); border-color:var(--accent); }
.btn.primary { background:var(--accent); border-color:var(--accent); color:var(--accent-fg); font-weight:600; }
.btn.primary:hover { opacity:.88; }
.btn.sm { font-size:11px; padding:4px 10px; }
.btn.danger { border-color:var(--danger); color:var(--danger); }
.btn.danger:hover { background:rgba(207,34,46,.08); }
.fmt-tabs { display:flex; gap:6px; }
.ftab { background:var(--btn-bg); border:1px solid var(--btn-border); border-radius:6px; color:var(--label); font-size:12px; padding:4px 12px; cursor:pointer; transition:background .1s; }
.ftab.active { background:var(--accent); border-color:var(--accent); color:var(--accent-fg); }
.list-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
.list-count { font-size:12px; color:var(--label); flex:1; }
.uuid-list { display:flex; flex-direction:column; gap:5px; max-height:400px; overflow-y:auto; }
.uuid-row { display:flex; align-items:center; gap:8px; background:var(--code-bg); border:1px solid var(--border); border-radius:6px; padding:6px 10px; }
.uuid-row.search-hit { border-color:var(--accent); }
.ver-badge { font-size:10px; padding:2px 6px; border-radius:4px; white-space:nowrap; flex-shrink:0; }
.ver-badge.v4 { background:var(--badge-v4-bg); color:var(--badge-v4-fg); }
.ver-badge.v7 { background:var(--badge-v7-bg); color:var(--badge-v7-fg); }
.uuid-text { font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:12px; flex:1; word-break:break-all; }
.uuid-ts { font-size:10px; color:var(--label); white-space:nowrap; flex-shrink:0; }
.copy-btn { background:transparent; border:1px solid var(--btn-border); border-radius:5px; color:var(--label); font-size:11px; padding:3px 8px; cursor:pointer; transition:all .12s; white-space:nowrap; }
.copy-btn:hover { background:var(--btn-hover); color:var(--fg); border-color:var(--accent); }
.copy-btn.copied { border-color:#2da44e; color:#2da44e; }
.empty-hint { color:var(--label); font-size:13px; text-align:center; padding:28px 0; }
.save-status { font-size:11px; color:var(--label); margin-left:auto; }
.save-status.ok { color:#2da44e; }
.save-status.err { color:var(--danger); }
.tab-bar { display:flex; gap:0; border-bottom:1px solid var(--border); margin-bottom:16px; }
.tab { font-size:13px; padding:8px 16px; cursor:pointer; color:var(--label); border-bottom:2px solid transparent; margin-bottom:-1px; }
.tab.active { color:var(--fg); border-bottom-color:var(--accent); font-weight:600; }
.pane { display:none; }
.pane.active { display:block; }
.search-row { display:flex; gap:8px; margin-bottom:12px; }
</style>
</head>
<body>
<div class="topbar">
  <h1>🔑 UUID生成</h1>
  <a href="/">ホーム</a>
  <span class="user-badge">${safeUser}</span>
  <span id="d1CountBadge" style="font-size:11px;background:rgba(31,111,235,.15);color:var(--accent);border-radius:12px;padding:2px 10px;display:none">D1: <span id="d1CountVal">-</span>件</span>
</div>
<main>
  <div class="card">
    <div class="card-title">生成設定</div>
    <div class="row" style="margin-bottom:12px">
      <label>バージョン</label>
      <select id="verSel">
        <option value="v4">v4 (ランダム)</option>
        <option value="v7">v7 (時刻順)</option>
        <option value="both">v4 + v7 を交互</option>
      </select>
      <label>件数</label>
      <input type="number" id="countInput" min="1" max="100" value="5">
      <button class="btn primary" id="btnGen">生成 (Ctrl+Enter)</button>
      <span class="save-status" id="saveStatus"></span>
    </div>
    <div class="row">
      <label>フォーマット</label>
      <div class="fmt-tabs">
        <button class="ftab active" data-fmt="hyphen">ハイフンあり</button>
        <button class="ftab" data-fmt="no-hyphen">ハイフンなし</button>
        <button class="ftab" data-fmt="braces">波括弧 {}</button>
        <button class="ftab" data-fmt="upper">大文字</button>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="tab-bar">
      <div class="tab active" data-tab="gen">今回生成</div>
      <div class="tab" data-tab="history">履歴検索</div>
    </div>

    <div class="pane active" id="paneGen">
      <div class="list-header">
        <span class="list-count" id="genCount">0件</span>
        <button class="btn sm" id="btnCopyAll" style="display:none">全てコピー</button>
        <button class="btn sm danger" id="btnClear" style="display:none">クリア</button>
      </div>
      <div class="uuid-list" id="genList">
        <div class="empty-hint">上の「生成」ボタンを押してください</div>
      </div>
    </div>

    <div class="pane" id="paneHistory">
      <div class="search-row">
        <input type="text" id="searchInput" placeholder="UUIDの一部を入力して検索…（例: a1b2-c3d4）">
        <button class="btn primary" id="btnSearch">検索</button>
        <button class="btn sm danger" id="btnDeleteAll" title="全履歴削除">全削除</button>
      </div>
      <div class="list-header">
        <span class="list-count" id="histCount">-</span>
      </div>
      <div class="uuid-list" id="histList">
        <div class="empty-hint">検索してください</div>
      </div>
    </div>
  </div>
</main>

<script>
(function() {
  var verSel = document.getElementById('verSel');
  var countInput = document.getElementById('countInput');
  var btnGen = document.getElementById('btnGen');
  var btnCopyAll = document.getElementById('btnCopyAll');
  var btnClear = document.getElementById('btnClear');
  var genList = document.getElementById('genList');
  var genCount = document.getElementById('genCount');
  var saveStatus = document.getElementById('saveStatus');
  var searchInput = document.getElementById('searchInput');
  var btnSearch = document.getElementById('btnSearch');
  var btnDeleteAll = document.getElementById('btnDeleteAll');
  var histList = document.getElementById('histList');
  var histCount = document.getElementById('histCount');

  var currentFmt = 'hyphen';
  var generatedUuids = [];
  var d1CountBadge = document.getElementById('d1CountBadge');
  var d1CountVal = document.getElementById('d1CountVal');

  function refreshD1Count() {
    fetch('/api/uuid/count').then(function(r) { return r.json(); }).then(function(d) {
      d1CountVal.textContent = d.count;
      d1CountBadge.style.display = '';
    }).catch(function() {});
  }
  refreshD1Count();

  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.pane').forEach(function(p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var pane = document.getElementById('pane' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1));
      if (pane) pane.classList.add('active');
      if (tab.dataset.tab === 'history') loadHistory('');
    });
  });

  document.querySelectorAll('.ftab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.ftab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentFmt = tab.dataset.fmt;
      if (generatedUuids.length > 0) renderGenList();
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
    var b = new Uint8Array(11);
    crypto.getRandomValues(b);
    var hi32 = (msHi >>> 0);
    var lo16 = ((msLo << 4) | (b[0] & 0x0f)) & 0xffff;
    var ver = (0x7000 | (((b[1] << 8) | b[2]) & 0x0fff));
    var varB = (0x8000 | (((b[3] << 8) | b[4]) & 0x3fff));
    var tail = Array.from(b.slice(5)).map(function(x) { return x.toString(16).padStart(2, '0'); }).join('');
    return hi32.toString(16).padStart(8,'0')+'-'+lo16.toString(16).padStart(4,'0')+'-'+ver.toString(16).padStart(4,'0')+'-'+varB.toString(16).padStart(4,'0')+'-'+tail;
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

  function buildUuidRow(rawUuid, ver, ts, isSearchHit) {
    var disp = applyFormat(rawUuid);
    var verCls = ver === 'v7' ? 'v7' : 'v4';
    var rowCls = 'uuid-row' + (isSearchHit ? ' search-hit' : '');
    return '<div class="' + rowCls + '" data-uuid="' + rawUuid + '">' +
      '<span class="ver-badge ' + verCls + '">' + ver + '</span>' +
      '<span class="uuid-text">' + disp + '</span>' +
      (ts ? '<span class="uuid-ts">' + ts + '</span>' : '') +
      '<button class="copy-btn">コピー</button>' +
      '</div>';
  }

  function attachCopyHandlers(container) {
    container.querySelectorAll('.copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var row = btn.closest('.uuid-row');
        copyText(applyFormat(row.dataset.uuid), btn);
      });
    });
  }

  function renderGenList() {
    if (generatedUuids.length === 0) {
      genList.innerHTML = '<div class="empty-hint">上の「生成」ボタンを押してください</div>';
      genCount.textContent = '0件';
      btnCopyAll.style.display = 'none';
      btnClear.style.display = 'none';
      return;
    }
    genCount.textContent = generatedUuids.length + '件';
    btnCopyAll.style.display = '';
    btnClear.style.display = '';
    var html = '';
    for (var i = 0; i < generatedUuids.length; i++) {
      html += buildUuidRow(generatedUuids[i].uuid, generatedUuids[i].ver, '', false);
    }
    genList.innerHTML = html;
    attachCopyHandlers(genList);
  }

  var saveTimer = null;
  function setSaveStatus(msg, cls) {
    saveStatus.textContent = msg;
    saveStatus.className = 'save-status' + (cls ? ' ' + cls : '');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function() { saveStatus.textContent = ''; saveStatus.className = 'save-status'; }, 3000);
  }

  function saveToD1(items) {
    fetch('/api/uuid/save', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ uuids: items })
    }).then(function(r) { return r.json(); }).then(function(d) {
      setSaveStatus('D1保存: ' + d.saved + '件', 'ok');
      refreshD1Count();
    }).catch(function() {
      setSaveStatus('D1保存失敗', 'err');
    });
  }

  btnGen.addEventListener('click', function() {
    var count = Math.min(100, Math.max(1, parseInt(countInput.value) || 1));
    var ver = verSel.value;
    var newItems = [];
    for (var i = 0; i < count; i++) {
      var v = ver === 'both' ? (i % 2 === 0 ? 'v4' : 'v7') : ver;
      var uuid = v === 'v7' ? uuidV7() : uuidV4();
      newItems.push({ uuid: uuid, ver: v });
    }
    generatedUuids = newItems.concat(generatedUuids);
    if (generatedUuids.length > 500) generatedUuids = generatedUuids.slice(0, 500);
    renderGenList();
    saveToD1(newItems.map(function(it) { return { uuid: it.uuid, version: it.ver }; }));
  });

  btnClear.addEventListener('click', function() {
    generatedUuids = [];
    renderGenList();
  });

  btnCopyAll.addEventListener('click', function() {
    var text = generatedUuids.map(function(it) { return applyFormat(it.uuid); }).join('\\n');
    copyText(text, btnCopyAll);
  });

  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') btnGen.click();
  });

  function renderHistList(results, query) {
    histCount.textContent = results.length + '件';
    if (results.length === 0) {
      histList.innerHTML = '<div class="empty-hint">' + (query ? '「' + query + '」に一致する履歴なし' : '履歴なし') + '</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var ts = r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '';
      var hit = query && r.uuid.indexOf(query.toLowerCase()) >= 0;
      html += buildUuidRow(r.uuid, r.version, ts, hit);
    }
    histList.innerHTML = html;
    attachCopyHandlers(histList);
  }

  function loadHistory(q) {
    histList.innerHTML = '<div class="empty-hint">読み込み中…</div>';
    histCount.textContent = '-';
    var url = '/api/uuid/search?limit=100' + (q ? '&q=' + encodeURIComponent(q) : '');
    fetch(url).then(function(r) { return r.json(); }).then(function(d) {
      renderHistList(d.results || [], d.query || '');
    }).catch(function() {
      histList.innerHTML = '<div class="empty-hint">読み込み失敗</div>';
    });
  }

  btnSearch.addEventListener('click', function() {
    loadHistory(searchInput.value.trim());
  });
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') btnSearch.click();
  });

  btnDeleteAll.addEventListener('click', function() {
    if (!confirm('全ての履歴を削除しますか?')) return;
    fetch('/api/uuid/history', { method: 'DELETE' }).then(function(r) { return r.json(); }).then(function() {
      loadHistory('');
      refreshD1Count();
    });
  });
})();
</script>
</body>
</html>`;
}
