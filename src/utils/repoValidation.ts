/**
 * リポジトリ作成に関するバリデーションとユースケースロジック
 */

import type { GitHubRepo } from './github';

// =====================================================
// バリデーション
// =====================================================

export interface RepoNameValidationResult {
  valid: boolean;
  error?: string;
}

export function validateRepoName(name: string | undefined | null): RepoNameValidationResult {
  const repoName = (name ?? '').trim();

  if (!repoName) {
    return { valid: false, error: 'リポジトリ名を入力してください。' };
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(repoName)) {
    return { valid: false, error: 'リポジトリ名に使用できるのは英数字、ハイフン、ドット、アンダースコアのみです。' };
  }

  if (repoName.startsWith('.') || repoName.endsWith('.')) {
    return { valid: false, error: 'リポジトリ名はドットで開始・終了できません。' };
  }

  return { valid: true };
}

export function isTokenOrPermissionError(message: string): boolean {
  const patterns = [
    'Resource not accessible by integration',
    'Resource not accessible by personal access token',
    'Not Found',
    'HTTP 403',
    'HTTP 401',
    'Bad credentials',
  ];
  return patterns.some((pattern) => message.includes(pattern));
}

// =====================================================
// ユースケース: リポジトリ作成
// =====================================================

export type CreateRepoResult =
  | { ok: true; status: 201; repository: { name: string; htmlUrl: string; isPrivate: boolean } }
  | { ok: false; status: 401 | 400 | 409 | 403 | 422; error: string; requireReauth?: boolean };

/**
 * GitHub API を呼び出すための依存インターフェース
 * テスト時にモックを注入できる
 */
export interface GitHubApiDeps {
  getUserRepos: (accessToken: string) => Promise<GitHubRepo[]>;
  createRepo: (params: { accessToken: string; name: string; isPrivate: boolean; description?: string }) => Promise<GitHubRepo>;
}

/**
 * リポジトリ作成のユースケース
 *
 * ルートハンドラから分離したビジネスロジック。
 * 外部依存（GitHub API）は注入で受け取る。
 */
export async function executeCreateRepo(params: {
  accessToken: string | undefined;
  userId: string;
  name: string | undefined;
  isPrivate: boolean;
  description?: string;
  deps: GitHubApiDeps;
}): Promise<CreateRepoResult> {
  const { accessToken, userId, name, isPrivate, description, deps } = params;

  // 1. アクセストークンの存在確認
  if (!accessToken) {
    return {
      ok: false,
      status: 401,
      error: 'GitHub アクセストークンがありません。再ログインしてください。',
      requireReauth: true,
    };
  }

  // 2. リポジトリ名バリデーション
  const repoName = (name ?? '').trim();
  const nameValidation = validateRepoName(name);
  if (!nameValidation.valid) {
    return { ok: false, status: 400, error: nameValidation.error! };
  }

  // 3. 重複チェック
  try {
    const existingRepos = await deps.getUserRepos(accessToken);
    const duplicate = existingRepos.find(
      (r) => r.name.toLowerCase() === repoName.toLowerCase() && r.owner?.login?.toLowerCase() === userId.toLowerCase()
    );
    if (duplicate) {
      return { ok: false, status: 409, error: `リポジトリ "${repoName}" は既に存在します。` };
    }
  } catch {
    // 重複チェック失敗時は GitHub API 側で検出されるのでそのまま続行
  }

  // 4. リポジトリ作成
  try {
    const created = await deps.createRepo({
      accessToken,
      name: repoName,
      isPrivate,
      description,
    });

    return {
      ok: true,
      status: 201,
      repository: {
        name: created.name,
        htmlUrl: created.html_url,
        isPrivate: created.private,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';

    if (isTokenOrPermissionError(msg)) {
      return {
        ok: false,
        status: 403,
        error: `GitHub API がリクエストを拒否しました（${msg}）。アクセストークンが無効・期限切れか、repo スコープが付与されていない可能性があります。再認証してください。`,
        requireReauth: true,
      };
    }

    return { ok: false, status: 422, error: `リポジトリの作成に失敗しました: ${msg}` };
  }
}
