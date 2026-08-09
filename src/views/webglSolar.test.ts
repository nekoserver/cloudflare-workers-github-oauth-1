import { describe, it, expect } from 'vitest';
import { getWebGLSolarPage } from './webglSolar';

describe('getWebGLSolarPage', () => {
  const html = getWebGLSolarPage('tester');

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

  function extractRadArrays() {
    const lonMatch = html.match(/var starLon = \[([^\]]*)\];/);
    const latMatch = html.match(/var starLat = \[([^\]]*)\];/);
    expect(lonMatch).not.toBeNull();
    expect(latMatch).not.toBeNull();
    return {
      lons: lonMatch![1].split(',').map((s) => parseFloat(s.trim())),
      lats: latMatch![1].split(',').map((s) => parseFloat(s.trim())),
    };
  }

  it('starLon と starLat の要素数が一致し、星座線のインデックスが配列範囲内にある', () => {
    const { lons, lats } = extractRadArrays();
    expect(lons.length).toBe(lats.length);
    const linesMatch = html.match(/var skyConstellationLines = \[([\s\S]*?)\n  \];/);
    expect(linesMatch).not.toBeNull();
    const indices = Array.from(linesMatch![1].matchAll(/indices: \[([^\]]*)\]/g))
      .flatMap((m) => m[1].split(',').map((s) => parseInt(s.trim(), 10)));
    expect(indices.length).toBeGreaterThan(0);
    for (const idx of indices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(lons.length);
    }
  });

  it('うお座・おひつじ座・おうし座・プレセペの各星が黄道座標(J2000)で登録されている', () => {
    const { lons, lats } = extractRadArrays();
    // 期待値: J2000 の黄道経度λ・黄道緯度β (rad)。
    // starLon/starLat は自転モード(projectSky)・今日の空モード(projectEclipticSky)の
    // 両方で黄道座標として扱われるため、赤道座標(RA/Dec)で登録すると星座が歪む。
    const expected: Array<{ idx: number; name: string; lon: number; lat: number }> = [
      { idx: 13, name: 'プレセペ星団',       lon: 2.2227, lat: 0.0223 },
      { idx: 18, name: 'プレアデス星団',     lon: 1.0471, lat: 0.0707 },
      { idx: 20, name: 'シェラタン',         lon: 0.5929, lat: 0.1481 },
      { idx: 21, name: 'ハマル',             lon: 0.6573, lat: 0.1739 },
      { idx: 22, name: 'メサルティム',       lon: 0.5792, lat: 0.1250 },
      { idx: 23, name: 'アルレシャ',         lon: 0.5128, lat: -0.1581 },
      { idx: 24, name: 'フム・アル・サマカー', lon: 6.0840, lat: 0.1580 },
      { idx: 25, name: 'トルクラー',         lon: 0.4842, lat: -0.0283 },
      { idx: 26, name: 'エルナト',           lon: 1.4412, lat: 0.0940 },
      { idx: 27, name: 'ゼータ・タウリ',     lon: 1.4798, lat: -0.0383 },
    ];
    for (const e of expected) {
      expect(Math.abs(lons[e.idx] - e.lon), `${e.name} の黄道経度`).toBeLessThan(0.02);
      expect(Math.abs(lats[e.idx] - e.lat), `${e.name} の黄道緯度`).toBeLessThan(0.02);
    }
  });

  function extractProject3D() {
    const m = html.match(/function project3D\(dX, dY, dZ\) \{[\s\S]*?\n  \}/);
    expect(m).not.toBeNull();
    const factory = new Function(
      'viewAngle', 'viewElev', 'fovH', 'W', 'H', 'skyViewMode',
      m![0] + '\nreturn project3D;'
    );
    return (mode: string) =>
      factory(0, 0.5, Math.PI * 0.6, 1000, 800, mode) as (
        x: number, y: number, z: number
      ) => { x: number; y: number } | null;
  }

  // 直線透視(ピンホール)投影は天球上の大円(経線・赤道)をすべて画面上の直線に
  // 写すため、グリッドがドーム状に見えない。天球を見上げる6モードすべてが
  // 平射(ステレオ)投影で大円が円弧に曲がることを検証する。
  it('天球を見上げる全モードで大円がドーム状の曲線として投影される', () => {
    const make = extractProject3D();
    for (const mode of ['today', 'pole', 'spin', 'earth', 'moon', 'iss']) {
      const project = make(mode);
      const center = project(Math.cos(0.5), 0, Math.sin(0.5));
      expect(center, mode + ': 視線中心').not.toBeNull();
      expect(center!.x).toBeCloseTo(500, 3);
      expect(center!.y).toBeCloseTo(400, 3);
      const p1 = project(Math.cos(-0.7), Math.sin(-0.7), 0);
      const p2 = project(1, 0, 0);
      const p3 = project(Math.cos(0.7), Math.sin(0.7), 0);
      expect(p1 && p2 && p3, mode + ': 赤道上の3点が投影可能').toBeTruthy();
      const cross = (p2!.x - p1!.x) * (p3!.y - p1!.y) - (p2!.y - p1!.y) * (p3!.x - p1!.x);
      expect(Math.abs(cross), mode + ': 大円がドーム状に曲がる').toBeGreaterThan(1000);
    }
  });

  it('既定の太陽系ビュー(\'\')と夏至モードは project3D を経由しない直線透視のまま', () => {
    const make = extractProject3D();
    for (const mode of ['', 'solstice']) {
      const project = make(mode);
      const p1 = project(Math.cos(-0.7), Math.sin(-0.7), 0);
      const p2 = project(1, 0, 0);
      const p3 = project(Math.cos(0.7), Math.sin(0.7), 0);
      expect(p1 && p2 && p3, mode + ': 赤道上の3点が投影可能').toBeTruthy();
      const cross = (p2!.x - p1!.x) * (p3!.y - p1!.y) - (p2!.y - p1!.y) * (p3!.x - p1!.x);
      expect(Math.abs(cross), mode + ': 大円は直線のまま').toBeLessThan(1e-3);
    }
  });

  // 画面の左右端に近づくほど歪みが大きくなる不具合は、直線透視の拡大率が
  // 1/cos(θ)(視線からの角度θ)で θ→90° に発散することが原因だった。
  // 平射投影の拡大率は sec^2(θ/2) という有界な式に従うため、視線中心からの
  // 画面上の半径 r は tan(θ/2) に比例するはずである。この比例関係が
  // 複数の角度で一定であることを確認し、拡大率が発散しないことを保証する。
  it('天球モードでは画面半径がtan(θ/2)に比例し、拡大率が視野角に対して発散しない', () => {
    const make = extractProject3D();
    const elev = 0.5;
    const cosE = Math.cos(elev), sinE = Math.sin(elev);
    // テストハーネスの fovH=0.6π(半視野角54°)の範囲内に収まる角度のみを使う
    const angles = [10, 22, 34, 46].map((deg) => (deg * Math.PI) / 180);
    for (const mode of ['today', 'pole', 'spin', 'earth', 'moon', 'iss']) {
      const project = make(mode);
      const ratios: number[] = [];
      for (const th of angles) {
        // v(θ) = cosθ*F + sinθ*R (F=視線前方, R=右方向)。F・R=0, |F|=|R|=1 なので
        // v(θ)・F = cosθ となり、v(θ) は視線から角度θだけ離れた単位ベクトルになる。
        const v = { x: Math.cos(th) * cosE, y: -Math.sin(th), z: Math.cos(th) * sinE };
        const p = project(v.x, v.y, v.z);
        expect(p, mode + ' θ=' + th).not.toBeNull();
        const r = Math.hypot(p!.x - 500, p!.y - 400);
        ratios.push(r / Math.tan(th / 2));
      }
      const base = ratios[0];
      for (const ratio of ratios) {
        expect(Math.abs(ratio - base) / base, mode + ': r/tan(θ/2) が一定').toBeLessThan(0.02);
      }
    }
  });

  it('「8月12(13)日」ボタンがカレンダーパネル内に存在する', () => {
    expect(html).toContain('id="btnEclipseDate"');
    expect(html).toContain('8月12(13)日');
    expect(html).toContain("btnEclipseDate.addEventListener('click', showEclipseDateInCalendar);");
  });

  it('7日間・8/13まで・日食(アイスランド/スペイン)のボタンはカレンダーパネルを閉じない', () => {
    const weekM = html.match(/function startWeekReplay\(days\) \{[\s\S]*?\n  \}/);
    const untilM = html.match(/function startReplayUntilDate\(y, mo, d\) \{[\s\S]*?\n  \}/);
    const eclipseM = html.match(/function startEclipse\(siteKey\) \{[\s\S]*?\n  \}/);
    expect(weekM).not.toBeNull();
    expect(untilM).not.toBeNull();
    expect(eclipseM).not.toBeNull();
    for (const body of [weekM![0], untilM![0], eclipseM![0]]) {
      expect(body).not.toContain("classList.remove('open')");
      expect(body).not.toContain("aria-expanded', 'false'");
    }
  });


  it('「今日から2週間」ボタンを「8/13まで」に変更し、8月13日末まで再現する', () => {
    expect(html).toContain('id="btnTwoWeekReplay">8/13まで</button>');
    expect(html).not.toContain('id="btnTwoWeekReplay">今日から2週間</button>');
    expect(html).toContain("btnTwoWeekReplay.addEventListener('click', function() { startReplayUntilDate(2026, 8, 13); });");
    expect(html).toContain('var endJD = julianDate(y, mo, d, 23.999);');
    expect(html).toContain("startCalendarReplay(startJD, endJD, mo + '/' + d + 'まで');");
  });

  it('トップ俯瞰図・自転モードでは期間再現ボタンを押しても今日の空へ切り替えない', () => {
    const replayM = html.match(/function startCalendarReplay\(startJD, endJD, label\) \{[\s\S]*?\n  \}/);
    expect(replayM).not.toBeNull();
    expect(replayM![0]).toContain("if (skyViewMode === '')");
    expect(replayM![0]).toContain('selectedTopViewJD = weekReplayJD;');
    expect(replayM![0]).toContain("else if (skyViewMode === 'spin')");
    expect(replayM![0].indexOf("else if (skyViewMode === 'spin')")).toBeLessThan(replayM![0].indexOf('ensureTodaySkyMode();'));
    expect(replayM![0]).toContain('ensureTodaySkyMode();');

    const currentM = html.match(/function currentSimulatedJD\(\) \{[\s\S]*?\n  \}/);
    expect(currentM).not.toBeNull();
    expect(currentM![0]).toContain("if (skyViewMode === '' && weekReplayActive) return weekReplayJD;");
    expect(currentM![0]).toContain("if (skyViewMode === 'spin' && weekReplayActive) return weekReplayJD;");

    const frameM = html.match(/function frame\(now\) \{[\s\S]*?ctx.fillStyle = '#000010';/);
    expect(frameM).not.toBeNull();
    expect(frameM![0]).toContain('var topProgress = Math.min(1, weekReplayElapsed / weekReplayDuration);');
    expect(frameM![0]).toContain('selectedTopViewJD = weekReplayJD;');
    expect(frameM![0]).toContain('syncCalendarToJD(weekReplayJD, false);');

    const spinM = frameM![0].match(/if \(skyViewMode === 'spin'\) \{[\s\S]*?\n      return;\n    \}/);
    expect(spinM).not.toBeNull();
    expect(spinM![0]).toContain('if (weekReplayActive)');
    expect(spinM![0]).toContain('var spinProgress = Math.min(1, weekReplayElapsed / weekReplayDuration);');
    expect(spinM![0]).toContain('syncCalendarToJD(weekReplayJD, false);');
    expect(spinM![0]).not.toContain('ensureTodaySkyMode');
    expect(spinM![0]).not.toContain("setSkyMode('today')");
  });

  it('今日の空(週間再現)・日食モードの再生中、フレームごとにカレンダーの黄色い枠をsyncCalendarToJDで同期する', () => {
    const frameM = html.match(/function frame\(now\) \{[\s\S]*?\n  \}/);
    expect(frameM).not.toBeNull();
    const frameBody = frameM![0];
    const todayBranch = frameBody.match(/if \(skyViewMode === 'today'\) \{[\s\S]*?\n    \}/);
    const eclipseBranch = frameBody.match(/if \(skyViewMode === 'eclipse'\) \{[\s\S]*?\n    \}/);
    expect(todayBranch).not.toBeNull();
    expect(eclipseBranch).not.toBeNull();
    expect(todayBranch![0]).toContain('syncCalendarToJD(weekReplayJD, false)');
    expect(eclipseBranch![0]).toContain('syncCalendarToJD(eJD, false)');
  });

  function extractSyncCalendarToJD() {
    const m = html.match(/var lastCalendarDateKey = '';[\s\S]*?function syncCalendarToJD\(jd, force\) \{[\s\S]*?\n  \}/);
    expect(m).not.toBeNull();
    const renderCalls: unknown[] = [];
    const fakeCalendarPanel = { classList: { contains: () => true } };
    const fakeJdToDate = (jd: number) => new Date(2026, 0, Math.floor(jd));
    const fakeRenderCalendar = (d: unknown) => { renderCalls.push(d); };
    const factory = new Function(
      'calendarPanel', 'jdToDate', 'renderCalendar',
      m![0] + "\nreturn function(jd, force) { syncCalendarToJD(jd, force); return lastCalendarDateKey; };"
    );
    const sync = factory(fakeCalendarPanel, fakeJdToDate, fakeRenderCalendar) as (jd: number, force?: boolean) => string;
    return { sync, renderCalls };
  }

  it('syncCalendarToJDは日付キーが変わらない限り再描画せず、forceで強制再描画できる', () => {
    const { sync, renderCalls } = extractSyncCalendarToJD();
    sync(1, false);
    expect(renderCalls.length, '初回は日付が変わるので描画する').toBe(1);
    sync(1, false);
    expect(renderCalls.length, '同じ日付キーなら再描画しない').toBe(1);
    sync(2, false);
    expect(renderCalls.length, '日付キーが変われば再描画する').toBe(2);
    sync(2, true);
    expect(renderCalls.length, 'forceを渡せば同じ日付でも再描画する').toBe(3);
  });


  it('カレンダーの日付選択は今日の空モード用処理とトップ俯瞰図用処理を分岐する', () => {
    const m = html.match(/function applyCalendarSelectedDate\(y, mo, d\) \{[\s\S]*?\n  \}/);
    expect(m).not.toBeNull();
    const body = m![0];
    expect(body).toContain("if (skyViewMode === 'today')");
    expect(body).toContain('applyTodaySkyCalendarDate(jd);');
    expect(body).toContain("if (skyViewMode === '')");
    expect(body).toContain('applyTopViewCalendarDate(jd);');
  });

  it('トップページ読み込み時の太陽系俯瞰図ではカレンダー選択で今日の空へ切り替えず、選択JDを保持する', () => {
    const topM = html.match(/function applyTopViewCalendarDate\(jd\) \{[\s\S]*?\n  \}/);
    expect(topM).not.toBeNull();
    const topBody = topM![0];
    expect(topBody).toContain('selectedTopViewJD = jd;');
    expect(topBody).not.toContain("setSkyMode('today')");

    const timeM = html.match(/function topViewTimeParameter\(\) \{[\s\S]*?\n  \}/);
    expect(timeM).not.toBeNull();
    expect(timeM![0]).toContain('selectedTopViewJD');
    expect(html).toContain('var ang = pl.angle + topT / pl.period;');
    expect(html).toContain('var moonAng = moon.angle + topT / moon.period;');
  });

  it('今日の空モードは夏の大三角形・南十字の線を恒星ドットと同じprojectEclipticSkyで投影する', () => {
    const m = html.match(/function drawTodaySky\([\s\S]*?\n  function drawPoleView/);
    expect(m).not.toBeNull();
    const body = m![0];
    // 恒星ドット(namedStars)・skyConstellationLines は projectEclipticSky(黄道→赤道の
    // 地軸傾き回転込み)で投影される。夏の大三角形・南十字の線だけ回転なしの
    // projectSky を使うと、viewAngle が動くたびに実際の星の位置からずれて
    // 独立して動いているように見える不具合になる。
    expect(body).not.toContain('projectSky(starLon[summerTriIdx');
    expect(body).toContain('projectEclipticSky(starLon[summerTriIdx');
    expect(body).not.toContain('projectSky(starLon[cruxLines');
    expect(body).toContain('projectEclipticSky(starLon[cruxLines');
  });

  it('地軸固定・自転モードは全描画要素が同一のprojectSkyで統一されている(混在させない)', () => {
    for (const [start, end] of [
      ['function drawPoleView', 'function drawSpinView'],
      ['function drawSpinView', 'function drawSolsticeView'],
    ] as const) {
      const m = html.match(new RegExp(start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?\\n  ' + end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      expect(m, start).not.toBeNull();
      expect(m![0]).not.toContain('projectEclipticSky');
    }
  });

  function extractEclipseHelpers() {
    const jdM = html.match(/function julianDate\(y, mo, d, h\) \{[\s\S]*?\n  \}/);
    const phaseM = html.match(/function eclipsePhaseAt\(jd, site, maxSep, minSep\) \{[\s\S]*?\n  \}/);
    expect(jdM).not.toBeNull();
    expect(phaseM).not.toBeNull();
    const factory = new Function(jdM![0] + '\n' + phaseM![0] + '\nreturn { julianDate: julianDate, eclipsePhaseAt: eclipsePhaseAt };');
    return factory() as {
      julianDate: (y: number, mo: number, d: number, h: number) => number;
      eclipsePhaseAt: (
        jd: number,
        site: { c1: number; c2: number; c3: number; c4: number },
        maxSep: number,
        minSep: number
      ) => { sep: number; inTotality: boolean; phaseLabel: string };
    };
  }

  function extractEclipseSites() {
    const m = html.match(/var eclipseSites = \{[\s\S]*?\n  \};/);
    expect(m).not.toBeNull();
    const factory = new Function(m![0] + '\nreturn eclipseSites;');
    return factory() as Record<
      string,
      { c1: number; c2: number; c3: number; c4: number; tzOffsetH: number; magnitude: number }
    >;
  }

  it('日食モードのUI要素(アイスランド/スペインのボタン)が存在し、クリックで日食モードを開始する', () => {
    expect(html).toContain('id="btnEclipseIceland"');
    expect(html).toContain('id="btnEclipseSpain"');
    expect(html).toContain("btnEclipseIceland.addEventListener('click', function() { startEclipse('iceland'); });");
    expect(html).toContain("btnEclipseSpain.addEventListener('click', function() { startEclipse('spain'); });");
  });

  it('アイスランド/スペインの広角モードボタンが存在し、各太陽残像に時系列の月の影を重ねる', () => {
    expect(html).toContain('id="btnEclipseWideIceland"');
    expect(html).toContain('id="btnEclipseWideSpain"');
    expect(html).toContain("btnEclipseWideIceland.addEventListener('click', function() { startEclipseWide('iceland'); });");
    expect(html).toContain("btnEclipseWideSpain.addEventListener('click', function() { startEclipseWide('spain'); });");
    expect(html).toContain("skyViewMode = 'eclipseWide';");
    expect(html).toContain('var ECLIPSE_WIDE_AFTERIMAGE_COUNT = 9;');
    const wideM = html.match(/function drawEclipseWideView\(site\) \{[\s\S]*?\n  \}/);
    expect(wideM).not.toBeNull();
    expect(wideM![0]).toContain('太陽残像(影付き)');
    expect(wideM![0]).toContain('formatEclipseLocalTime(c1JD, site)');
    expect(wideM![0]).toContain('formatEclipseLocalTime(c4JD, site)');
    expect(wideM![0]).toContain('var ph = eclipsePhaseAt(jd, site, maxSep, minSep);');
    expect(wideM![0]).toContain('var moonX = x + Math.cos(dirAngle) * ph.sep;');
    expect(wideM![0]).toContain('ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);');
  });

  it('日食サイトの接触時刻が第1<第2<第3<第4の順で、8月中旬までに収まる', () => {
    const { julianDate } = extractEclipseHelpers();
    const sites = extractEclipseSites();
    const midAugustJD = julianDate(2026, 8, 15, 0);
    for (const key of ['iceland', 'spain']) {
      const s = sites[key];
      expect(s.c1, key + ': c1<c2').toBeLessThan(s.c2);
      expect(s.c2, key + ': c2<c3').toBeLessThan(s.c3);
      expect(s.c3, key + ': c3<c4').toBeLessThan(s.c4);
      expect(julianDate(2026, 8, 12, s.c4), key + ': 8月中旬までに終了').toBeLessThan(midAugustJD);
    }
  });

  // 出典: Wikipedia "Solar eclipse of August 12, 2026"、timeanddate.com、adventures.is
  it('接触時刻が出典データ(レイキャビク17:48:19UT皆既開始・サラゴサ18:29CEST皆既開始等)と一致する', () => {
    const sites = extractEclipseSites();
    expect(sites.iceland.c1).toBeCloseTo(16 + 47 / 60, 4);
    expect(sites.iceland.c2).toBeCloseTo(17 + 48 / 60 + 19 / 3600, 4);
    expect(sites.iceland.c3).toBeCloseTo(17 + 49 / 60 + 18 / 3600, 4);
    expect(sites.iceland.c4).toBeCloseTo(18 + 47 / 60, 4);
    expect(sites.spain.c1).toBeCloseTo(17 + 35 / 60, 4);
    expect(sites.spain.c2).toBeCloseTo(18 + 29 / 60, 4);
    expect(sites.spain.c3).toBeCloseTo(18 + 29 / 60 + 85 / 3600, 4);
  });

  it('eclipsePhaseAt は第1接触前は最大分離、皆既中央でゼロ、第2/第3接触でリング分離になる', () => {
    const { julianDate, eclipsePhaseAt } = extractEclipseHelpers();
    const site = { c1: 10, c2: 11, c3: 11.1, c4: 12.5 };
    const maxSep = 100, minSep = 6;
    const c1JD = julianDate(2026, 8, 12, site.c1);
    const c2JD = julianDate(2026, 8, 12, site.c2);
    const c3JD = julianDate(2026, 8, 12, site.c3);
    const c4JD = julianDate(2026, 8, 12, site.c4);

    expect(eclipsePhaseAt(c1JD - 0.01, site, maxSep, minSep).sep).toBeCloseTo(maxSep, 5);
    expect(eclipsePhaseAt(c1JD - 0.01, site, maxSep, minSep).inTotality).toBe(false);
    expect(eclipsePhaseAt(c4JD + 0.01, site, maxSep, minSep).sep).toBeCloseTo(maxSep, 5);

    expect(eclipsePhaseAt(c2JD, site, maxSep, minSep).sep).toBeCloseTo(minSep, 5);
    expect(eclipsePhaseAt(c3JD, site, maxSep, minSep).sep).toBeCloseTo(minSep, 5);

    const mid = (c2JD + c3JD) / 2;
    const midPhase = eclipsePhaseAt(mid, site, maxSep, minSep);
    expect(midPhase.inTotality).toBe(true);
    expect(midPhase.sep).toBeCloseTo(0, 5);

    // c1→c2 は単調減少、c3→c4 は単調増加であることを確認
    const q1 = eclipsePhaseAt(c1JD + (c2JD - c1JD) * 0.25, site, maxSep, minSep).sep;
    const q2 = eclipsePhaseAt(c1JD + (c2JD - c1JD) * 0.75, site, maxSep, minSep).sep;
    expect(q2).toBeLessThan(q1);
    const q3 = eclipsePhaseAt(c3JD + (c4JD - c3JD) * 0.25, site, maxSep, minSep).sep;
    const q4 = eclipsePhaseAt(c3JD + (c4JD - c3JD) * 0.75, site, maxSep, minSep).sep;
    expect(q4).toBeGreaterThan(q3);
  });

  // drawMoonPhase が生成する暗部パス(円弧+楕円弧)を、ctx.translate/rotate を
  // 反映した座標変換つきの点列に離散化し、レイキャスト法で内外判定することで、
  // 実際にどちら側が欠けて見えるかを検証する。
  function extractDarkRegionAt(phaseNorm: number, sunAngle: number) {
    const m = html.match(/function drawMoonPhase\(x, y, r, phaseNorm, sunAngle\) \{[\s\S]*?\n  \}/);
    expect(m).not.toBeNull();

    function normAngle(a: number) {
      while (a < 0) a += Math.PI * 2;
      while (a >= Math.PI * 2) a -= Math.PI * 2;
      return a;
    }
    function sampleArc(cx: number, cy: number, rx: number, ry: number, start: number, end: number, ccw: boolean) {
      const pts: [number, number][] = [];
      const s = normAngle(start), e = normAngle(end);
      let delta = e - s;
      if (!ccw) { if (delta <= 0) delta += Math.PI * 2; }
      else { if (delta >= 0) delta -= Math.PI * 2; }
      for (let i = 0; i <= 60; i++) {
        const a = s + delta * (i / 60);
        pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
      }
      return pts;
    }

    let tx = 0, ty = 0, rot = 0;
    const stack: Array<{ tx: number; ty: number; rot: number }> = [];
    function localToWorld([px, py]: [number, number]): [number, number] {
      const cos = Math.cos(rot), sin = Math.sin(rot);
      return [px * cos - py * sin + tx, px * sin + py * cos + ty];
    }

    const filledPolygons: Array<{ style: unknown; points: [number, number][] }> = [];
    let currentPath: [number, number][] = [];
    const fakeCtx = {
      save() { stack.push({ tx, ty, rot }); },
      restore() { const s = stack.pop(); if (s) { tx = s.tx; ty = s.ty; rot = s.rot; } },
      beginPath() { currentPath = []; }, closePath() {},
      translate(dx: number, dy: number) { [tx, ty] = localToWorld([dx, dy]); },
      rotate(a: number) { rot += a; },
      fillStyle: undefined as unknown,
      strokeStyle: undefined as unknown,
      lineWidth: 0,
      arc(x: number, y: number, r: number, start: number, end: number, ccw?: boolean) {
        currentPath = currentPath.concat(sampleArc(x, y, r, r, start, end, !!ccw).map(localToWorld));
      },
      ellipse(x: number, y: number, rx: number, ry: number, _rot: number, start: number, end: number, ccw?: boolean) {
        currentPath = currentPath.concat(sampleArc(x, y, rx, ry, start, end, !!ccw).map(localToWorld));
      },
      fill() { filledPolygons.push({ style: this.fillStyle, points: currentPath }); },
      stroke() {},
    };

    const factory = new Function('ctx', 'Math', m![0] + '\nreturn drawMoonPhase;');
    const drawMoonPhase = factory(fakeCtx, Math);
    drawMoonPhase(0, 0, 1, phaseNorm, sunAngle);

    const darkPoly = filledPolygons.find((p) => p.style === '#060614');
    expect(darkPoly, 'dark fill path for phaseNorm=' + phaseNorm).toBeDefined();

    function pointInPolygon(pt: [number, number], poly: [number, number][]) {
      const [x, y] = pt;
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }
    const poly = darkPoly!.points;
    return {
      left: pointInPolygon([-0.6, 0], poly),
      right: pointInPolygon([0.6, 0], poly),
    };
  }

  it('新月(0)は全体が暗く、満月(0.5付近)は全体が明るい(太陽の向きによらない)', () => {
    expect(extractDarkRegionAt(0.001, 0)).toEqual({ left: true, right: true });
    expect(extractDarkRegionAt(0.49, 0)).toEqual({ left: false, right: false });
    expect(extractDarkRegionAt(0.5, 0)).toEqual({ left: false, right: false });
  });

  it('満月直後(0.5〜0.6)がいきなり全暗になる符号反転バグが再発しない', () => {
    // 実際に確認されていたバグ: 満月(0.49)の直後、0.5〜0.6の範囲で
    // 暗部が全体に反転してしまい、新月に向かって滑らかに欠けていかなかった。
    for (const p of [0.5, 0.52, 0.55, 0.58, 0.6]) {
      const region = extractDarkRegionAt(p, 0);
      expect(region, 'phaseNorm=' + p + 'で全暗になってはいけない').not.toEqual({ left: true, right: true });
    }
  });

  it('新月直前(1.0手前)は全体が暗い', () => {
    expect(extractDarkRegionAt(0.999, 0)).toEqual({ left: true, right: true });
  });

  it('欠ける/満ちる側は太陽の実際の画面上の向き(sunAngle)に従い、暗部は常に太陽と反対側になる', () => {
    // 太陽が月から見て右(sunAngle=0)にあれば、暗部は左(太陽と反対側)。
    // 上弦(0.25)・下弦(0.75)どちらでも、waxing/waningの区別なく太陽の向きだけで決まる。
    expect(extractDarkRegionAt(0.25, 0)).toEqual({ left: true, right: false });
    expect(extractDarkRegionAt(0.75, 0)).toEqual({ left: true, right: false });
    // 太陽が月から見て左(sunAngle=π)にあれば、暗部は右(太陽と反対側)。
    expect(extractDarkRegionAt(0.25, Math.PI)).toEqual({ left: false, right: true });
    expect(extractDarkRegionAt(0.75, Math.PI)).toEqual({ left: false, right: true });
  });

  it('drawMoonPhaseの呼び出し元はいずれも実際の太陽・月の画面座標からsunAngleを計算して渡す', () => {
    expect(html).toMatch(/var mSunAngleT = sunPos5 \? Math\.atan2\(sunPos5\.y - moonPosT\.y, sunPos5\.x - moonPosT\.x\) : 0;/);
    expect(html).toContain('drawMoonPhase(moonPosT.x, moonPosT.y, 16, mPhaseT / (Math.PI*2), mSunAngleT);');
    expect(html).toMatch(/var mSunAngleSV = sunPos \? Math\.atan2\(sunPos\.y - mPosSV\.y, sunPos\.x - mPosSV\.x\) : 0;/);
    expect(html).toContain('drawMoonPhase(mPosSV.x, mPosSV.y, 16, phaseAng / (Math.PI * 2), mSunAngleSV);');
  });

  // 夏至モード(drawSolsticeView)の地軸ベクトル(npOx,npOy,npOz)は宇宙空間に対して
  // 固定方向を保つべきで、地球の公転角度th9に連動して回転してはならない。
  // 地軸と「地球→太陽」方向の内積は、夏至(th9=0)で最大(北極が太陽側に傾く)、
  // 秋分・春分(th9=±π/2)でゼロ(真横)、冬至(th9=π)で最小(太陽と反対)になる
  // はずである。この内積が th9 によらず一定になっていないかを検証する。
  function extractAxisTiltDot(th9: number) {
    const m = html.match(/var npOx = [^\n]+;\s*\n\s*var npOy = [^\n]+;\s*\n\s*var npOz = [^\n]+;/);
    expect(m).not.toBeNull();
    const factory = new Function(
      'th9', 'SOL_TSIN', 'SOL_TCOS',
      m![0] + '\nreturn { npOx: npOx, npOy: npOy, npOz: npOz };'
    );
    const SOL_TSIN = Math.sin((23.4 * Math.PI) / 180);
    const SOL_TCOS = Math.cos((23.4 * Math.PI) / 180);
    const np = factory(th9, SOL_TSIN, SOL_TCOS) as { npOx: number; npOy: number; npOz: number };
    // 地球→太陽の方向(XY平面内、Zは常に0)
    const sunDir = { x: -Math.cos(th9), y: -Math.sin(th9), z: 0 };
    return np.npOx * sunDir.x + np.npOy * sunDir.y + np.npOz * sunDir.z;
  }

  it('地軸の傾きは公転角度によらず宇宙空間に固定され、季節ごとに太陽との向きが正しく変化する', () => {
    const dotSummer = extractAxisTiltDot(0);
    const dotAutumn = extractAxisTiltDot(Math.PI / 2);
    const dotWinter = extractAxisTiltDot(Math.PI);
    const dotSpring = extractAxisTiltDot(-Math.PI / 2);
    const sin234 = Math.sin((23.4 * Math.PI) / 180);

    expect(dotSummer, '夏至: 北極が太陽側に傾く(内積が最大)').toBeCloseTo(sin234, 5);
    expect(dotWinter, '冬至: 北極が太陽と反対に傾く(内積が最小)').toBeCloseTo(-sin234, 5);
    expect(dotAutumn, '秋分: 真横を向く(内積がゼロ)').toBeCloseTo(0, 5);
    expect(dotSpring, '春分: 真横を向く(内積がゼロ)').toBeCloseTo(0, 5);
  });

  it('今日の空・地球目線/月面/ISSモードで月の陰影が地球観測者視点であることを明記している', () => {
    const todayBody = html.match(/function drawTodaySky\([\s\S]*?\n  function drawPoleView/);
    const skyViewBody = html.match(/function drawSkyView\(\)[\s\S]*$/);
    expect(todayBody).not.toBeNull();
    expect(skyViewBody).not.toBeNull();
    const note = '※月の満ち欠け(陰影)は地球の地表に立つ観測者から見た見え方を表示しています';
    expect(todayBody![0]).toContain(note);
    expect(skyViewBody![0]).toContain(note);
  });

  // 2026年8月12日の6惑星整列(水星・木星・火星・天王星・土星・海王星が
  // 明け方の空に並ぶ)を「今日の空」モードが再現できることを検証する。
  // 故障シナリオ: (1) helioXY の中心差が平均近点角 M=L-ϖ ではなく平均黄経 L を
  // 使うと、幾何黄経が最大 2e rad ずれ(火星約10.7度、土星約6.4度)、土星が
  // 海王星から離れて描かれ実際の並びと矛盾する。(2) realPlanets に天王星・
  // 海王星がないと6惑星のうち2つが描画されない。
  function extractPlanetLongitudes(jd: number) {
    const normM = html.match(/function normD\(deg\) [^\n]*/);
    const sunM = html.match(/function sunLonReal\(jd\) \{[\s\S]*?\n  \}/);
    const helioM = html.match(/function helioXY\([^)]*\) \{[\s\S]*?\n  \}/);
    const geoM = html.match(/function geoLonDeg\(px, py, ex, ey\) \{[\s\S]*?\n  \}/);
    expect(normM).not.toBeNull();
    expect(sunM).not.toBeNull();
    expect(helioM).not.toBeNull();
    expect(geoM).not.toBeNull();

    const todayM = html.match(/var ePos = helioXY\([^\n]*\);\s*\n\s*var realPlanets = \[[\s\S]*?\n    \];/);
    expect(todayM, '今日の空の realPlanets 定義').not.toBeNull();

    const factory = new Function(
      'jd',
      normM![0] + '\n' + sunM![0] + '\n' + helioM![0] + '\n' + geoM![0] + '\n' +
      todayM![0] + '\n' +
      'var out = { sun: sunLonReal(jd) };\n' +
      'for (var i = 0; i < realPlanets.length; i++) {\n' +
      '  out[realPlanets[i].jaName] = geoLonDeg(realPlanets[i].h.x, realPlanets[i].h.y, ePos.x, ePos.y);\n' +
      '}\n' +
      'return out;'
    );
    return factory(jd) as Record<string, number>;
  }

  function westElongation(sunLon: number, lon: number) {
    return ((sunLon - lon) % 360 + 360) % 360;
  }

  it('今日の空の realPlanets に天王星・海王星が含まれ、6惑星整列を描画できる', () => {
    const todayM = html.match(/var realPlanets = \[[\s\S]*?\n    \];/);
    expect(todayM).not.toBeNull();
    for (const name of ['水星', '火星', '木星', '土星', '天王星', '海王星']) {
      expect(todayM![0], name + ' が realPlanets に存在する').toContain("jaName: '" + name + "'");
    }
  });

  it('2026/8/12 の各惑星の地心黄経が実際の6惑星整列の並びと一致する', () => {
    // JD 2026-08-12 05:00UT ごろ(明け方)
    const { julianDate } = extractEclipseHelpers();
    const jd = julianDate(2026, 8, 12, 5);
    const lons = extractPlanetLongitudes(jd);

    // 太陽はしし座(約140度)
    expect(lons.sun).toBeGreaterThan(136);
    expect(lons.sun).toBeLessThan(143);

    // 海王星はおひつじ座境界(約0〜5度)、土星はそのすぐ東(約20度以内)に並ぶ。
    // 中心差を平均黄経で計算する旧実装では土星が約22.5度となり、この並びが崩れる。
    const nep = lons['海王星'] > 180 ? lons['海王星'] - 360 : lons['海王星'];
    expect(nep).toBeGreaterThan(-5);
    expect(nep).toBeLessThan(8);
    expect(lons['土星']).toBeGreaterThan(0);
    expect(lons['土星']).toBeLessThan(20);
    expect(Math.abs(lons['土星'] - nep), '土星と海王星が近接して並ぶ').toBeLessThan(15);

    // 天王星はおうし座〜ふたご座境界(約58〜74度)
    expect(lons['天王星']).toBeGreaterThan(58);
    expect(lons['天王星']).toBeLessThan(74);

    // 火星は太陽の西約35〜65度(天王星と水星の間)
    const marsElong = westElongation(lons.sun, lons['火星']);
    expect(marsElong).toBeGreaterThan(35);
    expect(marsElong).toBeLessThan(65);

    // 水星は西方最大離角(8/3 約19度W)の直後で、太陽の西10〜28度
    const mercElong = westElongation(lons.sun, lons['水星']);
    expect(mercElong).toBeGreaterThan(10);
    expect(mercElong).toBeLessThan(28);

    // 木星は合(8月中旬)の直前後で太陽から15度以内
    let jupElong = Math.abs(lons.sun - lons['木星']) % 360;
    if (jupElong > 180) jupElong = 360 - jupElong;
    expect(jupElong).toBeLessThan(15);
  });

  it('helioXY の中心差は近日点黄経を基準にした平均近点角 M=L-ϖ を使う', () => {
    const helioM = html.match(/function helioXY\(([^)]*)\) \{[\s\S]*?\n  \}/);
    expect(helioM).not.toBeNull();
    expect(helioM![1], '引数に近日点黄経 periLon を持つ').toContain('periLon');
    expect(helioM![0]).not.toContain('2*ecc*Math.sin(L)');
  });

  // ペルセウス座流星群の輻射点(RA 3h04m ≈ 46度, Dec +58度)を黄道座標に変換すると
  // λ ≈ 61.8度, β ≈ +38.8度になる。このページの天球座標系は黄道座標(λ, β)が
  // 前提のため、赤道座標の値(46度/58度)をそのまま入れると輻射点が実際の位置から
  // 経度約16度・緯度約19度ずれる。
  it('ペルセウス座流星群の輻射点が黄道座標(λ約62度, β約39度)で登録されている', () => {
    const lonM = html.match(/var PERS_LON = ([\d.]+) \* Math\.PI \/ 180;/);
    const latM = html.match(/var PERS_LAT = ([\d.]+) \* Math\.PI \/ 180;/);
    expect(lonM).not.toBeNull();
    expect(latM).not.toBeNull();
    expect(Math.abs(parseFloat(lonM![1]) - 61.8), '黄道経度λ').toBeLessThan(2);
    expect(Math.abs(parseFloat(latM![1]) - 38.8), '黄道緯度β').toBeLessThan(2);
  });

  it('今日の空モードでは輻射点を恒星と同じprojectEclipticSkyで投影する', () => {
    const m = html.match(/function drawMeteors\(dt\) \{[\s\S]*?\n  \}/);
    expect(m).not.toBeNull();
    // 今日の空モードの恒星は projectEclipticSky(地軸傾き回転込み)で投影される。
    // 輻射点だけ projectSky を使うと恒星に対して位置がずれる。
    expect(m![0]).toContain("skyViewMode === 'today' ? projectEclipticSky : projectSky");
    expect(m![0]).not.toContain('var persPos = projectSky(PERS_LON, PERS_LAT);');
  });

  // ペルセウス座の主要7星の黄道座標(J2000)。赤道座標(RA/Dec)から
  // λ = atan2(sinα cosε + tanδ sinε, cosα), sinβ = sinδ cosε − cosδ sinε sinα で変換。
  it('ペルセウス座の主要7星が黄道座標(J2000)で登録されている', () => {
    const { lons, lats } = extractRadArrays();
    const expected: Array<{ idx: number; name: string; lon: number; lat: number }> = [
      { idx: 28, name: 'ミルファク(α)',   lon: 1.0835, lat: 0.5261 },
      { idx: 29, name: 'アルゴル(β)',     lon: 0.9804, lat: 0.3917 },
      { idx: 30, name: 'ガンマ・ペルセイ', lon: 1.0476, lat: 0.6027 },
      { idx: 31, name: 'デルタ・ペルセイ', lon: 1.1308, lat: 0.4767 },
      { idx: 32, name: 'イプシロン・ペルセイ', lon: 1.1464, lat: 0.3339 },
      { idx: 33, name: 'ゼータ・ペルセイ', lon: 1.1015, lat: 0.1978 },
      { idx: 34, name: 'エータ・ペルセイ', lon: 1.0245, lat: 0.6543 },
    ];
    for (const e of expected) {
      expect(Math.abs(lons[e.idx] - e.lon), `${e.name} の黄道経度`).toBeLessThan(0.02);
      expect(Math.abs(lats[e.idx] - e.lat), `${e.name} の黄道緯度`).toBeLessThan(0.02);
    }
  });

  it('ペルセウス座の星座線が天球モードとトップ俯瞰図の両方に登録されている', () => {
    const skyM = html.match(/var skyConstellationLines = \[([\s\S]*?)\n  \];/);
    expect(skyM).not.toBeNull();
    const persLine = skyM![1].match(/name: 'ペルセウス座'[^\n]*indices: \[([^\]]*)\]/);
    expect(persLine, '天球モードのペルセウス座星座線').not.toBeNull();
    const idxs = persLine![1].split(',').map((s) => parseInt(s.trim(), 10));
    // α(28)・β(29)を含む主要星を結ぶ
    expect(idxs).toContain(28);
    expect(idxs).toContain(29);
    const { lons } = extractRadArrays();
    for (const idx of idxs) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(lons.length);
    }
    const topM = html.match(/var constellationLines = \[([\s\S]*?)\n  \];/);
    expect(topM).not.toBeNull();
    expect(topM![1], 'トップ俯瞰図のペルセウス座星座線').toContain("name: 'ペルセウス座'");
  });

  it('ミルファクとアルゴルが namedStars に登録され、輻射点がペルセウス座の近くにある', () => {
    expect(html).toContain("name: 'ミルファク'");
    expect(html).toContain("name: 'アルゴル'");
    // 輻射点(λ61.8度, β38.8度)はγ星(λ60.0度, β34.5度)・η星(λ58.7度, β37.5度)の近傍
    const { lons, lats } = extractRadArrays();
    const radLon = (61.8 * Math.PI) / 180;
    const radLat = (38.8 * Math.PI) / 180;
    const dGamma = Math.hypot(lons[30] - radLon, lats[30] - radLat);
    const dEta = Math.hypot(lons[34] - radLon, lats[34] - radLat);
    expect(dGamma).toBeLessThan(0.12);
    expect(dEta).toBeLessThan(0.12);
  });

  it('地軸固定・自転モードでもペルセウス座を含む全星座線をdrawSkyConstellationLinesで描画する', () => {
    // 地軸固定(drawPoleView)・自転(drawSpinView)は drawSkyConstellationLines(projectSky) を
    // 呼ぶことで skyConstellationLines(ペルセウス座を含む)を描画する。この呼び出しが
    // 消えると星座線トグルを入れてもペルセウス座が表示されなくなる。
    for (const [start, end] of [
      ['function drawPoleView', 'function drawSpinView'],
      ['function drawSpinView', 'function drawSolsticeView'],
    ] as const) {
      const m = html.match(new RegExp(start + '[\\s\\S]*?\\n  ' + end));
      expect(m, start).not.toBeNull();
      expect(m![0], start + ' が星座線を描画する').toContain('drawSkyConstellationLines(projectSky);');
    }
    // ペルセウス座の線がsummerTri等のようにモードごとの個別実装ではなく
    // skyConstellationLines 側にあることを確認(登録漏れ検知)
    const skyM = html.match(/var skyConstellationLines = \[([\s\S]*?)\n  \];/);
    expect(skyM).not.toBeNull();
    expect(skyM![1]).toContain("name: 'ペルセウス座'");
  });

  it('今日の空モードでもペルセウス座を含む全星座線を恒星と同じprojectEclipticSkyで描画する', () => {
    // 今日の空(drawTodaySky)は drawSkyConstellationLines(projectEclipticSky) を呼ぶことで
    // skyConstellationLines(ペルセウス座を含む)を恒星ドットと同じ投影で描画する。
    // この呼び出しが消える、または projectSky に変わると、星座線トグルを入れても
    // ペルセウス座が表示されない・恒星とずれて表示される退行になる。
    const m = html.match(/function drawTodaySky\([\s\S]*?\n  function drawPoleView/);
    expect(m).not.toBeNull();
    expect(m![0]).toContain('drawSkyConstellationLines(projectEclipticSky);');
    expect(m![0]).not.toContain('drawSkyConstellationLines(projectSky);');
  });

  it('今日の空モードの投影(backCull=-0.75)でペルセウス座方向を向けば主要7星を投影できる', () => {
    const make = extractProject3D();
    const project = make('today');
    const { lons, lats } = extractRadArrays();
    const centerLon = 1.06;
    const centerLat = 0.45;
    for (const idx of [28, 29, 30, 31, 32, 33, 34]) {
      const lon = lons[idx] - centerLon;
      const lat = lats[idx] - centerLat + 0.5;
      const p = project(
        Math.cos(lat) * Math.cos(lon),
        Math.cos(lat) * Math.sin(lon),
        Math.sin(lat)
      );
      expect(p, 'ペルセウス座 idx=' + idx + ' が投影可能').not.toBeNull();
    }
  });

  it('地軸固定モードでペルセウス座方向を向いたとき主要7星がすべて画面内に投影できる', () => {
    const make = extractProject3D();
    const project = make('pole');
    // extractProject3D は viewAngle=0 固定のため、ペルセウス座(λ約56〜66度)の
    // 星を視線中心付近へ持ってくる回転を座標側に適用して検証する
    const { lons, lats } = extractRadArrays();
    const centerLon = 1.06;
    const centerLat = 0.45;
    for (const idx of [28, 29, 30, 31, 32, 33, 34]) {
      const lon = lons[idx] - centerLon;
      const lat = lats[idx] - centerLat + 0.5;
      const p = project(
        Math.cos(lat) * Math.cos(lon),
        Math.cos(lat) * Math.sin(lon),
        Math.sin(lat)
      );
      expect(p, 'ペルセウス座 idx=' + idx + ' が投影可能').not.toBeNull();
    }
  });

  it('レグルスの黄道緯度(starLat)が実際の値(約+0.46度)に近い', () => {
    const lonMatch = html.match(/var starLon = \[([^\]]*)\];/);
    const latMatch = html.match(/var starLat = \[([^\]]*)\];/);
    expect(lonMatch).not.toBeNull();
    expect(latMatch).not.toBeNull();

    const lons = lonMatch![1].split(',').map((s) => parseFloat(s.trim()));
    const lats = latMatch![1].split(',').map((s) => parseFloat(s.trim()));

    // namedStars 配列でのレグルスのインデックスは 19 (0始まり)
    const regulusIdx = 19;
    const regulusLatDeg = (lats[regulusIdx] * 180) / Math.PI;
    const regulusLonDeg = (lons[regulusIdx] * 180) / Math.PI;

    // 実際のレグルスの黄道座標: 経度 約149.8度, 緯度 約+0.46度
    expect(regulusLatDeg).toBeGreaterThan(0);
    expect(regulusLatDeg).toBeLessThan(2);
    expect(regulusLonDeg).toBeGreaterThan(145);
    expect(regulusLonDeg).toBeLessThan(155);
  });
});
