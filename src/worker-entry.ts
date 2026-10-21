import app, { syncAllTreeViewSnapshots, runCfContainerCronReport } from './index';
import { notifyTreeViewCronUpdate } from './utils/treeViewCronNotify';
import type { Bindings } from './types';
import { registerNextTreeViewCronCountdown } from './utils/treeViewCronCountdown';
// Durable Objectのclass_nameバインディング(wrangler.tomlの
// [[durable_objects.bindings]])には、workerdから見えるエントリモジュール
// (このファイル)自身がそのクラスをexportしている必要がある。クラスの
// named exportはworkerdの起動時検証上「function or ExportedHandler」の
// 条件を満たす(クラスはJS上typeof === 'function'の値のため)ため、下の
// worker-entry-config.test.tsが本来防ぎたかった「値のnamed export」
// (例: export const X = 90)とは別物。詳細はそのテストのコメント参照。
export { DemoContainer } from './containers/demoContainer';

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
      ]).then(async ([result, countdown]) => {
        const notification = await notifyTreeViewCronUpdate(env, result, new Date(), countdown.targetAt);
        if (!notification.ok) {
          console.error('[scheduled] cron update notification failed', notification.error);
        }
        console.log('[scheduled] tree-view-snapshot sync', {
          synced: result.synced.length,
          skipped: result.skipped.length,
          failed: result.failed,
          nextUpdateAt: countdown.targetAt,
          countdownsRegistered: countdown.registered,
        });
      })
    );
    // /cf-containersの6時間レポート(稼働数・支出・版の新旧)。tree-viewの同期とは独立に動かし、失敗はログに残す。
    ctx.waitUntil(
      runCfContainerCronReport(env)
        .then((r) => {
          if (!r.ok) console.error('[scheduled] cf-containers report failed', r.error);
        })
        .catch((err) => console.error('[scheduled] cf-containers report errored', err instanceof Error ? err.message : String(err)))
    );
  },
};
