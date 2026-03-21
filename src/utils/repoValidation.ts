/**
 * リポジトリ作成に関するバリデーションロジック
 * index.ts のルートハンドラから抽出し、テスト可能にしたもの
 */

/**
 * リポジトリ名のバリデーション結果
 */
export interface RepoNameValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * リポジトリ名のバリデーション
 * GitHub の命名規則に準拠する
 */
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

/**
 * GitHub API エラーメッセージがトークン無効・権限不足を示すかどうか判定する
 *
 * GitHub OAuth App ではスコープは認可時に全承認されるため、
 * このエラーが出る場合はアクセストークンの期限切れまたは無効化が原因。
 */
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
