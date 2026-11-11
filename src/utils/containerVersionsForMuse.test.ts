import { describe, expect, it, vi } from 'vitest';
import {
  MUSE_CONTAINER_VERSIONS_FILE,
  buildContainerVersionsPrompt,
  loadContainerVersions,
  sendContainerVersionsToMuse,
  type ContainerVersionRow,
} from './containerVersionsForMuse';

// 故障想定:
// - D1の行の形(snake_case)を取り違え、Museに空の表を渡す
// - 更新できるものが埋もれて、Museが気づかない
// - 一覧が要望の上限(16KB)を超え、送れない
// - 記録が無いのに空の要望を送る
// - 同じ時刻に2回押して、要望の重複(request_id_conflict)になる

const row = (over: Partial<ContainerVersionRow>): ContainerVersionRow => ({
  containerKey: 'demo', packageName: 'node', installedVersion: '26.13.0', latestVersion: '26.13.0',
  updateStatus: 'current_or_ahead', source: 'nodejs.org', checkedAt: '2026-11-11T01:24:25.910Z', ...over,
});

function fakeDb(results: Record<string, unknown>[]) {
  const all = vi.fn(async () => ({ results }));
  const prepare = vi.fn(() => ({ all }));
  return { db: { prepare } as unknown as D1Database, prepare };
}

describe('loadContainerVersions', () => {
  it('D1の全コンテナの行を、コンテナ名・パッケージ名の順で読み、項目名を直す', async () => {
    const { db, prepare } = fakeDb([
      { container_key: 'demo', package_name: 'codex', installed_version: '0.166.0', latest_version: '0.167.1', update_status: 'update_available', source: 'npm', checked_at: 't' },
    ]);
    const rows = await loadContainerVersions(db);
    expect(rows).toEqual([{ containerKey: 'demo', packageName: 'codex', installedVersion: '0.166.0', latestVersion: '0.167.1', updateStatus: 'update_available', source: 'npm', checkedAt: 't' }]);
    const sql = String((prepare.mock.calls[0] as unknown[])[0]);
    expect(sql).toContain('FROM cf_container_package_release_status');
    expect(sql).toContain('ORDER BY container_key, package_name');
    expect(sql).not.toMatch(/WHERE\s+container_key/);
  });
});

describe('buildContainerVersionsPrompt', () => {
  const now = new Date('2026-11-11T16:30:00Z');

  it('保存先・更新のしかた・表を含み、更新できるものを先に並べる', () => {
    const prompt = buildContainerVersionsPrompt([
      row({ packageName: 'node' }),
      row({ packageName: 'codex', installedVersion: '0.166.0', latestVersion: '0.167.1', updateStatus: 'update_available', source: 'npm' }),
      row({ containerKey: 'other', packageName: 'git', installedVersion: '2.56.0', latestVersion: null, updateStatus: 'unsupported', source: null }),
    ], now)!;
    expect(prompt).toContain(MUSE_CONTAINER_VERSIONS_FILE);
    expect(prompt).toContain('上書き');
    expect(prompt).toContain('| コンテナ | パッケージ | 入っている版 | 最新版 | 状態 | 調べた先 |');
    const codex = prompt.indexOf('| demo | codex | 0.166.0 | 0.167.1 | 更新あり | npm |');
    const node = prompt.indexOf('| demo | node | 26.13.0 | 26.13.0 | 最新 | nodejs.org |');
    const git = prompt.indexOf('| other | git | 2.56.0 | - | 対象外 | - |');
    expect(codex).toBeGreaterThan(0);
    expect(node).toBeGreaterThan(codex);
    expect(git).toBeGreaterThan(0);
    expect(prompt).toContain('更新あり: 1件');
    expect(prompt).toContain('2026-11-11T16:30:00.000Z');
    expect(prompt).toContain('2026-11-11T01:24:25.910Z');
  });

  it('記録が無ければnullを返す(空の要望を送らない)', () => {
    expect(buildContainerVersionsPrompt([], now)).toBeNull();
  });

  it('表の区切りを壊す文字(| と改行)を値から除く', () => {
    const prompt = buildContainerVersionsPrompt([row({ source: 'a|b\nc' })], now)!;
    expect(prompt).toContain('| a/b c |');
  });
});

describe('sendContainerVersionsToMuse', () => {
  const now = new Date('2026-11-11T16:30:00.123Z');

  it('一覧を要望として送り、request_idは押した時刻から作る', async () => {
    const { db } = fakeDb([{ container_key: 'demo', package_name: 'node', installed_version: '1', latest_version: '1', update_status: 'current_or_ahead', source: 's', checked_at: 't' }]);
    const enqueue = vi.fn(async () => Response.json({ ok: true, jobId: 'j', messageId: 'container-versions-1794414600123', state: 'queued' }, { status: 202 }));
    const result = await sendContainerVersionsToMuse(db, enqueue, now);
    expect(result.ok).toBe(true);
    const body = (enqueue.mock.calls[0] as unknown[])[0] as { requestId: string; prompt: string };
    expect(body.requestId).toBe('container-versions-' + now.getTime());
    expect(body.requestId).toMatch(/^[a-zA-Z0-9-]{1,64}$/);
    expect(body.prompt).toContain(MUSE_CONTAINER_VERSIONS_FILE);
    if (result.ok) expect(result.response.status).toBe(202);
  });

  it('記録が無ければ送らずにno_dataを返す', async () => {
    const enqueue = vi.fn();
    const result = await sendContainerVersionsToMuse(fakeDb([]).db, enqueue, now);
    expect(result).toEqual({ ok: false, errorCode: 'no_data', detail: expect.stringContaining('cf_container_package_release_status') });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('要望の上限(16KB)を超えるなら送らずにtoo_largeを返す', async () => {
    const many = Array.from({ length: 400 }, (_, i) => ({ container_key: 'c' + i, package_name: 'package-with-a-long-name-' + i, installed_version: '1.2.3', latest_version: '4.5.6', update_status: 'update_available', source: 'somewhere', checked_at: '2026-11-11T00:00:00Z' }));
    const enqueue = vi.fn();
    const result = await sendContainerVersionsToMuse(fakeDb(many).db, enqueue, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('too_large');
    expect(enqueue).not.toHaveBeenCalled();
  });
});
