import { describe, expect, it } from 'vitest';
import { getWebGLHeritagePage } from './webglHeritage';

describe('getWebGLHeritagePage 空路機能', () => {
  const html = getWebGLHeritagePage('tester');

  it('空路ボタンと左サイド空港パネルを表示する', () => {
    expect(html).toContain('id="btnAirport"');
    expect(html).toContain('🛫 空路');
    expect(html).toContain('id="airportDrawer"');
    expect(html).toContain('id="aptBody"');
    expect(html).toContain('id="apt-tooltip"');
  });

  it('活断層ページ由来の空港巡回処理を関数化して移植している', () => {
    expect(html).toContain('function setupAirportRoutes()');
    expect(html).toContain('var APT_REGIONS = [');
    expect(html).toContain("{code:'NRT',name:'成田国際空港'");
    expect(html).toContain('function flyToAirport(lat, lon, done)');
    expect(html).toContain('flyToAirport(a.lat, a.lon, function() { showAptTooltip(code); });');
  });

  it('空港名リンクとツールチップ内路線リンクから地球儀中心へ移動してツールチップを出す', () => {
    expect(html).toContain("body.querySelectorAll('.apt-item.clickable').forEach");
    expect(html).toContain("aptTooltipEl.querySelectorAll('.apt-tt-code').forEach");
    expect(html).toContain('openAptDrawerAndHighlight(dest);');
    expect(html).toContain('showAptTooltip(dest, code);');
    expect(html).toContain('if (window._aptRenderFrame) window._aptRenderFrame(mvp, model, W, H);');
  });

  it('ロシア・中国の空港はパネル・ツールチップ・地球儀マーカー対象から除外する', () => {
    expect(html).toContain('var HIDDEN_AIRPORT_CODES = { PVG:true, PEK:true, SVO:true };');
    expect(html).not.toContain("code:'PVG'");
    expect(html).not.toContain("code:'PEK'");
    expect(html).not.toContain("code:'SVO'");
    expect(html).not.toContain('上海浦東国際空港');
    expect(html).not.toContain('北京首都国際空港');
    expect(html).not.toContain('シェレメーチエヴォ国際空港');
  });

  it('ツールチップ内コードの存在強調とサイドパネルフォーカス、および閉じてもマーカー維持を実装する', () => {
    expect(html).toContain('.apt-tt-code.available');
    expect(html).toContain("var availableClass = aptByCode[rc] && aptDivMap[rc] ? ' available' : '';");
    expect(html).toContain('openAptDrawerAndHighlight(dest);');
    expect(html).toContain("item.classList.add('apt-flash');");
    expect(html).toContain("if (open) setAirportMarkers(true);");
    expect(html).toContain("document.getElementById('airportClose').addEventListener('click', function() {\n      drawer.classList.remove('open');\n    });");
  });
});
