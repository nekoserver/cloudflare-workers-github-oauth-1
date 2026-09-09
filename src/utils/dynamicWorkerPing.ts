export type PingFetch = typeof fetch;

/**
 * `/neko hellodw` の実処理。dynamicneko(Cloudflare Dynamic Worker Loaderを
 * 使ったWorker)の `GET /api/ping?cmd=hello` を呼び、応答本文の `reply` を
 * そのまま返す(期待値"world"かどうかの判定は呼び出し側で行う)。
 * dynamicneko側もLOADER.load()で使い捨てisolateを実際に起動してから
 * 応答するため、この呼び出しが成功する = Dynamic Worker Loaderの機構
 * そのものが生きていることの確認になる。
 */
export async function pingDynamicWorker(
  baseUrl: string,
  secret: string,
  fetchImpl: PingFetch = fetch
): Promise<string> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/ping?cmd=hello`;
  const res = await fetchImpl(url, {
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
