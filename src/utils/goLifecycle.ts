/**
 * Worker 内 WASM の Go(Tailscale)の起動を管理する。Go が終了したり起動に失敗したりしたら、次の start で起動し直す(2026-11-13)。
 * 以前は起動の Promise を一度作ると作り直さず、Go が終了したあとは Durable Object が作り直されるまで、直送がすべて 503 になっていた。
 */
export type GoBoot = () => { ready: Promise<void>; exited: Promise<unknown>; isExited?: () => boolean };

export function createGoLifecycle(boot: GoBoot) {
  let state: { ready: Promise<void>; exited: boolean; isExited?: () => boolean } | undefined;
  return {
    /** 動いている Go があればそれを、無ければ(終了・起動失敗のあとも)新しく起動して、準備ができるまで待つ。 */
    start(): Promise<void> {
      if (!state || state.exited || state.isExited?.()) {
        const b = boot();
        const s = { ready: b.ready, exited: false, isExited: b.isExited };
        const markExited = () => { s.exited = true; };
        b.exited.then(markExited, markExited);
        b.ready.catch(markExited);
        state = s;
      }
      return state.ready;
    },
    /** 最後に起動した Go が終了した(または起動に失敗した)か。 */
    get exited(): boolean { return state?.exited === true || state?.isExited?.() === true; },
  };
}

export class GoNodeUnavailableError extends Error {}

/** A Go callback can return undefined when its runtime exits during the call. */
export async function startGoNode<T extends { run: unknown }>(
  runtime: ReturnType<typeof createGoLifecycle>,
  createNode: () => T | Error | null | undefined,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      await runtime.start();
    } catch (cause) {
      throw new GoNodeUnavailableError('Tailscale WASM runtime could not start', { cause });
    }

    try {
      const node = createNode();
      if (node instanceof Error) throw node;
      if (!node || typeof node.run !== 'function') {
        throw new GoNodeUnavailableError('Tailscale WASM newIPN did not return a runnable node');
      }
      if (runtime.exited) throw new GoNodeUnavailableError('Tailscale WASM runtime exited while creating the node');
      return node;
    } catch (error) {
      // The runtime's exit promise updates this flag in a microtask.
      await Promise.resolve();
      if (!runtime.exited) throw error;
      if (attempt > 0) {
        throw new GoNodeUnavailableError('Tailscale WASM runtime exited while creating the node', { cause: error });
      }
    }
  }
}
