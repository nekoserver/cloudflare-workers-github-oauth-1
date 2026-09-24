import cloudflareWorkersGithubOauth1TreeJson from '../data/cloudflare-workers-github-oauth-1.tree.json';
import dynamicnekoTreeJson from '../data/dynamicneko.tree.json';

// /tree-view(dynamicneko)のサイドバーツリーを、GitHub Trees APIの結果から
// 構築するための純粋関数群。以前はdynamicneko側にgit ls-treeの結果を
// 手作業でTypeScriptファイルへ焼き込んだ静的スナップショットとして持たせて
// いたが、新しいコミット・新しいリポジトリが増えても自動反映されない
// 問題があった(2026-09-19、ユーザー指摘)。この関数はcronトリガー
// (worker-entry.tsのscheduled)から呼ばれ、結果をD1(tree_view_snapshots)へ
// 保存する。保存されたJSONをdynamicneko側がAPI経由でその場で読み出す
// ことで、ツリーが常に最新の状態を反映するようになる。

export type TreeViewSnapshotNode = {
  name: string;
  type: 'file' | 'dir';
  children?: TreeViewSnapshotNode[];
};

export type GithubTreeItem = { path: string; type: 'blob' | 'tree' | 'commit' };

/**
 * D1 に保存済みのツリーを基準に、GitHub の最新ツリーにだけ存在するノードを
 * 追加する。保存済みノードは削除も上書きもしないため、部分的な Trees API
 * レスポンスや一時的な取得漏れで既存データを失わない。
 *
 * 削除・リネームされたファイルが永久にツリーへ残り続ける("ファイル数が
 * 増える一方で減らない")原因だったため、現在は latest.truncated===false の
 * ときだけ使う関数になった(resolveNextTreeViewSnapshot参照)。
 */
export function mergeMissingTreeViewNodes(
  existing: TreeViewSnapshotNode,
  latest: TreeViewSnapshotNode,
): TreeViewSnapshotNode {
  if (existing.type !== 'dir' || latest.type !== 'dir') return existing;

  const latestChildren = latest.children ?? [];
  const existingChildren = existing.children ?? [];
  const latestByName = new Map(latestChildren.map((child) => [child.name, child]));
  const merged = existingChildren.map((child) => {
    const latestChild = latestByName.get(child.name);
    latestByName.delete(child.name);
    return latestChild ? mergeMissingTreeViewNodes(child, latestChild) : child;
  });

  merged.push(...latestByName.values());
  merged.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return merged.length > 0 ? { ...existing, children: merged } : existing;
}

/**
 * D1に保存する次のスナップショットを決める。
 *
 * 以前はGitHub Trees APIの取得結果に関わらず常にmergeMissingTreeViewNodes
 * (既存ノードへの追加のみ・削除もリネームも反映しない)を使っていたため、
 * リポジトリ側でファイルを削除・リネームしても/tree-viewのファイル数が
 * 一切減らず、`/neko tvupdate --force`しても更新されたように見えない
 * 問題があった(2026-09-24、ユーザー指摘)。
 *
 * GitHub Trees APIはレスポンスが大きすぎる場合(エントリ数上限・7MB超)に
 * `truncated: true`を返し、その場合はtree配列が部分的にしか含まれない。
 * truncatedなレスポンスを正として全置換すると、たまたま返された範囲外の
 * 既存ファイルが消えてしまう(mergeMissingTreeViewNodesの元々の設計意図)。
 * そのため truncated かどうかで戦略を切り替える:
 *   - truncated===false (通常): GitHubの最新ツリーをそのまま正として使う
 *     (削除・リネームも反映される)
 *   - truncated===true (巨大リポジトリで一部欠落): 従来通り追加のみの
 *     マージに留め、既存データを失わない
 */
export function resolveNextTreeViewSnapshot(
  existing: TreeViewSnapshotNode | null,
  latest: TreeViewSnapshotNode,
  truncated: boolean,
): TreeViewSnapshotNode {
  if (!existing) return latest;
  return truncated ? mergeMissingTreeViewNodes(existing, latest) : latest;
}

/**
 * `/neko tree` で採取した初期対象2リポジトリの組み込みスナップショット。
 * cronがまだ一度も動いていない環境でも、dynamicnekoの/tree-viewから
 * これらのリポジトリを開けるようにする。
 */
export const EMBEDDED_TREE_VIEW_SNAPSHOTS: Readonly<Record<string, TreeViewSnapshotNode>> = {
  'nekoserver/cloudflare-workers-github-oauth-1': cloudflareWorkersGithubOauth1TreeJson as TreeViewSnapshotNode,
  'nekoserver/dynamicneko': dynamicnekoTreeJson as TreeViewSnapshotNode,
};

export const EMBEDDED_TREE_VIEW_SNAPSHOT_UPDATED_AT = '2026-09-22T09:20:00.000Z';

const TREE_VIEW_SNAPSHOT_MAX_DEPTH = 4;

function isHiddenSegment(segment: string): boolean {
  return segment.startsWith('.');
}

/**
 * GitHub Trees API(recursive=1)のtree配列から、隠しファイル除外・
 * 深さ4階層まで・各階層名前順ソートのJSONツリーを組み立てる
 * (以前手作業で行っていたgit ls-tree→JSON変換と同じ規則)。
 * ネットワークアクセスを含まない純粋関数としてテスト可能にする。
 */
export function buildTreeViewSnapshotFromGithubItems(items: GithubTreeItem[], rootLabel: string): TreeViewSnapshotNode {
  type MutableNode = { name: string; type: 'file' | 'dir'; children: Map<string, MutableNode> };
  const root: MutableNode = { name: rootLabel, type: 'dir', children: new Map() };

  for (const item of items) {
    if (item.type !== 'blob' && item.type !== 'tree') continue;
    const parts = item.path.split('/');
    if (parts.some(isHiddenSegment)) continue;
    if (parts.length > TREE_VIEW_SNAPSHOT_MAX_DEPTH) continue;

    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      // itemがblob(ファイル)でも、recursive一覧には中間ディレクトリの
      // "tree"エントリも個別に含まれるため、既に同名で作成済みのノードは
      // 種別を上書きしない(ディレクトリとして先に作られていたら維持する)。
      const isFileHere = isLeaf && item.type === 'blob';
      let child = node.children.get(part);
      if (!child) {
        child = { name: part, type: isFileHere ? 'file' : 'dir', children: new Map() };
        node.children.set(part, child);
      }
      node = child;
    }
  }

  const toJson = (node: MutableNode): TreeViewSnapshotNode => {
    if (node.type === 'file') return { name: node.name, type: 'file' };
    const kids = [...node.children.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const result: TreeViewSnapshotNode = { name: node.name, type: 'dir' };
    if (kids.length > 0) result.children = kids.map(toJson);
    return result;
  };

  return toJson(root);
}

export type FetchRepoTreeResult =
  | { ok: true; snapshot: TreeViewSnapshotNode; truncated: boolean }
  | { ok: false; errorCode: 'http_error' | 'invalid_json'; detail: string };

/**
 * GitHub Trees API(GET /repos/{repo}/git/trees/main?recursive=1)を実際に
 * 叩いて、そのリポジトリのツリー全体を取得しJSONスナップショットへ変換する。
 * fetch実装を注入できるようにし(callJevApiと同じ方針)、テストで実際の
 * ネットワークアクセスを発生させない。
 */
export async function fetchRepoTreeSnapshot(params: {
  repoName: string;
  githubToken: string;
  fetchImpl: typeof fetch;
}): Promise<FetchRepoTreeResult> {
  const { repoName, githubToken, fetchImpl } = params;
  let response: Response;
  try {
    response = await fetchImpl(`https://api.github.com/repos/${repoName}/git/trees/main?recursive=1`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'cloudflare-workers-github-oauth-1',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, errorCode: 'http_error', detail: `GitHub Trees APIへのリクエストに失敗しました: ${message}` };
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    return { ok: false, errorCode: 'http_error', detail: `GitHub Trees APIがステータス${response.status}を返しました: ${bodyText.slice(0, 500)}` };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, errorCode: 'invalid_json', detail: `GitHub Trees APIのレスポンスJSON解析に失敗しました: ${message}` };
  }

  const tree = (json as { tree?: unknown }).tree;
  if (!Array.isArray(tree)) {
    return { ok: false, errorCode: 'invalid_json', detail: 'レスポンスにtree配列がありません' };
  }
  const truncated = (json as { truncated?: unknown }).truncated === true;

  const items: GithubTreeItem[] = tree.filter(
    (t): t is GithubTreeItem => t && typeof t === 'object' && typeof (t as GithubTreeItem).path === 'string' && typeof (t as GithubTreeItem).type === 'string'
  );

  return { ok: true, snapshot: buildTreeViewSnapshotFromGithubItems(items, repoName), truncated };
}
