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
import { ALLOWED_SECRET_NAMES, type AllowedSecretName } from '../utils/cfWorkerSecretApi';
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

  // SSH・Tailscale・トンネル経由の通信はこのDurable Objectを通らないため、
  // 使用中でも「無操作」と判定されて止められていた。自動停止はせず、
  // 停止は/cf-containersの停止ボタンだけで行う(タイマーは基底クラスが延長する)。
  override async onActivityExpired(): Promise<void> {}

  constructor(ctx: DurableObject['ctx'], env: Bindings) {
    super(ctx, env);
    // nekorootトンネル(cloudflared)・SSH用の設定をコンテナのenvVars経由で
    // 渡す。未設定時は空文字列(entrypoint.sh側でトンネル起動をスキップする)。
    this.envVars = {
      NEKOROOT_HOSTNAME: env.NEKOROOT_HOSTNAME ?? '',
      NEKOROOT_TUNNEL_TOKEN: env.NEKOROOT_TUNNEL_TOKEN ?? '',
      TAILSCALE_AUTHKEY: env.TAILSCALE_AUTHKEY ?? '',
      // コンテナ内のcfコマンド(containers/demo/cf)用。Worker本体の
      // CLOUDFLARE_API_KEYは流用せず、コンテナ専用のトークンを渡す。
      CF_CONTAINER_API_TOKEN: env.CF_CONTAINER_API_TOKEN ?? '',
      CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID ?? '',
    };
  }

  // start()/stop()はContainer基底クラスの実装がfetch()等のストレージ外I/Oを
  // 使っており、Durable Objectのinput gate(ストレージ操作のみ保護する)の
  // 対象外になる。そのため2つの管理者タブ、または/api/cf-containers/action
  // と/api/cf-containers/secretsからの同時リクエストがstart()/stop()を
  // 並行して呼ぶと、呼び出しが入れ替わって意図しない状態になりうる
  // (出典: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
  // 「Input gates only protect storage operations」)。
  // このインスタンス変数によるロックは、同一DOインスタンスが生きている間は
  // 同期的にチェック→セットされるため確実に排他できる(await前に判定する)。
  private busy = false;

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    if (this.busy) {
      throw new Error('別の操作が進行中です。しばらく待ってから再試行してください');
    }
    this.busy = true;
    try {
      return await fn();
    } finally {
      this.busy = false;
    }
  }

  async start(...args: Parameters<Container['start']>): Promise<void> {
    return this.withLock(() => super.start(...args));
  }

  async stop(...args: Parameters<Container['stop']>): Promise<void> {
    return this.withLock(() => super.stop(...args));
  }

  /**
   * stop→startを1回のロック取得で実行する(index.ts側でstop()とstart()を
   * 別々に呼ぶと、その間に別リクエストが割り込める隙間が生まれるため)。
   */
  async restart(secret?: { name: AllowedSecretName; value: string }): Promise<void> {
    return this.withLock(async () => {
      if (secret && (!(ALLOWED_SECRET_NAMES as readonly string[]).includes(secret.name) || !secret.value.trim())) {
        throw new Error('更新するsecretが不正です');
      }
      await super.stop();
      // このRPCを処理しているDOには旧デプロイのenvが残る場合がある。
      // 保存に成功した値を明示的に渡し、直後の再起動にも反映する。
      if (secret) this.envVars = { ...this.envVars, [secret.name]: secret.value };
      await super.start();
    });
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
