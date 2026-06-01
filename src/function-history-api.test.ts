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
    { file: 'src/views/functionChangelog.ts', func: 'getFunctionChangelogPage', purpose: '関数変更ログページのHTMLを生成' },
    { file: 'src/views/functionChangelog.ts', func: 'changeTypeBadge', purpose: '変更種別バッジHTMLを返す' },
    { file: 'src/utils/html.ts', func: 'escapeHtml', purpose: 'HTML特殊文字をエスケープ' },
    { file: 'src/index.ts', func: 'handleRequest', purpose: 'リクエストハンドラ' },
  ];

  it('ファイルで絞り込むと該当ファイルの関数のみ返る', () => {
    const file = 'src/views/functionChangelog.ts';
    const result = allFunctions.filter(e => e.file === file);
    expect(result).toHaveLength(2);
    expect(result.every(e => e.file === file)).toBe(true);
  });

  it('一致なしファイルは0件', () => {
    const result = allFunctions.filter(e => e.file === 'src/nonexistent.ts');
    expect(result).toHaveLength(0);
  });

  it('purpose フィールドが存在する', () => {
    allFunctions.forEach(e => {
      expect(typeof e.purpose).toBe('string');
      expect(e.purpose.length).toBeGreaterThan(0);
    });
  });
});

export interface FunctionSourceResponse {
  ok: boolean;
  repo_id: number;
  file_path: string;
  function_name: string;
  purpose: string;
  source_snippet: string | null;
  github_url: string | null;
}

describe('FunctionSourceResponse 型バリデーション', () => {
  function validateSourceResponse(data: unknown): data is FunctionSourceResponse {
    if (typeof data !== 'object' || data === null) return false;
    const d = data as Record<string, unknown>;
    if (typeof d['ok'] !== 'boolean') return false;
    if (typeof d['file_path'] !== 'string') return false;
    if (typeof d['function_name'] !== 'string') return false;
    if (typeof d['purpose'] !== 'string') return false;
    if (d['source_snippet'] !== null && typeof d['source_snippet'] !== 'string') return false;
    if (d['github_url'] !== null && typeof d['github_url'] !== 'string') return false;
    return true;
  }

  it('source_snippet あり の正常レスポンス', () => {
    const data: FunctionSourceResponse = {
      ok: true, repo_id: 1,
      file_path: 'src/utils/html.ts',
      function_name: 'escapeHtml',
      purpose: 'HTML特殊文字をエスケープ',
      source_snippet: 'export function escapeHtml(s: string): string { ... }',
      github_url: 'https://github.com/nekoserver/cloudflare-workers-github-oauth-1/blob/main/src/utils/html.ts',
    };
    expect(validateSourceResponse(data)).toBe(true);
    expect(data.source_snippet).not.toBeNull();
  });

  it('source_snippet なし・github_url フォールバック', () => {
    const data: FunctionSourceResponse = {
      ok: true, repo_id: 1,
      file_path: 'src/utils/html.ts',
      function_name: 'escapeHtml',
      purpose: 'HTML特殊文字をエスケープ',
      source_snippet: null,
      github_url: 'https://github.com/nekoserver/cloudflare-workers-github-oauth-1/blob/main/src/utils/html.ts',
    };
    expect(validateSourceResponse(data)).toBe(true);
    expect(data.source_snippet).toBeNull();
    expect(data.github_url).not.toBeNull();
  });

  it('ok=false はエラー', () => {
    const data = { ok: false, error: 'not found' };
    expect(validateSourceResponse(data)).toBe(false);
  });
});
