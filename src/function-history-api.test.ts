/**
 * GET /api/function-file-history レスポンス形式のテスト
 *
 * APIはts_commit_function_map JOIN ts_commit_logからその関数のファイルに
 * 触れたコミット履歴を返す。このテストはレスポンスの型と形式のみを検証する。
 */
import { describe, it, expect } from 'vitest';

export interface FunctionFileHistoryRow {
  commit_hash: string;
  commit_at: string;
  subject: string;
  author_email: string | null;
  branch_name: string | null;
  change_type: 'add' | 'modify' | 'delete';
  lines_added: number;
  lines_deleted: number;
  files_changed: number | null;
}

export interface FunctionFileHistoryResponse {
  ok: boolean;
  function_name: string;
  file_path: string;
  repo_id: number;
  commits: FunctionFileHistoryRow[];
  total: number;
}

function isValidChangeType(v: string): v is 'add' | 'modify' | 'delete' {
  return v === 'add' || v === 'modify' || v === 'delete';
}

function validateResponse(data: unknown): data is FunctionFileHistoryResponse {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  if (typeof d['ok'] !== 'boolean') return false;
  if (typeof d['function_name'] !== 'string') return false;
  if (typeof d['file_path'] !== 'string') return false;
  if (typeof d['repo_id'] !== 'number') return false;
  if (!Array.isArray(d['commits'])) return false;
  if (typeof d['total'] !== 'number') return false;
  return true;
}

describe('FunctionFileHistoryResponse 型バリデーション', () => {
  it('正常なレスポンスを検証できる', () => {
    const data: FunctionFileHistoryResponse = {
      ok: true,
      function_name: 'getFunctionChangelogPage',
      file_path: 'src/views/functionChangelog.ts',
      repo_id: 1,
      commits: [
        {
          commit_hash: 'abc1234',
          commit_at: '2026-05-01T10:00:00Z',
          subject: '関数変更ログページを追加',
          author_email: 'dev@example.com',
          branch_name: 'main',
          change_type: 'add',
          lines_added: 100,
          lines_deleted: 0,
          files_changed: 2,
        },
      ],
      total: 1,
    };
    expect(validateResponse(data)).toBe(true);
    expect(data.commits.length).toBe(data.total);
    expect(isValidChangeType(data.commits[0].change_type)).toBe(true);
  });

  it('コミットが0件の空レスポンスも正常', () => {
    const data: FunctionFileHistoryResponse = {
      ok: true,
      function_name: 'someFunc',
      file_path: 'src/utils/foo.ts',
      repo_id: 1,
      commits: [],
      total: 0,
    };
    expect(validateResponse(data)).toBe(true);
    expect(data.commits).toHaveLength(0);
  });

  it('ok=false の場合はエラーレスポンス', () => {
    const data = { ok: false, error: 'repo_id is required' };
    expect(validateResponse(data)).toBe(false);
  });

  it('change_type は add/modify/delete のみ有効', () => {
    expect(isValidChangeType('add')).toBe(true);
    expect(isValidChangeType('modify')).toBe(true);
    expect(isValidChangeType('delete')).toBe(true);
    expect(isValidChangeType('update')).toBe(false);
    expect(isValidChangeType('')).toBe(false);
  });
});

describe('モーダル用関数リストの絞り込みロジック', () => {
  const allFunctions = [
    { file: 'src/views/functionChangelog.ts', func: 'getFunctionChangelogPage' },
    { file: 'src/views/functionChangelog.ts', func: 'changeTypeBadge' },
    { file: 'src/utils/html.ts', func: 'escapeHtml' },
    { file: 'src/index.ts', func: 'handleRequest' },
  ];

  it('検索文字列で関数名を絞り込める', () => {
    const query = 'changelog';
    const result = allFunctions.filter(e =>
      e.func.toLowerCase().includes(query.toLowerCase()) ||
      e.file.toLowerCase().includes(query.toLowerCase())
    );
    expect(result).toHaveLength(2);
    expect(result.every(e => e.file.includes('functionChangelog'))).toBe(true);
  });

  it('空文字クエリは全件返す', () => {
    const result = allFunctions.filter(e =>
      e.func.toLowerCase().includes('') || e.file.toLowerCase().includes('')
    );
    expect(result).toHaveLength(allFunctions.length);
  });

  it('一致なしの場合は0件', () => {
    const result = allFunctions.filter(e =>
      e.func.toLowerCase().includes('zzznomatch')
    );
    expect(result).toHaveLength(0);
  });
});
