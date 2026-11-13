// 静的アセットのサンプル。外部ファイルにして、インラインのスクリプトを使わない(CSP)。
'use strict';
(function () {
  var FILES = ['/static-assets-sample/index.html', '/static-assets-sample/style.css', '/static-assets-sample/app.js'];

  function cell(row, text, cls) {
    var td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    row.appendChild(td);
  }

  function showAssets() {
    var body = document.querySelector('#asset-table tbody');
    FILES.forEach(function (path) {
      fetch(path, { cache: 'no-store' }).then(function (res) {
        var row = document.createElement('tr');
        cell(row, path);
        cell(row, String(res.status), res.ok ? 'ok' : 'ng');
        cell(row, res.headers.get('Content-Type') || '-');
        cell(row, res.headers.get('X-Static-Asset-Sample') || '(無し)');
        body.appendChild(row);
      }).catch(function (error) {
        var row = document.createElement('tr');
        cell(row, path);
        cell(row, '失敗: ' + error.message, 'ng');
        cell(row, '-');
        cell(row, '-');
        body.appendChild(row);
      });
    });
  }

  function callWorker() {
    var button = document.getElementById('call-worker');
    var out = document.getElementById('worker-out');
    button.disabled = true;
    out.textContent = '呼んでいます…';
    fetch('/api/static-assets-sample', { cache: 'no-store' })
      .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
      .then(function (r) { out.textContent = 'HTTP ' + r.status + '\n' + JSON.stringify(r.data, null, 2); })
      .catch(function (error) { out.textContent = '失敗: ' + error.message; })
      .finally(function () { button.disabled = false; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    showAssets();
    document.getElementById('call-worker').addEventListener('click', callWorker);
  });
})();
