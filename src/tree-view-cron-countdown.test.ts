import { describe, expect, it, vi } from 'vitest';
import { getCountdownPage } from './views/countdown';
import {
  getNextTreeViewCronAt,
  ensureTreeViewCronCountdownForUser,
  registerNextTreeViewCronCountdown,
  TREE_VIEW_CRON_COUNTDOWN_LABEL,
} from './utils/treeViewCronCountdown';

describe('tree-view cron countdown', () => {
  it.each([
    ['2026-09-22T00:00:00.000Z', '2026-09-22T06:00:00.000Z'],
    ['2026-09-22T05:59:59.999Z', '2026-09-22T06:00:00.000Z'],
    ['2026-09-22T18:00:00.000Z', '2026-09-23T00:00:00.000Z'],
  ])('次回の6時間境界を計算する: %s', (now, expected) => {
    expect(getNextTreeViewCronAt(new Date(now))).toBe(expected);
  });

  it('既存予定を消して、有効な全ユーザーへ次回日時を登録する', async () => {
    const statements = [{ kind: 'delete' }, { kind: 'insert' }];
    const bind = vi.fn((..._args: unknown[]) => statements.shift());
    const prepare = vi.fn((_sql: string) => ({ bind }));
    const batch = vi.fn().mockResolvedValue([
      { success: true, meta: { changes: 2 } },
      { success: true, meta: { changes: 3 } },
    ]);

    const result = await registerNextTreeViewCronCountdown(
      { prepare, batch } as unknown as D1Database,
      new Date('2026-09-22T12:01:00.000Z')
    );

    expect(result).toEqual({ registered: 3, targetAt: '2026-09-22T18:00:00.000Z' });
    expect(prepare.mock.calls[0][0]).toContain('DELETE FROM countdown_events');
    expect(prepare.mock.calls[1][0]).toContain('SELECT user_id');
    expect(prepare.mock.calls[1][0]).not.toContain('revoked_at');
    expect(bind).toHaveBeenCalledWith(TREE_VIEW_CRON_COUNTDOWN_LABEL);
    expect(bind).toHaveBeenCalledWith(TREE_VIEW_CRON_COUNTDOWN_LABEL, '2026-09-22T18:00:00.000Z');
    expect(batch).toHaveBeenCalledOnce();
  });

  it('ページ表示時のユーザーについて次回予定を即時に作り直す', async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn((..._args: unknown[]) => ({ run }));
    const prepare = vi.fn((_sql: string) => ({ bind }));

    await ensureTreeViewCronCountdownForUser(
      { prepare } as unknown as D1Database,
      'tester',
      new Date('2026-09-22T12:01:00.000Z')
    );

    expect(prepare.mock.calls[0][0]).toContain('DELETE FROM countdown_events');
    expect(prepare.mock.calls[1][0]).toContain('INSERT INTO countdown_events');
    expect(bind).toHaveBeenNthCalledWith(1, 'tester', TREE_VIEW_CRON_COUNTDOWN_LABEL);
    expect(bind).toHaveBeenNthCalledWith(2, 'tester', TREE_VIEW_CRON_COUNTDOWN_LABEL, '2026-09-22T18:00:00.000Z');
  });

  it('編集パネルに次回更新日時とcron周期を示すツールチップを置く', () => {
    const html = getCountdownPage('tester');
    expect(html).toContain('aria-label="tree-view cron更新について"');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('UTC 00:00 / 06:00 / 12:00 / 18:00');
    expect(html).toContain('nextTreeViewCronAt(new Date())');
    expect(html).toContain('この日時は次回cronの開始予定です');
  });
});
