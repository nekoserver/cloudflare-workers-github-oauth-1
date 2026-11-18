// 鍵の正当性を本番で確かめる記録(2026-11-13)。Muse は送信者を特定できない鍵には答えない。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WasmMuseBridge, museKeyFingerprint, type MuseKeyLog, type MuseKeyStat } from './wasmMuseBridge';
import { askMuseWorkerMessages } from './museWorkerAsk';

const enc = (s: string) => new TextEncoder().encode(s);
function memoryLog(): MuseKeyLog {
  const m = new Map<string, MuseKeyStat>();
  return { record(fp, ok) { const s = m.get(fp) ?? { fingerprint: fp, replied: 0, unanswered: 0 }; if (ok) s.replied++; else s.unanswered++; m.set(fp, s); }, list: () => [...m.values()].sort((a, b) => b.replied - a.replied) };
}
function museVm(registered: string) {
  return {
    status: () => JSON.stringify({ state: 'Running', peers: [{ name: 'muse-vm', online: true }] }),
    fetch: vi.fn(async (r: { url: string; headers: [string, string][] }) => {
      if (r.url.endsWith('/health')) return { status: 200, statusText: 'OK', url: r.url, headers: [], cancel: vi.fn(), read: vi.fn().mockResolvedValueOnce(enc('{"status":"ok"}')).mockResolvedValue(null) };
      if (r.headers.find(([k]) => k === 'Authorization')?.[1] !== 'Bearer ' + registered) return new Promise(() => {});
      return { status: 200, statusText: 'OK', url: r.url, headers: [], cancel: vi.fn(), read: vi.fn().mockResolvedValueOnce(enc('{"model":"muse","choices":[{"message":{"content":"ok"}}]}')).mockResolvedValue(null) };
    }),
  };
}
const ns = (bridge: WasmMuseBridge) => ({ idFromName: () => 'muse', get: () => ({ fetch: async (req: Request) => bridge.fetch(new Request(req.url, { method: req.method, headers: req.headers, body: await req.text() })) }) });
const ask = (bridge: WasmMuseBridge, key: string) => askMuseWorkerMessages({ TAILSCALE_WASM: ns(bridge), MUSE_API_KEY: key } as never, [{ role: 'user', content: 'q' }], undefined, 10, key);

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('鍵ごとの返事の記録', () => {
  it('特定されない鍵は、指紋つきで「返事なし」と、返事をもらえている鍵が並んで出る(鍵そのものは出ない)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const bridge = new WasmMuseBridge(museVm('good-key') as never, 'main-key', 290_000, 60_000, memoryLog());
    expect(await ask(bridge, 'good-key')).toMatchObject({ ok: true, reply: 'ok' });
    vi.useFakeTimers();
    const pending = ask(bridge, 'main-key');
    await vi.advanceTimersByTimeAsync(8_000);
    const r = await pending;
    const main = await museKeyFingerprint('main-key'), good = await museKeyFingerprint('good-key');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.diagnosis).toContain(`送った鍵 ${main}: 返事 0回・返事なし 1回 / 返事をもらえている鍵 ${good}: 1回`);
    expect(r.diagnosis).not.toContain('main-key');
  });
  it('指紋は sha256 の先頭8桁', async () => { expect(await museKeyFingerprint('abc')).toBe('ba7816bf'); });
});
