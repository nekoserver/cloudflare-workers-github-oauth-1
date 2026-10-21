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

  it('指定が無ければmainブランチの最新ビルドを選び、一覧にブランチと結果を出す', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ success: true, result: [{ id: 'my-worker', tag: 'tag1' }] }))
      .mockResolvedValueOnce(json({ success: true, result: [
        { build_uuid: 'pr', status: 'stopped', build_outcome: 'success', created_on: '2026-10-21T18:00:00Z', build_trigger_metadata: { branch: 'claude/x' } },
        { build_uuid: 'prod', status: 'stopped', build_outcome: 'fail', created_on: '2026-10-21T17:49:00Z', build_trigger_metadata: { branch: 'main' } },
      ] }))
      .mockResolvedValueOnce(json({ success: true, result: { lines: ['deploy'] } }));
    const out = await fetchLatestBuildLog(creds, 'my-worker', undefined, fetcher as unknown as typeof fetch);
    expect(out.buildUuid).toBe('prod');
    expect(out.status).toBe('stopped/fail');
    expect(out.recentBuilds[0]).toBe('2026-10-21T18:00:00Z stopped/success branch=claude/x pr');
    expect(out.recentBuilds[1]).toBe('2026-10-21T17:49:00Z stopped/fail branch=main prod');
  });

  it('ブランチ情報が無い一覧では、従来どおり最新ビルドを選ぶ', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ success: true, result: [{ id: 'my-worker', tag: 'tag1' }] }))
      .mockResolvedValueOnce(json({ success: true, result: [{ build_uuid: 'a', status: 'stopped', created_on: '2026-10-21T00:00:00Z' }] }))
      .mockResolvedValueOnce(json({ success: true, result: { lines: ['x'] } }));
    const out = await fetchLatestBuildLog(creds, 'my-worker', undefined, fetcher as unknown as typeof fetch);
    expect(out.buildUuid).toBe('a');
    expect(out.recentBuilds[0]).toBe('2026-10-21T00:00:00Z stopped branch=? a');
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

  it('truncated+cursorの間は続きのページを読み、全行をつなげて返す', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ success: true, result: { lines: [[1, 'p1']], truncated: true, cursor: 'c1' } }))
      .mockResolvedValueOnce(json({ success: true, result: { lines: [[2, 'p2']], truncated: true, cursor: 'c2' } }))
      .mockResolvedValueOnce(json({ success: true, result: { lines: [[3, 'ERROR: last']], truncated: false } }));
    const out = await fetchLatestBuildLog(creds, 'my-worker', 'b1', fetcher as unknown as typeof fetch);
    expect(out.log).toBe('p1\np2\nERROR: last');
    expect((fetcher.mock.calls[1] as [string])[0]).toBe('https://api.cloudflare.com/client/v4/accounts/acc/builds/builds/b1/logs?cursor=c1');
    expect((fetcher.mock.calls[2] as [string])[0]).toBe('https://api.cloudflare.com/client/v4/accounts/acc/builds/builds/b1/logs?cursor=c2');
  });

  it('同じcursorが返り続けても無限ループしない', async () => {
    const fetcher = vi.fn().mockImplementation(async () => json({ success: true, result: { lines: ['x'], truncated: true, cursor: 'same' } }));
    await fetchLatestBuildLog(creds, 'my-worker', 'b1', fetcher as unknown as typeof fetch);
    expect(fetcher.mock.calls.length).toBe(2);
  });

  it('実応答の形(キー・件数・cursorの有無)を値を出さずに記録する', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ success: true, result: { lines: [[1, 'a']], truncated: false, cursor: 'secret-ish' } }));
    const out = await fetchLatestBuildLog(creds, 'my-worker', 'b1', fetcher as unknown as typeof fetch);
    expect(out.responseShape).toEqual(['page0: {lines:array(len=1) first=[1,"a"], truncated:false, cursor:present}']);
  });
});

