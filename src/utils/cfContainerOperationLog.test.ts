import { describe, it, expect, vi } from 'vitest';
import { recordContainerOperation, getContainerUsageSummary, formatElapsedSinceLastStart } from './cfContainerOperationLog';

function makeDb(runImpl: () => Promise<unknown> = async () => ({})) {
  const bind = vi.fn().mockReturnValue({ run: runImpl });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { db: { prepare } as any, prepare, bind };
}

describe('recordContainerOperation', () => {
  it('正常系: INSERT文を正しい値でbindしてtrueを返す', async () => {
    const { db, prepare, bind } = makeDb();
    const onError = vi.fn();
    const ok = await recordContainerOperation(
      db,
      { action: 'start', performedBy: 'admin-user', result: 'success' },
      onError
    );
    expect(ok).toBe(true);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO cf_container_operation_log'));
    expect(bind).toHaveBeenCalledWith('start', 'admin-user', 'success', null, expect.any(String), null, null, null, null);
    expect(onError).not.toHaveBeenCalled();
  });

  it('DB未設定ならfalseを返し、onErrorで通知する(握りつぶさない)', async () => {
    const onError = vi.fn();
    const ok = await recordContainerOperation(undefined, { action: 'stop', performedBy: 'x', result: 'success' }, onError);
    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('INSERT失敗時はfalseを返しonErrorで通知するが、例外は投げない(呼び出し元の本来の操作を止めない)', async () => {
    const { db } = makeDb(() => Promise.reject(new Error('d1 write failed')));
    const onError = vi.fn();
    const ok = await recordContainerOperation(db, { action: 'restart', performedBy: 'admin', result: 'failure', detail: 'timeout' }, onError);
    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledWith('d1 write failed');
  });
});

describe('getContainerUsageSummary', () => {
  it('正常系: 件数と直近start時刻を返す', async () => {
    const first = vi.fn().mockResolvedValue({ cnt: 3, last_started_at: '2026-10-16T10:00:00.000Z' });
    const db = { prepare: vi.fn().mockReturnValue({ first }) } as any;
    const summary = await getContainerUsageSummary(db);
    expect(summary).toEqual({ totalStartCount: 3, lastStartedAt: '2026-10-16T10:00:00.000Z' });
  });

  it('0件(一度もstartしていない)場合はtotalStartCount=0・lastStartedAt=nullを返す(クエリ失敗と区別する)', async () => {
    const first = vi.fn().mockResolvedValue({ cnt: 0, last_started_at: null });
    const db = { prepare: vi.fn().mockReturnValue({ first }) } as any;
    const summary = await getContainerUsageSummary(db);
    expect(summary).toEqual({ totalStartCount: 0, lastStartedAt: null });
  });

  it('first()がnullを返す異常系でも例外を投げず0件扱いにする', async () => {
    const first = vi.fn().mockResolvedValue(null);
    const db = { prepare: vi.fn().mockReturnValue({ first }) } as any;
    const summary = await getContainerUsageSummary(db);
    expect(summary).toEqual({ totalStartCount: 0, lastStartedAt: null });
  });
});

describe('formatElapsedSinceLastStart', () => {
  const now = new Date('2026-10-16T12:30:00.000Z');

  it('lastStartedAtがnullならnullを返す(「未起動」と「0分経過」を混同しない)', () => {
    expect(formatElapsedSinceLastStart(null, now)).toBeNull();
  });

  it('不正な日時文字列ならnullを返す', () => {
    expect(formatElapsedSinceLastStart('not-a-date', now)).toBeNull();
  });

  it('1時間以上経過していれば「◯時間△分」形式で返す', () => {
    expect(formatElapsedSinceLastStart('2026-10-16T10:15:00.000Z', now)).toBe('2時間15分');
  });

  it('1時間未満なら「△分」形式で返す', () => {
    expect(formatElapsedSinceLastStart('2026-10-16T12:05:00.000Z', now)).toBe('25分');
  });

  it('未来時刻(時計ズレ等)でも負の経過時間にせず0分扱いにする', () => {
    expect(formatElapsedSinceLastStart('2026-10-16T13:00:00.000Z', now)).toBe('0分');
  });
});

describe('diagActionForProxyPath / truncateDiagDetail', () => {
  it('診断用のパスだけdiag:のaction名を返し、それ以外はnull', async () => {
    const { diagActionForProxyPath } = await import('./cfContainerOperationLog');
    expect(diagActionForProxyPath('/health')).toBe('diag:health');
    expect(diagActionForProxyPath('/debug/logs')).toBe('diag:logs');
    expect(diagActionForProxyPath('/debug/net')).toBe('diag:net');
    expect(diagActionForProxyPath('/')).toBeNull();
    expect(diagActionForProxyPath('/debug/logs/x')).toBeNull();
  });

  it('長い診断結果は末尾を残して切り詰め、省略した文字数を示す', async () => {
    const { truncateDiagDetail } = await import('./cfContainerOperationLog');
    expect(truncateDiagDetail('abc', 5)).toBe('abc');
    expect(truncateDiagDetail('0123456789', 4)).toBe('[先頭6文字を省略]6789');
  });
});
