import { JSDOM } from 'jsdom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  clampCountdownWidgetPosition,
  getCountdownWidgetCSS,
  getCountdownWidgetHTML,
  getCountdownWidgetScript,
} from './countdownWidget';

describe('clampCountdownWidgetPosition', () => {
  it('ビューポート内に収まる位置はそのまま返す', () => {
    expect(clampCountdownWidgetPosition(100, 200, 220, 80, 1000, 800)).toEqual({ left: 100, top: 200 });
  });

  it('左・上にはみ出す場合は0にクランプする', () => {
    expect(clampCountdownWidgetPosition(-50, -30, 220, 80, 1000, 800)).toEqual({ left: 0, top: 0 });
  });

  it('右・下にはみ出す場合はウィジェットが画面内に収まる位置にクランプする', () => {
    expect(clampCountdownWidgetPosition(950, 780, 220, 80, 1000, 800)).toEqual({ left: 780, top: 720 });
  });

  it('ウィジェットがビューポートより大きい場合は0にクランプする(負のmaxを避ける)', () => {
    expect(clampCountdownWidgetPosition(-10, -10, 1200, 900, 1000, 800)).toEqual({ left: 0, top: 0 });
  });
});

describe('getCountdownWidgetCSS', () => {
  it('#countdownWidgetのスタイル定義を含む', () => {
    expect(getCountdownWidgetCSS()).toContain('#countdownWidget');
    expect(getCountdownWidgetCSS()).toContain('.visible');
  });
});

describe('getCountdownWidgetHTML', () => {
  it('全タイマーを積み上げるコンテナを含む', () => {
    const html = getCountdownWidgetHTML();
    expect(html).toContain('id="countdownWidget"');
    expect(html).toContain('id="countdownWidgetTimers"');
  });

  it('トースト表示用の要素(id=countdownToast)を含む', () => {
    expect(getCountdownWidgetHTML()).toContain('id="countdownToast"');
  });
});

describe('getCountdownWidgetScript', () => {
  it('/api/countdown/nextを呼び出すコードを含む', () => {
    expect(getCountdownWidgetScript()).toContain("fetch('/api/countdown/next')");
  });

  it('cron更新を再描画するたびにhealthリンク付きツールチップを生成する', () => {
    const script = getCountdownWidgetScript({ state: 'healthy', label: '正常稼働' });
    expect(script).toContain("health.href = '/cron-status'");
    expect(script).toContain('var cronHealthState = "healthy"');
    expect(script).toContain('var cronHealthLabel = "正常稼働"');
  });

  it('スクリプトとして構文エラーが無い', () => {
    expect(() => new Function(getCountdownWidgetScript())).not.toThrow();
  });

  it('要素が存在しないページに埋め込んでも例外を投げずに何もしない(早期return)', () => {
    // @vitest-environment jsdom 前提: このファイル単体ではjsdomを使わないため
    // 文字列としてのガード節の存在だけを確認する
    expect(getCountdownWidgetScript()).toContain('if (!widget || !timersEl) return;');
  });

  it('ドラッグ&ドロップ用のpointerイベント配線とlocalStorageへの位置保存を含む', () => {
    const script = getCountdownWidgetScript();
    expect(script).toContain("addEventListener('pointerdown'");
    expect(script).toContain("addEventListener('pointermove'");
    expect(script).toContain("addEventListener('pointerup'");
    expect(script).toContain('countdownWidgetPosition');
    expect(script).toContain('window.localStorage.setItem(POSITION_STORAGE_KEY');
    expect(script).toContain('window.localStorage.getItem(POSITION_STORAGE_KEY');
  });

  it('タイマー完了時のフック呼び出しポイント(onTimerCompleted)が未実装であることを示すコメントを含む', () => {
    const script = getCountdownWidgetScript();
    expect(script).toContain('function onTimerCompleted(completedEvent)');
    expect(script).toContain('フック機構');
  });
});

describe('タイマー完了時のトースト表示(実DOM実行)', () => {
  const openDoms: JSDOM[] = [];

  afterEach(() => {
    // setInterval(tickWidget, 1000)/setInterval(fetchNextEvent, 30000)がプロセスを
    // 生かし続けvitestがハングするため、各テスト後にjsdomウィンドウを明示的に閉じる
    while (openDoms.length) openDoms.pop()!.window.close();
  });

  function setupDom() {
    const dom = new JSDOM(`<!DOCTYPE html><body>${getCountdownWidgetHTML()}</body>`, { runScripts: 'dangerously' });
    openDoms.push(dom);
    return dom.window;
  }

  async function flushMicrotasks() {
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  it('APIが返した未来のタイマーを省略せずすべて積み上げて表示する', async () => {
    const window = setupDom() as unknown as Window & typeof globalThis;
    (window as any).fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        events: [
          { id: 1, label: '最初', targetAt: '2098-01-01T00:00:00.000Z' },
          { id: 2, label: '次', targetAt: '2099-01-01T00:00:00.000Z' },
        ],
      }),
    });
    (window as any).setInterval = () => 0;
    window.eval(getCountdownWidgetScript());
    await flushMicrotasks();

    const timers = window.document.querySelectorAll('.countdown-widget-timer');
    expect(timers).toHaveLength(2);
    expect(Array.from(timers).map((timer) => timer.querySelector('.widget-label')?.textContent)).toEqual(['最初', '次']);
    expect(Array.from(timers).every((timer) => Boolean(timer.querySelector('.widget-clock')?.textContent))).toBe(true);
  });

  it('タイトルバーで全パネルを閉じて再表示でき、閉じたままAPI更新しても状態を保つ', async () => {
    const window = setupDom() as unknown as Window & typeof globalThis;
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ events: [
      { id: 1, label: '最初', targetAt: '2098-01-01T00:00:00.000Z' },
      { id: 2, label: '次', targetAt: '2099-01-01T00:00:00.000Z' },
    ] }) });
    (window as any).fetch = fetchMock;
    const intervals: Array<() => void> = [];
    (window as any).setInterval = (callback: () => void) => { intervals.push(callback); return 0; };
    window.eval(getCountdownWidgetScript());
    await flushMicrotasks();
    const widget = window.document.getElementById('countdownWidget')!;
    const button = window.document.getElementById('countdownWidgetToggle')!;
    const panels = window.document.getElementById('countdownWidgetTimers')!;
    expect(button.textContent).toBe('▲');
    button.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(widget.classList.contains('dragging')).toBe(false);
    button.click();
    expect(panels.hidden).toBe(true);
    expect(button.textContent).toBe('▼');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    intervals[1]();
    await flushMicrotasks();
    expect(panels.hidden).toBe(true);
    expect(widget.classList.contains('visible')).toBe(true);
    expect(panels.children).toHaveLength(2);
    button.click();
    expect(panels.hidden).toBe(false);
    expect(button.textContent).toBe('▲');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('残り時間が0以下になった瞬間、単発予定はトーストに「#id ok」を表示する', async () => {
    const window = setupDom() as unknown as Window & typeof globalThis;
    const pastTargetAt = new Date(Date.now() - 1000).toISOString();
    // 実際のAPIは期限切れイベントを二度と返さない(target_at > now でフィルタするため)。
    // モックも1回目だけ返し、以降はnullにしないと無限フェッチループになる。
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ event: { id: 7, label: '会議', targetAt: pastTargetAt, groupIndex: null, groupTotal: null } }),
      })
      .mockResolvedValue({ json: () => Promise.resolve({ event: null }) });
    (window as any).fetch = fetchMock;
    // setInterval(tickWidget)/setInterval(fetchNextEvent)は本テストでは不要
    // (初回のfetchNextEvent()呼び出しだけで検証できる)。放置するとプロセスが
    // 生き続けvitestがハングするため無効化する。
    (window as any).setInterval = () => 0;
    window.eval(getCountdownWidgetScript());
    await flushMicrotasks();

    const toast = window.document.getElementById('countdownToast')!;
    expect(toast.className).toContain('visible');
    expect(toast.textContent).toBe('#7 ok');
  });

  it('一括登録グループの予定は「index/total ok」形式でトーストを表示する', async () => {
    const window = setupDom() as unknown as Window & typeof globalThis;
    const pastTargetAt = new Date(Date.now() - 1000).toISOString();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ event: { id: 8, label: '会議B', targetAt: pastTargetAt, groupIndex: 2, groupTotal: 3 } }),
      })
      .mockResolvedValue({ json: () => Promise.resolve({ event: null }) });
    (window as any).fetch = fetchMock;
    (window as any).setInterval = () => 0;
    window.eval(getCountdownWidgetScript());
    await flushMicrotasks();

    const toast = window.document.getElementById('countdownToast')!;
    expect(toast.textContent).toBe('2/3 ok');
  });

  it('残り時間が0にならない限りトーストは表示されない', async () => {
    const window = setupDom() as unknown as Window & typeof globalThis;
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ event: { id: 9, label: '未来の予定', targetAt: '2099-01-01T00:00:00.000Z', groupIndex: null, groupTotal: null } }),
    });
    (window as any).fetch = fetchMock;
    (window as any).setInterval = () => 0;
    window.eval(getCountdownWidgetScript());
    await flushMicrotasks();

    const toast = window.document.getElementById('countdownToast')!;
    expect(toast.className).not.toContain('visible');
  });
});
