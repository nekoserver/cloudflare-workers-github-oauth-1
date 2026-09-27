// /query-builder: 「どのテーブル・どのカラムに対してどう取り出すか」を選択式で
// 組み立てて実行するページ。自由入力のSQL文字列は一切受け付けない
// (テーブル名・カラム名は許可リストから選ぶのみ)。実際のSQL組み立てと
// D1への実行はサーバー側(src/utils/queryBuilder.ts + このページのルート)で
// 行い、ここはUIとクライアント側の入力補助のみを持つ。
// 注意: template literal 内の <script> にはバックスラッシュ系エスケープと
// 正規表現リテラルを書かない(CLAUDE.md ルール29)。改行は
// String.fromCharCode(10) を使う。

function jsonForScript(value: unknown): string {
  // "</script>"がJSONの値(説明文等)に含まれていてもscriptタグが
  // 閉じないようにエスケープする。テーブル定義はすべて開発者が書いた
  // 固定値(ユーザー入力を含まない)だが、念のため常に通す。
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export type QueryBuilderTableOption = { name: string; description: string };

export function getQueryBuilderPage(tables: QueryBuilderTableOption[]): string {
  const sortedTables = [...tables].sort((a, b) => a.name.localeCompare(b.name));
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Query Builder</title>
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
  --hover:       light-dark(#f3f4f6, #21262d);
  --danger:      light-dark(#cf222e, #f85149);
  --danger-bg:   light-dark(#fff0ee, #2d0e0a);
  --ok:          light-dark(#1a7f37, #3fb950);
  --code-bg:     light-dark(#f6f8fa, #010409);
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px;
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px; line-height: 1.5;
  max-width: 1100px; margin-left: auto; margin-right: auto;
}
h1 { color: var(--text-strong); font-size: 20px; margin: 0 0 4px; }
.subtitle { color: var(--text-muted); font-size: 12px; margin-bottom: 18px; }
.panel {
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  padding: 14px 16px; margin-bottom: 14px;
}
.panel h2 { font-size: 13px; color: var(--text-muted); margin: 0 0 10px; }
.row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.row label { min-width: 90px; color: var(--text-muted); }
input, select, textarea {
  background: var(--input-bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font-size: 13px;
}
input[type=number] { width: 90px; }
select.wide, input.wide { flex: 1; min-width: 160px; }
.btn {
  background: var(--panel); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text); font-size: 12px; padding: 5px 10px; cursor: pointer;
}
.btn:hover { background: var(--hover); }
.btn.primary { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
.hint { color: var(--text-muted); font-size: 11px; }
.table-hint { margin-top: 6px; }
.columns-grid { display: flex; flex-wrap: wrap; gap: 6px 14px; }
.columns-grid label { display: flex; align-items: center; gap: 4px; min-width: 0; color: var(--text); font-family: ui-monospace, Menlo, Consolas, monospace; }
.pk-badge { font-size: 10px; background: var(--danger-bg); color: var(--danger); border-radius: 4px; padding: 0 4px; }
.filter-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; }
.filter-row .btn { flex: 0 0 auto; }
#status { font-size: 12px; min-height: 18px; white-space: pre-wrap; }
#status.error { color: var(--danger); }
#status.ok { color: var(--ok); }
#generatedSql, #resultJson { width: 100%; min-height: 90px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; background: var(--code-bg); }
#resultJson { min-height: 220px; }
table.result-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
table.result-table th, table.result-table td { border: 1px solid var(--border); padding: 4px 6px; text-align: left; white-space: nowrap; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
table.result-table th { background: var(--hover); position: sticky; top: 0; }
.result-wrap { overflow: auto; max-height: 420px; }
[hidden] { display: none !important; }
</style>
</head>
<body>
<h1>Query Builder</h1>
<div class="subtitle">許可されたテーブル・カラムから選択式でSELECT文を組み立てて実行します(自由入力のSQLは受け付けません)</div>

<div class="panel">
  <h2>1. テーブル</h2>
  <div class="row">
    <label for="tableSelect">対象テーブル</label>
    <select id="tableSelect" class="wide"><option value="">選択してください</option></select>
  </div>
  <div class="hint table-hint" id="tableDescription"></div>
</div>

<div class="panel" id="modePanel" hidden>
  <h2>2. 取り出し方</h2>
  <div class="row">
    <label>モード</label>
    <label><input type="radio" name="mode" value="rows" id="modeRows" checked> 一覧(行をそのまま取得)</label>
    <label><input type="radio" name="mode" value="aggregate" id="modeAggregate"> 集計(GROUP BY + 件数)</label>
  </div>

  <div id="rowsSection">
    <div class="row"><label>表示カラム</label></div>
    <div class="columns-grid" id="columnsGrid" data-testid="columns-grid"></div>
    <div class="row" style="margin-top:10px">
      <label for="orderByColumn">並び替え</label>
      <select id="orderByColumn" class="wide"><option value="">指定しない</option></select>
      <select id="orderByDirection"><option value="asc">昇順</option><option value="desc">降順</option></select>
    </div>
  </div>

  <div id="aggregateSection" hidden>
    <div class="row">
      <label for="groupByColumn">集計対象カラム</label>
      <select id="groupByColumn" class="wide"><option value="">選択してください</option></select>
    </div>
    <div class="row">
      <label>HAVING</label>
      <span class="hint">件数が</span>
      <select id="havingOp"><option value="">指定しない</option><option value="gte">以上</option><option value="lte">以下</option><option value="eq">ちょうど</option></select>
      <input type="number" id="havingValue" min="0" style="width:80px" disabled>
    </div>
  </div>

  <h2 style="margin-top:14px">3. 絞り込み条件(WHERE、任意・AND結合)</h2>
  <div id="filtersEditor"></div>
  <button type="button" class="btn" id="addFilter">＋ 条件を追加</button>

  <div class="row" style="margin-top:14px">
    <label for="limitValue">取得件数</label>
    <input type="number" id="limitValue" value="20" min="1" max="200">
    <span class="hint">1〜200</span>
  </div>

  <div class="row" style="margin-top:10px">
    <button type="button" class="btn primary" id="btnRun">実行</button>
  </div>
  <div id="status" role="status"></div>
</div>

<div class="panel" id="resultPanel" hidden>
  <h2>生成されたSQL</h2>
  <textarea id="generatedSql" readonly aria-label="生成されたSQL(読み取り専用)"></textarea>
  <h2 style="margin-top:10px">結果</h2>
  <div class="result-wrap"><table class="result-table" id="resultTable" hidden><thead id="resultThead"></thead><tbody id="resultTbody"></tbody></table></div>
  <h2 style="margin-top:10px">JSON</h2>
  <textarea id="resultJson" readonly spellcheck="false" aria-label="結果JSON"></textarea>
  <div class="row" style="margin-top:8px">
    <button type="button" class="btn" id="btnCopyJson">JSONをコピー</button>
    <button type="button" class="btn" id="btnDownloadJson">ダウンロード</button>
  </div>
</div>

<script>
(function() {
  var NL = String.fromCharCode(10);
  var TABLES = ${jsonForScript(sortedTables)};
  var columnsCache = {};
  var currentColumns = [];

  var $ = function(id) { return document.getElementById(id); };
  var tableSelect = $('tableSelect');
  var tableDescription = $('tableDescription');
  var modePanel = $('modePanel');
  var modeRows = $('modeRows');
  var modeAggregate = $('modeAggregate');
  var rowsSection = $('rowsSection');
  var aggregateSection = $('aggregateSection');
  var columnsGrid = $('columnsGrid');
  var orderByColumn = $('orderByColumn');
  var orderByDirection = $('orderByDirection');
  var groupByColumn = $('groupByColumn');
  var havingOp = $('havingOp');
  var havingValue = $('havingValue');
  var filtersEditor = $('filtersEditor');
  var limitValue = $('limitValue');
  var statusEl = $('status');
  var resultPanel = $('resultPanel');
  var generatedSql = $('generatedSql');
  var resultTable = $('resultTable');
  var resultThead = $('resultThead');
  var resultTbody = $('resultTbody');
  var resultJson = $('resultJson');

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = kind || '';
  }

  function populateTableSelect() {
    for (var i = 0; i < TABLES.length; i++) {
      var opt = document.createElement('option');
      opt.value = TABLES[i].name;
      opt.textContent = TABLES[i].name;
      tableSelect.appendChild(opt);
    }
  }

  function findTableDescription(name) {
    for (var i = 0; i < TABLES.length; i++) if (TABLES[i].name === name) return TABLES[i].description;
    return '';
  }

  function fillColumnSelect(select, columns, placeholder) {
    while (select.options.length > 1) select.remove(1);
    for (var i = 0; i < columns.length; i++) {
      var opt = document.createElement('option');
      opt.value = columns[i].name;
      opt.textContent = columns[i].name;
      select.appendChild(opt);
    }
    if (placeholder !== undefined) select.options[0].textContent = placeholder;
  }

  function renderColumnsGrid(columns) {
    while (columnsGrid.firstChild) columnsGrid.removeChild(columnsGrid.firstChild);
    for (var i = 0; i < columns.length; i++) {
      var col = columns[i];
      var label = document.createElement('label');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'column-checkbox';
      box.value = col.name;
      box.checked = true;
      label.appendChild(box);
      var text = document.createElement('span');
      text.textContent = col.name;
      label.appendChild(text);
      if (col.primaryKey) {
        var badge = document.createElement('span');
        badge.className = 'pk-badge';
        badge.textContent = 'PK';
        label.appendChild(badge);
      }
      columnsGrid.appendChild(label);
    }
  }

  function filterValueInputs(op) {
    if (op === 'eq' || op === 'neq' || op === 'like') {
      return '<input type="text" class="filter-value wide" placeholder="値">';
    }
    if (op === 'in') {
      return '<input type="text" class="filter-value wide" placeholder="カンマ区切りで複数指定">';
    }
    if (op === 'between') {
      return '<input type="text" class="filter-from" placeholder="から" style="width:100px"><input type="text" class="filter-to" placeholder="まで" style="width:100px">';
    }
    return '';
  }

  function addFilterRow() {
    var row = document.createElement('div');
    row.className = 'filter-row';
    row.setAttribute('data-testid', 'filter-row');

    var colSelect = document.createElement('select');
    colSelect.className = 'filter-column';
    fillColumnSelect(colSelect, currentColumns);

    var opSelect = document.createElement('select');
    opSelect.className = 'filter-op';
    var ops = [
      ['eq', '='], ['neq', '\\u2260'], ['like', 'LIKE(部分一致)'],
      ['in', 'IN(いずれか)'], ['is_null', 'IS NULL'], ['is_not_null', 'IS NOT NULL'], ['between', '範囲(BETWEEN)']
    ];
    for (var i = 0; i < ops.length; i++) {
      var opt = document.createElement('option');
      opt.value = ops[i][0];
      opt.textContent = ops[i][1];
      opSelect.appendChild(opt);
    }

    var valueHolder = document.createElement('span');
    valueHolder.className = 'filter-value-holder';
    valueHolder.innerHTML = filterValueInputs('eq');

    opSelect.addEventListener('change', function() {
      valueHolder.innerHTML = filterValueInputs(opSelect.value);
    });

    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn';
    del.textContent = '削除';
    del.addEventListener('click', function() { row.remove(); });

    row.appendChild(colSelect);
    row.appendChild(opSelect);
    row.appendChild(valueHolder);
    row.appendChild(del);
    filtersEditor.appendChild(row);
  }

  function clearFilters() {
    while (filtersEditor.firstChild) filtersEditor.removeChild(filtersEditor.firstChild);
  }

  function applyMode() {
    var aggregate = modeAggregate.checked;
    rowsSection.hidden = aggregate;
    aggregateSection.hidden = !aggregate;
  }
  modeRows.addEventListener('change', applyMode);
  modeAggregate.addEventListener('change', applyMode);
  havingOp.addEventListener('change', function() { havingValue.disabled = havingOp.value === ''; });

  function onColumnsLoaded(columns) {
    currentColumns = columns;
    renderColumnsGrid(columns);
    fillColumnSelect(orderByColumn, columns, '指定しない');
    fillColumnSelect(groupByColumn, columns, '選択してください');
    clearFilters();
    modePanel.hidden = false;
    resultPanel.hidden = true;
    setStatus('');
  }

  tableSelect.addEventListener('change', function() {
    var name = tableSelect.value;
    modePanel.hidden = true;
    if (!name) { tableDescription.textContent = ''; return; }
    tableDescription.textContent = findTableDescription(name);
    if (columnsCache[name]) { onColumnsLoaded(columnsCache[name]); return; }
    setStatus('カラム一覧を取得しています…');
    fetch('/api/query-builder/columns?table=' + encodeURIComponent(name), { credentials: 'same-origin' })
      .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, data: data }; }); })
      .then(function(result) {
        if (!result.ok) { setStatus(result.data.error || 'カラム一覧の取得に失敗しました', 'error'); return; }
        columnsCache[name] = result.data.columns;
        onColumnsLoaded(result.data.columns);
      })
      .catch(function(err) { setStatus('カラム一覧の取得に失敗しました: ' + err, 'error'); });
  });

  $('addFilter').addEventListener('click', function() {
    if (currentColumns.length === 0) return;
    addFilterRow();
  });

  function readFilters() {
    var rows = filtersEditor.querySelectorAll('.filter-row');
    var filters = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var column = row.querySelector('.filter-column').value;
      var op = row.querySelector('.filter-op').value;
      if (op === 'is_null' || op === 'is_not_null') {
        filters.push({ column: column, op: op });
      } else if (op === 'in') {
        var raw = row.querySelector('.filter-value').value;
        var values = raw.split(',').map(function(v) { return v.trim(); }).filter(function(v) { return v.length > 0; });
        filters.push({ column: column, op: op, values: values });
      } else if (op === 'between') {
        filters.push({ column: column, op: op, from: row.querySelector('.filter-from').value, to: row.querySelector('.filter-to').value });
      } else {
        filters.push({ column: column, op: op, value: row.querySelector('.filter-value').value });
      }
    }
    return filters;
  }

  function readSpec() {
    var table = tableSelect.value;
    var aggregate = modeAggregate.checked;
    var spec = {
      table: table,
      mode: aggregate ? 'aggregate' : 'rows',
      columns: [],
      filters: readFilters(),
      limit: Number(limitValue.value)
    };
    if (aggregate) {
      spec.groupByColumn = groupByColumn.value;
      if (havingOp.value) {
        spec.havingCountOp = havingOp.value;
        spec.havingCountValue = Number(havingValue.value);
      }
    } else {
      var boxes = columnsGrid.querySelectorAll('.column-checkbox:checked');
      for (var i = 0; i < boxes.length; i++) spec.columns.push(boxes[i].value);
      if (orderByColumn.value) spec.orderBy = { column: orderByColumn.value, direction: orderByDirection.value };
    }
    return spec;
  }

  function renderResultTable(rows) {
    while (resultThead.firstChild) resultThead.removeChild(resultThead.firstChild);
    while (resultTbody.firstChild) resultTbody.removeChild(resultTbody.firstChild);
    if (rows.length === 0) { resultTable.hidden = true; return; }
    resultTable.hidden = false;
    var keys = Object.keys(rows[0]);
    var headRow = document.createElement('tr');
    for (var i = 0; i < keys.length; i++) {
      var th = document.createElement('th');
      th.textContent = keys[i];
      headRow.appendChild(th);
    }
    resultThead.appendChild(headRow);
    for (var r = 0; r < rows.length; r++) {
      var tr = document.createElement('tr');
      for (var c = 0; c < keys.length; c++) {
        var td = document.createElement('td');
        var v = rows[r][keys[c]];
        td.textContent = v === null || v === undefined ? '' : String(v);
        tr.appendChild(td);
      }
      resultTbody.appendChild(tr);
    }
  }

  $('btnRun').addEventListener('click', function() {
    var spec = readSpec();
    setStatus('実行しています…');
    fetch('/api/query-builder/run', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec)
    })
      .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, data: data }; }); })
      .then(function(result) {
        if (!result.ok) {
          setStatus(result.data.error || '実行に失敗しました', 'error');
          if (result.data.sql) { generatedSql.value = result.data.sql; resultPanel.hidden = false; resultTable.hidden = true; resultJson.value = ''; }
          return;
        }
        generatedSql.value = result.data.sql + NL + '-- params: ' + JSON.stringify(result.data.params);
        resultJson.value = JSON.stringify(result.data.rows, null, 2);
        renderResultTable(result.data.rows);
        resultPanel.hidden = false;
        setStatus(result.data.rows.length + '件取得しました', 'ok');
      })
      .catch(function(err) { setStatus('実行に失敗しました: ' + err, 'error'); });
  });

  $('btnCopyJson').addEventListener('click', function() {
    navigator.clipboard.writeText(resultJson.value).then(function() {
      setStatus('コピーしました', 'ok');
    }, function(err) {
      setStatus('コピーに失敗しました: ' + err, 'error');
    });
  });

  $('btnDownloadJson').addEventListener('click', function() {
    var blob = new Blob([resultJson.value], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'query-builder-result.json';
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
  });

  populateTableSelect();
})();
</script>
</body>
</html>`;
}
