// Service Bindingのfetch()に渡すパスのホストは、リクエストがCloudflareの
// 内部ネットワークを通り外へ出ないため任意の値でよい(dynamicWorkerPing.tsと同じ)。
const SEND_PATH = 'https://internal/tunnel-signer/send';

/** rust-worker-sqlx-d1がサーバー側署名で実際にPOSTする対象URL(/tunnel-signer自体のデフォルト値と同じ)。 */
const TUNNELS_URL = 'https://mynw.nekomaneki.work/lib/api/tunnels';

export type AskFetcher = Pick<Fetcher, 'fetch'>;

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
  const payload = JSON.stringify({ status: 'healthy', format: 'json', message });

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
