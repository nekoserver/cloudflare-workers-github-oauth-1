import { describe, it, expect, vi } from 'vitest';
import { buildBannerState, isBuildInProgress, isProductionBuild, type BannerBuild } from './cfContainerBanner';
import { fetchBuildActivity } from './cfBuildsApi';
import { getCfContainersPage } from '../views/cfContainers';

const build = (over: Partial<BannerBuild> = {}): BannerBuild => ({
  uuid: 'b1', status: 'running', outcome: null, branch: 'main', createdAt: '2026-10-30T10:00:00Z', startedAt: null, ...over,
});
const stopped = { running: false, label: '停止済み', status: 'stopped' };
const running = { running: true, label: '起動中', status: 'running' };

describe('isBuildInProgress', () => {
  it('結果(build_outcome)が無く、ステータスが終了系でなければ、ビルド中', () => {
    for (const status of ['running', 'queued', 'initializing', 'building']) expect(isBuildInProgress(build({ status }))).toBe(true);
  });
  it('結果が出ているもの、終了系のステータスは、ビルド中ではない', () => {
    expect(isBuildInProgress(build({ status: 'stopped', outcome: 'success' }))).toBe(false);
    expect(isBuildInProgress(build({ status: 'running', outcome: 'fail' }))).toBe(false);
    for (const status of ['stopped', 'success', 'failure', 'fail', 'cancelled', 'terminated', 'skipped']) {
      expect(isBuildInProgress(build({ status }))).toBe(false);
    }
  });
  it('ステータスが取れないものは、ビルド中と決めない', () => {
    expect(isBuildInProgress(build({ status: null }))).toBe(false);
  });
});

describe('isProductionBuild', () => {
  it('main(または、ブランチ不明)だけが、コンテナのイメージをビルドする本番のビルド', () => {
    expect(isProductionBuild(build({ branch: 'main' }))).toBe(true);
    expect(isProductionBuild(build({ branch: null }))).toBe(true);
    expect(isProductionBuild(build({ branch: 'claude/x' }))).toBe(false);
  });
});

describe('buildBannerState', () => {
  it('本番のビルド中なら building。開始時刻は、始まった時刻(無ければ登録時刻)', () => {
    const s = buildBannerState({ builds: [build({ startedAt: '2026-10-30T10:01:00Z' })], container: running });
    expect(s.kind).toBe('building');
    expect(s.build).toMatchObject({ building: true, uuid: 'b1', startedAt: '2026-10-30T10:01:00Z', status: 'running' });
    expect(buildBannerState({ builds: [build()], container: running }).build.startedAt).toBe('2026-10-30T10:00:00Z');
  });

  it('ビルド中はコンテナの状態より優先する(停止中でも building)', () => {
    expect(buildBannerState({ builds: [build()], container: stopped }).kind).toBe('building');
  });

  it('プレビュー(main以外)のビルド中は、building にしない(イメージをビルドしないため)', () => {
    expect(buildBannerState({ builds: [build({ branch: 'claude/x' })], container: running }).kind).toBe('standby');
  });

  it('ビルド中が複数なら、新しく始まったものを使う', () => {
    const s = buildBannerState({ builds: [build({ uuid: 'old', createdAt: '2026-10-30T09:00:00Z' }), build({ uuid: 'new', createdAt: '2026-10-30T10:30:00Z' })], container: running });
    expect(s.build.uuid).toBe('new');
  });

  it('ビルド中でなければ、コンテナが起動中なら standby、停止なら stopped', () => {
    expect(buildBannerState({ builds: [build({ status: 'stopped', outcome: 'success' })], container: running }).kind).toBe('standby');
    expect(buildBannerState({ builds: [], container: stopped }).kind).toBe('stopped');
  });

  it('コンテナの状態を取得できないときは unknown(停止中と決めない)', () => {
    const s = buildBannerState({ builds: [], container: { running: false, label: '状態不明', error: 'binding missing' } });
    expect(s.kind).toBe('unknown');
    expect(s.container.error).toBe('binding missing');
  });

  it('ビルドの状態を取得できなくても、コンテナの状態は返し、取得できなかった理由を残す', () => {
    const s = buildBannerState({ builds: [], buildError: 'トークン未設定', container: running });
    expect(s.kind).toBe('standby');
    expect(s.build).toMatchObject({ checked: false, building: false, error: 'トークン未設定' });
  });
});

describe('fetchBuildActivity', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  it('Workerのビルド一覧から、状態・結果・ブランチ・時刻を取り出す', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ success: true, result: [{ id: 'my-worker', tag: 'tag1' }] }))
      .mockResolvedValueOnce(json({ success: true, result: [
        { build_uuid: 'a', status: 'running', build_outcome: null, created_on: '2026-10-30T10:00:00Z', started_on: '2026-10-30T10:01:00Z', build_trigger_metadata: { branch: 'main' } },
        { build_uuid: 'b', status: 'stopped', build_outcome: 'success', created_on: '2026-10-30T09:00:00Z', build_trigger_metadata: { branch: 'claude/x' } },
      ] }));
    const builds = await fetchBuildActivity({ accountId: 'acc', apiKey: 'key' }, 'my-worker', fetcher as unknown as typeof fetch);
    expect(builds[0]).toEqual({ uuid: 'a', status: 'running', outcome: null, branch: 'main', createdAt: '2026-10-30T10:00:00Z', startedAt: '2026-10-30T10:01:00Z' });
    expect(builds[1]).toMatchObject({ uuid: 'b', outcome: 'success', branch: 'claude/x', startedAt: null });
    expect(String(fetcher.mock.calls[1][0])).toContain('/builds/workers/tag1/builds');
  });
  it('Workerが見つからない・APIが失敗したときは、理由つきで例外にする(空にしない)', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ success: true, result: [] }));
    await expect(fetchBuildActivity({ accountId: 'a', apiKey: 'k' }, 'missing', fetcher as unknown as typeof fetch)).rejects.toThrow('missing');
  });
});

describe('buildBannerState: 本番のビルドの失敗を表示する(2026-10-30、失敗しても「待機中」と出ていた)', () => {
  const failed = (over: Partial<BannerBuild> = {}) => build({ uuid: 'f1', status: 'stopped', outcome: 'fail', createdAt: '2026-10-30T15:37:57Z', ...over });
  const success = (over: Partial<BannerBuild> = {}) => build({ uuid: 's1', status: 'stopped', outcome: 'success', createdAt: '2026-10-29T12:35:27Z', ...over });
  it('最新の本番のビルドが失敗なら、コンテナが起動中でも build_failed', () => {
    const state = buildBannerState({ builds: [success(), failed()], container: running });
    expect(state.kind).toBe('build_failed');
    expect(state.build.failed).toBe(true);
    expect(state.build.uuid).toBe('f1');
    expect(state.build.startedAt).toBe('2026-10-30T15:37:57Z');
  });
  it('失敗のあとに成功したビルドがあれば、コンテナの状態に戻る', () => {
    const state = buildBannerState({ builds: [failed(), success({ uuid: 's2', createdAt: '2026-10-30T18:18:00Z' })], container: running });
    expect(state.kind).toBe('standby');
    expect(state.build.failed).toBe(false);
  });
  it('ビルド中は、前のビルドの失敗より優先する', () => {
    const state = buildBannerState({ builds: [failed(), build({ uuid: 'r1', createdAt: '2026-10-30T18:18:00Z' })], container: running });
    expect(state.kind).toBe('building');
  });
  it('取り消された(cancelled)ビルドは、成否の判断に使わない', () => {
    const state = buildBannerState({ builds: [failed(), success({ uuid: 'c1', outcome: 'cancelled', createdAt: '2026-10-30T18:18:00Z' })], container: running });
    expect(state.kind).toBe('build_failed');
    expect(state.build.uuid).toBe('f1');
  });
  it('プレビュー(main以外)のビルドの失敗は、対象にしない', () => {
    const state = buildBannerState({ builds: [success(), failed({ branch: 'fix/x' })], container: running });
    expect(state.kind).toBe('standby');
  });
  it('結果が無くても、ステータスが失敗系(failure)なら失敗として扱う', () => {
    const state = buildBannerState({ builds: [failed({ outcome: null, status: 'failure' })], container: stopped });
    expect(state.kind).toBe('build_failed');
  });
  it('ビルドの状態を取得できないときは、失敗と決めない', () => {
    const state = buildBannerState({ builds: [], buildError: '403', container: running });
    expect(state.kind).toBe('standby');
    expect(state.build.failed).toBe(false);
  });
});

describe('/cf-containers ページの状態の帯', () => {
  const html = getCfContainersPage();

  it('ページの最上部(h1より前)に、状態の帯がある', () => {
    const banner = html.indexOf('id="status-banner"');
    expect(banner).toBeGreaterThan(-1);
    expect(banner).toBeLessThan(html.indexOf('<h1>'));
  });

  it('左サイドパネルの最上位(メニューより前)に、同じ状態が出る', () => {
    const aside = html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? '';
    const sidebar = aside.indexOf('id="sidebar-status"');
    expect(sidebar).toBeGreaterThan(-1);
    expect(sidebar).toBeLessThan(aside.indexOf('<details'));
  });

  it('状態の名前(ビルド中・ビルド失敗・待機中・停止中)と、APIを呼ぶ処理がある', () => {
    for (const label of ['ビルド中', 'ビルド失敗', '待機中', '停止中']) expect(html).toContain(label);
    expect(html).toContain('/api/cf-containers/banner');
  });

  it('ビルド中は赤字で点滅、待機中は緑のバッジ、停止中は灰色(固定色でなくCSS変数)。動きを減らす設定では点滅しない', () => {
    expect(html).toMatch(/\[data-kind="building"\][^{]*\{[^}]*color:\s*var\(--err\)/);
    expect(html).toContain('@keyframes status-blink');
    expect(html).toMatch(/\[data-kind="standby"\][^{]*\{[^}]*var\(--ok\)/);
    expect(html).toMatch(/\[data-kind="stopped"\][^{]*\{[^}]*var\(--muted\)/);
    expect(html).toMatch(/\[data-kind="build_failed"\][^{]*\{[^}]*color:\s*var\(--err\)/);
    expect(html).toMatch(/prefers-reduced-motion[^{]*\{[\s\S]*?animation:\s*none/);
  });

  it('埋め込みscriptがJavaScriptとして構文エラーにならない', () => {
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    for (const src of scripts) expect(() => new Function(src)).not.toThrow();
  });
});
