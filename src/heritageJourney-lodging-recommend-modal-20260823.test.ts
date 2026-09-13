import { describe, expect, it } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

const html = getHeritageJourneyPage();

describe('heritage-journeyページ: 宿泊推奨地モーダル', () => {
  it('巡回ルートスコープの後に最上位の宿泊推奨地モーダルを描画する', () => {
    expect(html.indexOf('id="lodging-recommend-modal"')).toBeGreaterThan(html.indexOf('id="tour-mini-panel"'));
    expect(html).toContain('.lodging-recommend-modal{position:fixed');
    expect(html).toContain('z-index:10001');
    expect(html).toContain('aria-labelledby="lodging-recommend-title"');
  });

  it('日ごとの都市名を列挙し、次の1日へ進められる', () => {
    expect(html).toContain('data-lodging-day=');
    expect(html).toContain('Day \' + (i + 1) + \' \' + esc(p.name)');
    expect(html).toContain("lodgingNextBtn.addEventListener('click'");
    expect(html).toContain('selectLodgingDay(lodgingDayIndex + 1)');
  });

  it('薄緑丸を宿泊推奨都市の座標へ移し、既存巡回をOFFにする', () => {
    expect(html).toContain('overlay.classList.contains(\'open\') ? null : lodgingDayPoints[lodgingDayIndex]');
    expect(html).toContain('|| pointAtProgress(tourPoints, animProgress);');
    expect(html).toContain("ctx.fillStyle = '#86efac'");
    expect(html).toContain('playBtn.disabled = true');
    expect(html).toContain("playBtn.textContent = '巡回OFF（宿泊地モード）'");
  });

  it('宿泊推奨地と巡回ルートスコープは、操作またはフォーカスされた側を最上位にする', () => {
    expect(html).toContain('[miniPanel, lodgingModal, airportNetworkModal].forEach(function(panel)');
    expect(html).toContain("panel.addEventListener('pointerdown', function() { activateFloatingPanel(panel); })");
    expect(html).toContain("panel.addEventListener('focusin', function() { activateFloatingPanel(panel); })");
    expect(html).toContain('panel.style.zIndex = String(floatingPanelZ)');
  });
});
