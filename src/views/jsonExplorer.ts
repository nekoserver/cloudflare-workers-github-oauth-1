function escJx(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getJsonExplorerPage(username: string): string {
  const safeUser = escJx(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JSONツリービューア</title>
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
  --key-color:   light-dark(#953800, #ffa657);
  --str-color:   light-dark(#0a3069, #a5d6ff);
  --num-color:   light-dark(#116329, #7ee787);
  --kw-color:    light-dark(#cf222e, #ff7b72);
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px;
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px; line-height: 1.5;
  max-width: 980px; margin-left: auto; margin-right: auto;
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
.error-msg {
  display: none; margin-top: 8px; padding: 8px 12px; border-radius: 6px;
  background: var(--danger-bg); color: var(--danger); font-size: 12px;
}
.error-msg.show { display: block; }
.copy-btn.copied { border-color: var(--ok); color: var(--ok); }

#jsonTree {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12.5px; overflow-x: auto;
}
#jsonTree .empty { color: var(--text-muted); font-style: italic; }
.jx-node { margin: 0; }
.jx-row { display: flex; align-items: flex-start; gap: 4px; padding: 1px 0; border-radius: 4px; cursor: pointer; }
.jx-row:hover { background: var(--bg); }
.jx-row.selected { background: var(--accent); }
.jx-row.selected * { color: var(--accent-fg) !important; }
.jx-toggle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; flex-shrink: 0; color: var(--text-muted); user-select: none;
}
.jx-toggle.leaf { visibility: hidden; }
.jx-key { color: var(--key-color); font-weight: 600; }
.jx-punct { color: var(--text-muted); }
.jx-str { color: var(--str-color); }
.jx-num { color: var(--num-color); }
.jx-kw { color: var(--kw-color); }
.jx-count { color: var(--text-muted); font-size: 11px; margin-left: 4px; }
.jx-children { margin-left: 16px; border-left: 1px dashed var(--border); padding-left: 8px; }
.jx-children.collapsed { display: none; }

#pathBox {
  display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap;
}
#pathBox code {
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 4px 8px; font-size: 12px; word-break: break-all;
}
</style>
</head>
<body>
<h1>🌳 JSONツリービューア</h1>
<p class="subtitle">JSONを展開/折り畳み可能なツリーとして表示し、任意の要素だけを抽出できます <span class="user-badge">${safeUser}</span></p>

<div class="panel">
  <div class="panel-label">
    <span>JSON入力</span>
    <button class="btn sm copy-btn" id="btnSample">サンプルを入力</button>
  </div>
  <textarea id="jsonInput" placeholder='{"example": [1, 2, {"nested": true}]}'></textarea>
  <div class="error-msg" id="errorMsg"></div>
</div>

<div class="toolbar">
  <button class="btn primary" id="btnParse">🔍 解析してツリー表示</button>
  <button class="btn" id="btnExpandAll">全て展開</button>
  <button class="btn" id="btnCollapseAll">全て折り畳み</button>
  <button class="btn" id="btnClear">クリア</button>
</div>

<div class="panel">
  <div class="panel-label"><span>ツリー(ノードをクリックすると下に抽出結果を表示)</span></div>
  <div id="jsonTree"><div class="empty">JSONを解析するとここにツリーが表示されます</div></div>
  <div id="pathBox" style="display:none;">
    <span>パス: <code id="selectedPath"></code></span>
    <button class="btn sm copy-btn" id="btnCopyPath">パスをコピー</button>
    <button class="btn sm copy-btn" id="btnCopyValue">抽出結果をコピー</button>
  </div>
  <textarea id="extractOutput" style="margin-top:8px; display:none;" readonly></textarea>
</div>

<script>
(function() {
  var jsonInput = document.getElementById('jsonInput');
  var errorMsg = document.getElementById('errorMsg');
  var jsonTree = document.getElementById('jsonTree');
  var pathBox = document.getElementById('pathBox');
  var selectedPathEl = document.getElementById('selectedPath');
  var extractOutput = document.getElementById('extractOutput');
  var rootValue = null;
  var selectedRow = null;

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.add('show');
  }
  function clearError() {
    errorMsg.textContent = '';
    errorMsg.classList.remove('show');
  }

  function formatPath(segments) {
    var out = 'root';
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (typeof seg === 'number') {
        out += '[' + seg + ']';
      } else {
        out += '.' + seg;
      }
    }
    return out;
  }

  function valueTypeLabel(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }

  function renderPrimitive(v) {
    if (v === null) return '<span class="jx-kw">null</span>';
    if (typeof v === 'boolean') return '<span class="jx-kw">' + v + '</span>';
    if (typeof v === 'number') return '<span class="jx-num">' + v + '</span>';
    return '<span class="jx-str">"' + escVal(String(v)) + '"</span>';
  }

  function escVal(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ノードごとにDOMを構築する(巨大JSONでも展開前は子要素を作らない
  // 遅延構築のほうが望ましいが、まずは単純な即時構築で実装する)。
  function buildNode(key, value, segments, isRoot) {
    var wrap = document.createElement('div');
    wrap.className = 'jx-node';

    var row = document.createElement('div');
    row.className = 'jx-row';
    row.dataset.path = JSON.stringify(segments);

    var isContainer = value !== null && typeof value === 'object';
    var toggle = document.createElement('span');
    toggle.className = 'jx-toggle' + (isContainer ? '' : ' leaf');
    toggle.textContent = isContainer ? '▾' : '·';
    row.appendChild(toggle);

    if (!isRoot) {
      var keySpan = document.createElement('span');
      keySpan.className = 'jx-key';
      keySpan.textContent = typeof key === 'number' ? '[' + key + ']' : key;
      row.appendChild(keySpan);
      var colon = document.createElement('span');
      colon.className = 'jx-punct';
      colon.textContent = typeof key === 'number' ? '' : ':';
      row.appendChild(colon);
    }

    var childrenEl = null;
    if (isContainer) {
      var entries = Array.isArray(value)
        ? value.map(function(v, i) { return [i, v]; })
        : Object.keys(value).map(function(k) { return [k, value[k]]; });
      var countSpan = document.createElement('span');
      countSpan.className = 'jx-count';
      countSpan.textContent = Array.isArray(value) ? '[' + entries.length + ']' : '{' + entries.length + '}';
      row.appendChild(countSpan);

      childrenEl = document.createElement('div');
      childrenEl.className = 'jx-children';
      entries.forEach(function(entry) {
        childrenEl.appendChild(buildNode(entry[0], entry[1], segments.concat([entry[0]]), false));
      });

      toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        var collapsed = childrenEl.classList.toggle('collapsed');
        toggle.textContent = collapsed ? '▸' : '▾';
      });
    } else {
      var valSpan = document.createElement('span');
      valSpan.innerHTML = renderPrimitive(value);
      row.appendChild(valSpan);
    }

    row.addEventListener('click', function() {
      if (selectedRow) selectedRow.classList.remove('selected');
      row.classList.add('selected');
      selectedRow = row;
      showExtracted(segments, value);
    });

    wrap.appendChild(row);
    if (childrenEl) wrap.appendChild(childrenEl);
    return wrap;
  }

  function showExtracted(segments, value) {
    pathBox.style.display = 'flex';
    selectedPathEl.textContent = formatPath(segments);
    extractOutput.style.display = 'block';
    extractOutput.value = JSON.stringify(value, null, 2);
  }

  function renderTree(value) {
    jsonTree.innerHTML = '';
    jsonTree.appendChild(buildNode(null, value, [], true));
  }

  document.getElementById('btnParse').addEventListener('click', function() {
    clearError();
    pathBox.style.display = 'none';
    extractOutput.style.display = 'none';
    selectedRow = null;
    try {
      rootValue = JSON.parse(jsonInput.value);
      renderTree(rootValue);
    } catch (e) {
      jsonTree.innerHTML = '<div class="empty">JSONを解析するとここにツリーが表示されます</div>';
      showError('JSONの解析に失敗しました: ' + (e && e.message ? e.message : e));
    }
  });

  document.getElementById('btnExpandAll').addEventListener('click', function() {
    jsonTree.querySelectorAll('.jx-children.collapsed').forEach(function(el) { el.classList.remove('collapsed'); });
    jsonTree.querySelectorAll('.jx-toggle').forEach(function(el) { if (!el.classList.contains('leaf')) el.textContent = '▾'; });
  });

  document.getElementById('btnCollapseAll').addEventListener('click', function() {
    jsonTree.querySelectorAll('.jx-children').forEach(function(el) { el.classList.add('collapsed'); });
    jsonTree.querySelectorAll('.jx-toggle').forEach(function(el) { if (!el.classList.contains('leaf')) el.textContent = '▸'; });
  });

  document.getElementById('btnClear').addEventListener('click', function() {
    jsonInput.value = '';
    jsonTree.innerHTML = '<div class="empty">JSONを解析するとここにツリーが表示されます</div>';
    pathBox.style.display = 'none';
    extractOutput.style.display = 'none';
    clearError();
    rootValue = null;
    selectedRow = null;
  });

  document.getElementById('btnSample').addEventListener('click', function() {
    jsonInput.value = JSON.stringify({
      name: 'example',
      count: 3,
      active: true,
      tags: ['a', 'b', 'c'],
      nested: { deep: { value: 42 } }
    }, null, 2);
  });

  function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(function() {
      var orig = btn.textContent;
      btn.textContent = 'コピー済';
      btn.classList.add('copied');
      setTimeout(function() { btn.textContent = orig; btn.classList.remove('copied'); }, 1200);
    });
  }

  document.getElementById('btnCopyPath').addEventListener('click', function(e) {
    copyText(selectedPathEl.textContent, e.currentTarget);
  });
  document.getElementById('btnCopyValue').addEventListener('click', function(e) {
    copyText(extractOutput.value, e.currentTarget);
  });
})();
</script>
</body>
</html>`;
}
