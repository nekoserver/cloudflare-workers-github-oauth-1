// /repo-onboarding-check ページ用。SPEC.cloudflare-workers-github-oauth-1.new-repo-onboarding.md
// の8ステップのうち、本体Workerのデータだけで判定できる①②③を集約する。
// ④(cf-authの/wspace記録確認)・⑤(dynamicnekoのtree-view組み込み確認)は
// 他Workerへの問い合わせが必要なため、このファイルでは対象外(status: 'not_implemented')。
//
// エラー種別は文字列prefixではなく判別可能な型で表現する(CLAUDE.mdルール32)。

export type OnboardingCheckStatus = 'ok' | 'warning' | 'missing' | 'optional' | 'not_implemented';

export type OnboardingCheckResult = {
  status: OnboardingCheckStatus;
  summary: string;
  detail?: string;
};

export type InstallationPermissionRow = {
  repo_name: string | null;
  repository_selection: string;
  updated_at: string;
};

/**
 * ①GitHub Appインストール確認。repo_name一致の行、またはrepository_selection='all'の
 * 行(repo_name IS NULL)のどちらかがあればインストール済みと判定する。
 *
 * 注意: GitHub Appのインストールは、webhook受信→repo_commit_index保存という
 * コアのオンボーディングパイプライン自体には不要(webhookのPayload URL・Secretの
 * 設定だけで成立する。実例: nekoserver/railwayはApp未インストールのままwebhook
 * 経由のコミット保存が機能した)。Appが必要なのは、installation_permissionsを
 * 参照する別機能(loadCommitSummaryAllowedRepos経由の/api/commit-summary-external等
 * のAI要約系「-external」エンドポイントの許可リスト)のみ。そのため未インストールは
 * 'missing'(❌必須未達)ではなく'optional'(🔶任意、未設定でも本流は動く)とする。
 */
export function evaluateInstallationCheck(
  repoName: string,
  rows: InstallationPermissionRow[]
): OnboardingCheckResult {
  const exactMatch = rows.find((row) => row.repo_name === repoName);
  if (exactMatch) {
    return {
      status: 'ok',
      summary: `GitHub Appが${repoName}にインストール済みです`,
      detail: `最終更新: ${exactMatch.updated_at}(AI要約の-external系エンドポイントの対象になります)`,
    };
  }
  const allRepos = rows.find((row) => row.repo_name === null && row.repository_selection === 'all');
  if (allRepos) {
    return {
      status: 'ok',
      summary: 'GitHub Appが「All repositories」でインストールされています',
      detail: `最終更新: ${allRepos.updated_at}`,
    };
  }
  return {
    status: 'optional',
    summary: `GitHub Appは${repoName}にインストールされていません(任意)`,
    detail: 'webhook受信・repo_commit_indexへの保存には影響しません。AI要約の-external系エンドポイント(/api/commit-summary-external等)の対象にしたい場合のみ、Settings > Applications > 該当App > Configure > Repository accessで追加してください',
  };
}

export type WebhookLogRow = {
  event_type: string | null;
  status: string;
  received_at: string;
};

/**
 * ②webhook疎通確認。status='ok'かつeventType='push'の受信があればOK。
 * 受信自体が無い場合はmissing、受信はあるが全てrejected/errorの場合はwarning。
 */
export function evaluateWebhookDeliveryCheck(rows: WebhookLogRow[]): OnboardingCheckResult {
  if (rows.length === 0) {
    return {
      status: 'missing',
      summary: 'webhookの受信履歴がありません',
      detail: 'GitHub側のwebhook設定(Payload URL・Secret・push購読)を確認し、動作確認用のpushを1件行ってください',
    };
  }
  const okPush = rows.find((row) => row.status === 'ok' && row.event_type === 'push');
  if (okPush) {
    return {
      status: 'ok',
      summary: 'pushイベントの受信に成功しています',
      detail: `最終受信: ${okPush.received_at}`,
    };
  }
  const anyOk = rows.find((row) => row.status === 'ok');
  if (anyOk) {
    return {
      status: 'warning',
      summary: `pushイベントの受信は未確認です(直近のイベント種別: ${anyOk.event_type ?? 'unknown'})`,
      detail: 'pingやpull_request等は届いていますが、push購読の確認が必要です',
    };
  }
  return {
    status: 'warning',
    summary: 'webhookの受信はありますが、すべて失敗(署名不正等)しています',
    detail: `直近のステータス: ${rows[0]?.status ?? 'unknown'}`,
  };
}

export type RepoCommitIndexSummary = {
  count: number;
  maxSeq: number | null;
};

/**
 * ③repo_commit_indexのバックフィル状況確認。D1件数とGitHub実際のコミット数を
 * 比較する。githubTotalがnull(API取得失敗)の場合はwarningとし、断定しない。
 *
 * lastSyncedAt: repo_commit_index自体にはタイムスタンプ列が無いため、同じ
 * webhookハンドラが書き込む直近のpushイベント受信時刻(②で取得したもの)を
 * 「最終反映日時」の目安として表示する(ユーザー要望: OK表示でも完了日時を
 * 時系列で追えるようにしたい、への対応)。渡さない場合は省略される。
 */
export function evaluateCommitBackfillCheck(
  d1Summary: RepoCommitIndexSummary,
  githubTotal: number | null,
  lastSyncedAt?: string | null
): OnboardingCheckResult {
  const syncedDetail = lastSyncedAt ? `最終反映(直近push受信): ${lastSyncedAt}` : undefined;
  if (githubTotal === null) {
    return {
      status: 'warning',
      summary: `GitHub側のコミット総数を取得できませんでした(D1件数: ${d1Summary.count}件)`,
      detail: 'GitHub APIの呼び出しに失敗しました。GITHUB_TOKENの権限・対象リポジトリ名を確認してください',
    };
  }
  if (d1Summary.count === githubTotal) {
    return {
      status: 'ok',
      summary: `repo_commit_indexはGitHub側と一致しています(${d1Summary.count}件)`,
      detail: syncedDetail,
    };
  }
  if (d1Summary.count < githubTotal) {
    return {
      status: 'missing',
      summary: `repo_commit_indexに${githubTotal - d1Summary.count}件のバックフィル漏れがあります(D1: ${d1Summary.count}件 / GitHub: ${githubTotal}件)`,
      detail: 'SPEC.cloudflare-workers-github-oauth-1.COMMITDB.mdの手順でバックフィルしてください',
    };
  }
  return {
    status: 'warning',
    summary: `repo_commit_indexの件数がGitHub側を超えています(D1: ${d1Summary.count}件 / GitHub: ${githubTotal}件)`,
    detail: '重複INSERTや別リポジトリのコミットが紛れ込んでいないか確認してください',
  };
}
