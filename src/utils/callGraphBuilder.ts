/**
 * D1の ts_function_catalog / ts_function_callers から、/call-graph ページ用の
 * ノード・エッジ配列を組み立てる純粋関数。
 *
 * ts_function_callers は呼び出し元を (caller_file, caller_line) でしか記録して
 * いない(呼び出し元の関数名は持たない)ため、caller_line が catalog 上のどの
 * 関数の [start_line, end_line] 区間に含まれるかで呼び出し元関数を逆引きする。
 * 区間が見つからない場合(start_line/end_line 未記録、トップレベルコードからの
 * 呼び出し等)は、ファイル単位の「呼び出し元不明」ノードに集約する。
 */

export type CallGraphCatalogRow = {
  id: number;
  file_path: string;
  function_name: string;
  purpose: string;
  is_exported: number;
  is_async: number;
  start_line: number | null;
  end_line: number | null;
  caller_count: number;
};

export type CallGraphCallerRow = {
  callee_id: number;
  caller_file: string;
  caller_line: number;
};

export type CallGraphNode = {
  id: string;
  label: string;
  file: string;
  group: string;
  desc: string;
  isExported: boolean;
  isAsync: boolean;
  startLine: number | null;
  endLine: number | null;
  callerCount: number;
  unresolved: boolean;
};

export type CallGraphEdge = {
  from: string;
  to: string;
  label: string;
};

// ファイルパスの先頭ディレクトリからグループ名を決める。
// index.tsだけは直下に大量のルート/関数が定義されているため独立グループにする。
export function inferGroup(filePath: string): string {
  if (filePath === 'index.ts') return 'index';
  const firstSegment = filePath.split('/')[0];
  if (firstSegment === 'views') return 'view';
  if (firstSegment === 'utils') return 'util';
  if (firstSegment === 'middleware') return 'middleware';
  if (firstSegment === 'scripts') return 'script';
  return 'other';
}

function catalogNodeId(row: { file_path: string; function_name: string }): string {
  return `${row.file_path}::${row.function_name}`;
}

function unresolvedNodeId(file: string): string {
  return `unresolved::${file}`;
}

export function buildCallGraphData(
  catalogRows: CallGraphCatalogRow[],
  callerRows: CallGraphCallerRow[]
): { nodes: CallGraphNode[]; edges: CallGraphEdge[] } {
  const nodesById = new Map<string, CallGraphNode>();
  const catalogById = new Map<number, CallGraphCatalogRow>();
  // ファイルごとに [start_line, end_line, nodeId] を集めて、呼び出し元の行番号から
  // 関数を逆引きするための索引を作る。
  const rangesByFile = new Map<string, { start: number; end: number; nodeId: string }[]>();

  for (const row of catalogRows) {
    const id = catalogNodeId(row);
    catalogById.set(row.id, row);
    nodesById.set(id, {
      id,
      label: row.function_name,
      file: row.file_path,
      group: inferGroup(row.file_path),
      desc: row.purpose,
      isExported: !!row.is_exported,
      isAsync: !!row.is_async,
      startLine: row.start_line,
      endLine: row.end_line,
      callerCount: row.caller_count,
      unresolved: false,
    });
    if (row.start_line !== null && row.end_line !== null) {
      const list = rangesByFile.get(row.file_path) ?? [];
      list.push({ start: row.start_line, end: row.end_line, nodeId: id });
      rangesByFile.set(row.file_path, list);
    }
  }

  function findEnclosingFunction(file: string, line: number): string | null {
    const ranges = rangesByFile.get(file);
    if (!ranges) return null;
    for (const r of ranges) {
      if (line >= r.start && line <= r.end) return r.nodeId;
    }
    return null;
  }

  const edgeKeys = new Set<string>();
  const edges: CallGraphEdge[] = [];

  for (const caller of callerRows) {
    const callee = catalogById.get(caller.callee_id);
    if (!callee) continue;
    const toId = catalogNodeId(callee);

    let fromId = findEnclosingFunction(caller.caller_file, caller.caller_line);
    if (!fromId) {
      fromId = unresolvedNodeId(caller.caller_file);
      if (!nodesById.has(fromId)) {
        nodesById.set(fromId, {
          id: fromId,
          label: `${caller.caller_file} (呼び出し元不明)`,
          file: caller.caller_file,
          group: 'unresolved',
          desc: '該当行を含む関数がts_function_catalogに見つからないため、ファイル単位に集約',
          isExported: false,
          isAsync: false,
          startLine: null,
          endLine: null,
          callerCount: 0,
          unresolved: true,
        });
      }
    }

    if (fromId === toId) continue; // 自己呼び出しは表示しない
    const key = `${fromId}=>${toId}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ from: fromId, to: toId, label: 'call' });
  }

  return { nodes: [...nodesById.values()], edges };
}
