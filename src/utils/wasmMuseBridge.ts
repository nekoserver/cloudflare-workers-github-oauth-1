import {readMuseNodeSnapshot} from './museNodeReady';
import {parseMuseMessages} from './museMessages';
import type { IPN, IPNResponse } from '@ai-ecoverse/wasm-tailscale';

/**
 * タイムアウトしたとき、どの段階で止まったか(2026-11-12)。原因の候補ごとに観測されることが違う。
 * - path_lost: 待機中の /health が失敗した(通り道が切れた)
 * - no_response_headers: /health は成功するのに応答のヘッダが来ない(muse-vm が返事を始めない。推論が終わっていない)
 * - body_stalled: ヘッダは来て本文の途中で止まった(ストリーミングなど)
 */
export type MuseBridgeDiagnosis = {
  cause: 'path_lost' | 'no_response_headers' | 'body_stalled';
  elapsedMs: number;
  headersReceived: boolean;
  status?: number;
  contentType?: string;
  bytesReceived: number;
  keepAliveOk: number;
  keepAliveFailed: number;
};

/** 診断をチャットの表示用の1文にする。 */
export function formatMuseBridgeDiagnosis(d: MuseBridgeDiagnosis): string {
  const seconds = Math.round(d.elapsedMs / 1000);
  if (d.cause === 'path_lost') return `muse-vm への通り道が切れた(待機中の /health が${d.keepAliveFailed}回失敗、${seconds}秒)`;
  if (d.cause === 'body_stalled') return `muse-vm の返事が途中で止まった(ステータス${d.status ?? '不明'}、${d.contentType || 'Content-Type不明'}、${d.bytesReceived}バイト受信、${seconds}秒)`;
  return `muse-vm が返事を始めなかった(待機中の /health は${d.keepAliveOk}回成功・${d.keepAliveFailed}回失敗。推論が終わっていない可能性、${seconds}秒)`;
}

/** Private DO endpoint: no caller-selected destination, credentials or redirects. */
export class WasmMuseBridge {
  /**
   * keepAliveMs: 推論を待つ間、muse-vm へ短い /health を送る間隔。WASM のノードは送信の無い DERP 接続を約1分で閉じ
   * (magicsock: closing connection to derp-N (idle))、推論に1分以上かかると返事の通り道が無くなる(2026-11-12)。
   */
  // timeoutMs: 外側(AIチャットの300秒)より短くし、先に中継が診断付きで答える。
  constructor(private node: IPN, private apiKey?: string, private timeoutMs = 290_000, private keepAliveMs = 20_000) {}

  /** 推論の要求は送り直さず、接続を使用中に保つためだけの /health。成否は診断に数える。 */
  private keepAlive(apiKey: string, counts: { ok: number; failed: number }): ReturnType<typeof setInterval> {
    return setInterval(() => {
      this.node.fetch({ url: 'http://muse-vm:8080/health', method: 'GET', manualRedirects: true, headers: [['Authorization', 'Bearer ' + apiKey]] })
        .then(res => { res.cancel(); if (res.status === 200) counts.ok++; else counts.failed++; })
        .catch(() => { counts.failed++; });
    }, this.keepAliveMs);
  }
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    const health = path === '/muse/health' && request.method === 'GET';
    const chat = path === '/muse/v1/chat/completions' && request.method === 'POST';
    if (!health && !chat) return new Response('Not found', { status: 404 });
    // 呼び出し元(本体の中継)がdynamicnekoの鍵を渡したときは、それをそのままmuse-vmへ渡す。無ければこの中継の鍵。
    const callerKey = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
    const apiKey = callerKey ?? this.apiKey;
    if (!apiKey) return Response.json({ error: 'muse_not_authenticated' }, { status: 503 });
    const state = readMuseNodeSnapshot(this.node.status());
    if (state.state !== 'Running' || !state.museOnline) return Response.json({ error: 'tailscale_not_connected' }, { status: 503 });
    let body: Uint8Array | undefined;
    if (chat) {
      const text = await request.text();
      if (new TextEncoder().encode(text).length > 100000) return Response.json({ error: 'payload_too_large' }, { status: 413 });
      let data;
      try { data = JSON.parse(text); } catch { return Response.json({ error: 'invalid_prompt' }, { status: 400 }); }
      const messages = parseMuseMessages(data?.messages);
      if (!messages) return Response.json({ error: 'invalid_prompt' }, { status: 400 });
      // ask_muse の実装と同じボディ({model, messages}だけ)。コンテナ経由(server.js)とも同じ形になる。
      body = new TextEncoder().encode(JSON.stringify({ model: 'muse', messages }));
    }
    let upstream: IPNResponse | undefined, expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const keepAliveCounts = { ok: 0, failed: 0 };
    let bytesReceived = 0;
    const keepAlive = chat ? this.keepAlive(apiKey, keepAliveCounts) : undefined;
    const diagnose = (): MuseBridgeDiagnosis => {
      const headersReceived = upstream !== undefined;
      const contentType = upstream?.headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1];
      const cause: MuseBridgeDiagnosis['cause'] = headersReceived ? 'body_stalled' : keepAliveCounts.failed > 0 ? 'path_lost' : 'no_response_headers';
      return { cause, elapsedMs: Date.now() - startedAt, headersReceived, ...(upstream ? { status: upstream.status } : {}), ...(contentType ? { contentType } : {}), bytesReceived, keepAliveOk: keepAliveCounts.ok, keepAliveFailed: keepAliveCounts.failed };
    };
    const timedOut = (): Response => {
      if (!chat) return Response.json({ error: 'llm_timeout' }, { status: 504 });
      const diagnosis = diagnose();
      console.log('[muse-bridge] ' + JSON.stringify({ event: 'chat_timeout', ...diagnosis }));
      return Response.json({ error: 'llm_timeout', diagnosis }, { status: 504 });
    };
    const run = async () => {
      upstream = await this.node.fetch({ url: 'http://muse-vm:8080' + (health ? '/health' : '/v1/chat/completions'), method: health ? 'GET' : 'POST', manualRedirects: true, headers: [['Authorization', 'Bearer ' + apiKey], ['Content-Type', 'application/json']], ...(body ? { body } : {}) });
      if (expired) { upstream.cancel(); throw new Error('expired'); }
      const chunks: Uint8Array[] = []; let size = 0;
      for (;;) {
        const chunk = await upstream.read();
        if (expired) throw new Error('expired');
        if (chunk === null) break;
        size += chunk.length;
        bytesReceived = size;
        if (size > 1048576) throw new Error('response too large');
        chunks.push(chunk);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return new Response(bytes, { status: upstream.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Muse-Upstream-Response': '1' } });
    };
    try { return await Promise.race([run(), new Promise<Response>(resolve => { timer = setTimeout(() => { expired = true; upstream?.cancel(); resolve(timedOut()); }, health ? Math.min(8000, this.timeoutMs) : this.timeoutMs); })]); }
    catch { upstream?.cancel(); return Response.json({ error: 'muse_connection_failed' }, { status: 502 }); }
    finally { clearTimeout(timer); clearInterval(keepAlive); }
  }
}
