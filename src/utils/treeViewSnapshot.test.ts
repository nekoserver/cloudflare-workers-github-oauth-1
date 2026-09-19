/**
 * treeViewSnapshot.ts のテスト
 *
 * 対象: dynamicnekoの/tree-viewサイドバーツリーを、以前は手作業でgit ls-tree
 * の結果をTypeScriptファイルへ焼き込んでいた静的スナップショットから、
 * GitHub Trees APIの結果をD1へキャッシュするcron方式へ切り替えるための
 * 純粋関数群(buildTreeViewSnapshotFromGithubItems)と、実際にGitHub APIを
 * 叩く関数(fetchRepoTreeSnapshot)。
 *
 * 故障シナリオ:
 *   (1) 隠しファイル・隠しディレクトリ配下がツリーに混入してしまう
 *   (2) 深さ4階層を超えるパスが混入してしまう
 *   (3) 同名の中間ディレクトリが複数回登場したとき、誤って複製・上書きされる
 *   (4) 各階層の子要素が名前順にソートされない
 *   (5) blob(ファイル)なのにdir(ディレクトリ)として扱われてしまう、逆も
 *   (6) GitHub API呼び出し失敗時に例外を投げず、握りつぶしてok:trueを返してしまう
 *   (7) レスポンスのtreeが配列でない不正な形式を握りつぶしてしまう
 */
import { describe, it, expect, vi } from 'vitest';
import { buildTreeViewSnapshotFromGithubItems, fetchRepoTreeSnapshot, type GithubTreeItem } from './treeViewSnapshot';

describe('buildTreeViewSnapshotFromGithubItems', () => {
  it('隠しファイル・隠しディレクトリ配下は除外する', () => {
    const items: GithubTreeItem[] = [
      { path: 'README.md', type: 'blob' },
      { path: '.github', type: 'tree' },
      { path: '.github/workflows', type: 'tree' },
      { path: '.github/workflows/ci.yml', type: 'blob' },
      { path: '.env', type: 'blob' },
    ];
    const result = buildTreeViewSnapshotFromGithubItems(items, 'nekoserver/example');
    expect(result.children?.map((c) => c.name)).toEqual(['README.md']);
  });

  it('深さ4階層を超えるパスは除外する', () => {
    const items: GithubTreeItem[] = [
      { path: 'a/b/c/d.ts', type: 'blob' },
      { path: 'a/b/c/d/e.ts', type: 'blob' },
    ];
    const result = buildTreeViewSnapshotFromGithubItems(items, 'nekoserver/example');
    const a = result.children?.find((c) => c.name === 'a');
    const b = a?.children?.find((c) => c.name === 'b');
    const c = b?.children?.find((c) => c.name === 'c');
    expect(c?.children?.map((n) => n.name)).toEqual(['d.ts']);
  });

  it('各階層の子要素は名前順にソートされる', () => {
    const items: GithubTreeItem[] = [
      { path: 'zebra.md', type: 'blob' },
      { path: 'apple.md', type: 'blob' },
      { path: 'mango.md', type: 'blob' },
    ];
    const result = buildTreeViewSnapshotFromGithubItems(items, 'nekoserver/example');
    expect(result.children?.map((c) => c.name)).toEqual(['apple.md', 'mango.md', 'zebra.md']);
  });

  it('同名の中間ディレクトリが複数回登場しても複製・上書きされない', () => {
    const items: GithubTreeItem[] = [
      { path: 'src', type: 'tree' },
      { path: 'src/index.ts', type: 'blob' },
      { path: 'src/utils', type: 'tree' },
      { path: 'src/utils/a.ts', type: 'blob' },
    ];
    const result = buildTreeViewSnapshotFromGithubItems(items, 'nekoserver/example');
    expect(result.children?.length).toBe(1);
    const src = result.children?.[0];
    expect(src?.name).toBe('src');
    expect(src?.type).toBe('dir');
    expect(src?.children?.map((c) => c.name)).toEqual(['index.ts', 'utils']);
  });

  it('blobはfile、treeはdirとして扱う', () => {
    const items: GithubTreeItem[] = [
      { path: 'file.ts', type: 'blob' },
      { path: 'folder', type: 'tree' },
    ];
    const result = buildTreeViewSnapshotFromGithubItems(items, 'nekoserver/example');
    expect(result.children?.find((c) => c.name === 'file.ts')?.type).toBe('file');
    expect(result.children?.find((c) => c.name === 'folder')?.type).toBe('dir');
  });

  it('空配列はルートだけのツリー(children無し)を返す', () => {
    const result = buildTreeViewSnapshotFromGithubItems([], 'nekoserver/example');
    expect(result).toEqual({ name: 'nekoserver/example', type: 'dir' });
  });
});

describe('fetchRepoTreeSnapshot', () => {
  it('正常系: GitHub Trees APIの結果からスナップショットを構築する', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ tree: [{ path: 'README.md', type: 'blob' }] }), { status: 200 })
    ) as unknown as typeof fetch;
    const result = await fetchRepoTreeSnapshot({ repoName: 'nekoserver/example', githubToken: 'token', fetchImpl });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.children?.map((c) => c.name)).toEqual(['README.md']);
    }
  });

  it('GitHub APIがエラーステータスを返した場合はok:falseを返し、握りつぶさない', async () => {
    const fetchImpl = vi.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof fetch;
    const result = await fetchRepoTreeSnapshot({ repoName: 'nekoserver/example', githubToken: 'token', fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('http_error');
  });

  it('fetch自体が例外を投げた場合もok:falseを返す(握りつぶさない)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const result = await fetchRepoTreeSnapshot({ repoName: 'nekoserver/example', githubToken: 'token', fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toContain('network down');
  });

  it('レスポンスにtree配列が無い場合はok:falseを返す', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ notTree: true }), { status: 200 })) as unknown as typeof fetch;
    const result = await fetchRepoTreeSnapshot({ repoName: 'nekoserver/example', githubToken: 'token', fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('invalid_json');
  });
});
