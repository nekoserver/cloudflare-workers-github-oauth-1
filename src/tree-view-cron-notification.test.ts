import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./index', () => ({
  default: { fetch: vi.fn() }, syncAllTreeViewSnapshots: vi.fn(),
}));
vi.mock('./utils/treeViewCronCountdown', () => ({ registerNextTreeViewCronCountdown: vi.fn() }));
import worker from './worker-entry';
import { syncAllTreeViewSnapshots } from './index';
import { registerNextTreeViewCronCountdown } from './utils/treeViewCronCountdown';
import type { Bindings } from './types';

const result = { synced: ['nekoserver/dynamicneko'], skipped: ['nekoserver/cloudflare-workers-github-oauth-1'], failed: [] };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks(); });

async function runCron(env: Partial<Bindings>) {
  const pending: Promise<unknown>[] = [];
  await worker.scheduled({} as ScheduledEvent, env as Bindings, {
    waitUntil: (promise: Promise<unknown>) => { pending.push(promise); },
    passThroughOnException() {}, props: {},
  } as ExecutionContext);
  await Promise.all(pending);
}

describe('tree-view cron更新通知', () => {
  it('同期完了後に更新時間を本文へ入れ、ボタン付きでSlackに直接投稿する', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T06:01:02Z'));
    let complete!: (value: typeof result) => void;
    vi.mocked(syncAllTreeViewSnapshots).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    vi.mocked(registerNextTreeViewCronCountdown).mockResolvedValue({ registered: 2, targetAt: '2026-10-07T12:00:00Z' });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const pending = runCron({ SOT: 'test-token', SLACK_CHANNEL_ID: 'C123', NOTIFY_TARGET: 'worker' });
    expect(fetchMock).not.toHaveBeenCalled();
    complete(result);
    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://slack.com/api/chat.postMessage');
    const body = JSON.parse(options.body as string);
    expect(body.channel).toBe('C123');
    expect(body.text).toContain('2026/10/7 15:01:02');
    expect(body.text).toContain('更新: 1件 / 変更なし: 1件 / 失敗: 0件');
    expect(body.blocks[0].text.text).toContain('cronトリガー更新通知');
    expect(body.blocks.find((b: any) => b.type === 'actions').elements).toHaveLength(2);
    expect(registerNextTreeViewCronCountdown).toHaveBeenCalled();
  });

  it.each(['missing', 'network'])('通知の%sエラーでも同期と次回予定登録を完了する', async (mode) => {
    vi.mocked(syncAllTreeViewSnapshots).mockResolvedValue({ ...result, failed: [{ repoName: 'test', error: 'failed' }] });
    vi.mocked(registerNextTreeViewCronCountdown).mockResolvedValue({ registered: 2, targetAt: 'next' });
    const fetchMock = vi.fn().mockRejectedValue(new Error('network failed'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(runCron(mode === 'missing' ? {} : { SOT: 'test', SLACK_CHANNEL_ID: 'C123' })).resolves.toBeUndefined();
    expect(registerNextTreeViewCronCountdown).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(mode === 'missing' ? 0 : 1);
  });
});
