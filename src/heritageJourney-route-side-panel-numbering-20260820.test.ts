// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「🌐 巡回テスト」モーダル右側のルート順序
// 表示板(#tour-route-side-panel/#tour-route-side-list)。パネルの横幅を
// 20%広げ(200px→240px)、各行の行頭に通し番号を表示する。この番号は
// 地球儀(#tour-globe-canvas)上に描画される目的地の番号(丸の横の数字)と
// 一致させる。グレーアウト中(routeLineExcluded)の地点は地球儀上に丸が
// 描かれないため番号を振らない。
//
// 故障シナリオ:
//   (1) パネルの横幅が20%広がっていない
//   (2) 行頭に番号が表示されない
//   (3) 番号が地球儀上の丸の番号(tourPoints内での並び順)とずれている
//   (4) グレーアウト中の地点にも番号が振られてしまい、地球儀上の
//       丸の番号と食い違う

function setupPage() {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const fillTextCalls: string[] = [];
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
    fillText: (text: string) => { fillTextCalls.push(text); },
  });
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { fillTextCalls };
}

describe('heritage-journeyページ: ルート順序表示板の横幅が20%広がっている', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('CSSで#tour-route-side-panelの横幅が240px(200pxの1.2倍)に設定されている', () => {
    const html = getHeritageJourneyPage();
    expect(html).toMatch(/\.tour-route-side-panel\{[^}]*width:240px/);
  });
});

describe('heritage-journeyページ: ルート順序表示板の各行に地球儀と一致する通し番号が表示される', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('全地点が巡回対象(グレーアウトなし)の場合、番号は1から順に振られ地球儀上の番号と一致する', () => {
    const { fillTextCalls } = setupPage();
    const rows = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-name]'));
    expect(rows.length).toBeGreaterThan(0);

    const numbers = rows.map((row) => row.querySelector('.tour-route-side-num')!.textContent);
    expect(numbers).toEqual(rows.map((_, i) => String(i + 1)));

    // 地球儀側(#tour-globe-canvas)の描画で振られた番号(fillTextの引数)と一致することを確認する
    const globeNumbers = fillTextCalls.filter((t) => /^\d+$/.test(t));
    expect(globeNumbers.slice(0, rows.length)).toEqual(numbers);
  });

  it('グレーアウトした地点は番号が振られず(-表示)、以降の番号が詰めて振り直される', () => {
    setupPage();
    const badges = Array.from(document.querySelectorAll('#route-line button.wp-badge')) as HTMLButtonElement[];
    expect(badges.length).toBeGreaterThanOrEqual(3);
    const middleBadge = badges[1];
    middleBadge.click(); // グレーアウト

    const rows = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-name]'));
    const middleName = middleBadge.getAttribute('data-wp-name');
    const middleRow = rows.find((r) => r.getAttribute('data-side-name') === middleName)!;
    expect(middleRow.querySelector('.tour-route-side-num')!.textContent).toBe('-');

    // グレーアウトした地点を除いた地点に、1から順の番号が振られている
    const numberedRows = rows.filter((r) => r.getAttribute('data-side-name') !== middleName);
    const numbers = numberedRows.map((row) => row.querySelector('.tour-route-side-num')!.textContent);
    expect(numbers).toEqual(numberedRows.map((_, i) => String(i + 1)));
  });
});
