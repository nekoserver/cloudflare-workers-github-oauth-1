// GitHub App の installation / installation_repositories Webhook が
// installation_permissions(D1)の更新を必要とするactionかどうかを判定する。
//
// GitHub は2種類のイベントを別々のaction値で送る:
//   - installation: created / deleted / suspend / unsuspend / new_permissions_accepted
//   - installation_repositories: added / removed
// (既存のインストールへリポジトリを追加/削除したとき、GitHubは
// installationイベントではなくinstallation_repositoriesイベントを
// action=added/removedで送る。installationイベントのaction値だけを
// 判定対象にしていたため、既存インストールへ後から追加したリポジトリが
// installation_permissionsへ一切反映されず、/api/commit-summary-external等の
// repoName許可リストに永久に乗らない不具合があった。実例:
// nekoserver/rails-rootをtree-viewの「要約」リンクで開くと
// 「repoNameは次のいずれかである必要があります」エラーになっていた、
// 2026-10-03)。
export function isInstallationPermissionsUpdateAction(action: string): boolean {
  return (
    action === 'created' ||
    action === 'new_permissions_accepted' ||
    action === 'unsuspend' ||
    action === 'added' ||
    action === 'removed'
  );
}
