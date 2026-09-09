// Service Bindingのfetch()に渡すパスのホストは、リクエストがCloudflareの
// 内部ネットワークを通り外へ出ないため任意の値でよい(dynamicneko/cf-auth/src/webhook.ts
// のWEBHOOK_PATHパターンと同じ)。
const PING_PATH = 'https://internal/api/ping?cmd=hello';

export type PingFetcher = Pick<Fetcher, 'fetch'>;

/**
 * `/neko hellodw` の実処理。dynamicneko(Cloudflare Dynamic Worker Loaderを
 * 使ったWorker)のGET /api/pingをService Binding経由で呼び、応答本文の
 * `reply` をそのまま返す(期待値"world"かどうかの判定は呼び出し側で行う)。
 * dynamicneko側もLOADER.load()で使い捨てisolateを実際に起動してから
 * 応答するため、この呼び出しが成功する = Dynamic Worker Loaderの機構
 * そのものが生きていることの確認になる。
 *
 * 公開URLへの通常fetch()ではなくService Bindingを使う理由: Cloudflareは
 * *.workers.dev同士のWorkerが公開fetch()で直接呼び合うことを許可しておらず
 * (ループ悪用防止のためHTTP 404 error code: 1042で拒否される、既知の制限)、
 * 実際に本番でこのエラーを踏んだ。cf-auth側が本体Workerを呼ぶ際に既に
 * Service Bindingを使っていたのと同じ理由・同じ対処。
 */
export async function pingDynamicWorker(
  fetcher: PingFetcher,
  secret: string
): Promise<string> {
  const res = await fetcher.fetch(PING_PATH, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`dynamicneko応答異常: HTTP ${res.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`);
  }

  let data: { ok?: boolean; reply?: string; error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error('dynamicnekoの応答がJSONとして解釈できませんでした');
  }

  if (typeof data.reply !== 'string' || data.reply.length === 0) {
    throw new Error(`dynamicnekoの応答にreplyが含まれていません: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.reply;
}
