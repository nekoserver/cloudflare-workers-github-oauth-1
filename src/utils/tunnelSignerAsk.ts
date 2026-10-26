import { resolveAskgkRoute, type AskgkRouteSettings } from './askgkRoutes';
import { DEFAULT_ASKGK_TIMEOUT_SECONDS, readAskgkTimeoutSetting } from './askgkTimeoutSettings';
type AskSettings = AskgkRouteSettings & { DB?: D1Database };

// Service Bindingのfetch()に渡すパスのホストは、リクエストがCloudflareの
// 内部ネットワークを通り外へ出ないため任意の値でよい(dynamicWorkerPing.tsと同じ)。
const SEND_PATH = 'https://internal/tunnel-signer/send';

export type AskFetcher = Pick<Fetcher, 'fetch'>;

/**
 * tunnels.rb側が応答に付けるようになったLLM種別情報(2026-10-07〜)。
 * HTTPヘッダ(X-LLM-Engine/X-LLM-Model/X-LLM-Effort)は本リポジトリからtunnels.rb
 * まで複数ホップのJSON文字列ラッピング(Service Binding→rust-worker-sqlx-d1→
 * tunnels.rb)を経由するため実HTTPヘッダとしては届かない。代わりにtunnels.rb
 * が応答JSON本体に含めるllm_model/llm_effortフィールドを読む。llm_engineに
 * 相当するフィールドは無いため、エンジン名は呼び出し元(aichatSlashCommand.ts)が
 * `◯◯_prompt="..."`の接頭語から判定する。
 */
export type AskTunnelSignerResult = {
  reply: string;
  llmModel?: string;
  llmEffort?: string;
};

/**
 * `/neko askgk <コマンド>` の短縮エイリアス表。tunnels側が実際に解釈する
 * コマンド文字列は冗長なため(例: "cf ai models list")、Slack上で打ちやすい
 * 短縮形(例: "models-list")をここで実コマンドへ変換してから送る。
 * 一致するエイリアスが無ければ入力をそのまま渡す(自由記述の質問文を壊さない)。
 */
const ASKGK_COMMAND_ALIASES: Readonly<Record<string, string>> = {
  'models-list': 'cf ai models list',
  // tunnels側(CLIから入れたClaudeが内部処理、Workers AIではない)が
  // 「設定状況」という日本語そのものを解釈するコマンドのため、半角スペースを
  // 含む表現を打たせずに済むよう、スペース無しの短いエイリアスを用意する。
  settings: '設定状況',
  'tunnels-list': 'cf tunnels list',
};

/**
 * `/neko askgk <質問文>` の入力を、エイリアス表に従って実際にtunnelsへ渡す
 * コマンド文字列へ変換する。前後の空白は無視するが大文字小文字は区別する
 * (エイリアス表のキーと完全一致した場合のみ変換する)。
 */
export function resolveAskgkCommand(input: string): string {
  const trimmed = input.trim();
  return ASKGK_COMMAND_ALIASES[trimmed] ?? trimmed;
}

/**
 * `/neko askgk <質問文>` の実処理。rust-worker-sqlx-d1(本リポジトリと同じ
 * Cloudflareアカウント内の別Worker)のPOST /tunnel-signer/sendをService
 * Binding経由で呼ぶ。
 *
 * rust-worker-sqlx-d1側がHMAC-SHA256署名とtunnels.rbへの実際のPOSTを行う
 * ため、ここではシークレットを一切扱わない(tunnel-signer.rsのコメント参照、
 * 署名はWorker起動時の環境変数ORIGIN_HMAC_SECRETから読まれる)。
 *
 * 公開URLへの通常fetch()ではなくService Bindingを使う理由は
 * dynamicWorkerPing.tsと同じ(*.workers.dev同士の直接fetch()はCloudflareに
 * HTTP 404 error code: 1042で拒否される)。
 *
 * `message`は呼び出し元(aichatSlashCommand.ts)が`/neko askgk`の後ろの生テキストを
 * そのまま渡す想定。`claude_prompt="..."`のような接頭語付きの文字列が来ても、
 * ここで解析・除去してはならない — tunnels.rb側がこの接頭語を見て自由記述の
 * 質問と区別しているため(2026-10-04、接頭語を剥がして渡してしまい先方の
 * 判定が効かなくなる不具合があった)。
 */
export async function askTunnelSigner(fetcher: AskFetcher, message: string, routeSettings?: string | AskSettings): Promise<AskTunnelSignerResult> {
  const settings: AskSettings | undefined = typeof routeSettings === 'string' ? { ASKGK_TUNNELS_URL: routeSettings } : routeSettings;
  const url = resolveAskgkRoute(settings);
  const timeoutSeconds = settings?.DB ? (await readAskgkTimeoutSetting(settings.DB)).timeoutSeconds : DEFAULT_ASKGK_TIMEOUT_SECONDS;
  const controller = new AbortController();
  let askId: string | undefined;
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`askgkがタイムアウトしました(${timeoutSeconds}秒)${askId ? `。処理は継続する場合があります。ask_id: ${askId}` : ''}`));
      controller.abort();
    }, timeoutSeconds * 1000);
  });
  const execute = async (): Promise<AskTunnelSignerResult> => {
    // Submit exactly once. Subsequent POSTs only look up the same job ID.
    let upstream = await sendTunnelRequest(fetcher, url, { status: 'healthy', format: 'json', message: resolveAskgkCommand(message), wait_seconds: 0 }, controller.signal);
    while (upstream.ask_status === 'pending' || upstream.ask_status === 'running') {
      if (typeof upstream.ask_id !== 'string' || !/^(?:codex|claude|nemotron)-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(upstream.ask_id)) {
        throw new Error('tunnelsの処理中応答に有効なask_idがありません');
      }
      if (askId && askId !== upstream.ask_id) throw new Error('tunnelsの状態照会でask_idが変わりました');
      askId = upstream.ask_id;
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
      if (controller.signal.aborted) throw new Error('askgkの待機を終了しました');
      upstream = await sendTunnelRequest(fetcher, url, { format: 'json', ask_id: askId }, controller.signal);
    }
    if (upstream.ask_error || upstream.ask_status === 'failed') throw new Error(`tunnels実行失敗: ${upstream.ask_error || 'failed'}`);
    if (typeof upstream.reply !== 'string' || upstream.reply.length === 0) throw new Error(`tunnelsの応答にreplyが含まれていません`);
    return {
      reply: upstream.reply,
      llmModel: typeof upstream.llm_model === 'string' && upstream.llm_model.length > 0 ? upstream.llm_model : undefined,
      llmEffort: typeof upstream.llm_effort === 'string' && upstream.llm_effort.length > 0 ? upstream.llm_effort : undefined,
    };
  };
  try { return await Promise.race([execute(), expired]); }
  finally { clearTimeout(timer!); }
}

type TunnelResponse = { reply?: string; llm_model?: unknown; llm_effort?: unknown; ask_status?: string; ask_id?: string; ask_error?: string };
async function sendTunnelRequest(fetcher: AskFetcher, url: string, payload: Record<string, unknown>, signal: AbortSignal): Promise<TunnelResponse> {
  const res = await fetcher.fetch(SEND_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, contentType: 'application/json', body: JSON.stringify(payload) }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`rust-worker-sqlx-d1応答異常: HTTP ${res.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`);
  }

  let sendResult: { ok?: boolean; status?: number; body?: string; error?: string };
  try {
    sendResult = await res.json();
  } catch {
    throw new Error('rust-worker-sqlx-d1の応答がJSONとして解釈できませんでした');
  }

  if (sendResult.error) {
    throw new Error(`rust-worker-sqlx-d1からエラー応答: ${sendResult.error}`);
  }
  if (typeof sendResult.body !== 'string') {
    throw new Error('rust-worker-sqlx-d1の応答にbodyが含まれていません');
  }
  if (!sendResult.ok) {
    throw new Error(`tunnels応答異常: HTTP ${sendResult.status} ${sendResult.body.slice(0, 200)}`);
  }

  let upstream: TunnelResponse;
  try {
    upstream = JSON.parse(sendResult.body);
    if (!upstream || typeof upstream !== 'object' || Array.isArray(upstream)) throw new Error('invalid response');
  } catch {
    throw new Error(`tunnelsの応答がJSONとして解釈できませんでした: ${sendResult.body.slice(0, 200)}`);
  }

  return upstream;
}
