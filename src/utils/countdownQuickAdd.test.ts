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

describe('getCountdownQuickAddModalCSS', () => {
  it('オーバーレイ・パネルのスタイル定義を含む', () => {
    expect(getCountdownQuickAddModalCSS()).toContain('#countdownQuickAddOverlay');
    expect(getCountdownQuickAddModalCSS()).toContain('#countdownQuickAddPanel');
    expect(getCountdownQuickAddModalCSS()).toContain('.open');
  });
});

describe('getCountdownQuickAddModalHTML', () => {
  it('日付・時刻・ラベル入力欄と保存/キャンセルボタンを含む', () => {
    const html = getCountdownQuickAddModalHTML();
    expect(html).toContain('id="countdownQuickAddOverlay"');
    expect(html).toContain('id="countdownQaDate"');
    expect(html).toContain('id="countdownQaTime"');
    expect(html).toContain('id="countdownQaLabel"');
    expect(html).toContain('id="countdownQaSaveBtn"');
    expect(html).toContain('id="countdownQaCancelBtn"');
  });
});

describe('getCountdownQuickAddModalScript', () => {
  it('スクリプトとして構文エラーが無い', () => {
    expect(() => new Function(getCountdownQuickAddModalScript())).not.toThrow();
  });

  it('window.openCountdownQuickAddModalを公開し、POST /api/countdownを呼び出す', () => {
    const script = getCountdownQuickAddModalScript();
    expect(script).toContain('window.openCountdownQuickAddModal = function(onSaved)');
    expect(script).toContain("fetch('/api/countdown'");
    expect(script).toContain("method: 'POST'");
  });

  it('必要な要素が存在しないページで呼ばれても例外を投げないガードを持つ', () => {
    const script = getCountdownQuickAddModalScript();
    expect(script).toContain('window.openCountdownQuickAddModal = function() {};');
  });
});

describe('window.openCountdownQuickAddModal: 実DOMでの登録フロー', () => {
  let window: ReturnType<typeof setupDom>;

  beforeEach(() => {
    window = setupDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('モーダルを開いた直後は今日の日付・09:00・空ラベルで初期化される', () => {
    (window as any).openCountdownQuickAddModal();
    const doc = window.document;
    expect(doc.getElementById('countdownQuickAddOverlay')!.className).toContain('open');
    expect((doc.getElementById('countdownQaTime') as any).value).toBe('09:00');
    expect((doc.getElementById('countdownQaLabel') as any).value).toBe('');
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

  it('正しく入力して保存するとPOST /api/countdownを呼び、成功時はモーダルを閉じてonSavedを呼ぶ', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ id: 1 }) });
    (window as any).fetch = fetchMock;
    const onSaved = vi.fn();
    (window as any).openCountdownQuickAddModal(onSaved);
    (window.document.getElementById('countdownQaLabel') as any).value = '会議';
    (window.document.getElementById('countdownQaDate') as any).value = '2026-09-01';

    window.document.getElementById('countdownQaSaveBtn')!.dispatchEvent(new window.Event('click'));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/countdown',
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.label).toBe('会議');
    expect(body.targetAt).toContain('2026-09-01');

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.document.getElementById('countdownQuickAddOverlay')!.className).not.toContain('open');
    expect(onSaved).toHaveBeenCalledWith({ id: 1 });
  });

  it('サーバーがerrorを返した場合はモーダルを閉じずにエラーメッセージを表示する', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ error: '不正な日時です' }) });
    (window as any).fetch = fetchMock;
    (window as any).openCountdownQuickAddModal();
    (window.document.getElementById('countdownQaLabel') as any).value = '会議';
    (window.document.getElementById('countdownQaDate') as any).value = '2026-09-01';

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

  it('要素が無いページではopenCountdownQuickAddModalを呼んでも例外にならない', () => {
    const emptyDom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously' });
    emptyDom.window.eval(getCountdownQuickAddModalScript());
    expect(() => (emptyDom.window as any).openCountdownQuickAddModal()).not.toThrow();
  });
});
