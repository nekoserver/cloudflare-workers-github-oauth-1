// Service Bindingのfetch()に渡すパスのホストは、リクエストがCloudflareの
// 内部ネットワークを通り外へ出ないため任意の値でよい(dynamicWorkerPing.tsと同じ)。
const SEND_PATH = 'https://internal/tunnel-signer/send';

/** rust-worker-sqlx-d1がサーバー側署名で実際にPOSTする対象URL(/tunnel-signer自体のデフォルト値と同じ)。 */
const TUNNELS_URL = 'https://mynw.nekomaneki.work/lib/api/tunnels';

export type AskFetcher = Pick<Fetcher, 'fetch'>;

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
 * `/neko askgk claude_prompt="<質問文>"` 形式の引数から質問文を取り出す。
 * 従来の自由記述形式(`/neko askgk <質問文>`)と両立させるため、`claude_prompt="`
 * で始まらない入力はnullを返し、呼び出し元は従来通り全文をそのまま質問文として
 * 扱う(後方互換、既存の挙動を壊さない)。
 *
 * 値中の `\"` は `"` に、`\\` は `\` に戻す(JSON文字列リテラルと同じ規則)。
 * 閉じクォートが無い場合(引用符の対応が壊れている)はnullを返す。
 *
 * ここで取り出した質問文は、呼び出し元がaskTunnelSignerへ渡す際に
 * JSON.stringifyされる(tunnelSignerAsk.ts askTunnelSigner参照)ため、
 * rust-worker-sqlx-d1へ送るAPIペイロード上で改めて正しくエスケープされる。
 */
export function parseAskgkClaudePromptArg(rawArgs: string): string | null {
  const trimmed = rawArgs.trim();
  const prefix = 'claude_prompt="';
  if (!trimmed.startsWith(prefix)) return null;

  const body = trimmed.slice(prefix.length);
  let value = '';
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '\\' && i + 1 < body.length) {
      const next = body[i + 1];
      if (next === '"' || next === '\\') {
        value += next;
        i += 2;
        continue;
      }
    }
    if (ch === '"') {
      return value;
    }
    value += ch;
    i += 1;
  }
  return null;
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
 */
export async function askTunnelSigner(fetcher: AskFetcher, message: string): Promise<string> {
  const payload = JSON.stringify({ status: 'healthy', format: 'json', message: resolveAskgkCommand(message) });

  const res = await fetcher.fetch(SEND_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: TUNNELS_URL, contentType: 'application/json', body: payload }),
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

  let upstream: { reply?: string };
  try {
    upstream = JSON.parse(sendResult.body);
  } catch {
    throw new Error(`tunnelsの応答がJSONとして解釈できませんでした: ${sendResult.body.slice(0, 200)}`);
  }

  if (typeof upstream.reply !== 'string' || upstream.reply.length === 0) {
    throw new Error(`tunnelsの応答にreplyが含まれていません: ${sendResult.body.slice(0, 200)}`);
  }
  return upstream.reply;
}
