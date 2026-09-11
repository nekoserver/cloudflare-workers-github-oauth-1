// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCountdownPage } from './views/countdown';

// 対象: /countdownページの「登録済みの予定」セクション。カレンダー上の日付を
// タップすると、その日に登録されている予定だけに絞り込んで表示するように
// なった(従来は常に全件を日時昇順で表示していた)。
//
// 故障シナリオ:
//   (1) 日付をタップしても一覧が絞り込まれない
//   (2) 絞り込み中に「すべて表示」を押しても解除されない
//   (3) 該当日に予定が無い場合、絞り込み前の全件が表示され続けてしまう
//   (4) 絞り込み状態がpicker登録後のloadEvents()で失われず、意図せず解除/維持
//       いずれの挙動になるかが検証されていない

function buildPage(): string {
  return getCountdownPage('testuser', true);
}

async function setupPageTest(events: { id: number; label: string; target_at: string }[]) {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script'));

  const fetchMock = vi.fn((url: string) => {
    if (String(url) === '/api/countdown') {
      return Promise.resolve({ json: () => Promise.resolve({ events }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);

  const scriptSrc = html.slice(html.lastIndexOf('<script type="module">') + '<script type="module">'.length, html.lastIndexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  await new Promise((resolve) => setTimeout(resolve, 10));
  return fetchMock;
}

function eventLabels(): string[] {
  return Array.from(document.querySelectorAll('#eventList .event-label')).map((el) => el.textContent || '');
}

function clickDay(dateAttr: string) {
  const day = document.querySelector(`.cal-day[data-date="${dateAttr}"]`) as HTMLElement;
  day.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
}

describe('/countdownページ(DOM実動作): 登録済みの予定一覧のカレンダー日付フィルタ', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const events = [
    { id: 1, label: '今日の予定A', target_at: `${todayStr}T09:00:00` },
    { id: 2, label: '今日の予定B', target_at: `${todayStr}T18:00:00` },
    { id: 3, label: '明日の予定', target_at: `${tomorrowStr}T09:00:00` },
  ];

  it('初期表示ではフィルタバーが非表示で、全件が表示される', async () => {
    await setupPageTest(events);
    expect((document.getElementById('eventListFilterBar') as HTMLElement).style.display).toBe('none');
    expect(eventLabels().sort()).toEqual(['今日の予定A', '今日の予定B', '明日の予定'].sort());
  });

  it('カレンダーで日付をタップすると、その日の予定だけに絞り込まれフィルタバーが表示される', async () => {
    await setupPageTest(events);
    clickDay(todayStr);

    expect(eventLabels().sort()).toEqual(['今日の予定A', '今日の予定B']);
    const filterBar = document.getElementById('eventListFilterBar') as HTMLElement;
    expect(filterBar.style.display).toBe('flex');
    expect(document.getElementById('eventListFilterLabel')!.textContent).toContain('日の予定のみ表示中');
  });

  it('該当日に予定が無い場合は「この日に登録されている予定はありません」を表示する', async () => {
    await setupPageTest(events);
    const dayAfterTomorrow = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    // カレンダー上に存在する日付のみクリックできるため、当月内であることを期待して
    // 該当セルが無ければテストをスキップする(月末付近での実行を考慮)
    const cell = document.querySelector(`.cal-day[data-date="${dayAfterTomorrow}"]`);
    if (!cell) return;
    clickDay(dayAfterTomorrow);
    expect(document.getElementById('eventList')!.textContent).toContain('この日に登録されている予定はありません');
  });

  it('「すべて表示」を押すとフィルタが解除され全件表示に戻る', async () => {
    await setupPageTest(events);
    clickDay(todayStr);
    expect(eventLabels().length).toBe(2);

    document.getElementById('eventListFilterClearBtn')!.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    expect((document.getElementById('eventListFilterBar') as HTMLElement).style.display).toBe('none');
    expect(eventLabels().length).toBe(3);
  });

  it('フィルタ中の日付セルにselectedクラスが付く', async () => {
    await setupPageTest(events);
    clickDay(todayStr);
    const cell = document.querySelector(`.cal-day[data-date="${todayStr}"]`) as HTMLElement;
    expect(cell.className).toContain('selected');
  });
});
