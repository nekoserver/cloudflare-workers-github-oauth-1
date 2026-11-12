/**
 * Worker 内 WASM の Go(Tailscale)の起動を管理する。Go が終了したり起動に失敗したりしたら、次の start で起動し直す(2026-11-13)。
 * 以前は起動の Promise を一度作ると作り直さず、Go が終了したあとは Durable Object が作り直されるまで、直送がすべて 503 になっていた。
 */
export type GoBoot = () => { ready: Promise<void>; exited: Promise<unknown> };

export function createGoLifecycle(boot: GoBoot) {
  let state: { ready: Promise<void>; exited: boolean } | undefined;
  return {
    /** 動いている Go があればそれを、無ければ(終了・起動失敗のあとも)新しく起動して、準備ができるまで待つ。 */
    start(): Promise<void> {
      if (!state || state.exited) {
        const b = boot();
        const s = { ready: b.ready, exited: false };
        const markExited = () => { s.exited = true; };
        b.exited.then(markExited, markExited);
        b.ready.catch(markExited);
        state = s;
      }
      return state.ready;
    },
    /** 最後に起動した Go が終了した(または起動に失敗した)か。 */
    get exited(): boolean { return state?.exited ?? false; },
  };
}
