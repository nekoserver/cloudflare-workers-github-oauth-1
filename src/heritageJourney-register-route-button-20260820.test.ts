// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「出発地・到着地」行、#end-city選択の右側にある
// 「ルート登録」ボタン(#register-route-btn)。出発地・到着地の組み合わせが
// D1の heritage_journey_registered_routes テーブルに未登録の場合のみ有効化され、
// 押すと /api/heritage-journey/register-route へPOSTしてルートを登録、
// 成功したら現在の組み合わせについてボタンを無効化する。出発地・到着地を変更するたびに
// /api/heritage-journey/route-exists で再チェックする。
//
// 故障シナリオ:
//   (1) ボタンがマークアップに存在しない、または#end-cityと同じ行にない
//   (2) 初期表示時に存在チェックのfetchが行われず、ボタンの有効/無効が
//       サーバーの実データと無関係に固定されてしまう
//   (3) 出発地/到着地を変更しても再チェックが行われず、古い有効/無効状態が残る
//   (4) ボタン押下時にstart/end/座標を正しく送らない、またはPOST成功後に
//       現在の組み合わせを登録済みとして無効化しない
//   (5) POST失敗時にもボタンが消えてしまい、ユーザーが再試行できなくなる
//   (6) POST成功時にボタンをDOMから削除し、都市変更後の2件目を登録できなくなる

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

describe('heritage-journeyページ: ボタン押下時の登録POSTと状態更新', () => {
  it('クリックするとstart/end/座標を含めてregister-routeへPOSTし、成功時(ok:true)に登録済み状態になる', async () => {
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

    const btnAfter = document.getElementById('register-route-btn') as HTMLButtonElement;
    expect(btnAfter).not.toBeNull();
    expect(btnAfter.disabled).toBe(true);
    expect(btnAfter.title).toContain('既に登録済み');
  });

  it('1件登録後もボタンを残し、ローマ→リムリックへ変更すると2件目を登録できる', async () => {
    let registerCount = 0;
    const { fetchMock } = setupPage((input: unknown) => {
      const url = String(input);
      if (url.indexOf('/api/heritage-journey/route-exists') === 0) {
        return Promise.resolve({ json: () => Promise.resolve({ exists: false }) });
      }
      if (url === '/api/heritage-journey/register-route') {
        registerCount++;
        return Promise.resolve({ json: () => Promise.resolve({ ok: true, id: registerCount, straightKm: 1000 }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({ starts: [] }) });
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    (document.getElementById('register-route-btn') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const start = document.getElementById('start-city') as unknown as HTMLSelectElement;
    const end = document.getElementById('end-city') as unknown as HTMLSelectElement;
    start.value = 'Rome';
    start.dispatchEvent(new Event('change'));
    end.value = 'Limerick';
    end.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById('register-route-btn') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(false);
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const postCalls = fetchMock.mock.calls.filter((c) => String(c[0]) === '/api/heritage-journey/register-route');
    expect(postCalls).toHaveLength(2);
    expect(JSON.parse((postCalls[1][1] as { body: string }).body)).toMatchObject({
      start: 'ローマ',
      end: 'リムリック',
    });
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

// 対象: 「ウィーン→パリのルートが登録できない」という報告の根本原因調査で判明した、
// #register-route-btnが無効化されている理由をユーザーが判別できない不具合。
// 修正前は「既に登録済み(exists:true)」も「route-exists自体の通信・DBエラー」も
// 同じ「押せない灰色ボタン」にしか見えず、実際には正常に動作している(既に登録済み
// なだけの)組み合わせが「登録できないバグ」として報告される原因になっていた。
// 修正後はtitle属性(tooltip)で理由を明示する。
//
// 故障シナリオ:
//   (1) 既に登録済みの場合、無効化の理由がtitleに出ない
//   (2) route-existsがHTTPレベルは200でもerrorフィールドを返す実装(DBエラー等)の場合に、
//       existsだけを見てしまい「未登録」と誤判定して有効化してしまう、またはエラー理由が出ない
//   (3) fetch自体が例外を投げた場合(通信断等)に理由が出ない
//   (4) 有効な組み合わせに変わったのにtitleが古いまま残る
describe('heritage-journeyページ: 「ルート登録」ボタンが無効な理由をtitle属性で明示する(ウィーン→パリ調査)', () => {
  it('既に登録済み(exists:true)の場合、titleに「既に登録済み」である旨が入る', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ exists: true }) }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const btn = document.getElementById('register-route-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain('既に登録済み');
  });

  it('route-existsがHTTP 200でもerrorフィールドを返す場合、exists:falseでも登録済み扱いにせず、titleにエラー理由が入る', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ exists: false, error: 'DB unavailable' }) }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const btn = document.getElementById('register-route-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain('確認に失敗');
    expect(btn.title).toContain('DB unavailable');
  });

  it('fetch自体が例外(通信断等)の場合も、titleに確認失敗である旨が入る', async () => {
    setupPage(() => Promise.reject(new Error('network down')));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const btn = document.getElementById('register-route-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain('確認に失敗');
    expect(btn.title).toContain('network down');
  });

  it('未登録(exists:false, errorなし)の場合はtitleが空になり、ボタンが有効になる', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ exists: false }) }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const btn = document.getElementById('register-route-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.title).toBe('');
  });

  it('登録済み→未登録に変わった(出発地/到着地を変更した)場合、古いtitleが残らずクリアされる', async () => {
    let existsNow = true;
    const { fetchMock } = setupPage(() => {
      return Promise.resolve({ json: () => Promise.resolve({ exists: existsNow }) });
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const btn = document.getElementById('register-route-btn') as HTMLButtonElement;
    expect(btn.title).toContain('既に登録済み');

    existsNow = false;
    document.getElementById('end-city')!.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(btn.title).toBe('');
    expect(btn.disabled).toBe(false);
  });
});
