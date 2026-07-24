import { AIRLINE_NETWORK } from '../data/airlineNetwork';

function buildCountryButtons(): string {
  let html = `<button type="button" class="country-btn active" data-country="__all__">🌐 すべて</button>`;
  for (const c of AIRLINE_NETWORK) {
    html += `<button type="button" class="country-btn" data-country="${c.country}">${c.flag} ${c.country}</button>`;
  }
  return html;
}

function buildRows(): string {
  let html = '';
  for (const c of AIRLINE_NETWORK) {
    for (const airline of c.airlines) {
      for (const dest of airline.destinations) {
        const searchKey = [c.country, airline.name, airline.hubName, dest.name, dest.code].join(' ').toLowerCase();
        html += `<tr data-country="${c.country}" data-search="${searchKey}">`;
        html += `<td class="col-country">${c.flag} ${c.country}</td>`;
        html += `<td class="col-airline">${airline.name}<span class="iata">${airline.iata}</span></td>`;
        html += `<td class="col-hub">${airline.hubName}<span class="code">${airline.hubCode}</span></td>`;
        html += `<td class="col-dest">${dest.name}<span class="code">${dest.code}</span></td>`;
        html += `<td class="col-freq">${dest.flightsPerWeek}<span class="unit">便/週</span></td>`;
        html += `</tr>`;
      }
    }
  }
  return html;
}

export function getAirlineNetworkPage(): string {
  const countryButtons = buildCountryButtons();
  const rows = buildRows();
  const countryCount = AIRLINE_NETWORK.length;
  const airlineCount = AIRLINE_NETWORK.reduce((sum, c) => sum + c.airlines.length, 0);
  const routeCount = AIRLINE_NETWORK.reduce((sum, c) => sum + c.airlines.reduce((s2, a) => s2 + a.destinations.length, 0), 0);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>各国航空会社ネットワーク一覧</title>
<style>
:root {
  color-scheme: light dark;
  --bg: light-dark(#f0f2f5, #0d1117);
  --surface: light-dark(#ffffff, #161b22);
  --text: light-dark(#212529, #e6edf3);
  --text-muted: light-dark(#6c757d, #8b949e);
  --border: light-dark(#dee2e6, #30363d);
  --header-bg: light-dark(#2c3e50, #161b22);
  --header-text: #e6edf3;
  --row-alt: light-dark(#f9fbfc, #1c2128);
  --accent: light-dark(#2a6fd8, #58a6ff);
  --code-bg: light-dark(#eef2f7, #21262d);
  --code-text: light-dark(#495057, #8b949e);
  --btn-bg: light-dark(#ffffff, #21262d);
  --btn-active-bg: light-dark(#2a6fd8, #1f6feb);
  --btn-active-text: #ffffff;
  --input-bg: light-dark(#ffffff, #0d1117);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, 'Hiragino Sans', sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
.page-header { padding: 12px 16px 10px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
h1 { font-size: 1.15rem; margin-bottom: 3px; }
.subtitle { color: var(--text-muted); font-size: 0.75rem; }
.summary-bar { display: flex; gap: 14px; margin-top: 6px; font-size: 0.72rem; color: var(--text-muted); flex-wrap: wrap; }
.summary-bar b { color: var(--accent); }

.main-layout { display: flex; flex: 1; min-height: 0; overflow: hidden; }

.left-panel {
  width: 190px; flex-shrink: 0; overflow-y: auto;
  border-right: 1px solid var(--border);
  padding: 10px 8px;
  background: var(--surface);
  display: flex; flex-direction: column; gap: 4px;
}
.country-btn {
  display: block; width: 100%; text-align: left;
  background: var(--btn-bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 6px 9px; font-size: 0.78rem; cursor: pointer;
  font-family: inherit;
}
.country-btn:hover { border-color: var(--accent); }
.country-btn.active { background: var(--btn-active-bg); color: var(--btn-active-text); border-color: var(--btn-active-bg); }

.right-main { flex: 1; overflow-y: auto; padding: 10px 14px; min-width: 0; }
.search-row { margin-bottom: 10px; display: flex; gap: 8px; align-items: center; }
.search-row input {
  flex: 1; max-width: 320px; padding: 6px 10px; font-size: 0.8rem;
  background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px;
}
.search-row .hit-count { font-size: 0.72rem; color: var(--text-muted); }

.table-wrap { overflow-x: auto; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
table { border-collapse: collapse; font-size: 0.78rem; background: var(--surface); width: 100%; }
th { padding: 7px 9px; text-align: left; border: 1px solid var(--border); white-space: nowrap; font-weight: 600; background: var(--header-bg); color: var(--header-text); }
td { padding: 6px 9px; border: 1px solid var(--border); vertical-align: middle; color: var(--text); }
tr:nth-child(even) td { background: var(--row-alt); }
.iata, .code { display: inline-block; margin-left: 6px; font-size: 0.68rem; color: var(--code-text); background: var(--code-bg); border-radius: 4px; padding: 1px 5px; }
.col-freq { font-weight: 700; color: var(--accent); }
.unit { font-weight: 400; color: var(--text-muted); font-size: 0.68rem; margin-left: 3px; }
.no-hit { text-align: center; color: var(--text-muted); padding: 20px; font-size: 0.8rem; }

@media (max-width: 640px) {
  .main-layout { flex-direction: column; overflow: visible; }
  .left-panel { width: 100%; border-right: none; border-bottom: 1px solid var(--border); flex-direction: row; flex-wrap: wrap; overflow-y: visible; }
  .country-btn { width: auto; }
  .right-main { overflow-y: visible; }
  .table-wrap { overflow-x: auto; }
}
</style>
</head>
<body>
<div class="page-header">
  <h1>&#x2708;&#xFE0F; 各国航空会社ネットワーク一覧</h1>
  <p class="subtitle">国別の主要航空会社・拠点空港・乗り入れ空港・おおまかな便数(週あたり目安)</p>
  <div class="summary-bar">
    <span>対象国: <b>${countryCount}</b></span>
    <span>航空会社: <b>${airlineCount}</b></span>
    <span>路線数: <b>${routeCount}</b></span>
  </div>
</div>

<div class="main-layout">
  <div class="left-panel" id="country-panel">
    ${countryButtons}
  </div>

  <div class="right-main">
    <div class="search-row">
      <input type="text" id="search-box" placeholder="航空会社名・空港名・IATAコードで検索">
      <span class="hit-count" id="hit-count"></span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>国</th>
            <th>航空会社</th>
            <th>拠点空港</th>
            <th>乗り入れ空港</th>
            <th>便数(週)</th>
          </tr>
        </thead>
        <tbody id="route-tbody">
          ${rows}
        </tbody>
      </table>
    </div>
    <div class="no-hit" id="no-hit" style="display:none;">該当する路線が見つかりません</div>
  </div>
</div>

<script>
var currentCountry = '__all__';
var countryBtns = document.querySelectorAll('.country-btn');
var allRows = Array.prototype.slice.call(document.querySelectorAll('#route-tbody tr'));
var searchBox = document.getElementById('search-box');
var hitCountEl = document.getElementById('hit-count');
var noHitEl = document.getElementById('no-hit');

function applyFilter() {
  var q = searchBox.value.trim().toLowerCase();
  var visibleCount = 0;
  allRows.forEach(function (row) {
    var matchesCountry = (currentCountry === '__all__') || (row.getAttribute('data-country') === currentCountry);
    var matchesSearch = !q || row.getAttribute('data-search').indexOf(q) !== -1;
    var show = matchesCountry && matchesSearch;
    row.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });
  hitCountEl.textContent = visibleCount + ' 件表示中';
  noHitEl.style.display = visibleCount === 0 ? '' : 'none';
}

countryBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    countryBtns.forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentCountry = btn.getAttribute('data-country');
    applyFilter();
  });
});

searchBox.addEventListener('input', applyFilter);
applyFilter();
</script>
</body>
</html>`;
}
