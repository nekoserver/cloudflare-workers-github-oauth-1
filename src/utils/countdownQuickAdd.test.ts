import { JSDOM } from 'jsdom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCountdownQuickAddModalCSS,
  getCountdownQuickAddModalHTML,
  getCountdownQuickAddModalScript,
} from './countdownQuickAdd';

function setupDom() {
  const dom = new JSDOM(`<!DOCTYPE html><body>${getCountdownQuickAddModalHTML()}</body>`, { runScripts: 'dangerously' });
  const { window } = dom;
  window.eval(getCountdownQuickAddModalScript());
  return window;
}

function rowInputs(window: ReturnType<typeof setupDom>, index: number) {
  const rows = window.document.querySelectorAll('.qa-row-entry');
  const row = rows[index] as HTMLElement;
  return {
    date: row.querySelector('.qa-row-date') as HTMLInputElement,
    time: row.querySelector('.qa-row-time') as HTMLInputElement,
    label: row.querySelector('.qa-row-label') as HTMLInputElement,
  };
}

describe('getCountdownQuickAddModalCSS', () => {
  it('オーバーレイ・パネルのスタイル定義を含む', () => {
    expect(getCountdownQuickAddModalCSS()).toContain('#countdownQuickAddOverlay');
    expect(getCountdownQuickAddModalCSS()).toContain('#countdownQuickAddPanel');
    expect(getCountdownQuickAddModalCSS()).toContain('.open');
  });
});

describe('getCountdownQuickAddModalHTML', () => {
  it('行コンテナ・行追加ボタン・保存/キャンセルボタンを含む(日時+ラベルの各行はJS側で動的に生成する)', () => {
    const html = getCountdownQuickAddModalHTML();
    expect(html).toContain('id="countdownQuickAddOverlay"');
    expect(html).toContain('id="countdownQaRows"');
    expect(html).toContain('id="countdownQaAddRowBtn"');
    expect(html).toContain('id="countdownQaSaveBtn"');
    expect(html).toContain('id="countdownQaCancelBtn"');
  });
});

describe('getCountdownQuickAddModalScript', () => {
  it('スクリプトとして構文エラーが無い', () => {
    expect(() => new Function(getCountdownQuickAddModalScript())).not.toThrow();
  });

  it('window.openCountdownQuickAddModalを公開し、POST /api/countdownへevents配列を送る', () => {
    const script = getCountdownQuickAddModalScript();
    expect(script).toContain('window.openCountdownQuickAddModal = function(onSaved)');
    expect(script).toContain("fetch('/api/countdown'");
    expect(script).toContain("method: 'POST'");
    expect(script).toContain('events: events');
  });

  it('必要な要素が存在しないページで呼ばれても例外を投げないガードを持つ', () => {
    const script = getCountdownQuickAddModalScript();
    expect(script).toContain('window.openCountdownQuickAddModal = function() {};');
  });

  it('ドラッグハンドルへのpointerイベント配線と、開くたびに動的算出するz-indexロジックを含む', () => {
    const script = getCountdownQuickAddModalScript();
    expect(script).toContain("dragHandle.addEventListener('pointerdown'");
    expect(script).toContain("dragHandle.addEventListener('pointermove'");
    expect(script).toContain("dragHandle.addEventListener('pointerup'");
    expect(script).toContain('function getNextZIndex()');
    expect(script).toContain("overlay.style.zIndex = String(getNextZIndex())");
  });
});

describe('window.openCountdownQuickAddModal: 実DOMでの登録フロー(単発)', () => {
  let window: ReturnType<typeof setupDom>;

  beforeEach(() => {
    window = setupDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('モーダルを開いた直後は1行だけ、今日の日付・09:00・空ラベルで初期化される', () => {
    (window as any).openCountdownQuickAddModal();
    const doc = window.document;
    expect(doc.getElementById('countdownQuickAddOverlay')!.className).toContain('open');
    const rows = doc.querySelectorAll('.qa-row-entry');
    expect(rows.length).toBe(1);
    const { time, label } = rowInputs(window, 0);
    expect(time.value).toBe('09:00');
    expect(label.value).toBe('');
  });

  it('ラベル未入力で保存を押すとエラー表示になり、fetchは呼ばれない', () => {
    const fetchMock = vi.fn();
    (window as any).fetch = fetchMock;
    (window as any).openCountdownQuickAddModal();
    window.document.getElementById('countdownQaSaveBtn')!.dispatchEvent(new window.Event('click'));
    const errorEl = window.document.getElementById('countdownQaError') as any;
    expect(errorEl.style.display).toBe('block');
    expect(errorEl.textContent).toContain('予定の名前');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('正しく入力して保存するとPOST /api/countdownへ1件のevents配列を送り、成功時はモーダルを閉じてonSavedを呼ぶ', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true, id: 1 }) });
    (window as any).fetch = fetchMock;
    const onSaved = vi.fn();
    (window as any).openCountdownQuickAddModal(onSaved);
    const { date, label } = rowInputs(window, 0);
    label.value = '会議';
    date.value = '2026-09-01';

    window.document.getElementById('countdownQaSaveBtn')!.dispatchEvent(new window.Event('click'));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/countdown',
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].label).toBe('会議');
    expect(body.events[0].targetAt).toContain('2026-09-01');

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.document.getElementById('countdownQuickAddOverlay')!.className).not.toContain('open');
    expect(onSaved).toHaveBeenCalledWith({ ok: true, id: 1 });
  });

  it('サーバーがerrorを返した場合はモーダルを閉じずにエラーメッセージを表示する', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ error: '不正な日時です' }) });
    (window as any).fetch = fetchMock;
    (window as any).openCountdownQuickAddModal();
    const { date, label } = rowInputs(window, 0);
    label.value = '会議';
    date.value = '2026-09-01';

    window.document.getElementById('countdownQaSaveBtn')!.dispatchEvent(new window.Event('click'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const errorEl = window.document.getElementById('countdownQaError') as any;
    expect(errorEl.style.display).toBe('block');
    expect(errorEl.textContent).toBe('不正な日時です');
    expect(window.document.getElementById('countdownQuickAddOverlay')!.className).toContain('open');
  });

  it('キャンセルボタンでモーダルが閉じる', () => {
    (window as any).openCountdownQuickAddModal();
    window.document.getElementById('countdownQaCancelBtn')!.dispatchEvent(new window.Event('click'));
    expect(window.document.getElementById('countdownQuickAddOverlay')!.className).not.toContain('open');
  });

  it('バックドロップ自体をクリックするとモーダルが閉じる', () => {
    (window as any).openCountdownQuickAddModal();
    const overlay = window.document.getElementById('countdownQuickAddOverlay')!;

    overlay.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(overlay.className).not.toContain('open');
  });

  it('パネル内をクリックしてもモーダルは閉じない', () => {
    (window as any).openCountdownQuickAddModal();
    const overlay = window.document.getElementById('countdownQuickAddOverlay')!;
    const panel = window.document.getElementById('countdownQuickAddPanel')!;

    panel.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(overlay.className).toContain('open');
  });

  it('要素が無いページではopenCountdownQuickAddModalを呼んでも例外にならない', () => {
    const emptyDom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously' });
    emptyDom.window.eval(getCountdownQuickAddModalScript());
    expect(() => (emptyDom.window as any).openCountdownQuickAddModal()).not.toThrow();
  });
});

describe('window.openCountdownQuickAddModal: 一括登録(複数行)', () => {
  let window: ReturnType<typeof setupDom>;

  beforeEach(() => {
    window = setupDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('「+ もう1件追加」を押すと行が増える', () => {
    (window as any).openCountdownQuickAddModal();
    expect(window.document.querySelectorAll('.qa-row-entry').length).toBe(1);
    window.document.getElementById('countdownQaAddRowBtn')!.dispatchEvent(new window.Event('click'));
    expect(window.document.querySelectorAll('.qa-row-entry').length).toBe(2);
  });

  it('1行だけの場合、削除ボタンは非表示になる(最後の1行は消せない)', () => {
    (window as any).openCountdownQuickAddModal();
    const removeBtn = window.document.querySelector('.qa-row-remove-btn') as HTMLElement;
    expect(removeBtn.style.visibility).toBe('hidden');
  });

  it('2行以上ある状態で削除ボタンを押すとその行だけ消える', () => {
    (window as any).openCountdownQuickAddModal();
    window.document.getElementById('countdownQaAddRowBtn')!.dispatchEvent(new window.Event('click'));
    expect(window.document.querySelectorAll('.qa-row-entry').length).toBe(2);
    const removeBtn = window.document.querySelectorAll('.qa-row-remove-btn')[0] as HTMLElement;
    removeBtn.dispatchEvent(new window.Event('click'));
    expect(window.document.querySelectorAll('.qa-row-entry').length).toBe(1);
  });

  it('2件分入力して保存すると、events配列2件をまとめてPOST /api/countdownへ送る', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, events: [{ id: 1 }, { id: 2 }], groupId: 'g1' }),
    });
    (window as any).fetch = fetchMock;
    const onSaved = vi.fn();
    (window as any).openCountdownQuickAddModal(onSaved);
    window.document.getElementById('countdownQaAddRowBtn')!.dispatchEvent(new window.Event('click'));

    const row0 = rowInputs(window, 0);
    row0.label.value = '会議A';
    row0.date.value = '2026-09-01';
    const row1 = rowInputs(window, 1);
    row1.label.value = '会議B';
    row1.date.value = '2026-09-02';

    window.document.getElementById('countdownQaSaveBtn')!.dispatchEvent(new window.Event('click'));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events).toHaveLength(2);
    expect(body.events.map((e: { label: string }) => e.label)).toEqual(['会議A', '会議B']);

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSaved).toHaveBeenCalled();
  });

  it('複数行のうち1行でもラベル未入力なら、その行番号を含むエラーを表示しfetchは呼ばれない', () => {
    const fetchMock = vi.fn();
    (window as any).fetch = fetchMock;
    (window as any).openCountdownQuickAddModal();
    window.document.getElementById('countdownQaAddRowBtn')!.dispatchEvent(new window.Event('click'));

    const row0 = rowInputs(window, 0);
    row0.label.value = '会議A';
    row0.date.value = '2026-09-01';
    // 2行目はラベル未入力のまま

    window.document.getElementById('countdownQaSaveBtn')!.dispatchEvent(new window.Event('click'));

    const errorEl = window.document.getElementById('countdownQaError') as any;
    expect(errorEl.style.display).toBe('block');
    expect(errorEl.textContent).toContain('2件目');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('モーダルを開き直すと行は1件にリセットされる(前回の追加行が残らない)', () => {
    (window as any).openCountdownQuickAddModal();
    window.document.getElementById('countdownQaAddRowBtn')!.dispatchEvent(new window.Event('click'));
    expect(window.document.querySelectorAll('.qa-row-entry').length).toBe(2);
    window.document.getElementById('countdownQaCancelBtn')!.dispatchEvent(new window.Event('click'));

    (window as any).openCountdownQuickAddModal();
    expect(window.document.querySelectorAll('.qa-row-entry').length).toBe(1);
  });
});

function firePointerEvent(
  window: ReturnType<typeof setupDom>,
  target: Element,
  type: string,
  props: { pointerId: number; clientX: number; clientY: number }
) {
  const ev = new window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(ev, props);
  target.dispatchEvent(ev);
}

describe('window.openCountdownQuickAddModal: 画面中央表示・最前面z-index・ドラッグ移動', () => {
  let window: ReturnType<typeof setupDom>;

  beforeEach(() => {
    window = setupDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('開くたびにパネルの position/left/top がリセットされる(前回ドラッグしても中央から始まる)', () => {
    (window as any).openCountdownQuickAddModal();
    const panel = window.document.getElementById('countdownQuickAddPanel') as HTMLElement;
    panel.style.position = 'fixed';
    panel.style.left = '999px';
    panel.style.top = '888px';
    window.document.getElementById('countdownQaCancelBtn')!.dispatchEvent(new window.Event('click'));

    (window as any).openCountdownQuickAddModal();
    expect(panel.style.position).toBe('');
    expect(panel.style.left).toBe('');
    expect(panel.style.top).toBe('');
  });

  it('他に開いている[data-overlay]要素より高いz-indexを動的に割り振る(常に最前面)', () => {
    const otherOverlay = window.document.createElement('div');
    otherOverlay.setAttribute('data-overlay', '');
    otherOverlay.style.zIndex = '5000';
    window.document.body.appendChild(otherOverlay);

    (window as any).openCountdownQuickAddModal();
    const overlay = window.document.getElementById('countdownQuickAddOverlay') as HTMLElement;
    expect(parseInt(overlay.style.zIndex, 10)).toBeGreaterThan(5000);
  });

  it('タイトルのドラッグハンドルをpointerdown→pointermoveすると、パネルがfixed配置に切り替わり追従する', () => {
    (window as any).openCountdownQuickAddModal();
    const panel = window.document.getElementById('countdownQuickAddPanel') as HTMLElement;
    const handle = window.document.getElementById('countdownQaDragHandle') as HTMLElement;

    firePointerEvent(window, handle, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 150 });
    expect(panel.style.position).toBe('fixed');
    expect(panel.className).toContain('dragging');

    firePointerEvent(window, handle, 'pointermove', { pointerId: 1, clientX: 260, clientY: 190 });
    // jsdomのgetBoundingClientRectは常に0を返すため、offsetは開始clientXそのもの
    expect(panel.style.left).toBe('60px');
    expect(panel.style.top).toBe('40px');

    firePointerEvent(window, handle, 'pointerup', { pointerId: 1, clientX: 260, clientY: 190 });
    expect(panel.className).not.toContain('dragging');
  });

  it('別のpointerIdのpointermoveは無視する(同時マルチタッチでの誤動作を防ぐ)', () => {
    (window as any).openCountdownQuickAddModal();
    const panel = window.document.getElementById('countdownQuickAddPanel') as HTMLElement;
    const handle = window.document.getElementById('countdownQaDragHandle') as HTMLElement;

    firePointerEvent(window, handle, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 150 });
    // pointerdown自体がpanelの初期位置(0px, jsdomのgetBoundingClientRectは常に0)をセットする
    expect(panel.style.left).toBe('0px');
    firePointerEvent(window, handle, 'pointermove', { pointerId: 2, clientX: 999, clientY: 999 });
    // 異なるpointerIdのpointermoveは無視されるため、位置はpointerdown直後のまま変化しない
    expect(panel.style.left).toBe('0px');
  });
});
