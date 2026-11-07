/**
 * AIチャットのジョブ(Durable Object AichatJob の中身)。
 *
 * ユーザー指定(2026-11-07): 送信後にタブを閉じたり別ウィンドウへ移ったりしても、応答とその後のログ保存
 * (/api/aichat の autoSave)を途切れさせない。Workerの通常の要求はブラウザが切断すると止まり、
 * waitUntilも30秒までしか延ばせないため、生成はDurable Objectのalarm(最長15分)の中で最後まで行う。
 * ブラウザは /api/aichat/jobs/:jobId で途中経過を取りに来るだけで、来なくても生成と保存は終わる。
 *
 * 既存の /api/aichat(経路の振り分け・フォールバック・保存)には手を入れず、同じWorkerのアプリへ
 * 同じヘッダーと本文で要求を渡す(dispatch)。cloudflare:workers に依存しないので単体テストできる。
 */

/** 完了・失敗から、ジョブのデータを消すまでの時間。ブラウザが開き直して結果を読める期間でもある。 */
export const AICHAT_JOB_RETENTION_MS = 24 * 60 * 60 * 1000;
/** 途中の文章を保存する間隔。deltaごとに書くとストレージへの書き込みが増えすぎる。 */
const TEXT_FLUSH_INTERVAL_MS = 1000;
/** ブラウザへ返すヘッダーのうち、ジョブの結果へ写すもの。 */
const RESULT_HEADERS: Record<string, string> = { 'x-muse-tailscale': 'museTailscale' };

/** DurableObjectStorageのうち、ジョブが使う部分。 */
export interface AichatJobStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  deleteAll(): Promise<void>;
  setAlarm(time: number): Promise<void>;
}

export type AichatJobStatus = 'pending' | 'running' | 'done' | 'failed';
interface AichatJobMeta { owner: string; status: AichatJobStatus; createdAt: number; finishedAt?: number; expiresAt?: number }
interface AichatJobRequest { url: string; headers: Record<string, string>; body: string }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

function isRequest(value: unknown): value is AichatJobRequest {
  const v = value as AichatJobRequest | null;
  return !!v && typeof v.url === 'string' && typeof v.body === 'string' && !!v.headers && typeof v.headers === 'object';
}

export class AichatJobRunner {
  constructor(
    private readonly storage: AichatJobStorage,
    private readonly dispatch: (request: Request) => Promise<Response>,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/start') return this.start(request);
    if (request.method === 'GET' && url.pathname === '/status') {
      return this.status(url.searchParams.get('owner') ?? '', Math.max(0, Number(url.searchParams.get('offset')) || 0));
    }
    return json({ error: 'not_found' }, 404);
  }

  private async start(request: Request): Promise<Response> {
    let body: { owner?: unknown; request?: unknown };
    try { body = await request.json(); } catch { return json({ error: 'invalid_body' }, 400); }
    if (typeof body.owner !== 'string' || !body.owner || !isRequest(body.request)) return json({ error: 'invalid_body' }, 400);
    if (await this.storage.get('meta')) return json({ error: 'job_exists' }, 409);
    const meta: AichatJobMeta = { owner: body.owner, status: 'pending', createdAt: this.now() };
    await this.storage.put('request', body.request);
    await this.storage.put('text', '');
    await this.storage.put('meta', meta);
    await this.storage.setAlarm(this.now());
    return json({ status: 'pending' }, 202);
  }

  private async status(owner: string, offset: number): Promise<Response> {
    const meta = await this.storage.get<AichatJobMeta>('meta');
    // 送信者以外には、ジョブがあることも見せない
    if (!meta || !owner || meta.owner !== owner) return json({ error: 'not_found' }, 404);
    const text = (await this.storage.get<string>('text')) ?? '';
    return json({
      status: meta.status,
      text: text.slice(offset),
      textLength: text.length,
      start: (await this.storage.get('start')) ?? null,
      result: (await this.storage.get('result')) ?? null,
      error: (await this.storage.get('error')) ?? null,
      createdAt: meta.createdAt,
      finishedAt: meta.finishedAt ?? null,
    });
  }

  async alarm(): Promise<void> {
    const meta = await this.storage.get<AichatJobMeta>('meta');
    if (!meta) return;
    if (meta.status === 'pending') return this.run(meta);
    if (meta.status === 'running') {
      // 実行中に落ちてalarmが再実行された。やり直すと二重に保存するため、中断として終える。
      return this.finish(meta, { error: 'interrupted' });
    }
    if (meta.expiresAt !== undefined && this.now() >= meta.expiresAt) await this.storage.deleteAll();
  }

  private async run(meta: AichatJobMeta): Promise<void> {
    await this.storage.put('meta', { ...meta, status: 'running' });
    const saved = await this.storage.get<AichatJobRequest>('request');
    if (!saved) return this.finish(meta, { error: 'request_missing' });
    try {
      const response = await this.dispatch(new Request(saved.url, { method: 'POST', headers: saved.headers, body: saved.body }));
      const headers: Record<string, string> = {};
      for (const [name, key] of Object.entries(RESULT_HEADERS)) {
        const value = response.headers.get(name);
        if (value) headers[key] = value;
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('text/event-stream') && response.body) {
        const outcome = await this.consumeStream(response.body);
        if ('error' in outcome) return this.finish(meta, { error: outcome.error });
        return this.finish(meta, { result: { ...outcome.result, ...headers } });
      }
      let result: Record<string, unknown>;
      try { result = await response.json() as Record<string, unknown>; } catch { return this.finish(meta, { error: `invalid_response (HTTP ${response.status})` }); }
      // ステータスに関わらず結果として残す。{error}の表示は今までどおりブラウザが行う。
      return this.finish(meta, { result: { ...result, ...headers } });
    } catch (error) {
      return this.finish(meta, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /** /api/aichat のSSE(start・delta・done・error)を読み、途中の文章を保存しながら最終結果を組み立てる。 */
  private async consumeStream(body: ReadableStream<Uint8Array>): Promise<{ result: Record<string, unknown> } | { error: string }> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let flushedAt = this.now();
    let start: Record<string, unknown> = {};
    let done: Record<string, unknown> | null = null;
    let failure: string | null = null;
    const consume = async (block: string) => {
      let name = 'message';
      const lines: string[] = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) name = line.slice(6).trim();
        if (line.startsWith('data:')) lines.push(line.slice(5).trimStart());
      }
      if (!lines.length) return;
      let data: Record<string, unknown>;
      try { data = JSON.parse(lines.join('\n')); } catch { return; }
      if (name === 'start') { start = data; await this.storage.put('start', start); }
      if (name === 'delta' && typeof data.text === 'string') text += data.text;
      if (name === 'done') done = data;
      if (name === 'error') failure = typeof data.error === 'string' ? data.error : 'AIストリームの受信に失敗しました';
    };
    while (true) {
      const { value, done: finished } = await reader.read();
      buffer += decoder.decode(value, { stream: !finished });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = finished ? '' : (blocks.pop() ?? '');
      for (const block of blocks) await consume(block);
      if (this.now() - flushedAt >= TEXT_FLUSH_INTERVAL_MS) { await this.storage.put('text', text); flushedAt = this.now(); }
      if (finished) break;
    }
    await this.storage.put('text', text);
    if (failure) return { error: failure };
    if (!done) return { error: 'AIストリームが完了しませんでした' };
    return { result: { ...start, ...(done as Record<string, unknown>) } };
  }

  private async finish(meta: AichatJobMeta, outcome: { result: Record<string, unknown> } | { error: string }): Promise<void> {
    const finishedAt = this.now();
    if ('result' in outcome) await this.storage.put('result', outcome.result);
    else await this.storage.put('error', outcome.error);
    await this.storage.put('meta', { ...meta, status: 'result' in outcome ? 'done' : 'failed', finishedAt, expiresAt: finishedAt + AICHAT_JOB_RETENTION_MS });
    await this.storage.setAlarm(finishedAt + AICHAT_JOB_RETENTION_MS);
  }
}
