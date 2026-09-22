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
  | { ok: true; snapshot: TreeViewSnapshotNode }
  | { ok: false; errorCode: 'http_error' | 'invalid_json' | 'truncated'; detail: string };

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
  if ((json as { truncated?: unknown }).truncated === true) {
    return { ok: false, errorCode: 'truncated', detail: 'GitHub Trees APIのレスポンスがtruncated=trueのため、既存スナップショットを保持します' };
  }

  const items: GithubTreeItem[] = tree.filter(
    (t): t is GithubTreeItem => t && typeof t === 'object' && typeof (t as GithubTreeItem).path === 'string' && typeof (t as GithubTreeItem).type === 'string'
  );

  return { ok: true, snapshot: buildTreeViewSnapshotFromGithubItems(items, repoName) };
}
