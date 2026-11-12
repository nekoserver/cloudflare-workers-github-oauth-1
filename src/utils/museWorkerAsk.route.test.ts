/**
 * AIチャットの直送(aichat-direct)を、動いている tree-view の Museタブ(treeview-musetab-wasm)と同じ送り方にそろえる(2026-11-12)。
 *
 * 仮説: 2つの経路で違うのは経路IDだけのはず(ユーザー指定)。そうなら、同じ鍵・同じ会話を渡したとき、
 *   1. Worker 内 WASM の中継(TAILSCALE_WASM)へ届く要求は、パス・ヘッダ(Authorization を含む)・本文がまったく同じでないとおかしい。
 *   2. 待ち時間の上限も同じでないとおかしい。上限は muse-vm の api-bridge の待ち時間と同じ600秒(2026-11-13、以前は90秒)。
 * 修正前は、AIチャットは Authorization を付けず中継の起動時の鍵に任せ、待ち時間はAIチャットの設定(300秒)だった。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTreeViewMuseChatRoutes } from '../routes/treeViewMuseChat';
import { signWorkerRequest } from './workerRequestSignature';
import { MUSE_WORKER_MAX_TIMEOUT_SECONDS, museWorkerDep, sendMuseViaWorker } from './museWorkerAsk';

type Sent = { path: string; authorization: string | null; contentType: string | null; body: string };

function recordingNamespace(sent: Sent[], respond: () => Promise<Response> = async () => Response.json({ model: 'muse', choices: [{ message: { content: 'ok' } }] })) {
  return {
    idFromName: () => 'muse',
    get: () => ({
      fetch: async (request: Request) => {
        sent.push({ path: new URL(request.url).pathname, authorization: request.headers.get('Authorization'), contentType: request.headers.get('Content-Type'), body: await request.text() });
        return respond();
      },
    }),
  };
}

async function sendFromTreeView(key: string, messages: { role: 'user' | 'assistant'; content: string }[], ns: unknown) {
  const path = '/api/tree-view/muse-chat-external';
  const body = JSON.stringify({ model: 'muse', messages });
  const signed = await signWorkerRequest('secret', 'dynamicneko', 'POST', path, body);
  const app = createTreeViewMuseChatRoutes({ getContainer: async () => null as never, authenticate: async () => ({ ok: true as const, login: 'nekoserver' }) });
  return app.request('https://internal' + path, {
    method: 'POST', body,
    headers: { ...signed, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'X-Aichat-User-Token': 'user-token', 'X-Muse-Transport': 'worker' },
  }, { DYNAMICNEKO_WORKER_HMAC_SECRET: 'secret', TAILSCALE_WASM: ns } as never);
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('AIチャットの直送は tree-view の Museタブと同じ送り方', () => {
  it('同じ鍵・同じ会話なら、中継へ届く要求(パス・Authorization・Content-Type・本文)が同じ', async () => {
    const messages = [{ role: 'user' as const, content: '1+1は?' }];
    const fromTreeView: Sent[] = [];
    const r = await sendFromTreeView('same-key', messages, recordingNamespace(fromTreeView));
    expect(r.status).toBe(200);

    const fromAichat: Sent[] = [];
    const result = await museWorkerDep({ TAILSCALE_WASM: recordingNamespace(fromAichat) as never, MUSE_API_KEY: 'same-key' })('1+1は?');
    expect(result).toMatchObject({ ok: true, reply: 'ok' });

    expect(fromAichat).toEqual(fromTreeView);
    expect(fromAichat[0].authorization).toBe('Bearer same-key');
  });

  it('直送は api-bridge と同じ600秒まで待つ(askgk の保存値で縮めない)', async () => {
    vi.useFakeTimers();
    const ns = recordingNamespace([], () => new Promise<Response>(() => {}));
    const pending = museWorkerDep({ TAILSCALE_WASM: ns as never, MUSE_API_KEY: 'k' })('q');
    let settled: unknown;
    void pending.then(x => { settled = x; });
    await vi.advanceTimersByTimeAsync(MUSE_WORKER_MAX_TIMEOUT_SECONDS * 1000 - 1);
    expect(settled).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toMatchObject({ ok: false, error: 'llm_timeout' });
    expect(MUSE_WORKER_MAX_TIMEOUT_SECONDS).toBe(600);
  });

  it('失敗したときは経路IDを Worker のログに出す(どの経路の失敗か見分ける)', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const ns = recordingNamespace([], async () => Response.json({ error: 'llm_timeout' }, { status: 504 }));
    const result = await sendMuseViaWorker({ TAILSCALE_WASM: ns as never }, [{ role: 'user', content: 'q' }], { routeId: 'aichat-direct', apiKey: 'k' });
    expect(result).toMatchObject({ ok: false, error: 'llm_timeout' });
    const line = log.mock.calls.map(c => String(c[0])).find(x => x.startsWith('[muse-worker]'));
    expect(line).toBeDefined();
    expect(JSON.parse(line!.slice('[muse-worker] '.length))).toMatchObject({ routeId: 'aichat-direct', error: 'llm_timeout' });
    expect(line).not.toContain('"k"');
  });

  it('鍵が無ければ送らない(中継の起動時の鍵に黙って切り替えない)', async () => {
    const sent: Sent[] = [];
    const result = await museWorkerDep({ TAILSCALE_WASM: recordingNamespace(sent) as never })('q');
    expect(result).toMatchObject({ ok: false, error: 'muse_not_authenticated' });
    expect(sent).toEqual([]);
  });
});
