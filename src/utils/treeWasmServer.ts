export type TreeSort = 'name' | 'time';

export interface TreeFormatOptions {
  pattern?: string;
  filesOnly?: boolean;
  directoriesOnly?: boolean;
  includeHidden?: boolean;
  sort?: TreeSort;
  reverse?: boolean;
}

type TreeNode = { isFile: boolean; timestamp: number | null; children: Map<string, TreeNode> };

function node(): TreeNode {
  return { isFile: false, timestamp: null, children: new Map() };
}

/**
 * `*`・`?`を使える、tree(1)の-P相当の軽量なパターン照合。
 * ワイルドカードを含まないパターン(例: "MCP")は、名前全体との完全一致ではなく
 * 部分一致(大文字小文字を区別しない)として扱う。深さ4等でいったん出力した
 * ツリー全体に対して、さらにキーワードで絞り込みたいという用途のため。
 */
function matchesPattern(value: string, pattern?: string): boolean {
  if (!pattern) return true;
  const hasWildcard = pattern.includes('*') || pattern.includes('?');
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  const source = hasWildcard ? `^${escaped}$` : escaped;
  return new RegExp(source, 'i').test(value);
}

/**
 * tree-wasm の純粋な整形契約をWorkerでも利用するアダプター。
 * TSVは `path\ttype\ttimestamp?`。timestampはUnixミリ秒を受け付ける。
 */
export function formatTreeViaWasm(
  entries: string,
  rootLabel: string,
  maxDepth: number,
  options: TreeFormatOptions = {},
): string {
  const label = rootLabel.trim().replace(/\/+$/, '');
  if (!label) throw new Error('ルート名は空にできません');
  if (options.filesOnly && options.directoriesOnly) throw new Error('--files-only と --dirs-only は同時に指定できません');
  const root = node();

  for (const line of entries.split(/\r?\n/).filter((value) => value.trim())) {
    const fields = line.split('\t');
    if (fields.length < 2 || fields.length > 3) throw new Error(`不正なエントリです: ${line}`);
    const [path, kind, timestampText] = fields;
    const parts = path.split('/');
    if (parts.some((part) => !part || part === '.' || part === '..')) throw new Error(`不正なパスです: ${path}`);
    if (!options.includeHidden && parts.some((part) => part.startsWith('.'))) continue;
    if (kind !== 'tree' && kind !== 'blob' && kind !== 'commit') throw new Error(`不正な種別です: ${kind}`);
    let current = root;
    parts.forEach((part, index) => {
      let child = current.children.get(part);
      if (!child) {
        child = node();
        current.children.set(part, child);
      }
      if (index === parts.length - 1) {
        child.isFile = kind !== 'tree';
        if (timestampText) {
          const parsed = /^-?\d+$/.test(timestampText) ? Number(timestampText) : Number.NaN;
          if (!Number.isFinite(parsed)) throw new Error(`不正なタイムスタンプです: ${timestampText}`);
          child.timestamp = parsed;
        }
      }
      current = child;
    });
  }

  const output = [`- ${label}/`];
  const render = (parent: TreeNode, depth: number): void => {
    if (depth > maxDepth) return;
    const children = [...parent.children].filter(([name, child]) => {
      if (options.filesOnly && !child.isFile) return hasMatchingDescendant(child, true);
      if (options.directoriesOnly && child.isFile) return false;
      return matchesPattern(name, options.pattern) || (!child.isFile && hasMatchingDescendant(child, options.filesOnly));
    });
    children.sort(([aName, a], [bName, b]) => {
      const result = options.sort === 'time'
        ? (b.timestamp ?? Number.NEGATIVE_INFINITY) - (a.timestamp ?? Number.NEGATIVE_INFINITY) || aName.localeCompare(bName, 'en')
        : aName.localeCompare(bName, 'en');
      return options.reverse ? -result : result;
    });
    for (const [name, child] of children) {
      output.push(`${'  '.repeat(depth)}- ${name}${child.isFile ? '' : '/'}`);
      if (!child.isFile) render(child, depth + 1);
    }
  };
  function hasMatchingDescendant(parent: TreeNode, filesOnly = false): boolean {
    return [...parent.children].some(([name, child]) => (
      ((!filesOnly || child.isFile) && matchesPattern(name, options.pattern))
      || (!child.isFile && hasMatchingDescendant(child, filesOnly))
    ));
  }
  render(root, 1);
  return output.join('\n');
}
