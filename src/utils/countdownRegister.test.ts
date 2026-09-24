import { JSDOM } from 'jsdom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCountdownRegisterScript } from './countdownRegister';

// 対象: /welcome の「⏱️ カウントダウンに登録」が POST /api/countdown する処理。
// label は countdown_events の名前(右下ウィジェットと完了トーストの表示名)で、
// 呼び出し側が任意の文字列を渡す。
//
// 故障シナリオ:
//   (1) 共通スクリプトが window.registerCountdownEvent を公開しない
//   (2) 渡した label/targetAt が POST ボディに乗らない
//   (3) confirmNavigate=false なのに確認ダイアログを出す
//   (4) 失敗時に onError が空文字になり、呼び出し元が原因を出せない

function setupWindow() {
  const dom = new JSDOM('<!DOCTYPE html><body></body>', {
    url: 'https://example.test/welcome',
    runScripts: 'dangerously',
  });
  const win = dom.window;
  win.eval(getCountdownRegisterScript());
  return win;
}

describe('getCountdownRegisterScript', () => {
  it('スクリプトとして構文エラーが無い', () => {
    expect(() => new Function(getCountdownRegisterScript())).not.toThrow();
  });

  it('window.registerCountdownEvent を公開し、POST /api/countdown へ単発の label/targetAt を送る', () => {
    const script = getCountdownRegisterScript();
    expect(script).toContain('window.registerCountdownEvent = function(opts)');
    expect(script).toContain("fetch('/api/countdown'");
    expect(script).toContain("method: 'POST'");
    expect(script).toContain('label: label');
    expect(script).toContain('targetAt: targetAt');
  });
});

describe('window.registerCountdownEvent: 実DOMでの POST', () => {
  let win: ReturnType<typeof setupWindow>;

  beforeEach(() => {
    win = setupWindow();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('渡した label と targetAt をそのまま POST し、成功時は onSuccess を呼ぶ', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, id: 7, label: '会議' }),
    });
    win.fetch = fetchMock as unknown as typeof fetch;
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await (win as unknown as {
      registerCountdownEvent: (opts: Record<string, unknown>) => Promise<unknown>;
    }).registerCountdownEvent({
      label: '会議',
      targetAt: '2026-10-15T08:00:00.000Z',
      confirmNavigate: false,
      onSuccess,
      onError,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/countdown',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' })
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body).toEqual({ label: '会議', targetAt: '2026-10-15T08:00:00.000Z' });
    expect(onSuccess).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(win.location.pathname).toBe('/welcome');
  });

  it('サーバーが error を返したら onError に空でない詳細を渡し、遷移しない', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: '日時が不正です' }),
    });
    win.fetch = fetchMock as unknown as typeof fetch;
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await (win as unknown as {
      registerCountdownEvent: (opts: Record<string, unknown>) => Promise<unknown>;
    }).registerCountdownEvent({
      label: '会議',
      targetAt: 'not-a-date',
      confirmNavigate: false,
      onSuccess,
      onError,
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('日時が不正です');
    expect(win.location.pathname).toBe('/welcome');
  });

  it('confirmNavigate=true のときだけ確認ダイアログを出す(welcomeボタン互換)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, id: 1 }),
    });
    win.fetch = fetchMock as unknown as typeof fetch;
    const confirmMock = vi.fn().mockReturnValue(false);
    win.confirm = confirmMock;

    await (win as unknown as {
      registerCountdownEvent: (opts: Record<string, unknown>) => Promise<unknown>;
    }).registerCountdownEvent({
      label: 'セッション有効期限',
      targetAt: '2026-09-03T12:00:00.000Z',
      confirmNavigate: true,
    });

    expect(confirmMock).toHaveBeenCalled();
    expect(win.location.pathname).toBe('/welcome');
  });
});
