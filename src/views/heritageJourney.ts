import { HERITAGE_LIST } from '../data/heritageList';
import { ROUTE_CITIES } from '../data/routeCities';
import { AIRPORT_LIST } from '../data/airports';
import { RAIL_LINES } from '../data/railLines';
import { AIRLINE_NETWORK, AIRLINE_NETWORK_CHECKED_AT } from '../data/airlineNetwork';
import { getMarkdownParserScript } from '../utils/markdownRenderer';
import { getMitokoroModalCss, getHeritageMitokoroModalScript } from '../utils/heritageMitokoroModal';
import { heritageIndexToMasterId } from '../utils/heritage-master-seed';

const EUROPE_LAT_MIN = 36, EUROPE_LAT_MAX = 61, EUROPE_LON_MIN = -12, EUROPE_LON_MAX = 35;

function inEurope(lat: number, lon: number): boolean {
  return lat >= EUROPE_LAT_MIN && lat <= EUROPE_LAT_MAX && lon >= EUROPE_LON_MIN && lon <= EUROPE_LON_MAX;
}

// 空港(webglHeritage.tsの'airport'種別と同じ✈︎)・鉄道駅(同じく'station'種別の🚉)を
// 経由地候補として表示する際の識別アイコン。世界遺産の🏛️系アイコンと視覚的に区別するため、
// webglHeritage.tsで既に使われているアイコンをそのまま再利用する(表記ゆれ防止)。
const AIRPORT_ICON = '✈︎';
const STATION_ICON = '🚉';

export type AirportNetworkRoute = { country: string; flag: string; airline: string; iata: string; hubCode: string; hubName: string; destinationCode: string; destinationName: string; flightsPerWeek: number; direction: '出発' | '到着' };
export type JourneyPoint = { n: string; e: string; f: string; c: string; lat: number; lon: number; id: string | null; airportCode?: string; airportRoutes?: AirportNetworkRoute[] };

/** airline-networkページと同じマスタから、指定空港の出発便・到着便を同じ行形式で返す。 */
export function buildAirportNetworkRoutes(airportCode: string): AirportNetworkRoute[] {
  const routes: AirportNetworkRoute[] = [];
  for (const country of AIRLINE_NETWORK) for (const airline of country.airlines) for (const destination of airline.destinations) {
    if (airline.hubCode !== airportCode && destination.code !== airportCode) continue;
    routes.push({
      country: country.country, flag: country.flag, airline: airline.name, iata: airline.iata,
      hubCode: airline.hubCode, hubName: airline.hubName,
      destinationCode: destination.code, destinationName: destination.name,
      flightsPerWeek: destination.flightsPerWeek,
      direction: airline.hubCode === airportCode ? '出発' : '到着',
    });
  }
  return routes;
}

/**
 * airports.tsのcityフィールド("🇯🇵 日本・千葉"のような 国旗+空白+国・地域 形式)から
 * flag(国旗絵文字)とcountry(国名。"・"より前の部分)を分離する。
 * 想定外の形式(空白が無い等)が来ても例外を投げず、可能な範囲でフォールバックする。
 */
export function parseAirportCity(city: string): { flag: string; country: string } {
  const raw = String(city || '').trim();
  if (!raw) return { flag: '', country: '' };
  const spaceIdx = raw.indexOf(' ');
  const flag = spaceIdx === -1 ? '' : raw.slice(0, spaceIdx);
  const rest = spaceIdx === -1 ? raw : raw.slice(spaceIdx + 1).trim();
  const country = rest.split('・')[0] || rest;
  return { flag, country };
}

/**
 * heritage-journeyページの経由地候補として埋め込む、ヨーロッパ域内の世界遺産一覧。
 * 出発/到着都市によって迂回距離の絞り込みはクライアント側(JS)で行うため、ここでは
 * 座標付きの生データのみをヨーロッパ域内に絞って埋め込む。
 */
export function buildEmbeddedHeritagePoints(): JourneyPoint[] {
  // idはHERITAGE_LIST(フィルタ前・全件配列)での並び順から算出する
  // (heritage_masterのID採番と同じロジックをheritageIndexToMasterId経由で共有)。
  // inEuropeフィルタ後のindexを使うとheritage_masterのIDとずれるため、
  // 必ずフィルタ前にmapしてidを確定させてからフィルタすること。
  return HERITAGE_LIST
    .map((h, index) => ({ n: h.n, e: h.e, f: h.f, c: h.c, lat: h.lat, lon: h.lon, id: heritageIndexToMasterId(index) }))
    .filter((h) => inEurope(h.lat, h.lon));
}

/**
 * heritage-journeyページの経由地候補として埋め込む、ヨーロッパ域内の空港一覧。
 * airports.tsはグローバルなデータのため、世界遺産と同じくヨーロッパ域内にフィルタする。
 * 空港は heritage_master のようなID採番の仕組みを持たないため id は null にする
 * (経由データ保存機能側は !!p.id で null を自然に除外する設計になっている)。
 * 同名重複(データ上の表記ゆれ、例: MADが2件)は先勝ちで1件に絞る。
 * 個別データの形式が壊れていて解析に失敗しても、その1件だけ除外して処理を継続する
 * (1空港の不正データでページ全体が壊れないようにするため)。
 */
export function buildEmbeddedAirportPoints(): JourneyPoint[] {
  const seen = new Set<string>();
  const out: JourneyPoint[] = [];
  for (const a of AIRPORT_LIST) {
    try {
      if (typeof a.lat !== 'number' || typeof a.lon !== 'number' || !a.name) continue;
      if (!inEurope(a.lat, a.lon)) continue;
      if (seen.has(a.name)) continue;
      seen.add(a.name);
      const { flag, country } = parseAirportCity(a.city);
      out.push({ n: a.name, e: AIRPORT_ICON, f: flag, c: country, lat: a.lat, lon: a.lon, id: null, airportCode: a.code, airportRoutes: buildAirportNetworkRoutes(a.code) });
    } catch {
      // 個別データの解析失敗は握りつぶして次のデータへ進む(1件の不正データで
      // ページ全体を壊さないため)。
      continue;
    }
  }
  return out;
}

/**
 * heritage-journeyページの経由地候補として埋め込む、ヨーロッパ域内の鉄道駅一覧。
 * railLines.tsはRAIL_LINES[].stationsのネスト構造かつグローバルなデータのため、
 * 平坦化した上でヨーロッパ域内にフィルタする。flag/countryは駅自身のものを優先し、
 * 無ければ所属する路線(line)のものにフォールバックする。空港と同じくidはnullとし、
 * 同名重複(複数路線が同じ駅を経由する場合)は先勝ちで1件に絞る。
 */
export function buildEmbeddedRailStationPoints(): JourneyPoint[] {
  const seen = new Set<string>();
  const out: JourneyPoint[] = [];
  for (const line of RAIL_LINES) {
    for (const st of line.stations) {
      try {
        if (typeof st.lat !== 'number' || typeof st.lon !== 'number' || !st.name) continue;
        if (!inEurope(st.lat, st.lon)) continue;
        if (seen.has(st.name)) continue;
        seen.add(st.name);
        out.push({
          n: st.name,
          e: STATION_ICON,
          f: st.flag || line.flag || '',
          c: st.country || line.country || '',
          lat: st.lat,
          lon: st.lon,
          id: null,
        });
      } catch {
        continue;
      }
    }
  }
  return out;
}

/**
 * heritage-journeyページの経由地候補プール全体。世界遺産・空港・鉄道駅をマージした
 * ものを返す(変数名はHERITAGE_POINTSのまま、世界遺産以外も含む点に注意)。
 */
export function buildEmbeddedJourneyPoints(): JourneyPoint[] {
  return [...buildEmbeddedHeritagePoints(), ...buildEmbeddedAirportPoints(), ...buildEmbeddedRailStationPoints()];
}

export function getHeritageJourneyPage(heritageTourCountryFilterEnabled: boolean = true): string {
  const heritagePoints = buildEmbeddedJourneyPoints();
  const cities = ROUTE_CITIES;
  const heritageTourCountryFilterEnabledJs = heritageTourCountryFilterEnabled ? 'true' : 'false';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Heritage Journey — 世界遺産巡りマップ</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0}
.wrap{max-width:1080px;margin:0 auto;padding:24px}
h1{font-size:22px;margin:0 0 4px}
.muted{color:#94a3b8;font-size:12px;margin-bottom:18px;line-height:1.7}
.card{background:#111827;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:16px}
.section-title{font-size:14px;font-weight:700;margin:0 0 10px;color:#93c5fd}
.city-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.city-row select{background:#0b1220;border:1px solid #475569;color:#e2e8f0;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit}
#start-city option.start-city-option-registered{background:#bbf7d0;color:#064e3b}
#start-city option.start-city-option-unregistered{background:transparent;border:2px solid #bbf7d0}
#start-city-picker-btn,#end-city-picker-btn{background:#0b1220;border:1px solid #475569;color:#e2e8f0;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;cursor:pointer}
#start-city-picker-btn:hover,#end-city-picker-btn:hover{border-color:#38bdf8;color:#fff}
.start-city-picker-table{width:100%;border-collapse:collapse;font-size:12px}
.start-city-picker-table th,.start-city-picker-table td{border:1px solid #334155;padding:4px 8px;text-align:left;color:#cbd5e1}
.start-city-picker-table th{background:#1e293b;color:#93c5fd}
.start-city-picker-row{cursor:pointer}
.start-city-picker-row:hover{background:#1e293b}
.start-city-picker-row.start-city-picker-current{background:#bbf7d0;color:#0f172a}
.start-city-picker-row.start-city-picker-current td{color:#0f172a}
.start-city-picker-row td.start-city-picker-registered{background:#bbf7d0;color:#064e3b}
.start-city-picker-row td.start-city-picker-unregistered{background:transparent;border:2px solid #bbf7d0}
#start-city-picker-modal-box{position:fixed;max-width:560px;width:calc(100% - 32px)}
#start-city-picker-modal-head{cursor:grab;user-select:none;touch-action:none}
#start-city-picker-modal-head:active{cursor:grabbing}
.start-city-picker-checkbox-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-left:auto;font-size:11px}
.start-city-picker-checkbox-group{display:flex;align-items:center;gap:6px;color:#94a3b8;white-space:nowrap}
.start-city-picker-checkbox-group input{cursor:pointer}
.start-city-picker-checkbox-sep{width:1px;align-self:stretch;background:#334155}
.end-city-picker-table{width:100%;border-collapse:collapse;font-size:12px}
.end-city-picker-table th,.end-city-picker-table td{border:1px solid #334155;padding:4px 8px;text-align:left;color:#cbd5e1}
.end-city-picker-table th{background:#1e293b;color:#93c5fd}
.end-city-picker-row{cursor:pointer}
.end-city-picker-row:hover{background:#1e293b}
#end-city-picker-flag-th{cursor:pointer;text-align:center}
#end-city-picker-flag-th:hover{color:#38bdf8}
.end-city-picker-flag-td{text-align:center}
.end-city-picker-row.end-city-picker-current{background:#bbf7d0;color:#0f172a}
.end-city-picker-row.end-city-picker-current td{color:#0f172a}
#swap-btn{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:8px;padding:7px 10px;cursor:pointer;font-size:13px}
#swap-btn:hover{border-color:#38bdf8;color:#fff}
.opt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-top:12px}
.opt-item{display:flex;flex-direction:column;gap:4px;font-size:11px;color:#94a3b8}
.opt-item input{background:#0b1220;border:1px solid #475569;color:#e2e8f0;border-radius:6px;padding:6px 8px;font-size:13px;font-family:inherit}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.stat{background:#0b1220;border:1px solid #1e293b;border-radius:8px;padding:10px 12px}
.stat .label{font-size:11px;color:#94a3b8}
.stat .value{font-size:18px;font-weight:700;color:#5eead4;margin-top:2px}
.stat.loss .value{color:#fca5a5}
.cand-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;font-size:12px}
.cand-toolbar button{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px}
.cand-toolbar button:hover{border-color:#38bdf8;color:#fff}
.cand-toolbar .transport-toggle[aria-pressed="true"]{font-weight:700;outline:2px solid currentColor;outline-offset:-2px}
.cand-count{color:#94a3b8;margin-left:auto}
.cand-list{max-height:360px;overflow:auto;border:1px solid #1e293b;border-radius:8px}
.cand-row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid #1e293b;font-size:12px}
.cand-row:last-child{border-bottom:none}
.cand-row:hover{background:#0b1220}
.cand-row .cname{flex:1}
.cand-row .cdetour{color:#94a3b8;font-variant-numeric:tabular-nums}
.airport-network-btn{background:#1e3a5f;border:1px solid #38bdf8;color:#bae6fd;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:11px}
.airport-network-btn.has-data{background:#bbf7d0;border-color:#86efac;color:#14532d;font-weight:700}
.airport-network-table{width:100%;border-collapse:collapse;font-size:12px}.airport-network-table th,.airport-network-table td{border:1px solid #334155;padding:6px;text-align:left}.airport-network-table th{background:#1e293b;color:#93c5fd}.airport-network-code{display:block;color:#94a3b8;font-size:10px}.airport-network-freshness{color:#94a3b8;font-size:11px;margin:0 0 10px}
.route-line{padding:0;font-size:12px;line-height:2.1;margin-top:12px}
.route-title-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.route-apply-row{display:flex;justify-content:center;margin-top:12px}
#route-apply-btn{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:8px;padding:6px 16px;font-size:12px;cursor:pointer;font-family:inherit}
#route-apply-btn:disabled{opacity:.4;cursor:default}
#route-apply-btn:not(:disabled){background:#0369a1;border-color:#38bdf8;color:#fff}
#route-apply-btn:not(:disabled):hover{background:#0284c7}
#register-route-btn{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap}
#register-route-btn:disabled{opacity:.4;cursor:default}
#register-route-btn:not(:disabled){background:#0369a1;border-color:#38bdf8;color:#fff}
#register-route-btn:not(:disabled):hover{background:#0284c7}
#save-waypoint-set-btn{background:#0369a1;border:1px solid #38bdf8;color:#fff;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap}
#save-waypoint-set-btn:disabled{opacity:.4;cursor:default}
#save-waypoint-set-btn:not(:disabled):hover{background:#0284c7}
#waypoint-set-save-toast{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#dcfce7;color:#14532d;border:1px solid #86efac;border-radius:10px;padding:16px 24px;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.35);display:none}
#route-country-filter-locked-toast{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fce7f3;color:#9d174d;border:1px solid #f9a8d4;border-radius:10px;padding:16px 24px;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.35);display:none;max-width:360px;text-align:center}
#view-registered-routes-btn{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap}
#view-registered-routes-btn:hover{border-color:#38bdf8;color:#fff}
.registered-routes-freq-cols{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.registered-routes-freq-col{flex:1;min-width:160px}
.registered-routes-freq-title{font-size:12px;font-weight:700;color:#93c5fd;margin-bottom:6px}
.registered-routes-freq-item{display:flex;justify-content:flex-start;text-align:left;font-size:12px;color:#cbd5e1;padding:2px 0}
.registered-routes-table{width:100%;border-collapse:collapse;font-size:12px}
.registered-routes-table th,.registered-routes-table td{border:1px solid #334155;padding:4px 8px;text-align:left;color:#cbd5e1}
.registered-routes-table th{background:#1e293b;color:#93c5fd}
.registered-routes-end-th{position:relative}
.registered-routes-end-th-btn{border:0;background:transparent;color:inherit;font:inherit;font-weight:inherit;padding:0;cursor:pointer;white-space:nowrap}
.registered-routes-end-dropdown{position:absolute;top:100%;left:0;z-index:1;min-width:190px;max-height:280px;overflow:auto;padding:8px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:0 0 8px 8px;box-shadow:0 8px 18px rgba(0,0,0,.35)}
.registered-routes-country-filter-label{display:flex;align-items:center;gap:6px;margin-bottom:7px;color:var(--text-secondary);white-space:nowrap}
.registered-routes-country-filter{min-width:110px;background:var(--input-bg);color:var(--text-primary);border:1px solid var(--input-border);border-radius:6px;padding:3px 6px;font:inherit}
.registered-routes-end-dropdown .registered-routes-freq-item{color:var(--text-primary)}
.registered-routes-row{cursor:pointer}
.registered-routes-row:hover{background:#1e293b}
.registered-routes-empty{font-size:12px;color:#94a3b8}
#register-route-error{color:#f87171;font-size:12px;margin-top:6px}
#replay-tour-btn,#tour-test-btn{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap}
#replay-tour-btn:hover,#tour-test-btn:hover{border-color:#38bdf8;color:#fff}
#replay-tour-btn:disabled,#tour-test-btn:disabled{opacity:.5;cursor:default}
.heritage-add-search{background:#0b1220;border:1px solid #475569;border-radius:8px;color:#e2e8f0;font-size:13px;padding:7px 10px;width:220px;max-width:100%;flex-shrink:0;font-family:inherit}
.heritage-add-search:focus{outline:none;border-color:#38bdf8}
.heritage-add-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;align-items:center;justify-content:center;padding:16px}
.heritage-add-modal-overlay.open{display:flex}
.heritage-add-modal-box{background:#111827;border:1px solid #334155;border-radius:12px;padding:16px;max-width:520px;width:100%;max-height:80vh;display:flex;flex-direction:column}
.heritage-add-results-wrap{overflow-y:auto;max-height:60vh}
.heritage-add-results-table{width:100%;border-collapse:collapse;font-size:12px}
.heritage-add-results-table th{text-align:left;padding:6px 8px;border-bottom:1px solid #1e293b;color:#94a3b8;font-weight:600;position:sticky;top:0;background:#111827}
.heritage-add-results-table td{padding:6px 8px;border-bottom:1px solid #1e293b}
.heritage-add-btn{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap}
.heritage-add-btn:hover{border-color:#38bdf8;color:#fff}
.heritage-add-btn.active{background:#166534;border-color:#22c55e;color:#dcfce7}
.heritage-add-btn.active:hover{border-color:#4ade80;color:#fff}
.heritage-add-name.in-course{background:#bbf7d0;color:#064e3b;border-radius:4px;padding:2px 6px}
.registered-routes-has-waypoint{background:#bbf7d0}
.registered-routes-has-waypoint td{color:#064e3b}
.tour-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;align-items:center;justify-content:center;padding:16px}
.tour-modal-overlay.open{display:flex}
.tour-modal-box{background:#111827;border:1px solid #334155;border-radius:12px;padding:16px;max-width:560px;width:100%;max-height:90vh;overflow:auto}
#end-city-picker-modal-box{position:fixed;max-width:560px;width:calc(100% - 32px)}
#registered-routes-modal-box{position:fixed;max-width:560px;width:calc(100% - 32px)}
#end-city-picker-modal-head{cursor:grab;user-select:none;touch-action:none}
#end-city-picker-modal-head:active{cursor:grabbing}
#registered-routes-modal-head{cursor:grab;user-select:none;touch-action:none}
#registered-routes-modal-head:active{cursor:grabbing}
#dist-country-filter-modal-box{position:fixed;max-width:560px;width:calc(100% - 32px)}
.tour-route-side-panel{background:#111827;border:1px solid #334155;border-radius:12px;padding:12px;width:240px;max-width:calc(100vw - 600px);max-height:90vh;overflow:auto;margin-left:16px;flex-shrink:0}
.tour-route-side-title{font-size:12px;font-weight:700;color:#93c5fd;margin-bottom:8px}
.tour-route-side-row{border:2px solid transparent;border-radius:6px;padding:5px 8px;font-size:12px;color:#e2e8f0;margin-bottom:4px;cursor:pointer}
.tour-route-side-num{display:inline-block;min-width:1.4em;color:#94a3b8;font-variant-numeric:tabular-nums}
.tour-route-side-check{margin:0 4px;vertical-align:middle;cursor:pointer}
.tour-route-side-row:hover{background:#1e293b}
.tour-route-side-row.off{opacity:.45;color:#64748b}
.tour-route-side-row.focused{border-color:#facc15}
.tour-route-side-row.airport-has-data{background:#bbf7d0;color:#14532d}
.tour-route-side-row.airport-has-data .tour-route-side-num,.tour-route-side-row.airport-has-data .airport-network-code{color:#166534}
.tour-route-side-row.airport-has-data:hover{background:#86efac}
.tour-route-side-row.blink{animation:tourRouteSideBlink .4s ease-in-out 3}
@keyframes tourRouteSideBlink{0%,100%{border-color:#facc15}50%{border-color:#fef9c3}}
.tour-modal-head{position:relative;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px}
.end-city-picker-cand-toolbar{margin-left:auto;margin-bottom:0;font-size:11px}
.end-city-picker-cand-label{color:#94a3b8;white-space:nowrap}
.end-city-picker-cand-toolbar-row2{flex-basis:100%;margin-left:0}
.dist-country-filter-label{color:#94a3b8;white-space:nowrap}
.dist-country-filter-list{list-style:none;margin:0;padding:0;max-height:60vh;overflow:auto}
.dist-country-filter-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #334155;cursor:pointer;color:#e2e8f0;font-size:13px}
.dist-country-filter-row:hover{background:#1e293b}
.dist-country-filter-row.active{background:#1e3a8a}
.dist-country-filter-count{margin-left:auto;color:#94a3b8;font-size:11px}
.tour-modal-title{font-size:14px;font-weight:700;color:#93c5fd}
.tour-plan-summary{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:12px;color:#94a3b8;white-space:nowrap;pointer-events:none}
.tour-day-label{text-align:center;font-size:12px;font-weight:700;color:#93c5fd;margin-bottom:8px}
.tour-modal-close{background:none;border:none;color:#94a3b8;font-size:16px;cursor:pointer;padding:2px 6px}
.tour-modal-close:hover{color:#e2e8f0}
.tour-globe-wrap{position:relative}
#tour-globe-canvas{width:100%;max-width:520px;aspect-ratio:1/1;display:block;margin:0 auto;background:#0b1220;border-radius:50%;border:1px solid #1e293b;cursor:pointer}
.tour-tap-label{position:absolute;top:8px;left:50%;transform:translate(-50%,calc(-100% - 10px));background:#fbcfe8;color:#831843;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;pointer-events:none;display:none;white-space:nowrap;max-width:90%;overflow:hidden;text-overflow:ellipsis}
.tour-modal-controls{display:flex;align-items:center;gap:10px;margin-top:12px}
#tour-play-btn{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:8px;padding:6px 14px;font-size:12px;cursor:pointer;font-family:inherit}
#tour-play-btn:hover{border-color:#38bdf8;color:#fff}
.tour-modal-label{font-size:12px;color:#94a3b8}
.tour-next-label{color:#f9a8d4}
.tour-mini-panel{position:fixed;top:12px;left:12px;z-index:9998;background:#111827;border:1px solid #334155;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.4);overflow:hidden;width:280px}
.tour-mini-head{background:#1e293b;color:#93c5fd;font-size:12px;font-weight:700;padding:6px 10px;cursor:grab;user-select:none;touch-action:none}
.tour-mini-head:active{cursor:grabbing}
#tour-mini-canvas{display:block;width:260px;height:260px;margin:10px auto;background:#0b1220;border-radius:50%;border:1px solid #1e293b;cursor:pointer}
.lodging-recommend-modal{position:fixed;top:306px;left:12px;z-index:10001;width:280px;box-sizing:border-box;background:#111827;border:1px solid #86efac;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.55);padding:10px;display:none}
.lodging-recommend-title{font-size:12px;font-weight:700;color:#bbf7d0;margin-bottom:7px}
.lodging-recommend-list{display:flex;flex-wrap:wrap;gap:5px;max-height:92px;overflow:auto;margin-bottom:8px}
.lodging-recommend-city{border:1px solid #475569;border-radius:999px;background:#1e293b;color:#cbd5e1;padding:3px 8px;font:11px inherit;cursor:pointer}
.lodging-recommend-city.active{background:#14532d;border-color:#86efac;color:#dcfce7}
.lodging-recommend-controls{display:flex;align-items:center;justify-content:space-between;gap:8px}
.lodging-recommend-status{font-size:11px;color:#bbf7d0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#lodging-next-day-btn{flex-shrink:0;background:#14532d;border:1px solid #4ade80;color:#dcfce7;border-radius:7px;padding:5px 9px;font:11px inherit;cursor:pointer}
#lodging-next-day-btn:disabled{opacity:.45;cursor:default}
.tour-airport-summary{display:none;margin-top:10px;padding-top:9px;border-top:1px solid #334155}
.tour-airport-summary-title{font-size:12px;font-weight:700;color:#bae6fd;margin-bottom:6px}
.tour-airport-summary-wrap{max-height:132px;overflow:auto}
.tour-airport-summary-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px;color:#cbd5e1}
.tour-airport-summary-table th,.tour-airport-summary-table td{padding:4px;border-bottom:1px solid #1e293b;text-align:left;vertical-align:top}
.tour-airport-summary-table th{position:sticky;top:0;background:#111827;color:#7dd3fc}
.tour-airport-summary-table th:nth-child(1){width:34px}.tour-airport-summary-table th:nth-child(3),.tour-airport-summary-table th:nth-child(4){width:54px}
.tour-airport-coordinate{white-space:nowrap;font-variant-numeric:tabular-nums}
.wp-badge{display:inline-block;background:#1e293b;border:1px solid #334155;border-radius:999px;padding:2px 9px;white-space:nowrap;color:#cbd5e1;font-family:inherit;font-size:12px;cursor:pointer}
.wp-badge:hover{border-color:#38bdf8;color:#fff}
.wp-badge-fixed{cursor:default}
.wp-badge-fixed:hover{border-color:#334155;color:#cbd5e1}
.wp-badge-off{background:#0b1220;border-color:#1e293b;color:#4b5563;text-decoration:line-through;opacity:.6}
.wp-badge-off:hover{border-color:#475569;color:#94a3b8}
.wp-arrow{color:#64748b;margin:0 4px}
.wp-flag{margin-left:3px;font-size:12px}
.route-line-item{display:inline-block}
.route-line-item-dimmed{opacity:.35}
.route-line-item-dimmed .wp-badge{cursor:default}
#route-country-filter{background:#0b1220;border:1px solid #475569;color:#cbd5e1;border-radius:8px;padding:4px 8px;font-size:12px;font-family:inherit}
#route-country-filter:focus{outline:none;border-color:#38bdf8}
.day-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
.day-table th,.day-table td{padding:6px 10px;border-bottom:1px solid #1e293b;text-align:left}
.day-table th{background:#1e293b;color:#bfdbfe}
.hub-note{background:#0c2d4e;border:1px solid #1e3a5f;border-radius:8px;padding:8px 12px;font-size:12px;color:#93c5fd;margin-top:6px}
.trim-box{background:#3a1414;border:1px solid #7f1d1d;border-radius:8px;padding:10px 12px;font-size:12px;color:#fecaca;margin-top:10px}
.trim-box ul{margin:6px 0 8px;padding-left:18px}
.trim-box button{background:#7f1d1d;border:1px solid #ef4444;color:#fecaca;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px}
.empty-note{color:#64748b;font-size:12px;padding:8px 0}
.dist-row{display:flex;align-items:center;gap:10px;padding:6px 4px;cursor:pointer;border-radius:6px}
.dist-row:hover{background:#0b1220}
.dist-label{width:110px;flex-shrink:0;font-size:12px;color:#cbd5e1}
.dist-bar-track{flex:1;background:#0b1220;border-radius:5px;height:16px;overflow:hidden}
.dist-bar{background:linear-gradient(90deg,#2563eb,#38bdf8);height:100%;border-radius:5px;min-width:2px;transition:width .2s}
.dist-count{width:52px;flex-shrink:0;text-align:right;font-size:12px;color:#94a3b8;font-variant-numeric:tabular-nums}
.dist-cities{padding:4px 4px 10px 120px;display:flex;flex-wrap:wrap;gap:6px}
.dist-city-chip{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:999px;padding:4px 10px;font-size:11px;cursor:pointer}
.dist-city-chip:hover{border-color:#38bdf8;color:#fff}
.dist-row-empty{opacity:.4;cursor:default;pointer-events:none}
.slack-note{background:#0c2d1a;border:1px solid #14532d;border-radius:8px;padding:8px 12px;font-size:12px;color:#86efac;margin-top:10px}
.duration-label{font-size:12px;font-weight:400;color:#5eead4}
.visit-chip{display:inline-block;background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:999px;padding:2px 9px;font-size:11px;cursor:pointer;font-family:inherit;margin:2px 4px 2px 0}
.visit-chip:hover{border-color:#38bdf8;color:#fff}
.visit-chip.off{background:#374151;border-color:#374151;color:#9ca3af;text-decoration:line-through}
#tour-tap-mitokoro-gemma-btn,#tour-tap-mitokoro-llama-btn{cursor:pointer;margin-left:4px;pointer-events:auto;touch-action:manipulation}
${getMitokoroModalCss()}
</style>
</head>
<body>
<div class="wrap">
  <h1>Heritage Journey — 世界遺産巡りマップ</h1>
  <div class="muted">主要都市2点を移動する際、距離ロスがほぼ無く立ち寄れる世界遺産を候補として表示します。候補を任意に選択(すべて選択も可)すると、直行との距離ロス・時間ロスがその場で再計算されます。あわせて宿泊地の推奨と、連泊しての市内巡り・日程短縮の提案も行います。</div>

  <div class="card">
    <div class="section-title">出発地・到着地</div>
    <div class="city-row">
      <select id="start-city" style="display:none"></select>
      <button id="start-city-picker-btn" type="button"></button>
      <button id="swap-btn" type="button">⇄ 入替</button>
      <select id="end-city" style="display:none"></select>
      <button id="end-city-picker-btn" type="button"></button>
      <button id="register-route-btn" type="button" disabled>➕ ルート登録</button>
      <button id="view-registered-routes-btn" type="button">📋 登録済みルートを見る</button>
      <button id="save-waypoint-set-btn" type="button" style="display:none">💾 この経由データを保存</button>
    </div>
    <div id="register-route-error" style="display:none"></div>
    <div id="save-waypoint-set-error" style="display:none"></div>
    <div class="opt-grid">
      <label class="opt-item">迂回許容距離(km・候補の広さ)<input id="opt-detour" type="number" min="10" max="500" step="10" value="150"></label>
      <label class="opt-item">平均移動速度(km/h)<input id="opt-speed" type="number" min="20" max="160" step="5" value="70"></label>
      <label class="opt-item">1件あたり見学時間(h)<input id="opt-visit" type="number" min="0" max="12" step="0.5" value="1.5"></label>
      <label class="opt-item">1日の最大移動距離(km)<input id="opt-daily" type="number" min="100" max="900" step="10" value="350"></label>
      <label class="opt-item">拠点とみなす近さ(km・連泊判定)<input id="opt-hub" type="number" min="10" max="200" step="5" value="45"></label>
      <label class="opt-item">使える宿泊数(泊・任意)<input id="opt-nights" type="number" min="0" max="60" step="1" placeholder="未入力なら無制限"></label>
    </div>
  </div>

  <div class="card">
    <div class="route-title-row">
      <div class="section-title" style="margin:0">出発地から見た目的地別プラン分布</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="dist-country-filter-label">到達国を制限する : </span>
        <button id="dist-country-filter-btn" type="button">しない(デフォルト)</button>
      </div>
    </div>
    <div class="muted" style="margin-bottom:10px">現在の出発地から各都市への既定プラン(迂回20km以内の世界遺産を全て含む)が、それぞれ何泊必要かを集計しています。バーをクリックすると該当する目的地の一覧が開き、選ぶとその目的地の詳細プランに切り替わります。</div>
    <div id="nights-dist"></div>
  </div>

  <div class="card">
    <div class="section-title">距離ロス・時間ロス</div>
    <div class="summary-grid" id="summary-grid"></div>
    <div id="slack-note"></div>
  </div>

  <div class="card">
    <div class="section-title">経由地候補(世界遺産・空港・駅)</div>
    <div class="cand-toolbar">
      <button id="select-all-btn" type="button">すべて選択</button>
      <button id="select-none-btn" type="button">すべて解除</button>
      <button id="select-near-btn" type="button">近接のみ選択(20km以内)</button>
      <button id="toggle-stations-btn" class="transport-toggle" type="button" aria-pressed="false">駅ON/OFF</button>
      <button id="toggle-airports-btn" class="transport-toggle" type="button" aria-pressed="true">空港ON/OFF</button>
      <button id="toggle-castles-btn" class="transport-toggle" type="button" aria-pressed="true">城ON/OFF</button>
      <span class="cand-count" id="cand-count"></span>
    </div>
    <div class="cand-list" id="cand-list"></div>
  </div>

  <div class="card">
    <div class="route-title-row"><div class="section-title" style="margin:0">ルート順序</div><div style="display:flex;align-items:center;gap:8px;"><button id="tour-test-btn" type="button">🌐 巡回テスト</button><button id="replay-tour-btn" type="button">🎬 巡回ルートを再現する🌏</button><select id="route-country-filter" title="国で絞り込むとそれ以外の地点がグレーアウトされます"></select></div></div>
    <div class="route-line" id="route-line"></div>
    <div class="route-apply-row"><button id="route-apply-btn" type="button" disabled>適用する</button></div>
  </div>

  <div class="card">
    <div class="route-title-row">
      <div class="section-title" style="margin:0">宿泊地の推奨プラン <span id="day-plan-duration" class="duration-label"></span></div>
      <input type="search" id="heritage-add-search" class="heritage-add-search" placeholder="🔍 追加したい経由地(世界遺産・空港・駅)を検索..." autocomplete="off">
    </div>
    <div id="day-plan"></div>
  </div>
</div>

<div class="heritage-add-modal-overlay" id="heritage-add-modal-overlay">
  <div class="heritage-add-modal-box">
    <div class="tour-modal-head">
      <div class="tour-modal-title">🔍 経由地を追加</div>
      <button type="button" class="tour-modal-close" id="heritage-add-modal-close" aria-label="閉じる">✕</button>
    </div>
    <div class="heritage-add-results-wrap">
      <table class="heritage-add-results-table">
        <thead><tr><th>経由地名</th><th>国</th><th></th></tr></thead>
        <tbody id="heritage-add-results-body"></tbody>
      </table>
    </div>
  </div>
</div>

<div class="tour-modal-overlay" id="registered-routes-modal-overlay">
  <div class="tour-modal-box" id="registered-routes-modal-box">
    <div class="tour-modal-head" id="registered-routes-modal-head">
      <div class="tour-modal-title">📋 登録済みルート</div>
      <button type="button" class="tour-modal-close" id="registered-routes-modal-close" aria-label="閉じる">✕</button>
    </div>
    <div class="registered-routes-freq-cols">
      <div class="registered-routes-freq-col">
        <div class="registered-routes-freq-title">出発地</div>
        <div id="registered-routes-start-freq"></div>
      </div>
    </div>
    <table class="registered-routes-table">
      <thead><tr><th>ID</th><th>出発地</th><th class="registered-routes-end-th"><button type="button" class="registered-routes-end-th-btn" id="registered-routes-end-th-btn" aria-expanded="false" aria-controls="registered-routes-end-dropdown">到着地 ▾</button><div class="registered-routes-end-dropdown" id="registered-routes-end-dropdown" hidden><label class="registered-routes-country-filter-label">国旗<select class="registered-routes-country-filter" id="registered-routes-country-filter" aria-label="到着地を国旗で絞り込む"><option value="">なし</option></select></label><div id="registered-routes-end-freq"></div></div></th><th>直線距離</th><th>総数</th></tr></thead>
      <tbody id="registered-routes-table-body"></tbody>
    </table>
  </div>
</div>

<div class="tour-modal-overlay" id="end-city-picker-modal-overlay">
  <div class="tour-modal-box" id="end-city-picker-modal-box">
    <div class="tour-modal-head" id="end-city-picker-modal-head">
      <div class="tour-modal-title">🏙️ 到着地を選択</div>
      <div class="start-city-picker-checkbox-row">
        <label class="start-city-picker-checkbox-group"><input type="checkbox" id="end-city-picker-cities-cb" checked>都市名のみ</label>
        <span class="start-city-picker-checkbox-sep"></span>
        <label class="start-city-picker-checkbox-group"><input type="checkbox" id="end-city-picker-stations-cb">駅</label>
        <label class="start-city-picker-checkbox-group"><input type="checkbox" id="end-city-picker-airports-cb">空港</label>
        <label class="start-city-picker-checkbox-group"><input type="checkbox" id="end-city-picker-castles-cb">城</label>
      </div>
      <button type="button" class="tour-modal-close" id="end-city-picker-modal-close" aria-label="閉じる">✕</button>
      <div class="cand-toolbar end-city-picker-cand-toolbar end-city-picker-cand-toolbar-row2">
        <span class="end-city-picker-cand-label">経由地 : </span>
        <button id="select-all-btn-modal" type="button">すべて選択</button>
        <button id="select-none-btn-modal" type="button">すべて解除</button>
        <button id="select-near-btn-modal" type="button">近接のみ選択(20km以内)</button>
      </div>
    </div>
    <table class="end-city-picker-table">
      <thead><tr><th id="end-city-picker-flag-th" title="国旗をタップすると到達国を制限できます">🏁</th><th>都市名</th><th>出発地からの距離(km)</th></tr></thead>
      <tbody id="end-city-picker-table-body"></tbody>
    </table>
  </div>
</div>

<div class="tour-modal-overlay" id="start-city-picker-modal-overlay">
  <div class="tour-modal-box" id="start-city-picker-modal-box">
    <div class="tour-modal-head" id="start-city-picker-modal-head">
      <div class="tour-modal-title">🏙️ 出発地を選択</div>
      <div class="start-city-picker-checkbox-row">
        <label class="start-city-picker-checkbox-group"><input type="checkbox" id="start-city-picker-cities-cb" checked>都市名のみ</label>
        <span class="start-city-picker-checkbox-sep"></span>
        <label class="start-city-picker-checkbox-group"><input type="checkbox" id="start-city-picker-stations-cb">駅</label>
        <label class="start-city-picker-checkbox-group"><input type="checkbox" id="start-city-picker-airports-cb">空港</label>
        <label class="start-city-picker-checkbox-group"><input type="checkbox" id="start-city-picker-castles-cb">城</label>
      </div>
      <button type="button" class="tour-modal-close" id="start-city-picker-modal-close" aria-label="閉じる">✕</button>
    </div>
    <table class="start-city-picker-table">
      <thead><tr><th>都市名</th><th>到着地からの距離(km)</th></tr></thead>
      <tbody id="start-city-picker-table-body"></tbody>
    </table>
  </div>
</div>

<div class="tour-modal-overlay" id="dist-country-filter-modal-overlay">
  <div class="tour-modal-box" id="dist-country-filter-modal-box">
    <div class="tour-modal-head">
      <div class="tour-modal-title">🌍 到達国を制限する</div>
      <button type="button" class="tour-modal-close" id="dist-country-filter-modal-close" aria-label="閉じる">✕</button>
    </div>
    <ul class="dist-country-filter-list" id="dist-country-filter-list"></ul>
  </div>
</div>

<div id="waypoint-set-save-toast"></div>
<div id="route-country-filter-locked-toast"></div>

<div class="tour-modal-overlay" id="tour-modal-overlay">
  <div class="tour-modal-box">
    <div class="tour-modal-head">
      <div class="tour-modal-title" id="tour-scope-title">🌐 巡回テスト</div>
      <div class="tour-plan-summary" id="tour-plan-summary"></div>
      <button type="button" class="tour-modal-close" id="tour-modal-close" aria-label="閉じる">✕</button>
    </div>
    <div class="tour-day-label" id="tour-day-label"></div>
    <div class="tour-globe-wrap">
      <canvas id="tour-globe-canvas" width="520" height="520"></canvas>
      <div class="tour-tap-label" id="tour-tap-label"></div>
    </div>
    <div class="tour-modal-controls">
      <button type="button" id="tour-play-btn">▶ 再生</button>
      <span class="tour-modal-label" id="tour-current-label"></span>
      <span class="tour-modal-label tour-next-label" id="tour-next-label"></span>
    </div>
  </div>
  <div class="tour-route-side-panel" id="tour-route-side-panel">
    <div class="tour-route-side-title">ルート順序</div>
    <div id="tour-route-side-list"></div>
  </div>
</div>

<div class="tour-mini-panel" id="tour-mini-panel" style="display:none;">
  <div class="tour-mini-head" id="tour-mini-head">🌐 巡回テスト</div>
  <canvas id="tour-mini-canvas" width="260" height="260"></canvas>
</div>
<section class="lodging-recommend-modal" id="lodging-recommend-modal" role="dialog" aria-modal="false" aria-labelledby="lodging-recommend-title">
  <div class="lodging-recommend-title" id="lodging-recommend-title">🏨 宿泊推奨地</div>
  <div class="lodging-recommend-list" id="lodging-recommend-list"></div>
  <div class="lodging-recommend-controls">
    <span class="lodging-recommend-status" id="lodging-recommend-status"></span>
    <button type="button" id="lodging-next-day-btn">次の1日へ →</button>
  </div>
  <div class="tour-airport-summary" id="tour-airport-summary">
    <div class="tour-airport-summary-title">✈︎ 巡回ルートの空港</div>
    <div class="tour-airport-summary-wrap"><table class="tour-airport-summary-table"><thead><tr><th>コード</th><th>空港名</th><th>緯度</th><th>経度</th></tr></thead><tbody id="tour-airport-summary-body"></tbody></table></div>
  </div>
</section>
<div class="tour-modal-overlay" id="airport-network-modal-overlay">
  <div class="tour-modal-box" id="airport-network-modal-box">
    <div class="tour-modal-head"><div class="tour-modal-title" id="airport-network-modal-title">✈️ 空港の発着便</div><button type="button" class="tour-modal-close" id="airport-network-modal-close" aria-label="閉じる">✕</button></div>
    <p class="airport-network-freshness">airline-networkと共通の運航情報（確認日: <time datetime="${AIRLINE_NETWORK_CHECKED_AT}">${AIRLINE_NETWORK_CHECKED_AT}</time>、便数は季節で変動する目安）</p>
    <div class="registered-routes-table-wrap"><table class="airport-network-table"><thead><tr><th>方向</th><th>国</th><th>航空会社</th><th>拠点空港</th><th>乗り入れ空港</th><th>便数(週)</th></tr></thead><tbody id="airport-network-table-body"></tbody></table></div>
  </div>
</div>
<script>
${getMarkdownParserScript()}
${getHeritageMitokoroModalScript()}
var HERITAGE_POINTS = ${JSON.stringify(heritagePoints)};
var CLIENT_AIRPORT_ICON = ${JSON.stringify(AIRPORT_ICON)};
var CLIENT_STATION_ICON = ${JSON.stringify(STATION_ICON)};
var CITIES = ${JSON.stringify(cities)};
var CITY_POINTS = CITIES.map(function(c) { return { name: c.label, lat: c.lat, lon: c.lon }; });
var EARTH_R = 6371;

// 巡回テストのタップツールチップに「見どころ」アイコンを出せるよう、
// 事前にname→{icon,shareId}のマップを取得しておく(見つかった分だけ随時反映)。
var tourHeritageMitokoroShareId = {};
fetchHeritageMitokoroShareIds(HERITAGE_POINTS.map(function(p) { return p.n; }), function(map) {
  tourHeritageMitokoroShareId = map;
});

function haversineKm(lat1, lon1, lat2, lon2) {
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function computeDetourKm(start, end, p) {
  var direct = haversineKm(start.lat, start.lon, end.lat, end.lon);
  return haversineKm(start.lat, start.lon, p.lat, p.lon) + haversineKm(p.lat, p.lon, end.lat, end.lon) - direct;
}

function buildCandidates(start, end, pool, maxDetourKm) {
  var out = [];
  pool.forEach(function(h) {
    if (haversineKm(h.lat, h.lon, start.lat, start.lon) < 3) return;
    if (haversineKm(h.lat, h.lon, end.lat, end.lon) < 3) return;
    var detour = computeDetourKm(start, end, h);
    if (detour <= maxDetourKm || manuallyAddedPoints[h.n]) out.push({ name: h.n, icon: h.e, flag: h.f, country: h.c, lat: h.lat, lon: h.lon, detour: detour, id: h.id, airportCode: h.airportCode, airportRoutes: h.airportRoutes });
  });
  out.sort(function(a, b) { return a.detour - b.detour; });
  return out;
}

/**
 * 最安挿入法(cheapest insertion)でstart→endに選択済み地点を全て挿入し1本のルートにする。
 * 単純な最近傍法や進行方向ソートでは候補が起点-終点直線の左右に散らばっている場合に
 * 大きくジグザグして総距離が数倍に膨れ上がることが実データ検証で判明したため、
 * 「挿入しても増加距離が最小になる位置」を毎回全候補×全位置から選び直す方式にした。
 */
function cheapestInsertionOrder(start, end, selected) {
  var remaining = selected.slice();
  var route = [start, end];
  while (remaining.length) {
    var bestIdx = -1, bestPos = -1, bestCost = Infinity;
    for (var ci = 0; ci < remaining.length; ci++) {
      var cand = remaining[ci];
      for (var pos = 1; pos < route.length; pos++) {
        var prev = route[pos-1], next = route[pos];
        var cost = haversineKm(prev.lat, prev.lon, cand.lat, cand.lon) + haversineKm(cand.lat, cand.lon, next.lat, next.lon) - haversineKm(prev.lat, prev.lon, next.lat, next.lon);
        if (cost < bestCost) { bestCost = cost; bestIdx = ci; bestPos = pos; }
      }
    }
    var chosen = remaining.splice(bestIdx, 1)[0];
    route.splice(bestPos, 0, chosen);
  }
  return route;
}

function computeStats(start, end, ordered, speedKmh, perSiteHours) {
  var legs = [];
  var totalKm = 0;
  for (var i = 1; i < ordered.length; i++) {
    var km = haversineKm(ordered[i-1].lat, ordered[i-1].lon, ordered[i].lat, ordered[i].lon);
    legs.push({ from: ordered[i-1].name, to: ordered[i].name, km: km });
    totalKm += km;
  }
  var directKm = haversineKm(start.lat, start.lon, end.lat, end.lon);
  var extraKm = totalKm - directKm;
  var stopCount = ordered.length - 2;
  var extraHours = speedKmh > 0 ? extraKm / speedKmh : 0;
  var visitHours = stopCount * perSiteHours;
  return {
    legs: legs, totalKm: totalKm, directKm: directKm, extraKm: extraKm,
    extraPct: directKm > 0 ? (extraKm / directKm * 100) : 0,
    stopCount: stopCount, extraHours: extraHours, visitHours: visitHours,
    totalAddedHours: extraHours + visitHours,
  };
}

function nearestCity(p, cities) {
  var best = cities[0], bestD = Infinity;
  cities.forEach(function(c) { var d = haversineKm(p.lat, p.lon, c.lat, c.lon); if (d < bestD) { bestD = d; best = c; } });
  return best;
}

/**
 * ルート順(start/endを除く)で連続する経由地同士の距離がhubRadiusKm以内であれば、
 * 「同じ拠点に連泊して日帰りで周れる」候補としてクラスタ化する(2件以上のみ採用)。
 */
function detectHubClusters(ordered, hubRadiusKm) {
  var mid = ordered.slice(1, -1);
  var clusters = [];
  var cur = [];
  for (var i = 0; i < mid.length; i++) {
    if (cur.length === 0) { cur.push(mid[i]); continue; }
    // クラスタ内の最初の地点(拠点候補の目安)からの距離で判定する。直前の1件だけと
    // 比較する連鎖判定だと、各ペアはhubRadiusKm以内でも連鎖全体では大きく広がってしまい
    // (例: A-B, B-Cが近くてもA-Cは遠い)、現実には日帰りできない距離を「連泊圏内」と
    // 誤判定する。起点基準にすることでクラスタの直径は最大2*hubRadiusKmに収まる。
    var anchor = cur[0];
    var d = haversineKm(anchor.lat, anchor.lon, mid[i].lat, mid[i].lon);
    if (d <= hubRadiusKm) { cur.push(mid[i]); }
    else { if (cur.length >= 2) clusters.push(cur.slice()); cur = [mid[i]]; }
  }
  if (cur.length >= 2) clusters.push(cur.slice());
  return clusters;
}

/**
 * ルートを1日あたりmaxDailyKmを上限に区切り、各日の終着地点に最も近い都市を
 * 宿泊推奨地として提示する。hubクラスタに含まれる経由地は、クラスタの重心に最も
 * 近い都市を拠点として連泊(日帰り観光)扱いにする。hubクラスタに到達した時点で
 * 必ずその日を区切る(距離上限に達していなくても)。距離だけで日を区切ると、
 * hubクラスタと無関係な手前の経由地がhub到着日の訪問地一覧に混入してしまうため。
 * また、経由地が無い(または疎らな)直行区間だけでmaxDailyKmを超える場合、その1区間を
 * 均等分割して複数の移動日に分ける。分割しないと「最終区間は常にnights:0」という
 * 判定により、実際には数日かかる長距離直行ルートが常に0泊と算出されてしまう
 * (実際に発生した不具合)。
 */
function planOvernights(start, end, ordered, clusters, cities, maxDailyKm) {
  var clusterOf = {};
  clusters.forEach(function(cl, ci) { cl.forEach(function(m) { clusterOf[m.name] = ci; }); });

  var collapsed = [start];
  var i = 1;
  while (i < ordered.length - 1) {
    var p = ordered[i];
    var ci = clusterOf[p.name];
    if (ci !== undefined) {
      var cl = clusters[ci];
      var centroid = { lat: 0, lon: 0 };
      cl.forEach(function(m) { centroid.lat += m.lat / cl.length; centroid.lon += m.lon / cl.length; });
      var city = nearestCity(centroid, cities);
      collapsed.push({ name: city.name, lat: city.lat, lon: city.lon, hubMembers: cl });
      i += cl.length;
    } else {
      collapsed.push(p);
      i += 1;
    }
  }
  collapsed.push(end);

  var days = [];
  var dayKm = 0, dayVisits = [];
  for (var k = 1; k < collapsed.length; k++) {
    var prev = collapsed[k-1], node = collapsed[k];
    var km = haversineKm(prev.lat, prev.lon, node.lat, node.lon);
    var isLast = (k === collapsed.length - 1);

    if (node.hubMembers) {
      // hub(連泊拠点)に到達する前に未確定の移動日が残っていれば、その日をhub到着前で
      // 区切って確定させる。そうしないとhub到着日の訪問地一覧に、hubとは無関係な
      // 手前の経由地まで混ざってしまう(実際に発生した不具合)。
      if (dayVisits.length > 0 || dayKm > 0) {
        days.push({ endPoint: prev.name, city: nearestCity(prev, cities).name, km: dayKm, visits: dayVisits.slice(), nights: 1, isHub: false });
        dayKm = 0; dayVisits = [];
      }
      dayKm += km;
      dayVisits = node.hubMembers.map(function(m) { return m.name; });
      var nights = Math.max(1, Math.ceil(node.hubMembers.length / 2));
      days.push({ endPoint: node.name, city: node.name, km: dayKm, visits: dayVisits.slice(), nights: isLast ? 0 : nights, isHub: true });
      dayKm = 0; dayVisits = [];
      continue;
    }

    // 1区間(prev→node)だけでmaxDailyKmを超える場合、そのままだと1日に押し込められて
    // しまい(直行ルートが常に「0泊」になる不具合が実際に起きた)、区間を均等分割して
    // 複数の移動日に分ける。分割点は経路上の実在しない地点なので、最寄り都市を宿泊
    // 推奨地として提示する。
    if (km > maxDailyKm) {
      if (dayVisits.length > 0 || dayKm > 0) {
        days.push({ endPoint: prev.name, city: nearestCity(prev, cities).name, km: dayKm, visits: dayVisits.slice(), nights: 1, isHub: false });
        dayKm = 0; dayVisits = [];
      }
      var segs = Math.ceil(km / maxDailyKm);
      var segKm = km / segs;
      for (var s = 1; s <= segs; s++) {
        var t = s / segs;
        var subPoint = { lat: prev.lat + (node.lat - prev.lat) * t, lon: prev.lon + (node.lon - prev.lon) * t };
        var isFinalSeg = (s === segs);
        var subVisits = (isFinalSeg && !isLast) ? [node.name] : [];
        var subCity = nearestCity(subPoint, cities);
        days.push({ endPoint: isFinalSeg ? node.name : subCity.name, city: subCity.name, km: segKm, visits: subVisits, nights: (isFinalSeg && isLast) ? 0 : 1, isHub: false });
      }
      continue;
    }

    dayKm += km;
    if (!isLast) dayVisits.push(node.name);
    if (dayKm >= maxDailyKm || isLast) {
      var city = nearestCity(node, cities);
      days.push({ endPoint: node.name, city: city.name, km: dayKm, visits: dayVisits.slice(), nights: isLast ? 0 : 1, isHub: false });
      dayKm = 0; dayVisits = [];
    }
  }
  return days;
}

/**
 * 各選択済み経由地を「その地点を経路から抜いた場合に減る距離(=挿入コスト)」の
 * 降順で並べる。日程短縮の際、迂回コストが大きい(=わりに合わない)経由地から
 * 削る候補として提示するために使う。
 */
function rankRemovalCandidates(ordered) {
  var mid = ordered.slice(1, -1);
  return mid.map(function(p, idx) {
    var prev = ordered[idx], next = ordered[idx + 2];
    var cost = haversineKm(prev.lat, prev.lon, p.lat, p.lon) + haversineKm(p.lat, p.lon, next.lat, next.lon) - haversineKm(prev.lat, prev.lon, next.lat, next.lon);
    return { name: p.name, cost: cost };
  }).sort(function(a, b) { return b.cost - a.cost; });
}

/**
 * start→endの経路(選択済み地点)から、必要な宿泊数の合計だけを求める。
 * 出発地別プラン分布(全目的地との比較)や、既定プランとの余裕比較で使う軽量版。
 */
function computePlanNights(start, end, selectedPoints, hubRadiusKm, maxDailyKm) {
  var ordered = cheapestInsertionOrder(start, end, selectedPoints);
  var clusters = detectHubClusters(ordered, hubRadiusKm);
  var days = planOvernights(start, end, ordered, clusters, CITY_POINTS, maxDailyKm);
  return days.reduce(function(s, d) { return s + d.nights; }, 0);
}

/**
 * 指定した出発地startから、他の全都市を目的地とみなした場合の既定プラン
 * (迂回20km以内の世界遺産を全て含む)の必要泊数を都市ごとに算出する。
 * 迂回許容距離(opt-detour)には依存せず、常に20km以内の既定候補で計算する
 * (この分布は「候補の広さ」ではなく「既定プランでの負担」を横比較するためのもの)。
 */
// 「到達国を制限する」フィルタの現在値。'__ALL__'が「しない(デフォルト)」を表す
// センチネル値で、Cookie(DEST_COUNTRY_FILTER_COOKIE)にもそのまま同じ文字列で
// 保存する(空文字にするとCookie未設定と区別しづらいため明示的な文字列を使う)。
var DEST_COUNTRY_FILTER_ALL = '__ALL__';
var DEST_COUNTRY_FILTER_COOKIE = 'heritage_journey_dest_country_filter';
var destCountryFilter = DEST_COUNTRY_FILTER_ALL;

function isValidDestCountry(name) {
  return CITIES.some(function(c) { return c.country === name; });
}

// このページ全体(scriptタグの中身)は他のTypeScriptファイルのtemplate literalの
// 中に丸ごと埋め込まれているため、正規表現リテラルや文字列中のバックスラッシュ
// エスケープシーケンス(空白文字クラス等)はtemplate literalのエスケープ処理を
// 二重に経由し、バックスラッシュ自体が失われて壊れる(ルール29参照)。以前は
// document.cookieを正規表現でパースしていたが、この二重エスケープにより実際に
// 実行されるコードではバックスラッシュが消えてしまい、document.cookieの2件目
// 以降のCookie(先頭以外、つまりセミコロンの後にスペースを挟むもの)を一切
// 読み取れない不具合があった(1件目のCookieだけは先頭一致の分岐で偶然マッチ
// していた)。正規表現・バックスラッシュを一切使わない文字列分割とtrim()に
// 置き換えて回避する。
function getCookieValue(name) {
  var parts = document.cookie.split(';');
  for (var i = 0; i < parts.length; i++) {
    var eq = parts[i].indexOf('=');
    if (eq === -1) continue;
    var key = parts[i].slice(0, eq).trim();
    if (key === name) return decodeURIComponent(parts[i].slice(eq + 1));
  }
  return null;
}

// ページ読み込み時にCookieを読み、ROUTE_CITIESに実在する国名の場合のみ採用する。
// 未設定・不正値(過去に存在した国が削除された場合等)は「しない(デフォルト)」に
// フォールバックし、クラッシュや空表示を避ける。
function loadDestCountryFilterFromCookie() {
  var v = getCookieValue(DEST_COUNTRY_FILTER_COOKIE);
  if (v && v !== DEST_COUNTRY_FILTER_ALL && isValidDestCountry(v)) {
    destCountryFilter = v;
  } else {
    destCountryFilter = DEST_COUNTRY_FILTER_ALL;
  }
}

function saveDestCountryFilterToCookie(value) {
  document.cookie = DEST_COUNTRY_FILTER_COOKIE + '=' + encodeURIComponent(value) + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
}

function updateDistCountryFilterBtnLabel() {
  var btn = document.getElementById('dist-country-filter-btn');
  if (!btn) return;
  if (destCountryFilter === DEST_COUNTRY_FILTER_ALL) {
    btn.textContent = 'しない(デフォルト)';
    return;
  }
  var city = CITIES.filter(function(c) { return c.country === destCountryFilter; })[0];
  var flag = city ? (city.flag || '') : '';
  btn.textContent = (flag ? flag + ' ' : '') + destCountryFilter;
}

// 到達国候補を国名でグルーピングし、その国に属する都市数の降順(同数は国名の
// 辞書順)で並べる。「到着地の国旗の数が多い順」= 候補都市の多い国から表示する
// 仕様のための集計。
function computeDestCountryCounts() {
  var counts = {};
  var flags = {};
  CITIES.forEach(function(c) {
    if (!c.country) return;
    counts[c.country] = (counts[c.country] || 0) + 1;
    flags[c.country] = c.flag || '';
  });
  return Object.keys(counts).map(function(name) {
    return { country: name, count: counts[name], flag: flags[name] };
  }).sort(function(a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.country.localeCompare(b.country, 'ja');
  });
}

function renderDistCountryFilterList() {
  var list = document.getElementById('dist-country-filter-list');
  if (!list) return;
  var entries = computeDestCountryCounts();
  var rows = [{ country: DEST_COUNTRY_FILTER_ALL, count: null, flag: '' }].concat(entries);
  list.innerHTML = rows.map(function(r) {
    var isAll = r.country === DEST_COUNTRY_FILTER_ALL;
    var isActive = r.country === destCountryFilter;
    var label = isAll ? 'しない' : ((r.flag ? esc(r.flag) + ' ' : '') + esc(r.country));
    var countBadge = isAll ? '' : '<span class="dist-country-filter-count">' + r.count + '件</span>';
    return '<li class="dist-country-filter-row' + (isActive ? ' active' : '') + '" data-country="' + esc(r.country) + '"'
      + (r.count === null ? '' : ' data-count="' + r.count + '"') + '>' + label + countBadge + '</li>';
  }).join('');
}

// #tour-mini-panel(280px幅、既定でtop:12px;left:12px)と重ならないよう、
// 既定位置は画面右側・やや下(left:innerWidth-600px以上を確保、下限320px)に固定する。
// #end-city-picker-modal-boxの既定位置(resetEndCityPickerModalPosition)と同じ
// 技法・数値パターンを踏襲する。再オープンのたびにこの既定位置へリセットする。
function resetDistCountryFilterModalPosition() {
  var box = document.getElementById('dist-country-filter-modal-box');
  if (!box) return;
  var defaultLeft = Math.max(320, window.innerWidth - 600);
  var defaultTop = 80;
  box.style.left = defaultLeft + 'px';
  box.style.top = defaultTop + 'px';
}

function openDistCountryFilterModal() {
  var overlay = document.getElementById('dist-country-filter-modal-overlay');
  if (!overlay) return;
  renderDistCountryFilterList();
  overlay.style.zIndex = String(getNextZ());
  overlay.classList.add('open');
  resetDistCountryFilterModalPosition();
}

function closeDistCountryFilterModal() {
  var overlay = document.getElementById('dist-country-filter-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

function selectDestCountryFilter(value) {
  destCountryFilter = value;
  saveDestCountryFilterToCookie(value);
  updateDistCountryFilterBtnLabel();
  closeDistCountryFilterModal();
  renderNightsDistribution();
  // 到着地選択モーダル(🏁列から開かれた場合を含む)が開いている場合は、
  // その都市一覧テーブルにも同じフィルタを即座に反映する。
  var endCityPickerOverlay = document.getElementById('end-city-picker-modal-overlay');
  if (endCityPickerOverlay && endCityPickerOverlay.classList.contains('open')) {
    renderEndCityPickerTable();
  }
}

function computeDestinationNightsDistribution(start, hubRadiusKm, maxDailyKm, countryFilter) {
  return CITIES.filter(function(c) {
    if (c.label === start.name) return false;
    if (countryFilter && c.country !== countryFilter) return false;
    return true;
  }).map(function(c) {
    var end = { name: c.label, lat: c.lat, lon: c.lon };
    var candidates = buildCandidates(start, end, HERITAGE_POINTS, 300).filter(function(x) { return x.detour <= 20; });
    var nights = computePlanNights(start, end, candidates, hubRadiusKm, maxDailyKm);
    return { city: c.label, cityName: c.name, nights: nights, flag: c.flag || '' };
  });
}

var NIGHTS_BUCKETS = [
  { label: '日帰り圏(0泊)', min: 0, max: 0 },
  { label: '1泊2日', min: 1, max: 1 },
  { label: '2泊3日', min: 2, max: 2 },
  { label: '3泊4日', min: 3, max: 3 },
  { label: '4泊5日', min: 4, max: 4 },
  { label: '5泊以上', min: 5, max: Infinity },
];

function bucketByNights(distribution) {
  return NIGHTS_BUCKETS.map(function(b) {
    return { label: b.label, cities: distribution.filter(function(d) { return d.nights >= b.min && d.nights <= b.max; }) };
  });
}

var esc = function(s) { return String(s||'').replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };

var state = { selected: {} };
// ルート順序セクションの各ボタン(#route-line)をトグルした際の一時的な除外状態。
// state.selectedとは別管理: 距離・時間ロスや宿泊プランの計算には影響させず、
// 巡回テスト(#tour-mini-canvas/#tour-globe-canvas)の巡回対象からのみ
// 一時的に外す(テスト時に特定の地点だけスキップしたい場合の補助)。
var routeLineExcluded = {};

// 現在ON状態(routeLineExcludedで除外されていない)の世界遺産のみを、巡回順(tourPoints順)に
// heritage_masterの4桁IDで並べた配列。出発地・到着地(idを持たない都市)は含まれない。
// tourPointsが再計算される箇所(syncMiniGlobe内)から必ずupdateCurrentTourActiveHeritageIds()
// を呼んで同期させること。この配列は「経由データを保存」ボタン(#save-waypoint-set-btn)の
// waypoint_heritage_ids生成に使う。
var currentTourActiveHeritageIds = [];

function updateCurrentTourActiveHeritageIds() {
  currentTourActiveHeritageIds = tourPoints
    .filter(function(p) { return !!p.id; })
    .map(function(p) { return p.id; });
  updateSaveWaypointSetButton();
}

// 「宿泊地の推奨プラン」セクションの検索モーダルから手動で追加した世界遺産。
// buildCandidates()のdetour範囲フィルタを無視して常に候補・選択済みに含める。
var manuallyAddedPoints = {};

// 出発地・到着地(#start-city/#end-city)の選択をCookieに保存し、ページ再読み込み時に
// 再現するための定数・純粋関数群。値はCITIES上の一意なname(英語識別子、<select>のvalue)
// をそのまま保存する。CITIES上に存在しない値(過去に削除された都市名等)を復元してしまうと
// getCity()がundefinedを返し以降の処理が例外になるため、復元前に必ずisValidCityName()で
// 検証し、無効ならデフォルト(Paris/Rome)にフォールバックする。
var START_CITY_COOKIE = 'heritage_journey_start_city';
var END_CITY_COOKIE = 'heritage_journey_end_city';

function isValidCityName(name) {
  return CITIES.some(function(c) { return c.name === name; });
}

function saveStartEndCityToCookie() {
  var startSel = document.getElementById('start-city');
  var endSel = document.getElementById('end-city');
  if (!startSel || !endSel) return;
  document.cookie = START_CITY_COOKIE + '=' + encodeURIComponent(startSel.value) + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
  document.cookie = END_CITY_COOKIE + '=' + encodeURIComponent(endSel.value) + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
}

function populateCitySelects() {
  var startSel = document.getElementById('start-city');
  var endSel = document.getElementById('end-city');
  var opts = CITIES.map(function(c) { return '<option value="' + esc(c.name) + '">' + esc(c.label) + '</option>'; }).join('');
  startSel.innerHTML = opts;
  endSel.innerHTML = opts;
  var savedStart = getCookieValue(START_CITY_COOKIE);
  var savedEnd = getCookieValue(END_CITY_COOKIE);
  startSel.value = (savedStart && isValidCityName(savedStart)) ? savedStart : 'Paris';
  endSel.value = (savedEnd && isValidCityName(savedEnd)) ? savedEnd : 'Rome';
  updateEndCityPickerBtnLabel();
}

// #end-cityはネイティブ<select>のまま(display:none)でDOM上に残し、値/changeイベントの
// 挙動は既存コードのために一切変更しない。見た目だけを「都市名を表示するボタン」に
// 差し替え、押すと#end-city-picker-modal-overlayの一覧テーブル(最上位レイヤー)を開く。
function updateEndCityPickerBtnLabel() {
  var endSel = document.getElementById('end-city');
  var btn = document.getElementById('end-city-picker-btn');
  if (!endSel || !btn) return;
  var c = getCity(endSel.value);
  btn.textContent = c ? c.label : endSel.value;
}

// #start-cityはネイティブ<select>のまま(display:none)でDOM上に残し、値/changeイベントの
// 挙動は既存コードのために一切変更しない。見た目だけを「都市名を表示するボタン」に
// 差し替え、押すと#start-city-picker-modal-overlayの一覧テーブル(最上位レイヤー)を開く。
// #end-city-picker-btn/updateEndCityPickerBtnLabel()と同じ構造。
function updateStartCityPickerBtnLabel() {
  var startSel = document.getElementById('start-city');
  var btn = document.getElementById('start-city-picker-btn');
  if (!startSel || !btn) return;
  var c = getCity(startSel.value);
  btn.textContent = c ? c.label : startSel.value;
}

// 「出発地を選択」モーダルで駅/空港(CITIESに存在しない仮想エントリ)を選んだ場合の
// フォールバック用ルックアップ。extraPickerCitiesはこのファイル後方で定義される
// (「出発地」ボタンのセクション)が、varのホイスティングにより参照時点では
// 必ず初期化済み({})になっている。
function getCity(name) {
  var c = CITIES.filter(function(c){return c.name===name;})[0];
  if (c) return c;
  return (typeof extraPickerCities !== 'undefined') ? extraPickerCities[name] : undefined;
}

function currentStartEnd() {
  var s = getCity(document.getElementById('start-city').value);
  var e = getCity(document.getElementById('end-city').value);
  return {
    start: { name: s.label, lat: s.lat, lon: s.lon, flag: s.flag || '', country: s.country || '' },
    end: { name: e.label, lat: e.lat, lon: e.lon, flag: e.flag || '', country: e.country || '' },
  };
}

// 「巡回ルートスコープ」(#tour-mini-head / #tour-scope-title)に表示する
// ラベル文字列を組み立てる純粋関数。出発地・到着地それぞれのCITIESレコード
// (getCity()の戻り値、flag/labelを含む)を受け取り「(国旗)出発地名 - (国旗)到着地名」
// を返す。いずれかの都市が解決できない(=CITIESに存在しない不正な値等)場合は、
// 実際のルート情報を出さずに元の静的表記「🌐 巡回テスト」へフォールバックする
// (中途半端な"undefined - パリ"のような表示を避けるため)。flagが個別に
// 欠けている場合はその都市の国旗だけを省略し、都市名は表示する。
function buildTourScopeLabel(startCity, endCity) {
  if (!startCity || !endCity) return '🌐 巡回テスト';
  var startFlag = startCity.flag || '';
  var endFlag = endCity.flag || '';
  return startFlag + startCity.label + ' - ' + endFlag + endCity.label;
}

// 巡回ルートスコープ(ミニ地球儀パネルの見出し#tour-mini-headと、
// 巡回テストモーダルのタイトル#tour-scope-title)を、現在の出発地/到着地
// セレクトの値に合わせて更新する。start-city/end-cityのどちらが変わっても
// (分布チップクリック、到着地選択モーダル、出発地セレクト変更のいずれ経由でも)
// 最終的にrecompute()を通るため、recompute()内から呼ぶことで全経路をカバーする。
function updateTourScopeHeaderLabel() {
  var startSel = document.getElementById('start-city');
  var endSel = document.getElementById('end-city');
  var startCity = startSel ? getCity(startSel.value) : null;
  var endCity = endSel ? getCity(endSel.value) : null;
  var label = buildTourScopeLabel(startCity, endCity);
  var miniHeadEl = document.getElementById('tour-mini-head');
  if (miniHeadEl) miniHeadEl.textContent = label;
  var modalTitleEl = document.getElementById('tour-scope-title');
  if (modalTitleEl) modalTitleEl.textContent = label;
}

// 出発地・到着地の組み合わせが heritage_journey_registered_routes テーブルに
// 未登録の場合のみ「ルート登録」ボタン(#register-route-btn)を有効化する。
// 登録済みなら非アクティブ、書き込み成功後はボタン自体をDOMから削除する。
//
// 【非同期レースガード】出発地/到着地は短時間に何度も変わりうる
// (入替ボタン・分布チップ・出発地/到着地選択モーダルの連続クリック等)。
// fetchの応答順序はリクエスト順序と一致する保証がないため、
// 古いリクエストの応答が新しいリクエストの応答より後に届くと、
// 最新の組み合わせに対するボタン状態が古い結果で上書きされてしまう
// (「ルート登録ボタンが出てこない」不具合の実際の原因の一つ)。
// このリポジトリの確立された規約(searchRequestSeq等)に倣い、
// リクエストごとに単調増加する連番を発行し、応答時点で最新でなければ
// 何もしない(=古い応答は無視する)ことでレースを解消する。
var registerRouteButtonReqSeq = 0;
// ボタンが無効化されている理由を、tooltip(title属性)でユーザーに明示する。
// 修正前は「既に登録済み」も「確認APIの通信・DBエラー」も同じ「押せない灰色ボタン」
// にしか見えず、ユーザーからは「登録できない不具合」として区別できなかった
// (Vienna→Paris等、実際には既に登録済みなだけの組み合わせがバグ報告される原因)。
function updateRegisterRouteButton() {
  var btn = document.getElementById('register-route-btn');
  if (!btn) return;
  var se = currentStartEnd();
  var mySeq = ++registerRouteButtonReqSeq;
  fetch('/api/heritage-journey/route-exists?start=' + encodeURIComponent(se.start.name) + '&end=' + encodeURIComponent(se.end.name))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (mySeq !== registerRouteButtonReqSeq) return;
      var btn2 = document.getElementById('register-route-btn');
      if (!btn2) return;
      if (data && data.error) {
        // route-existsがHTTPレベルでは成功(200)しつつDBエラー等をerrorフィールドで
        // 返す実装(サーバー側)のため、existsだけでなくerrorの有無も見て区別する。
        btn2.disabled = true;
        btn2.title = '登録状況の確認に失敗しました(' + data.error + ')。再読み込みして再度お試しください';
      } else if (data && data.exists) {
        btn2.disabled = true;
        btn2.title = 'この出発地・到着地の組み合わせは既に登録済みです';
      } else {
        btn2.disabled = false;
        btn2.title = '';
      }
    })
    .catch(function(err) {
      if (mySeq !== registerRouteButtonReqSeq) return;
      var btn2 = document.getElementById('register-route-btn');
      if (!btn2) return;
      btn2.disabled = true;
      btn2.title = '登録状況の確認に失敗しました(' + (err && err.message ? err.message : '通信エラー') + ')。再読み込みして再度お試しください';
    });
}

// APIレスポンス(/api/heritage-journey/registered-starts-for-destination)から
// 登録済み出発地名(ラベル文字列)のセットを組み立てる純粋関数。
// data.startsが配列でない場合(空レスポンス、null、フェッチ失敗時のフォールバック等)は
// 全て未登録扱いとして空のセットを返し、誤って登録済み扱い(misclassify)にしない。
function buildRegisteredStartsSet(data) {
  var set = {};
  if (!data || !Array.isArray(data.starts)) return set;
  data.starts.forEach(function(s) {
    if (typeof s === 'string' && s) set[s] = true;
  });
  return set;
}

// #start-city(出発地セレクト)の各<option>に、ロックされている到着地(#end-city)との
// 組み合わせがheritage_journey_registered_routesに登録済みかどうかを視覚的に示す。
// 登録済み: 薄緑色の塗りつぶし(#bbf7d0 / 文字色#064e3b、登録済みルートモーダルの
// ハイライトと同じ配色)。未登録: 薄緑色の中抜き枠(border:2px solid #bbf7d0、背景は透過)。
// これは「ルート登録ボタンが出てこない」判定バグ自体の修正ではなく、
// 出発地ごとの登録状態を目視で確認できるようにする診断/UX目的の表示。
function applyStartCityRegisteredIndicator(registeredStartsSet) {
  var startSel = document.getElementById('start-city');
  if (!startSel) return;
  var opts = startSel.options;
  for (var i = 0; i < opts.length; i++) {
    var opt = opts[i];
    var city = getCity(opt.value);
    var label = city ? city.label : opt.value;
    if (registeredStartsSet[label]) {
      opt.className = 'start-city-option-registered';
      opt.style.cssText = 'background:#bbf7d0;color:#064e3b;';
    } else {
      opt.className = 'start-city-option-unregistered';
      opt.style.cssText = 'background:transparent;border:2px solid #bbf7d0;';
    }
  }
}

// ロックされている到着地(#end-cityの現在値)を対象に、登録済み出発地一覧をAPIから
// 取得してapplyStartCityRegisteredIndicator()へ反映する。到着地の変更のたびに
// 呼び直すことで、常に「現在ロックされている到着地」に対する判定を表示する。
// fetch失敗時・レスポンス不正時は例外を投げず、全オプションを未登録扱いにフォールバックする。
// updateRegisterRouteButton()と同じ理由(非同期レース)で連番ガードを持つ。
// 開いている「出発地を選択」モーダルの一覧(#start-city-picker-table-body)にも
// 同じ登録状態を反映するため、応答が最新であればそちらの再描画も行う。
var startCityIndicatorReqSeq = 0;
function updateStartCityRegisteredIndicator() {
  var endSel = document.getElementById('end-city');
  if (!endSel) return;
  var endCity = getCity(endSel.value);
  var endLabel = endCity ? endCity.label : endSel.value;
  var mySeq = ++startCityIndicatorReqSeq;
  fetch('/api/heritage-journey/registered-starts-for-destination?end=' + encodeURIComponent(endLabel))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (mySeq !== startCityIndicatorReqSeq) return;
      lastRegisteredStartsSet = buildRegisteredStartsSet(data);
      applyStartCityRegisteredIndicator(lastRegisteredStartsSet);
      refreshStartCityPickerTableIfOpen();
    })
    .catch(function() {
      if (mySeq !== startCityIndicatorReqSeq) return;
      lastRegisteredStartsSet = {};
      applyStartCityRegisteredIndicator(lastRegisteredStartsSet);
      refreshStartCityPickerTableIfOpen();
    });
}

// 「出発地を選択」モーダル(#start-city-picker-table-body)で使う、直近に取得した
// 登録済み出発地セット。updateStartCityRegisteredIndicator()の応答が届くたびに更新される。
// モーダルを開いた時点でまだ応答が届いていない場合は空集合(=全て未登録扱い)として描画する。
var lastRegisteredStartsSet = {};

// 出発地/到着地のどちらかが変わった直後に必ずまとめて呼ぶための単一の入口。
// updateRegisterRouteButton()とupdateStartCityRegisteredIndicator()を個別に
// 呼び分けるとどちらかの呼び出し漏れ(=「ルート登録ボタンが出てこない」不具合の
// もう一つの原因)を生みやすいため、両端点が変わりうる全ての操作
// (出発地/到着地セレクトのchange、入替ボタン、分布チップ、出発地/到着地選択モーダルの
// 行クリック)からはこの関数だけを呼ぶことで経路を一本化する。
function refreshRouteRegistrationUi() {
  updateRegisterRouteButton();
  updateStartCityRegisteredIndicator();
}

// 「経由地: 1 0123, 2 0456, ...」形式の文字列を、現在ON状態の
// heritage_master ID配列(currentTourActiveHeritageIds、巡回順)から生成する。
function buildWaypointHeritageIdsString() {
  return currentTourActiveHeritageIds.map(function(id, i) { return (i + 1) + ' ' + id; }).join(', ');
}

// 現在のtourPoints(巡回テストスコープ、routeLineExcludedで除外中のものは含まない)を
// start→...→end の順に連結した総延長距離(km)。computeStatsのレグ距離合計と同じ考え方。
function computeCurrentTourTotalDistanceKm() {
  if (tourPoints.length < 2) return 0;
  var total = 0;
  for (var i = 1; i < tourPoints.length; i++) {
    total += haversineKm(tourPoints[i - 1].lat, tourPoints[i - 1].lon, tourPoints[i].lat, tourPoints[i].lon);
  }
  return total;
}

var waypointSetSaveToastTimer = null;
function showWaypointSetSaveToast(recordId) {
  var el = document.getElementById('waypoint-set-save-toast');
  if (!el) return;
  el.style.zIndex = String(getNextZ());
  el.textContent = 'レコード' + recordId + 'にこの経由地が保存されました';
  el.style.display = 'block';
  if (waypointSetSaveToastTimer) clearTimeout(waypointSetSaveToastTimer);
  waypointSetSaveToastTimer = setTimeout(function() {
    el.textContent = '';
    el.style.display = 'none';
  }, 7000);
}

function showSaveWaypointSetError(message) {
  var el = document.getElementById('save-waypoint-set-error');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
}

function clearSaveWaypointSetError() {
  var el = document.getElementById('save-waypoint-set-error');
  if (!el) return;
  el.textContent = '';
  el.style.display = 'none';
}

// 出発地・到着地・現在ON状態の経由世界遺産ID配列(waypoint_heritage_ids)の組み合わせが
// heritage_journey_waypoint_setsテーブルに未保存の場合のみ「この経由データを保存」ボタンを
// 表示・有効化する。出発地・到着地の変更、ルート順序ON/OFFの切り替えのたびに再チェックする。
function updateSaveWaypointSetButton() {
  var btn = document.getElementById('save-waypoint-set-btn');
  if (!btn) return;
  if (tourPoints.length < 2 || currentTourActiveHeritageIds.length === 0) {
    btn.style.display = 'none';
    return;
  }
  var se = currentStartEnd();
  var waypointHeritageIds = buildWaypointHeritageIdsString();
  fetch('/api/heritage-journey/waypoint-set-exists?start=' + encodeURIComponent(se.start.name) +
    '&end=' + encodeURIComponent(se.end.name) +
    '&waypointHeritageIds=' + encodeURIComponent(waypointHeritageIds))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var btn2 = document.getElementById('save-waypoint-set-btn');
      if (!btn2) return;
      btn2.style.display = (data && data.exists) ? 'none' : '';
      btn2.disabled = false;
    })
    .catch(function() {
      var btn2 = document.getElementById('save-waypoint-set-btn');
      if (btn2) btn2.style.display = 'none';
    });
}

(function() {
  var saveBtn = document.getElementById('save-waypoint-set-btn');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', function() {
    var btn = document.getElementById('save-waypoint-set-btn');
    if (!btn) return;
    clearSaveWaypointSetError();
    var se = currentStartEnd();
    var waypointHeritageIds = buildWaypointHeritageIdsString();
    var totalDistanceKm = computeCurrentTourTotalDistanceKm();
    btn.disabled = true;
    fetch('/api/heritage-journey/save-waypoint-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startCityName: se.start.name, startLat: se.start.lat, startLon: se.start.lon,
        endCityName: se.end.name, endLat: se.end.lat, endLon: se.end.lon,
        waypointCount: currentTourActiveHeritageIds.length,
        waypointHeritageIds: waypointHeritageIds,
        totalDistanceKm: totalDistanceKm,
      }),
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.ok) {
          btn.style.display = 'none';
          showWaypointSetSaveToast(data.id);
        } else {
          btn.disabled = false;
          showSaveWaypointSetError((data && data.error) ? data.error : '保存に失敗しました');
        }
      })
      .catch(function() {
        btn.disabled = false;
        showSaveWaypointSetError('保存に失敗しました');
      });
  });
})();

function showRegisterRouteError(message) {
  var el = document.getElementById('register-route-error');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
}

function clearRegisterRouteError() {
  var el = document.getElementById('register-route-error');
  if (!el) return;
  el.textContent = '';
  el.style.display = 'none';
}

(function() {
  var registerBtn = document.getElementById('register-route-btn');
  if (!registerBtn) return;
  registerBtn.addEventListener('click', function() {
    var btn = document.getElementById('register-route-btn');
    if (!btn) return;
    clearRegisterRouteError();
    var se = currentStartEnd();
    btn.disabled = true;
    fetch('/api/heritage-journey/register-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: se.start.name, end: se.end.name,
        startLat: se.start.lat, startLon: se.start.lon,
        endLat: se.end.lat, endLon: se.end.lon,
      }),
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.ok) {
          btn.remove();
          updateStartCityRegisteredIndicator();
        } else {
          btn.disabled = false;
          showRegisterRouteError((data && data.error) ? data.error : '登録に失敗しました');
        }
      })
      .catch(function() {
        btn.disabled = false;
        showRegisterRouteError('登録に失敗しました');
      });
  });
})();

function renderCandidates() {
  var se = currentStartEnd();
  var maxDetour = Number(document.getElementById('opt-detour').value) || 150;
  var candidates = buildCandidates(se.start, se.end, HERITAGE_POINTS, maxDetour);
  var listEl = document.getElementById('cand-list');
  if (!candidates.length) {
    listEl.innerHTML = '<div class="empty-note">この2都市間・この迂回許容距離では候補がありません。</div>';
    document.getElementById('cand-count').textContent = '';
    return candidates;
  }
  listEl.innerHTML = candidates.map(function(c) {
    // 経由地候補の初期値: 「すべて解除」を基準に、空港と城のみ既定でON
    // (駅・世界遺産(城以外)は既定OFF)。トグルボタン(#toggle-stations-btn等)の
    // 初期状態「すべて解除/駅OFF/空港ON/城ON」と一致させる。
    var checked = state.selected[c.name] !== undefined ? state.selected[c.name] : (!!c.airportCode || c.icon === '🏰');
    state.selected[c.name] = checked;
    var networkButton = c.airportCode ? '<button type="button" class="airport-network-btn' + ((c.airportRoutes && c.airportRoutes.length) ? ' has-data' : '') + '" data-airport-network="' + esc(c.airportCode) + '">発着便・航空会社</button>' : '';
    return '<div class="cand-row"><input type="checkbox" data-cand="' + esc(c.name) + '"' + (checked ? ' checked' : '') + '>' +
      '<span class="cname">' + esc(c.icon) + ' ' + esc(c.name) + '</span>' + networkButton + '<span class="cdetour">迂回 ' + c.detour.toFixed(1) + 'km</span></div>';
  }).join('');
  document.getElementById('cand-count').textContent = candidates.length + ' 件中 ' + candidates.filter(function(c){return state.selected[c.name];}).length + ' 件選択中';
  listEl.querySelectorAll('[data-cand]').forEach(function(cb) {
    cb.addEventListener('change', function() { state.selected[cb.getAttribute('data-cand')] = cb.checked; recompute(); });
  });
  listEl.querySelectorAll('[data-airport-network]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      showAirportNetworkModal(HERITAGE_POINTS.find(function(p) { return p.airportCode === btn.getAttribute('data-airport-network'); }));
    });
  });
  return candidates;
}

function showAirportNetworkModal(point) {
  if (!point) return;
  document.getElementById('airport-network-modal-title').textContent = '✈️ ' + point.n + ' (' + point.airportCode + ') の発着便';
  var routes = point.airportRoutes || [];
  document.getElementById('airport-network-table-body').innerHTML = routes.length ? routes.map(function(r) {
    return '<tr><td>' + esc(r.direction) + '</td><td>' + esc(r.flag + ' ' + r.country) + '</td><td>' + esc(r.airline) + '<span class="airport-network-code">' + esc(r.iata) + '</span></td><td>' + esc(r.hubName) + '<span class="airport-network-code">' + esc(r.hubCode) + '</span></td><td>' + esc(r.destinationName) + '<span class="airport-network-code">' + esc(r.destinationCode) + '</span></td><td>' + esc(r.flightsPerWeek) + '便/週</td></tr>';
  }).join('') : '<tr><td colspan="6" class="empty-note">airline-networkに登録された発着便はありません。</td></tr>';
  document.getElementById('airport-network-modal-overlay').style.display = 'flex';
}
document.getElementById('airport-network-modal-close').addEventListener('click', function() { document.getElementById('airport-network-modal-overlay').style.display = 'none'; });
document.getElementById('airport-network-modal-overlay').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });

function renderSummary(stats) {
  var grid = document.getElementById('summary-grid');
  function stat(label, value, isLoss) {
    return '<div class="stat' + (isLoss ? ' loss' : '') + '"><div class="label">' + esc(label) + '</div><div class="value">' + value + '</div></div>';
  }
  grid.innerHTML =
    stat('経由地数', stats.stopCount + ' 件') +
    stat('直行距離', stats.directKm.toFixed(0) + ' km') +
    stat('総合距離', stats.totalKm.toFixed(0) + ' km') +
    stat('距離ロス', '+' + stats.extraKm.toFixed(0) + ' km (' + stats.extraPct.toFixed(0) + '%)', true) +
    stat('追加移動時間', stats.extraHours.toFixed(1) + ' h', true) +
    stat('見学時間(合計)', stats.visitHours.toFixed(1) + ' h', true) +
    stat('時間ロス合計', stats.totalAddedHours.toFixed(1) + ' h', true);
}

function renderNightsDistribution() {
  var se = currentStartEnd();
  var hubRadiusKm = Number(document.getElementById('opt-hub').value) || 45;
  var maxDailyKm = Number(document.getElementById('opt-daily').value) || 350;
  var countryFilter = (destCountryFilter !== DEST_COUNTRY_FILTER_ALL) ? destCountryFilter : null;
  var distribution = computeDestinationNightsDistribution(se.start, hubRadiusKm, maxDailyKm, countryFilter);
  var buckets = bucketByNights(distribution);
  var maxCount = 1;
  buckets.forEach(function(b) { if (b.cities.length > maxCount) maxCount = b.cities.length; });
  var el = document.getElementById('nights-dist');
  el.innerHTML = buckets.map(function(b, i) {
    var pct = (b.cities.length / maxCount * 100);
    var isEmpty = b.cities.length === 0;
    var rowClass = 'dist-row' + (isEmpty ? ' dist-row-empty' : '');
    return '<div class="' + rowClass + '" data-bucket="' + i + '">' +
      '<span class="dist-label">' + esc(b.label) + '</span>' +
      '<div class="dist-bar-track"><div class="dist-bar" style="width:' + pct + '%"></div></div>' +
      '<span class="dist-count">' + b.cities.length + '件</span>' +
      '</div><div class="dist-cities" id="dist-cities-' + i + '" style="display:none"></div>';
  }).join('');
  el.querySelectorAll('.dist-row').forEach(function(row) {
    // 該当件数が0件のバケット行はクリックしても展開する都市が存在しないため、
    // 見た目のグレーアウト(.dist-row-empty)に加えクリックリスナー自体を
    // アタッチしない(見た目だけに頼らず確実に無効化する)。
    if (row.classList.contains('dist-row-empty')) return;
    row.addEventListener('click', function() {
      var idx = Number(row.getAttribute('data-bucket'));
      var citiesEl = document.getElementById('dist-cities-' + idx);
      var willOpen = citiesEl.style.display === 'none';
      el.querySelectorAll('.dist-cities').forEach(function(c) { c.style.display = 'none'; });
      if (!willOpen) return;
      citiesEl.style.display = 'flex';
      var bucketCities = buckets[idx].cities.slice().sort(function(a, b2) { return a.nights - b2.nights; });
      citiesEl.innerHTML = bucketCities.length
        ? bucketCities.map(function(d) {
            var flagPrefix = d.flag ? esc(d.flag) + ' ' : '';
            return '<button type="button" class="dist-city-chip" data-city="' + esc(d.cityName) + '">' + flagPrefix + esc(d.city) + '(' + d.nights + '泊)</button>';
          }).join('')
        : '<span class="empty-note">該当する目的地はありません。</span>';
      citiesEl.querySelectorAll('[data-city]').forEach(function(chip) {
        chip.addEventListener('click', function() {
          document.getElementById('end-city').value = chip.getAttribute('data-city');
          updateEndCityPickerBtnLabel();
          state.selected = {};
          renderCandidates();
          recompute();
          refreshRouteRegistrationUi();
        });
      });
    });
  });
}

function renderSlackNote(se, currentNights, hubRadiusKm, maxDailyKm) {
  var el = document.getElementById('slack-note');
  var defaultCandidates = buildCandidates(se.start, se.end, HERITAGE_POINTS, 300).filter(function(x) { return x.detour <= 20; });
  var defaultNights = computePlanNights(se.start, se.end, defaultCandidates, hubRadiusKm, maxDailyKm);
  if (currentNights < defaultNights) {
    el.innerHTML = '<div class="slack-note">🕒 既定プラン(迂回20km以内をすべて選択)では ' + defaultNights + ' 泊でしたが、現在の選択では ' + currentNights + ' 泊です。'
      + '行かない場所を選んだことで ' + (defaultNights - currentNights) + ' 泊分の時間的な余裕が生まれています。</div>';
  } else {
    el.innerHTML = '';
  }
}

// #route-lineの国別フィルタで選ばれている国名。ROUTE_COUNTRY_FILTER_ALLは
// 「すべて(デフォルト)」を表す特別値で、この時はグレーアウトを行わない。
var ROUTE_COUNTRY_FILTER_ALL = '__ALL__';
var routeCountryFilter = ROUTE_COUNTRY_FILTER_ALL;

// 設定ページ「世界遺産の巡回ルート処理時に国別フィルタを適用する/しない」の値。
// D1優先→Cookie→デフォルト(する)で解決済みの値がサーバー側から埋め込まれる。
// これがfalseの場合、#route-country-filterで国を選んでいても
// 「🎬巡回ルートを再現する🌏」実行時のデータからは除外しない(設定ページの
// OFFのほうが強制力が上のため)。その際は薄ピンク色のトーストで設定変更を促す。
var HERITAGE_TOUR_COUNTRY_FILTER_ENABLED = ${heritageTourCountryFilterEnabledJs};

function renderRouteLine(ordered) {
  document.getElementById('route-line').innerHTML = ordered.map(function(p, idx) {
    var off = !!routeLineExcluded[p.name];
    var country = p.country || '';
    var flag = p.flag || '';
    // 出発地(先頭行)・到着地(最終行)はルートの起点・終点であり巡回テストから
    // 除外する対象になり得ないため、ON/OFFトグルバッジ(button.wp-badge)は
    // 描画せず、非interactiveな固定マーカー(.wp-badge-fixed)として名称・
    // アイコンのみ表示する。中間の経由地は従来通りトグル可能なbuttonにする。
    // 出発地は📍、到着地は🏁のアイコンで区別する(中間地点はp.icon)。
    var isFirst = idx === 0;
    var isLast = idx === ordered.length - 1;
    var isEndpoint = isFirst || isLast;
    var icon = isEndpoint ? (isFirst ? '📍' : '🏁') : (p.icon || '📍');
    var flagHtml = flag ? '<span class="wp-flag" title="' + esc(country) + '">' + esc(flag) + '</span>' : '';
    // 表示順: 中間の経由地は「→ 国旗 アイコン(名称)」(国旗が矢印の直後)。
    // 固定マーカー(出発地・到着地)はアイコン(📍/🏁)を先頭に保ったまま
    // 「アイコン 国旗 名称」の順にする(国旗を都市名の直前に移動)。
    var airportCode = p.airportCode ? ' <span class="airport-network-code">' + esc(p.airportCode) + '</span>' : '';
    var badgeHtml = isEndpoint
      ? '<span class="wp-badge wp-badge-fixed">' + esc(icon) + flagHtml + ' ' + esc(p.name) + airportCode + '</span>'
      : '<button type="button" class="wp-badge' + (off ? ' wp-badge-off' : '') + '" data-wp-name="' + esc(p.name) + '" title="タップで巡回テストから一時的に除外/復帰">'
        + esc(icon) + ' ' + esc(p.name) + airportCode + '</button>';
    return '<span class="route-line-item" data-wp-country="' + esc(country) + '" data-wp-item-name="' + esc(p.name) + '">'
      + (isEndpoint ? '' : flagHtml)
      + badgeHtml
      + '</span>';
  }).join('<span class="wp-arrow">→</span>');
  renderRouteCountryFilterDropdown(ordered);
  applyRouteCountryFilter();
}

/**
 * orderedの各地点(国旗が判明しているもののみ)を国名ごとに集計する純粋関数。
 * 出現順(先勝ち)を保持したまま件数降順でソートして返す。国名が空の地点
 * (国データが取得できなかった地点)は集計対象から除外する。
 */
function aggregateRouteCountryCounts(ordered) {
  var counts = {};
  var flags = {};
  var order = [];
  (ordered || []).forEach(function(p) {
    var country = p && p.country;
    if (!country) return;
    if (!(country in counts)) {
      counts[country] = 0;
      flags[country] = p.flag || '';
      order.push(country);
    }
    counts[country]++;
  });
  return order.map(function(country) {
    return { country: country, flag: flags[country], count: counts[country] };
  }).sort(function(a, b) { return b.count - a.count; });
}

/**
 * 「ルート順序」見出し右側の国フィルタドロップダウン(#route-country-filter)を
 * 現在のorderedから再構築する。先頭は常に「すべて(デフォルト)」、以降は
 * 出現回数の多い順に「国旗 (件数)」を並べる。現在選択中の国がルート変更で
 * 消えてしまった場合は「すべて(デフォルト)」へフォールバックする。
 */
function renderRouteCountryFilterDropdown(ordered) {
  var el = document.getElementById('route-country-filter');
  if (!el) return;
  var entries = aggregateRouteCountryCounts(ordered);
  if (routeCountryFilter !== ROUTE_COUNTRY_FILTER_ALL && !entries.some(function(e) { return e.country === routeCountryFilter; })) {
    routeCountryFilter = ROUTE_COUNTRY_FILTER_ALL;
  }
  var options = ['<option value="' + ROUTE_COUNTRY_FILTER_ALL + '"' + (routeCountryFilter === ROUTE_COUNTRY_FILTER_ALL ? ' selected' : '') + '>すべて(デフォルト)</option>'];
  entries.forEach(function(e) {
    var label = (e.flag ? e.flag : '') + ' (' + e.count + ')';
    options.push('<option value="' + esc(e.country) + '"' + (routeCountryFilter === e.country ? ' selected' : '') + '>' + esc(label) + '</option>');
  });
  el.innerHTML = options.join('');
}

/**
 * 現在のrouteCountryFilterに基づき#route-lineの各行のグレーアウトを適用/解除する。
 * 視覚的な減光(route-line-item-dimmedクラス)だけでなく、対象行のON/OFFバッジに
 * disabled属性を付与し実際に操作できないようにする(見た目だけの減光にしない)。
 * 巡回テストモーダル右側のルート順序サイドパネル(#tour-route-side-list)にも同じ
 * グレーアウトを反映するため、renderRouteSidePanel()を再描画して同期させる
 * (モーダル/サイドパネルが開いたままフィルタ選択を変更した場合もこのタイミングで
 * 呼ばれるためライブに更新される)。
 * 巡回テストモーダル本体の地球儀(#tour-globe-canvas)およびスコープの縮小
 * プレビュー(#tour-mini-canvas)上の各経由地点(drawWaypointPoint)にも同じ
 * グレーアウト(減光)を反映するため、renderAll()(定義済みであれば)を呼んで
 * 次フレームで再描画させる。アニメーション再生中(startAnimのintervalが
 * renderAll()を毎tick呼ぶ)であってもここで即時に反映しておくことで、
 * フィルタ変更直後の1フレーム分の表示遅延をなくす。renderAll()は#tour-globe-canvas
 * 要素の取得より後に定義される関数だが、function宣言のホイスティングにより
 * このスコープから呼び出し時点で参照可能。
 */
function applyRouteCountryFilter() {
  var el = document.getElementById('route-line');
  if (el) {
    var active = routeCountryFilter !== ROUTE_COUNTRY_FILTER_ALL;
    Array.from(el.querySelectorAll('.route-line-item')).forEach(function(item) {
      var country = item.getAttribute('data-wp-country') || '';
      var dim = active && country !== routeCountryFilter;
      item.classList.toggle('route-line-item-dimmed', dim);
      var btn = item.querySelector('[data-wp-name]');
      if (btn) {
        btn.disabled = dim;
        btn.setAttribute('aria-disabled', dim ? 'true' : 'false');
      }
    });
  }
  renderRouteSidePanel(state.lastOrdered || []);
  if (typeof renderAll === 'function') renderAll();
}

/**
 * 巡回テストモーダルの右側に表示するルート順序リスト。#route-lineと同じ
 * ordered(出発点から順)を縦に並べ、グレーアウト(routeLineExcluded)の
 * 状態も#route-lineと同じ見た目で反映する。行はupdateNextLabel()から
 * 「次の目的地」としてフォーカス表示(枠が薄黄色に点滅)される。
 * #route-lineと同じ表示ルールで、国旗(.wp-flag)はnum/checkboxより後・
 * アイコン(名称)より前に表示する。
 */
function renderRouteSidePanel(ordered) {
  var el = document.getElementById('tour-route-side-list');
  if (!el) return;
  // 地球儀上の丸に振られる番号(巡回対象=routeLineExcludedでない地点だけを
  // 順に数えたもの)と一致させるため、通し番号はグレーアウト中の地点を
  // 数えずに算出する。グレーアウト中の地点は地球儀上に丸が描かれない
  // (tourPointsから除外される)ため番号を振らない。
  // 国フィルタ(#route-country-filter)のグレーアウトは#route-lineと同じ
  // route-line-item-dimmedクラスで表現し、毎回の描画時に現在の
  // routeCountryFilterを読んで反映する(applyRouteCountryFilter()からも
  // 再描画を呼ぶことでフィルタ変更のライブ反映を両立する)。この減光は
  // 表示専用でtourPoints(実際の巡回アニメーション対象)には影響しない。
  var filterActive = routeCountryFilter !== ROUTE_COUNTRY_FILTER_ALL;
  var num = 0;
  el.innerHTML = ordered.map(function(p) {
    var off = !!routeLineExcluded[p.name];
    var label = off ? '-' : String(++num);
    var country = p.country || '';
    var flag = p.flag || '';
    var dim = filterActive && country !== routeCountryFilter;
    var airportHasData = !!p.airportCode && !!(p.airportRoutes && p.airportRoutes.length);
    return '<div class="tour-route-side-row' + (off ? ' off' : '') + (dim ? ' route-line-item-dimmed' : '') + (airportHasData ? ' airport-has-data' : '') + '" data-side-name="' + esc(p.name) + '" data-side-country="' + esc(country) + '" data-side-lat="' + p.lat + '" data-side-lon="' + p.lon + '"' + (p.airportCode ? ' data-side-airport-code="' + esc(p.airportCode) + '"' : '') + ' title="タップで地球儀上に名称を表示">'
      + '<span class="tour-route-side-num">' + esc(label) + '</span>'
      + '<input type="checkbox" class="tour-route-side-check" data-side-check-name="' + esc(p.name) + '"' + (off ? '' : ' checked') + (dim ? ' disabled aria-disabled="true"' : '') + ' title="OFFで巡回テストから一時的に除外">'
      + ' ' + (flag ? '<span class="wp-flag" title="' + esc(country) + '">' + esc(flag) + '</span>' : '')
      + esc(p.icon || '📍') + ' ' + esc(p.name)
      + (p.airportCode ? ' <span class="airport-network-code">' + esc(p.airportCode) + '</span>' : '') + '</div>';
  }).join('');
}

// ルート順序セクションのON/OFF切り替えが行われたら「適用する」ボタンを
// アクティブ化する。適用するとグレーアウト(routeLineExcluded)中の地点を
// state.selectedからも外し(距離・時間ロス・宿泊プランの計算対象から除外)、
// 適用後は次のON/OFF変更があるまでボタンを再び非アクティブに戻す。
var routeApplyDirty = false;

function updateRouteApplyButton() {
  var btn = document.getElementById('route-apply-btn');
  if (btn) btn.disabled = !routeApplyDirty;
}

/**
 * 指定した世界遺産名のグレーアウト(routeLineExcluded)状態をトグルする。
 * #route-lineのバッジタップ・サイドパネルのチェックボックスの両方から
 * 呼ばれる共通処理。OFFにすると地球儀上のその地点の丸が消え、
 * 巡回線もその地点を経由せず前後の地点を直接結ぶようになる
 * (syncMiniGlobe()がtourPointsから除外するため)。
 */
function toggleRouteLineExcluded(name) {
  routeLineExcluded[name] = !routeLineExcluded[name];
  var routeBtn = null;
  Array.from(document.querySelectorAll('#route-line [data-wp-name]')).forEach(function(b) {
    if (b.getAttribute('data-wp-name') === name) routeBtn = b;
  });
  if (routeBtn) routeBtn.classList.toggle('wp-badge-off', !!routeLineExcluded[name]);
  // グレーアウトの切り替えは番号の振り直し(地球儀上の丸の番号との一致)にも
  // 影響するため、サイドパネルは丸ごと再描画する。
  renderRouteSidePanel(state.lastOrdered || []);
  routeApplyDirty = true;
  updateRouteApplyButton();
  syncMiniGlobe();
}

document.getElementById('route-line').addEventListener('click', function(e) {
  var btn = e.target.closest('[data-wp-name]');
  if (!btn) return;
  // 国フィルタでグレーアウトされている行はdisabled属性で操作を止めているが、
  // 念のためイベントハンドラ側でも早期returnし、見た目だけの減光にならないようにする。
  if (btn.disabled) return;
  toggleRouteLineExcluded(btn.getAttribute('data-wp-name'));
});

(function() {
  var routeCountryFilterEl = document.getElementById('route-country-filter');
  if (!routeCountryFilterEl) return;
  routeCountryFilterEl.addEventListener('change', function() {
    routeCountryFilter = routeCountryFilterEl.value;
    applyRouteCountryFilter();
  });
})();

document.getElementById('route-apply-btn').addEventListener('click', function() {
  Object.keys(routeLineExcluded).forEach(function(name) {
    if (routeLineExcluded[name]) {
      state.selected[name] = false;
      delete routeLineExcluded[name];
    }
  });
  routeApplyDirty = false;
  updateRouteApplyButton();
  renderCandidates();
  recompute();
});

function visitChipHtml(name) {
  var on = state.selected[name] !== false;
  return '<button type="button" class="visit-chip' + (on ? '' : ' off') + '" data-visit="' + esc(name) + '">' + esc(name) + '</button>';
}

function renderDayPlan(ordered, days, availableNights) {
  var el = document.getElementById('day-plan');
  var durationEl = document.getElementById('day-plan-duration');
  if (!days.length) {
    el.innerHTML = '<div class="empty-note">ルートがありません。</div>';
    if (durationEl) durationEl.textContent = '';
    return;
  }
  var totalNights = days.reduce(function(s,d){return s+d.nights;}, 0);
  if (durationEl) durationEl.textContent = '(' + totalNights + '泊' + (totalNights + 1) + '日)';

  var rows = days.map(function(d, i) {
    var nightsLabel = d.nights > 0 ? (d.nights + '泊') : '(到着)';
    var visitsHtml = d.visits.length ? d.visits.map(visitChipHtml).join('') : '-';
    return '<tr><td>Day ' + (i+1) + '</td><td>' + esc(d.city) + (d.isHub ? ' <span style="color:#93c5fd">(拠点)</span>' : '') + '</td>' +
      '<td>' + d.km.toFixed(0) + ' km</td><td>' + nightsLabel + '</td><td>' + visitsHtml + '</td></tr>';
  }).join('');
  var html = '<table class="day-table"><thead><tr><th>日程</th><th>宿泊推奨地</th><th>その日の移動距離</th><th>宿泊数</th><th>訪問した経由地</th></tr></thead><tbody>' + rows + '</tbody></table>';

  var hubDays = days.filter(function(d){return d.isHub;});
  if (hubDays.length) {
    html += hubDays.map(function(d) {
      return '<div class="hub-note">🏨 ' + esc(d.city) + 'に' + d.nights + '泊し、日帰りで「' + esc(d.visits.join('・')) + '」を周遊することを推奨します(連泊のほうが移動が少なく効率的です)。</div>';
    }).join('');
  }

  if (availableNights != null && availableNights >= 0 && totalNights > availableNights) {
    var over = totalNights - availableNights;
    var ranked = rankRemovalCandidates(ordered);
    var suggestion = ranked.slice(0, Math.max(1, over * 2));
    html += '<div class="trim-box">現在の日程では ' + totalNights + ' 泊必要ですが、指定の宿泊数(' + availableNights + '泊)を ' + over + ' 泊超えています。' +
      '迂回コストが大きい(訪問効率が悪い)経由地から外すことをご検討ください:<ul>' +
      suggestion.map(function(s){return '<li>' + esc(s.name) + '(この地点だけで約' + s.cost.toFixed(0) + 'km余分)</li>';}).join('') +
      '</ul><button id="apply-trim-btn" type="button">上位候補を選択解除して再計算</button></div>';
  }

  el.innerHTML = html;
  el.querySelectorAll('.visit-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var name = chip.getAttribute('data-visit');
      var currentOn = state.selected[name] !== false;
      var nextOn = !currentOn;
      state.selected[name] = nextOn;
      chip.classList.toggle('off', !nextOn);
      renderCandidates();
      recompute();
    });
  });
  var applyBtn = document.getElementById('apply-trim-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', function() {
      var ranked = rankRemovalCandidates(ordered);
      var totalNightsNow = days.reduce(function(s,d){return s+d.nights;}, 0);
      var overNow = totalNightsNow - availableNights;
      ranked.slice(0, Math.max(1, overNow * 2)).forEach(function(s) { state.selected[s.name] = false; });
      renderCandidates();
      recompute();
    });
  }
}

function recompute() {
  var se = currentStartEnd();
  updateTourScopeHeaderLabel();
  var maxDetour = Number(document.getElementById('opt-detour').value) || 150;
  var speedKmh = Number(document.getElementById('opt-speed').value) || 70;
  var perSiteHours = Number(document.getElementById('opt-visit').value) || 0;
  var maxDailyKm = Number(document.getElementById('opt-daily').value) || 350;
  var hubRadiusKm = Number(document.getElementById('opt-hub').value) || 45;
  var nightsRaw = document.getElementById('opt-nights').value;
  var availableNights = nightsRaw === '' ? null : Number(nightsRaw);

  var candidates = buildCandidates(se.start, se.end, HERITAGE_POINTS, maxDetour);
  var selected = candidates.filter(function(c) { return state.selected[c.name]; });
  var ordered = cheapestInsertionOrder(se.start, se.end, selected);
  state.lastOrdered = ordered;
  var stats = computeStats(se.start, se.end, ordered, speedKmh, perSiteHours);
  renderSummary(stats);
  renderRouteLine(ordered);
  renderRouteSidePanel(ordered);
  var clusters = detectHubClusters(ordered, hubRadiusKm);
  var days = planOvernights(se.start, se.end, ordered, clusters, CITY_POINTS, maxDailyKm);
  renderDayPlan(ordered, days, availableNights);
  var currentNights = days.reduce(function(s, d) { return s + d.nights; }, 0);
  renderSlackNote(se, currentNights, hubRadiusKm, maxDailyKm);
  var countEl = document.getElementById('cand-count');
  if (countEl) countEl.textContent = candidates.length + ' 件中 ' + selected.length + ' 件選択中';
  updateTransportToggleButtons(candidates);
  var tourPlanSummaryEl = document.getElementById('tour-plan-summary');
  if (tourPlanSummaryEl) tourPlanSummaryEl.textContent = currentNights + '泊' + (currentNights + 1) + '日';

  // 巡回テストモーダルで「現在地の日程(◯日目)」「宿泊推奨地」を表示するための対応表。
  // dayVisitsに含まれない出発点・目的地自身は、それぞれ1日目の宿泊推奨地・
  // 最終日の目的地そのものとして扱う。
  dayNumberByName = {};
  lodgingCityByName = {};
  days.forEach(function(d, di) {
    d.visits.forEach(function(name) { dayNumberByName[name] = di + 1; lodgingCityByName[name] = d.city; });
  });
  dayNumberByName[se.start.name] = 1;
  lodgingCityByName[se.start.name] = days.length ? days[0].city : se.start.name;
  dayNumberByName[se.end.name] = days.length;
  lodgingCityByName[se.end.name] = se.end.name;

  // 日程上の宿泊推奨地を都市マスタの座標へ解決する。同じ都市で連泊する日は
  // 連続点を重ねず1点にまとめ、スコープの巡回線を「宿泊地間の移動」にする。
  lodgingRoutePoints = [];
  lodgingDayPoints = [];
  days.forEach(function(d) {
    var city = CITY_POINTS.find(function(c) { return c.name === d.city; });
    if (!city) return;
    lodgingDayPoints.push({ name: city.name, lat: city.lat, lon: city.lon });
    var previous = lodgingRoutePoints[lodgingRoutePoints.length - 1];
    if (!previous || previous.name !== city.name) {
      lodgingRoutePoints.push({ name: city.name, lat: city.lat, lon: city.lon });
    }
  });
  lodgingDayIndex = Math.min(lodgingDayIndex, Math.max(0, lodgingDayPoints.length - 1));

  syncMiniGlobe();
  renderLodgingRecommendModal();
}

function selectAllCandidates() {
  var se = currentStartEnd();
  var maxDetour = Number(document.getElementById('opt-detour').value) || 150;
  buildCandidates(se.start, se.end, HERITAGE_POINTS, maxDetour).forEach(function(c) { state.selected[c.name] = true; });
  renderCandidates(); recompute();
}
function selectNoneCandidates() {
  var se = currentStartEnd();
  var maxDetour = Number(document.getElementById('opt-detour').value) || 150;
  buildCandidates(se.start, se.end, HERITAGE_POINTS, maxDetour).forEach(function(c) { state.selected[c.name] = false; });
  renderCandidates(); recompute();
}
function selectNearCandidates() {
  var se = currentStartEnd();
  var maxDetour = Number(document.getElementById('opt-detour').value) || 150;
  buildCandidates(se.start, se.end, HERITAGE_POINTS, maxDetour).forEach(function(c) { state.selected[c.name] = c.detour <= 20; });
  renderCandidates(); recompute();
}
function updateTransportToggleButtons(candidates) {
  [
    { id: 'toggle-stations-btn', matches: function(c) { return !c.airportCode && c.icon === CLIENT_STATION_ICON; } },
    { id: 'toggle-airports-btn', matches: function(c) { return !!c.airportCode; } },
    { id: 'toggle-castles-btn', matches: function(c) { return !c.airportCode && c.icon === '🏰'; } },
  ].forEach(function(toggle) {
    var matching = candidates.filter(toggle.matches);
    var isOn = matching.length > 0 && matching.every(function(c) { return !!state.selected[c.name]; });
    document.getElementById(toggle.id).setAttribute('aria-pressed', isOn ? 'true' : 'false');
  });
}
function toggleTransportCandidates(buttonId, category) {
  var button = document.getElementById(buttonId);
  var turnOn = button.getAttribute('aria-pressed') !== 'true';
  var se = currentStartEnd();
  var maxDetour = Number(document.getElementById('opt-detour').value) || 150;
  buildCandidates(se.start, se.end, HERITAGE_POINTS, maxDetour).forEach(function(c) {
    var matches = category === 'airport' ? !!c.airportCode
      : category === 'castle' ? (!c.airportCode && c.icon === '🏰')
      : (!c.airportCode && c.icon === CLIENT_STATION_ICON);
    if (matches) state.selected[c.name] = turnOn;
  });
  renderCandidates(); recompute();
}
document.getElementById('select-all-btn').addEventListener('click', selectAllCandidates);
document.getElementById('select-none-btn').addEventListener('click', selectNoneCandidates);
document.getElementById('select-near-btn').addEventListener('click', selectNearCandidates);
document.getElementById('select-all-btn-modal').addEventListener('click', selectAllCandidates);
document.getElementById('select-none-btn-modal').addEventListener('click', selectNoneCandidates);
document.getElementById('select-near-btn-modal').addEventListener('click', selectNearCandidates);
document.getElementById('toggle-stations-btn').addEventListener('click', function() { toggleTransportCandidates('toggle-stations-btn', 'station'); });
document.getElementById('toggle-airports-btn').addEventListener('click', function() { toggleTransportCandidates('toggle-airports-btn', 'airport'); });
document.getElementById('toggle-castles-btn').addEventListener('click', function() { toggleTransportCandidates('toggle-castles-btn', 'castle'); });
/**
 * 現在の#route-country-filter選択状態に基づき、渡すべき地点(orderedのサブセット)を返す純粋関数。
 * routeCountryFilterがROUTE_COUNTRY_FILTER_ALLの場合、または設定ページの
 * 「世界遺産の巡回ルート処理時に国別フィルタを適用する」がOFFの場合はフィルタを適用せず
 * orderedをそのまま返す。設定がONかつ国が選択されている場合のみ、選択国以外の
 * (グレーアウトされている)地点を除外する。
 */
function filterTourPointsByRouteCountry(ordered, filterCountry, settingEnabled) {
  if (!settingEnabled) return ordered;
  if (!filterCountry || filterCountry === ROUTE_COUNTRY_FILTER_ALL) return ordered;
  return ordered.filter(function(p) { return (p.country || '') === filterCountry; });
}

function showRouteCountryFilterLockedToast() {
  var el = document.getElementById('route-country-filter-locked-toast');
  if (!el) return;
  el.style.zIndex = String(getNextZ());
  el.textContent = '設定ページで「世界遺産の巡回ルート処理時に国別フィルタを適用しない」になっているため、国別フィルタは巡回ルートの再現に反映されません。反映するには設定ページでこの設定をONにしてください。';
  el.style.display = 'block';
  setTimeout(function() {
    el.textContent = '';
    el.style.display = 'none';
  }, 7000);
}

document.getElementById('replay-tour-btn').addEventListener('click', function() {
  var ordered = state.lastOrdered || [];
  if (ordered.length < 2) return;
  if (routeCountryFilter !== ROUTE_COUNTRY_FILTER_ALL && !HERITAGE_TOUR_COUNTRY_FILTER_ENABLED) {
    showRouteCountryFilterLockedToast();
  }
  var filtered = filterTourPointsByRouteCountry(ordered, routeCountryFilter, HERITAGE_TOUR_COUNTRY_FILTER_ENABLED);
  if (filtered.length < 2) filtered = ordered;
  var payload = { points: filtered.map(function(p) { return { name: p.name, lat: p.lat, lon: p.lon }; }) };
  try {
    sessionStorage.setItem('heritageJourneyTour', JSON.stringify(payload));
  } catch (e) {
    return;
  }
  window.location.href = '/webgl-heritage';
});

/**
 * 「巡回テスト」モーダル: WebGLの本格的な地球儀(webgl-heritage)を使わず、
 * 必要な行き先の座標だけをcanvas上の簡易な正射影(orthographic)地球儀に
 * プロットし、モーダル内で出発点から目的地まで巡回できるようにする軽量版。
 * 別ページへ遷移せず、モーダルの中だけで完結する。
 */
  var overlay = document.getElementById('tour-modal-overlay');
  var closeBtn = document.getElementById('tour-modal-close');
  var canvas = document.getElementById('tour-globe-canvas');
  var playBtn = document.getElementById('tour-play-btn');
  var currentLabel = document.getElementById('tour-current-label');
  var nextLabel = document.getElementById('tour-next-label');
  var dayLabel = document.getElementById('tour-day-label');
  var tapLabel = document.getElementById('tour-tap-label');
  var tourTestBtn = document.getElementById('tour-test-btn');
  var miniPanel = document.getElementById('tour-mini-panel');
  var miniHead = document.getElementById('tour-mini-head');
  var miniCanvas = document.getElementById('tour-mini-canvas');
  var lodgingModal = document.getElementById('lodging-recommend-modal');
  var lodgingList = document.getElementById('lodging-recommend-list');
  var lodgingStatus = document.getElementById('lodging-recommend-status');
  var lodgingNextBtn = document.getElementById('lodging-next-day-btn');
  var tourAirportSummary = document.getElementById('tour-airport-summary');
  var tourAirportSummaryBody = document.getElementById('tour-airport-summary-body');
  var castleToggleBtn = document.getElementById('toggle-castles-btn');
  // 城の地球儀オーバーレイ表示は、経由地候補の「城ON/OFF」トグル(#toggle-castles-btn、
  // toggleTransportCandidates('toggle-castles-btn','castle')で駅/空港と同じ選択トグルとして
  // 動作する)と単一のボタン・単一の状態(aria-pressed)を共有する。以前はcastlesVisibleという
  // 別の真偽値で独立管理しており、選択状態のトグルとオーバーレイのトグルが同じボタンの
  // aria-pressedを競って上書きし合い、状態が食い違う不具合があったため、真偽値を廃止して
  // 常にDOM(aria-pressed、updateTransportToggleButtons()が実選択状態から都度算出する)を
  // 単一の真実として参照する。
  function isCastleOverlayOn() {
    return !!castleToggleBtn && castleToggleBtn.getAttribute('aria-pressed') === 'true';
  }

  var tourPoints = [];
  // 巡回ルートスコープでは、観光地点を結ぶのではなく日程表で算出した
  // 宿泊推奨地どうしを結ぶ。各都市は実際の都市座標で保持する。
  var lodgingRoutePoints = [];
  var lodgingDayPoints = [];
  var lodgingDayIndex = 0;
  var animProgress = 0; // 0..(tourPoints.length-1) の連続値。整数部=区間番号、小数部=区間内の進み具合
  var animTimer = null;
  var playing = false;
  var tourZoom = 1;
  var tourCenterLat = 0;
  var tourCenterLon = 0;
  var ZOOM_MIN = 0.5, ZOOM_MAX = 16;
  var pinchDist0 = 0;
  var tapLabelTimer = null; // タップされた宿泊予定地の丸の名称表示(7秒後に自動で消す)用タイマー
  var lastFocusedSideName = null; // 右側ルート順序リストで直前にフォーカスしていた地点名(変化時だけ点滅させるため)
  var dayNumberByName = {}; // recompute()で構築される「地点名→日程(◯日目)」対応表
  var lodgingCityByName = {}; // recompute()で構築される「地点名→宿泊推奨地」対応表

  // ===== 地表テクスチャ(webgl-heritageページと同じ/earth.jpgを流用) =====
  var earthImg = new Image();
  var earthImageData = null; // { data: Uint8ClampedArray, width, height } 相当
  var sphereCache = null;    // 直前に描画したImageData(zoom/中心が変わらない限り再利用)
  var sphereCacheKey = '';
  earthImg.onload = function() {
    var off = document.createElement('canvas');
    off.width = earthImg.naturalWidth || earthImg.width;
    off.height = earthImg.naturalHeight || earthImg.height;
    var offCtx = off.getContext && off.getContext('2d');
    if (!offCtx) return;
    offCtx.drawImage(earthImg, 0, 0);
    earthImageData = offCtx.getImageData(0, 0, off.width, off.height);
    sphereCache = null;
    renderAll();
  };
  earthImg.src = '/earth.jpg';

  /**
   * 中心座標(centerLat, centerLon)を正面に見た正射影投影。中心を出発点と
   * 目的地の中間座標に合わせることで、緯度方向もその中間点が画面中央に
   * 来るように球を回転させる(経度回転だけの単純な投影だと、中間点の緯度が
   * 高い/低い場合に中心からずれてしまうため)。
   */
  function project(lat, lon, centerLat, centerLon, R, cx, cy) {
    var latR = lat * Math.PI / 180;
    var lonR = (lon - centerLon) * Math.PI / 180;
    var lat0 = centerLat * Math.PI / 180;
    var x = R * Math.cos(latR) * Math.sin(lonR);
    var y = -R * (Math.cos(lat0) * Math.sin(latR) - Math.sin(lat0) * Math.cos(latR) * Math.cos(lonR));
    var z = Math.sin(lat0) * Math.sin(latR) + Math.cos(lat0) * Math.cos(latR) * Math.cos(lonR);
    return { x: cx + x, y: cy + y, visible: z > -0.05 };
  }

  function circularMeanLon(lonA, lonB) {
    var a = lonA * Math.PI / 180, b = lonB * Math.PI / 180;
    return Math.atan2((Math.sin(a) + Math.sin(b)) / 2, (Math.cos(a) + Math.cos(b)) / 2) * 180 / Math.PI;
  }

  /**
   * 出発点と目的地の中間座標を地球儀の中心にし、その2点がなるべく
   * モーダルの外側(円の縁)に近い位置に収まるズームレベルを自動算出する。
   */
  /**
   * 出発地・到着地の中間地点(centerLat/centerLon)を中心に、pointsの中で
   * その中心から最も離れている座標までの距離をスコープの半径とみなし、
   * その半径がbaseR(モーダル/スコープの描画半径)にちょうど収まるズームを返す。
   * pointsは出発地・到着地だけでなく、現在選択中の経由地候補(tourPoints)全体を渡す
   * ことで、経由地候補のON/OFFが切り替わるたびに半径・ズームが再計算される。
   */
  function computeInitialView(points, baseR) {
    var start = points[0], end = points[points.length - 1];
    var centerLat = (start.lat + end.lat) / 2;
    var centerLon = circularMeanLon(start.lon, end.lon);
    var maxDist = 0;
    points.forEach(function(p) {
      var pp = project(p.lat, p.lon, centerLat, centerLon, baseR, 0, 0);
      var d = Math.hypot(pp.x, pp.y);
      if (d > maxDist) maxDist = d;
    });
    var MARGIN = 0.97;
    var zoom = maxDist > 0.01 ? (baseR * MARGIN) / maxDist : 1;
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
    return { centerLat: centerLat, centerLon: centerLon, zoom: zoom };
  }

  /**
   * project()の逆変換(標準的な正射影投影の逆変換式、Snyderの地図投影公式)。
   * 画面上の1点(中心からの相対座標X,Y、半径1に正規化済み)から緯度経度を
   * 復元する。裏側(可視範囲外)ならnullを返す。
   */
  function unproject(X, Y, centerLat, centerLon) {
    var rho = Math.sqrt(X * X + Y * Y);
    if (rho > 1) return null;
    var lat0 = centerLat * Math.PI / 180;
    var lon0 = centerLon * Math.PI / 180;
    var c = Math.asin(Math.min(1, rho));
    var lat, lon;
    if (rho < 1e-6) {
      lat = lat0; lon = lon0;
    } else {
      var sinC = Math.sin(c), cosC = Math.cos(c);
      lat = Math.asin(cosC * Math.sin(lat0) + (Y * sinC * Math.cos(lat0)) / rho);
      lon = lon0 + Math.atan2(X * sinC, rho * cosC * Math.cos(lat0) - Y * sinC * Math.sin(lat0));
    }
    return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI };
  }

  /**
   * 球体表面に地表テクスチャ(/earth.jpg、webgl-heritageページと共通)を
   * ピクセル単位で貼り付ける(canvas 2Dにはメッシュ/UVマッピングが無いため、
   * 画面側の各ピクセルから緯度経度を逆算しテクスチャをサンプリングする
   * ソフトウェアレンダリング)。zoom/中心座標が変わらない限り結果を
   * キャッシュし、巡回アニメーション中の再描画では使い回す。
   */
  function renderSphereTexture(ctx, cx, cy, R, W, H) {
    var key = W + '|' + tourCenterLat + '|' + tourCenterLon + '|' + R;
    if (sphereCache && sphereCacheKey === key) {
      ctx.putImageData(sphereCache, 0, 0);
      return;
    }
    var out = ctx.createImageData(W, H);
    var src = earthImageData;
    var sw = src.width, sh = src.height;
    var x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W, Math.ceil(cx + R));
    var y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H, Math.ceil(cy + R));
    for (var py = y0; py < y1; py++) {
      for (var px = x0; px < x1; px++) {
        var X = (px - cx) / R;
        var Y = -(py - cy) / R;
        var ll = unproject(X, Y, tourCenterLat, tourCenterLon);
        if (!ll) continue;
        var u = 0.5 + ll.lon / 360;
        u = u - Math.floor(u);
        var v = Math.max(0, Math.min(1, 0.5 - ll.lat / 180));
        var sx = Math.min(sw - 1, Math.floor(u * sw));
        var sy = Math.min(sh - 1, Math.floor(v * sh));
        var sIdx = (sy * sw + sx) * 4;
        var dIdx = (py * W + px) * 4;
        out.data[dIdx] = src.data[sIdx];
        out.data[dIdx + 1] = src.data[sIdx + 1];
        out.data[dIdx + 2] = src.data[sIdx + 2];
        out.data[dIdx + 3] = 255;
      }
    }
    sphereCache = out;
    sphereCacheKey = key;
    ctx.putImageData(out, 0, 0);
  }

  function pointAtProgress(points, progress) {
    var clamped = Math.max(0, Math.min(points.length - 1, progress));
    var idx = Math.floor(clamped);
    var frac = clamped - idx;
    if (idx >= points.length - 1) return points[points.length - 1];
    var a = points[idx], b = points[idx + 1];
    return { lat: a.lat + (b.lat - a.lat) * frac, lon: a.lon + (b.lon - a.lon) * frac };
  }

  /**
   * 指定したcanvasへ地球儀を描画する。巡回テストモーダル本体(#tour-globe-canvas)と
   * 常時表示の縮小プレビュー(#tour-mini-canvas)の両方から呼び、同じ
   * tourPoints/tourCenterLat/tourCenterLon/tourZoom/animProgressを共有して
   * 同じ見た目を保つ(モーダルでズームやピンチ操作をすると縮小プレビュー側も追従する)。
   */
  /** 地球儀の中心座標・半径を算出する(描画とタップ判定の両方で同じ座標系を使うための共通処理)。 */
  function getGlobeGeometry(targetCanvas) {
    var W = targetCanvas.width, H = targetCanvas.height;
    var cx = W / 2, cy = H / 2;
    var margin = Math.min(W, H) <= 300 ? 12 : 24;
    var baseR = Math.min(W, H) / 2 - margin;
    var R = baseR * tourZoom;
    return { cx: cx, cy: cy, R: R };
  }

  /**
   * 与えられた点集合(lat/lonの平面座標とみなす)の近似凸包をAndrewのmonotone chain法で
   * 計算する。実データに国境(GeoJSON等)が存在しないため、選択国に属する候補点(都市・
   * 世界遺産・空港・駅)から「その国のおおまかな領域」を近似する目的でのみ使う
   * (球面上の測地線ではなく平面近似。1か国程度のスケールでは十分な近似)。
   * 3点未満、または全点が同一直線上(共線)の場合は面積を持つ凸包にならず
   * 2点以下に退化するため、呼び出し側(computeCountryOutlinePoints)で
   * バウンディングボックスへのフォールバックを行う。
   */
  function convexHull(points) {
    var uniq = [];
    var sorted = points.slice().sort(function(a, b) { return a.lon - b.lon || a.lat - b.lat; });
    sorted.forEach(function(p) {
      var last = uniq[uniq.length - 1];
      if (!last || last.lon !== p.lon || last.lat !== p.lat) uniq.push(p);
    });
    if (uniq.length < 3) return uniq;
    function cross(o, a, b) {
      return (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);
    }
    var lower = [];
    for (var i = 0; i < uniq.length; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], uniq[i]) <= 0) lower.pop();
      lower.push(uniq[i]);
    }
    var upper = [];
    for (var j = uniq.length - 1; j >= 0; j--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], uniq[j]) <= 0) upper.pop();
      upper.push(uniq[j]);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }

  /**
   * 候補点集合のmin/max(緯度・経度)をmargin度だけ外側に広げた矩形の4頂点を返す。
   * 凸包が退化する(候補点が2点以下、または共線)場合のフォールバックとして使う。
   */
  function boundingBoxPoints(points, margin) {
    var lats = points.map(function(p) { return p.lat; });
    var lons = points.map(function(p) { return p.lon; });
    var minLat = Math.min.apply(null, lats) - margin;
    var maxLat = Math.max.apply(null, lats) + margin;
    var minLon = Math.min.apply(null, lons) - margin;
    var maxLon = Math.max.apply(null, lons) + margin;
    return [
      { lat: minLat, lon: minLon },
      { lat: minLat, lon: maxLon },
      { lat: maxLat, lon: maxLon },
      { lat: maxLat, lon: minLon },
    ];
  }

  /**
   * 指定した国名(routeCountryFilterの値)に属する候補点(CITIES/HERITAGE_POINTS双方の
   * country/cフィールドが一致するもの)を集め、その凸包(近似の国境アウトライン)を返す。
   * 該当点が1件も無ければnull(描画側は何も描かない)。候補点が2点以下、または凸包が
   * 3点未満に退化した場合(共線)は、パディング付きバウンディングボックス(4頂点)に
   * フォールバックする(何も描かれない/エラーになるより、大まかな矩形が出る方が良い)。
   */
  function computeCountryOutlinePoints(country) {
    var pts = [];
    (typeof CITIES !== 'undefined' ? CITIES : []).forEach(function(c) {
      if (c.country === country) pts.push({ lat: c.lat, lon: c.lon });
    });
    (typeof HERITAGE_POINTS !== 'undefined' ? HERITAGE_POINTS : []).forEach(function(h) {
      if (h.c === country) pts.push({ lat: h.lat, lon: h.lon });
    });
    if (pts.length === 0) return null;
    if (pts.length <= 2) return boundingBoxPoints(pts, 0.5);
    var hull = convexHull(pts);
    if (hull.length < 3) return boundingBoxPoints(pts, 0.5);
    return hull;
  }

  /**
   * 投影済みの頂点列(project()の戻り値、visibleフラグ付き)を、地球儀裏側
   * (visible===false)の頂点を除いた「連続する可視区間」ごとの部分パスに分割する。
   * 裏側の頂点をそのまま含めて1本の閉じたポリゴンとして描画すると、画面上で
   * 頂点が中心付近に押しつぶされ自己交差した破綻図形になるため、裏側の頂点は
   * パスから除外し(暗く描くのではなく)、可視区間だけを開いた折れ線として描画する
   * 方針を採る。全頂点が可視の場合のみ、1本のセグメント(closePathで閉じるポリゴン)
   * として返す。全頂点が裏側の場合は空配列を返し、呼び出し側は何も描かない。
   */
  function buildOutlineSegments(projected) {
    var n = projected.length;
    if (n === 0) return [];
    var allVisible = projected.every(function(pp) { return pp.visible; });
    if (allVisible) return [projected.slice()];
    var segments = [];
    var current = [];
    for (var i = 0; i < n; i++) {
      var pp = projected[i];
      if (pp.visible) {
        current.push(pp);
      } else if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    }
    if (current.length > 0) segments.push(current);
    return segments;
  }

  /**
   * ルート順序セクションの国別フィルタ(#route-country-filter/routeCountryFilter)で
   * 「すべて」以外が選択されている場合、その国の近似アウトライン(中抜き・ストロークのみ)を
   * 地球儀上に描画する。ルート線(#38bdf8)・世界遺産の丸(#f9a8d4)・空港/駅グリフとは
   * 明確に区別できるよう、半透明の白(rgba(255,255,255,0.65))の破線で描く。
   * 全頂点可視の場合のみ閉じたポリゴン(closePath)にし、一部が地球儀裏側の場合は
   * buildOutlineSegments()で分割した開いた折れ線を描く(自己交差した破綻図形を防ぐため)。
   * strokeStyle/lineWidth/線ダッシュは描画前の値を保持し、描画後に必ず元へ戻す
   * (以降の描画呼び出し、特にdrawWaypointPointの丸描画に影響を残さないため)。
   */
  function drawCountryOutline(ctx, geo) {
    if (routeCountryFilter === ROUTE_COUNTRY_FILTER_ALL) return;
    var pts = computeCountryOutlinePoints(routeCountryFilter);
    if (!pts || pts.length < 3) return;
    var projected = pts.map(function(p) { return project(p.lat, p.lon, tourCenterLat, tourCenterLon, geo.R, geo.cx, geo.cy); });
    var allVisible = projected.every(function(pp) { return pp.visible; });
    var segments = buildOutlineSegments(projected);
    if (segments.length === 0) return;
    var prevStrokeStyle = ctx.strokeStyle;
    var prevLineWidth = ctx.lineWidth;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.5;
    if (ctx.setLineDash) ctx.setLineDash([5, 4]);
    segments.forEach(function(seg) {
      if (seg.length < 2) return;
      ctx.beginPath();
      seg.forEach(function(pp, i) { if (i === 0) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y); });
      if (allVisible && ctx.closePath) ctx.closePath();
      ctx.stroke();
    });
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.strokeStyle = prevStrokeStyle;
    ctx.lineWidth = prevLineWidth;
  }

  /**
   * 巡回テスト地球儀上の経由地点1件分を描画する。icon(空港✈︎/駅🚉/世界遺産の
   * カテゴリ絵文字🏰🏛️⛪🌿♨️🏭等、いずれもHeritageItem.e由来)がtruthyな文字列の
   * 場合は、種別を問わずその絵文字グリフをctx.fillTextで座標中心に直接描画する
   * (textAlign/textBaseline経由でcenter/middleに設定してから描画)。世界遺産の
   * カテゴリ絵文字は/webgl-heritageページの地球儀(el.textContent = d.e)と同じ
   * 絵文字を用いるため、両ページで一貫した見た目になる。iconが未指定/空文字の
   * 場合のみ、従来の薄ピンク色の丸(半径5)+通し番号ラベルにフォールバックする
   * (データ欠損時の防御的デフォルトであり、通常のデータフローでは発生しない)。
   * 絵文字はfillStyleの影響を受けない(ブラウザ既定の色で描画される)ため、裏側
   * (pp.visible===false)の減光はglobalAlphaの一時的な引き下げ(0.4)で行い、
   * 描画後は必ず元の値に復元する(以降の描画呼び出しに影響を残さないため)。
   *
   * ルート順序セクションの国別フィルタ(#route-country-filter/routeCountryFilter)が
   * 「すべて」以外を選択している場合、選択国と異なるtp.countryの地点はglobalAlphaを
   * さらに0.35倍して減光する(route-line-item-dimmedのopacity:.35と同じ濃さに揃える)。
   * 裏側減光(0.4)と国別フィルタ減光(0.35)は乗算で合成するため、両方に該当する地点は
   * どちらか一方のみの場合より必ず暗くなる(0.4*0.35=0.14)。tp省略時(country不明)は
   * 減光しない。この乗算合成ロジックはグリフ/丸どちらの分岐でも同一に適用される。
   */
  function drawWaypointPoint(ctx, pp, icon, i, tp) {
    var isScope = arguments.length > 5 && arguments[5] === true;
    var country = (tp && tp.country) || '';
    var countryDimmed = routeCountryFilter !== ROUTE_COUNTRY_FILTER_ALL && country !== routeCountryFilter;
    var countryAlphaFactor = countryDimmed ? 0.35 : 1;
    // 縮小スコープは空港(✈︎)だけをアイコンのまま残し、それ以外を小さな
    // ピンク丸に統一する。モーダル本体は従来のカテゴリ表示を維持する。
    var hasGlyph = typeof icon === 'string' && icon.length > 0 && (!isScope || icon === CLIENT_AIRPORT_ICON);
    if (hasGlyph) {
      var prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = (pp.visible ? 1 : 0.4) * countryAlphaFactor;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(icon, pp.x, pp.y);
      ctx.globalAlpha = countryAlphaFactor;
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = pp.visible ? '#e2e8f0' : '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText(String(i + 1), pp.x + 9, pp.y - 9);
      ctx.globalAlpha = prevAlpha;
    } else {
      var prevAlphaCircle = ctx.globalAlpha;
      ctx.globalAlpha = countryAlphaFactor;
      ctx.fillStyle = pp.visible ? '#f9a8d4' : '#475569';
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, isScope ? 3 : 5, 0, Math.PI * 2);
      ctx.fill();
      if (!isScope) {
        ctx.fillStyle = pp.visible ? '#e2e8f0' : '#64748b';
        ctx.font = '10px sans-serif';
        ctx.fillText(String(i + 1), pp.x + 7, pp.y - 7);
      }
      ctx.globalAlpha = prevAlphaCircle;
    }
  }

  function renderGlobeToCanvas(targetCanvas) {
    if (!targetCanvas || !targetCanvas.getContext) return;
    var ctx = targetCanvas.getContext('2d');
    var W = targetCanvas.width, H = targetCanvas.height;
    ctx.clearRect(0, 0, W, H);
    if (tourPoints.length === 0) return;
    var geo = getGlobeGeometry(targetCanvas);
    var cx = geo.cx, cy = geo.cy, R = geo.R;

    if (earthImageData) {
      // 地表テクスチャを球面に貼り付ける
      renderSphereTexture(ctx, cx, cy, R, W, H);
      ctx.strokeStyle = '#0b1220';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // テクスチャ読み込み中の暫定表示: 球体の輪郭と簡易緯線グリッド
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      [-60, -30, 0, 30, 60].forEach(function(lat) {
        var latR = (lat - tourCenterLat) * Math.PI / 180;
        var ellipseY = cy - R * Math.sin(latR);
        var ellipseRx = R * Math.cos(latR);
        ctx.beginPath();
        ctx.ellipse(cx, ellipseY, Math.max(ellipseRx, 0.01), Math.max(ellipseRx * 0.15, 0.01), 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
    }

    var isScope = targetCanvas === miniCanvas;
    var projected = tourPoints.map(function(p) { return project(p.lat, p.lon, tourCenterLat, tourCenterLon, R, cx, cy); });
    var routePoints = isScope && lodgingRoutePoints.length > 0 ? lodgingRoutePoints : tourPoints;
    var projectedRoute = routePoints.map(function(p) { return project(p.lat, p.lon, tourCenterLat, tourCenterLon, R, cx, cy); });

    // 経由地を結ぶルート線
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    projectedRoute.forEach(function(pp, i) { if (i === 0) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y); });
    ctx.stroke();

    // ルート順序セクションの国別フィルタで国が選択されている場合、その国の
    // 近似アウトライン(中抜き)を描画する(実データに国境データが無いため、
    // 候補点の凸包/バウンディングボックスによる近似。drawCountryOutline()参照)。
    drawCountryOutline(ctx, geo);

    // 「城ON/OFF」(経由地候補の選択トグルと同じ#toggle-castles-btn)がONの間、
    // 巡回テストに属する2つの地球儀だけへ全ての城座標を重ねる。モーダル本体では🏰、
    // 小さなスコープでは混雑を避けるため薄水色の半径3pxマーカーとして描き分ける。
    if (isCastleOverlayOn()) {
      HERITAGE_POINTS.filter(function(p) { return p.e === '🏰'; }).forEach(function(castle) {
        var cp = project(castle.lat, castle.lon, tourCenterLat, tourCenterLon, R, cx, cy);
        var castleAlpha = cp.visible ? 1 : 0.4;
        ctx.globalAlpha = castleAlpha;
        if (isScope) {
          ctx.fillStyle = '#bae6fd';
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🏰', cp.x, cp.y);
        }
      });
      ctx.globalAlpha = 1;
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    // 経由地点(宿泊予定地) - 空港✈︎/駅🚉/世界遺産のカテゴリ絵文字(🏰🏛️⛪🌿♨️🏭等)を
    // それぞれの座標に直接描画する(/webgl-heritageページの地球儀と同じ絵文字を用いる)。
    // アイコン情報が無い場合のみ薄ピンク色の丸+通し番号ラベルにフォールバックする。
    // 描画本体はdrawWaypointPoint()に切り出し、テストから直接呼び出して(裏側判定を
    // 含む)描画分岐を検証できるようにする。
    projected.forEach(function(pp, i) {
      var tp = tourPoints[i];
      drawWaypointPoint(ctx, pp, tp && tp.icon, i, tp, isScope);
    });

    // 宿泊推奨地は経由地点とは別レイヤーで、都市座標の中心に青い四角
    // (中心から上下左右4px)を描く。これにより宿泊地間の巡回線の節点も明瞭になる。
    if (isScope) {
      ctx.fillStyle = '#3b82f6';
      lodgingRoutePoints.forEach(function(p) {
        var lp = project(p.lat, p.lon, tourCenterLat, tourCenterLon, R, cx, cy);
        ctx.globalAlpha = lp.visible ? 1 : 0.4;
        if (ctx.fillRect) ctx.fillRect(lp.x - 4, lp.y - 4, 8, 8);
      });
      ctx.globalAlpha = 1;
    }

    // 現在位置マーカー(薄緑色の丸)。#tour-modal-overlayが開いて巡回ルートモーダル
    // 自体にフォーカスがある間は、再生ボタンによる経由地点間の連続アニメーション
    // (animProgress)に追従させる。モーダルを閉じて#tour-mini-panel(巡回ルート
    // スコープ)側にフォーカスが戻っているときだけ、宿泊推奨地モードの「次の1日へ」
    // 操作でその日の宿泊推奨都市の実座標へ直接移動する挙動にする(lodgingDayPointsは
    // 2地点以上のルートなら常に埋まるため、モーダルが開いていてもこちらを優先すると
    // 再生ボタンでanimProgressを進めてもマーカーが動かなく見える不具合になっていた)。
    var curPt = (overlay.classList.contains('open') ? null : lodgingDayPoints[lodgingDayIndex])
      || pointAtProgress(tourPoints, animProgress);
    var curProj = project(curPt.lat, curPt.lon, tourCenterLat, tourCenterLon, R, cx, cy);
    ctx.fillStyle = '#86efac';
    ctx.beginPath();
    ctx.arc(curProj.x, curProj.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function nearestPointIndex(progress) {
    return Math.round(Math.max(0, Math.min(tourPoints.length - 1, progress)));
  }

  function updateLabel() {
    var idx = nearestPointIndex(animProgress);
    var p = tourPoints[idx];
    if (!p) {
      currentLabel.textContent = '';
      if (dayLabel) dayLabel.textContent = '';
    } else {
      var flag = p.flag || '🏳️';
      var lodging = lodgingCityByName[p.name] || p.name;
      currentLabel.textContent = flag + ' / ' + lodging;
      if (dayLabel) {
        var dayNum = dayNumberByName[p.name];
        dayLabel.textContent = dayNum ? (dayNum + '日目') : '';
      }
    }
    updateNextLabel();
  }

  /**
   * 巡回中の「次の目的地」名を表示する。移動中の丸(現在位置マーカー)が
   * 次の地点に到着する(animProgressが整数値に達する)までは表示し続け、
   * 到着と同時に消す。
   */
  function updateNextLabel() {
    if (!nextLabel) return;
    var idxFloor = Math.min(Math.max(tourPoints.length - 1, 0), Math.max(0, Math.floor(animProgress)));
    var frac = animProgress - idxFloor;
    if (frac < 1e-6 || idxFloor >= tourPoints.length - 1) {
      nextLabel.textContent = '';
      updateRouteSideFocus(null);
      return;
    }
    var next = tourPoints[idxFloor + 1];
    nextLabel.textContent = next ? ('次の目的地: ' + next.name) : '';
    updateRouteSideFocus(next ? next.name : null);
  }

  /**
   * 右側のルート順序リスト(#tour-route-side-list)で「次の目的地」の行に
   * フォーカス(薄黄色の枠)を当てる。フォーカスが別の地点に移った瞬間だけ
   * 枠を3回点滅させる(同じ地点へのフォーカスが続く間は点滅させない)。
   */
  function updateRouteSideFocus(name) {
    var rows = document.querySelectorAll('#tour-route-side-list [data-side-name]');
    rows.forEach(function(row) { row.classList.remove('focused'); });
    if (!name) { lastFocusedSideName = null; return; }
    var changed = name !== lastFocusedSideName;
    lastFocusedSideName = name;
    var target = null;
    rows.forEach(function(row) { if (row.getAttribute('data-side-name') === name) target = row; });
    if (!target) return;
    target.classList.add('focused');
    if (changed) {
      target.classList.remove('blink');
      void target.offsetWidth; // アニメーションを再始動させるための強制リフロー
      target.classList.add('blink');
    }
  }

  /**
   * 指定した地点(lat/lon)の名称を、地球儀上のその座標の丸の真上に
   * ツールチップとして7秒間表示する(#tour-globe-canvasの丸をタップした時、
   * および右側ルート順序表示板の地点名をタップした時の両方から呼ぶ)。
   */
  function showTapLabel(point) {
    if (!tapLabel || !point) return;
    var geo = getGlobeGeometry(canvas);
    var pp = project(point.lat, point.lon, tourCenterLat, tourCenterLon, geo.R, geo.cx, geo.cy);
    // 見どころ回答キャッシュがあれば、ツールチップ内に開閉可能なアイコンを添える。
    // webglHeritage.ts(3D地球儀ページ)の本来の挙動と同じく、gemma回答(👀)と
    // llama回答(👁️)は互いに排他ではなく、同じ世界遺産で両方存在すれば
    // 両方のアイコンを独立してタップ可能な状態で並べる。無ければ従来通り
    // プレーンな地点名のみ(textContentと等価)を表示する。
    var mit = tourHeritageMitokoroShareId[point.name];
    var gemmaShareId = mit && mit.gemma;
    var llamaShareId = mit && mit.llama;
    var gemmaIcon = gemmaShareId ? ' <span id="tour-tap-mitokoro-gemma-btn" title="見どころ(gemma-4-26b-a4b-it)を表示">👀</span>' : '';
    var llamaIcon = llamaShareId ? ' <span id="tour-tap-mitokoro-llama-btn" title="見どころ(llama-3.3-70b-instruct-fp8-fast)を表示">👁️</span>' : '';
    tapLabel.innerHTML = esc(point.name) + gemmaIcon + llamaIcon;
    tapLabel.style.left = (pp.x / canvas.width * 100) + '%';
    tapLabel.style.top = (pp.y / canvas.height * 100) + '%';
    // CSSの.tour-tap-labelはdisplay:noneが既定のため、空文字ではスタイル
    // シートのdisplay:noneが適用されたままになり表示されない(実機バグの原因)。
    // 必ず非noneの値を明示的にインラインで設定する。
    tapLabel.style.display = 'block';
    if (gemmaShareId) {
      var mitGemmaBtn = document.getElementById('tour-tap-mitokoro-gemma-btn');
      if (mitGemmaBtn) {
        mitGemmaBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          openHeritageMitokoroModal('👀', point.name, gemmaShareId);
        });
      }
    }
    if (llamaShareId) {
      var mitLlamaBtn = document.getElementById('tour-tap-mitokoro-llama-btn');
      if (mitLlamaBtn) {
        mitLlamaBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          openHeritageMitokoroModal('👁️', point.name, llamaShareId);
        });
      }
    }
    // タップラベル自体の7秒自動非表示と、見どころモーダルの表示状態は独立している。
    // モーダルは別レイヤー(data-overlay)のため、ここでラベルを消してもモーダルは
    // 閉じない(ユーザーが読んでいる最中でも問題ない)。
    if (tapLabelTimer) clearTimeout(tapLabelTimer);
    tapLabelTimer = setTimeout(function() {
      tapLabel.textContent = '';
      tapLabel.style.display = 'none';
    }, 7000);
  }

  /** 地球儀またはルート行で選ばれた空港を、ルート順序小窓の同じ空港行まで移動する。 */
  function scrollAirportSideRowIntoView(point) {
    if (!point || !point.airportCode) return;
    var target = null;
    document.querySelectorAll('#tour-route-side-list [data-side-airport-code]').forEach(function(row) {
      if (row.getAttribute('data-side-airport-code') === point.airportCode) target = row;
    });
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    target.classList.remove('blink');
    void target.offsetWidth;
    target.classList.add('blink');
  }

  canvas.addEventListener('click', function(e) {
    if (tourPoints.length === 0 && !isCastleOverlayOn()) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var clickX = (e.clientX - rect.left) * scaleX;
    var clickY = (e.clientY - rect.top) * scaleY;
    var geo = getGlobeGeometry(canvas);
    var hitIdx = -1, hitDist = Infinity;
    tourPoints.forEach(function(p, i) {
      var pp = project(p.lat, p.lon, tourCenterLat, tourCenterLon, geo.R, geo.cx, geo.cy);
      var d = Math.hypot(pp.x - clickX, pp.y - clickY);
      if (d <= 14 && d < hitDist) { hitDist = d; hitIdx = i; }
    });
    // 「城ON/OFF」で重ねて描画された城(tourPointsに含まれないルート未選択の
    // 世界遺産)はtourPointsの一致判定だけでは検出できず、タップしても
    // ツールチップが出ない不具合があったため、表示中はここでも同じ半径14pxの
    // 判定を行い、tourPoints側より近ければそちらを優先してヒットさせる。
    var castleHit = null;
    if (isCastleOverlayOn()) {
      var castleHitDist = hitIdx >= 0 ? hitDist : Infinity;
      HERITAGE_POINTS.filter(function(p) { return p.e === '🏰'; }).forEach(function(castle) {
        var pp = project(castle.lat, castle.lon, tourCenterLat, tourCenterLon, geo.R, geo.cx, geo.cy);
        var d = Math.hypot(pp.x - clickX, pp.y - clickY);
        if (d <= 14 && d < castleHitDist) { castleHitDist = d; castleHit = castle; }
      });
      if (castleHit) hitIdx = -1; // tourPoints側より城が近ければそちらを優先する
    }
    if (castleHit) {
      showTapLabel({ name: castleHit.n, lat: castleHit.lat, lon: castleHit.lon });
    } else if (hitIdx >= 0) {
      showTapLabel(tourPoints[hitIdx]);
      scrollAirportSideRowIntoView(tourPoints[hitIdx]);
    }
  });

  document.getElementById('tour-route-side-list').addEventListener('click', function(e) {
    if (e.target.closest('[data-side-check-name]')) return; // チェックボックス操作はトグル専用のchangeリスナーに任せる
    var row = e.target.closest('[data-side-name]');
    if (!row) return;
    var lat = Number(row.getAttribute('data-side-lat'));
    var lon = Number(row.getAttribute('data-side-lon'));
    if (isNaN(lat) || isNaN(lon)) return;
    var point = tourPoints.find(function(p) { return p.name === row.getAttribute('data-side-name'); });
    showTapLabel(point || { name: row.getAttribute('data-side-name'), lat: lat, lon: lon });
    scrollAirportSideRowIntoView(point);
  });

  document.getElementById('tour-route-side-list').addEventListener('change', function(e) {
    var check = e.target.closest('[data-side-check-name]');
    if (!check) return;
    toggleRouteLineExcluded(check.getAttribute('data-side-check-name'));
  });

  // 宿泊地モード中(lodgingDayPoints.length>0)にstopAnim()を呼ぶと、
  // モーダルを開く際のopenTourModal()等から無条件に「▶ 再生」表示へ
  // 巻き戻ってしまい、実際にはplayBtn.disabled=trueのまま(renderLodgingRecommendModal
  // 参照)で見た目だけ押せそうに見える不具合があった。
  // さらに「巡回OFF（宿泊地モード）」は#tour-mini-panel(巡回ルートスコープ)側に
  // フォーカスがある(=#tour-modal-overlayが未オープン)場合の状態であり、
  // #tour-modal-overlay自体にフォーカスが移った(開いた)後は宿泊地モードの有無に
  // かかわらず通常の再生モードへ戻すべき。overlay.classList.contains('open')で
  // どちらにフォーカスがあるかを判定し、両方の状態を切り替えられるようにする
  // (呼び出し側のopenTourModal/closeTourModalは、stopAnim()より先にopenクラスの
  // 付け外しを行うことでこの判定を成立させている)。
  function stopAnim() {
    playing = false;
    if (animTimer) { clearInterval(animTimer); animTimer = null; }
    if (lodgingDayPoints.length && !overlay.classList.contains('open')) {
      playBtn.disabled = true;
      playBtn.textContent = '巡回OFF（宿泊地モード）';
    } else {
      playBtn.disabled = false;
      playBtn.textContent = '▶ 再生';
    }
  }

  function positionLodgingRecommendModal() {
    if (!lodgingModal || miniPanel.style.display === 'none') return;
    var rect = miniPanel.getBoundingClientRect();
    lodgingModal.style.left = Math.max(0, Math.min(window.innerWidth - lodgingModal.offsetWidth, rect.left)) + 'px';
    lodgingModal.style.top = Math.max(0, Math.min(window.innerHeight - lodgingModal.offsetHeight, rect.bottom + 8)) + 'px';
  }

  /** 巡回対象に空港が含まれる場合だけ、宿泊推奨地の下へコードと座標を一覧表示する。 */
  function renderTourAirportSummary() {
    if (!tourAirportSummary || !tourAirportSummaryBody) return;
    var airports = tourPoints.filter(function(p) { return !!p.airportCode; });
    tourAirportSummary.style.display = airports.length ? 'block' : 'none';
    tourAirportSummaryBody.innerHTML = airports.map(function(p) {
      return '<tr><td><strong>' + esc(p.airportCode) + '</strong></td><td>' + esc(p.name) + '</td>'
        + '<td class="tour-airport-coordinate">' + Number(p.lat).toFixed(4) + '</td>'
        + '<td class="tour-airport-coordinate">' + Number(p.lon).toFixed(4) + '</td></tr>';
    }).join('');
  }

  /** 日程表から解決済みの宿泊推奨都市を最上位パネルへ列挙する。 */
  function renderLodgingRecommendModal() {
    if (!lodgingModal) return;
    if (!lodgingDayPoints.length || miniPanel.style.display === 'none') {
      lodgingModal.style.display = 'none';
      // 宿泊地モードに入った際にplayBtn.disabled=trueへ切り替える処理はあるが、
      // 宿泊地モードを抜ける(この分岐に来る)側では従来disabledを戻す処理が
      // 一切無く、一度でも宿泊が必要なルートを経由すると以降ずっと再生ボタンが
      // 無効化されたまま(見た目は「▶ 再生」のままなのでクリックしても反応が
      // 無いだけに見える)不具合があった。ここで必ず再有効化する。
      playBtn.disabled = false;
      return;
    }
    lodgingModal.style.display = 'block';
    lodgingList.innerHTML = lodgingDayPoints.map(function(p, i) {
      return '<button type="button" class="lodging-recommend-city' + (i === lodgingDayIndex ? ' active' : '') + '" data-lodging-day="' + i + '">Day ' + (i + 1) + ' ' + esc(p.name) + '</button>';
    }).join('');
    var current = lodgingDayPoints[lodgingDayIndex];
    lodgingStatus.textContent = 'Day ' + (lodgingDayIndex + 1) + ' / ' + lodgingDayPoints.length + '　' + current.name;
    lodgingNextBtn.disabled = lodgingDayIndex >= lodgingDayPoints.length - 1;
    renderTourAirportSummary();
    // モード変更時は既存の連続巡回処理を必ずOFFにする。この時点でlodgingDayPointsは
    // 既に埋まっているため、stopAnim()自身がplayBtnの無効化・表示切り替えを行う。
    stopAnim();
    positionLodgingRecommendModal();
  }

  function selectLodgingDay(index) {
    lodgingDayIndex = Math.max(0, Math.min(lodgingDayPoints.length - 1, index));
    renderLodgingRecommendModal();
    renderAll();
  }

  lodgingNextBtn.addEventListener('click', function() { selectLodgingDay(lodgingDayIndex + 1); });
  lodgingList.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-lodging-day]');
    if (btn) selectLodgingDay(Number(btn.getAttribute('data-lodging-day')));
  });

  function startAnim() {
    if (tourPoints.length < 2) return;
    if (animProgress >= tourPoints.length - 1) animProgress = 0;
    playing = true;
    playBtn.textContent = '⏸ 一時停止';
    var STEP = 0.02;
    animTimer = setInterval(function() {
      animProgress += STEP;
      if (animProgress >= tourPoints.length - 1) {
        animProgress = tourPoints.length - 1;
        renderAll();
        updateLabel();
        stopAnim();
        return;
      }
      renderAll();
      updateLabel();
    }, 40);
  }

  playBtn.addEventListener('click', function() {
    if (playing) { stopAnim(); return; }
    startAnim();
  });

  /** モーダル本体と縮小プレビューを同じ状態で両方描画する。 */
  function renderAll() {
    renderGlobeToCanvas(canvas);
    if (miniPanel.style.display !== 'none') renderGlobeToCanvas(miniCanvas);
  }

  // 出発点・目的地(先頭・末尾)が変わった場合だけ中心・ズームを自動再計算する。
  // ルート内の途中の経由地の選択/解除だけで再計算が走るrecompute()のたびに
  // ユーザーが手動で操作したズーム/中心を巻き戻してしまわないための対策。
  var lastViewKey = '';

  /**
   * 常時表示の縮小プレビュー(#tour-mini-panel)を、現在の計算済みルート
   * (state.lastOrdered)に合わせて更新する。ルートが2地点未満(未計算)の
   * 場合はプレビュー自体を隠す。recompute()から呼ぶことで、候補選択や
   * 出発地・到着地の変更のたびに自動で追従する。
   */
  function syncMiniGlobe() {
    var ordered = state.lastOrdered || [];
    if (ordered.length < 2) {
      miniPanel.style.display = 'none';
      lodgingModal.style.display = 'none';
      tourPoints = [];
      updateCurrentTourActiveHeritageIds();
      return;
    }
    tourPoints = ordered
      .filter(function(p) { return !routeLineExcluded[p.name]; })
      .map(function(p) { return { name: p.name, lat: p.lat, lon: p.lon, flag: p.flag, id: p.id, icon: p.icon, country: p.country || '', airportCode: p.airportCode || '' }; });
    updateCurrentTourActiveHeritageIds();
    if (tourPoints.length < 2) {
      miniPanel.style.display = '';
      renderAll();
      updateLabel();
      return;
    }
    // 経由地候補のON/OFF切り替え(駅/空港/城トグル、個別チェックボックス等)で
    // tourPointsの構成(=スコープの半径計算対象)が変わるたびにスコープを再描画するため、
    // 出発地・到着地だけでなくtourPoints全体の座標をキーに含める
    // (以前は出発地・到着地のみで判定しており、候補選択を変えても半径が
    // 再計算されない不具合があった)。
    var viewKey = tourPoints.map(function(p) { return p.lat + ',' + p.lon; }).join('|');
    if (viewKey !== lastViewKey) {
      lastViewKey = viewKey;
      var baseR = Math.min(canvas.width, canvas.height) / 2 - 24;
      var initial = computeInitialView(tourPoints, baseR);
      tourCenterLat = initial.centerLat;
      tourCenterLon = initial.centerLon;
      tourZoom = initial.zoom;
      animProgress = 0;
    }
    miniPanel.style.display = '';
    renderAll();
    updateLabel();
    renderLodgingRecommendModal();
  }

  // 巡回ルートモーダル(#tour-modal-overlay)を開いた側の巡回ルートスコープ
  // (#tour-mini-panel、z-index:9998)・宿泊推奨地モーダル(#lodging-recommend-modal、
  // z-index:10001)・その中の空港一覧(#tour-airport-summary)を、モーダルの下位レイヤーに
  // 隠して閉じるまで操作できないようにする。#tour-modal-overlay自体は他のモーダルと
  // 異なりCSSの固定z-index(9999)しか持たず、宿泊推奨地モーダルの10001より低いままだと
  // 呼び出し元のパネルがモーダルより手前に残ってしまう不具合があったため、開くたびに
  // getNextZ()で最上位へ引き上げる(宿泊推奨地モーダルの固定値10001はgetNextZ()の
  // 走査対象外なので、その値を確実に上回るよう下限を設ける)。モーダルの半透明の
  // 背景(inset:0)がその下のパネル全体を覆うため、閉じてクラスが外れるまで
  // クリックも一切届かない(再びアクティブ化されるのはモーダルを閉じた時)。
  function openTourModal() {
    if (tourPoints.length < 2) return;
    overlay.style.zIndex = String(Math.max(getNextZ(), 10002));
    overlay.classList.add('open');
    stopAnim();
    renderAll();
    updateLabel();
  }

  function closeTourModal() {
    overlay.classList.remove('open');
    stopAnim();
    if (tapLabelTimer) { clearTimeout(tapLabelTimer); tapLabelTimer = null; }
    if (tapLabel) { tapLabel.textContent = ''; tapLabel.style.display = 'none'; }
  }

  tourTestBtn.addEventListener('click', openTourModal);
  miniCanvas.addEventListener('click', openTourModal);
  closeBtn.addEventListener('click', closeTourModal);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeTourModal(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && overlay.classList.contains('open')) closeTourModal(); });

  // ===== ズーム・ピンチイン/ピンチアウト(webgl-heritageページから移植) =====
  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    tourZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, tourZoom - e.deltaY * 0.002));
    renderAll();
  }, { passive: false });

  canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchDist0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      tourZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, tourZoom + (d - pinchDist0) * 0.008));
      pinchDist0 = d;
      renderAll();
    }
  }, { passive: false });

  // ===== 縮小プレビュー(#tour-mini-panel)をヘッダドラッグで画面内自由配置 =====
  (function() {
    var dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    function onDown(clientX, clientY) {
      dragging = true;
      var rect = miniPanel.getBoundingClientRect();
      startX = clientX; startY = clientY; startLeft = rect.left; startTop = rect.top;
      miniPanel.style.left = startLeft + 'px';
      miniPanel.style.top = startTop + 'px';
    }
    function onMove(clientX, clientY) {
      if (!dragging) return;
      var dx = clientX - startX, dy = clientY - startY;
      var maxLeft = Math.max(0, window.innerWidth - miniPanel.offsetWidth);
      var maxTop = Math.max(0, window.innerHeight - miniPanel.offsetHeight);
      var newLeft = Math.max(0, Math.min(maxLeft, startLeft + dx));
      var newTop = Math.max(0, Math.min(maxTop, startTop + dy));
      miniPanel.style.left = newLeft + 'px';
      miniPanel.style.top = newTop + 'px';
      positionLodgingRecommendModal();
    }
    function onUp() { dragging = false; }
    miniHead.addEventListener('mousedown', function(e) { onDown(e.clientX, e.clientY); e.preventDefault(); });
    document.addEventListener('mousemove', function(e) { onMove(e.clientX, e.clientY); });
    document.addEventListener('mouseup', onUp);
    miniHead.addEventListener('touchstart', function(e) { onDown(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    miniHead.addEventListener('touchmove', function(e) { onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    miniHead.addEventListener('touchend', onUp);
  })();

// ===== 「登録済みルートを見る」ボタン(#view-registered-routes-btn) =====
// heritage_journey_registered_routes 全件を取得し、出発地・到着地それぞれの
// 出現回数を集計して降順表示、あわせてID/出発地/到着地/直線距離のテーブルを表示する。
function getNextZ() {
  var els = document.querySelectorAll('[style*="z-index"]');
  var max = 100;
  for (var i = 0; i < els.length; i++) {
    var z = parseInt(els[i].style.zIndex, 10);
    if (!isNaN(z) && z > max) max = z;
  }
  return max + 100;
}

function renderCityFreq(elId, routes, key) {
  var el = document.getElementById(elId);
  if (!el) return;
  var counts = {};
  for (var i = 0; i < routes.length; i++) {
    var name = routes[i][key];
    if (!name) continue;
    counts[name] = (counts[name] || 0) + 1;
  }
  var entries = Object.keys(counts).map(function(name) { return [name, counts[name]]; });
  entries.sort(function(a, b) { return b[1] - a[1]; });
  if (entries.length === 0) {
    el.innerHTML = '<div class="registered-routes-empty">データがありません</div>';
    return;
  }
  el.innerHTML = entries.map(function(e) {
    return '<div class="registered-routes-freq-item">' + esc(e[0]) + ' (' + e[1] + ')</div>';
  }).join('');
}

// 現在#start-cityで選択されている都市の表示ラベル(例: 'パリ')を返す。
// CITIESに解決できない場合はnullを返す。
function getCurrentStartCityLabel() {
  var startSel = document.getElementById('start-city');
  if (!startSel) return null;
  var city = getCity(startSel.value);
  return city ? city.label : null;
}

// routesのうち、r.startがstartLabelと一致するものだけを返す純粋関数。
// startLabelがnull/undefinedの場合(#start-cityが未解決)はフィルタせず全件返す。
function filterRoutesByStartLabel(routes, startLabel) {
  if (!startLabel) return routes.slice();
  return routes.filter(function(r) { return r.start === startLabel; });
}

// APIの都市名(label/nameのどちらでも可)からCITIESの国旗と国名を解決する。
function getRegisteredRouteCityMeta(label) {
  var city = CITIES.filter(function(c) { return c.label === label || c.name === label; })[0];
  return city ? { country: city.country || '', flag: city.flag || '' } : { country: '', flag: '' };
}

function filterRegisteredRoutesByCountry(routes, country) {
  if (!country) return routes.slice();
  return routes.filter(function(r) { return getRegisteredRouteCityMeta(r.end).country === country; });
}

// 現在の出発地で表示対象になる行だけを集計し、国旗数の多い順に選択肢を作る。
function renderRegisteredRoutesCountryFilter(routes) {
  var select = document.getElementById('registered-routes-country-filter');
  if (!select) return;
  var countries = {};
  routes.forEach(function(r) {
    var meta = getRegisteredRouteCityMeta(r.end);
    if (!meta.country || !meta.flag) return;
    if (!countries[meta.country]) countries[meta.country] = { country: meta.country, flag: meta.flag, count: 0 };
    countries[meta.country].count++;
  });
  var entries = Object.keys(countries).map(function(country) { return countries[country]; });
  entries.sort(function(a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.country.localeCompare(b.country, 'ja');
  });
  select.innerHTML = '<option value="">なし</option>' + entries.map(function(entry) {
    return '<option value="' + esc(entry.country) + '">' + esc(entry.flag) + ' (' + entry.count + ')</option>';
  }).join('');
}

var registeredRoutesForCurrentStart = [];
var registeredRoutesStartLabel = null;

function applyRegisteredRoutesCountryFilter() {
  var select = document.getElementById('registered-routes-country-filter');
  var country = select ? select.value : '';
  renderRegisteredRoutesTable(filterRegisteredRoutesByCountry(registeredRoutesForCurrentStart, country), registeredRoutesStartLabel);
}

function renderRegisteredRoutesTable(routes, startLabel) {
  var body = document.getElementById('registered-routes-table-body');
  if (!body) return;
  if (routes.length === 0) {
    var msg = startLabel
      ? '出発地「' + esc(startLabel) + '」の登録済みルートはありません'
      : '登録済みルートはありません';
    body.innerHTML = '<tr><td colspan="5" class="registered-routes-empty">' + msg + '</td></tr>';
    return;
  }
  var sortedRoutes = routes.slice().sort(function(a, b) {
    var aCount = Number(a.waypointSetCount) || 0;
    var bCount = Number(b.waypointSetCount) || 0;
    if (bCount !== aCount) return bCount - aCount;
    var aKm = (typeof a.straightKm === 'number') ? a.straightKm : -Infinity;
    var bKm = (typeof b.straightKm === 'number') ? b.straightKm : -Infinity;
    if (bKm !== aKm) return bKm - aKm;
    return Number(a.id) - Number(b.id);
  });
  body.innerHTML = sortedRoutes.map(function(r) {
    var km = (typeof r.straightKm === 'number') ? r.straightKm.toFixed(1) + ' km' : '-';
    var rowClass = 'registered-routes-row' + (r.hasWaypointSet ? ' registered-routes-has-waypoint' : '');
    var count = Number(r.waypointSetCount) || 0;
    var endMeta = getRegisteredRouteCityMeta(r.end);
    var endLabel = (endMeta.flag ? endMeta.flag + ' ' : '') + r.end;
    return '<tr class="' + rowClass + '" data-route-start="' + esc(r.start) + '" data-route-end="' + esc(r.end) + '"><td>' + esc(r.id) + '</td><td>' + esc(r.start) + '</td><td>' + esc(endLabel) + '</td><td>' + km + '</td><td>' + count + '</td></tr>';
  }).join('');
}

// 左上の巡回ルートスコープ(#tour-mini-panel、既定top:12px/left:12px/幅280px)の
// 右端(12+280=292px)に登録済みルートモーダルの左端を接するよう配置し、
// 上端はページ最上段(巡回ルートスコープと同じtop:12px)に揃える。
function resetRegisteredRoutesModalPosition() {
  var box = document.getElementById('registered-routes-modal-box');
  if (!box) return;
  box.style.left = '292px';
  box.style.top = '12px';
}

function findCityNameByLabel(label) {
  // 登録済みデータは現在のnameを保持するが、旧データやテストデータのlabelも受け付ける。
  var city = CITIES.filter(function(c) { return c.label === label || c.name === label; })[0];
  return city ? city.name : null;
}

// 行の出発地・到着地をhidden selectへ同時に反映してからchangeを1回だけ発火する。
// これによりrecompute()がミニ地球儀、見出し、日程を一貫した組み合わせで更新する。
function switchTourScopeToRegisteredRoute(startLabel, endLabel) {
  var startName = findCityNameByLabel(startLabel);
  var endName = findCityNameByLabel(endLabel);
  var startSel = document.getElementById('start-city');
  var endSel = document.getElementById('end-city');
  if (!startName || !endName || !startSel || !endSel) return false;
  startSel.value = startName;
  endSel.value = endName;
  startSel.dispatchEvent(new Event('change'));
  updateEndCityPickerBtnLabel();
  // 同じ行を続けて選んだ場合もキャッシュせずAPIを呼び、最後に保存された経由データを反映する。
  fetch('/api/heritage-journey/latest-waypoint-set?start=' + encodeURIComponent(startName) + '&end=' + encodeURIComponent(endName))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data || !data.waypointSet || typeof data.waypointSet.waypointHeritageIds !== 'string') return;
      var ids = data.waypointSet.waypointHeritageIds.split(',').map(function(part) {
        var match = part.trim().match(/(?:^|\s)(\d{4})$/);
        return match ? match[1] : null;
      }).filter(Boolean);
      state.selected = {};
      manuallyAddedPoints = {};
      ids.forEach(function(id) {
        var point = HERITAGE_POINTS.filter(function(p) { return p.id === id; })[0];
        if (!point) return;
        state.selected[point.name] = true;
        manuallyAddedPoints[point.name] = point;
      });
      renderCandidates();
      recompute();
      renderNightsDistribution();
    });
  return true;
}

// モーダルを開くたびに#start-cityの「現在の」値を読み直してテーブルを
// フィルタする。このモーダルは.tour-modal-overlay(position:fixed;inset:0)で
// 画面全体を覆う排他レイヤーのため、開いている間に裏の#start-cityを
// 操作することはできない。よって「常に現在選択されている都市に切り替える」
// 要件は、開く/再取得のたびに最新値を読み直すことで満たせる
// (開いたまま裏のセレクトが変わり続けるライブ同期は実UI上発生しないため不要)。
function openRegisteredRoutesModal() {
  var overlay = document.getElementById('registered-routes-modal-overlay');
  if (!overlay) return;
  overlay.style.zIndex = String(getNextZ());
  overlay.classList.add('open');
  resetRegisteredRoutesModalPosition();
  var dropdown = document.getElementById('registered-routes-end-dropdown');
  var thBtn = document.getElementById('registered-routes-end-th-btn');
  if (dropdown) dropdown.hidden = true;
  if (thBtn) thBtn.setAttribute('aria-expanded', 'false');
  fetch('/api/heritage-journey/registered-routes')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var routes = (data && Array.isArray(data.routes)) ? data.routes : [];
      renderCityFreq('registered-routes-start-freq', routes, 'start');
      renderCityFreq('registered-routes-end-freq', routes, 'end');
      var startLabel = getCurrentStartCityLabel();
      registeredRoutesStartLabel = startLabel;
      registeredRoutesForCurrentStart = filterRoutesByStartLabel(routes, startLabel);
      renderRegisteredRoutesCountryFilter(registeredRoutesForCurrentStart);
      applyRegisteredRoutesCountryFilter();
    })
    .catch(function() {
      renderCityFreq('registered-routes-start-freq', [], 'start');
      renderCityFreq('registered-routes-end-freq', [], 'end');
      registeredRoutesStartLabel = getCurrentStartCityLabel();
      registeredRoutesForCurrentStart = [];
      renderRegisteredRoutesCountryFilter([]);
      applyRegisteredRoutesCountryFilter();
    });
}

function closeRegisteredRoutesModal() {
  var overlay = document.getElementById('registered-routes-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

(function() {
  var viewBtn = document.getElementById('view-registered-routes-btn');
  var overlay = document.getElementById('registered-routes-modal-overlay');
  var closeBtn = document.getElementById('registered-routes-modal-close');
  var body = document.getElementById('registered-routes-table-body');
  var endThBtn = document.getElementById('registered-routes-end-th-btn');
  var endDropdown = document.getElementById('registered-routes-end-dropdown');
  var countryFilter = document.getElementById('registered-routes-country-filter');
  if (!viewBtn || !overlay || !closeBtn || !body || !endThBtn || !endDropdown || !countryFilter) return;
  viewBtn.addEventListener('click', openRegisteredRoutesModal);
  closeBtn.addEventListener('click', closeRegisteredRoutesModal);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeRegisteredRoutesModal(); });
  endThBtn.addEventListener('click', function() {
    endDropdown.hidden = !endDropdown.hidden;
    endThBtn.setAttribute('aria-expanded', endDropdown.hidden ? 'false' : 'true');
  });
  countryFilter.addEventListener('change', applyRegisteredRoutesCountryFilter);
  body.addEventListener('click', function(e) {
    var row = e.target.closest('.registered-routes-row');
    if (!row) return;
    switchTourScopeToRegisteredRoute(row.getAttribute('data-route-start'), row.getAttribute('data-route-end'));
  });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && overlay.classList.contains('open')) closeRegisteredRoutesModal(); });
})();

// ===== 登録済みルートモーダル(#registered-routes-modal-overlay)をヘッダドラッグで画面内自由配置 =====
// #end-city-picker-modal-overlayのドラッグ実装(3146行目付近)と同じイベント方式・クランプ処理を踏襲する。
// 既定位置は#tour-mini-panelの右端に接する座標(resetRegisteredRoutesModalPosition)だが、
// 配置後はユーザーがヘッダをドラッグして自由に移動できる。
(function() {
  var modalBox = document.getElementById('registered-routes-modal-box');
  var modalHead = document.getElementById('registered-routes-modal-head');
  if (!modalBox || !modalHead) return;
  var dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
  function onDown(clientX, clientY) {
    dragging = true;
    var rect = modalBox.getBoundingClientRect();
    startX = clientX; startY = clientY; startLeft = rect.left; startTop = rect.top;
    modalBox.style.left = startLeft + 'px';
    modalBox.style.top = startTop + 'px';
  }
  function onMove(clientX, clientY) {
    if (!dragging) return;
    var dx = clientX - startX, dy = clientY - startY;
    var maxLeft = Math.max(0, window.innerWidth - modalBox.offsetWidth);
    var maxTop = Math.max(0, window.innerHeight - modalBox.offsetHeight);
    var newLeft = Math.max(0, Math.min(maxLeft, startLeft + dx));
    var newTop = Math.max(0, Math.min(maxTop, startTop + dy));
    modalBox.style.left = newLeft + 'px';
    modalBox.style.top = newTop + 'px';
  }
  function onUp() { dragging = false; }
  modalHead.addEventListener('mousedown', function(e) { onDown(e.clientX, e.clientY); e.preventDefault(); });
  document.addEventListener('mousemove', function(e) { onMove(e.clientX, e.clientY); });
  document.addEventListener('mouseup', onUp);
  modalHead.addEventListener('touchstart', function(e) { onDown(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  modalHead.addEventListener('touchmove', function(e) { onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  modalHead.addEventListener('touchend', onUp);
})();

// ===== 「出発地」ボタン(#start-city-picker-btn) → 最上位レイヤーの都市テーブル =====
// 構造・技法は「到着地」選択モーダル(#end-city-picker-modal-overlay、下のセクション)を
// そのまま踏襲する: 最上位レイヤー(position:fixed)のドラッグ可能なモーダル、
// #巡回テストスコープパネル(#tour-mini-panel、既定でtop:12px;left:12px幅280px)と
// 重ならない既定位置(resetEndCityPickerModalPositionと同じ数値パターン)、行クリックで
// ネイティブ<select>の値を書き換えchangeイベントを発火する(既存のrecompute等が自然発火)。
//
// 「出発元/到着先がそれぞれ入れ替わった場合にも同様のルールを適用」という要件のため、
// 距離計算・登録インジケータ判定はどちらのモーダルも「もう一方の(ロックされている)
// 都市との距離」「もう一方の都市との組み合わせでの登録状態」を対象にする共通ロジックとし、
// このモーダル固有のsuffix('start'/'end')は使わず、常に「ロックされている側」を
// 引数で受け取る形にして、入替ボタンで#start-city/#end-cityの役割が入れ替わっても
// 同じ関数がそのまま正しく動く。

// CITIESに存在しない「駅」「空港」候補(HERITAGE_POINTSの名称末尾一致)を、
// #start-city選択モーダルの一覧に混在させるための一時的な仮想都市エントリ。
// key: 仮想city名('TP::'+HERITAGE_POINTSのn)、value: {name,label,lat,lon,flag}。
// ネイティブ<select>のvalueに存在しない値を代入してもブラウザ側で無視される
// (jsdomも同様)ため、行クリック時にensureCityOptionInSelect()で対応する
// <option>を動的に追加してからvalueを設定する。
var extraPickerCities = {};

function ensureCityOptionInSelect(selectEl, cityLikeObj) {
  extraPickerCities[cityLikeObj.name] = cityLikeObj;
  if (!selectEl) return;
  var opts = selectEl.options;
  for (var i = 0; i < opts.length; i++) {
    if (opts[i].value === cityLikeObj.name) return;
  }
  var opt = document.createElement('option');
  opt.value = cityLikeObj.name;
  opt.textContent = cityLikeObj.label;
  selectEl.appendChild(opt);
}

// HERITAGE_POINTSのうち名称が指定suffix('駅'/'空港')で終わるものを、
// 都市選択モーダルの行として扱える形({name,label,lat,lon,flag})に変換する純粋関数。
// 経由地候補側の既存トグル(toggleTransportCandidates)と同じ「名称末尾一致」基準を流用する。
function buildTransportPickerPoints(suffix) {
  return HERITAGE_POINTS.filter(function(h) {
    return typeof h.n === 'string' && h.n.length > suffix.length && h.n.slice(h.n.length - suffix.length) === suffix;
  }).map(function(h) {
    return { name: 'TP::' + h.n, label: h.n, lat: h.lat, lon: h.lon, flag: h.e || '' };
  });
}

// HERITAGE_POINTSのうち絵文字が🏰(城)であるものを、都市選択モーダルの行として
// 扱える形({name,label,lat,lon,flag})に変換する純粋関数。名称の末尾一致では
// 「〜城」以外の表記(要塞群など)を取りこぼすため、「城ON/OFF」(#toggle-castles-btn)
// の地球儀オーバーレイと同じくe==='🏰'で判定する。
function buildCastlePickerPoints() {
  return HERITAGE_POINTS.filter(function(h) { return h.e === '🏰'; }).map(function(h) {
    return { name: 'TP::' + h.n, label: h.n, lat: h.lat, lon: h.lon, flag: h.e || '' };
  });
}

// 都市選択モーダル(出発地/到着地共通)の候補プールを組み立てる純粋関数。
// includeCities=falseの場合はCITIESを含めない(「都市名のみ」チェックを外した状態)。
function buildCityPickerPool(includeCities, includeStations, includeAirports, includeCastles) {
  var pool = [];
  if (includeCities) {
    pool = pool.concat(CITIES.map(function(c) { return { name: c.name, label: c.label, lat: c.lat, lon: c.lon, flag: c.flag || '' }; }));
  }
  if (includeStations) pool = pool.concat(buildTransportPickerPoints('駅'));
  if (includeAirports) pool = pool.concat(buildTransportPickerPoints('空港'));
  if (includeCastles) pool = pool.concat(buildCastlePickerPoints());
  return pool;
}

// 候補プールの各行に「ロックされている側の都市」との距離(km)を付与し、近い順(昇順)に
// 並び替える純粋関数。lockedがnull/未解決の場合は距離計算をせず(km:null)、順序も変えない。
function sortPickerRowsByDistanceToLocked(pool, locked) {
  var rows = pool.map(function(p) {
    var km = (locked && typeof locked.lat === 'number') ? haversineKm(locked.lat, locked.lon, p.lat, p.lon) : null;
    return { name: p.name, label: p.label, lat: p.lat, lon: p.lon, flag: p.flag || '', km: km };
  });
  if (!locked) return rows;
  rows.sort(function(a, b) {
    if (a.km === null && b.km === null) return 0;
    if (a.km === null) return 1;
    if (b.km === null) return -1;
    return a.km - b.km;
  });
  return rows;
}

// 候補行(sortPickerRowsByDistanceToLockedの出力)に、PR#1450と同じ登録状態インジケータ用の
// CSSクラス名を付与する純粋関数。registeredSetは{ラベル文字列: true}形式
// (buildRegisteredStartsSetの出力と同じ形)。
function classifyPickerRowsRegistered(rows, registeredSet) {
  var set = registeredSet || {};
  return rows.map(function(r) {
    var cls = set[r.label] ? 'start-city-picker-registered' : 'start-city-picker-unregistered';
    return { name: r.name, label: r.label, km: r.km, flag: r.flag, registeredClass: cls };
  });
}

function renderStartCityPickerTable() {
  var body = document.getElementById('start-city-picker-table-body');
  if (!body) return;
  var citiesCb = document.getElementById('start-city-picker-cities-cb');
  var stationsCb = document.getElementById('start-city-picker-stations-cb');
  var airportsCb = document.getElementById('start-city-picker-airports-cb');
  var castlesCb = document.getElementById('start-city-picker-castles-cb');
  var includeCities = citiesCb ? citiesCb.checked : true;
  var includeStations = stationsCb ? stationsCb.checked : false;
  var includeAirports = airportsCb ? airportsCb.checked : false;
  var includeCastles = castlesCb ? castlesCb.checked : false;
  var endSel = document.getElementById('end-city');
  var startSel = document.getElementById('start-city');
  var locked = endSel ? getCity(endSel.value) : null;
  var currentStart = startSel ? startSel.value : null;
  var pool = buildCityPickerPool(includeCities, includeStations, includeAirports, includeCastles);
  var sorted = sortPickerRowsByDistanceToLocked(pool, locked);
  var classified = classifyPickerRowsRegistered(sorted, lastRegisteredStartsSet);
  if (classified.length === 0) {
    body.innerHTML = '<tr><td colspan="2" class="registered-routes-empty">表示できる候補がありません(チェックボックスを確認してください)</td></tr>';
    return;
  }
  body.innerHTML = classified.map(function(r) {
    var isCurrent = r.name === currentStart;
    var kmText = (r.km === null) ? '-' : r.km.toFixed(1) + ' km';
    return '<tr class="start-city-picker-row' + (isCurrent ? ' start-city-picker-current' : '') + '" data-city-name="' + esc(r.name) + '">'
      + '<td class="' + r.registeredClass + '">' + (r.flag ? esc(r.flag) + ' ' : '') + esc(r.label) + '</td><td>' + kmText + '</td></tr>';
  }).join('');
}

function refreshStartCityPickerTableIfOpen() {
  var overlay = document.getElementById('start-city-picker-modal-overlay');
  if (overlay && overlay.classList.contains('open')) renderStartCityPickerTable();
}

// #tour-mini-panel(280px幅、既定top:12px;left:12px)と重ならないよう、
// #end-city-picker-modal-boxのresetEndCityPickerModalPositionと同じ数値パターンを踏襲する。
function resetStartCityPickerModalPosition() {
  var box = document.getElementById('start-city-picker-modal-box');
  if (!box) return;
  var defaultLeft = Math.max(320, window.innerWidth - 600);
  var defaultTop = 80;
  box.style.left = defaultLeft + 'px';
  box.style.top = defaultTop + 'px';
}

function openStartCityPickerModal() {
  var overlay = document.getElementById('start-city-picker-modal-overlay');
  if (!overlay) return;
  overlay.style.zIndex = String(getNextZ());
  overlay.classList.add('open');
  resetStartCityPickerModalPosition();
  renderStartCityPickerTable();
}

function closeStartCityPickerModal() {
  var overlay = document.getElementById('start-city-picker-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

(function() {
  var pickerBtn = document.getElementById('start-city-picker-btn');
  var overlay = document.getElementById('start-city-picker-modal-overlay');
  var closeBtn = document.getElementById('start-city-picker-modal-close');
  var body = document.getElementById('start-city-picker-table-body');
  var citiesCb = document.getElementById('start-city-picker-cities-cb');
  var stationsCb = document.getElementById('start-city-picker-stations-cb');
  var airportsCb = document.getElementById('start-city-picker-airports-cb');
  var castlesCb = document.getElementById('start-city-picker-castles-cb');
  if (!pickerBtn || !overlay || !closeBtn || !body) return;
  pickerBtn.addEventListener('click', openStartCityPickerModal);
  closeBtn.addEventListener('click', closeStartCityPickerModal);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeStartCityPickerModal(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && overlay.classList.contains('open')) closeStartCityPickerModal(); });
  body.addEventListener('click', function(e) {
    var row = e.target.closest('[data-city-name]');
    if (!row) return;
    var name = row.getAttribute('data-city-name');
    var startSel = document.getElementById('start-city');
    if (!getCity(name)) {
      // CITIESに無い(=駅/空港/城の仮想エントリ)場合は<option>を動的に追加してから選択する。
      var pool = buildCityPickerPool(true, true, true, true);
      var match = pool.filter(function(p) { return p.name === name; })[0];
      if (match) ensureCityOptionInSelect(startSel, match);
    }
    startSel.value = name;
    startSel.dispatchEvent(new Event('change'));
  });
  [citiesCb, stationsCb, airportsCb, castlesCb].forEach(function(cb) {
    if (cb) cb.addEventListener('change', renderStartCityPickerTable);
  });
})();

// ===== 出発地選択モーダル(#start-city-picker-modal-overlay)をヘッダドラッグで画面内自由配置 =====
// #end-city-picker-modal-headのドラッグ実装と同じイベント方式・クランプ処理を踏襲する。
(function() {
  var modalBox = document.getElementById('start-city-picker-modal-box');
  var modalHead = document.getElementById('start-city-picker-modal-head');
  if (!modalBox || !modalHead) return;
  var dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
  function onDown(clientX, clientY) {
    dragging = true;
    var rect = modalBox.getBoundingClientRect();
    startX = clientX; startY = clientY; startLeft = rect.left; startTop = rect.top;
    modalBox.style.left = startLeft + 'px';
    modalBox.style.top = startTop + 'px';
  }
  function onMove(clientX, clientY) {
    if (!dragging) return;
    var dx = clientX - startX, dy = clientY - startY;
    var maxLeft = Math.max(0, window.innerWidth - modalBox.offsetWidth);
    var maxTop = Math.max(0, window.innerHeight - modalBox.offsetHeight);
    var newLeft = Math.max(0, Math.min(maxLeft, startLeft + dx));
    var newTop = Math.max(0, Math.min(maxTop, startTop + dy));
    modalBox.style.left = newLeft + 'px';
    modalBox.style.top = newTop + 'px';
  }
  function onUp() { dragging = false; }
  modalHead.addEventListener('mousedown', function(e) { onDown(e.clientX, e.clientY); e.preventDefault(); });
  document.addEventListener('mousemove', function(e) { onMove(e.clientX, e.clientY); });
  document.addEventListener('mouseup', onUp);
  modalHead.addEventListener('touchstart', function(e) { onDown(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  modalHead.addEventListener('touchmove', function(e) { onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  modalHead.addEventListener('touchend', onUp);
})();

// ===== 「到着地」ボタン(#end-city-picker-btn) → 最上位レイヤーの都市テーブル =====
// #end-cityの<option>群(出発地を除外しない全都市)を出発地からの距離(km)降順で並べ、
// クリックで#end-cityの値をセットしchangeイベントを発火する(既存のrecompute等が
// 自然発火する)。出発地が未確定の場合は距離列を"-"にして例外を出さない。
function renderEndCityPickerTable() {
  var body = document.getElementById('end-city-picker-table-body');
  if (!body) return;
  var startSel = document.getElementById('start-city');
  var endSel = document.getElementById('end-city');
  var start = startSel ? getCity(startSel.value) : null;
  var currentEnd = endSel ? endSel.value : null;
  // 出発地選択モーダル(#start-city-picker-modal-overlay)と同じ「都市名のみ/駅/空港/城」
  // チェックボックスで候補プールを組み立てる(buildCityPickerPool()を共有)。
  // 「到達国を制限する」フィルタ(destCountryFilter)は都市(CITIES)にのみ適用する
  // (駅/空港/城の仮想エントリはbuildTransportPickerPoints/buildCastlePickerPointsが
  // 国情報を持たないため、対象外のまま常に表示する)。
  var citiesCb = document.getElementById('end-city-picker-cities-cb');
  var stationsCb = document.getElementById('end-city-picker-stations-cb');
  var airportsCb = document.getElementById('end-city-picker-airports-cb');
  var castlesCb = document.getElementById('end-city-picker-castles-cb');
  var includeCities = citiesCb ? citiesCb.checked : true;
  var includeStations = stationsCb ? stationsCb.checked : false;
  var includeAirports = airportsCb ? airportsCb.checked : false;
  var includeCastles = castlesCb ? castlesCb.checked : false;
  var cityPool = includeCities ? CITIES.filter(function(c) {
    return destCountryFilter === DEST_COUNTRY_FILTER_ALL || c.country === destCountryFilter;
  }).map(function(c) { return { name: c.name, label: c.label, lat: c.lat, lon: c.lon, flag: c.flag || '' }; }) : [];
  var extraPool = buildCityPickerPool(false, includeStations, includeAirports, includeCastles);
  var pool = cityPool.concat(extraPool);
  var rows = pool.map(function(p) {
    var km = (start && typeof start.lat === 'number') ? haversineKm(start.lat, start.lon, p.lat, p.lon) : null;
    return { name: p.name, label: p.label, km: km, flag: p.flag || '' };
  });
  rows.sort(function(a, b) {
    if (a.km === null && b.km === null) return 0;
    if (a.km === null) return 1;
    if (b.km === null) return -1;
    return b.km - a.km;
  });
  body.innerHTML = rows.map(function(r) {
    var isCurrent = r.name === currentEnd;
    var kmText = (r.km === null) ? '-' : r.km.toFixed(1) + ' km';
    return '<tr class="end-city-picker-row' + (isCurrent ? ' end-city-picker-current' : '') + '" data-city-name="' + esc(r.name) + '">'
      + '<td class="end-city-picker-flag-td">' + esc(r.flag) + '</td><td>' + esc(r.label) + '</td><td>' + kmText + '</td></tr>';
  }).join('');
}

// #tour-mini-panel(280px幅、既定でtop:12px;left:12px)と重ならないよう、
// 既定位置は画面右側・やや下(left:innerWidth-600px以上を確保、下限320px)に固定する。
// 再オープンのたびにこの既定位置へリセットする(ドラッグ位置は保持しない)。
function resetEndCityPickerModalPosition() {
  var box = document.getElementById('end-city-picker-modal-box');
  if (!box) return;
  var defaultLeft = Math.max(320, window.innerWidth - 600);
  var defaultTop = 80;
  box.style.left = defaultLeft + 'px';
  box.style.top = defaultTop + 'px';
}

function openEndCityPickerModal() {
  var overlay = document.getElementById('end-city-picker-modal-overlay');
  if (!overlay) return;
  overlay.style.zIndex = String(getNextZ());
  overlay.classList.add('open');
  resetEndCityPickerModalPosition();
  renderEndCityPickerTable();
}

function closeEndCityPickerModal() {
  var overlay = document.getElementById('end-city-picker-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

(function() {
  var pickerBtn = document.getElementById('end-city-picker-btn');
  var overlay = document.getElementById('end-city-picker-modal-overlay');
  var closeBtn = document.getElementById('end-city-picker-modal-close');
  var body = document.getElementById('end-city-picker-table-body');
  var flagTh = document.getElementById('end-city-picker-flag-th');
  var citiesCb = document.getElementById('end-city-picker-cities-cb');
  var stationsCb = document.getElementById('end-city-picker-stations-cb');
  var airportsCb = document.getElementById('end-city-picker-airports-cb');
  var castlesCb = document.getElementById('end-city-picker-castles-cb');
  if (!pickerBtn || !overlay || !closeBtn || !body) return;
  pickerBtn.addEventListener('click', openEndCityPickerModal);
  closeBtn.addEventListener('click', closeEndCityPickerModal);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeEndCityPickerModal(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && overlay.classList.contains('open')) closeEndCityPickerModal(); });
  body.addEventListener('click', function(e) {
    var row = e.target.closest('[data-city-name]');
    if (!row) return;
    var name = row.getAttribute('data-city-name');
    var endSel = document.getElementById('end-city');
    if (!getCity(name)) {
      // CITIESに無い(=駅/空港/城の仮想エントリ)場合は<option>を動的に追加してから選択する。
      var pool = buildCityPickerPool(true, true, true, true);
      var match = pool.filter(function(p) { return p.name === name; })[0];
      if (match) ensureCityOptionInSelect(endSel, match);
    }
    endSel.value = name;
    endSel.dispatchEvent(new Event('change'));
  });
  [citiesCb, stationsCb, airportsCb, castlesCb].forEach(function(cb) {
    if (cb) cb.addEventListener('change', renderEndCityPickerTable);
  });
  // 🏁列見出しをタップすると、既存の「到達国を制限する」国一覧モーダルをそのまま開く。
  // 集計(国別都市数の降順)は候補都市の全体(CITIES全件)を対象にする既存の
  // computeDestCountryCounts()をそのまま再利用する(この到着地選択モーダルで
  // 現在絞り込まれている行だけを対象にはしない。フィルタ選択用ドロップダウンとしては
  // 全候補の内訳が見えたほうが選びやすいため)。到着地選択モーダルの上に重ねて開くため
  // openDistCountryFilterModal内のgetNextZ()が到着地選択モーダルより高いz-indexを
  // 自動的に割り当てる。
  if (flagTh) {
    flagTh.addEventListener('click', function() {
      openDistCountryFilterModal();
    });
  }
})();

// ===== 「到達国を制限する」ボタン(#dist-country-filter-btn) → 最上位レイヤーの国一覧モーダル =====
(function() {
  var filterBtn = document.getElementById('dist-country-filter-btn');
  var overlay = document.getElementById('dist-country-filter-modal-overlay');
  var closeBtn = document.getElementById('dist-country-filter-modal-close');
  var list = document.getElementById('dist-country-filter-list');
  if (!filterBtn || !overlay || !closeBtn || !list) return;
  filterBtn.addEventListener('click', openDistCountryFilterModal);
  closeBtn.addEventListener('click', closeDistCountryFilterModal);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeDistCountryFilterModal(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && overlay.classList.contains('open')) closeDistCountryFilterModal(); });
  list.addEventListener('click', function(e) {
    var row = e.target.closest('[data-country]');
    if (!row) return;
    selectDestCountryFilter(row.getAttribute('data-country'));
  });
})();

// ===== 到着地選択モーダル(#end-city-picker-modal-overlay)をヘッダドラッグで画面内自由配置 =====
// #tour-mini-panelのドラッグ実装(1671行目付近)と同じイベント方式・クランプ処理を踏襲する。
(function() {
  var modalBox = document.getElementById('end-city-picker-modal-box');
  var modalHead = document.getElementById('end-city-picker-modal-head');
  if (!modalBox || !modalHead) return;
  var dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
  function onDown(clientX, clientY) {
    dragging = true;
    var rect = modalBox.getBoundingClientRect();
    startX = clientX; startY = clientY; startLeft = rect.left; startTop = rect.top;
    modalBox.style.left = startLeft + 'px';
    modalBox.style.top = startTop + 'px';
  }
  function onMove(clientX, clientY) {
    if (!dragging) return;
    var dx = clientX - startX, dy = clientY - startY;
    var maxLeft = Math.max(0, window.innerWidth - modalBox.offsetWidth);
    var maxTop = Math.max(0, window.innerHeight - modalBox.offsetHeight);
    var newLeft = Math.max(0, Math.min(maxLeft, startLeft + dx));
    var newTop = Math.max(0, Math.min(maxTop, startTop + dy));
    modalBox.style.left = newLeft + 'px';
    modalBox.style.top = newTop + 'px';
  }
  function onUp() { dragging = false; }
  modalHead.addEventListener('mousedown', function(e) { onDown(e.clientX, e.clientY); e.preventDefault(); });
  document.addEventListener('mousemove', function(e) { onMove(e.clientX, e.clientY); });
  document.addEventListener('mouseup', onUp);
  modalHead.addEventListener('touchstart', function(e) { onDown(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  modalHead.addEventListener('touchmove', function(e) { onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  modalHead.addEventListener('touchend', onUp);
})();

document.getElementById('swap-btn').addEventListener('click', function() {
  var s = document.getElementById('start-city'), e = document.getElementById('end-city');
  var tmp = s.value; s.value = e.value; e.value = tmp;
  state.selected = {}; manuallyAddedPoints = {};
  updateStartCityPickerBtnLabel();
  updateEndCityPickerBtnLabel();
  saveStartEndCityToCookie();
  renderCandidates(); recompute(); renderNightsDistribution();
  refreshRouteRegistrationUi();
});
document.getElementById('start-city').addEventListener('change', function() {
  updateStartCityPickerBtnLabel();
  state.selected = {}; manuallyAddedPoints = {}; renderCandidates(); recompute(); renderNightsDistribution();
  refreshRouteRegistrationUi();
  saveStartEndCityToCookie();
});
document.getElementById('end-city').addEventListener('change', function() {
  updateEndCityPickerBtnLabel();
  state.selected = {}; manuallyAddedPoints = {}; recompute();
  refreshRouteRegistrationUi();
  saveStartEndCityToCookie();
});
['opt-detour','opt-speed','opt-visit','opt-nights'].forEach(function(id) {
  document.getElementById(id).addEventListener('input', function() { renderCandidates(); recompute(); });
});
['opt-daily','opt-hub'].forEach(function(id) {
  document.getElementById(id).addEventListener('input', function() { renderCandidates(); recompute(); renderNightsDistribution(); });
});

// ===== 「宿泊地の推奨プラン」検索モーダル: 世界遺産をインクリメンタルサーチで追加 =====
var heritageAddSearchInput = document.getElementById('heritage-add-search');
var heritageAddModalOverlay = document.getElementById('heritage-add-modal-overlay');
var heritageAddModalClose = document.getElementById('heritage-add-modal-close');
var heritageAddResultsBody = document.getElementById('heritage-add-results-body');

function openHeritageAddModal() {
  heritageAddModalOverlay.classList.add('open');
  renderHeritageAddResults(heritageAddSearchInput.value);
}

function closeHeritageAddModal() {
  heritageAddModalOverlay.classList.remove('open');
}

function renderHeritageAddResults(query) {
  var q = String(query || '').trim().toLowerCase();
  var pool = HERITAGE_POINTS;
  if (tourPoints.length >= 1) {
    var radius = haversineKm(tourCenterLat, tourCenterLon, tourPoints[0].lat, tourPoints[0].lon);
    pool = pool.filter(function(h) { return haversineKm(tourCenterLat, tourCenterLon, h.lat, h.lon) <= radius; });
  }
  var matches = pool.filter(function(h) {
    return q === '' || h.n.toLowerCase().indexOf(q) !== -1;
  }).slice(0, 30);
  heritageAddResultsBody.innerHTML = matches.map(function(h) {
    var inCourse = tourPoints.some(function(p) { return p.name === h.n; });
    return '<tr><td class="heritage-add-name' + (inCourse ? ' in-course' : '') + '">' + esc(h.e || '📍') + ' ' + esc(h.n) + '</td><td>' + esc(h.c || '') + '</td>'
      + '<td><button type="button" class="heritage-add-btn' + (inCourse ? ' active' : '') + '" data-add-name="' + esc(h.n) + '">'
      + (inCourse ? '解除する' : '追加する') + '</button></td></tr>';
  }).join('');
}

heritageAddSearchInput.addEventListener('focus', openHeritageAddModal);
heritageAddSearchInput.addEventListener('input', function() {
  if (!heritageAddModalOverlay.classList.contains('open')) openHeritageAddModal();
  else renderHeritageAddResults(heritageAddSearchInput.value);
});
heritageAddModalClose.addEventListener('click', closeHeritageAddModal);
heritageAddModalOverlay.addEventListener('click', function(e) { if (e.target === heritageAddModalOverlay) closeHeritageAddModal(); });
document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && heritageAddModalOverlay.classList.contains('open')) closeHeritageAddModal(); });

heritageAddResultsBody.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-add-name]');
  if (!btn) return;
  var name = btn.getAttribute('data-add-name');
  var h = HERITAGE_POINTS.filter(function(x) { return x.n === name; })[0];
  if (!h) return;
  var inCourse = tourPoints.some(function(p) { return p.name === name; });
  if (inCourse) {
    state.selected[name] = false;
    delete manuallyAddedPoints[name];
  } else {
    manuallyAddedPoints[name] = h;
    state.selected[name] = true;
  }
  renderCandidates();
  recompute();
  renderHeritageAddResults(heritageAddSearchInput.value);
});

populateCitySelects();
updateStartCityPickerBtnLabel();
loadDestCountryFilterFromCookie();
updateDistCountryFilterBtnLabel();
renderCandidates();
recompute();
renderNightsDistribution();
refreshRouteRegistrationUi();
</script>
</body>
</html>`;
}
