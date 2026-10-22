import { describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { getCountdownPage } from './views/countdown';
import {
  getNextTreeViewCronAt,
  ensureTreeViewCronCountdownForUser,
  registerNextTreeViewCronCountdown,
  TREE_VIEW_CRON_COUNTDOWN_LABEL,
} from './utils/treeViewCronCountdown';

describe('tree-view cron countdown', () => {
  it('停止時に旧予定だけを監査情報付きで論理削除し、Codex予定は保持する', () => {
    const sql = new DatabaseSync(':memory:');
    try {
      for (const migration of ['0115_create_countdown_events', '0181_add_countdown_events_deleted_at', '0182_add_countdown_events_deletion_actor']) {
        sql.exec(readFileSync(`migrations/${migration}.sql`, 'utf8'));
      }
      sql.exec("INSERT INTO countdown_events (user_id,label,target_at) VALUES ('alice','tree-view cron更新','2099-01-01T00:00:00Z'),('alice','Codex 5時間リセット','2099-01-01T00:00:00Z')");
      const stop = readFileSync('migrations/0183_stop_tree_view_cron_countdowns.sql', 'utf8');
      sql.exec(stop);
      const old = sql.prepare('SELECT deleted_at, deleted_by, deletion_reason FROM countdown_events WHERE id = 1').get();
      expect(old?.deleted_at).toBeTruthy();
      expect(old?.deleted_by).toBe('system');
      expect(old?.deletion_reason).toContain('ユーザー指定');
      expect(sql.prepare('SELECT deleted_at FROM countdown_events WHERE id = 2').get()?.deleted_at).toBeNull();
      sql.exec(stop);
      expect(sql.prepare('SELECT deleted_at, deleted_by, deletion_reason FROM countdown_events WHERE id = 1').get()).toEqual(old);
    } finally { sql.close(); }
  });
  it.each([
    ['2026-09-22T00:00:00.000Z', '2026-09-22T06:00:00.000Z'],
    ['2026-09-22T05:59:59.999Z', '2026-09-22T06:00:00.000Z'],
    ['2026-09-22T18:00:00.000Z', '2026-09-23T00:00:00.000Z'],
  ])('次回の6時間境界を計算する: %s', (now, expected) => {
    expect(getNextTreeViewCronAt(new Date(now))).toBe(expected);
  });

  it('停止中はcronとページ表示のどちらからも次回予定を作成しない', async () => {
    const prepare = vi.fn(); const batch = vi.fn();
    const db = { prepare, batch } as unknown as D1Database;
    expect(await registerNextTreeViewCronCountdown(db)).toEqual({ registered: 0, targetAt: null });
    expect(await ensureTreeViewCronCountdownForUser(db, 'tester')).toEqual({ targetAt: null });
    expect(prepare).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });

  it('編集パネルに次回更新日時とcron周期を示すツールチップを置く', () => {
    const html = getCountdownPage('tester', {
      generatedAt: '2026-09-22T07:00:00.000Z',
      latestScheduledAt: '2026-09-22T06:00:05.000Z',
      dataAvailable: true,
    });
    expect(html).toContain('aria-label="tree-view cron更新について"');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('cron-health-button-unknown');
    expect(html).toContain('href="/cron-status">Health: 停止中');
    expect(html).toContain('UTC 00:00 / 06:00 / 12:00 / 18:00');
    expect(html).toContain('nextTreeViewCronAt(new Date())');
    expect(html).toContain('次回実行予定はありません');
  });

  it('cronの最終実行が古い場合はツールチップのランプを警告表示にする', () => {
    const html = getCountdownPage('tester', {
      generatedAt: '2026-09-22T14:30:00.000Z',
      latestScheduledAt: '2026-09-22T06:00:00.000Z',
      dataAvailable: true,
    });
    expect(html).toContain('cron-health-button-unknown');
    expect(html).toContain('href="/cron-status">Health: 停止中');
  });

  it('現在の予定一覧と更新後のウィジェットにもhealthボタン付きツールチップを作る', () => {
    const html = getCountdownPage('tester', {
      generatedAt: '2026-09-22T07:00:00.000Z',
      latestScheduledAt: '2026-09-22T06:00:05.000Z',
      dataAvailable: true,
    });
    expect(html).toContain("ev.label === 'tree-view cron更新'");
    expect(html).toContain('cron-health-button cron-health-button-\' + cronHealthState');
    expect(html).toContain("health.href = '/cron-status'");
    expect(html).toContain("health.textContent = 'Health: ' + cronHealthLabel");
  });
});
