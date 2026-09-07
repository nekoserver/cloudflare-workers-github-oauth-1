import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import {
  EQUAL_EARTH_MAP_WIDTH,
  EQUAL_EARTH_MAP_HEIGHT,
  EQUAL_EARTH_CONTINENT_PATHS,
  EQUAL_EARTH_GRATICULE_PATHS,
  EQUAL_EARTH_CITIES,
} from '../data/equalEarthMapData';

export function getEqualEarthMapPage(username: string): string {
  const safeUsername = escapeHtml(username);
  const citiesJson = JSON.stringify(EQUAL_EARTH_CITIES);

  const continentPathsHtml = EQUAL_EARTH_CONTINENT_PATHS.map(
    (c) => `<path class="continent" d="${c.d}"><title>${escapeHtml(c.name)}</title></path>`
  ).join('\n');

  const graticulePathsHtml = EQUAL_EARTH_GRATICULE_PATHS.map((d) => `<path class="graticule" d="${d}"></path>`).join('\n');

  const cityDotsHtml = EQUAL_EARTH_CITIES.map(
    (c, i) =>
      `<circle class="city-dot" id="city-dot-${i}" cx="${c.x}" cy="${c.y}" r="7"><title>${escapeHtml(c.name)}</title></circle>`
  ).join('\n');

  const cityMenuHtml = EQUAL_EARTH_CITIES.map(
    (c, i) => `<button type="button" class="city-menu-item" data-city-index="${i}">${escapeHtml(c.name)}</button>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>イコールアース図法 世界地図 - Cloudflare Workers GitHub OAuth</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
      min-height: 100vh;
    }
    .navbar {
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px var(--navbar-shadow);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .navbar-brand { font-size: 20px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
    .user-name { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
    .container { max-width: 1400px; margin: 0 auto; padding: 32px 20px; }
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      padding: 32px;
    }
    .title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 20px; }
    .map-layout { display: flex; gap: 20px; align-items: flex-start; }
    .city-menu {
      flex-shrink: 0;
      width: 200px;
      max-height: 560px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 8px;
      background: var(--bg-secondary);
    }
    .city-menu-item {
      text-align: left;
      font-size: 13px;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-primary);
      cursor: pointer;
    }
    .city-menu-item:hover { background: var(--dropdown-hover); }
    .city-menu-item.active { background: var(--accent-color, #667eea); color: #fff; border-color: var(--accent-color, #667eea); }
    .map-viewport {
      flex: 1;
      height: 560px;
      overflow: auto;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      position: relative;
    }
    .map-svg { display: block; }
    .continent { fill: var(--accent-color, #667eea); fill-opacity: 0.35; stroke: var(--text-secondary); stroke-width: 1; }
    .graticule { fill: none; stroke: var(--border-color); stroke-width: 1; }
    .city-dot { fill: #ef4444; stroke: #fff; stroke-width: 1.5; cursor: pointer; }
    .city-dot.highlighted { fill: #eab308; }
    .city-label {
      font-size: 20px;
      fill: var(--text-primary);
      paint-order: stroke;
      stroke: var(--card-bg);
      stroke-width: 4px;
      pointer-events: none;
    }
    .map-note { font-size: 11px; color: var(--text-faint); margin-top: 10px; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">🗺️ イコールアース図法 世界地図</div>
    <div class="user-name">${safeUsername}</div>
  </nav>
  ${getThemeToggleHTML()}
  <div class="container">
    <div class="card">
      <div class="title">イコールアース図法(Equal Earth projection)白地図</div>
      <div class="subtitle">
        主要都市のメニューを選ぶと、その座標を中心に地図がスクロールします。輪郭は実測の海岸線データではなく、
        主要な緯度経度の頂点による簡略化(低ポリゴン)形状です。
      </div>
      <div class="map-layout">
        <div class="city-menu" id="cityMenu">
          ${cityMenuHtml}
        </div>
        <div class="map-viewport" id="mapViewport">
          <svg class="map-svg" id="mapSvg" width="${EQUAL_EARTH_MAP_WIDTH}" height="${EQUAL_EARTH_MAP_HEIGHT}" viewBox="0 0 ${EQUAL_EARTH_MAP_WIDTH} ${EQUAL_EARTH_MAP_HEIGHT}">
            <g class="graticule-layer">
              ${graticulePathsHtml}
            </g>
            <g class="continent-layer">
              ${continentPathsHtml}
            </g>
            <g class="city-layer" id="cityLayer">
              ${cityDotsHtml}
            </g>
          </svg>
        </div>
      </div>
      <div class="map-note">
        ※ 投影式: Equal Earth projection(Šavrič, Patterson, Jenny, 2018)。緯線・経線は30度間隔で描画しています。
      </div>
    </div>
  </div>
  <script>
    ${getThemeToggleScript()}

    var CITIES = ${citiesJson};
    var mapViewport = document.getElementById('mapViewport');
    var cityLayer = document.getElementById('cityLayer');
    var cityMenu = document.getElementById('cityMenu');
    var activeMenuItem = null;
    var activeDot = null;

    function focusCity(index) {
      var city = CITIES[index];
      if (!city) return;

      var viewportRect = mapViewport.getBoundingClientRect();
      var targetLeft = city.x - viewportRect.width / 2;
      var targetTop = city.y - viewportRect.height / 2;
      mapViewport.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' });

      if (activeMenuItem) activeMenuItem.classList.remove('active');
      var menuItem = cityMenu.querySelector('[data-city-index="' + index + '"]');
      if (menuItem) {
        menuItem.classList.add('active');
        activeMenuItem = menuItem;
      }

      if (activeDot) activeDot.classList.remove('highlighted');
      var dot = document.getElementById('city-dot-' + index);
      if (dot) {
        dot.classList.add('highlighted');
        activeDot = dot;
      }

      var existingLabel = document.getElementById('city-focus-label');
      if (existingLabel) existingLabel.remove();
      var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('id', 'city-focus-label');
      label.setAttribute('class', 'city-label');
      label.setAttribute('x', String(city.x + 12));
      label.setAttribute('y', String(city.y - 12));
      label.textContent = city.name;
      cityLayer.appendChild(label);
    }

    cityMenu.addEventListener('click', function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;
      var button = target.closest('.city-menu-item');
      if (!button) return;
      var index = Number(button.getAttribute('data-city-index'));
      focusCity(index);
    });

    cityLayer.addEventListener('click', function (event) {
      var target = event.target;
      if (!(target instanceof Element)) return;
      var idAttr = target.getAttribute('id');
      if (!idAttr || idAttr.indexOf('city-dot-') !== 0) return;
      var index = Number(idAttr.replace('city-dot-', ''));
      focusCity(index);
    });
  </script>
</body>
</html>`;
}
