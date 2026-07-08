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

  it('トップ俯瞰図では期間再現ボタンを押しても今日の空へ切り替えず、俯瞰図の時刻を進める', () => {
    const replayM = html.match(/function startCalendarReplay\(startJD, endJD, label\) \{[\s\S]*?\n  \}/);
    expect(replayM).not.toBeNull();
    expect(replayM![0]).toContain("if (skyViewMode === '')");
    expect(replayM![0]).toContain('selectedTopViewJD = weekReplayJD;');
    expect(replayM![0]).toContain('ensureTodaySkyMode();');

    const currentM = html.match(/function currentSimulatedJD\(\) \{[\s\S]*?\n  \}/);
    expect(currentM).not.toBeNull();
    expect(currentM![0]).toContain("if (skyViewMode === '' && weekReplayActive) return weekReplayJD;");

    const frameM = html.match(/function frame\(now\) \{[\s\S]*?ctx.fillStyle = '#000010';/);
    expect(frameM).not.toBeNull();
    expect(frameM![0]).toContain('var topProgress = Math.min(1, weekReplayElapsed / weekReplayDuration);');
    expect(frameM![0]).toContain('selectedTopViewJD = weekReplayJD;');
    expect(frameM![0]).toContain('syncCalendarToJD(weekReplayJD, false);');
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
