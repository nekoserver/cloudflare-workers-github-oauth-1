import app, { syncAllTreeViewSnapshots } from './index';
import type { Bindings } from './types';
import { registerNextTreeViewCronCountdown } from './utils/treeViewCronCountdown';

export default {
  fetch: app.fetch,
  // wrangler.tomlの[triggers]crons(6時間ごと)から呼ばれる。
  // /tree-view(dynamicneko)のサイドバーツリーを、installation_permissions
  // に記録されているnekoserver組織配下の各リポジトリについて、GitHub
  // Trees APIから取得し直してtree_view_snapshotsへ反映する。新しい
  // リポジトリへGitHub Appがインストールされれば、次回のこの実行で
  // 自動的に対象へ加わる(2026-09-19、ユーザー要望への対応)。
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      Promise.all([
        syncAllTreeViewSnapshots(env),
        registerNextTreeViewCronCountdown(env.DB),
      ]).then(([result, countdown]) => {
        console.log('[scheduled] tree-view-snapshot sync', {
          synced: result.synced.length,
          skipped: result.skipped.length,
          failed: result.failed,
          nextUpdateAt: countdown.targetAt,
          countdownsRegistered: countdown.registered,
        });
      })
    );
  },
};
