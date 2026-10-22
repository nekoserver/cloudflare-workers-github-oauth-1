import { expect, it, vi } from 'vitest';
vi.mock('./index', () => ({ default: { fetch: vi.fn() }, syncAllTreeViewSnapshots: vi.fn(), runCfContainerCronReport: vi.fn(), runCfContainerFirewallCron: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./containers/demoContainer', () => ({ DemoContainer: class {} }));
vi.mock('./utils/codexResetCountdown', () => ({ runCodexResetCountdownCron: vi.fn() }));
import worker from './worker-entry';
import { runCfContainerFirewallCron, runCfContainerCronReport, syncAllTreeViewSnapshots } from './index';
import type { Bindings } from './types';
import { runCodexResetCountdownCron } from './utils/codexResetCountdown';
it('runs hourly DB collection without invoking six-hour reports or notifications', async () => {
  const pending: Promise<unknown>[] = [];
  const env = {} as Bindings;
  const timestamp = Date.parse('2026-10-21T13:05:00Z');
  await worker.scheduled({ cron: '5 * * * *', scheduledTime: timestamp } as ScheduledEvent, env, { waitUntil: (p: Promise<unknown>) => pending.push(p) } as ExecutionContext);
  await Promise.all(pending);
  expect(runCfContainerFirewallCron).toHaveBeenCalledWith(env, new Date(timestamp));
  expect(runCfContainerCronReport).not.toHaveBeenCalled();
  expect(syncAllTreeViewSnapshots).not.toHaveBeenCalled();
  expect(runCodexResetCountdownCron).not.toHaveBeenCalled();
});
