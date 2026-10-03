import { describe, it, expect } from 'vitest';
import { isInstallationPermissionsUpdateAction } from './installationPermissionsAction';

// 対象: isInstallationPermissionsUpdateAction(installationPermissionsAction.ts)。
// /webhook/githubのinstallation/installation_repositoriesイベント処理が、
// どのaction値でinstallation_permissions(D1)を更新するかを決める判定関数。
//
// 故障シナリオ:
//   (1) installation_repositoriesイベントのaction値(added/removed)が
//       判定から漏れ、既存インストールへ後から追加/削除したリポジトリが
//       反映されない(実例: nekoserver/rails-rootがtree-viewの「要約」
//       リンクで「repoNameは次のいずれかである必要があります」エラーに
//       なっていた、2026-10-03)
//   (2) installationイベントのaction値(created等)を誤って判定対象から
//       外してしまう(既存の正常系を壊す)
//   (3) 無関係なaction値(例: 'deleted'、'suspend')を誤って真にしてしまう
//       (これらは別の分岐でDELETEを行うため、ここでtrueにする必要はない)

describe('isInstallationPermissionsUpdateAction', () => {
  it('installation_repositoriesイベントのadded/removedを更新対象と判定する', () => {
    expect(isInstallationPermissionsUpdateAction('added')).toBe(true);
    expect(isInstallationPermissionsUpdateAction('removed')).toBe(true);
  });

  it('installationイベントのcreated/new_permissions_accepted/unsuspendを更新対象と判定する', () => {
    expect(isInstallationPermissionsUpdateAction('created')).toBe(true);
    expect(isInstallationPermissionsUpdateAction('new_permissions_accepted')).toBe(true);
    expect(isInstallationPermissionsUpdateAction('unsuspend')).toBe(true);
  });

  it('deleted/suspend(別の分岐でDELETEを行うaction)は更新対象ではない', () => {
    expect(isInstallationPermissionsUpdateAction('deleted')).toBe(false);
    expect(isInstallationPermissionsUpdateAction('suspend')).toBe(false);
  });

  it('未知のaction値は更新対象ではない', () => {
    expect(isInstallationPermissionsUpdateAction('unknown')).toBe(false);
    expect(isInstallationPermissionsUpdateAction('')).toBe(false);
  });
});
