// テスト用: Durable Object Container API(this.ctx.container)と保存領域・アラームの偽物。
// 公式の振る舞いを写す(https://developers.cloudflare.com/containers/api/durable-object-container/):
// - start() は動いている間に呼ぶと例外。準備完了の前に返る。
// - signal()/destroy() で止まる。monitor() は終了で解決、0以外の終了コードで拒否。
// - getTcpPort(port).fetch() は準備完了までは例外。
export type FakeStart = { env?: Record<string, string>; enableInternet?: boolean };

export function createFakeCtx(opts: { running?: boolean; ready?: boolean } = {}) {
  const storage = new Map<string, unknown>();
  let exitResolve: (() => void) | undefined;
  let exitReject: ((e: unknown) => void) | undefined;
  const state = {
    running: opts.running ?? false,
    ready: opts.ready ?? opts.running ?? false,
    /** signal(15) で止まるか(false なら止まらず残る) */
    stopsOnSigterm: true,
    /** start() を何回失敗させるか(「まだ動いている」相当) */
    startFailures: 0,
    /** start() 後、ポートが準備完了になるまでの ping 失敗回数 */
    pingFailures: 0,
    /** start() 直後にコンテナが落ちる */
    crashOnStart: false,
    alarm: null as number | null,
    timeoutMs: null as number | null,
  };
  const calls = {
    start: [] as FakeStart[],
    signal: [] as number[],
    destroy: 0,
    fetch: [] as string[],
    waitUntil: [] as Promise<unknown>[],
  };
  let pings = 0;
  const exit = (code: number) => {
    state.running = false;
    state.ready = false;
    const resolve = exitResolve;
    const reject = exitReject;
    exitResolve = exitReject = undefined;
    if (code === 0) resolve?.();
    else reject?.(Object.assign(new Error(`exit ${code}`), { exitCode: code }));
  };
  const container = {
    get running() { return state.running; },
    start(o?: FakeStart) {
      if (state.running) throw new Error('Container is already running');
      if (state.startFailures > 0) { state.startFailures--; throw new Error('Container is already running'); }
      calls.start.push(o ?? {});
      state.running = true;
      state.ready = false;
      pings = 0;
      if (state.crashOnStart) exit(1);
    },
    async signal(n: number) {
      calls.signal.push(n);
      if (state.running && (n !== 15 || state.stopsOnSigterm)) exit(n === 15 ? 0 : 137);
    },
    async destroy() { calls.destroy++; if (state.running) exit(137); },
    monitor() {
      if (!state.running) return Promise.resolve();
      return new Promise<void>((resolve, reject) => { exitResolve = resolve; exitReject = reject; });
    },
    async setInactivityTimeout(ms: number) { state.timeoutMs = ms; },
    getTcpPort(port: number) {
      return {
        async fetch(input: string | Request, init?: RequestInit) {
          const url = typeof input === 'string' ? input : input.url;
          if (!state.running) throw new Error('container is not running');
          if (!state.ready) {
            if (pings < state.pingFailures) { pings++; throw new Error('connection refused'); }
            state.ready = true;
          }
          calls.fetch.push(`${port} ${url}`);
          void init;
          return new Response(`ok ${url}`);
        },
      };
    },
  };
  const ctx = {
    id: { toString: () => 'demo-id' },
    container,
    storage: {
      async get<T>(k: string) { return storage.get(k) as T | undefined; },
      async put(k: string, v: unknown) { storage.set(k, v); },
      async delete(k: string) { return storage.delete(k); },
      async setAlarm(t: number) { state.alarm = t; },
      async getAlarm() { return state.alarm; },
      async deleteAlarm() { state.alarm = null; },
    },
    waitUntil(p: Promise<unknown>) { calls.waitUntil.push(p); },
    async blockConcurrencyWhile<T>(fn: () => Promise<T>) { return fn(); },
  };
  return { ctx, state, calls, storage, exit };
}
