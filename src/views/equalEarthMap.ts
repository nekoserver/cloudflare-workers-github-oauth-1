import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import {
  EQUAL_EARTH_MAP_WIDTH,
  EQUAL_EARTH_MAP_HEIGHT,
  EQUAL_EARTH_LAND_PATH_D,
  EQUAL_EARTH_LAKES_PATH_D,
  EQUAL_EARTH_GRATICULE_PATHS,
  EQUAL_EARTH_CITIES,
} from '../data/equalEarthMapData';

export function getEqualEarthMapPage(username: string): string {
  const safeUsername = escapeHtml(username);
  const citiesJson = JSON.stringify(EQUAL_EARTH_CITIES);

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
      max-height: min(70vh, 640px);
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
      min-width: 0;
      height: min(70vh, 640px);
      overflow: hidden;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      position: relative;
      touch-action: none;
      cursor: grab;
    }
    .map-viewport.dragging { cursor: grabbing; }
    .map-svg { display: block; width: 100%; height: 100%; }
    .land { fill: var(--accent-color, #667eea); fill-opacity: 0.4; stroke: var(--text-secondary); stroke-width: 0.75; stroke-linejoin: round; }
    .lake { fill: var(--bg-secondary); stroke: var(--text-secondary); stroke-width: 0.5; }
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
    .map-controls {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      z-index: 2;
    }
    .map-control-btn {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--card-bg);
      color: var(--text-primary);
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }
    .map-control-btn:hover { background: var(--dropdown-hover); }
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
        主要都市のメニューを選ぶと、その座標を中心に地図がズームします。マウスホイール/ピンチ操作での拡大縮小、ドラッグでのパンにも対応しています。
        海岸線・湖はNatural Earth(Public Domain)の実測データ(1:110m解像度)を投影しています。
      </div>
      <div class="map-layout">
        <div class="city-menu" id="cityMenu">
          ${cityMenuHtml}
        </div>
        <div class="map-viewport" id="mapViewport">
          <div class="map-controls">
            <button type="button" class="map-control-btn" id="zoomInBtn" aria-label="拡大">+</button>
            <button type="button" class="map-control-btn" id="zoomOutBtn" aria-label="縮小">−</button>
            <button type="button" class="map-control-btn" id="resetViewBtn" aria-label="全体表示">⤢</button>
          </div>
          <svg class="map-svg" id="mapSvg" viewBox="0 0 ${EQUAL_EARTH_MAP_WIDTH} ${EQUAL_EARTH_MAP_HEIGHT}">
            <g class="graticule-layer">
              ${graticulePathsHtml}
            </g>
            <g class="land-layer">
              <path class="land" d="${EQUAL_EARTH_LAND_PATH_D}"></path>
              <path class="lake" d="${EQUAL_EARTH_LAKES_PATH_D}"></path>
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
    var MAP_W = ${EQUAL_EARTH_MAP_WIDTH};
    var MAP_H = ${EQUAL_EARTH_MAP_HEIGHT};
    var MIN_VB_W = MAP_W / 8;
    var MAX_VB_W = MAP_W;
    var CITY_FOCUS_VB_W = MAP_W / 5;

    var svg = document.getElementById('mapSvg');
    var mapViewport = document.getElementById('mapViewport');
    var cityLayer = document.getElementById('cityLayer');
    var cityMenu = document.getElementById('cityMenu');
    var activeMenuItem = null;
    var activeDot = null;

    var vb = { x: 0, y: 0, w: MAP_W, h: MAP_H };
    var animFrameId = null;

    function clampViewBox() {
      if (vb.w > MAX_VB_W) vb.w = MAX_VB_W;
      if (vb.w < MIN_VB_W) vb.w = MIN_VB_W;
      vb.h = (vb.w * MAP_H) / MAP_W;
      if (vb.x < 0) vb.x = 0;
      if (vb.y < 0) vb.y = 0;
      if (vb.x + vb.w > MAP_W) vb.x = MAP_W - vb.w;
      if (vb.y + vb.h > MAP_H) vb.y = MAP_H - vb.h;
    }

    function applyViewBox() {
      svg.setAttribute('viewBox', vb.x.toFixed(2) + ' ' + vb.y.toFixed(2) + ' ' + vb.w.toFixed(2) + ' ' + vb.h.toFixed(2));
    }

    // クライアント座標(px)をSVGユーザー座標へ変換する
    function clientToSvg(clientX, clientY) {
      var rect = svg.getBoundingClientRect();
      return {
        x: vb.x + ((clientX - rect.left) / rect.width) * vb.w,
        y: vb.y + ((clientY - rect.top) / rect.height) * vb.h,
      };
    }

    // svgPointを中心に保ったままfactor倍にズームする(factor<1で拡大、>1で縮小)
    function zoomAt(svgPoint, factor) {
      var newW = vb.w * factor;
      if (newW > MAX_VB_W) newW = MAX_VB_W;
      if (newW < MIN_VB_W) newW = MIN_VB_W;
      var newH = (newW * MAP_H) / MAP_W;
      vb.x = svgPoint.x - ((svgPoint.x - vb.x) * newW) / vb.w;
      vb.y = svgPoint.y - ((svgPoint.y - vb.y) * newH) / vb.h;
      vb.w = newW;
      vb.h = newH;
      clampViewBox();
      applyViewBox();
    }

    function animateViewBoxTo(target, durationMs) {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      var start = { x: vb.x, y: vb.y, w: vb.w };
      var startTime = performance.now();
      function step(now) {
        var t = Math.min((now - startTime) / durationMs, 1);
        var eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        vb.x = start.x + (target.x - start.x) * eased;
        vb.y = start.y + (target.y - start.y) * eased;
        vb.w = start.w + (target.w - start.w) * eased;
        clampViewBox();
        applyViewBox();
        if (t < 1) {
          animFrameId = requestAnimationFrame(step);
        } else {
          animFrameId = null;
        }
      }
      animFrameId = requestAnimationFrame(step);
    }

    function focusCity(index) {
      var city = CITIES[index];
      if (!city) return;

      animateViewBoxTo({ x: city.x - CITY_FOCUS_VB_W / 2, y: city.y - (CITY_FOCUS_VB_W * MAP_H) / MAP_W / 2, w: CITY_FOCUS_VB_W }, 700);

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

    function resetView() {
      animateViewBoxTo({ x: 0, y: 0, w: MAP_W }, 500);
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

    document.getElementById('zoomInBtn').addEventListener('click', function () {
      var center = { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 };
      zoomAt(center, 0.7);
    });
    document.getElementById('zoomOutBtn').addEventListener('click', function () {
      var center = { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 };
      zoomAt(center, 1 / 0.7);
    });
    document.getElementById('resetViewBtn').addEventListener('click', resetView);

    // マウスホイールでのズーム(カーソル位置を中心に拡大縮小)
    mapViewport.addEventListener(
      'wheel',
      function (event) {
        event.preventDefault();
        var point = clientToSvg(event.clientX, event.clientY);
        var factor = event.deltaY > 0 ? 1.15 : 1 / 1.15;
        zoomAt(point, factor);
      },
      { passive: false }
    );

    // Pointer Eventsでドラッグパン・ピンチズーム(タッチ/マウス共通)を扱う。
    // activePointers: 現在押下中のポインタのクライアント座標をpointerIdごとに保持する。
    var activePointers = {};
    var lastPanPoint = null;
    var lastPinchDistance = null;

    function pointerDistance(p1, p2) {
      return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }
    function pointerMidpoint(p1, p2) {
      return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }

    mapViewport.addEventListener('pointerdown', function (event) {
      // オーバーレイのズームボタン上でのpointerdownはパン/ピンチ処理の対象外とする。
      // ここでポインタキャプチャを行うと、ボタンのネイティブclickイベントが
      // 発火しなくなってしまうため。
      var target = event.target;
      if (target instanceof Element && target.closest('.map-controls')) return;
      mapViewport.setPointerCapture(event.pointerId);
      activePointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      var ids = Object.keys(activePointers);
      if (ids.length === 1) {
        lastPanPoint = { x: event.clientX, y: event.clientY };
        mapViewport.classList.add('dragging');
      } else if (ids.length === 2) {
        var pts = ids.map(function (id) { return activePointers[id]; });
        lastPinchDistance = pointerDistance(pts[0], pts[1]);
        lastPanPoint = null;
      }
    });

    mapViewport.addEventListener('pointermove', function (event) {
      if (!activePointers[event.pointerId]) return;
      activePointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      var ids = Object.keys(activePointers);

      if (ids.length === 2) {
        var pts = ids.map(function (id) { return activePointers[id]; });
        var dist = pointerDistance(pts[0], pts[1]);
        var mid = pointerMidpoint(pts[0], pts[1]);
        if (lastPinchDistance !== null && dist > 0) {
          var factor = lastPinchDistance / dist;
          zoomAt(clientToSvg(mid.x, mid.y), factor);
        }
        lastPinchDistance = dist;
      } else if (ids.length === 1 && lastPanPoint) {
        var rect = svg.getBoundingClientRect();
        var dxSvg = ((lastPanPoint.x - event.clientX) / rect.width) * vb.w;
        var dySvg = ((lastPanPoint.y - event.clientY) / rect.height) * vb.h;
        vb.x += dxSvg;
        vb.y += dySvg;
        clampViewBox();
        applyViewBox();
        lastPanPoint = { x: event.clientX, y: event.clientY };
      }
    });

    function endPointer(event) {
      delete activePointers[event.pointerId];
      var ids = Object.keys(activePointers);
      if (ids.length < 2) lastPinchDistance = null;
      if (ids.length === 1) {
        lastPanPoint = activePointers[ids[0]];
      } else {
        lastPanPoint = null;
        mapViewport.classList.remove('dragging');
      }
    }
    mapViewport.addEventListener('pointerup', endPointer);
    mapViewport.addEventListener('pointercancel', endPointer);
    mapViewport.addEventListener('pointerleave', endPointer);

    mapViewport.addEventListener('dblclick', function (event) {
      var point = clientToSvg(event.clientX, event.clientY);
      zoomAt(point, 0.5);
    });

    applyViewBox();
  </script>
</body>
</html>`;
}
