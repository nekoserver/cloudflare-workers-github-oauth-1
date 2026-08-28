import { AIRLINE_NETWORK, AIRLINE_NETWORK_CHECKED_AT } from '../data/airlineNetwork';
import { AIRPORT_LIST } from '../data/airports';

type DestAirportEntry = { code: string; name: string; flag: string };
type DestFlagEntry = { flag: string; country: string };
type CountryHubEntry = { key: string; country: string; flag: string; hubCode: string; hubName: string };

function getAirportFlag(code: string): string {
  const airport = AIRPORT_LIST.find((item) => item.code === code);
  return airport ? airport.city.split(' ')[0] : '🏳️';
}

function getAirportCountry(code: string): string {
  const airport = AIRPORT_LIST.find((item) => item.code === code);
  if (!airport) return '';
  return airport.city.substring(airport.city.indexOf(' ') + 1).split('・')[0];
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  for (const [index, c] of AIRLINE_NETWORK.entries()) {
    html += `<button type="button" class="country-btn" data-country="${c.country}" data-country-order="${index}">${c.flag} ${c.country}</button>`;
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
    const hubFlag = getAirportFlag(airline.hubCode);
    const destFlag = getAirportFlag(destination.code);
    const searchKey = [country, airline.name, airline.hubName, destination.name, destination.code].join(' ').toLowerCase();
    const hubKey = `${country}::${airline.hubCode}`;
    const routeType = getAirportCountry(airline.hubCode) === getAirportCountry(destination.code) ? 'domestic' : 'international';
    html += `<tr data-country="${country}" data-search="${searchKey}" data-airline="${escapeHtmlAttribute(airline.name)}" data-airline-iata="${escapeHtmlAttribute(airline.iata)}" data-hub-code="${airline.hubCode}" data-hub-flag="${hubFlag}" data-dest-code="${destination.code}" data-dest-flag="${destFlag}" data-route-type="${routeType}" data-flights="${destination.flightsPerWeek}" data-hub-key="${hubKey}">`;
    html += `<td class="col-country">${flag} ${country}</td>`;
    html += `<td class="col-airline">${airline.name}<span class="iata">${airline.iata}</span></td>`;
    html += `<td class="col-hub"><span class="airport-name">${airline.hubName}</span><span class="code">${airline.hubCode}</span></td>`;
    html += `<td class="col-dest"><span class="airport-name">${destination.name}</span><span class="code">${destination.code}</span></td>`;
    html += `<td class="col-dest-flag">${destFlag}</td>`;
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
  for (const [index, ch] of countryHubs.entries()) {
    html += `<label class="check-row" data-country="${ch.country}" data-hub-order="${index}">`;
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

.main-layout { display: flex; flex: 1; min-height: 0; align-items: flex-start; }

.left-panel {
  width: 190px; flex-shrink: 0; overflow-y: auto;
  position: sticky; top: 0; max-height: 100vh;
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
.airport-name-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.airport-name-toggle button { border: 0; border-right: 1px solid var(--border); background: var(--btn-bg); color: var(--text); cursor: pointer; font: inherit; font-size: 0.72rem; padding: 5px 8px; }
.airport-name-toggle button:last-child { border-right: 0; }
.airport-name-toggle button.active { background: var(--btn-active-bg); color: var(--btn-active-text); }

.network-canvas-panel { margin-bottom: 10px; padding: 10px 12px 12px; overflow: hidden; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
.network-canvas-heading { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.network-canvas-heading h2 { font-size: 0.86rem; }
.network-route-controls { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.network-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.network-toggle button { border: 0; border-right: 1px solid var(--border); background: var(--btn-bg); color: var(--text); cursor: pointer; font: inherit; font-size: 0.7rem; padding: 5px 8px; }
.network-toggle button:last-child { border-right: 0; }
.network-toggle button.active { background: var(--btn-active-bg); color: var(--btn-active-text); }
.network-canvas-wrap { width: 100%; min-width: 560px; }
#route-network-canvas { display: block; width: 100%; height: 276px; border-radius: 8px; background: light-dark(#f7faff, #0d141d); }
.network-canvas-scroll { overflow-x: auto; }

.table-wrap { overflow-x: auto; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
table { border-collapse: collapse; font-size: 0.78rem; background: var(--surface); width: 100%; }
th { padding: 7px 9px; text-align: left; border: 1px solid var(--border); white-space: nowrap; font-weight: 600; background: var(--header-bg); color: var(--header-text); }
td { padding: 6px 9px; border: 1px solid var(--border); vertical-align: middle; color: var(--text); }
tr:nth-child(even) td { background: var(--row-alt); }
.iata, .code { display: inline-block; margin-left: 6px; font-size: 0.68rem; color: var(--code-text); background: var(--code-bg); border-radius: 4px; padding: 1px 5px; }
.compact-airports .airport-name { display: none; }
.compact-airports .col-hub .code, .compact-airports .col-dest .code { margin-left: 0; }
.compact-only { display: none; }
.compact-airports .normal-only { display: none; }
.compact-airports .compact-only { display: inline; }
.compact-dest-heading { line-height: 1.25; white-space: nowrap; }
.compact-dest-heading .th-filter-btn { display: block; margin: 0 auto 2px; }
.country-column-flash th:first-child,
.country-column-flash td.col-country {
  animation: country-column-outline 0.4s ease-in-out 3;
}
.country-column-flash th:first-child,
.country-column-flash tbody tr:not([style*="display: none"]):first-child td.col-country { border-top-color: #f2d96b; }
.country-column-flash th:first-child,
.country-column-flash td.col-country { border-left-color: #f2d96b; border-right-color: #f2d96b; }
.country-column-flash tbody tr:not([style*="display: none"]):last-child td.col-country { border-bottom-color: #f2d96b; }
@keyframes country-column-outline {
  0%, 100% { border-color: var(--border); box-shadow: none; }
  50% { border-color: #f2d96b; box-shadow: inset 0 0 0 1px #fff3a3; }
}
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
  .left-panel { width: 100%; border-right: none; border-bottom: 1px solid var(--border); flex-direction: row; flex-wrap: wrap; overflow-y: visible; position: static; max-height: none; }
  .country-btn { width: auto; }
  .right-main { overflow-y: visible; }
  .network-canvas-heading { align-items: flex-start; flex-direction: column; gap: 3px; }
  .network-route-controls { justify-content: flex-start; }
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
      <div class="airport-name-toggle" role="group" aria-label="空港名の表示形式">
        <button type="button" id="airport-name-normal-btn" class="active" aria-pressed="true">通常</button>
        <button type="button" id="airport-name-compact-btn" aria-pressed="false">簡易</button>
      </div>
    </div>
    <section class="network-canvas-panel" aria-labelledby="network-canvas-title">
      <div class="network-canvas-heading">
        <h2 id="network-canvas-title">乗り入れ便航空会社 → 空港コード経路</h2>
        <div class="network-route-controls">
          <div class="network-toggle" role="group" aria-label="路線種別">
            <button type="button" class="route-type-btn active" data-route-type="both" aria-pressed="true">両方(デフォルト値)</button>
            <button type="button" class="route-type-btn" data-route-type="international" aria-pressed="false">国際線</button>
            <button type="button" class="route-type-btn" data-route-type="domestic" aria-pressed="false">国内線</button>
          </div>
          <div class="network-toggle" role="group" aria-label="表示路線数">
            <button type="button" class="route-limit-btn active" data-route-limit="6" aria-pressed="true">6(デフォルト値)</button>
            <button type="button" class="route-limit-btn" data-route-limit="10" aria-pressed="false">10</button>
            <button type="button" class="route-limit-btn" data-route-limit="all" aria-pressed="false">すべて</button>
          </div>
        </div>
      </div>
      <div class="network-canvas-scroll">
        <div class="network-canvas-wrap">
          <canvas id="route-network-canvas" height="276" role="img" aria-label="航空会社から出発空港コード、到着空港コードへつながる路線図"></canvas>
        </div>
      </div>
    </section>
    <div class="table-wrap">
      <table id="route-table">
        <thead>
          <tr>
            <th>国<button type="button" id="country-filter-btn" class="th-filter-btn" title="表示する経由国・拠点空港を選択">&#x25BE;</button></th>
            <th>航空会社</th>
            <th><span class="normal-only">拠点空港</span><span class="compact-only">発空港</span></th>
            <th class="col-dest"><span class="normal-only">乗り入れ空港<button type="button" id="dest-filter-btn" class="th-filter-btn" title="表示する乗り入れ空港を選択">&#x25BE;</button></span><span class="compact-only compact-dest-heading"><button type="button" id="dest-filter-btn-compact" class="th-filter-btn" title="表示する着空港を選択">&#x25EF;/&#x25B3;</button><br>着空港</span></th>
            <th class="col-dest-flag"><span class="normal-only"><button type="button" id="dest-flag-filter-btn" class="th-filter-btn" title="乗り入れ空港を国旗で絞り込む" aria-label="乗り入れ空港を国旗で絞り込む">🏁</button></span><span class="compact-only compact-dest-heading"><button type="button" id="dest-flag-filter-btn-compact" class="th-filter-btn" title="乗り入れ空港を国旗で絞り込む" aria-label="乗り入れ空港を国旗で絞り込む">&#x25EF;/&#x25B3;</button><br>🏁</span></th>
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
var COUNTRY_HUB_STORAGE_NAME = 'airline_network_country_hubs_v2';
var ALL_COUNTRY_HUB_KEYS = ${countryHubKeysJson};
var DISPLAY_MODE_COOKIE_NAME = 'airline_network_display_mode';

var currentCountry = '__all__';
var countryBtns = document.querySelectorAll('.country-btn');
var allRows = Array.prototype.slice.call(document.querySelectorAll('#route-tbody tr'));
var searchBox = document.getElementById('search-box');
var hitCountEl = document.getElementById('hit-count');
var noHitEl = document.getElementById('no-hit');
var airportNameNormalBtn = document.getElementById('airport-name-normal-btn');
var airportNameCompactBtn = document.getElementById('airport-name-compact-btn');
var routeTable = document.getElementById('route-table');
var routeNetworkCanvas = document.getElementById('route-network-canvas');
var routeTypeBtns = Array.prototype.slice.call(document.querySelectorAll('.route-type-btn'));
var routeLimitBtns = Array.prototype.slice.call(document.querySelectorAll('.route-limit-btn'));
var networkRouteType = 'both';
var networkRouteLimit = 6;
var destFilterBtn = document.getElementById('dest-filter-btn');
var destFilterCompactBtn = document.getElementById('dest-filter-btn-compact');
var destFilterModal = document.getElementById('dest-filter-modal');
var destFilterBackdrop = document.getElementById('dest-filter-backdrop');
var destFilterClose = document.getElementById('dest-filter-close');
var destFilterCancel = document.getElementById('dest-filter-cancel');
var destFilterApply = document.getElementById('dest-filter-apply');
var destCheckboxes = Array.prototype.slice.call(document.querySelectorAll('.dest-check'));
var destFlagFilterBtn = document.getElementById('dest-flag-filter-btn');
var destFlagFilterCompactBtn = document.getElementById('dest-flag-filter-btn-compact');
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

function setAirportNameDisplay(compact) {
  document.body.classList.toggle('compact-airports', compact);
  airportNameNormalBtn.classList.toggle('active', !compact);
  airportNameNormalBtn.setAttribute('aria-pressed', String(!compact));
  airportNameCompactBtn.classList.toggle('active', compact);
  airportNameCompactBtn.setAttribute('aria-pressed', String(compact));
  setCookieValue(DISPLAY_MODE_COOKIE_NAME, compact ? 'compact' : 'normal');
}

function flashCountryColumn() {
  routeTable.classList.remove('country-column-flash');
  void routeTable.offsetWidth;
  routeTable.classList.add('country-column-flash');
}

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
  var stored = null;
  try { stored = window.localStorage.getItem(COUNTRY_HUB_STORAGE_NAME); } catch (e) { /* Cookie fallback. */ }
  if (stored !== null) {
    try {
      var parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed.filter(function (key) { return ALL_COUNTRY_HUB_KEYS.indexOf(key) !== -1; });
    } catch (e) { /* Ignore malformed storage and use the legacy cookie. */ }
  }
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

function saveSelectedCountryHubs() {
  try { window.localStorage.setItem(COUNTRY_HUB_STORAGE_NAME, JSON.stringify(selectedCountryHubs)); } catch (e) { /* Cookie remains as fallback. */ }
  setCookieValue(COUNTRY_HUB_COOKIE_NAME, selectedCountryHubs.join(','));
}

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
    destFilterCompactBtn.textContent = '◯/△';
  } else {
    destFilterBtn.textContent = '▾(' + selectedDestCodes.length + '/' + ALL_DEST_CODES.length + ')';
    destFilterCompactBtn.textContent = selectedDestCodes.length + '/' + ALL_DEST_CODES.length;
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
  if (selectedDestFlags.length === ALL_DEST_FLAGS.length) {
    destFlagFilterBtn.textContent = '🏁';
    destFlagFilterCompactBtn.textContent = '◯/△';
  } else {
    destFlagFilterBtn.textContent = '🏁(' + selectedDestFlags.length + '/' + ALL_DEST_FLAGS.length + ')';
    destFlagFilterCompactBtn.textContent = selectedDestFlags.length + '/' + ALL_DEST_FLAGS.length;
  }
}

function updateCountryPanelVisibility() {
  var enabledCounts = {};
  selectedCountryHubs.forEach(function (key) {
    var country = key.split('::')[0];
    enabledCounts[country] = (enabledCounts[country] || 0) + 1;
  });
  countryBtns.forEach(function (btn) {
    var country = btn.getAttribute('data-country');
    if (country === '__all__') return;
    btn.style.display = enabledCounts[country] ? '' : 'none';
  });
  var countryPanel = document.getElementById('country-panel');
  Array.prototype.slice.call(countryBtns).filter(function (btn) {
    return btn.getAttribute('data-country') !== '__all__';
  }).sort(function (a, b) {
    return (enabledCounts[b.getAttribute('data-country')] || 0) - (enabledCounts[a.getAttribute('data-country')] || 0)
      || Number(a.getAttribute('data-country-order')) - Number(b.getAttribute('data-country-order'));
  }).forEach(function (btn) { countryPanel.appendChild(btn); });

  var countryFilterList = document.getElementById('country-filter-list');
  Array.prototype.slice.call(countryFilterList.querySelectorAll('.check-row')).sort(function (a, b) {
    return (enabledCounts[b.getAttribute('data-country')] || 0) - (enabledCounts[a.getAttribute('data-country')] || 0)
      || Number(a.getAttribute('data-hub-order')) - Number(b.getAttribute('data-hub-order'));
  }).forEach(function (row) { countryFilterList.appendChild(row); });
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
  drawRouteNetwork();
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawCenteredAirportCode(ctx, flag, code, centerX, y) {
  var label = flag + ' ' + code;
  var labelWidth = ctx.measureText(label).width;
  ctx.textAlign = 'left';
  ctx.fillText(label, centerX - labelWidth / 2, y);
}

function drawRouteNetwork() {
  if (!routeNetworkCanvas || typeof window.CanvasRenderingContext2D === 'undefined') return;
  var ctx = routeNetworkCanvas.getContext('2d');
  if (!ctx) return;
  var visibleRows = allRows.filter(function (row) {
    return row.style.display !== 'none' && (networkRouteType === 'both' || row.getAttribute('data-route-type') === networkRouteType);
  });
  if (networkRouteLimit !== 'all') visibleRows = visibleRows.slice(0, networkRouteLimit);
  var cssWidth = Math.max(560, routeNetworkCanvas.parentElement.clientWidth || 900);
  var cssHeight = Math.max(276, 31 + visibleRows.length * 40);
  var ratio = window.devicePixelRatio || 1;
  routeNetworkCanvas.width = Math.round(cssWidth * ratio);
  routeNetworkCanvas.height = Math.round(cssHeight * ratio);
  routeNetworkCanvas.style.width = cssWidth + 'px';
  routeNetworkCanvas.style.height = cssHeight + 'px';
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var colors = dark
    ? { text: '#e6edf3', muted: '#8b949e', airline: '#172d46', airport: '#14261f', line: '#58a6ff', border: '#3b82c4' }
    : { text: '#1f2937', muted: '#64748b', airline: '#e8f2ff', airport: '#e9f8f0', line: '#2a6fd8', border: '#7fb0e8' };
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  if (!visibleRows.length) {
    ctx.fillStyle = colors.muted; ctx.font = '13px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('表示できる経路がありません', cssWidth / 2, cssHeight / 2);
    return;
  }
  ctx.font = '600 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = colors.muted;
  ctx.fillText('乗り入れ便航空会社', 105, 17);
  ctx.fillText('経路情報', cssWidth * 0.65, 17);
  var airlineWidth = Math.min(180, Math.max(140, cssWidth * 0.22));
  var originX = Math.max(250, cssWidth * 0.43);
  var destinationX = Math.max(originX + 155, cssWidth * 0.82);
  visibleRows.forEach(function (row, index) {
    var y = 31 + index * 40;
    var airline = row.getAttribute('data-airline');
    var iata = row.getAttribute('data-airline-iata');
    var hub = row.getAttribute('data-hub-code');
    var hubFlag = row.getAttribute('data-hub-flag');
    var dest = row.getAttribute('data-dest-code');
    var destFlag = row.getAttribute('data-dest-flag');
    var flights = Number(row.getAttribute('data-flights')) || 1;
    ctx.strokeStyle = colors.line; ctx.lineWidth = Math.min(5, 1 + flights / 18); ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(14 + airlineWidth, y + 15); ctx.lineTo(originX - 34, y + 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(originX + 34, y + 15); ctx.lineTo(destinationX - 38, y + 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(destinationX - 38, y + 15); ctx.lineTo(destinationX - 46, y + 10); ctx.lineTo(destinationX - 46, y + 20); ctx.closePath(); ctx.fillStyle = colors.line; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.airline; ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    roundedRect(ctx, 14, y, airlineWidth, 30, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.text; ctx.font = '600 11px system-ui'; ctx.textAlign = 'left';
    var label = airline.length > 19 ? airline.slice(0, 18) + '…' : airline;
    ctx.fillText(label, 23, y + 19);
    ctx.fillStyle = colors.muted; ctx.textAlign = 'right'; ctx.fillText(iata, 14 + airlineWidth - 9, y + 19);
    [originX, destinationX].forEach(function (x) {
      ctx.fillStyle = colors.airport; ctx.strokeStyle = colors.border;
      roundedRect(ctx, x - 34, y, 68, 30, 15); ctx.fill(); ctx.stroke();
    });
    ctx.fillStyle = colors.text; ctx.font = '13px system-ui';
    drawCenteredAirportCode(ctx, hubFlag, hub, originX, y + 20);
    drawCenteredAirportCode(ctx, destFlag, dest, destinationX, y + 20);
    ctx.fillStyle = colors.muted; ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(flights + '便/週', (originX + destinationX) / 2, y + 10);
  });
}

routeTypeBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    networkRouteType = btn.getAttribute('data-route-type');
    routeTypeBtns.forEach(function (item) {
      var active = item === btn;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    drawRouteNetwork();
  });
});

routeLimitBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    var value = btn.getAttribute('data-route-limit');
    networkRouteLimit = value === 'all' ? 'all' : Number(value);
    routeLimitBtns.forEach(function (item) {
      var active = item === btn;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    drawRouteNetwork();
  });
});

countryBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    countryBtns.forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentCountry = btn.getAttribute('data-country');
    applyFilter();
    if (currentCountry === '__all__') flashCountryColumn();
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
destFilterCompactBtn.addEventListener('click', openDestFilterModal);
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
destFlagFilterCompactBtn.addEventListener('click', openDestFlagFilterModal);
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
  saveSelectedCountryHubs();
  closeCountryFilterModal();
  updateCountryPanelVisibility();
  applyFilter();
});

searchBox.addEventListener('input', applyFilter);
window.addEventListener('resize', drawRouteNetwork);
airportNameNormalBtn.addEventListener('click', function () { setAirportNameDisplay(false); });
airportNameCompactBtn.addEventListener('click', function () { setAirportNameDisplay(true); });
setAirportNameDisplay(getCookieValue(DISPLAY_MODE_COOKIE_NAME) === 'compact');
applyFilter();
flashCountryColumn();
</script>
</body>
</html>`;
}
