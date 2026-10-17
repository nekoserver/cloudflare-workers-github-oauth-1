import { describe, it, expect, vi } from 'vitest';
import { fetchLatestBuildLog, formatBuildLogLines } from './cfBuildsApi';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('formatBuildLogLines', () => {
  it('[timestamp, line]形式・{message}形式・文字列のいずれも1行ずつに整形する', () => {
    expect(formatBuildLogLines([[1, 'a'], { message: 'b' }, 'c'])).toBe('a\nb\nc');
  });
});

describe('fetchLatestBuildLog', () => {
  const creds = { accountId: 'acc', apiKey: 'tok' };

  it('scripts→builds→logsの順に呼び、最新ビルドのログ本文を返す', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ success: true, result: [{ id: 'other', tag: 'x' }, { id: 'my-worker', tag: 'tag1' }] }))
      .mockResolvedValueOnce(json({ success: true, result: [
        { build_uuid: 'old', status: 'success', created_on: '2026-10-16T00:00:00Z' },
        { build_uuid: 'new', status: 'failure', created_on: '2026-10-17T00:00:00Z' },
      ] }))
      .mockResolvedValueOnce(json({ success: true, result: { lines: [[1, 'step 1'], [2, 'ERROR: boom']] } }));
    const out = await fetchLatestBuildLog(creds, 'my-worker', undefined, fetcher as unknown as typeof fetch);
    expect(out.buildUuid).toBe('new');
    expect(out.status).toBe('failure');
    expect(out.log).toBe('step 1\nERROR: boom');
    expect((fetcher.mock.calls[1] as [string])[0]).toBe('https://api.cloudflare.com/client/v4/accounts/acc/builds/workers/tag1/builds');
    expect((fetcher.mock.calls[2] as [string])[0]).toBe('https://api.cloudflare.com/client/v4/accounts/acc/builds/builds/new/logs');
  });

  it('build_uuid指定時はscripts/buildsを呼ばずそのビルドのログを取る', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ success: true, result: { lines: ['x'] } }));
    const out = await fetchLatestBuildLog(creds, 'my-worker', 'b1', fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(out.log).toBe('x');
  });

  it('APIエラー(権限不足等)はCloudflareのエラー内容つきで例外にする(握りつぶさない)', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ success: false, result: null, errors: [{ code: 10000, message: 'Authentication error' }] }, 403));
    await expect(fetchLatestBuildLog(creds, 'my-worker', 'b1', fetcher as unknown as typeof fetch))
      .rejects.toThrow('Authentication error(code 10000) [HTTP 403]');
  });

  it('Workerが見つからなければ理由つきで例外にする', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ success: true, result: [{ id: 'other', tag: 'x' }] }));
    await expect(fetchLatestBuildLog(creds, 'my-worker', undefined, fetcher as unknown as typeof fetch))
      .rejects.toThrow(/my-worker/);
  });
});
