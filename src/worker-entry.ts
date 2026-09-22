import app, { syncAllTreeViewSnapshots } from './index';
import type { Bindings } from './types';

export default {
  fetch: app.fetch,
  // wrangler.tomlの[triggers]crons(6時間ごと)から呼ばれる。
  // dynamicnekoとcloudflare-workers-github-oauth-1の最新ツリーを
  // 既存DBと照合し、DBにないノードだけを追加する。
  // cronからはこの同期以外の処理を呼び出さない。
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(syncAllTreeViewSnapshots(env));
  },
};
