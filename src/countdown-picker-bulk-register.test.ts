// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCountdownPage } from './views/countdown';

// 対象: /countdownページのカレンダー日付タップから開くpicker-panel。
// 同じ日に複数件の予定をまとめて登録できるよう、「+ この日にもう1件追加」で
// 時刻+ラベルの行を増やせるようにし、保存時は全行をまとめて
// POST /api/countdownへ{events:[...]}}形式で一括送信する。
//
// 故障シナリオ:
//   (1) 行を追加しても実際には最初の1行しか送信されない
//   (2) 複数行のうち1行でも不正input(ラベル空など)がある場合に部分的に登録
//       されてしまう(全件検証してから送信すべき)
//   (3) 別の日付を開いたときに前回の追加行が残ってしまう

function buildPage(): string {
  return getCountdownPage('testuser');
}

async function setupPickerTest() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script'));

  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    if (String(url).includes('/api/countdown')) {
      return Promise.resolve({ json: () => Promise.resolve({ events: [] }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);

  const scriptSrc = html.slice(html.lastIndexOf('<script type="module">') + '<script type="module">'.length, html.lastIndexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  // カレンダーは非同期(loadEvents())で描画されるため一呼吸置く
  await new Promise((resolve) => setTimeout(resolve, 10));
  return fetchMock;
}

function openFirstAvailableDay() {
  const day = document.querySelector('.cal-day[data-date]') as HTMLElement;
  day.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
}

describe('/countdownページ(DOM実動作): カレンダーpickerの一括登録', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('日付をタップした直後は行が1件だけ表示される', async () => {
    await setupPickerTest();
    openFirstAvailableDay();
    expect(document.querySelectorAll('#pickerRows .picker-row').length).toBe(1);
  });

  it('「+ この日にもう1件追加」を押すと行が増える', async () => {
    await setupPickerTest();
    openFirstAvailableDay();
    document.getElementById('pickerAddRowBtn')!.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    expect(document.querySelectorAll('#pickerRows .picker-row').length).toBe(2);
  });

  it('2件入力して保存すると、events配列2件をまとめてPOST /api/countdownへ送る', async () => {
    const fetchMock = await setupPickerTest();
    openFirstAvailableDay();
    document.getElementById('pickerAddRowBtn')!.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    const rows = document.querySelectorAll('#pickerRows .picker-row');
    (rows[0].querySelector('.picker-row-label') as HTMLInputElement).value = '会議A';
    (rows[1].querySelector('.picker-row-label') as HTMLInputElement).value = '会議B';

    document.getElementById('pickerSaveBtn')!.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const postCall = fetchMock.mock.calls.find(
      (call) => String(call[0]) === '/api/countdown' && (call[1] as RequestInit | undefined)?.method === 'POST'
    );
    expect(postCall).toBeTruthy();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.events).toHaveLength(2);
    expect(body.events.map((e: { label: string }) => e.label)).toEqual(['会議A', '会議B']);
  });

  it('複数行のうち1行でもラベル未入力なら、POSTせずエラー表示する(部分登録を避ける)', async () => {
    const fetchMock = await setupPickerTest();
    openFirstAvailableDay();
    document.getElementById('pickerAddRowBtn')!.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    const rows = document.querySelectorAll('#pickerRows .picker-row');
    (rows[0].querySelector('.picker-row-label') as HTMLInputElement).value = '会議A';
    // 2行目はラベル未入力のまま

    document.getElementById('pickerSaveBtn')!.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    const postCall = fetchMock.mock.calls.find(
      (call) => String(call[0]) === '/api/countdown' && (call[1] as RequestInit | undefined)?.method === 'POST'
    );
    expect(postCall).toBeUndefined();
    const errorEl = document.getElementById('pickerError') as HTMLElement;
    expect(errorEl.style.display).toBe('block');
    expect(errorEl.textContent).toContain('2件目');
  });

  it('別の日付を開き直すと行は1件にリセットされる(前回の追加行が残らない)', async () => {
    await setupPickerTest();
    openFirstAvailableDay();
    document.getElementById('pickerAddRowBtn')!.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    expect(document.querySelectorAll('#pickerRows .picker-row').length).toBe(2);

    const days = document.querySelectorAll('.cal-day[data-date]');
    (days[1] as HTMLElement).dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    expect(document.querySelectorAll('#pickerRows .picker-row').length).toBe(1);
  });
});
