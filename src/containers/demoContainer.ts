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

export class DemoContainer extends Container {
  defaultPort = 8080;
  // 一定時間リクエストが無ければ自動停止する(課金を抑えるため)。
  sleepAfter = '5m';
}
