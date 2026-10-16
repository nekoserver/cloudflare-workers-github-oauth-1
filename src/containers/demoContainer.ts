/**
 * /cf-containers(Cloudflare Containersのデモ用管理ページ)用のDurable
 * Object。@cloudflare/containersはcloudflare:workers(workerdのみに
 * 存在する組み込みモジュール)を読み込むため、このファイルを素のNode環境
 * (vitestのプレーンNode実行)から直接importすると失敗する。index.ts側
 * からはこのファイルを静的importせず、実際のリクエスト処理時にだけ
 * dynamic importする(src/index.tsのgetDemoContainerStub参照)。
 * worker-entry.ts(wrangler.tomlのmain)だけがこのクラスを静的
 * re-exportする(Durable Objectのclass_nameバインディングに必須のため)。
 */
import { Container } from '@cloudflare/containers';
import type { Bindings } from '../types';
import { recordContainerOperation } from '../utils/cfContainerOperationLog';

// 無操作でこの時間が経過すると自動停止する(課金を抑えるため)。/cf-containers
// ページの表示にも使う値なので、ここを変更したら表示側は再デプロイだけで
// 追従する(index.ts側はこの定数を直接importしない。cloudflare:workers越しの
// importになるため、代わりに同じ文字列をコメントで明記している。値を変える
// 場合はsrc/views/cfContainers.tsの表示文言も合わせて更新すること)。
export const SLEEP_AFTER = '5m';

export class DemoContainer extends Container<Bindings> {
  defaultPort = 8080;
  sleepAfter = SLEEP_AFTER;

  constructor(ctx: DurableObject['ctx'], env: Bindings) {
    super(ctx, env);
    // nekorootトンネル(cloudflared)・SSH用の設定をコンテナのenvVars経由で
    // 渡す。未設定時は空文字列(entrypoint.sh側でトンネル起動をスキップする)。
    this.envVars = {
      NEKOROOT_HOSTNAME: env.NEKOROOT_HOSTNAME ?? '',
      NEKOROOT_TUNNEL_TOKEN: env.NEKOROOT_TUNNEL_TOKEN ?? '',
      TAILSCALE_AUTHKEY: env.TAILSCALE_AUTHKEY ?? '',
    };
  }

  /**
   * コンテナが停止するたびに呼ばれる(sleepAfterによる自動停止・管理者操作
   * による明示的な停止のどちらも含む)。/api/cf-containers/actionルート側の
   * 記録は「管理者が停止ボタンを押した」ケースしか捕捉できず、無操作による
   * 自動停止がcf_container_operation_logに残らないと、累計接続時間の計算
   * (cfContainerCost.computeCumulativeConnectedSeconds)が区間を閉じられず
   * 実際より長く起動していたと誤集計してしまう。そのため停止理由を問わず
   * ここで必ず記録する(action route側の記録と重複しても、累計計算は最初の
   * stopだけを使うため二重計上にはならない)。
   */
  async onStop(params: { exitCode: number; reason: 'exit' | 'runtime_signal' }): Promise<void> {
    await recordContainerOperation(
      this.env.DB,
      { action: 'stop', performedBy: 'system(onStop)', result: 'success', detail: `reason=${params.reason} exitCode=${params.exitCode}` },
      () => {
        // DB未設定・書き込み失敗時もコンテナ停止自体は止めない。ここでの
        // ログ出力はconsole.errorに留める(indexのloggerはこのクラスからは
        // importしない方針のため)。
        console.error('[DemoContainer.onStop] 停止ログの記録に失敗');
      }
    );
  }
}
