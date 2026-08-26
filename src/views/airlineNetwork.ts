import { AIRLINE_NETWORK, AIRLINE_NETWORK_CHECKED_AT } from '../data/airlineNetwork';
import { AIRPORT_LIST } from '../data/airports';

type DestAirportEntry = { code: string; name: string; flag: string };
type DestFlagEntry = { flag: string; country: string };
type CountryHubEntry = { key: string; country: string; flag: string; hubCode: string; hubName: string };

function getAirportFlag(code: string): string {
  const airport = AIRPORT_LIST.find((item) => item.code === code);
  return airport ? airport.city.split(' ')[0] : '🏳️';
}

function collectDestFlags(destinations: DestAirportEntry[]): DestFlagEntry[] {
  const seen: Record<string, boolean> = {};
  const flags: DestFlagEntry[] = [];
  for (const destination of destinations) {
    if (seen[destination.flag]) continue;
    seen[destination.flag] = true;
    const airport = AIRPORT_LIST.find((item) => item.code === destination.code);
    const country = airport ? airport.city.substring(airport.city.indexOf(' ') + 1).split('・')[0] : '不明';
    flags.push({ flag: destination.flag, country });
  }
  flags.sort((a, b) => a.country.localeCompare(b.country, 'ja'));
  return flags;
}

function collectCountryHubs(): CountryHubEntry[] {
  const seen: Record<string, boolean> = {};
  const list: CountryHubEntry[] = [];
  for (const c of AIRLINE_NETWORK) {
    for (const airline of c.airlines) {
      const key = c.country + '::' + airline.hubCode;
      if (seen[key]) continue;
      seen[key] = true;
      list.push({ key, country: c.country, flag: c.flag, hubCode: airline.hubCode, hubName: airline.hubName });
    }
  }
  return list;
}

function collectDestAirports(): DestAirportEntry[] {
  const seen: Record<string, boolean> = {};
  const list: DestAirportEntry[] = [];
  for (const c of AIRLINE_NETWORK) {
    for (const airline of c.airlines) {
      for (const dest of airline.destinations) {
        if (seen[dest.code]) continue;
        seen[dest.code] = true;
        const apt = AIRPORT_LIST.find((a) => a.code === dest.code);
        const flag = apt ? apt.city.split(' ')[0] : '';
        list.push({ code: dest.code, name: dest.name, flag });
      }
    }
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return list;
}

function buildCountryButtons(): string {
  let html = `<button type="button" class="country-btn active" data-country="__all__">🌐 すべて</button>`;
  for (const c of AIRLINE_NETWORK) {
    html += `<button type="button" class="country-btn" data-country="${c.country}">${c.flag} ${c.country}</button>`;
  }
  return html;
}

function buildRows(): string {
  let html = '';
  const routes: Array<{ country: string; flag: string; airline: typeof AIRLINE_NETWORK[number]['airlines'][number]; destination: typeof AIRLINE_NETWORK[number]['airlines'][number]['destinations'][number]; order: number }> = [];
  let order = 0;
  for (const c of AIRLINE_NETWORK) {
    for (const airline of c.airlines) {
      for (const dest of airline.destinations) {
        routes.push({ country: c.country, flag: c.flag, airline, destination: dest, order: order++ });
      }
    }
  }
  routes.sort((a, b) => b.destination.flightsPerWeek - a.destination.flightsPerWeek || a.order - b.order);
  for (const route of routes) {
    const { country, flag, airline, destination } = route;
    const destFlag = getAirportFlag(destination.code);
    const searchKey = [country, airline.name, airline.hubName, destination.name, destination.code].join(' ').toLowerCase();
    const hubKey = `${country}::${airline.hubCode}`;
    html += `<tr data-country="${country}" data-search="${searchKey}" data-dest-code="${destination.code}" data-dest-flag="${destFlag}" data-hub-key="${hubKey}">`;
    html += `<td class="col-country">${flag} ${country}</td>`;
    html += `<td class="col-airline">${airline.name}<span class="iata">${airline.iata}</span></td>`;
    html += `<td class="col-hub">${airline.hubName}<span class="code">${airline.hubCode}</span></td>`;
    html += `<td class="col-dest-flag">${destFlag}</td>`;
    html += `<td class="col-dest">${destination.name}<span class="code">${destination.code}</span></td>`;
    html += `<td class="col-freq">${destination.flightsPerWeek}<span class="unit">便/週</span></td>`;
    html += `</tr>`;
  }
  return html;
}

function buildDestFlagCheckRows(flags: DestFlagEntry[]): string {
  return flags.map((item) => `<label class="check-row"><input type="checkbox" class="dest-flag-check" value="${item.flag}" checked><span class="check-flag">${item.flag}</span><span class="check-name">${item.country}</span></label>`).join('');
}

function buildDestCheckRows(destinations: DestAirportEntry[]): string {
  let html = '';
  for (const d of destinations) {
    html += `<label class="check-row">`;
    html += `<input type="checkbox" class="dest-check" value="${d.code}" checked>`;
    html += `<span class="check-flag">${d.flag}</span>`;
    html += `<span class="check-name">${d.name}</span>`;
    html += `<span class="code">${d.code}</span>`;
    html += `</label>`;
  }
  return html;
}

function buildCountryHubCheckRows(countryHubs: CountryHubEntry[]): string {
  let html = '';
  for (const ch of countryHubs) {
    html += `<label class="check-row">`;
    html += `<input type="checkbox" class="country-hub-check" value="${ch.key}" checked>`;
    html += `<span class="check-flag">${ch.flag}</span>`;
    html += `<span class="check-name">${ch.country}<span class="hub-sub">${ch.hubName}<span class="code">${ch.hubCode}</span></span></span>`;
    html += `</label>`;
  }
  return html;
}

export function getAirlineNetworkPage(): string {
  const countryButtons = buildCountryButtons();
  const rows = buildRows();
  const destAirports = collectDestAirports();
  const destCheckRows = buildDestCheckRows(destAirports);
  const destCodesJson = JSON.stringify(destAirports.map((d) => d.code));
  const destFlags = collectDestFlags(destAirports);
  const destFlagCheckRows = buildDestFlagCheckRows(destFlags);
  const destFlagsJson = JSON.stringify(destFlags.map((item) => item.flag));
  const countryHubs = collectCountryHubs();
  const countryHubCheckRows = buildCountryHubCheckRows(countryHubs);
  const countryHubKeysJson = JSON.stringify(countryHubs.map((ch) => ch.key));
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
.freshness-note { margin-top: 6px; color: var(--text-muted); font-size: 0.7rem; }
.freshness-note time { color: var(--text); font-weight: 600; }

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
.col-dest-flag { width: 44px; text-align: center; font-size: 1.05rem; }
.unit { font-weight: 400; color: var(--text-muted); font-size: 0.68rem; margin-left: 3px; }
.no-hit { text-align: center; color: var(--text-muted); padding: 20px; font-size: 0.8rem; }

.th-filter-btn {
  background: none; border: none; color: inherit; cursor: pointer;
  font-size: 0.8rem; margin-left: 5px; padding: 0 3px; vertical-align: middle;
}
.th-filter-btn:hover { color: var(--accent); }

.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: none;
}
.modal-backdrop.open { display: block; }
.modal-box {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  width: min(360px, 90vw); max-height: 72vh; display: none; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.modal-box.open { display: flex; }
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; border-bottom: 1px solid var(--border);
  font-weight: 700; font-size: 0.85rem; color: var(--text); flex-shrink: 0;
}
.modal-close {
  background: none; border: none; color: var(--text-muted);
  font-size: 1.15rem; cursor: pointer; line-height: 1; padding: 2px 6px;
}
.modal-close:hover { color: var(--text); }
.modal-body { padding: 6px; overflow-y: auto; flex: 1; }
.check-row {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  border-radius: 6px; cursor: pointer; font-size: 0.8rem; color: var(--text);
}
.check-row:hover { background: var(--row-alt); }
.check-row input[type="checkbox"] { flex-shrink: 0; }
.check-flag { font-size: 1.05rem; flex-shrink: 0; }
.check-name { flex: 1; min-width: 0; }
.hub-sub { display: block; font-size: 0.68rem; color: var(--text-muted); margin-top: 1px; }
.modal-footer {
  padding: 10px 14px; border-top: 1px solid var(--border);
  display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0;
}
.modal-btn {
  border-radius: 6px; padding: 7px 16px; font-size: 0.8rem;
  cursor: pointer; font-family: inherit; border: 1px solid var(--border);
  background: var(--btn-bg); color: var(--text);
}
.modal-btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }

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
  <p class="freshness-note">運航情報確認日: <time datetime="${AIRLINE_NETWORK_CHECKED_AT}">${AIRLINE_NETWORK_CHECKED_AT}</time>（便数は季節で変動する目安です。予約前に航空会社の最新時刻表をご確認ください）</p>
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
            <th>国<button type="button" id="country-filter-btn" class="th-filter-btn" title="表示する経由国・拠点空港を選択">&#x25BE;</button></th>
            <th>航空会社</th>
            <th>拠点空港</th>
            <th class="col-dest-flag"><button type="button" id="dest-flag-filter-btn" class="th-filter-btn" title="乗り入れ空港を国旗で絞り込む" aria-label="乗り入れ空港を国旗で絞り込む">🏁</button></th>
            <th>乗り入れ空港<button type="button" id="dest-filter-btn" class="th-filter-btn" title="表示する乗り入れ空港を選択">&#x25BE;</button></th>
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

<div class="modal-backdrop" id="dest-filter-backdrop"></div>
<div class="modal-box" id="dest-filter-modal">
  <div class="modal-header">
    <span>&#x1F6EB; 乗り入れ空港を選択</span>
    <button type="button" id="dest-filter-close" class="modal-close">&times;</button>
  </div>
  <div class="modal-body" id="dest-filter-list">
    ${destCheckRows}
  </div>
  <div class="modal-footer">
    <button type="button" id="dest-filter-cancel" class="modal-btn">キャンセル</button>
    <button type="button" id="dest-filter-apply" class="modal-btn modal-btn-primary">適用</button>
  </div>
</div>

<div class="modal-backdrop" id="dest-flag-filter-backdrop"></div>
<div class="modal-box" id="dest-flag-filter-modal">
  <div class="modal-header">
    <span>🏁 乗り入れ国を選択</span>
    <button type="button" id="dest-flag-filter-close" class="modal-close">&times;</button>
  </div>
  <div class="modal-body" id="dest-flag-filter-list">${destFlagCheckRows}</div>
  <div class="modal-footer">
    <button type="button" id="dest-flag-filter-cancel" class="modal-btn">キャンセル</button>
    <button type="button" id="dest-flag-filter-apply" class="modal-btn modal-btn-primary">適用</button>
  </div>
</div>

<div class="modal-backdrop" id="country-filter-backdrop"></div>
<div class="modal-box" id="country-filter-modal">
  <div class="modal-header">
    <span>&#x1F3F3;&#xFE0F; 経由国・拠点空港を選択</span>
    <button type="button" id="country-filter-close" class="modal-close">&times;</button>
  </div>
  <div class="modal-body" id="country-filter-list">
    ${countryHubCheckRows}
  </div>
  <div class="modal-footer">
    <button type="button" id="country-filter-cancel" class="modal-btn">キャンセル</button>
    <button type="button" id="country-filter-apply" class="modal-btn modal-btn-primary">適用</button>
  </div>
</div>

<script>
var DEST_COOKIE_NAME = 'airline_network_dest_airports';
var ALL_DEST_CODES = ${destCodesJson};
var DEST_FLAG_COOKIE_NAME = 'airline_network_dest_flags';
var ALL_DEST_FLAGS = ${destFlagsJson};
var COUNTRY_HUB_COOKIE_NAME = 'airline_network_country_hubs';
var ALL_COUNTRY_HUB_KEYS = ${countryHubKeysJson};

var currentCountry = '__all__';
var countryBtns = document.querySelectorAll('.country-btn');
var allRows = Array.prototype.slice.call(document.querySelectorAll('#route-tbody tr'));
var searchBox = document.getElementById('search-box');
var hitCountEl = document.getElementById('hit-count');
var noHitEl = document.getElementById('no-hit');
var destFilterBtn = document.getElementById('dest-filter-btn');
var destFilterModal = document.getElementById('dest-filter-modal');
var destFilterBackdrop = document.getElementById('dest-filter-backdrop');
var destFilterClose = document.getElementById('dest-filter-close');
var destFilterCancel = document.getElementById('dest-filter-cancel');
var destFilterApply = document.getElementById('dest-filter-apply');
var destCheckboxes = Array.prototype.slice.call(document.querySelectorAll('.dest-check'));
var destFlagFilterBtn = document.getElementById('dest-flag-filter-btn');
var destFlagFilterModal = document.getElementById('dest-flag-filter-modal');
var destFlagFilterBackdrop = document.getElementById('dest-flag-filter-backdrop');
var destFlagFilterClose = document.getElementById('dest-flag-filter-close');
var destFlagFilterCancel = document.getElementById('dest-flag-filter-cancel');
var destFlagFilterApply = document.getElementById('dest-flag-filter-apply');
var destFlagCheckboxes = Array.prototype.slice.call(document.querySelectorAll('.dest-flag-check'));
var countryFilterBtn = document.getElementById('country-filter-btn');
var countryFilterModal = document.getElementById('country-filter-modal');
var countryFilterBackdrop = document.getElementById('country-filter-backdrop');
var countryFilterClose = document.getElementById('country-filter-close');
var countryFilterCancel = document.getElementById('country-filter-cancel');
var countryFilterApply = document.getElementById('country-filter-apply');
var countryHubCheckboxes = Array.prototype.slice.call(document.querySelectorAll('.country-hub-check'));

function getCookieValue(name) {
  var parts = document.cookie.split(';');
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].trim();
    if (p.indexOf(name + '=') === 0) {
      return decodeURIComponent(p.substring(name.length + 1));
    }
  }
  return null;
}

function setCookieValue(name, value) {
  document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
}

function loadSelectedDestCodes() {
  var saved = getCookieValue(DEST_COOKIE_NAME);
  if (saved === null || saved === '') return ALL_DEST_CODES.slice();
  return saved.split(',').filter(function (code) { return ALL_DEST_CODES.indexOf(code) !== -1; });
}

function loadSelectedCountryHubs() {
  var saved = getCookieValue(COUNTRY_HUB_COOKIE_NAME);
  if (saved === null || saved === '') return ALL_COUNTRY_HUB_KEYS.slice();
  return saved.split(',').filter(function (key) { return ALL_COUNTRY_HUB_KEYS.indexOf(key) !== -1; });
}

function loadSelectedDestFlags() {
  var saved = getCookieValue(DEST_FLAG_COOKIE_NAME);
  if (saved === null || saved === '') return ALL_DEST_FLAGS.slice();
  return saved.split(',').filter(function (flag) { return ALL_DEST_FLAGS.indexOf(flag) !== -1; });
}

var selectedDestCodes = loadSelectedDestCodes();
var selectedCountryHubs = loadSelectedCountryHubs();
var selectedDestFlags = loadSelectedDestFlags();

function getNextZ() {
  var max = 100;
  document.querySelectorAll('body *').forEach(function (el) {
    var z = parseInt(window.getComputedStyle(el).zIndex, 10);
    if (!isNaN(z)) max = Math.max(max, z);
  });
  return max + 100;
}

function updateDestFilterBtnLabel() {
  if (selectedDestCodes.length === ALL_DEST_CODES.length) {
    destFilterBtn.textContent = '▾';
  } else {
    destFilterBtn.textContent = '▾(' + selectedDestCodes.length + '/' + ALL_DEST_CODES.length + ')';
  }
}

function updateCountryFilterBtnLabel() {
  if (selectedCountryHubs.length === ALL_COUNTRY_HUB_KEYS.length) {
    countryFilterBtn.textContent = '▾';
  } else {
    countryFilterBtn.textContent = '▾(' + selectedCountryHubs.length + '/' + ALL_COUNTRY_HUB_KEYS.length + ')';
  }
}

function updateDestFlagFilterBtnLabel() {
  destFlagFilterBtn.textContent = selectedDestFlags.length === ALL_DEST_FLAGS.length
    ? '🏁'
    : '🏁(' + selectedDestFlags.length + '/' + ALL_DEST_FLAGS.length + ')';
}

function updateCountryPanelVisibility() {
  var visibleCountries = {};
  selectedCountryHubs.forEach(function (key) {
    var country = key.split('::')[0];
    visibleCountries[country] = true;
  });
  countryBtns.forEach(function (btn) {
    var country = btn.getAttribute('data-country');
    if (country === '__all__') return;
    btn.style.display = visibleCountries[country] ? '' : 'none';
  });
  var activeBtn = null;
  countryBtns.forEach(function (btn) {
    if (btn.getAttribute('data-country') === currentCountry) activeBtn = btn;
  });
  if (currentCountry !== '__all__' && (!activeBtn || activeBtn.style.display === 'none')) {
    currentCountry = '__all__';
    countryBtns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-country') === '__all__');
    });
  }
}

function applyFilter() {
  var q = searchBox.value.trim().toLowerCase();
  var visibleCount = 0;
  allRows.forEach(function (row) {
    var matchesCountry = (currentCountry === '__all__') || (row.getAttribute('data-country') === currentCountry);
    var matchesSearch = !q || row.getAttribute('data-search').indexOf(q) !== -1;
    var matchesDest = selectedDestCodes.indexOf(row.getAttribute('data-dest-code')) !== -1;
    var matchesDestFlag = selectedDestFlags.indexOf(row.getAttribute('data-dest-flag')) !== -1;
    var matchesCountryHub = selectedCountryHubs.indexOf(row.getAttribute('data-hub-key')) !== -1;
    var show = matchesCountry && matchesSearch && matchesDest && matchesDestFlag && matchesCountryHub;
    row.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });
  hitCountEl.textContent = visibleCount + ' 件表示中';
  noHitEl.style.display = visibleCount === 0 ? '' : 'none';
  updateDestFilterBtnLabel();
  updateCountryFilterBtnLabel();
  updateDestFlagFilterBtnLabel();
}

countryBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    countryBtns.forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentCountry = btn.getAttribute('data-country');
    applyFilter();
  });
});

updateCountryPanelVisibility();

function openDestFilterModal() {
  closeCountryFilterModal();
  closeDestFlagFilterModal();
  destCheckboxes.forEach(function (cb) {
    cb.checked = selectedDestCodes.indexOf(cb.value) !== -1;
  });
  var z = getNextZ();
  destFilterBackdrop.style.zIndex = String(z);
  destFilterModal.style.zIndex = String(z + 1);
  destFilterBackdrop.classList.add('open');
  destFilterModal.classList.add('open');
}

function closeDestFilterModal() {
  destFilterBackdrop.classList.remove('open');
  destFilterModal.classList.remove('open');
}

destFilterBtn.addEventListener('click', openDestFilterModal);
destFilterClose.addEventListener('click', closeDestFilterModal);
destFilterCancel.addEventListener('click', closeDestFilterModal);
destFilterBackdrop.addEventListener('click', closeDestFilterModal);

destFilterApply.addEventListener('click', function () {
  selectedDestCodes = destCheckboxes.filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.value; });
  setCookieValue(DEST_COOKIE_NAME, selectedDestCodes.join(','));
  closeDestFilterModal();
  applyFilter();
});

function openDestFlagFilterModal() {
  closeDestFilterModal();
  closeCountryFilterModal();
  destFlagCheckboxes.forEach(function (cb) {
    cb.checked = selectedDestFlags.indexOf(cb.value) !== -1;
  });
  var z = getNextZ();
  destFlagFilterBackdrop.style.zIndex = String(z);
  destFlagFilterModal.style.zIndex = String(z + 1);
  destFlagFilterBackdrop.classList.add('open');
  destFlagFilterModal.classList.add('open');
}

function closeDestFlagFilterModal() {
  destFlagFilterBackdrop.classList.remove('open');
  destFlagFilterModal.classList.remove('open');
}

destFlagFilterBtn.addEventListener('click', openDestFlagFilterModal);
destFlagFilterClose.addEventListener('click', closeDestFlagFilterModal);
destFlagFilterCancel.addEventListener('click', closeDestFlagFilterModal);
destFlagFilterBackdrop.addEventListener('click', closeDestFlagFilterModal);
destFlagFilterApply.addEventListener('click', function () {
  selectedDestFlags = destFlagCheckboxes.filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.value; });
  setCookieValue(DEST_FLAG_COOKIE_NAME, selectedDestFlags.join(','));
  closeDestFlagFilterModal();
  applyFilter();
});

function openCountryFilterModal() {
  closeDestFilterModal();
  closeDestFlagFilterModal();
  countryHubCheckboxes.forEach(function (cb) {
    cb.checked = selectedCountryHubs.indexOf(cb.value) !== -1;
  });
  var z = getNextZ();
  countryFilterBackdrop.style.zIndex = String(z);
  countryFilterModal.style.zIndex = String(z + 1);
  countryFilterBackdrop.classList.add('open');
  countryFilterModal.classList.add('open');
}

function closeCountryFilterModal() {
  countryFilterBackdrop.classList.remove('open');
  countryFilterModal.classList.remove('open');
}

countryFilterBtn.addEventListener('click', openCountryFilterModal);
countryFilterClose.addEventListener('click', closeCountryFilterModal);
countryFilterCancel.addEventListener('click', closeCountryFilterModal);
countryFilterBackdrop.addEventListener('click', closeCountryFilterModal);

countryFilterApply.addEventListener('click', function () {
  selectedCountryHubs = countryHubCheckboxes.filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.value; });
  setCookieValue(COUNTRY_HUB_COOKIE_NAME, selectedCountryHubs.join(','));
  closeCountryFilterModal();
  updateCountryPanelVisibility();
  applyFilter();
});

searchBox.addEventListener('input', applyFilter);
applyFilter();
</script>
</body>
</html>`;
}
