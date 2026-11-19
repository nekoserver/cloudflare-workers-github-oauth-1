// /repo-onboarding-check ページの④(cf-authの/wspace記録確認)・⑤(dynamicnekoの
// tree-view組み込み確認)用。本WorkerがService Binding経由でcf-auth・dynamicneko
// 側の新規エンドポイントを呼び、CF-Worker + HMAC照合(workerRequestSignature.ts、
// CLAUDE.mdルール38)で署名する。
//
// fetch関数(I/Oあり)とevaluate関数(純粋、OnboardingCheckResultへの変換)を分離する
// ことで、evaluate側はネットワークなしでテストできる(CLAUDE.mdの
// 「テスト対象のロジックは関数に切り出してからテストしろ」ルール15に対応)。

import { signWorkerRequest, MAIN_WORKER_NAME } from './workerRequestSignature';
import type { OnboardingCheckResult } from './repoOnboardingCheck';

export type WorkerFetcher = { fetch: typeof fetch };

export type RemoteCheckErrorCode = 'binding_missing' | 'secret_missing' | 'http_error' | 'invalid_response';

export type RemoteCheckResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: RemoteCheckErrorCode; detail: string };

export async function callSignedWorkerEndpoint<T>(
  fetcher: WorkerFetcher | undefined,
  secret: string | undefined,
  internalBaseUrl: string,
  pathAndQuery: string,
  isValid: (value: unknown) => value is T
): Promise<RemoteCheckResult<T>> {
  if (!fetcher) {
    return { ok: false, errorCode: 'binding_missing', detail: `Service Bindingが設定されていません(wrangler.tomlの[[services]]を確認してください): ${internalBaseUrl}` };
  }
  if (!secret) {
    return { ok: false, errorCode: 'secret_missing', detail: `署名用シークレットが未設定のため、${internalBaseUrl}${pathAndQuery} を認証できません` };
  }
  const url = `${internalBaseUrl}${pathAndQuery}`;
  const headers = await signWorkerRequest(secret, MAIN_WORKER_NAME, 'GET', pathAndQuery, '');
  let response: Response;
  try {
    response = await fetcher.fetch(url, { headers });
  } catch (error) {
    return { ok: false, errorCode: 'http_error', detail: error instanceof Error ? error.message : 'Unknown error' };
  }
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    return { ok: false, errorCode: 'http_error', detail: `${url} がステータス${response.status}を返しました: ${bodyText.slice(0, 300)}` };
  }
  const json: unknown = await response.json().catch(() => null);
  if (!isValid(json)) {
    return { ok: false, errorCode: 'invalid_response', detail: `${url} のレスポンス形式が不正です` };
  }
  return { ok: true, data: json };
}

// ④ cf-auth /wspace記録確認 ------------------------------------------------

export type CfAuthWspaceRepoCheckData = {
  repo: string;
  hasEntries: boolean;
  entryCount: number;
  lastActivity: string | null;
};

function isCfAuthWspaceRepoCheckData(value: unknown): value is CfAuthWspaceRepoCheckData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.repo === 'string' &&
    typeof v.hasEntries === 'boolean' &&
    typeof v.entryCount === 'number' &&
    (v.lastActivity === null || typeof v.lastActivity === 'string')
  );
}

export async function fetchCfAuthWspaceRepoCheck(
  fetcher: WorkerFetcher | undefined,
  secret: string | undefined,
  repoName: string
): Promise<RemoteCheckResult<CfAuthWspaceRepoCheckData>> {
  const pathAndQuery = `/api/wspace/repo-check?repo=${encodeURIComponent(repoName)}`;
  return callSignedWorkerEndpoint(fetcher, secret, 'https://cf-auth.internal', pathAndQuery, isCfAuthWspaceRepoCheckData);
}

/**
 * ④の判定ロジック(純粋関数)。hasEntries=trueならok、応答自体が取れなかった
 * 場合(binding_missing等)はwarningで断定しない(cf-authは/wspace記録が0件でも
 * 「まだ要約イベントが無いだけ」の可能性があるため、missingではなくwarningにする)。
 */
export function evaluateWspaceCheck(result: RemoteCheckResult<CfAuthWspaceRepoCheckData>): OnboardingCheckResult {
  if (!result.ok) {
    return {
      status: 'warning',
      summary: 'cf-authの/wspace記録を確認できませんでした',
      detail: result.detail,
    };
  }
  if (result.data.hasEntries) {
    return {
      status: 'ok',
      summary: `cf-authの/wspaceに${result.data.entryCount}件の記録があります`,
      detail: result.data.lastActivity ? `最終記録: ${result.data.lastActivity}` : undefined,
    };
  }
  return {
    status: 'warning',
    summary: 'cf-authの/wspaceにこのリポジトリの記録がまだありません',
    detail: 'PR要約等のAI要約イベントがまだ発生していないだけの可能性があります(それ自体はオンボーディングの不備ではありません)',
  };
}

// ⑤ dynamicneko tree-view組み込み確認 --------------------------------------

export type DynamicnekoTreeViewRepoCheckData = {
  repo: string;
  inAllowedRepos: boolean;
  inTreeViewOptions: boolean;
};

function isDynamicnekoTreeViewRepoCheckData(value: unknown): value is DynamicnekoTreeViewRepoCheckData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.repo === 'string' && typeof v.inAllowedRepos === 'boolean' && typeof v.inTreeViewOptions === 'boolean';
}

export async function fetchDynamicnekoTreeViewRepoCheck(
  fetcher: WorkerFetcher | undefined,
  secret: string | undefined,
  repoName: string
): Promise<RemoteCheckResult<DynamicnekoTreeViewRepoCheckData>> {
  const pathAndQuery = `/api/tree-view/repo-check?repo=${encodeURIComponent(repoName)}`;
  return callSignedWorkerEndpoint(fetcher, secret, 'https://dynamicneko.internal', pathAndQuery, isDynamicnekoTreeViewRepoCheckData);
}

/**
 * ⑤の判定ロジック(純粋関数)。tree-viewは静的コード(TypeScriptの固定配列)への
 * 登録なので、タイムスタンプは持たない(登録済みかどうかの真偽値のみ)。
 * inAllowedReposとinTreeViewOptionsが食い違う場合(片方だけ登録漏れ)はwarning。
 */
export function evaluateTreeViewCheck(result: RemoteCheckResult<DynamicnekoTreeViewRepoCheckData>): OnboardingCheckResult {
  if (!result.ok) {
    return {
      status: 'warning',
      summary: 'dynamicnekoのtree-view組み込みを確認できませんでした',
      detail: result.detail,
    };
  }
  const { inAllowedRepos, inTreeViewOptions } = result.data;
  if (inAllowedRepos && inTreeViewOptions) {
    return {
      status: 'ok',
      summary: 'dynamicnekoのtree-viewに組み込み済みです',
      detail: 'TREE_VIEW_ALLOWED_REPOS・TREE_VIEW_REPO_OPTIONSの両方に登録済み(タイムスタンプなし、静的登録のため)',
    };
  }
  if (!inAllowedRepos && !inTreeViewOptions) {
    return {
      status: 'missing',
      summary: 'dynamicnekoのtree-viewに組み込まれていません',
      detail: 'src/tree-view-raw-path.tsのTREE_VIEW_ALLOWED_REPOS・src/data/tree-view-repos.tsのTREE_VIEW_REPO_OPTIONSの両方への追加が必要です',
    };
  }
  return {
    status: 'warning',
    summary: 'dynamicnekoのtree-view組み込みが片方だけ登録されています(登録漏れの疑い)',
    detail: `TREE_VIEW_ALLOWED_REPOS=${inAllowedRepos ? '登録済み' : '未登録'} / TREE_VIEW_REPO_OPTIONS=${inTreeViewOptions ? '登録済み' : '未登録'}`,
  };
}
