/**
 * 対象: /cf-containersページの最上部と左サイドパネルに出す、コンテナの状態の帯
 * (ビルド中・待機中・停止中)の判定。DBアクセス・fetchを含まない純粋関数(CLAUDE.mdルール15)。
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

export type BannerKind = 'building' | 'standby' | 'stopped' | 'unknown';

export type BannerState = {
  kind: BannerKind;
  container: BannerContainer;
  build: {
    // ビルドの状態を取得できたか。取得できなかったときは理由(error)を残す
    checked: boolean;
    building: boolean;
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

// コンテナのイメージをビルドするのは、本番(main)のビルドだけ。プレビュー(他のブランチ)は対象にしない。
export function isProductionBuild(build: BannerBuild): boolean {
  return build.branch === null || build.branch === 'main';
}

export function buildBannerState(input: { builds: BannerBuild[]; buildError?: string; container: BannerContainer }): BannerState {
  const inProgress = input.builds
    .filter((b) => isProductionBuild(b) && isBuildInProgress(b))
    .sort((a, b) => String(b.startedAt ?? b.createdAt ?? '').localeCompare(String(a.startedAt ?? a.createdAt ?? '')));
  const current = inProgress[0];
  const build: BannerState['build'] = input.buildError
    ? { checked: false, building: false, error: input.buildError }
    : current
      ? { checked: true, building: true, uuid: current.uuid, status: current.status, startedAt: current.startedAt ?? current.createdAt, branch: current.branch }
      : { checked: true, building: false };
  let kind: BannerKind;
  if (build.building) kind = 'building';
  else if (input.container.error) kind = 'unknown';
  else kind = input.container.running ? 'standby' : 'stopped';
  return { kind, container: input.container, build };
}
