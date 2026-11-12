// 原因を特定するためのテスト(2026-11-12)。本番で「muse-vm に届く(Muse の通知が来る)のに返事が来ず、
// 300秒でタイムアウト」が続いた。原因の候補ごとに、その原因なら何が観測されるかを決め、
// タイムアウトしたときに、どれに当たるかを応答・ログ・チャットの表示に出す。
//   A. 通り道が閉じた(DERP)      → 待機中の /health が失敗する
//   B. muse-vm が返事を始めない      → /health は成功するのに、応答のヘッダが来ない(推論が終わっていない)
//   C. 返事が途中で止まる            → ヘッダ(ステータス・Content-Type)は来て、本文の途中で止まる
//   D. 鍵が違う                      → すぐ 401 が返る(待たない)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WasmMuseBridge, formatMuseBridgeDiagnosis } from './wasmMuseBridge';
import { askMuseWorkerMessages } from './museWorkerAsk';
import { interpretMusePrompt } from './aichatSlashCommand';

type Behavior = { health: 'ok' | 'fail'; chat: 'no-headers' | 'stall-body' | 'unauthorized' };
const enc = (s: string) => new TextEncoder().encode(s);
function fakeNode(b: Behavior) {
  const calls: string[] = [];
  const node = {
    status: () => JSON.stringify({ state: 'Running', peers: [{ name: 'muse-vm', online: true }] }),
    fetch: vi.fn(async (r: { url: string }) => {
      calls.push(r.url);
      if (r.url.endsWith('/health')) {
        if (b.health === 'fail') throw new Error('connection lost');
        return { status: 200, statusText: 'OK', url: r.url, headers: [], cancel: vi.fn(), read: vi.fn().mockResolvedValueOnce(enc('{"status":"ok"}')).mockResolvedValue(null) };
      }
      if (b.chat === 'unauthorized') return { status: 401, statusText: 'Unauthorized', url: r.url, headers: [['content-type', 'application/json']], cancel: vi.fn(), read: vi.fn().mockResolvedValueOnce(enc('{"error":"unauthorized"}')).mockResolvedValue(null) };
      if (b.chat === 'no-headers') return new Promise(() => {});
      let sent = false;
      return { status: 200, statusText: 'OK', url: r.url, headers: [['content-type', 'text/event-stream']], cancel: vi.fn(), read: () => { if (sent) return new Promise(() => {}); sent = true; return Promise.resolve(enc('data: {"partial":true}\n\n')); } };
    }),
  };
  return { node, calls };
}
const chat = () => new Request('http://tailnet/muse/v1/chat/completions', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: '質問' }] }) });

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function timeoutDiagnosis(b: Behavior) {
  const { node } = fakeNode(b);
  const bridge = new WasmMuseBridge(node as never, 'key', 100_000, 20_000);
  const pending = bridge.fetch(chat());
  await vi.advanceTimersByTimeAsync(100_000);
  const res = await pending;
  return { res, body: await res.json() as { error: string; diagnosis?: Record<string, unknown> } };
}

describe('タイムアウトしたとき、どの段階で止まったかを返す', () => {
  it('A. 待機中の /health が失敗したら path_lost(通り道が切れた)', async () => {
    const { res, body } = await timeoutDiagnosis({ health: 'fail', chat: 'no-headers' });
    expect(res.status).toBe(504);
    expect(body).toMatchObject({ error: 'llm_timeout', diagnosis: { cause: 'path_lost', headersReceived: false } });
    expect(body.diagnosis!.keepAliveFailed).toBeGreaterThan(0);
  });
  it('B. /health は成功し続けるのにヘッダが来なければ no_response_headers(muse-vm が返事を始めない)', async () => {
    const { body } = await timeoutDiagnosis({ health: 'ok', chat: 'no-headers' });
    expect(body.diagnosis).toMatchObject({ cause: 'no_response_headers', headersReceived: false, keepAliveFailed: 0 });
    expect(body.diagnosis!.keepAliveOk).toBeGreaterThan(0);
  });
  it('C. ヘッダは来て本文の途中で止まったら body_stalled(ステータス・Content-Type・受信バイト数を残す)', async () => {
    const { body } = await timeoutDiagnosis({ health: 'ok', chat: 'stall-body' });
    expect(body.diagnosis).toMatchObject({ cause: 'body_stalled', headersReceived: true, status: 200, contentType: 'text/event-stream' });
    expect(body.diagnosis!.bytesReceived).toBeGreaterThan(0);
  });
  it('D. 鍵が違えば待たずに 401 を返す(タイムアウトにしない)', async () => {
    const { node } = fakeNode({ health: 'ok', chat: 'unauthorized' });
    const res = await new WasmMuseBridge(node as never, 'wrong', 100_000, 20_000).fetch(chat());
    expect(res.status).toBe(401);
  });
  it('診断を Workers のログにも1行で残す(画面を見ていなくても後から追える)', async () => {
    await timeoutDiagnosis({ health: 'ok', chat: 'no-headers' });
    const line = (console.log as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(c => String(c[0])).find(s => s.startsWith('[muse-bridge]'));
    expect(line).toBeDefined();
    expect(line).toContain('no_response_headers');
  });
  it('中継の既定の待ち時間は、外側の300秒より短い(先に中継が診断付きで答える)', async () => {
    const { node } = fakeNode({ health: 'ok', chat: 'no-headers' });
    const pending = new WasmMuseBridge(node as never, 'key').fetch(chat());
    let settled = false; void pending.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(295_000);
    expect(settled).toBe(true);
  });
});

describe('診断をチャットのエラー文まで届ける', () => {
  it('askMuseWorkerMessages は診断を失敗の結果に載せる', async () => {
    const diagnosis = { cause: 'no_response_headers', elapsedMs: 290_000, headersReceived: false, keepAliveOk: 14, keepAliveFailed: 0, bytesReceived: 0 };
    const ns = { idFromName: () => 'muse', get: () => ({ fetch: async () => Response.json({ error: 'llm_timeout', diagnosis }, { status: 504 }) }) };
    vi.useRealTimers();
    const result = await askMuseWorkerMessages({ TAILSCALE_WASM: ns as never, MUSE_API_KEY: 'k' }, [{ role: 'user', content: 'q' }]);
    expect(result).toMatchObject({ ok: false, error: 'llm_timeout' });
    expect(!result.ok && result.diagnosis).toContain('返事を始めなかった');
  });
  it('Muse のエラー文に診断が出る', async () => {
    vi.useRealTimers();
    const r = await interpretMusePrompt('q', { askMuseDirect: vi.fn().mockResolvedValue({ ok: false, error: 'llm_timeout', diagnosis: 'muse-vm が返事を始めなかった' }) });
    expect(r.handled && r.response).toContain('muse-vm が返事を始めなかった');
  });
  it('診断の文は原因ごとに違う', () => {
    expect(formatMuseBridgeDiagnosis({ cause: 'path_lost', elapsedMs: 1000, headersReceived: false, keepAliveOk: 0, keepAliveFailed: 3, bytesReceived: 0 })).toContain('通り道');
    expect(formatMuseBridgeDiagnosis({ cause: 'no_response_headers', elapsedMs: 1000, headersReceived: false, keepAliveOk: 5, keepAliveFailed: 0, bytesReceived: 0 })).toContain('返事を始めなかった');
    expect(formatMuseBridgeDiagnosis({ cause: 'body_stalled', elapsedMs: 1000, headersReceived: true, status: 200, contentType: 'text/event-stream', keepAliveOk: 5, keepAliveFailed: 0, bytesReceived: 20 })).toContain('text/event-stream');
  });
});
