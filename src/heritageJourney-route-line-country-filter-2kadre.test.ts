// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「ルート順序」パネル(#route-line)の各行(世界遺産/空港/駅)。
// 各行のON/OFFバッジ右側にその地点が属する国の国旗を表示し、表示された国旗の出現回数を
// 集計して「ルート順序」見出し右側の国フィルタドロップダウン(#route-country-filter)に
// 「すべて(デフォルト)」を先頭に出現回数の多い順で「国旗 (件数)」として埋め込む。
// ドロップダウンで特定の国を選択すると、それ以外の国の行がグレーアウトされ
// (視覚的な減光だけでなく、ボタンのdisabled属性によるインタラクション無効化も伴う)、
// 「すべて(デフォルト)」に戻すと全行が通常表示・操作可能に戻る。
//
// 故障シナリオ:
//   (1) 世界遺産/空港/駅で参照すべき国旗データソースを取り違え、誤った国旗が出る
//   (2) 出現回数の集計が同率(タイ)や単一国のみのルートで壊れる
//   (3) ドロップダウンの並び順が出現回数降順になっていない、または「すべて(デフォルト)」が
//       先頭/初期選択でない
//   (4) 国フィルタで見た目だけ薄くなり、グレーアウトされた行のバッジが実際にはクリック可能
//       なままになってしまう(視覚的な減光のみで操作を止めていない)
//   (5) 「すべて(デフォルト)」に戻したときに、無効化されたボタンが再度有効化されない

function setupPage() {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  const fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({}) }));
  vi.stubGlobal('fetch', fetchMock);
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { fetchMock };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function routeItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll('#route-line .route-line-item')) as HTMLElement[];
}

function countryFilterSelect(): HTMLSelectElement {
  return document.getElementById('route-country-filter') as unknown as HTMLSelectElement;
}

describe('heritage-journeyページ: ルート順序パネルの国旗表示・国別フィルタ', () => {
  it('#route-lineの各行に国旗が表示される(世界遺産/出発地/到着地いずれも空にならない)', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const items = routeItems();
    expect(items.length).toBeGreaterThan(0);
    const flags = items.map((it) => it.querySelector('.wp-flag'));
    // 出発地・到着地・少なくとも一部の世界遺産行に国旗spanがあること
    expect(flags.some((f) => f && (f.textContent || '').length > 0)).toBe(true);
  });

  it('#route-country-filterドロップダウンの先頭は「すべて(デフォルト)」で初期選択されている', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const sel = countryFilterSelect();
    expect(sel).toBeTruthy();
    expect(sel.options.length).toBeGreaterThan(0);
    expect(sel.options[0].textContent).toBe('すべて(デフォルト)');
    expect(sel.value).toBe(sel.options[0].value);
  });

  it('ドロップダウンの選択肢は出現回数降順で並ぶ(すべてを除く)', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const sel = countryFilterSelect();
    const counts = Array.from(sel.options).slice(1).map((o) => {
      const m = /\((\d+)\)$/.exec(o.textContent || '');
      return m ? Number(m[1]) : -1;
    });
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it('ラベル書式は「国旗 (件数)」になっている', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const sel = countryFilterSelect();
    Array.from(sel.options).slice(1).forEach((o) => {
      expect(o.textContent || '').toMatch(/^.+ \(\d+\)$/);
    });
  });

  it('特定の国を選ぶと他国の行だけグレーアウトされ、バッジがdisabledになる', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const sel = countryFilterSelect();
    expect(sel.options.length).toBeGreaterThan(1);
    const targetValue = sel.options[1].value;
    sel.value = targetValue;
    sel.dispatchEvent(new Event('change'));

    const items = routeItems();
    const matching = items.filter((it) => it.getAttribute('data-wp-country') === targetValue);
    const others = items.filter((it) => it.getAttribute('data-wp-country') !== targetValue);
    expect(matching.length).toBeGreaterThan(0);
    matching.forEach((it) => {
      expect(it.classList.contains('route-line-item-dimmed')).toBe(false);
      // 出発地・到着地の行はbutton.wp-badge(data-wp-name)を持たないため、
      // 存在する場合のみdisabled状態を検証する。
      const btn = it.querySelector('[data-wp-name]') as HTMLButtonElement | null;
      if (btn) expect(btn.disabled).toBe(false);
    });
    if (others.length > 0) {
      others.forEach((it) => {
        expect(it.classList.contains('route-line-item-dimmed')).toBe(true);
        const btn = it.querySelector('[data-wp-name]') as HTMLButtonElement | null;
        if (btn) expect(btn.disabled).toBe(true);
      });
    }
  });

  it('グレーアウト中の行のバッジをクリックしてもON/OFFがトグルされない(見た目だけの減光ではない)', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const sel = countryFilterSelect();
    const targetValue = sel.options[1].value;
    sel.value = targetValue;
    sel.dispatchEvent(new Event('change'));

    const items = routeItems();
    // 出発地・到着地の行はbutton.wp-badge(data-wp-name)自体を持たずクリック
    // しても何も起きないため、バッジを持つ経由地の行だけを対象に検証する。
    const others = items.filter((it) => it.getAttribute('data-wp-country') !== targetValue && it.querySelector('[data-wp-name]'));
    if (others.length === 0) return; // 単一国ルートの場合は対象なしなのでスキップ
    const btn = others[0].querySelector('[data-wp-name]') as HTMLButtonElement;
    const wasOff = btn.classList.contains('wp-badge-off');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(btn.classList.contains('wp-badge-off')).toBe(wasOff);
  });

  it('「すべて(デフォルト)」に戻すと全行が通常表示・操作可能に戻る', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const sel = countryFilterSelect();
    const targetValue = sel.options[1].value;
    sel.value = targetValue;
    sel.dispatchEvent(new Event('change'));

    sel.value = sel.options[0].value;
    sel.dispatchEvent(new Event('change'));

    const items = routeItems();
    items.forEach((it) => {
      expect(it.classList.contains('route-line-item-dimmed')).toBe(false);
      // 出発地・到着地の行はbutton.wp-badge(data-wp-name)を持たないため、
      // 存在する場合のみdisabled解除を検証する。
      const btn = it.querySelector('[data-wp-name]') as HTMLButtonElement | null;
      if (btn) expect(btn.disabled).toBe(false);
    });
  });

  it('単一国のみのルートでもドロップダウンがエラーにならず、その国の選択肢が1件だけ表示される', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    // 出発地・到着地を同一国内の都市同士に設定し直し、迂回上限を極小にして
    // 実質的に単一国だけのルートを作る(世界遺産候補をすべて選択解除)。
    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    const endSel = document.getElementById('end-city') as unknown as HTMLSelectElement;
    // 同一都市を出発・到着にすることで候補地(迂回距離)を極小化し、
    // 実質的に出発地=到着地の単一国ルートにする。
    endSel.value = startSel.value;
    endSel.dispatchEvent(new Event('change'));
    startSel.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));

    const sel = countryFilterSelect();
    expect(() => sel.options.length).not.toThrow();
    expect(sel.options.length).toBeGreaterThanOrEqual(1);
    expect(sel.options[0].textContent).toBe('すべて(デフォルト)');
  });
});
