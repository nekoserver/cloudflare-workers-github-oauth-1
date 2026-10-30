/**
 * 対象: /cf-containersページの最上部と左サイドパネルに出す、コンテナの状態の帯
 * (ビルド中・ビルド失敗・待機中・停止中)の判定。DBアクセス・fetchを含まない純粋関数(CLAUDE.mdルール15)。
 */

export type BannerBuild = {
  uuid: string;
  status: string | null;
  outcome: string | null;
  branch: string | null;
  createdAt: string | null;
  startedAt: string | null;
};

export type BannerContainer = { running: boolean; label: string; status?: string; error?: string };

export type BannerKind = 'building' | 'build_failed' | 'standby' | 'stopped' | 'unknown';

export type BannerState = {
  kind: BannerKind;
  container: BannerContainer;
  build: {
    // ビルドの状態を取得できたか。取得できなかったときは理由(error)を残す
    checked: boolean;
    building: boolean;
    // 最新の本番のビルド(取り消し・スキップを除く)が失敗したか。失敗中は、コンテナは古いイメージのまま動いている
    failed: boolean;
    uuid?: string;
    status?: string | null;
    startedAt?: string | null;
    branch?: string | null;
    error?: string;
  };
};

// 終了したビルドのステータス。結果(build_outcome)が無くても、これらは「ビルド中」ではない。
const FINISHED_STATUSES = new Set(['stopped', 'success', 'failure', 'fail', 'failed', 'cancelled', 'canceled', 'terminated', 'skipped']);

// 結果が出ておらず、ステータスが終了系でないものを「ビルド中」とする。ステータスが取れないものは、ビルド中と決めない。
export function isBuildInProgress(build: BannerBuild): boolean {
  if (build.outcome) return false;
  const status = (build.status ?? '').toLowerCase();
  if (!status) return false;
  return !FINISHED_STATUSES.has(status);
}

// 失敗とみなす結果・ステータス。取り消し(cancelled)・スキップは、成否の判断に使わない。
const FAILED_RESULTS = new Set(['fail', 'failure', 'failed', 'error', 'errored']);
const IGNORED_RESULTS = new Set(['cancelled', 'canceled', 'skipped']);

export function isBuildFailed(build: BannerBuild): boolean {
  const result = (build.outcome ?? build.status ?? '').toLowerCase();
  return FAILED_RESULTS.has(result);
}

function isIgnoredBuild(build: BannerBuild): boolean {
  return IGNORED_RESULTS.has((build.outcome ?? build.status ?? '').toLowerCase());
}

const buildTime = (b: BannerBuild) => String(b.startedAt ?? b.createdAt ?? '');

// コンテナのイメージをビルドするのは、本番(main)のビルドだけ。プレビュー(他のブランチ)は対象にしない。
export function isProductionBuild(build: BannerBuild): boolean {
  return build.branch === null || build.branch === 'main';
}

export function buildBannerState(input: { builds: BannerBuild[]; buildError?: string; container: BannerContainer }): BannerState {
  const production = input.builds.filter(isProductionBuild).sort((a, b) => buildTime(b).localeCompare(buildTime(a)));
  const current = production.find(isBuildInProgress);
  // 最新の終わったビルド(取り消し・スキップを除く)。これが失敗なら、新しいイメージは出ていない。
  const latestFinished = production.find((b) => !isBuildInProgress(b) && !isIgnoredBuild(b) && (b.outcome || b.status));
  const failedBuild = latestFinished && isBuildFailed(latestFinished) ? latestFinished : undefined;
  const build: BannerState['build'] = input.buildError
    ? { checked: false, building: false, failed: false, error: input.buildError }
    : current
      ? { checked: true, building: true, failed: false, uuid: current.uuid, status: current.status, startedAt: current.startedAt ?? current.createdAt, branch: current.branch }
      : failedBuild
        ? { checked: true, building: false, failed: true, uuid: failedBuild.uuid, status: failedBuild.outcome ?? failedBuild.status, startedAt: failedBuild.startedAt ?? failedBuild.createdAt, branch: failedBuild.branch }
        : { checked: true, building: false, failed: false };
  let kind: BannerKind;
  if (build.building) kind = 'building';
  else if (build.failed) kind = 'build_failed';
  else if (input.container.error) kind = 'unknown';
  else kind = input.container.running ? 'standby' : 'stopped';
  return { kind, container: input.container, build };
}
