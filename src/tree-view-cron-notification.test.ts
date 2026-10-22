import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./index', () => ({
  default: { fetch: vi.fn() }, syncAllTreeViewSnapshots: vi.fn(),
  runCfContainerCronReport: vi.fn().mockResolvedValue({ ok: true }),
  runCfContainerFirewallCron: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./utils/codexResetCountdown', () => ({ runCodexResetCountdownCron: vi.fn().mockResolvedValue({ registered: 2 }) }));
vi.mock('./utils/treeViewCronCountdown', () => ({ registerNextTreeViewCronCountdown: vi.fn() }));
vi.mock('./utils/treeViewCronNotify', () => ({ notifyTreeViewCronUpdate: vi.fn() }));
vi.mock('./containers/demoContainer', () => ({ DemoContainer: class {} }));
import worker from './worker-entry';
import { syncAllTreeViewSnapshots, runCfContainerCronReport } from './index';
import { registerNextTreeViewCronCountdown } from './utils/treeViewCronCountdown';
import { notifyTreeViewCronUpdate } from './utils/treeViewCronNotify';
import { runCodexResetCountdownCron } from './utils/codexResetCountdown';
import type { Bindings } from './types';
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
async function runCron() {
  const pending: Promise<unknown>[] = [];
  await worker.scheduled({ cron: '0 */6 * * *', scheduledTime: Date.now() } as ScheduledEvent, {
    SOT: 'configured', SLACK_CHANNEL_ID: 'C123', GITHUB_TOKEN: 'configured',
  } as Bindings, { waitUntil: (promise: Promise<unknown>) => { pending.push(promise); } } as ExecutionContext);
  await Promise.all(pending);
}
describe('repository checks are fully stopped for cron', () => {
  it('does not check repositories, register their next run, or send their Slack notifications even with credentials', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await runCron();
    expect(syncAllTreeViewSnapshots).not.toHaveBeenCalled();
    expect(registerNextTreeViewCronCountdown).not.toHaveBeenCalled();
    expect(notifyTreeViewCronUpdate).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(runCodexResetCountdownCron).toHaveBeenCalledOnce();
    expect(runCfContainerCronReport).toHaveBeenCalledOnce();
  });
  it('keeps the remaining scheduled jobs independent when Codex fails', async () => {
    vi.mocked(runCodexResetCountdownCron).mockRejectedValueOnce(new Error('unavailable'));
    await expect(runCron()).resolves.toBeUndefined();
    expect(runCfContainerCronReport).toHaveBeenCalledOnce();
    expect(syncAllTreeViewSnapshots).not.toHaveBeenCalled();
  });
});
