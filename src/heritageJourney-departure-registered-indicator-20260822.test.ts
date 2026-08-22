// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「出発地・到着地」行、#start-city(出発地セレクト)の
// 各<option>。ロックされている到着地(#end-cityの現在値)との組み合わせが
// D1の heritage_journey_registered_routes テーブルに未登録の場合は薄緑色の
// 中抜き枠(border:2px solid #bbf7d0、背景は透過)、登録済みの場合は薄緑色の
// 塗りつぶし(background:#bbf7d0、文字色#064e3b)を各出発地オプションに付与する。
// これは既存の「ルート登録ボタンが出てこない」判定バグそのものの修正ではなく、
// 出発地ごとの登録状態を目視で確認できるようにする診断/UX目的の表示追加。
//
// 故障シナリオ:
//   (1) 初期表示時にバッチAPI(/api/heritage-journey/registered-starts-for-destination)へ
//       fetchされず、出発地オプションの見た目が常に固定になってしまう
//   (2) #end-city(到着地)を変更しても再フェッチ・再描画が行われず、
//       古いロック先に基づいた誤った表示が残ってしまう
//   (3) APIレスポンスが空/部分的(starts未定義、null等)の場合に例外が発生したり、
//       登録済み扱いに誤分類(misclassify)されてしまう

function setupPage(fetchImpl: (input: unknown, init?: unknown) => Promise<{ json: () => Promise<unknown> }>) {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  const fetchMock = vi.fn(fetchImpl);
  vi.stubGlobal('fetch', fetchMock);
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { fetchMock };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function defaultFetch(registeredStarts: string[]) {
  return (input: unknown) => {
    const url = String(input);
    if (url.indexOf('/api/heritage-journey/registered-starts-for-destination') === 0) {
      return Promise.resolve({ json: () => Promise.resolve({ starts: registeredStarts }) });
    }
    if (url.indexOf('/api/heritage-journey/route-exists') === 0) {
      return Promise.resolve({ json: () => Promise.resolve({ exists: false }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  };
}

describe('heritage-journeyページ: 出発地オプションの登録状態インジケータ', () => {
  it('初期表示時にロック中の到着地でregistered-starts-for-destinationへfetchする', async () => {
    const { fetchMock } = setupPage(defaultFetch(['Paris']));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const calls = fetchMock.mock.calls.filter((c) => String(c[0]).indexOf('/api/heritage-journey/registered-starts-for-destination') === 0);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(String(calls[0][0])).toContain('end=');
  });

  it('登録済みの出発地オプションは薄緑色の塗りつぶし(#bbf7d0/#064e3b)になる', async () => {
    setupPage(defaultFetch(['パリ']));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    const parisOpt = Array.from(startSel.options).find((o) => o.value === 'Paris')!;
    expect(parisOpt.classList.contains('start-city-option-registered')).toBe(true);
    expect(parisOpt.style.backgroundColor.toLowerCase()).toContain('rgb(187, 247, 208)');
    expect(parisOpt.style.color.toLowerCase()).toContain('rgb(6, 78, 59)');
  });

  it('未登録の出発地オプションは薄緑色の中抜き枠(border)になり背景は塗りつぶされない', async () => {
    setupPage(defaultFetch(['パリ']));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    const otherOpt = Array.from(startSel.options).find((o) => o.value !== 'Paris')!;
    expect(otherOpt.classList.contains('start-city-option-unregistered')).toBe(true);
    expect(otherOpt.style.border).toContain('2px solid');
    expect(otherOpt.style.border.toLowerCase()).toContain('rgb(187, 247, 208)');
    expect(otherOpt.style.backgroundColor).not.toContain('187, 247, 208');
  });

  it('到着地(#end-city)を変更すると、新しい到着地で再フェッチ・再描画される', async () => {
    const { fetchMock } = setupPage(defaultFetch(['Paris']));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    fetchMock.mockClear();

    const endCity = document.getElementById('end-city') as unknown as HTMLSelectElement;
    const newValue = endCity.options[1] ? endCity.options[1].value : endCity.value;
    endCity.value = newValue;
    endCity.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const calls = fetchMock.mock.calls.filter((c) => String(c[0]).indexOf('/api/heritage-journey/registered-starts-for-destination') === 0);
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it('APIレスポンスが空({})の場合でも例外にならず、全オプションが未登録扱いになる', async () => {
    setupPage((input: unknown) => {
      const url = String(input);
      if (url.indexOf('/api/heritage-journey/registered-starts-for-destination') === 0) {
        return Promise.resolve({ json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ json: () => Promise.resolve({ exists: false }) });
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    Array.from(startSel.options).forEach((o) => {
      expect(o.classList.contains('start-city-option-registered')).toBe(false);
    });
  });

  it('fetchが失敗(reject)しても例外を投げず、未登録扱いにフォールバックする', async () => {
    setupPage((input: unknown) => {
      const url = String(input);
      if (url.indexOf('/api/heritage-journey/registered-starts-for-destination') === 0) {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve({ json: () => Promise.resolve({ exists: false }) });
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    Array.from(startSel.options).forEach((o) => {
      expect(o.classList.contains('start-city-option-registered')).toBe(false);
    });
  });
});
