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

export class DemoContainer extends Container<Bindings> {
  defaultPort = 8080;
  // 一定時間リクエストが無ければ自動停止する(課金を抑えるため)。
  sleepAfter = '5m';

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
}
