import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { getAirlineNetworkPage } from './airlineNetwork';
import { AIRLINE_NETWORK, AIRLINE_NETWORK_CHECKED_AT } from '../data/airlineNetwork';
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

  it('デスクトップでは国選択パネルの上端を画面内に固定し、モバイルでは通常配置に戻す', () => {
    expect(html).toMatch(/\.left-panel\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*max-height:\s*100vh;/s);
    expect(html).toMatch(/@media \(max-width: 640px\)[\s\S]*?\.left-panel\s*\{[^}]*position:\s*static;[^}]*max-height:\s*none;/);
    expect(html).not.toMatch(/\.main-layout\s*\{[^}]*overflow:\s*hidden;/);
  });

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

  it('運航情報の確認日と便数が目安である旨を表示する', () => {
    expect(html).toContain(`<time datetime="${AIRLINE_NETWORK_CHECKED_AT}">${AIRLINE_NETWORK_CHECKED_AT}</time>`);
    expect(html).toContain('便数は季節で変動する目安です');
  });

  it('航空会社から空港コード同士の経路へつながるHTML canvas図を表示する', () => {
    const document = new JSDOM(html).window.document;
    const canvas = document.getElementById('route-network-canvas');

    expect(canvas).toBeInstanceOf(document.defaultView!.HTMLCanvasElement);
    expect(canvas!.getAttribute('role')).toBe('img');
    expect(canvas!.getAttribute('aria-label')).toContain('出発空港コード、到着空港コード');
    expect(document.getElementById('network-canvas-title')!.textContent).toContain('乗り入れ便航空会社 → 空港コード経路');
  });

  it('canvas路線図は路線種別と表示数を選び、航空会社→発着空港の順で描画する', () => {
    const document = new JSDOM(html, { runScripts: 'dangerously' }).window.document;
    const routeTypeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.route-type-btn'));
    const routeLimitButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.route-limit-btn'));

    expect(routeTypeButtons.map((button) => button.textContent)).toEqual(['両方(デフォルト値)', '国際線', '国内線']);
    expect(routeLimitButtons.map((button) => button.textContent)).toEqual(['6(デフォルト値)', '10', 'すべて']);
    expect(routeTypeButtons[0].classList.contains('active')).toBe(true);
    expect(routeLimitButtons[0].classList.contains('active')).toBe(true);
    expect(html).not.toContain('現在の絞り込み結果から上位6路線を表示');
    expect(html).toContain("row.getAttribute('data-route-type') === networkRouteType");
    expect(html).toContain("if (networkRouteLimit !== 'all') visibleRows = visibleRows.slice(0, networkRouteLimit)");
    expect(html).toContain("row.getAttribute('data-airline')");
    expect(html).toContain("row.getAttribute('data-hub-code')");
    expect(html).toContain("row.getAttribute('data-dest-code')");
    expect(html).toContain('drawRouteNetwork();');
    expect(html).toContain("window.addEventListener('resize', drawRouteNetwork);");

    routeTypeButtons[1].click();
    expect(routeTypeButtons[1].classList.contains('active')).toBe(true);
    expect(routeTypeButtons[1].getAttribute('aria-pressed')).toBe('true');
    routeLimitButtons[2].click();
    expect(routeLimitButtons[2].classList.contains('active')).toBe(true);
    expect(routeLimitButtons[2].getAttribute('aria-pressed')).toBe('true');
  });

  it('各路線を発着空港の国に基づいて国内線・国際線に分類する', () => {
    const document = new JSDOM(html).window.document;
    expect(document.querySelector('tr[data-hub-code="HND"][data-dest-code="KIX"]')?.getAttribute('data-route-type')).toBe('domestic');
    expect(document.querySelector('tr[data-hub-code="AMS"][data-dest-code="HND"]')?.getAttribute('data-route-type')).toBe('international');
    expect(document.querySelectorAll('tr[data-route-type="domestic"]').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('tr[data-route-type="international"]').length).toBeGreaterThan(0);
  });

  it('ルカラ空港とネパール2空港の双方向の発着便を表示する', () => {
    const nepal = AIRLINE_NETWORK.find((country) => country.country === 'ネパール');
    expect(nepal).toBeDefined();
    for (const hubCode of ['KTM', 'RHP']) {
      const outbound = nepal!.airlines.filter((airline) =>
        airline.hubCode === hubCode && airline.destinations.some((destination) => destination.code === 'LUA')
      );
      expect(outbound.map((airline) => airline.name)).toEqual(['Tara Air', 'Summit Air', 'Sita Air']);
      expect(outbound.every((airline) => airline.destinations.some((destination) => destination.code === 'LUA'))).toBe(true);
    }
    const lukla = nepal!.airlines.filter((airline) => airline.hubCode === 'LUA');
    expect(lukla.map((airline) => airline.name)).toEqual(['Tara Air', 'Summit Air', 'Sita Air']);
    expect(lukla.every((airline) => ['KTM', 'RHP'].every((code) =>
      airline.destinations.some((destination) => destination.code === code)
    ))).toBe(true);
    expect(html).toContain('テンジン・ヒラリー空港（ルカラ空港）');
    expect(html).toContain('トリブバン国際空港（カトマンズ）');
    expect(html).toContain('マンタリ空港（ラメチャップ空港）');
    expect(AIRPORT_LIST.find((airport) => airport.code === 'LUA')?.city).toBe('🇳🇵 ネパール・ルカラ');
    expect(AIRPORT_LIST.find((airport) => airport.code === 'KTM')).toBeDefined();
    expect(AIRPORT_LIST.find((airport) => airport.code === 'RHP')).toBeDefined();
  });

  it('カトマンズ発インド便の全就航空港と運航会社を表示する', () => {
    const nepal = AIRLINE_NETWORK.find((country) => country.country === 'ネパール')!;
    const indiaRoutes = nepal.airlines.filter((airline) =>
      airline.hubCode === 'KTM' && airline.destinations.some((destination) =>
        ['DEL', 'BOM', 'BLR', 'VNS'].includes(destination.code)
      )
    );

    expect(new Set(indiaRoutes.flatMap((airline) => airline.destinations
      .map((destination) => destination.code)
      .filter((code) => ['DEL', 'BOM', 'BLR', 'VNS'].includes(code)))))
      .toEqual(new Set(['DEL', 'BOM', 'BLR', 'VNS']));
    expect(indiaRoutes.map((airline) => airline.iata)).toEqual(['RA', 'AI', 'IX', '6E', 'B3', 'SG', 'U4']);
    for (const code of ['DEL', 'BOM', 'BLR', 'VNS']) {
      expect(AIRPORT_LIST.find((airport) => airport.code === code)?.city).toContain('🇮🇳 インド・');
    }
    expect(html).toContain('ケンペゴウダ国際空港（ベンガルール）');
    expect(html).toContain('ラール・バハードゥル・シャーストリー国際空港（バラナシ）');
  });

  it('ネパールの3国際空港を収録し、BWA・PKRの国内接続を双方向に表示する', () => {
    const nepal = AIRLINE_NETWORK.find((country) => country.country === 'ネパール')!;
    for (const code of ['KTM', 'BWA', 'PKR']) {
      expect(AIRPORT_LIST.find((airport) => airport.code === code)?.city).toContain('🇳🇵 ネパール・');
      expect(nepal.airlines.some((airline) => airline.hubCode === code)).toBe(true);
    }

    const buddhaRoutes = nepal.airlines.filter((airline) => airline.name === 'Buddha Air');
    for (const [origin, destination] of [['KTM', 'BWA'], ['BWA', 'KTM'], ['KTM', 'PKR'], ['PKR', 'KTM'], ['BWA', 'PKR'], ['PKR', 'BWA']]) {
      expect(buddhaRoutes.find((airline) => airline.hubCode === origin)?.destinations)
        .toEqual(expect.arrayContaining([expect.objectContaining({ code: destination })]));
    }
    expect(html).toContain('ガウタム・ブッダ国際空港（シッダールタナガル）');
    expect(html).toContain('ポカラ国際空港');
  });

  it('インドのデリーとムンバイをAir Indiaの双方向ネットワークとして表示する', () => {
    const india = AIRLINE_NETWORK.find((country) => country.country === 'インド');
    expect(india?.flag).toBe('🇮🇳');
    expect(india?.airlines.map((airline) => airline.hubCode)).toEqual(['DEL', 'BOM']);
    expect(india?.airlines.every((airline) => airline.name === 'Air India' && airline.iata === 'AI')).toBe(true);
    expect(india?.airlines.find((airline) => airline.hubCode === 'DEL')?.destinations)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'BOM' })]));
    expect(india?.airlines.find((airline) => airline.hubCode === 'BOM')?.destinations)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DEL' })]));
    for (const code of ['DEL', 'BOM']) {
      expect(AIRPORT_LIST.find((airport) => airport.code === code)?.city).toContain('🇮🇳 インド・');
    }
  });

  it('日本の既知の国際空港間を運航する全社の往復便を表示する', () => {
    const japan = AIRLINE_NETWORK.find((country) => country.country === '日本')!;
    const expectedRoutes = [
      { origin: 'HND', destination: 'KIX', iatas: ['NH', 'JL', '7G'] },
      { origin: 'KIX', destination: 'HND', iatas: ['NH', 'JL', '7G'] },
      { origin: 'NRT', destination: 'KIX', iatas: ['GK', 'MM'] },
      { origin: 'KIX', destination: 'NRT', iatas: ['GK', 'MM'] }
    ];

    for (const route of expectedRoutes) {
      const operators = japan.airlines
        .filter((airline) => airline.hubCode === route.origin &&
          airline.destinations.some((destination) => destination.code === route.destination))
        .map((airline) => airline.iata);
      expect(operators).toEqual(route.iatas);
    }
    for (const code of ['NRT', 'HND', 'KIX']) {
      expect(AIRPORT_LIST.find((airport) => airport.code === code)?.city).toContain('🇯🇵 日本・');
      expect(japan.airlines.some((airline) => airline.hubCode === code)).toBe(true);
    }
  });

  it('羽田へ移管済みの主要5社を成田発着として表示しない', () => {
    for (const iata of ['DL', 'BA', 'AF', 'LH', 'AZ']) {
      const airline = AIRLINE_NETWORK.flatMap((country) => country.airlines).find((item) => item.iata === iata);
      expect(airline).toBeDefined();
      expect(airline!.destinations.find((destination) => destination.code === 'HND')).toBeDefined();
      expect(airline!.destinations.find((destination) => destination.code === 'NRT')).toBeUndefined();
    }
  });

  it('AMS発着はネパール国内線を除く登録済みの全空港を網羅する', () => {
    const registeredCodes = new Set<string>();
    for (const country of AIRLINE_NETWORK) if (country.country !== 'ネパール') for (const airline of country.airlines) {
      registeredCodes.add(airline.hubCode);
      for (const destination of airline.destinations) registeredCodes.add(destination.code);
    }

    const ams = AIRLINE_NETWORK.flatMap((country) => country.airlines)
      .find((airline) => airline.hubCode === 'AMS');
    expect(ams).toBeDefined();
    const amsCodes = new Set(ams!.destinations.map((destination) => destination.code));
    registeredCodes.delete('AMS');
    expect(amsCodes).toEqual(registeredCodes);
  });

  it('PRG発着はネパール国内線を除く登録済みの全空港との往復便を網羅する', () => {
    const registeredCodes = new Set<string>();
    for (const country of AIRLINE_NETWORK) if (country.country !== 'ネパール') for (const airline of country.airlines) {
      registeredCodes.add(airline.hubCode);
      for (const destination of airline.destinations) registeredCodes.add(destination.code);
    }

    const prg = AIRLINE_NETWORK.flatMap((country) => country.airlines)
      .find((airline) => airline.hubCode === 'PRG');
    expect(prg).toBeDefined();
    const prgCodes = new Set(prg!.destinations.map((destination) => destination.code));
    registeredCodes.delete('PRG');
    expect(prgCodes).toEqual(registeredCodes);
    expect(prg!.destinations.every((destination) => destination.flightsPerWeek === 7)).toBe(true);
  });

  it('検索ボックスと国別フィルタが両方JSに実装されている', () => {
    expect(html).toContain("document.getElementById('search-box')");
    expect(html).toContain('matchesCountry');
    expect(html).toContain('matchesSearch');
  });

  it('件数表示の右側に通常・簡易の空港名表示トグルがある', () => {
    const hitCountIndex = html.indexOf('id="hit-count"');
    const normalButtonIndex = html.indexOf('id="airport-name-normal-btn"');
    const compactButtonIndex = html.indexOf('id="airport-name-compact-btn"');
    const tableIndex = html.indexOf('<div class="table-wrap">');
    expect(hitCountIndex).toBeGreaterThan(-1);
    expect(normalButtonIndex).toBeGreaterThan(hitCountIndex);
    expect(compactButtonIndex).toBeGreaterThan(normalButtonIndex);
    expect(tableIndex).toBeGreaterThan(compactButtonIndex);
    expect(html).toContain('>通常</button>');
    expect(html).toContain('>簡易</button>');
  });

  it('簡易表示では表内の拠点・乗り入れ空港名を隠し、空港コードだけを表示する', () => {
    expect(html).toContain('<span class="airport-name">');
    expect(html).toContain('.compact-airports .airport-name { display: none; }');
    expect(html).toContain('function setAirportNameDisplay(compact)');
    expect(html).toContain("document.body.classList.toggle('compact-airports', compact);");
    expect(html).toContain("airportNameCompactBtn.addEventListener('click', function () { setAirportNameDisplay(true); });");
    expect(html).toContain("airportNameNormalBtn.addEventListener('click', function () { setAirportNameDisplay(false); });");
  });

  it('簡易表示では発空港の右に○/△と改行した着空港の見出しを表示する', () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const { document } = dom.window;
    const compactButton = document.getElementById('airport-name-compact-btn')!;

    compactButton.click();

    const headers = Array.from(document.querySelectorAll('thead th'));
    const originHeaderIndex = headers.findIndex((header) => header.textContent!.includes('発空港'));
    const destinationHeader = headers[originHeaderIndex + 1];
    expect(originHeaderIndex).toBeGreaterThan(-1);
    expect(destinationHeader.classList.contains('col-dest')).toBe(true);
    expect(destinationHeader.innerHTML).not.toContain('(<button');
    expect(destinationHeader.textContent).toContain('◯/△');
    expect(destinationHeader.querySelector('br')).not.toBeNull();
    expect(destinationHeader.textContent).toContain('着空港');
  });

  it('簡易表示では着空港の右に○/△と改行した🏁の国旗カラムを表示する', () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const { document } = dom.window;
    (document.getElementById('airport-name-compact-btn') as HTMLButtonElement).click();

    const compactFlagHeader = document.querySelector('th.col-dest-flag .compact-only')!;
    expect(compactFlagHeader.textContent).toContain('◯/△');
    expect(compactFlagHeader.querySelector('br')).not.toBeNull();
    expect(compactFlagHeader.textContent).toContain('🏁');
    expect(compactFlagHeader.textContent!.indexOf('◯/△')).toBeLessThan(compactFlagHeader.textContent!.indexOf('🏁'));
    expect(compactFlagHeader.querySelector('#dest-flag-filter-btn-compact')).not.toBeNull();
  });

  it('簡易ボタンで空港名を非表示にし、通常ボタンで元に戻す', () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const { document } = dom.window;
    const compactButton = document.getElementById('airport-name-compact-btn')!;
    const normalButton = document.getElementById('airport-name-normal-btn')!;

    compactButton.click();
    expect(document.body.classList.contains('compact-airports')).toBe(true);
    expect(compactButton.getAttribute('aria-pressed')).toBe('true');
    expect(normalButton.getAttribute('aria-pressed')).toBe('false');

    normalButton.click();
    expect(document.body.classList.contains('compact-airports')).toBe(false);
    expect(normalButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('通常・簡易モードをCookieに保存し、ページ読み込み時に復元する', () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.com/airline-network' });
    const { document } = dom.window;

    (document.getElementById('airport-name-compact-btn') as HTMLButtonElement).click();
    expect(document.cookie).toContain('airline_network_display_mode=compact');
    expect(html).toContain("setAirportNameDisplay(getCookieValue(DISPLAY_MODE_COOKIE_NAME) === 'compact');");

    (document.getElementById('airport-name-normal-btn') as HTMLButtonElement).click();
    expect(document.cookie).toContain('airline_network_display_mode=normal');
  });

  it('初期表示と垂直タブの「すべて」選択時に国カラムの枠を3回点滅する', () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const { document } = dom.window;
    const table = document.getElementById('route-table')!;

    expect(table.classList.contains('country-column-flash')).toBe(true);
    expect(html).toContain('animation: country-column-outline 0.4s ease-in-out 3;');
    expect(html).toContain("if (currentCountry === '__all__') flashCountryColumn();");

    document.querySelector<HTMLButtonElement>('.country-btn:not([data-country="__all__"])')!.click();
    document.querySelector<HTMLButtonElement>('.country-btn[data-country="__all__"]')!.click();
    expect(table.classList.contains('country-column-flash')).toBe(true);
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
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const destinationHeader = dom.window.document.querySelector('th.col-dest');
    expect(destinationHeader).not.toBeNull();
    expect(destinationHeader!.textContent).toContain('乗り入れ空港');
    expect(destinationHeader!.querySelector('#dest-filter-btn.th-filter-btn')).not.toBeNull();
  });

  it('乗り入れ空港の国旗を着空港の右の専用カラムに表示し、thの🏁ボタンから国旗で絞り込める', () => {
    expect(html).toContain('<th class="col-dest-flag"><span class="normal-only"><button type="button" id="dest-flag-filter-btn"');
    const document = new JSDOM(html).window.document;

    for (const code of uniqueDestCodes()) {
      const apt = AIRPORT_LIST.find((a) => a.code === code);
      expect(apt).toBeDefined();
      const flag = apt!.city.split(' ')[0];
      expect(html).toContain(`data-dest-code="${code}"`);
      expect(html).toContain(`data-dest-flag="${flag}"`);
      expect(html).toContain(`<td class="col-dest-flag">${flag}</td>`);
      const row = document.querySelector(`tr[data-dest-code="${code}"]`)!;
      expect(row.querySelector('.col-dest')!.nextElementSibling!.classList.contains('col-dest-flag')).toBe(true);
      expect(row.querySelector('.col-dest-flag')!.textContent).toBe(flag);
    }

    expect(html).toContain("destFlagFilterBtn.addEventListener('click', openDestFlagFilterModal);");
    expect(html).toContain("destFlagFilterCompactBtn.addEventListener('click', openDestFlagFilterModal);");
    expect(html).toContain("selectedDestFlags.indexOf(row.getAttribute('data-dest-flag')) !== -1");
  });

  it('全路線を便数の多い順に描画する', () => {
    const tbody = html.match(/<tbody id="route-tbody">([\s\S]*?)<\/tbody>/);
    expect(tbody).toBeTruthy();
    const frequencies = Array.from(tbody![1].matchAll(/<td class="col-freq">(\d+)/g), (match) => Number(match[1]));
    expect(frequencies.length).toBeGreaterThan(0);
    expect(frequencies).toEqual([...frequencies].sort((a, b) => b - a));
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

  it('チェコのPRG拠点がネットワークに追加されている', () => {
    const czechia = AIRLINE_NETWORK.find((c) => c.country === 'チェコ');
    expect(czechia).toBeDefined();

    const prgAirline = czechia!.airlines.find((airline) => airline.hubCode === 'PRG');
    expect(prgAirline).toBeDefined();
    expect(prgAirline!.hubName).toBe('ヴァーツラフ・ハヴェル・プラハ国際空港');
    expect(html).toContain('data-country="チェコ"');
    expect(html).toContain('ヴァーツラフ・ハヴェル・プラハ国際空港');
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
