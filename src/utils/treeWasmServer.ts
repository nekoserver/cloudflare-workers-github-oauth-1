type TreeNode = { isFile: boolean; children: Map<string, TreeNode> };

function node(): TreeNode {
  return { isFile: false, children: new Map() };
}

/**
 * tree-wasm の純粋な整形契約をWorkerでも利用するアダプター。
 *
 * tree-wasmの生成物がリポジトリに存在しない状態で静的importするとWorker全体の
 * ビルドが失敗するため、同じTSV契約と出力規則をここでも維持する。Rust実装との
 * 一致はwasm/tree-wasmのテストとtreeWasmServer.test.tsで固定する。
 */
export function formatTreeViaWasm(entries: string, rootLabel: string, maxDepth: number): string {
  const label = rootLabel.trim().replace(/\/+$/, '');
  if (!label) throw new Error('ルート名は空にできません');
  const root = node();

  for (const line of entries.split(/\r?\n/).filter((value) => value.trim())) {
    const fields = line.split('\t');
    if (fields.length !== 2) throw new Error(`不正なエントリです: ${line}`);
    const [path, kind] = fields;
    const parts = path.split('/');
    if (parts.some((part) => !part || part === '.' || part === '..')) throw new Error(`不正なパスです: ${path}`);
    if (parts.some((part) => part.startsWith('.'))) continue;
    if (kind !== 'tree' && kind !== 'blob' && kind !== 'commit') throw new Error(`不正な種別です: ${kind}`);
    let current = root;
    parts.forEach((part, index) => {
      let child = current.children.get(part);
      if (!child) {
        child = node();
        current.children.set(part, child);
      }
      if (index === parts.length - 1) child.isFile = kind !== 'tree';
      current = child;
    });
  }

  const output = [`- ${label}/`];
  const render = (parent: TreeNode, depth: number): void => {
    if (depth > maxDepth) return;
    for (const [name, child] of [...parent.children].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
      output.push(`${'  '.repeat(depth)}- ${name}${child.isFile ? '' : '/'}`);
      if (!child.isFile) render(child, depth + 1);
    }
  };
  render(root, 1);
  return output.join('\n');
}
