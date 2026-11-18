/**
 * /cf-containers(Cloudflare Containersのデモ用管理ページ)用のDurable
 * Object。Durable Object Container API(this.ctx.container)でコンテナを
 * 直接操作する(非推奨になった@cloudflare/containersのContainerクラスから
 * 移行した。仕様: SPEC.cloudflare-workers-github-oauth-1.20261111.container-api-migration.md)。
 * cloudflare:workers(workerdのみに存在する組み込みモジュール)を読み込むため、
 * このファイルを素のNode環境から直接importすると失敗する。index.ts側からは
 * 静的importせず(型だけ使う)、スタブはsrc/containers/demoContainerStub.tsで取り出す。
 * worker-entry.ts(wrangler.tomlのmain)だけがこのクラスを静的re-exportする
 * (Durable Objectのclass_nameバインディングに必須のため)。
 */
import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../types';
import { ALLOWED_SECRET_NAMES, type AllowedSecretName } from '../utils/cfWorkerSecretApi';
import { recordContainerOperation } from '../utils/cfContainerOperationLog';

/** コンテナのHTTPサーバー(server.js)のポート。 */
export const CONTAINER_PORT = 8080;
/** Durable Objectが非活動になってからコンテナを止めるまでの時間(公式の上限6時間)。 */
export const INACTIVITY_TIMEOUT_MS = 6 * 60 * 60 * 1000;
/**
 * アラームの間隔。無活動タイムアウトより短い間隔でアラームを動かすと、
 * Durable Objectが活動し続け、コンテナは止まらない(公式「Sandbox lifetime」)。
 * SSH・Tailscale・トンネル経由の通信はこのDurable Objectを通らないため、
 * 使用中でも無活動と判定されないよう、明示操作まで止めない(移行前の
 * onActivityExpired(){}と同じ)。停止の検出の最大の遅れもこの間隔になる。
 */
export const KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000;

const SIGTERM = 15;
const READY_POLL_MS = 300;
const READY_TIMEOUT_MS = 20_000;
const STOP_WAIT_MS = 15_000;
const START_RETRIES = 5;
const START_RETRY_MS = 1_000;
/** 「コンテナが動いている」印。停止の記録を1回だけにするために使う。 */
const RUNNING_KEY = 'demo:running';
const LAST_EXIT_KEY = 'demo:lastExit';

type Status = 'healthy' | 'running' | 'stopping' | 'stopped' | 'stopped_with_code';
export type DemoContainerState = { status: Status; lastChange: number; exitCode?: number };

export class DemoContainer extends DurableObject<Bindings> {
  private envVars: Record<string, string>;
  /** このDurable Objectでポートの準備完了を確かめたか。 */
  private ready = false;
  private stopping = false;
  private lastChange = Date.now();
  private starting: Promise<void> | undefined;
  private monitoring: Promise<void> | undefined;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    // nekorootトンネル(cloudflared)・SSH用の設定をコンテナの環境変数で
    // 渡す。未設定時は空文字列(entrypoint.sh側でトンネル起動をスキップする)。
    this.envVars = {
      NEKOROOT_HOSTNAME: env.NEKOROOT_HOSTNAME ?? '',
      NEKOROOT_TUNNEL_TOKEN: env.NEKOROOT_TUNNEL_TOKEN ?? '',
      TAILSCALE_AUTHKEY: env.TAILSCALE_AUTHKEY ?? '',
      TAILSCALE_LOGIN_SERVER: env.TAILSCALE_LOGIN_SERVER ?? '',
      // 作り直しても同じsshのホスト鍵と追加の公開鍵を使うための設定。
      SSH_HOST_ED25519_KEY_B64: env.SSH_HOST_ED25519_KEY_B64 ?? '',
      SSH_AUTHORIZED_KEYS: env.SSH_AUTHORIZED_KEYS ?? '',
      // コンテナ内のcfコマンド(containers/demo/cf)用。Worker本体の
      // CLOUDFLARE_API_KEYは流用せず、コンテナ専用のトークンを渡す。
      CF_CONTAINER_API_TOKEN: env.CF_CONTAINER_API_TOKEN ?? '',
      CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID ?? '',
      // コンテナ内のgh用(ghはGH_TOKENを自動で読む)。Worker本体のGITHUB_TOKENは流用しない。
      GH_TOKEN: env.CONTAINER_GH_TOKEN ?? '',
      // 起動時の lib の復元(/root/lib/claude/ops/restore-claude-host.sh、entrypoint.sh)用。
      // Workerの既存のシークレットを同じ名前で渡す(ユーザー承認、2026-11-13)。
      ORIGIN_HMAC_SECRET: env.ORIGIN_HMAC_SECRET ?? '',
      MUSE_API_KEY: env.MUSE_API_KEY ?? '',
      // 起動オプション: "1" のときだけ、libを管理者専用のまま経路情報(via)によるアクセス制御を行う。
      LIB_ROUTE_ACCESS_CONTROL: env.LIB_ROUTE_ACCESS_CONTROL ?? '',
    };
    // デプロイなどで再起動したDurable Objectはタイムアウトを持たない(公式)。
    // コンテナが動いていれば張り直し、終了の監視も再開する。
    const container = ctx.container;
    if (container?.running) {
      void ctx.blockConcurrencyWhile(() => container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS));
      this.observeExit();
    }
  }

  /** テストで差し替えられるよう、待ちはこのメソッドを通す。 */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private get container(): Container {
    const container = this.ctx.container;
    if (!container) throw new Error('このDurable Objectにはコンテナが設定されていません');
    return container;
  }

  // ===== 状態 =====

  /** 実行時の状態(ctx.container.running)から作る。読んでもコンテナは起動しない。 */
  async getState(): Promise<DemoContainerState> {
    const running = this.container.running;
    if (running) {
      if (this.stopping) return { status: 'stopping', lastChange: this.lastChange };
      return { status: this.ready ? 'healthy' : 'running', lastChange: this.lastChange };
    }
    const exitCode = await this.ctx.storage.get<number>(LAST_EXIT_KEY);
    if (typeof exitCode === 'number' && exitCode !== 0) return { status: 'stopped_with_code', lastChange: this.lastChange, exitCode };
    return { status: 'stopped', lastChange: this.lastChange };
  }

  // ===== 管理操作(排他) =====

  // start()/stop()はストレージ外のI/Oを使い、Durable Objectのinput gate
  // (ストレージ操作のみ保護する)の対象外になる。そのため2つの管理者タブ、
  // または/api/cf-containers/actionと/api/cf-containers/secretsからの
  // 同時リクエストが並行すると、呼び出しが入れ替わって意図しない状態になりうる
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

  async start(): Promise<void> {
    return this.withLock(() => this.ensureStarted());
  }

  async stop(): Promise<void> {
    return this.withLock(() => this.stopContainer());
  }

  /** Check and set desired power under the same lock as all management actions. */
  async setRunning(running: boolean) {
    if (typeof running !== 'boolean') throw new Error('不正な稼働状態です');
    return this.withLock(async () => {
      const state = await this.getState();
      if (state.status === 'stopping') {
        if (running) throw new Error('停止処理中です。停止完了後に起動してください');
        return { changed: false, state };
      }
      const current = state.status === 'running' || state.status === 'healthy';
      if (current === running) return { changed: false, state };
      if (running) await this.ensureStarted(); else await this.stopContainer();
      return { changed: true, state: await this.getState() };
    });
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
      await this.stopContainer();
      if (this.container.running) {
        // SIGTERMで止まりきらなかった。start()は動いている間は例外になるため強制停止する。
        await this.container.destroy('restart');
        await this.waitUntilStopped();
      }
      // このRPCを処理しているDOには旧デプロイのenvが残る場合がある。
      // 保存に成功した値を明示的に渡し、直後の再起動にも反映する。
      if (secret) this.envVars = { ...this.envVars, [secret.name]: secret.value };
      await this.ensureStarted();
    });
  }

  // ===== 起動・停止の本体 =====

  /** 起動して準備完了を待つ。同時の呼び出しは1回の起動を共有する。 */
  private ensureStarted(): Promise<void> {
    if (this.container.running && this.ready && !this.stopping) return Promise.resolve();
    this.starting ??= this.startAndWaitForPort().finally(() => { this.starting = undefined; });
    return this.starting;
  }

  private async startAndWaitForPort(): Promise<void> {
    const container = this.container;
    if (!container.running) {
      await this.startWithRetry();
      this.ready = false;
      this.stopping = false;
      this.lastChange = Date.now();
      await this.ctx.storage.put(RUNNING_KEY, true);
      await this.ctx.storage.delete(LAST_EXIT_KEY);
    }
    this.observeExit();
    await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
    await this.ctx.storage.setAlarm(Date.now() + KEEPALIVE_INTERVAL_MS);
    await this.waitForPort();
  }

  /** 停止の直後は一時的に起動できないことがある(公式の移行ガイド)。数回やり直す。 */
  private async startWithRetry(): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < START_RETRIES; attempt++) {
      try {
        // Containerクラスは既定でインターネット接続を許していた。start()は許さないので明示する。
        this.container.start({ env: { ...this.envVars }, enableInternet: true });
        return;
      } catch (error) {
        lastError = error;
        await this.sleep(START_RETRY_MS);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /** ポートに何か応答が返れば準備完了(移行前のContainerクラスと同じ判定)。 */
  private async waitForPort(): Promise<void> {
    const port = this.container.getTcpPort(CONTAINER_PORT);
    const tries = Math.ceil(READY_TIMEOUT_MS / READY_POLL_MS);
    let lastError: unknown;
    for (let i = 0; i < tries; i++) {
      if (!this.container.running) {
        throw new Error(`コンテナが起動の途中で止まりました(ポート${CONTAINER_PORT}の準備完了前)`);
      }
      try {
        const res = await port.fetch('http://ping', { signal: AbortSignal.timeout(READY_POLL_MS * 5) });
        await res.body?.cancel();
        this.ready = true;
        return;
      } catch (error) {
        lastError = error;
        await this.sleep(READY_POLL_MS);
      }
    }
    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`ポート${CONTAINER_PORT}が${READY_TIMEOUT_MS / 1000}秒以内に応答しませんでした: ${reason}`);
  }

  private async stopContainer(): Promise<void> {
    if (!this.container.running) return;
    this.stopping = true;
    this.lastChange = Date.now();
    this.container.signal(SIGTERM);
    await this.waitUntilStopped();
    if (!this.container.running) await this.noteStopped(0);
  }

  private async waitUntilStopped(): Promise<void> {
    const tries = Math.ceil(STOP_WAIT_MS / READY_POLL_MS);
    for (let i = 0; i < tries && this.container.running; i++) await this.sleep(READY_POLL_MS);
  }

  // ===== 終了の検出と記録 =====

  /** 終了を監視する。Durable Objectがメモリにいる間しか知らせないため、アラームでも確かめる。 */
  private observeExit(): void {
    if (this.monitoring) return;
    this.monitoring = this.container.monitor()
      .then(() => this.noteStopped(0))
      .catch((error: unknown) => {
        const code = (error as { exitCode?: unknown })?.exitCode;
        return this.noteStopped(typeof code === 'number' ? code : 1);
      })
      .finally(() => { this.monitoring = undefined; });
    this.ctx.waitUntil(this.monitoring);
  }

  /**
   * コンテナが止まったことを1回だけ記録する。/api/cf-containers/actionルート側の
   * 記録は管理者の停止操作しか捕捉できず、それ以外の停止が残らないと、累計接続時間の
   * 計算(cfContainerCost.computeCumulativeConnectedSeconds)が区間を閉じられず、
   * 実際より長く起動していたと誤集計する。そのため停止理由を問わずここで記録する。
   */
  private noting: Promise<void> | undefined;

  private noteStopped(exitCode: number): Promise<void> {
    // monitor()・stop()・アラームが同時に見つけても、記録は1回にする。
    this.noting ??= this.recordStop(exitCode).finally(() => { this.noting = undefined; });
    return this.noting;
  }

  private async recordStop(exitCode: number): Promise<void> {
    this.ready = false;
    this.stopping = false;
    this.lastChange = Date.now();
    const wasRunning = await this.ctx.storage.get<boolean>(RUNNING_KEY);
    if (!wasRunning) return;
    await this.ctx.storage.delete(RUNNING_KEY);
    await this.ctx.storage.put(LAST_EXIT_KEY, exitCode);
    try {
      await recordContainerOperation(
        this.env.DB,
        { action: 'stop', performedBy: 'system(onStop)', result: 'success', detail: `reason=exit exitCode=${exitCode}` },
        () => {
          // DB未設定・書き込み失敗時もコンテナ停止自体は止めない。ここでの
          // ログ出力はconsole.errorに留める(indexのloggerはこのクラスからは
          // importしない方針のため)。
          console.error('[DemoContainer] 停止ログの記録に失敗');
        }
      );
    } catch (error) {
      console.error('[DemoContainer] 停止ログの記録に失敗', error);
    }
  }

  /** 動いていればタイムアウトとアラームをかけ直す(起こし続ける)。止まっていれば記録して消す。 */
  async alarm(): Promise<void> {
    const container = this.container;
    if (container.running) {
      this.observeExit();
      await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
      await this.ctx.storage.setAlarm(Date.now() + KEEPALIVE_INTERVAL_MS);
      return;
    }
    await this.noteStopped(0);
    await this.ctx.storage.deleteAlarm();
  }

  // ===== Workerからの転送 =====

  /** 止まっていれば起動して待ち、ポート8080へ転送する(WebSocketは両端を受けて中継)。 */
  async fetch(request: Request): Promise<Response> {
    try {
      await this.ensureStarted();
    } catch (error) {
      return new Response(`Failed to start container: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
    }
    const url = request.url.replace(/^https:/, 'http:');
    try {
      const res = await this.container.getTcpPort(CONTAINER_PORT).fetch(url, request);
      if (res.webSocket) return this.proxyWebSocket(res);
      return res;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Network connection lost.')) {
        return new Response('Container suddenly disconnected, try again', { status: 500 });
      }
      console.error('[DemoContainer] 転送に失敗', error);
      return new Response(`Error proxying request to container: ${message}`, { status: 500 });
    }
  }

  private proxyWebSocket(res: Response): Response {
    const containerWs = res.webSocket!;
    const [client, server] = Object.values(new WebSocketPair());
    containerWs.accept();
    server.accept();
    const forward = (from: WebSocket, to: WebSocket, failure: string) => {
      from.addEventListener('message', async (event) => {
        try {
          to.send(event.data instanceof Blob ? await event.data.arrayBuffer() : event.data);
        } catch {
          from.close(1011, failure);
        }
      });
      // 1005・1006は送れない予約コードなので1000にする。
      from.addEventListener('close', (event) => to.close(event.code === 1005 || event.code === 1006 ? 1000 : event.code, event.reason));
      from.addEventListener('error', () => to.close(1011, failure));
    };
    forward(server, containerWs, 'Failed to forward message to container');
    forward(containerWs, server, 'Failed to forward message to client');
    return new Response(null, { status: res.status, webSocket: client, headers: res.headers });
  }
}
