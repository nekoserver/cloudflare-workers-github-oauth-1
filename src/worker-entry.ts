import app, { syncAllTreeViewSnapshots } from './index';
import type { Bindings } from './types';
import { registerNextTreeViewCronCountdown } from './utils/treeViewCronCountdown';

export default {
  fetch: app.fetch,
  // wrangler.tomlの[triggers]crons(6時間ごと)から呼ばれる。
  // /tree-view(dynamicneko)のサイドバーツリーを、保存済みの固定2リポジトリ
  // についてGitHub Trees APIから取得し直す。GitHub Appの権限に他のリポジトリが
  // 追加されても、cronがtree_view_snapshotsへ新しい対象を勝手に追加しない。
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
