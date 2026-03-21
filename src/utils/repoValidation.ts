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
 * repo スコープの事前チェック結果
 */
export interface ScopeCheckResult {
  /** repo スコープを持っているか */
  hasRepoScope: boolean;
  /** パースされたスコープ一覧 */
  scopeList: string[];
  /** スコープデータが存在するか（null/空でないか） */
  hasScopeData: boolean;
}

/**
 * 付与スコープの中に repo スコープが含まれるかチェックする
 *
 * @param grantedScopes - DB に保存された付与スコープ文字列（スペースまたはカンマ区切り）
 * @param hasSession - ユーザーセッションが存在するか（D1 から取得できたか）
 */
export function checkRepoScope(grantedScopes: string | null | undefined, hasSession: boolean): ScopeCheckResult {
  const raw = grantedScopes ?? '';
  const scopeList = raw.split(/[\s,]+/).filter((s) => s.length > 0);
  const hasScopeData = scopeList.length > 0;

  // セッションがあるのにスコープデータがない → 移行前のセッション → repo スコープなしとみなす
  // セッションがない（D1 障害） → スコープ判定不能 → API 呼び出しに委ねる
  if (!hasSession) {
    return { hasRepoScope: true, scopeList, hasScopeData };
  }

  return {
    hasRepoScope: scopeList.includes('repo'),
    scopeList,
    hasScopeData,
  };
}

/**
 * GitHub API エラーメッセージが権限不足を示すかどうか判定する
 */
export function isPermissionError(message: string): boolean {
  const patterns = [
    'Resource not accessible by integration',
    'Resource not accessible by personal access token',
    'Not Found',
    'HTTP 403',
    'HTTP 401',
  ];
  return patterns.some((pattern) => message.includes(pattern));
}
