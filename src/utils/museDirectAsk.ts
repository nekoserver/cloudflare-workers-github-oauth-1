import { DEFAULT_ASKGK_TIMEOUT_SECONDS, readAskgkTimeoutSetting } from './askgkTimeoutSettings';
import { isContainerRunning, type ContainerStateLike } from './cfContainerStatus';

/**
 * コンテナ経由でmuse-vmへ送る部品(直送ではない。直送は museWorkerAsk.ts の Worker内WASM)。
 * AIチャットで⚙の旧コンテナ直通を選んだときと、tree-view の Museタブ(通信経路「コンテナ」)が使う。Workerはtailnetに参加できないため、
 * 本体デモコンテナ(tailnetのノード)のserver.jsを1段だけ挟んでmuse-vmへ届ける。
 * rust-worker-sqlx-d1・tunnels.rb・LLM workerは通らない。
 *
 * 経路: 本体Worker → DEMO_CONTAINER(Durable Object) → server.js → tailscale nc → muse-vm:8080
 *
 * キーはWorkerのsecretに置き、要求ごとにAuthorizationで渡す。コンテナの環境変数に
 * 入れると、T3やエージェントの子プロセスから読めるようになるため。
 */
export const MUSE_DIRECT_PATH = '/muse/v1/chat/completions';
export const MUSE_HEALTH_PATH = '/muse/health';
const MUSE_HEALTH_TIMEOUT_MS = 8_000;
const MUSE_MODEL = 'muse';
// lib/ops/llm_worker.pyのMAX_PROMPT・MAX_OUTPUTと同じ上限。
const MAX_PROMPT_BYTES = 16_384;
const MAX_REPLY_BYTES = 32_768;
const MODEL_NAME = /^[a-zA-Z0-9_.:/-]{1,128}$/;

export type MuseDirectError =
  | 'tailscale_wasm_not_configured'
  | 'container_not_running'
  | 'muse_not_authenticated'
  | 'prompt_too_large'
  | 'muse_connection_failed'
  | 'muse_authentication_failed'
  | 'muse_usage_limit'
  | 'muse_command_failed'
  | 'muse_execution_failed'
  | 'llm_timeout';

// bridgeCommandはmuse-vmのapi-bridgeが推論せずに実行したコマンド名。応答のbridge_commandから読む。
// diagnosis: 失敗したとき、どの段階で止まったか(表示用の1文。Worker内WASMの中継が返す)。
export type MuseDirectResult = { ok: true; reply: string; llmModel: string; bridgeCommand?: string } | { ok: false; error: MuseDirectError; diagnosis?: string };

export type MuseContainer = { getState(): Promise<ContainerStateLike>; fetch(request: Request): Promise<Response> };

function errorForStatus(status: number): MuseDirectError {
  if (status === 401 || status === 403) return 'muse_authentication_failed';
  if (status === 429) return 'muse_usage_limit';
  if (status === 502) return 'muse_connection_failed';
  if (status === 504) return 'llm_timeout';
  // api-bridgeは/usage等の実行に失敗すると503を返す(server.jsの中継は502・504)。
  if (status === 503) return 'muse_command_failed';
  return 'muse_execution_failed';
}

export function parseCompletion(payload: string): MuseDirectResult {
  let data: { model?: unknown; bridge_command?: unknown; choices?: { message?: { content?: unknown } }[] };
  try {
    data = JSON.parse(payload);
  } catch {
    return { ok: false, error: 'muse_execution_failed' };
  }
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || !reply.trim()) return { ok: false, error: 'muse_execution_failed' };
  const bytes = new TextEncoder().encode(reply);
  return {
    ok: true,
    reply: bytes.length > MAX_REPLY_BYTES ? new TextDecoder().decode(bytes.slice(0, MAX_REPLY_BYTES)).replace(/\uFFFD+$/, '') : reply,
    llmModel: typeof data.model === 'string' && MODEL_NAME.test(data.model) ? data.model : MUSE_MODEL,
    ...(typeof data.bridge_command === 'string' && data.bridge_command ? { bridgeCommand: data.bridge_command } : {}),
  };
}

export async function askMuseDirect(container: MuseContainer, apiKey: string | undefined, prompt: string, timeoutSeconds: number): Promise<MuseDirectResult> {
  if (!apiKey) return { ok: false, error: 'muse_not_authenticated' };
  if (new TextEncoder().encode(prompt).length > MAX_PROMPT_BYTES) return { ok: false, error: 'prompt_too_large' };
  // stub.fetchは停止中のコンテナを起動して課金を始めるため、先に状態を確かめる。
  if (!isContainerRunning(await container.getState())) return { ok: false, error: 'container_not_running' };

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<MuseDirectResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, error: 'llm_timeout' });
    }, timeoutSeconds * 1000);
  });
  const execute = async (): Promise<MuseDirectResult> => {
    const response = await container.fetch(new Request(`http://container${MUSE_DIRECT_PATH}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MUSE_MODEL, messages: [{ role: 'user', content: prompt }] }),
      signal: controller.signal,
    }));
    if (response.status !== 200) return { ok: false, error: errorForStatus(response.status) };
    return parseCompletion(await response.text());
  };
  try {
    return await Promise.race([
      execute().catch((): MuseDirectResult => ({ ok: false, error: controller.signal.aborted ? 'llm_timeout' : 'muse_connection_failed' })),
      expired,
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * /askmuseの経路が使える状態かを確かめる。定期的に呼ばれるので、askMuseDirectと同じく
 * 停止中のコンテナは起動しない。推論を走らせないmuse-vmの/healthを見る。
 * 確認できなかったときはすべて稼働中でないものとして扱う。
 */
export async function checkMuseHealth(container: MuseContainer, apiKey: string | undefined, timeoutMs = MUSE_HEALTH_TIMEOUT_MS): Promise<boolean> {
  if (!apiKey) return false;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(false);
    }, timeoutMs);
  });
  const execute = async (): Promise<boolean> => {
    if (!isContainerRunning(await container.getState())) return false;
    const response = await container.fetch(new Request(`http://container${MUSE_HEALTH_PATH}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    }));
    if (response.status !== 200) return false;
    const body = await response.json() as { status?: unknown } | null;
    return body?.status === 'ok';
  };
  try {
    return await Promise.race([execute().catch(() => false), expired]);
  } finally {
    clearTimeout(timer!);
  }
}

type MuseDirectEnv = { DEMO_CONTAINER?: unknown; MUSE_API_KEY?: string; DB?: D1Database };

/** muse-vmまで届かなかった失敗。認証・利用上限・実行の失敗は届いた上での失敗なので含めない。 */
const UNREACHED: ReadonlySet<MuseDirectError> = new Set<MuseDirectError>(['container_not_running', 'muse_connection_failed', 'llm_timeout', 'tailscale_wasm_not_configured']);

/**
 * チャットの依存を組み立てる。待ち時間は/neko askgkと同じ保存値を使う。
 * onStatusは送った結果で接続状態を知らせる(画面のX-Muse-Tailscale。Worker内WASMの経路と同じ扱い)。
 */
export function museDirectDep<E extends MuseDirectEnv>(env: E, getContainer: (env: E) => Promise<MuseContainer | null>, onStatus?: (healthy: boolean) => void) {
  if (!env.DEMO_CONTAINER) return undefined;
  return async (prompt: string): Promise<MuseDirectResult> => {
    const container = await getContainer(env);
    const timeoutSeconds = env.DB ? (await readAskgkTimeoutSetting(env.DB)).timeoutSeconds : DEFAULT_ASKGK_TIMEOUT_SECONDS;
    const result: MuseDirectResult = container ? await askMuseDirect(container, env.MUSE_API_KEY, prompt, timeoutSeconds) : { ok: false, error: 'container_not_running' };
    onStatus?.(result.ok || !UNREACHED.has(result.error));
    return result;
  };
}
