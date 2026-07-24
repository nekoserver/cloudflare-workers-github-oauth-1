import { describe, expect, it } from 'vitest';
import { getAirlineNetworkPage } from './airlineNetwork';
import { AIRLINE_NETWORK } from '../data/airlineNetwork';
import { AIRPORT_LIST } from '../data/airports';

function uniqueDestCodes(): string[] {
  const seen = new Set<string>();
  for (const c of AIRLINE_NETWORK) {
    for (const airline of c.airlines) {
      for (const dest of airline.destinations) {
        seen.add(dest.code);
      }
    }
  }
  return Array.from(seen);
}

function uniqueCountryHubKeys(): string[] {
  const seen = new Set<string>();
  for (const c of AIRLINE_NETWORK) {
    for (const airline of c.airlines) {
      seen.add(`${c.country}::${airline.hubCode}`);
    }
  }
  return Array.from(seen);
}

describe('/airline-network ページ: 各国航空会社ネットワーク一覧', () => {
  const html = getAirlineNetworkPage();

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('国別の切り替えボタンがすべて表示される', () => {
    for (const c of AIRLINE_NETWORK) {
      expect(html).toContain(`data-country="${c.country}"`);
      expect(html).toContain(`${c.flag} ${c.country}`);
    }
  });

  it('全ての航空会社・拠点空港・乗り入れ空港・便数がテーブルに含まれる', () => {
    for (const c of AIRLINE_NETWORK) {
      for (const airline of c.airlines) {
        expect(html).toContain(airline.name);
        expect(html).toContain(airline.hubName);
        for (const dest of airline.destinations) {
          expect(html).toContain(dest.name);
          expect(html).toContain(String(dest.flightsPerWeek));
        }
      }
    }
  });

  it('サマリーバーに国数・航空会社数・路線数の集計値が表示される', () => {
    const countryCount = AIRLINE_NETWORK.length;
    const airlineCount = AIRLINE_NETWORK.reduce((sum, c) => sum + c.airlines.length, 0);
    const routeCount = AIRLINE_NETWORK.reduce(
      (sum, c) => sum + c.airlines.reduce((s2, a) => s2 + a.destinations.length, 0),
      0
    );
    expect(html).toContain(`<b>${countryCount}</b>`);
    expect(html).toContain(`<b>${airlineCount}</b>`);
    expect(html).toContain(`<b>${routeCount}</b>`);
  });

  it('検索ボックスと国別フィルタが両方JSに実装されている', () => {
    expect(html).toContain("document.getElementById('search-box')");
    expect(html).toContain('matchesCountry');
    expect(html).toContain('matchesSearch');
  });

  it('該当0件の場合の空表示メッセージ要素が存在する', () => {
    expect(html).toContain('id="no-hit"');
    expect(html).toContain('該当する路線が見つかりません');
  });

  it('各テーブル行に data-dest-code 属性が設定されている', () => {
    for (const code of uniqueDestCodes()) {
      expect(html).toContain(`data-dest-code="${code}"`);
    }
  });

  it('「乗り入れ空港」th内にフィルタボタンが配置されている', () => {
    const thMatch = html.match(/<th>乗り入れ空港[\s\S]*?<\/th>/);
    expect(thMatch).toBeTruthy();
    expect(thMatch![0]).toContain('id="dest-filter-btn"');
    expect(thMatch![0]).toContain('class="th-filter-btn"');
  });

  it('モーダルに全乗り入れ空港のチェックボックス(国旗/空港名/コード)がデフォルトONで並ぶ', () => {
    const modalMatch = html.match(/<div class="modal-body" id="dest-filter-list">[\s\S]*?<\/div>/);
    expect(modalMatch).toBeTruthy();
    const modalHtml = modalMatch![0];
    for (const code of uniqueDestCodes()) {
      expect(modalHtml).toContain(`value="${code}"`);
      const apt = AIRPORT_LIST.find((a) => a.code === code);
      if (apt) {
        const flag = apt.city.split(' ')[0];
        expect(modalHtml).toContain(flag);
      }
    }
    // デフォルトはすべてチェック済み
    const checkboxBlocks = modalHtml.match(/<input type="checkbox" class="dest-check"[^>]*>/g) ?? [];
    expect(checkboxBlocks.length).toBe(uniqueDestCodes().length);
    checkboxBlocks.forEach((block) => expect(block).toContain('checked'));
  });

  it('モーダルが最上位レイヤーとして表示されるよう z-index を動的に算出する(getNextZ)', () => {
    expect(html).toContain('function getNextZ()');
    expect(html).toContain("document.querySelectorAll('body *')");
    expect(html).toContain("destFilterBackdrop.style.zIndex = String(z);");
    expect(html).toContain("destFilterModal.style.zIndex = String(z + 1);");
    // 固定z-indexの直書きが無いことを確認
    expect(html).not.toMatch(/#dest-filter-modal\s*\{[^}]*z-index\s*:\s*\d/);
  });

  it('適用ボタンでチェック済み空港のみを表示するフィルタが適用される', () => {
    expect(html).toContain('matchesDest');
    expect(html).toContain("selectedDestCodes.indexOf(row.getAttribute('data-dest-code')) !== -1");
    expect(html).toContain("destFilterApply.addEventListener('click'");
  });

  it('適用時に選択状態がCookieへ保存される', () => {
    expect(html).toContain("var DEST_COOKIE_NAME = 'airline_network_dest_airports';");
    expect(html).toContain('setCookieValue(DEST_COOKIE_NAME, selectedDestCodes.join(\',\'));');
    expect(html).toContain("Path=/; Secure; SameSite=Lax; Max-Age=31536000");
  });

  it('ページ読み込み時にCookieの保存値を読み込んで初期選択に反映する', () => {
    expect(html).toContain('function loadSelectedDestCodes()');
    expect(html).toContain('var selectedDestCodes = loadSelectedDestCodes();');
    expect(html).toContain('getCookieValue(DEST_COOKIE_NAME)');
  });

  it('キャンセル・×ボタン・背景クリックでモーダルを閉じられる', () => {
    expect(html).toContain("destFilterClose.addEventListener('click', closeDestFilterModal);");
    expect(html).toContain("destFilterCancel.addEventListener('click', closeDestFilterModal);");
    expect(html).toContain("destFilterBackdrop.addEventListener('click', closeDestFilterModal);");
  });

  it('イタリア・スペインの航空会社が追加されている', () => {
    const italy = AIRLINE_NETWORK.find((c) => c.country === 'イタリア');
    const spain = AIRLINE_NETWORK.find((c) => c.country === 'スペイン');
    expect(italy).toBeDefined();
    expect(spain).toBeDefined();
    expect(italy!.airlines.length).toBeGreaterThan(0);
    expect(spain!.airlines.length).toBeGreaterThan(0);
    expect(html).toContain('ITA Airways');
    expect(html).toContain('Iberia');
    expect(html).toContain('data-country="イタリア"');
    expect(html).toContain('data-country="スペイン"');
  });

  it('「国」th内にフィルタボタンが配置されている', () => {
    const thMatch = html.match(/<th>国[\s\S]*?<\/th>/);
    expect(thMatch).toBeTruthy();
    expect(thMatch![0]).toContain('id="country-filter-btn"');
    expect(thMatch![0]).toContain('class="th-filter-btn"');
  });

  it('各テーブル行に data-hub-key(経由国::拠点空港コード) 属性が設定されている', () => {
    for (const key of uniqueCountryHubKeys()) {
      expect(html).toContain(`data-hub-key="${key}"`);
    }
  });

  it('国別モーダルに全経由国×拠点空港のチェックボックス(国旗/空港名/コード)がデフォルトONで並ぶ', () => {
    const modalMatch = html.match(/<div class="modal-body" id="country-filter-list">[\s\S]*?<\/div>\s*<\/div>/);
    expect(modalMatch).toBeTruthy();
    const modalHtml = modalMatch![0];
    for (const c of AIRLINE_NETWORK) {
      for (const airline of c.airlines) {
        const key = `${c.country}::${airline.hubCode}`;
        expect(modalHtml).toContain(`value="${key}"`);
        expect(modalHtml).toContain(c.flag);
        expect(modalHtml).toContain(airline.hubName);
        expect(modalHtml).toContain(airline.hubCode);
      }
    }
    const checkboxBlocks = modalHtml.match(/<input type="checkbox" class="country-hub-check"[^>]*>/g) ?? [];
    expect(checkboxBlocks.length).toBe(uniqueCountryHubKeys().length);
    checkboxBlocks.forEach((block) => expect(block).toContain('checked'));
  });

  it('国別モーダルもgetNextZ()でz-indexを動的に算出し固定値を直書きしない', () => {
    expect(html).toContain("countryFilterBackdrop.style.zIndex = String(z);");
    expect(html).toContain("countryFilterModal.style.zIndex = String(z + 1);");
    expect(html).not.toMatch(/#country-filter-modal\s*\{[^}]*z-index\s*:\s*\d/);
  });

  it('適用ボタンでチェックを外した経由国の空港のみ非表示になるフィルタが適用される', () => {
    expect(html).toContain('matchesCountryHub');
    expect(html).toContain("selectedCountryHubs.indexOf(row.getAttribute('data-hub-key')) !== -1");
    expect(html).toContain("countryFilterApply.addEventListener('click'");
  });

  it('国別モーダルの選択状態もCookieへ保存・復元される', () => {
    expect(html).toContain("var COUNTRY_HUB_COOKIE_NAME = 'airline_network_country_hubs';");
    expect(html).toContain('setCookieValue(COUNTRY_HUB_COOKIE_NAME, selectedCountryHubs.join(\',\'));');
    expect(html).toContain('function loadSelectedCountryHubs()');
    expect(html).toContain('var selectedCountryHubs = loadSelectedCountryHubs();');
    expect(html).toContain('getCookieValue(COUNTRY_HUB_COOKIE_NAME)');
  });

  it('チェックを外した国の左サイドパネルボタンが非表示になる(updateCountryPanelVisibility)', () => {
    expect(html).toContain('function updateCountryPanelVisibility()');
    expect(html).toContain("btn.style.display = visibleCountries[country] ? '' : 'none';");
    expect(html).toContain('updateCountryPanelVisibility();');
    // apply時にも呼ばれること
    const applyIdx = html.indexOf("countryFilterApply.addEventListener('click'");
    const applyBlock = html.slice(applyIdx, applyIdx + 400);
    expect(applyBlock).toContain('updateCountryPanelVisibility();');
  });

  it('現在選択中の国が非表示になった場合はすべてにリセットする', () => {
    expect(html).toContain("currentCountry = '__all__';");
    expect(html).toContain("b.classList.toggle('active', b.getAttribute('data-country') === '__all__');");
  });

  it('国別モーダルもキャンセル・×・背景クリックで閉じられる', () => {
    expect(html).toContain("countryFilterClose.addEventListener('click', closeCountryFilterModal);");
    expect(html).toContain("countryFilterCancel.addEventListener('click', closeCountryFilterModal);");
    expect(html).toContain("countryFilterBackdrop.addEventListener('click', closeCountryFilterModal);");
  });

  it('片方のモーダルを開くともう片方は閉じる', () => {
    const openDestIdx = html.indexOf('function openDestFilterModal()');
    const openDestBlock = html.slice(openDestIdx, openDestIdx + 200);
    expect(openDestBlock).toContain('closeCountryFilterModal();');

    const openCountryIdx = html.indexOf('function openCountryFilterModal()');
    const openCountryBlock = html.slice(openCountryIdx, openCountryIdx + 200);
    expect(openCountryBlock).toContain('closeDestFilterModal();');
  });
});
