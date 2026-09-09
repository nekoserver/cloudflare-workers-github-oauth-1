/**
 * buildCallGraphData のテスト
 *
 * 対象: /call-graph ページ用に、D1の ts_function_catalog / ts_function_callers
 * からノード・エッジ配列を組み立てる純粋関数(src/utils/callGraphBuilder.ts)。
 * 旧call-graph.html(手作業のハードコード配列)をD1連動に置き換えるための土台。
 *
 * 故障シナリオ:
 *   (1) caller_lineが関数の[start_line,end_line]区間に含まれるのに逆引きに失敗する
 *   (2) start_line/end_lineが無い(NULL)関数からの呼び出しでクラッシュする
 *   (3) 同じ呼び出し元→呼び出し先の組が重複してエッジに複数回入る
 *   (4) 自己再帰呼び出し(自分自身を呼ぶ)が無限ループ的な自己ループエッジになる
 *   (5) callee_idがcatalogに存在しない(削除済み等)場合にクラッシュする
 *   (6) ファイルパスからのグループ推定がindex.ts/views/utils/middlewareを誤判定する
 */
import { describe, it, expect } from 'vitest';
import { buildCallGraphData, inferGroup, type CallGraphCatalogRow, type CallGraphCallerRow } from './utils/callGraphBuilder';

function catalogRow(overrides: Partial<CallGraphCatalogRow>): CallGraphCatalogRow {
  return {
    id: 1,
    file_path: 'index.ts',
    function_name: 'foo',
    purpose: 'テスト用関数',
    is_exported: 1,
    is_async: 0,
    start_line: 10,
    end_line: 20,
    caller_count: 0,
    ...overrides,
  };
}

describe('inferGroup', () => {
  it('index.tsは"index"グループになる', () => {
    expect(inferGroup('index.ts')).toBe('index');
  });
  it('views/配下は"view"グループになる', () => {
    expect(inferGroup('views/aichat.ts')).toBe('view');
  });
  it('utils/配下は"util"グループになる', () => {
    expect(inferGroup('utils/jwt.ts')).toBe('util');
  });
  it('middleware/配下は"middleware"グループになる', () => {
    expect(inferGroup('middleware/auth.ts')).toBe('middleware');
  });
  it('未分類のディレクトリは"other"グループになる', () => {
    expect(inferGroup('scripts/foo.ts')).toBe('script');
    expect(inferGroup('somewhere/else.ts')).toBe('other');
  });
});

describe('buildCallGraphData', () => {
  it('caller_lineが関数の区間内にあれば、その関数からのエッジとして解決する', () => {
    const catalog = [
      catalogRow({ id: 1, function_name: 'caller', start_line: 10, end_line: 20 }),
      catalogRow({ id: 2, function_name: 'callee', start_line: 30, end_line: 40 }),
    ];
    const callers: CallGraphCallerRow[] = [{ callee_id: 2, caller_file: 'index.ts', caller_line: 15 }];
    const { nodes, edges } = buildCallGraphData(catalog, callers);
    expect(nodes).toHaveLength(2);
    expect(edges).toEqual([{ from: 'index.ts::caller', to: 'index.ts::callee', label: 'call' }]);
  });

  it('区間に一致する関数が無い場合、ファイル単位の「呼び出し元不明」ノードに集約する', () => {
    const catalog = [catalogRow({ id: 1, function_name: 'callee', start_line: 30, end_line: 40 })];
    const callers: CallGraphCallerRow[] = [
      { callee_id: 1, caller_file: 'index.ts', caller_line: 999 },
      { callee_id: 1, caller_file: 'index.ts', caller_line: 1000 },
    ];
    const { nodes, edges } = buildCallGraphData(catalog, callers);
    const unresolvedNodes = nodes.filter((n) => n.unresolved);
    expect(unresolvedNodes).toHaveLength(1); // ファイル単位で1つに集約される
    expect(edges).toHaveLength(1); // from/toの組が同じなので重複除去される
  });

  it('start_line/end_lineがNULLの関数があってもクラッシュしない(索引から除外される)', () => {
    const catalog = [
      catalogRow({ id: 1, function_name: 'noLineInfo', start_line: null, end_line: null }),
      catalogRow({ id: 2, function_name: 'callee', start_line: 30, end_line: 40 }),
    ];
    const callers: CallGraphCallerRow[] = [{ callee_id: 2, caller_file: 'index.ts', caller_line: 5 }];
    expect(() => buildCallGraphData(catalog, callers)).not.toThrow();
    const { edges, nodes } = buildCallGraphData(catalog, callers);
    expect(nodes.some((n) => n.unresolved)).toBe(true);
    expect(edges).toHaveLength(1);
  });

  it('同じ呼び出し元→呼び出し先の組が複数回記録されていても、エッジは1本に重複除去される', () => {
    const catalog = [
      catalogRow({ id: 1, function_name: 'caller', start_line: 10, end_line: 20 }),
      catalogRow({ id: 2, function_name: 'callee', start_line: 30, end_line: 40 }),
    ];
    const callers: CallGraphCallerRow[] = [
      { callee_id: 2, caller_file: 'index.ts', caller_line: 11 },
      { callee_id: 2, caller_file: 'index.ts', caller_line: 15 },
      { callee_id: 2, caller_file: 'index.ts', caller_line: 18 },
    ];
    const { edges } = buildCallGraphData(catalog, callers);
    expect(edges).toHaveLength(1);
  });

  it('自己再帰呼び出し(自分自身を呼ぶ)は自己ループエッジとして生成しない', () => {
    const catalog = [catalogRow({ id: 1, function_name: 'recursive', start_line: 10, end_line: 20 })];
    const callers: CallGraphCallerRow[] = [{ callee_id: 1, caller_file: 'index.ts', caller_line: 15 }];
    const { edges } = buildCallGraphData(catalog, callers);
    expect(edges).toHaveLength(0);
  });

  it('callee_idがcatalogに存在しない場合はそのcallerレコードを無視する(クラッシュしない)', () => {
    const catalog = [catalogRow({ id: 1, function_name: 'caller', start_line: 10, end_line: 20 })];
    const callers: CallGraphCallerRow[] = [{ callee_id: 999, caller_file: 'index.ts', caller_line: 15 }];
    expect(() => buildCallGraphData(catalog, callers)).not.toThrow();
    const { edges } = buildCallGraphData(catalog, callers);
    expect(edges).toHaveLength(0);
  });

  it('全catalog行がノードとして出力される(呼び出しが無い孤立関数も含む)', () => {
    const catalog = [
      catalogRow({ id: 1, function_name: 'isolated', start_line: 10, end_line: 20 }),
    ];
    const { nodes } = buildCallGraphData(catalog, []);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('index.ts::isolated');
  });
});
