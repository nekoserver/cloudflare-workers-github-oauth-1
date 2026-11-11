// 各コンテナの版の一覧(D1 cf_container_package_release_status)を、Museへの要望(MuseAgentJobs)として渡す。
// Museは届いた一覧を muse-vm の MUSE_CONTAINER_VERSIONS_FILE に上書き保存し、届くたびに更新する。
// 一覧の元は /cf-containers が記録する「入っている版・最新版・更新の有無」。新しいコンテナが記録されれば自動で加わる。

/** Museが一覧を置く場所(muse-vm上)。Museはここを読めばよい。 */
export const MUSE_CONTAINER_VERSIONS_FILE = '~/workspace/container-versions.md';

/** MuseAgentJobs.enqueue が受け付ける要望の上限(バイト)。 */
const MUSE_PROMPT_MAX_BYTES = 16384;

export type ContainerVersionRow = {
  containerKey: string;
  packageName: string;
  installedVersion: string | null;
  latestVersion: string | null;
  updateStatus: string;
  source: string | null;
  checkedAt: string;
};

export type SendContainerVersionsResult =
  | { ok: true; response: Response; count: number }
  | { ok: false; errorCode: 'no_data' | 'too_large'; detail: string };

const STATUS_LABELS: Record<string, string> = {
  update_available: '更新あり',
  current_or_ahead: '最新',
  latest_unavailable: '最新版が不明',
  unsupported: '対象外',
  not_detected: '未検出',
  unknown: '不明',
};

/** 全コンテナの版の記録を読む。 */
export async function loadContainerVersions(db: D1Database): Promise<ContainerVersionRow[]> {
  const { results } = await db.prepare(
    'SELECT container_key, package_name, installed_version, latest_version, update_status, source, checked_at FROM cf_container_package_release_status ORDER BY container_key, package_name',
  ).all<{ container_key: string; package_name: string; installed_version: string | null; latest_version: string | null; update_status: string; source: string | null; checked_at: string }>();
  return (results ?? []).map((r) => ({
    containerKey: r.container_key,
    packageName: r.package_name,
    installedVersion: r.installed_version,
    latestVersion: r.latest_version,
    updateStatus: r.update_status,
    source: r.source,
    checkedAt: r.checked_at,
  }));
}

function cell(value: string | null): string {
  if (value === null || value === '') return '-';
  return value.replace(/\|/g, '/').replace(/[\r\n]+/g, ' ');
}

/** Museに渡す要望の本文。記録が無ければnull。 */
export function buildContainerVersionsPrompt(rows: ContainerVersionRow[], now: Date): string | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    const rank = (r: ContainerVersionRow) => (r.updateStatus === 'update_available' ? 0 : 1);
    return rank(a) - rank(b) || a.containerKey.localeCompare(b.containerKey) || a.packageName.localeCompare(b.packageName);
  });
  const updates = rows.filter((r) => r.updateStatus === 'update_available').length;
  const checked = rows.map((r) => r.checkedAt).sort().slice(-1)[0];
  const table = [
    '| コンテナ | パッケージ | 入っている版 | 最新版 | 状態 | 調べた先 |',
    '|---|---|---|---|---|---|',
    ...sorted.map((r) => `| ${cell(r.containerKey)} | ${cell(r.packageName)} | ${cell(r.installedVersion)} | ${cell(r.latestVersion)} | ${STATUS_LABELS[r.updateStatus] ?? cell(r.updateStatus)} | ${cell(r.source)} |`),
  ];
  return [
    '各コンテナの版の一覧です。次のとおり保存してください。',
    '',
    `1. 下の「# コンテナの版の一覧」以降を、${MUSE_CONTAINER_VERSIONS_FILE} にそのまま上書き保存する(ディレクトリが無ければ作る)。`,
    '2. この要望が届くたびに、同じファイルを新しい一覧で上書きして更新する。古い一覧は残さない。',
    '3. 返信には、保存したファイルのパスと「更新あり」の件数・パッケージ名だけを書く。コンテナやパッケージそのものは変えない。',
    '',
    '# コンテナの版の一覧',
    '',
    `- 作成: ${now.toISOString()}(本体ワーカー)`,
    `- 記録の時刻: ${checked}(/cf-containers が D1 cf_container_package_release_status に記録)`,
    `- 更新あり: ${updates}件 / 全${rows.length}件`,
    '',
    ...table,
    '',
  ].join('\n');
}

/** 一覧を作り、enqueue(MuseAgentJobsへの要望の追加)に渡す。 */
export async function sendContainerVersionsToMuse(
  db: D1Database,
  enqueue: (body: { requestId: string; prompt: string }) => Promise<Response>,
  now: Date = new Date(),
): Promise<SendContainerVersionsResult> {
  const rows = await loadContainerVersions(db);
  const prompt = buildContainerVersionsPrompt(rows, now);
  if (prompt === null) {
    return { ok: false, errorCode: 'no_data', detail: 'cf_container_package_release_status に記録がありません。/cf-containers で最新版の確認を先に実行してください' };
  }
  const bytes = new TextEncoder().encode(prompt).length;
  if (bytes > MUSE_PROMPT_MAX_BYTES) {
    return { ok: false, errorCode: 'too_large', detail: `一覧が要望の上限を超えています(${bytes}バイト、上限${MUSE_PROMPT_MAX_BYTES}バイト)` };
  }
  const response = await enqueue({ requestId: `container-versions-${now.getTime()}`, prompt });
  return { ok: true, response, count: rows.length };
}
