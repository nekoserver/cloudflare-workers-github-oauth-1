// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「出発地・到着地」行、#end-city選択の右側にある
// 「ルート登録」ボタン(#register-route-btn)。出発地・到着地の組み合わせが
// D1の heritage_journey_registered_routes テーブルに未登録の場合のみ有効化され、
// 押すと /api/heritage-journey/register-route へPOSTしてルートを登録、
// 成功したらボタン自体をDOMから削除する。出発地・到着地を変更するたびに
// /api/heritage-journey/route-exists で再チェックする。
//
// 故障シナリオ:
//   (1) ボタンがマークアップに存在しない、または#end-cityと同じ行にない
//   (2) 初期表示時に存在チェックのfetchが行われず、ボタンの有効/無効が
//       サーバーの実データと無関係に固定されてしまう
//   (3) 出発地/到着地を変更しても再チェックが行われず、古い有効/無効状態が残る
//   (4) ボタン押下時にstart/end/座標を正しく送らない、またはPOST成功時にも
//       ボタンが残ったままになる
//   (5) POST失敗時にもボタンが消えてしまい、ユーザーが再試行できなくなる

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

describe('heritage-journeyページ: 「ルート登録」ボタンのマークアップ', () => {
  it('#register-route-btnが#end-cityと同じ行(.city-row)に存在する', () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ exists: false }) }));
    const btn = document.getElementById('register-route-btn') as HTMLButtonElement;
    const endCity = document.getElementById('end-city')!;
    expect(btn).not.toBeNull();
    expect(btn.closest('.city-row')).toBe(endCity.closest('.city-row'));
  });
});

describe('heritage-journeyページ: 初期表示時の存在チェック', () => {
  it('ページ読み込み時にroute-existsへfetchし、未登録(exists:false)ならボタンが有効になる', async () => {
    const { fetchMock } = setupPage(() => Promise.resolve({ json: () => Promise.resolve({ exists: false }) }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const calls = fetchMock.mock.calls.filter((c) => String(c[0]).indexOf('/api/heritage-journey/route-exists') === 0);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const btn = document.getElementById('register-route-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('既に登録済み(exists:true)ならボタンは無効のまま', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ exists: true }) }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const btn = document.getElementById('register-route-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

describe('heritage-journeyページ: 出発地・到着地の変更で再チェックされる', () => {
  it('#end-cityのchangeイベントで再度route-existsへfetchする', async () => {
    const { fetchMock } = setupPage(() => Promise.resolve({ json: () => Promise.resolve({ exists: false }) }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    fetchMock.mockClear();

    const endCity = document.getElementById('end-city') as unknown as HTMLSelectElement;
    endCity.value = endCity.options[1] ? endCity.options[1].value : endCity.value;
    endCity.dispatchEvent(new Event('change'));

    const calls = fetchMock.mock.calls.filter((c) => String(c[0]).indexOf('/api/heritage-journey/route-exists') === 0);
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('heritage-journeyページ: ボタン押下時の登録POSTと削除', () => {
  it('クリックするとstart/end/座標を含めてregister-routeへPOSTし、成功時(ok:true)にボタンが削除される', async () => {
    const { fetchMock } = setupPage((input: unknown) => {
      const url = String(input);
      if (url.indexOf('/api/heritage-journey/route-exists') === 0) {
        return Promise.resolve({ json: () => Promise.resolve({ exists: false }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({ ok: true, id: 1, straightKm: 1000 }) });
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById('register-route-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await Promise.resolve();

    const postCall = fetchMock.mock.calls.find((c) => String(c[0]) === '/api/heritage-journey/register-route');
    expect(postCall).toBeDefined();
    const init = postCall![1] as { method: string; body: string };
    expect(init.method).toBe('POST');
    const payload = JSON.parse(init.body);
    expect(payload.start).toBeTruthy();
    expect(payload.end).toBeTruthy();
    expect(typeof payload.startLat).toBe('number');
    expect(typeof payload.endLat).toBe('number');

    expect(document.getElementById('register-route-btn')).toBeNull();
  });

  it('POSTが失敗(ok:false)した場合、ボタンは削除されず再度クリック可能になる', async () => {
    setupPage((input: unknown) => {
      const url = String(input);
      if (url.indexOf('/api/heritage-journey/route-exists') === 0) {
        return Promise.resolve({ json: () => Promise.resolve({ exists: false }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({ ok: false, error: '重複しています' }) });
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById('register-route-btn') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await Promise.resolve();

    const btnAfter = document.getElementById('register-route-btn') as HTMLButtonElement;
    expect(btnAfter).not.toBeNull();
    expect(btnAfter.disabled).toBe(false);
    const errEl = document.getElementById('register-route-error')!;
    expect(errEl.style.display).not.toBe('none');
  });
});
