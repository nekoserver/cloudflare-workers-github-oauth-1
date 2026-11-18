import app, { runCfContainerCronReport, runCfContainerFirewallCron, runCfContainerBuildTimingCollection } from './index';
import type { Bindings } from './types';
import { runCodexResetCountdownCron } from './utils/codexResetCountdown';
// Durable Objectのclass_nameバインディング(wrangler.tomlの
// [[durable_objects.bindings]])には、workerdから見えるエントリモジュール
// (このファイル)自身がそのクラスをexportしている必要がある。クラスの
// named exportはworkerdの起動時検証上「function or ExportedHandler」の
// 条件を満たす(クラスはJS上typeof === 'function'の値のため)ため、下の
// worker-entry-config.test.tsが本来防ぎたかった「値のnamed export」
// (例: export const X = 90)とは別物。詳細はそのテストのコメント参照。
export { DemoContainer } from './containers/demoContainer';
// AIチャットの応答とログ保存を、ブラウザの接続と切り離して最後まで行うジョブ(wrangler.tomlのAICHAT_JOB)。
export { AichatJob } from './durable/aichatJob';
export { TailscaleWasm } from './durable/tailscaleWasm';

export default {
  fetch: app.fetch,
  // wrangler.tomlの[triggers]crons(6時間ごと)から呼ばれる。
  // Repository checks and their Slack notifications are stopped by user request
  // (2026-10-22). Other scheduled jobs remain independent.
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext): Promise<void> {
    if (_event.cron === '5 * * * *') {
      ctx.waitUntil(runCfContainerFirewallCron(env, new Date(_event.scheduledTime))
        .catch((error) => console.error('[scheduled] firewall snapshot failed', error instanceof Error ? error.message : String(error))));
      return;
    }
    // Collect step measurements from existing Builds logs independently of Slack and reports.
    ctx.waitUntil(runCfContainerBuildTimingCollection(env)
      .then(result => { if (result.errors.length) console.error('[scheduled] build timing partial collection',result.errors); })
      .catch(error => console.error('[scheduled] build timing collection failed',error instanceof Error ? error.message : String(error))));
    // Independent of tree sync, Slack configuration and the container report.
    ctx.waitUntil(runCodexResetCountdownCron(env)
      .then((result) => console.log('[scheduled] Codex reset countdown registered', result))
      .catch((error) => console.error('[scheduled] Codex reset countdown failed', error instanceof Error ? error.message : String(error))));
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
